#!/usr/bin/env python3
"""
Simple script to run the image migration
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import and run migration
from migrate_images_to_storage import main

if __name__ == "__main__":
    print("🔄 Starting image migration to Supabase storage...")
    print("This will migrate all external DALL-E URLs to Supabase storage for faster loading.")
    print()
    
    # Check required environment variables
    required_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please set these in your .env file or environment")
        sys.exit(1)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  Migration cancelled by user")
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        sys.exit(1)
