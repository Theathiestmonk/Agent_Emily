-- Migration: Add LinkedIn-specific fields to platform_connections table
-- This migration adds fields needed for LinkedIn connections

-- Add LinkedIn-specific columns to platform_connections table
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS headline TEXT,
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add comments for documentation
COMMENT ON COLUMN platform_connections.linkedin_id IS 'LinkedIn user ID';
COMMENT ON COLUMN platform_connections.headline IS 'LinkedIn profile headline';
COMMENT ON COLUMN platform_connections.email IS 'LinkedIn profile email address';
COMMENT ON COLUMN platform_connections.profile_picture IS 'LinkedIn profile picture URL';
