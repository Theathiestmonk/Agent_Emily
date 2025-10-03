#!/usr/bin/env python3
"""
Create Test Profile Script
This script creates a test profile and activates subscription
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import uuid

# Load environment variables
load_dotenv()

def create_test_profile():
    """Create a test profile and activate subscription"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔄 Creating test profile...")
        
        # Create a test user ID (this would normally come from auth.users)
        test_user_id = str(uuid.uuid4())
        
        # Create test profile
        test_profile = {
            "id": test_user_id,
            "name": "Test User",
            "subscription_status": "inactive",
            "subscription_plan": None,
            "onboarding_completed": False,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        create_result = supabase.table("profiles").insert(test_profile).execute()
        
        if create_result.data:
            print(f"✅ Test profile created successfully!")
            print(f"   User ID: {test_user_id}")
            print(f"   Name: Test User")
            
            # Now activate the subscription
            print("\n🔄 Activating subscription...")
            
            now = datetime.utcnow()
            end_date = now + timedelta(days=30)
            
            update_result = supabase.table("profiles").update({
                "subscription_status": "active",
                "subscription_plan": "starter",
                "subscription_start_date": now.isoformat(),
                "subscription_end_date": end_date.isoformat(),
                "migration_status": "migrated"
            }).eq("id", test_user_id).execute()
            
            if update_result.data:
                print("✅ Subscription activated successfully!")
                print(f"   Plan: starter")
                print(f"   Start Date: {now.isoformat()}")
                print(f"   End Date: {end_date.isoformat()}")
                
                # Verify the update
                verify_result = supabase.table("profiles").select("subscription_status, subscription_plan, subscription_start_date, subscription_end_date").eq("id", test_user_id).execute()
                
                if verify_result.data:
                    updated_profile = verify_result.data[0]
                    print("\n📊 Updated profile status:")
                    print(f"   Status: {updated_profile['subscription_status']}")
                    print(f"   Plan: {updated_profile['subscription_plan']}")
                    print(f"   Start: {updated_profile['subscription_start_date']}")
                    print(f"   End: {updated_profile['subscription_end_date']}")
                
                print(f"\n💡 You can now test with this user ID: {test_user_id}")
                return True
            else:
                print("❌ Failed to activate subscription")
                return False
        else:
            print("❌ Failed to create test profile")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Create Test Profile Tool")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = create_test_profile()
    
    if success:
        print("\n🎉 Test profile created and subscription activated!")
        print("💡 You can now test the subscription functionality")
    else:
        print("\n💥 Setup failed. Please check the errors above and try again.")
        sys.exit(1)
