#!/usr/bin/env python3
"""
Check Subscription Prices Script
This script checks the current subscription plan prices in the database
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def check_subscription_prices():
    """Check current subscription plan prices"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔍 Checking subscription plan prices...")
        
        # Get all subscription plans
        result = supabase.table("subscription_plans").select("*").execute()
        
        if result.data:
            print("📊 Current subscription plan prices:")
            print("-" * 50)
            
            for plan in result.data:
                monthly_rupees = plan['price_monthly'] / 100.0
                yearly_rupees = plan['price_yearly'] / 100.0
                
                print(f"Plan: {plan['display_name']} ({plan['name']})")
                print(f"  Monthly: {plan['price_monthly']} paise = ₹{monthly_rupees:.2f}")
                print(f"  Yearly: {plan['price_yearly']} paise = ₹{yearly_rupees:.2f}")
                print(f"  Features: {', '.join(plan['features'])}")
                print(f"  Active: {plan['is_active']}")
                print()
            
            return True
        else:
            print("❌ No subscription plans found in database")
            return False
        
    except Exception as e:
        print(f"❌ Error checking subscription prices: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Subscription Prices Checker")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = check_subscription_prices()
    
    if not success:
        print("\n💥 Check failed. Please check the errors above.")
        sys.exit(1)
