from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any
import os
import logging
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

from auth import get_current_user, User
from services.razorpay_service import RazorpayService
from schemas.subscription import (
    SubscriptionCreateRequest,
    SubscriptionResponse,
    SubscriptionStatusResponse,
    MigrationStatusResponse
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# Initialize Razorpay service
razorpay_service = RazorpayService()

@router.get("/test-razorpay")
async def test_razorpay():
    """Test Razorpay connectivity"""
    try:
        # Test if Razorpay client can be initialized
        from services.razorpay_service import RazorpayService
        razorpay_service = RazorpayService()
        
        # Test a simple API call
        plans = razorpay_service.client.plan.all()
        
        return JSONResponse(content={
            "success": True,
            "message": "Razorpay connection successful",
            "plans_count": len(plans.get('items', []))
        })
        
    except Exception as e:
        logger.error(f"Razorpay test failed: {e}")
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        }, status_code=500)

@router.get("/plans")
async def get_subscription_plans():
    """Get all available subscription plans"""
    try:
        result = supabase.table("subscription_plans").select("*").eq("is_active", True).execute()
        plans = result.data
        
        plans_data = []
        for plan in plans:
            plans_data.append({
                "id": plan["id"],
                "name": plan["name"],
                "display_name": plan["display_name"],
                "price_monthly": plan["price_monthly"],
                "price_yearly": plan["price_yearly"],
                "features": plan["features"],
                "monthly_price_display": f"Rs {plan['price_monthly'] / 100:.0f}",
                "yearly_price_display": f"Rs {plan['price_yearly'] / 100:.0f}"
            })
        
        return JSONResponse(content={
            "success": True,
            "plans": plans_data
        })
        
    except Exception as e:
        logger.error(f"Error fetching subscription plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscription plans")

@router.get("/status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user)
):
    """Get user's subscription status"""
    try:
        # Get user's subscription info from database
        result = supabase.rpc("get_user_subscription_info", {"user_uuid": current_user.id}).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_info = result.data[0]
        
        return JSONResponse(content={
            "success": True,
            "status": user_info["subscription_status"],
            "plan": user_info["subscription_plan"],
            "has_active_subscription": user_info["has_active_subscription"],
            "migration_status": user_info["migration_status"],
            "grace_period_end": user_info["grace_period_end"],
            "days_left": user_info["days_left"]
        })
        
    except Exception as e:
        logger.error(f"Error fetching subscription status: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscription status")

@router.get("/migration-status")
async def get_migration_status(
    current_user: User = Depends(get_current_user)
):
    """Get user's migration status for existing users"""
    try:
        # Check if user needs migration
        result = supabase.rpc("get_user_subscription_info", {"user_uuid": current_user.id}).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_info = result.data[0]
        
        migration_info = {
            "needs_migration": False,
            "migration_type": None,
            "current_access": "none",
            "grace_period_end": None,
            "days_left": 0
        }
        
        # Check if user is grandfathered
        if user_info["migration_status"] == 'grandfathered' and user_info["grace_period_end"]:
            migration_info = {
                "needs_migration": True,
                "migration_type": "grandfathered",
                "current_access": "full",
                "grace_period_end": user_info["grace_period_end"],
                "days_left": user_info["days_left"]
            }
        
        return JSONResponse(content={
            "success": True,
            "migration_info": migration_info
        })
        
    except Exception as e:
        logger.error(f"Error fetching migration status: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch migration status")

