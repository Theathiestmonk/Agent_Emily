from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Any
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from ..auth import get_current_user, User
from ..database import get_db
from ..services.razorpay_service import RazorpayService
from ..models.subscription import SubscriptionPlan, SubscriptionTransaction
from ..schemas.subscription import (
    SubscriptionCreateRequest,
    SubscriptionResponse,
    SubscriptionStatusResponse,
    MigrationStatusResponse
)

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# Initialize Razorpay service
razorpay_service = RazorpayService()

@router.get("/plans")
async def get_subscription_plans(db: Session = Depends(get_db)):
    """Get all available subscription plans"""
    try:
        plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()
        
        plans_data = []
        for plan in plans:
            plans_data.append({
                "id": plan.id,
                "name": plan.name,
                "display_name": plan.display_name,
                "price_monthly": plan.price_monthly,
                "price_yearly": plan.price_yearly,
                "features": plan.features,
                "monthly_price_display": f"${plan.price_monthly / 100:.2f}",
                "yearly_price_display": f"${plan.price_yearly / 100:.2f}"
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's subscription status"""
    try:
        # Get user's subscription info from database
        result = db.execute(
            "SELECT * FROM get_user_subscription_info(:user_id)",
            {"user_id": current_user.id}
        ).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        
        return JSONResponse(content={
            "success": True,
            "status": result.subscription_status,
            "plan": result.subscription_plan,
            "has_active_subscription": result.has_active_subscription,
            "migration_status": result.migration_status,
            "grace_period_end": result.grace_period_end.isoformat() if result.grace_period_end else None,
            "days_left": result.days_left
        })
        
    except Exception as e:
        logger.error(f"Error fetching subscription status: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscription status")

@router.get("/migration-status")
async def get_migration_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's migration status for existing users"""
    try:
        # Check if user needs migration
        result = db.execute(
            "SELECT * FROM get_user_subscription_info(:user_id)",
            {"user_id": current_user.id}
        ).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        
        migration_info = {
            "needs_migration": False,
            "migration_type": None,
            "current_access": "none",
            "grace_period_end": None,
            "days_left": 0
        }
        
        # Check if user is grandfathered
        if result.migration_status == 'grandfathered' and result.grace_period_end:
            migration_info = {
                "needs_migration": True,
                "migration_type": "grandfathered",
                "current_access": "full",
                "grace_period_end": result.grace_period_end.isoformat(),
                "days_left": result.days_left
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new subscription"""
    try:
        # Check if user already has active subscription
        result = db.execute(
            "SELECT * FROM get_user_subscription_info(:user_id)",
            {"user_id": current_user.id}
        ).fetchone()
        
        if result.has_active_subscription:
            raise HTTPException(status_code=400, detail="User already has an active subscription")
        
        # Get plan details
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.name == request.plan_name,
            SubscriptionPlan.is_active == True
        ).first()
        
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
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
        db.execute("""
            UPDATE profiles 
            SET 
                razorpay_customer_id = :customer_id,
                razorpay_subscription_id = :subscription_id,
                subscription_plan = :plan_name,
                migration_status = 'migrated'
            WHERE id = :user_id
        """, {
            "customer_id": customer_id,
            "subscription_id": subscription['id'],
            "plan_name": request.plan_name,
            "user_id": current_user.id
        })
        
        db.commit()
        
        # Create payment link
        amount = plan.price_monthly if request.billing_cycle == "monthly" else plan.price_yearly
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

@router.post("/verify-payment")
async def verify_payment(
    payment_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify payment and update subscription status"""
    try:
        subscription_id = payment_data.get("subscription_id")
        payment_id = payment_data.get("payment_id")
        
        if not subscription_id or not payment_id:
            raise HTTPException(status_code=400, detail="Missing required payment data")
        
        # Get subscription details from Razorpay
        subscription_details = await razorpay_service.get_subscription_details(subscription_id)
        
        if subscription_details['status'] == 'active':
            # Update user subscription status
            db.execute("""
                UPDATE profiles 
                SET 
                    subscription_status = 'active',
                    subscription_start_date = NOW(),
                    subscription_end_date = NOW() + INTERVAL '1 month'
                WHERE razorpay_subscription_id = :subscription_id
            """, {"subscription_id": subscription_id})
            
            # Record transaction
            transaction = SubscriptionTransaction(
                user_id=current_user.id,
                subscription_id=subscription_id,
                razorpay_payment_id=payment_id,
                amount=subscription_details.get('plan', {}).get('item', {}).get('amount', 0),
                status='completed'
            )
            db.add(transaction)
            db.commit()
            
            return JSONResponse(content={
                "success": True,
                "message": "Payment verified and subscription activated"
            })
        else:
            raise HTTPException(status_code=400, detail="Payment verification failed")
            
    except Exception as e:
        logger.error(f"Error verifying payment: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify payment")

@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
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
        db.execute("""
            INSERT INTO subscription_webhooks (event_id, event_type, subscription_id, payment_id, payload)
            VALUES (:event_id, :event_type, :subscription_id, :payment_id, :payload)
            ON CONFLICT (event_id) DO NOTHING
        """, {
            "event_id": webhook_data.get("id"),
            "event_type": webhook_data.get("event"),
            "subscription_id": webhook_data.get("payload", {}).get("subscription", {}).get("entity", {}).get("id"),
            "payment_id": webhook_data.get("payload", {}).get("payment", {}).get("entity", {}).get("id"),
            "payload": webhook_data
        })
        
        # Process webhook based on event type
        event_type = webhook_data.get("event")
        
        if event_type == "subscription.activated":
            await _handle_subscription_activated(webhook_data, db)
        elif event_type == "subscription.charged":
            await _handle_subscription_charged(webhook_data, db)
        elif event_type == "subscription.cancelled":
            await _handle_subscription_cancelled(webhook_data, db)
        elif event_type == "subscription.completed":
            await _handle_subscription_completed(webhook_data, db)
        elif event_type == "subscription.paused":
            await _handle_subscription_paused(webhook_data, db)
        elif event_type == "subscription.resumed":
            await _handle_subscription_resumed(webhook_data, db)
        
        db.commit()
        
        return JSONResponse(content={"success": True})
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

async def _handle_subscription_activated(webhook_data: Dict[str, Any], db: Session):
    """Handle subscription activated webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Activate subscription in database
        db.execute("""
            UPDATE profiles 
            SET 
                subscription_status = 'active',
                subscription_start_date = NOW(),
                subscription_end_date = NOW() + INTERVAL '1 month'
            WHERE razorpay_subscription_id = :subscription_id
        """, {"subscription_id": subscription_id})

async def _handle_subscription_charged(webhook_data: Dict[str, Any], db: Session):
    """Handle subscription charged webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    payment = webhook_data.get("payload", {}).get("payment", {}).get("entity", {})
    
    subscription_id = subscription.get("id")
    payment_id = payment.get("id")
    
    if subscription_id and payment_id:
        # Record successful payment
        db.execute("""
            INSERT INTO subscription_transactions (user_id, subscription_id, razorpay_payment_id, amount, status)
            SELECT id, :subscription_id, :payment_id, :amount, 'completed'
            FROM profiles 
            WHERE razorpay_subscription_id = :subscription_id
        """, {
            "subscription_id": subscription_id,
            "payment_id": payment_id,
            "amount": payment.get("amount", 0)
        })
        
        # Update subscription end date
        db.execute("""
            UPDATE profiles 
            SET subscription_end_date = NOW() + INTERVAL '1 month'
            WHERE razorpay_subscription_id = :subscription_id
        """, {"subscription_id": subscription_id})

async def _handle_subscription_cancelled(webhook_data: Dict[str, Any], db: Session):
    """Handle subscription cancelled webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Cancel subscription in database
        db.execute("""
            UPDATE profiles 
            SET 
                subscription_status = 'cancelled',
                subscription_end_date = NOW()
            WHERE razorpay_subscription_id = :subscription_id
        """, {"subscription_id": subscription_id})

async def _handle_subscription_completed(webhook_data: Dict[str, Any], db: Session):
    """Handle subscription completed webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Mark subscription as completed
        db.execute("""
            UPDATE profiles 
            SET subscription_status = 'completed'
            WHERE razorpay_subscription_id = :subscription_id
        """, {"subscription_id": subscription_id})

async def _handle_subscription_paused(webhook_data: Dict[str, Any], db: Session):
    """Handle subscription paused webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Pause subscription in database
        db.execute("""
            UPDATE profiles 
            SET subscription_status = 'paused'
            WHERE razorpay_subscription_id = :subscription_id
        """, {"subscription_id": subscription_id})

async def _handle_subscription_resumed(webhook_data: Dict[str, Any], db: Session):
    """Handle subscription resumed webhook"""
    subscription = webhook_data.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription.get("id")
    
    if subscription_id:
        # Resume subscription in database
        db.execute("""
            UPDATE profiles 
            SET subscription_status = 'active'
            WHERE razorpay_subscription_id = :subscription_id
        """, {"subscription_id": subscription_id})
