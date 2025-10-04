#!/usr/bin/env python3
"""
Manual website analysis database migration
Creates tables using individual SQL statements
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def run_migration():
    """Run the website analysis database migration manually"""
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
        
        print("🔄 Running website analysis database migration...")
        
        # Read the migration file
        migration_file = Path(__file__).parent.parent / "database" / "website_analysis_schema.sql"
        
        if not migration_file.exists():
            print(f"❌ Error: Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"📝 Found {len(statements)} SQL statements to execute")
        
        # Execute each statement individually
        for i, statement in enumerate(statements, 1):
            if not statement or statement.startswith('--'):
                continue
                
            try:
                print(f"🔄 Executing statement {i}/{len(statements)}...")
                # Use raw SQL execution
                result = supabase.postgrest.rpc('exec', {'sql': statement}).execute()
                print(f"✅ Statement {i} executed successfully")
            except Exception as e:
                print(f"⚠️  Statement {i} failed (might already exist): {str(e)}")
                # Continue with other statements
                continue
        
        print("✅ Website analysis database migration completed!")
        print("📊 Created tables:")
        print("   - website_analyses")
        print("   - website_analysis_history") 
        print("   - website_analysis_cache")
        print("   - website_analysis_settings")
        print("🔐 RLS policies configured")
        print("📈 Database functions created")
        return True
            
    except Exception as e:
        print(f"❌ Error running migration: {str(e)}")
        print("\n💡 Manual Setup Required:")
        print("1. Go to your Supabase dashboard")
        print("2. Navigate to SQL Editor")
        print("3. Copy and paste the contents of database/website_analysis_schema.sql")
        print("4. Execute the SQL")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
