#!/usr/bin/env python3
"""
Pro Plan Features Update Script
This script updates the Pro plan features to reflect managed agents service
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def update_pro_plan_features():
    """Update Pro plan features"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔄 Updating Pro plan features...")
        
        # Update the Pro plan features
        result = supabase.table("subscription_plans").update({
            "features": ["Managed Agents", "Advanced Analytics", "Priority Support", "Custom Integrations"]
        }).eq("name", "pro").execute()
        
        if result.data:
            print("✅ Pro plan features updated successfully!")
            
            # Verify the update
            verify_result = supabase.table("subscription_plans").select("name, display_name, features").eq("name", "pro").execute()
            
            if verify_result.data:
                plan = verify_result.data[0]
                print(f"📊 Updated Pro plan features:")
                print(f"   Plan: {plan['display_name']}")
                print(f"   Features: {', '.join(plan['features'])}")
            
            return True
        else:
            print("❌ Failed to update Pro plan features")
            return False
        
    except Exception as e:
        print(f"❌ Error updating Pro plan features: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Pro Plan Features Update Tool")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = update_pro_plan_features()
    
    if success:
        print("\n🎉 Pro plan features updated successfully!")
        print("💡 The Pro plan now shows 'Managed Agents' instead of 'All AI Agents'")
    else:
        print("\n💥 Update failed. Please check the errors above and try again.")
        sys.exit(1)
