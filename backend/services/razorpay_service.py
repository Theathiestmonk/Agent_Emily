import os
import razorpay
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class RazorpayService:
    def __init__(self):
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        
        logger.info(f"Razorpay Key ID: {'SET' if key_id else 'NOT SET'}")
        logger.info(f"Razorpay Key Secret: {'SET' if key_secret else 'NOT SET'}")
        
        if not key_id or not key_secret:
            raise ValueError("Razorpay API keys not configured")
        
        self.client = razorpay.Client(auth=(key_id, key_secret))
        self.webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    
    async def create_customer(self, user_data: Dict[str, Any]) -> str:
        """Create a Razorpay customer"""
        try:
            customer_data = {
                "name": user_data.get("name", "User"),
                "email": user_data.get("email"),
                "contact": user_data.get("phone", ""),
                "notes": {
                    "user_id": user_data.get("id"),
                    "created_at": datetime.now().isoformat()
                }
            }
            
            customer = self.client.customer.create(customer_data)
            logger.info(f"Created Razorpay customer: {customer['id']}")
            return customer['id']
            
        except Exception as e:
            logger.error(f"Error creating Razorpay customer: {e}")
            raise
    
    async def create_subscription(self, customer_id: str, plan_id: str, billing_cycle: str = "monthly") -> Dict[str, Any]:
        """Create a Razorpay subscription"""
        try:
            # Get plan details from database
            plan = await self._get_plan_details(plan_id, billing_cycle)
            
            subscription_data = {
                "plan_id": plan['razorpay_plan_id'],
                "customer_id": customer_id,
                "total_count": 12 if billing_cycle == "yearly" else 1,  # 12 months for yearly, 1 for monthly
                "quantity": 1,
                "customer_notify": 1,
                "notes": {
                    "plan_name": plan_id,
                    "billing_cycle": billing_cycle,
                    "created_at": datetime.now().isoformat()
                }
            }
            
            subscription = self.client.subscription.create(subscription_data)
            logger.info(f"Created Razorpay subscription: {subscription['id']}")
            return subscription
            
        except Exception as e:
            logger.error(f"Error creating Razorpay subscription: {e}")
            raise
    
    async def get_subscription_details(self, subscription_id: str) -> Dict[str, Any]:
        """Get subscription details from Razorpay"""
        try:
            subscription = self.client.subscription.fetch(subscription_id)
            return subscription
        except Exception as e:
            logger.error(f"Error fetching subscription details: {e}")
            raise
    
    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Cancel a subscription"""
        try:
            subscription = self.client.subscription.cancel(subscription_id)
            logger.info(f"Cancelled subscription: {subscription_id}")
            return subscription
        except Exception as e:
            logger.error(f"Error cancelling subscription: {e}")
            raise
    
    async def verify_webhook(self, payload: str, signature: str) -> bool:
        """Verify Razorpay webhook signature"""
        try:
            self.client.utility.verify_webhook_signature(
                payload, signature, self.webhook_secret
            )
            return True
        except Exception as e:
            logger.error(f"Webhook verification failed: {e}")
            return False
    
    async def _get_plan_details(self, plan_name: str, billing_cycle: str) -> Dict[str, Any]:
        """Get plan details from database"""
        from supabase import create_client
        import os
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        supabase = create_client(supabase_url, supabase_key)
        
        # Get plan from database
        result = supabase.table("subscription_plans").select("*").eq("name", plan_name).eq("is_active", True).execute()
        
        if not result.data:
            raise ValueError(f"Plan {plan_name} not found")
        
        plan = result.data[0]
        
        # Return plan details based on billing cycle
        if billing_cycle == "monthly":
            return {
                "razorpay_plan_id": plan["razorpay_plan_id_monthly"],
                "price": plan["price_monthly"]
            }
        else:  # yearly
            return {
                "razorpay_plan_id": plan["razorpay_plan_id_yearly"],
                "price": plan["price_yearly"]
            }
    
    async def create_payment_link(self, subscription_id: str, amount: int, currency: str = "USD") -> str:
        """Create a payment link for subscription"""
        try:
            payment_link_data = {
                "amount": amount,
                "currency": currency,
                "description": f"Subscription payment for {subscription_id}",
                "customer": {
                    "name": "Customer",
                    "email": "customer@example.com"
                },
                "notify": {
                    "sms": True,
                    "email": True
                },
                "reminder_enable": True,
                "callback_url": f"{os.getenv('FRONTEND_URL')}/payment/success",
                "callback_method": "get"
            }
            
            payment_link = self.client.payment_link.create(payment_link_data)
            return payment_link['short_url']
            
        except Exception as e:
            logger.error(f"Error creating payment link: {e}")
            raise
