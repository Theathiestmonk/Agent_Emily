#!/usr/bin/env python3
"""
Script to run the ads creation schema migration
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

def run_ads_migration():
    """Run the ads creation schema migration"""
    print("🔄 Starting ads creation schema migration...")
    print("This will create the necessary tables for ads creation functionality.")
    print()
    
    # Check required environment variables
    required_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please set these in your .env file or environment")
        sys.exit(1)
    
    try:
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        supabase = create_client(supabase_url, supabase_key)
        
        # Read the ads schema file
        schema_path = Path(__file__).parent.parent / "database" / "ads_creation_schema.sql"
        
        if not schema_path.exists():
            print(f"❌ Schema file not found: {schema_path}")
            sys.exit(1)
        
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        print("📄 Executing ads creation schema...")
        
        # Execute the schema
        result = supabase.rpc('exec_sql', {'sql': schema_sql}).execute()
        
        if result.data:
            print("✅ Ads creation schema migration completed successfully!")
            print("Created tables:")
            print("  - ad_campaigns")
            print("  - ad_copies")
            print("  - ad_images")
            print("  - ad_performance")
            print()
            print("The ads creation functionality is now ready to use!")
        else:
            print("❌ Migration failed - no data returned")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_ads_migration()
