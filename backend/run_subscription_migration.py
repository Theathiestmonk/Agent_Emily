#!/usr/bin/env python3
"""
Subscription System Migration Script
This script sets up the database schema for the subscription system
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client():
    """Get Supabase client from environment variables"""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        
        return create_client(supabase_url, supabase_key)
        
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        sys.exit(1)

def run_migration():
    """Run the subscription system migration"""
    print("🚀 Starting Subscription System Migration...")
    
    # Read the migration SQL file
    migration_file = os.path.join(os.path.dirname(__file__), 'database', 'subscription_schema.sql')
    
    if not os.path.exists(migration_file):
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    try:
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Connect to Supabase
        supabase = get_supabase_client()
        
        print("📊 Executing database migration...")
        
        # Split the SQL into individual statements and execute them
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        for i, statement in enumerate(statements, 1):
            if statement:
                try:
                    print(f"  Executing statement {i}/{len(statements)}...")
                    # Execute SQL using Supabase RPC
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"  ✅ Statement {i} executed successfully")
                except Exception as e:
                    print(f"  ⚠️  Statement {i} failed (may already exist): {e}")
                    continue
        
        print("✅ Migration completed successfully!")
        print("\n📋 Next steps:")
        print("1. Set up Razorpay API keys in your environment variables:")
        print("   - RAZORPAY_KEY_ID")
        print("   - RAZORPAY_KEY_SECRET")
        print("   - RAZORPAY_WEBHOOK_SECRET")
        print("2. Create subscription plans in Razorpay dashboard")
        print("3. Update the razorpay_plan_id fields in subscription_plans table")
        print("4. Test the subscription flow")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print("\n💡 Note: You may need to run the SQL statements manually in your Supabase dashboard")
        print("   Go to: https://supabase.com/dashboard/project/[your-project]/sql")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
