#!/usr/bin/env python3
"""
Manual Subscription System Setup
This script will guide you through setting up the subscription system manually
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def print_setup_instructions():
    """Print step-by-step setup instructions"""
    print("🚀 Subscription System Setup Guide")
    print("=" * 50)
    
    print("\n📋 Step 1: Database Setup")
    print("Go to your Supabase dashboard SQL editor:")
    print("https://supabase.com/dashboard/project/[your-project]/sql")
    print("\nCopy and paste the following SQL:")
    print("-" * 30)
    
    # Read and display the SQL file
    sql_file = os.path.join(os.path.dirname(__file__), '..', 'database', 'subscription_schema.sql')
    if os.path.exists(sql_file):
        with open(sql_file, 'r') as f:
            sql_content = f.read()
        print(sql_content)
    else:
        print("❌ SQL file not found!")
        return
    
    print("\n📋 Step 2: Environment Variables")
    print("Add these to your .env file:")
    print("-" * 30)
    print("RAZORPAY_KEY_ID=your_razorpay_key_id")
    print("RAZORPAY_KEY_SECRET=your_razorpay_key_secret")
    print("RAZORPAY_WEBHOOK_SECRET=your_webhook_secret")
    print("FRONTEND_URL=http://localhost:3005")
    
    print("\n📋 Step 3: Razorpay Setup")
    print("1. Go to Razorpay Dashboard: https://dashboard.razorpay.com/")
    print("2. Create subscription plans:")
    print("   - Starter Monthly: ₹59/month")
    print("   - Starter Yearly: ₹590/year")
    print("   - Pro Monthly: ₹99/month")
    print("   - Pro Yearly: ₹990/year")
    print("3. Copy the plan IDs and update the subscription_plans table")
    
    print("\n📋 Step 4: Test the Integration")
    print("1. Start your backend server")
    print("2. Start your frontend server")
    print("3. Test the subscription flow")
    
    print("\n✅ Setup Complete!")
    print("Your subscription system is now ready!")

if __name__ == "__main__":
    print_setup_instructions()
