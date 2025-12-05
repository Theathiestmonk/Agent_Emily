-- Migration script to add onboarding_type and creator-specific fields to profiles table
-- Run this to add support for creator onboarding form

-- Add onboarding_type field
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_type TEXT NULL;

-- Add creator-specific fields
ALTER TABLE public.profiles 
-- Step 1: Creator Basics
ADD COLUMN IF NOT EXISTS creator_name TEXT NULL,
ADD COLUMN IF NOT EXISTS creator_type TEXT NULL,
ADD COLUMN IF NOT EXISTS primary_niche TEXT NULL,

-- Step 2: Brand & Contact (some fields already exist, adding creator-specific ones)
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT NULL,
ADD COLUMN IF NOT EXISTS brand_colors TEXT[] NULL,
ADD COLUMN IF NOT EXISTS location_city TEXT NULL,
ADD COLUMN IF NOT EXISTS location_state TEXT NULL,
ADD COLUMN IF NOT EXISTS location_country TEXT NULL,

-- Step 3: Audience & Brand Story (some fields already exist)
ADD COLUMN IF NOT EXISTS creator_bio TEXT NULL,
ADD COLUMN IF NOT EXISTS audience_lifestyle_interests TEXT[] NULL,
ADD COLUMN IF NOT EXISTS audience_behavior TEXT[] NULL,

-- Step 4: Platforms & Current Presence (some fields already exist)
ADD COLUMN IF NOT EXISTS active_platforms TEXT[] NULL,
ADD COLUMN IF NOT EXISTS current_online_presence_status TEXT NULL,

-- Step 5: Content Strategy & Goals (most fields already exist)

-- Step 6: Performance Insights & Competition
ADD COLUMN IF NOT EXISTS best_performing_content_urls TEXT[] NULL,
ADD COLUMN IF NOT EXISTS competitors TEXT NULL,
ADD COLUMN IF NOT EXISTS biggest_challenges TEXT[] NULL,

-- Step 7: Monetization, Workflow & Automation
ADD COLUMN IF NOT EXISTS monetization_sources TEXT[] NULL;

-- Add index for onboarding_type for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_type ON profiles(onboarding_type);

-- Add comment to onboarding_type column
COMMENT ON COLUMN public.profiles.onboarding_type IS 'Type of onboarding: business or creator';
