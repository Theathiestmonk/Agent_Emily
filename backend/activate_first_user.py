#!/usr/bin/env python3
"""
Activate First User Script
This script directly activates subscription for the first user from the screenshot
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import uuid

# Load environment variables
load_dotenv()

def activate_first_user():
    """Activate subscription for the first user"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        # Use the first user ID from the screenshot
        user_id = "22ecf157-2eef-4aea-b1a7-67e7c09c0000"
        user_name = "xway@prakriti.org.in"
        
        print(f"🔄 Activating subscription for user: {user_name} (ID: {user_id})...")
        
        # Set subscription details
        subscription_plan = "starter"
        subscription_status = "active"
        current_time = datetime.utcnow().isoformat()
        
        # Update the user's profile to activate subscription
        update_data = {
            "subscription_status": subscription_status,
            "subscription_plan": subscription_plan,
            "razorpay_subscription_id": f"manual_activation_{str(uuid.uuid4())[:8]}",
            "subscription_start_date": current_time,
            "subscription_end_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "migration_status": "migrated",
            "updated_at": current_time
        }
        
        print("📝 Updating user profile with subscription data...")
        print(f"   Status: {subscription_status}")
        print(f"   Plan: {subscription_plan}")
        print(f"   Start Date: {current_time}")
        
        update_result = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        
        if update_result.data:
            print(f"✅ Subscription activated successfully for user {user_name}!")
            print(f"   User ID: {user_id}")
            print(f"   Status: {subscription_status}")
            print(f"   Plan: {subscription_plan}")
            print(f"   Razorpay ID: {update_data['razorpay_subscription_id']}")
            
            # Verify the update
            verify_result = supabase.table("profiles").select("subscription_status, subscription_plan, subscription_start_date, subscription_end_date").eq("id", user_id).execute()
            
            if verify_result.data:
                updated_profile = verify_result.data[0]
                print("\n📊 Verified updated profile status:")
                print(f"   Status: {updated_profile['subscription_status']}")
                print(f"   Plan: {updated_profile['subscription_plan']}")
                print(f"   Start: {updated_profile['subscription_start_date']}")
                print(f"   End: {updated_profile['subscription_end_date']}")
            
            return True
        else:
            print(f"❌ Failed to activate subscription for user {user_name}.")
            if hasattr(update_result, 'error'):
                print(f"   Error: {update_result.error}")
            return False
            
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Activate First User Tool")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = activate_first_user()
    
    if success:
        print("\n🎉 Subscription activation completed!")
        print("💡 The user should now be able to access the dashboard")
    else:
        print("\n💥 Activation failed. Please check the errors above and try again.")
        sys.exit(1)
