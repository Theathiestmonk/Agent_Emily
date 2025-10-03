#!/usr/bin/env python3
"""
Add blog_url column to blog_posts table
"""

import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env')

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_service_key:
    print("ERROR: Missing Supabase environment variables")
    exit(1)

supabase_admin = create_client(supabase_url, supabase_service_key)

def add_blog_url_column():
    """Add blog_url column to blog_posts table"""
    try:
        print("Adding blog_url column to blog_posts table...")
        
        # Read the SQL file
        with open('add_blog_url_column.sql', 'r') as f:
            sql = f.read()
        
        # Execute the SQL
        result = supabase_admin.rpc('exec_sql', {'sql': sql}).execute()
        
        print("Migration completed successfully!")
        print("Result:", result)
        
    except Exception as e:
        print(f"Migration failed: {e}")
        # Try alternative approach
        try:
            print("Trying alternative approach...")
            # Use direct SQL execution
            result = supabase_admin.postgrest.rpc('exec_sql', {'sql': sql}).execute()
            print("Alternative migration completed!")
            print("Result:", result)
        except Exception as e2:
            print(f"Alternative migration also failed: {e2}")

if __name__ == "__main__":
    add_blog_url_column()

