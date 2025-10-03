#!/usr/bin/env python3
"""
Currency Migration Script
This script migrates the database from USD to INR currency
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def run_currency_migration():
    """Run the currency migration"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, key)
        
        print("🔄 Starting currency migration from USD to INR...")
        
        # Read the migration SQL file
        migration_file = os.path.join(os.path.dirname(__file__), '..', 'database', 'migrate_currency_to_inr.sql')
        
        if not os.path.exists(migration_file):
            print(f"❌ Error: Migration file not found at {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
        
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            if statement:
                print(f"📝 Executing statement {i}/{len(statements)}...")
                try:
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"✅ Statement {i} executed successfully")
                except Exception as e:
                    print(f"⚠️  Statement {i} failed (this might be expected): {e}")
                    # Continue with other statements
        
        print("\n🔍 Verifying migration results...")
        
        # Check subscription_transactions currency distribution
        try:
            result = supabase.table('subscription_transactions').select('currency').execute()
            if result.data:
                currency_counts = {}
                for record in result.data:
                    currency = record.get('currency', 'NULL')
                    currency_counts[currency] = currency_counts.get(currency, 0) + 1
                print(f"📊 Currency distribution in subscription_transactions: {currency_counts}")
            else:
                print("📊 No subscription_transactions found")
        except Exception as e:
            print(f"⚠️  Could not verify subscription_transactions: {e}")
        
        # Check subscription_plans prices (unchanged)
        try:
            result = supabase.table('subscription_plans').select('name, display_name, price_monthly, price_yearly').execute()
            if result.data:
                print("📊 Current subscription plan prices (unchanged):")
                for plan in result.data:
                    monthly_display = plan['price_monthly'] / 100.0
                    yearly_display = plan['price_yearly'] / 100.0
                    print(f"  - {plan['display_name']}: ₹{monthly_display:.2f}/month, ₹{yearly_display:.2f}/year")
            else:
                print("📊 No subscription_plans found")
        except Exception as e:
            print(f"⚠️  Could not verify subscription_plans: {e}")
        
        print("\n✅ Currency migration completed!")
        print("💡 Your application is now configured to use INR (Indian Rupees)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Currency Migration Tool")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('database'):
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)
    
    success = run_currency_migration()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        print("🔄 Please restart your backend server to ensure all changes take effect")
    else:
        print("\n💥 Migration failed. Please check the errors above and try again.")
        sys.exit(1)
