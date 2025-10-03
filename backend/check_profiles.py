#!/usr/bin/env python3
"""
Check Profiles Script
This script checks what's in the profiles table
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def check_profiles():
    """Check what's in the profiles table"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔍 Checking profiles table...")
        
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
                print(f"    Onboarding Completed: {profile.get('onboarding_completed')}")
                print()
            
            # Try to update the first profile
            first_profile = result.data[0]
            user_id = first_profile['id']
            user_name = first_profile.get('name', 'Unknown')
            
            print(f"🔄 Attempting to update profile for: {user_name} (ID: {user_id})")
            
            # Simple update test
            update_result = supabase.table("profiles").update({
                "subscription_status": "active",
                "subscription_plan": "starter"
            }).eq("id", user_id).execute()
            
            if update_result.data:
                print("✅ Update successful!")
                return True
            else:
                print("❌ Update failed!")
                print(f"Error: {update_result}")
                return False
        else:
            print("❌ No profiles found")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Check Profiles Tool")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = check_profiles()
    
    if success:
        print("\n🎉 Profile check completed successfully!")
    else:
        print("\n💥 Profile check failed.")
        sys.exit(1)
