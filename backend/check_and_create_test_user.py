#!/usr/bin/env python3
"""
Check and Create Test User Script
This script checks for users and creates a test profile if needed
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import uuid

# Load environment variables
load_dotenv()

def check_existing_users():
    """Check for existing users and activate subscription for one of them"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔍 Checking for existing users...")
        
        # Check profiles table
        profiles_result = supabase.table("profiles").select("id, name, subscription_status, subscription_plan").execute()
        
        if not profiles_result.data:
            print("❌ No profiles found in the database")
            return False
        
        print("📊 Found existing profiles:")
        print("-" * 80)
        for i, profile in enumerate(profiles_result.data, 1):
            print(f"{i}. User ID: {profile.get('id')}")
            print(f"   Name: {profile.get('name', 'N/A')}")
            print(f"   Subscription Status: {profile.get('subscription_status', 'N/A')}")
            print(f"   Subscription Plan: {profile.get('subscription_plan', 'N/A')}")
            print()
        
        # Ask user to select which profile to activate
        try:
            choice = int(input("Enter the number of the user to activate subscription for: ")) - 1
            if choice < 0 or choice >= len(profiles_result.data):
                print("❌ Invalid selection")
                return False
            
            selected_user = profiles_result.data[choice]
            user_id = selected_user['id']
            user_name = selected_user.get('name', 'Unknown')
            
            print(f"✅ Selected user: {user_name} (ID: {user_id})")
            
            # Ask for subscription plan
            plan = input("Enter subscription plan (starter/pro): ").strip().lower()
            if plan not in ['starter', 'pro']:
                print("❌ Invalid plan. Must be 'starter' or 'pro'")
                return False
            
            # Activate subscription
            print("🔄 Activating subscription...")
            
            now = datetime.utcnow()
            end_date = now + timedelta(days=30)
            
            update_result = supabase.table("profiles").update({
                "subscription_status": "active",
                "subscription_plan": plan,
                "subscription_start_date": now.isoformat(),
                "subscription_end_date": end_date.isoformat(),
                "migration_status": "migrated"
            }).eq("id", user_id).execute()
            
            if update_result.data:
                print("✅ Subscription activated successfully!")
                print(f"   User: {user_name}")
                print(f"   Plan: {plan}")
                print(f"   Start Date: {now.isoformat()}")
                print(f"   End Date: {end_date.isoformat()}")
                return True
            else:
                print("❌ Failed to activate subscription")
                return False
                
        except ValueError:
            print("❌ Please enter a valid number")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 User Subscription Activation Tool")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = check_existing_users()
    
    if success:
        print("\n🎉 Subscription activated successfully!")
        print("💡 The user should now be able to access the dashboard")
    else:
        print("\n💥 Activation failed. Please check the errors above and try again.")
        sys.exit(1)
