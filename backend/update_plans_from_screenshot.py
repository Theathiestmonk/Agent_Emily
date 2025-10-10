#!/usr/bin/env python3
"""
Update Subscription Plans Script
Updates test plans to proper Pro and Starter plans based on screenshot values
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def update_subscription_plans():
    """Update subscription plans to proper Pro and Starter plans"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔄 Updating subscription plans...")
        
        # Define the new plans based on screenshot values
        new_plans = [
            {
                "name": "starter",
                "display_name": "Starter Monthly",
                "price_monthly": 499900,  # ₹4,999.00 in paise
                "price_yearly": 5998800,  # ₹59,988.00 in paise
                "features": {
                    "features": [
                        "Social media content generation",
                        "Basic analytics",
                        "Up to 3 platforms",
                        "Email support",
                        "Basic templates"
                    ],
                    "trial": False,
                    "duration_days": 30
                },
                "is_active": True
            },
            {
                "name": "pro",
                "display_name": "Pro Monthly", 
                "price_monthly": 899900,  # ₹8,999.00 in paise
                "price_yearly": 10798800,  # ₹1,07,988.00 in paise
                "features": {
                    "features": [
                        "Advanced content generation",
                        "Advanced analytics",
                        "All platforms",
                        "Priority support",
                        "Premium templates",
                        "Custom branding",
                        "API access",
                        "White-label options"
                    ],
                    "trial": False,
                    "duration_days": 30
                },
                "is_active": True
            }
        ]
        
        # First, get existing plans to see what needs to be updated
        existing_plans = supabase.table("subscription_plans").select("*").execute()
        
        print("📊 Current plans in database:")
        for plan in existing_plans.data:
            print(f"  - {plan['name']}: {plan['display_name']}")
        
        # Update or insert each plan
        for plan_data in new_plans:
            print(f"\n🔄 Processing plan: {plan_data['name']}")
            
            # Check if plan exists
            existing = supabase.table("subscription_plans").select("*").eq("name", plan_data["name"]).execute()
            
            if existing.data:
                # Update existing plan
                print(f"  📝 Updating existing plan: {plan_data['name']}")
                result = supabase.table("subscription_plans").update(plan_data).eq("name", plan_data["name"]).execute()
                
                if result.data:
                    print(f"  ✅ Successfully updated {plan_data['name']}")
                else:
                    print(f"  ❌ Failed to update {plan_data['name']}")
            else:
                # Insert new plan
                print(f"  ➕ Creating new plan: {plan_data['name']}")
                result = supabase.table("subscription_plans").insert(plan_data).execute()
                
                if result.data:
                    print(f"  ✅ Successfully created {plan_data['name']}")
                else:
                    print(f"  ❌ Failed to create {plan_data['name']}")
        
        # Deactivate test plans
        print("\n🔄 Deactivating test plans...")
        test_plan_names = ["test_pro_monthly", "test_starter_monthly"]
        
        for test_plan in test_plan_names:
            result = supabase.table("subscription_plans").update({"is_active": False}).eq("name", test_plan).execute()
            if result.data:
                print(f"  ✅ Deactivated {test_plan}")
            else:
                print(f"  ⚠️  {test_plan} not found or already inactive")
        
        # Verify the final state
        print("\n📊 Final plans in database:")
        final_plans = supabase.table("subscription_plans").select("*").eq("is_active", True).execute()
        
        for plan in final_plans.data:
            monthly_rupees = plan['price_monthly'] / 100.0
            yearly_rupees = plan['price_yearly'] / 100.0
            print(f"  ✅ {plan['display_name']} ({plan['name']})")
            print(f"     Monthly: ₹{monthly_rupees:.2f}")
            print(f"     Yearly: ₹{yearly_rupees:.2f}")
        
        print("\n🎉 Plan update completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error updating subscription plans: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Subscription Plans Updater")
    print("=" * 50)
    
    success = update_subscription_plans()
    
    if success:
        print("\n✅ All plans updated successfully!")
        sys.exit(0)
    else:
        print("\n❌ Plan update failed!")
        sys.exit(1)


