#!/usr/bin/env python3
"""
Activate with Service Key Script
This script uses the service role key to activate subscription
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import uuid

# Load environment variables
load_dotenv()

def activate_with_service_key():
    """Activate subscription using service role key"""
    try:
        # Initialize Supabase client with service role key
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not service_key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, service_key)
        
        print("🔍 Checking profiles table with service role key...")
        
        # Try to read from profiles table
        result = supabase.table("profiles").select("*").limit(5).execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} profiles:")
            print("-" * 80)
            for i, profile in enumerate(result.data):
                print(f"[{i+1}] ID: {profile.get('id')}")
                print(f"    Name: {profile.get('name')}")
                print(f"    Subscription Status: {profile.get('subscription_status')}")
                print(f"    Subscription Plan: {profile.get('subscription_plan')}")
                print()
            
            # Use the first profile
            first_profile = result.data[0]
            user_id = first_profile['id']
            user_name = first_profile.get('name', 'Unknown')
            
            print(f"🔄 Activating subscription for: {user_name} (ID: {user_id})")
            
            # Set subscription details
            subscription_plan = "starter"
            subscription_status = "active"
            current_time = datetime.now().isoformat()
            
            # Update the user's profile to activate subscription
            update_data = {
                "subscription_status": subscription_status,
                "subscription_plan": subscription_plan,
                "razorpay_subscription_id": f"manual_activation_{str(uuid.uuid4())[:8]}",
                "subscription_start_date": current_time,
                "subscription_end_date": (datetime.now() + timedelta(days=30)).isoformat(),
                "migration_status": "migrated",
                "updated_at": current_time
            }
            
            update_result = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
            
            if update_result.data:
                print(f"✅ Subscription activated successfully for user {user_name}!")
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
                print(f"   Update result: {update_result}")
                return False
        else:
            print("❌ No profiles found even with service role key")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Activate with Service Key Tool")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = activate_with_service_key()
    
    if success:
        print("\n🎉 Subscription activation completed!")
        print("💡 The user should now be able to access the dashboard")
    else:
        print("\n💥 Activation failed. Please check the errors above and try again.")
        sys.exit(1)
