-- Create a function to check if an email exists in auth.users table
-- This function runs with elevated privileges to access the auth.users table securely

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
-- Revoke all privileges on the function from public
REVOKE ALL ON FUNCTION public.check_email_exists FROM public;

-- Grant execute privilege to the service_role
GRANT EXECUTE ON FUNCTION public.check_email_exists TO service_role;
