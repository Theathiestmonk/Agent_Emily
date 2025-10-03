#!/usr/bin/env python3
"""
Manual Subscription Activation Script
This script manually activates a subscription for testing purposes
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

def manual_activate_subscription():
    """Manually activate a subscription"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔍 Checking current subscription status...")
        
        # Get all users with subscription data
        result = supabase.table("profiles").select("id, name, subscription_status, razorpay_subscription_id, subscription_plan").execute()
        
        if not result.data:
            print("❌ No users found")
            return False
        
        print("📊 Current subscription status:")
        print("-" * 80)
        for user in result.data:
            print(f"User ID: {user.get('id')}")
            print(f"  Name: {user.get('name', 'N/A')}")
            print(f"  Subscription Status: {user.get('subscription_status', 'N/A')}")
            print(f"  Subscription Plan: {user.get('subscription_plan', 'N/A')}")
            print(f"  Razorpay Subscription ID: {user.get('razorpay_subscription_id', 'N/A')}")
            print()
        
        # Ask for user input
        user_id = input("Enter the user ID to activate subscription for: ").strip()
        
        if not user_id:
            print("❌ No user ID provided")
            return False
        
        # Find the user
        user = None
        for u in result.data:
            if u.get('id') == user_id:
                user = u
                break
        
        if not user:
            print(f"❌ User with ID {user_id} not found")
            return False
        
        print(f"✅ Found user: {user.get('name')} (ID: {user.get('id')})")
        
        # Ask for subscription plan
        plan = input("Enter subscription plan (starter/pro): ").strip().lower()
        if plan not in ['starter', 'pro']:
            print("❌ Invalid plan. Must be 'starter' or 'pro'")
            return False
        
        # Activate subscription
        print("🔄 Activating subscription...")
        
        now = datetime.utcnow()
        end_date = now + timedelta(days=30)  # 30 days from now
        
        update_result = supabase.table("profiles").update({
            "subscription_status": "active",
            "subscription_plan": plan,
            "subscription_start_date": now.isoformat(),
            "subscription_end_date": end_date.isoformat(),
            "migration_status": "migrated"
        }).eq("id", user['id']).execute()
        
        if update_result.data:
            print("✅ Subscription activated successfully!")
            print(f"   Plan: {plan}")
            print(f"   Start Date: {now.isoformat()}")
            print(f"   End Date: {end_date.isoformat()}")
            
            # Verify the update
            verify_result = supabase.table("profiles").select("subscription_status, subscription_plan, subscription_start_date, subscription_end_date").eq("id", user['id']).execute()
            
            if verify_result.data:
                updated_user = verify_result.data[0]
                print("\n📊 Updated subscription status:")
                print(f"   Status: {updated_user['subscription_status']}")
                print(f"   Plan: {updated_user['subscription_plan']}")
                print(f"   Start: {updated_user['subscription_start_date']}")
                print(f"   End: {updated_user['subscription_end_date']}")
            
            return True
        else:
            print("❌ Failed to activate subscription")
            return False
        
    except Exception as e:
        print(f"❌ Error activating subscription: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Manual Subscription Activation Tool")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = manual_activate_subscription()
    
    if success:
        print("\n🎉 Subscription activated successfully!")
        print("💡 The user should now be able to access the dashboard")
    else:
        print("\n💥 Activation failed. Please check the errors above and try again.")
        sys.exit(1)
