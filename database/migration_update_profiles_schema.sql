-- Migration script to update existing profiles table
-- Run this to add new columns to your existing profiles table

-- Add new columns for comprehensive onboarding
ALTER TABLE public.profiles 
-- Target Audience Details (Step 1)
ADD COLUMN IF NOT EXISTS target_audience_age_groups text[] NULL,
ADD COLUMN IF NOT EXISTS target_audience_life_stages text[] NULL,
ADD COLUMN IF NOT EXISTS target_audience_professional_types text[] NULL,
ADD COLUMN IF NOT EXISTS target_audience_lifestyle_interests text[] NULL,
ADD COLUMN IF NOT EXISTS target_audience_buyer_behavior text[] NULL,
ADD COLUMN IF NOT EXISTS target_audience_other text NULL,

-- Platform Tone Settings (Step 9)
ADD COLUMN IF NOT EXISTS platform_tone_instagram text[] NULL,
ADD COLUMN IF NOT EXISTS platform_tone_facebook text[] NULL,
ADD COLUMN IF NOT EXISTS platform_tone_linkedin text[] NULL,
ADD COLUMN IF NOT EXISTS platform_tone_youtube text[] NULL,
ADD COLUMN IF NOT EXISTS platform_tone_x text[] NULL,

-- "Other" Input Fields for all steps
ADD COLUMN IF NOT EXISTS business_type_other text NULL,
ADD COLUMN IF NOT EXISTS industry_other text NULL,
ADD COLUMN IF NOT EXISTS social_platform_other text NULL,
ADD COLUMN IF NOT EXISTS goal_other text NULL,
ADD COLUMN IF NOT EXISTS metric_other text NULL,
ADD COLUMN IF NOT EXISTS content_type_other text NULL,
ADD COLUMN IF NOT EXISTS content_theme_other text NULL,
ADD COLUMN IF NOT EXISTS posting_time_other text NULL,
ADD COLUMN IF NOT EXISTS current_presence_other text NULL,
ADD COLUMN IF NOT EXISTS top_performing_content_type_other text NULL;

-- Update existing columns if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS street_address text NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON profiles(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_business_name ON profiles(business_name);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Add comments for documentation
COMMENT ON COLUMN profiles.target_audience IS 'General target audience selection';
COMMENT ON COLUMN profiles.target_audience_age_groups IS 'Detailed age group targeting';
COMMENT ON COLUMN profiles.target_audience_life_stages IS 'Life stage targeting (student, professional, etc.)';
COMMENT ON COLUMN profiles.target_audience_professional_types IS 'Professional type targeting';
COMMENT ON COLUMN profiles.target_audience_lifestyle_interests IS 'Lifestyle and interest targeting';
COMMENT ON COLUMN profiles.target_audience_buyer_behavior IS 'Buying behavior patterns';
COMMENT ON COLUMN profiles.platform_details IS 'JSON object storing platform-specific details';
COMMENT ON COLUMN profiles.platform_specific_tone IS 'JSON object storing tone preferences per platform';
