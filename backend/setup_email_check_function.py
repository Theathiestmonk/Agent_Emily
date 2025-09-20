#!/usr/bin/env python3
"""
Script to set up the check_email_exists function in Supabase
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def setup_email_check_function():
    """Set up the check_email_exists function in Supabase"""
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return False
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # SQL function to create
    sql_function = """
    CREATE OR REPLACE FUNCTION public.check_email_exists(user_email text) 
    RETURNS boolean
    AS $$
    DECLARE
      email_exists boolean;
    BEGIN
      -- Check if the email exists in the auth.users table
      SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE lower(email) = lower(user_email)
      ) INTO email_exists;

      RETURN email_exists;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Set appropriate permissions
    REVOKE ALL ON FUNCTION public.check_email_exists FROM public;
    GRANT EXECUTE ON FUNCTION public.check_email_exists TO service_role;
    """
    
    try:
        # Execute the SQL function
        result = supabase.rpc('exec_sql', {'sql': sql_function}).execute()
        print("✅ Successfully created check_email_exists function")
        return True
        
    except Exception as e:
        print(f"❌ Error creating function: {str(e)}")
        
        # Try alternative approach using direct SQL execution
        try:
            # This might work if the RPC function doesn't exist
            print("Trying alternative approach...")
            # Note: This approach might not work depending on Supabase setup
            print("Please run the SQL function manually in your Supabase SQL editor:")
            print(sql_function)
            return False
        except Exception as e2:
            print(f"Alternative approach also failed: {str(e2)}")
            return False

if __name__ == "__main__":
    setup_email_check_function()