@router.post("/create")
async def create_subscription(
    request: SubscriptionCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new subscription"""
    try:
        # Check if user already has active subscription
        result = supabase.rpc("get_user_subscription_info", {"user_uuid": current_user.id}).execute()
        
        if result.data and result.data[0]["has_active_subscription"]:
            raise HTTPException(status_code=400, detail="User already has an active subscription")
        
        # Get plan details
        plan_result = supabase.table("subscription_plans").select("*").eq("name", request.plan_name).eq("is_active", True).execute()
        
        if not plan_result.data:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        plan = plan_result.data[0]
        
        # Create Razorpay customer
        customer_id = await razorpay_service.create_customer({
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email
        })
        
        # Create Razorpay subscription
        subscription = await razorpay_service.create_subscription(
            customer_id, 
            request.plan_name, 
            request.billing_cycle
        )
        
        # Update user profile with subscription info
        supabase.table("profiles").update({
            "razorpay_customer_id": customer_id,
            "razorpay_subscription_id": subscription['id'],
            "subscription_plan": request.plan_name,
            "migration_status": 'migrated'
        }).eq("id", current_user.id).execute()
        
        # Create payment link
        amount = plan["price_monthly"] if request.billing_cycle == "monthly" else plan["price_yearly"]
        payment_url = await razorpay_service.create_payment_link(
            subscription['id'], 
            amount
        )
        
        return JSONResponse(content={
            "success": True,
            "subscription_id": subscription['id'],
            "customer_id": customer_id,
            "payment_url": payment_url,
            "message": "Subscription created successfully"
        })
        
    except Exception as e:
        logger.error(f"Error creating subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription")

@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhooks"""
    try:
        payload = await request.body()
        signature = request.headers.get("X-Razorpay-Signature")
        
        if not signature:
            raise HTTPException(status_code=400, detail="Missing signature")
        
        # Verify webhook signature
        if not await razorpay_service.verify_webhook(payload.decode(), signature):
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse webhook data
        webhook_data = await request.json()
        
        # Store webhook event
        supabase.table("subscription_webhooks").insert({
            "event_id": webhook_data.get("id"),
            "event_type": webhook_data.get("event"),
            "subscription_id": webhook_data.get("payload", {}).get("subscription", {}).get("entity", {}).get("id"),
            "payment_id": webhook_data.get("payload", {}).get("payment", {}).get("entity", {}).get("id"),
            "payload": webhook_data
        }).execute()
        
        # Process webhook based on event type
        event_type = webhook_data.get("event")
        
        if event_type == "subscription.activated":
            await _handle_subscription_activated(webhook_data)
        elif event_type == "subscription.charged":
            await _handle_subscription_charged(webhook_data)
        elif event_type == "subscription.cancelled":
            await _handle_subscription_cancelled(webhook_data)
        elif event_type == "subscription.completed":
            await _handle_subscription_completed(webhook_data)
        elif event_type == "subscription.paused":
            await _handle_subscription_paused(webhook_data)
        elif event_type == "subscription.resumed":
            await _handle_subscription_resumed(webhook_data)
        
        return JSONResponse(content={"success": True})
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

async def _handle_subscription_activated(webhook_data: Dict[str, Any]):
    """Handle subscription activated webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Activate subscription in database
        supabase.table("profiles").update({
            "subscription_status": 'active',
            "subscription_start_date": datetime.utcnow().isoformat(),
            "subscription_end_date": (datetime.utcnow() + timedelta(days=30)).isoformat()
        }).eq("razorpay_subscription_id", subscription_id).execute()

async def _handle_subscription_charged(webhook_data: Dict[str, Any]):
    """Handle subscription charged webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    payment = webhook_data.get("payload", {}).get("payment", {}).get("entity", {})
    
    subscription_id = subscription.get("id")
    payment_id = payment.get("id")
    
    if subscription_id and payment_id:
        # Record successful payment
        supabase.table("subscription_transactions").insert({
            "subscription_id": subscription_id,
            "razorpay_payment_id": payment_id,
            "amount": payment.get("amount", 0),
            "status": 'completed'
        }).execute()
        
        # Update subscription end date
        supabase.table("profiles").update({
            "subscription_end_date": (datetime.utcnow() + timedelta(days=30)).isoformat()
        }).eq("razorpay_subscription_id", subscription_id).execute()

async def _handle_subscription_cancelled(webhook_data: Dict[str, Any]):
    """Handle subscription cancelled webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Cancel subscription in database
        supabase.table("profiles").update({
            "subscription_status": 'cancelled',
            "subscription_end_date": datetime.utcnow().isoformat()
        }).eq("razorpay_subscription_id", subscription_id).execute()

async def _handle_subscription_completed(webhook_data: Dict[str, Any]):
    """Handle subscription completed webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Mark subscription as completed
        supabase.table("profiles").update({
            "subscription_status": 'completed'
        }).eq("razorpay_subscription_id", subscription_id).execute()

async def _handle_subscription_paused(webhook_data: Dict[str, Any]):
    """Handle subscription paused webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Pause subscription in database
        supabase.table("profiles").update({
            "subscription_status": 'paused'
        }).eq("razorpay_subscription_id", subscription_id).execute()

async def _handle_subscription_resumed(webhook_data: Dict[str, Any]):
    """Handle subscription resumed webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Resume subscription in database
        supabase.table("profiles").update({
            "subscription_status": 'active'
        }).eq("razorpay_subscription_id", subscription_id).execute()