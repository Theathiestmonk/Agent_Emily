#!/usr/bin/env python3
"""
Check Auth Users Script
This script checks for users in the auth.users table
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def check_auth_users():
    """Check for users in auth.users table"""
    try:
        # Initialize Supabase client with service role key for admin access
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not service_key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, service_key)
        
        print("🔍 Checking for users in auth.users table...")
        
        # Check auth.users table (requires service role key)
        try:
            auth_result = supabase.table("auth.users").select("id, email, created_at").execute()
            
            if auth_result.data:
                print("📊 Found users in auth.users:")
                print("-" * 80)
                for i, user in enumerate(auth_result.data, 1):
                    print(f"{i}. User ID: {user.get('id')}")
                    print(f"   Email: {user.get('email', 'N/A')}")
                    print(f"   Created: {user.get('created_at', 'N/A')}")
                    print()
                
                # Check if any of these users have profiles
                print("🔍 Checking for corresponding profiles...")
                profiles_result = supabase.table("profiles").select("id, name, subscription_status").execute()
                
                if profiles_result.data:
                    print("📊 Found profiles:")
                    for profile in profiles_result.data:
                        print(f"  - {profile.get('name', 'N/A')} (ID: {profile.get('id')}) - Status: {profile.get('subscription_status', 'N/A')}")
                else:
                    print("❌ No profiles found - users exist in auth but not in profiles table")
                    print("💡 This suggests users haven't completed the signup process")
                
                return True
            else:
                print("❌ No users found in auth.users table")
                return False
                
        except Exception as e:
            print(f"❌ Error accessing auth.users: {e}")
            print("💡 This might be due to insufficient permissions or the table not existing")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Auth Users Checker")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = check_auth_users()
    
    if not success:
        print("\n💥 Check failed. Please check the errors above.")
        sys.exit(1)
