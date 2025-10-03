#!/usr/bin/env python3
"""
Fix Subscription Prices Script
This script fixes the subscription plan prices if they are incorrect
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def fix_subscription_prices():
    """Fix subscription plan prices"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔧 Fixing subscription plan prices...")
        
        # Update Starter plan prices (₹59/month, ₹590/year)
        starter_result = supabase.table("subscription_plans").update({
            "price_monthly": 5900,  # ₹59 in paise
            "price_yearly": 59000   # ₹590 in paise
        }).eq("name", "starter").execute()
        
        if starter_result.data:
            print("✅ Starter plan prices updated: ₹59/month, ₹590/year")
        else:
            print("❌ Failed to update Starter plan prices")
        
        # Update Pro plan prices (₹99/month, ₹990/year)
        pro_result = supabase.table("subscription_plans").update({
            "price_monthly": 9900,  # ₹99 in paise
            "price_yearly": 99000   # ₹990 in paise
        }).eq("name", "pro").execute()
        
        if pro_result.data:
            print("✅ Pro plan prices updated: ₹99/month, ₹990/year")
        else:
            print("❌ Failed to update Pro plan prices")
        
        # Verify the updates
        print("\n🔍 Verifying updated prices...")
        result = supabase.table("subscription_plans").select("*").execute()
        
        if result.data:
            print("📊 Updated subscription plan prices:")
            print("-" * 50)
            
            for plan in result.data:
                monthly_rupees = plan['price_monthly'] / 100.0
                yearly_rupees = plan['price_yearly'] / 100.0
                
                print(f"Plan: {plan['display_name']} ({plan['name']})")
                print(f"  Monthly: {plan['price_monthly']} paise = ₹{monthly_rupees:.2f}")
                print(f"  Yearly: {plan['price_yearly']} paise = ₹{yearly_rupees:.2f}")
                print()
            
            return True
        else:
            print("❌ No subscription plans found after update")
            return False
        
    except Exception as e:
        print(f"❌ Error fixing subscription prices: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Subscription Prices Fixer")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = fix_subscription_prices()
    
    if success:
        print("\n🎉 Subscription prices fixed successfully!")
        print("💡 The subscription page should now show the correct prices")
    else:
        print("\n💥 Fix failed. Please check the errors above and try again.")
        sys.exit(1)
