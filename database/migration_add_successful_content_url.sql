-- Migration: Add successful_content_url column to profiles table
-- This column stores the URL of uploaded video/photo/reel from successful campaigns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_content_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN profiles.successful_content_url IS 'URL of uploaded video, photo, or reel from successful campaigns (optional)';


-- This column stores the URL of uploaded video/photo/reel from successful campaigns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_content_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN profiles.successful_content_url IS 'URL of uploaded video, photo, or reel from successful campaigns (optional)';

-- This column stores the URL of uploaded video/photo/reel from successful campaigns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_content_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN profiles.successful_content_url IS 'URL of uploaded video, photo, or reel from successful campaigns (optional)';

-- This column stores the URL of uploaded video/photo/reel from successful campaigns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_content_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN profiles.successful_content_url IS 'URL of uploaded video, photo, or reel from successful campaigns (optional)';

-- This column stores the URL of uploaded video/photo/reel from successful campaigns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_content_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN profiles.successful_content_url IS 'URL of uploaded video, photo, or reel from successful campaigns (optional)';








