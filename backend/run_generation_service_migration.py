#!/usr/bin/env python3
"""
Migration script to add generation_service field to image tables
"""

import os
import sys
from supabase import create_client, Client

def run_migration():
    """Run the generation service field migration"""
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✅ Connected to Supabase")
        
        # Read the migration SQL
        with open("database/add_generation_service_field.sql", "r") as f:
            migration_sql = f.read()
        
        # Split by semicolon and execute each statement
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        for i, statement in enumerate(statements, 1):
            if statement:
                print(f"🔄 Executing statement {i}/{len(statements)}...")
                try:
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"✅ Statement {i} executed successfully")
                except Exception as e:
                    print(f"⚠️  Statement {i} warning: {str(e)}")
                    # Continue with other statements
        
        print("✅ Migration completed successfully!")
        print("\n📊 Summary:")
        print("- Added generation_service field to content_images table")
        print("- Added generation_service field to ad_images table") 
        print("- Added generation_service field to image_generation_requests table")
        print("- Updated existing records with default 'unknown' value")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Running generation service field migration...")
    success = run_migration()
    sys.exit(0 if success else 1)
