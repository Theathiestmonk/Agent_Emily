-- Migration: Add target audience age range, gender, multiple content URLs, and brand colors
-- Date: 2024
-- Description: Adds new fields for improved target audience selection and brand color management

-- Add target audience age range fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS target_audience_age_min INTEGER,
ADD COLUMN IF NOT EXISTS target_audience_age_max INTEGER;

-- Add target audience gender field
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS target_audience_gender TEXT CHECK (target_audience_gender IN ('all', 'men', 'women'));

-- Add multiple successful content URLs (array to support up to 4 uploads)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS successful_content_urls TEXT[];

-- Add brand color fields (if they don't already exist)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS primary_color TEXT,
ADD COLUMN IF NOT EXISTS secondary_color TEXT;

-- Add index for better query performance on age range
CREATE INDEX IF NOT EXISTS idx_profiles_age_range ON profiles(target_audience_age_min, target_audience_age_max);

-- Add index for gender filtering
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(target_audience_gender);

-- Migration note: 
-- - target_audience_age_groups array field is kept for backward compatibility
-- - successful_content_url field is kept for backward compatibility
-- - New fields are optional and can be populated gradually

