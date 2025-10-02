import os
import razorpay
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class RazorpayService:
    def __init__(self):
        self.client = razorpay.Client(
            auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET"))
        )
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
        # This would typically query your database
        # For now, we'll return mock data
        plans = {
            "starter": {
                "monthly": {
                    "razorpay_plan_id": "plan_starter_monthly",  # You'll need to create these in Razorpay
                    "price": 5900
                },
                "yearly": {
                    "razorpay_plan_id": "plan_starter_yearly",
                    "price": 59000
                }
            },
            "pro": {
                "monthly": {
                    "razorpay_plan_id": "plan_pro_monthly",
                    "price": 9900
                },
                "yearly": {
                    "razorpay_plan_id": "plan_pro_yearly",
                    "price": 99000
                }
            }
        }
        
        return plans.get(plan_name, {}).get(billing_cycle, {})
    
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
