-- Migration to add logo_url field to profiles table
-- This field will store the URL of the uploaded business logo

-- Add logo_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS logo_url text NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.logo_url IS 'URL of the uploaded business logo stored in Supabase Logo bucket';

-- Add index for better performance when querying by logo
CREATE INDEX IF NOT EXISTS idx_profiles_logo_url ON profiles(logo_url) WHERE logo_url IS NOT NULL;
