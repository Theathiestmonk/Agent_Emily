#!/usr/bin/env python3
"""
Trial System Migration Script
Run this script to set up the trial system in the database
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def run_trial_migration():
    """Run the trial system database migration"""
    try:
        # Initialize Supabase client with service role key
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not service_key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, service_key)
        
        print("🔍 Running trial system migration...")
        
        # Read the migration SQL file
        migration_file = os.path.join(os.path.dirname(__file__), "database", "trial_system_migration.sql")
        
        if not os.path.exists(migration_file):
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Execute the migration
        print("📝 Executing migration SQL...")
        result = supabase.rpc('exec_sql', {'sql': migration_sql}).execute()
        
        if result.data:
            print("✅ Trial system migration completed successfully!")
            
            # Verify the migration by checking if the new columns exist
            print("🔍 Verifying migration...")
            
            # Check if trial columns exist
            profiles_result = supabase.table("profiles").select("trial_activated_at, trial_expires_at").limit(1).execute()
            
            if profiles_result.data is not None:
                print("✅ Trial columns added successfully")
            else:
                print("⚠️ Warning: Could not verify trial columns")
            
            # Check if trial plan exists
            plans_result = supabase.table("subscription_plans").select("*").eq("name", "free_trial").execute()
            
            if plans_result.data and len(plans_result.data) > 0:
                print("✅ Free trial plan created successfully")
            else:
                print("⚠️ Warning: Free trial plan not found")
            
            print("\n🎉 Trial system is now ready!")
            print("📋 Next steps:")
            print("   1. Test the trial activation API")
            print("   2. Set up the trial expiration job")
            print("   3. Configure trial middleware")
            
            return True
        else:
            print("❌ Migration failed")
            return False
            
    except Exception as e:
        print(f"❌ Error running migration: {str(e)}")
        return False

def verify_trial_system():
    """Verify that the trial system is properly set up"""
    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not service_key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False
        
        supabase: Client = create_client(url, service_key)
        
        print("🔍 Verifying trial system setup...")
        
        # Check profiles table structure
        profiles_result = supabase.table("profiles").select("trial_activated_at, trial_expires_at").limit(1).execute()
        
        if profiles_result.data is not None:
            print("✅ Profiles table has trial columns")
        else:
            print("❌ Profiles table missing trial columns")
            return False
        
        # Check subscription plans
        plans_result = supabase.table("subscription_plans").select("*").eq("name", "free_trial").execute()
        
        if plans_result.data and len(plans_result.data) > 0:
            print("✅ Free trial plan exists")
        else:
            print("❌ Free trial plan not found")
            return False
        
        # Check database functions
        try:
            stats_result = supabase.rpc('get_trial_statistics').execute()
            if stats_result.data is not None:
                print("✅ Trial statistics function exists")
            else:
                print("⚠️ Warning: Trial statistics function not found")
        except Exception as e:
            print(f"⚠️ Warning: Could not test trial statistics function: {str(e)}")
        
        print("✅ Trial system verification completed!")
        return True
        
    except Exception as e:
        print(f"❌ Error verifying trial system: {str(e)}")
        return False

def main():
    """Main function"""
    print("🚀 Trial System Migration Script")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        success = verify_trial_system()
    else:
        success = run_trial_migration()
    
    if success:
        print("\n🎉 Operation completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Operation failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()


