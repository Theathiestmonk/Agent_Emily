#!/usr/bin/env python3
"""
Run website analysis database migration
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def run_migration():
    """Run the website analysis database migration"""
    try:
        # Get Supabase configuration
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_key:
            print("❌ Error: Missing Supabase configuration")
            print("Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file")
            return False
        
        # Initialize Supabase client
        supabase = create_client(supabase_url, supabase_service_key)
        
        # Read the migration file
        migration_file = Path(__file__).parent.parent / "database" / "website_analysis_schema.sql"
        
        if not migration_file.exists():
            print(f"❌ Error: Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("🔄 Running website analysis database migration...")
        
        # Execute the migration
        result = supabase.rpc('exec_sql', {'sql': migration_sql}).execute()
        
        if result.data:
            print("✅ Website analysis database migration completed successfully!")
            print("📊 Created tables:")
            print("   - website_analyses")
            print("   - website_analysis_history")
            print("   - website_analysis_cache")
            print("   - website_analysis_settings")
            print("🔐 RLS policies configured")
            print("📈 Database functions created")
            return True
        else:
            print("❌ Migration failed - no data returned")
            return False
            
    except Exception as e:
        print(f"❌ Error running migration: {str(e)}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
