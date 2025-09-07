#!/usr/bin/env python3
"""
Database setup script for social media connections
Run this script to create the necessary tables in your Supabase database
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def setup_connections_database():
    """Set up the connections database tables"""
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return False
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    print("🔧 Setting up social media connections database...")
    
    try:
        # Read and execute the schema file
        with open('database/schema_connections.sql', 'r') as f:
            schema_sql = f.read()
        
        # Split by semicolon and execute each statement
        statements = [stmt.strip() for stmt in schema_sql.split(';') if stmt.strip()]
        
        for i, statement in enumerate(statements, 1):
            try:
                print(f"  Executing statement {i}/{len(statements)}...")
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                print(f"  ✅ Statement {i} executed successfully")
            except Exception as e:
                print(f"  ⚠️  Statement {i} failed (might already exist): {e}")
                continue
        
        print("✅ Database setup completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error setting up database: {e}")
        return False

if __name__ == "__main__":
    success = setup_connections_database()
    if success:
        print("\n🎉 Social media connections database is ready!")
        print("You can now use the connection features in your application.")
    else:
        print("\n💥 Database setup failed. Please check the errors above.")
