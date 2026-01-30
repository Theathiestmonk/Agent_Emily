#!/usr/bin/env python3
"""
Setup Gmail Sync Database Migration
Adds metadata column to platform_connections table for Gmail sync functionality
"""

import os
import sys
import logging
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_gmail_sync():
    """Setup Gmail sync by adding metadata column to platform_connections table"""

    # Get Supabase configuration
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_service_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
        sys.exit(1)

    try:
        # Create Supabase admin client
        supabase = create_client(supabase_url, supabase_service_key)

        print("🔄 Checking if metadata column exists in platform_connections table...")

        # Check if metadata column already exists
        try:
            # Try to select metadata column
            test_query = supabase.table("platform_connections").select("metadata").limit(1).execute()
            print("✅ Metadata column already exists!")
            return
        except Exception as e:
            if "does not exist" in str(e):
                print("📝 Metadata column doesn't exist, adding it...")
            else:
                raise e

        # Add metadata column using ALTER TABLE
        # Note: Supabase doesn't allow direct DDL through the client, so we'll use a workaround
        print("⚠️ Note: You'll need to run the SQL migration manually in Supabase dashboard")
        print("📄 SQL to run in Supabase SQL editor:")
        print()
        print("ALTER TABLE public.platform_connections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;")
        print("CREATE INDEX IF NOT EXISTS idx_platform_connections_metadata ON public.platform_connections USING GIN (metadata);")
        print("CREATE INDEX IF NOT EXISTS idx_platform_connections_platform_active ON public.platform_connections (platform, is_active) WHERE is_active = true;")
        print()
        print("Or run the setup_gmail_sync.sql file in the services directory")

    except Exception as e:
        print(f"❌ Error during Gmail sync setup: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Setting up Gmail sync database migration...")
    setup_gmail_sync()
