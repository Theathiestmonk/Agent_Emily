-- Updated profiles table schema to match onboarding form fields
-- This schema includes all fields from the comprehensive onboarding process

CREATE TABLE public.profiles (
  -- Basic user info
  id uuid NOT NULL,
  name text NULL,
  avatar_url text NULL,
  onboarding_completed boolean NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  
  -- Step 1: Business Description
  business_name text NULL,
  business_type text[] NULL,
  industry text[] NULL,
  business_description text NULL,
  logo_url text NULL,
  unique_value_proposition text NULL,
  
  -- Target Audience (Step 1 - detailed breakdown)
  target_audience text[] NULL, -- General target audience
  target_audience_age_groups text[] NULL,
  target_audience_life_stages text[] NULL,
  target_audience_professional_types text[] NULL,
  target_audience_lifestyle_interests text[] NULL,
  target_audience_buyer_behavior text[] NULL,
  target_audience_other text NULL,
  
  -- Step 2: Brand & Contact Information
  brand_voice text NULL,
  brand_tone text NULL,
  website_url text NULL,
  phone_number text NULL,
  street_address text NULL,
  city text NULL,
  state text NULL,
  country text NULL,
  timezone text NULL,
  
  -- Step 3: Current Presence & Focus Areas
  current_presence text[] NULL,
  focus_areas text[] NULL,
  
  -- Platform-specific details (Step 3)
  platform_details jsonb NULL,
  facebook_page_name text NULL,
  instagram_profile_link text NULL,
  linkedin_company_link text NULL,
  youtube_channel_link text NULL,
  x_twitter_profile text NULL,
  google_business_profile text NULL,
  google_ads_account text NULL,
  whatsapp_business text NULL,
  email_marketing_platform text NULL,
  meta_ads_accounts text NULL,
  
  -- Step 4: Goals & Metrics
  primary_goals text[] NULL,
  key_metrics_to_track text[] NULL,
  
  -- Step 5: Budget & Content Strategy
  monthly_budget_range text NULL,
  posting_frequency text NULL,
  preferred_content_types text[] NULL,
  content_themes text[] NULL,
  
  -- Step 6: Market Analysis
  main_competitors text NULL,
  market_position text NULL,
  products_or_services text NULL,
  
  -- Step 7: Campaign Planning
  important_launch_dates text NULL,
  planned_promotions_or_campaigns text NULL,
  top_performing_content_types text[] NULL,
  best_time_to_post text[] NULL,
  
  -- Step 8: Performance & Customer
  successful_campaigns text NULL,
  successful_content_url text NULL,
  hashtags_that_work_well text NULL,
  customer_pain_points text NULL,
  typical_customer_journey text NULL,
  
  -- Step 9: Automation & Platform
  automation_level text NULL,
  social_media_platforms text[] NULL,
  
  -- Platform-specific tone settings (Step 9)
  platform_specific_tone jsonb NULL,
  platform_tone_instagram text[] NULL,
  platform_tone_facebook text[] NULL,
  platform_tone_linkedin text[] NULL,
  platform_tone_youtube text[] NULL,
  platform_tone_x text[] NULL,
  
  -- Additional fields for "Other" inputs
  business_type_other text NULL,
  industry_other text NULL,
  social_platform_other text NULL,
  goal_other text NULL,
  metric_other text NULL,
  content_type_other text NULL,
  content_theme_other text NULL,
  posting_time_other text NULL,
  current_presence_other text NULL,
  top_performing_content_type_other text NULL,
  
  -- Constraints
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create trigger for updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_profiles_onboarding_completed ON profiles(onboarding_completed);
CREATE INDEX idx_profiles_business_name ON profiles(business_name);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles with comprehensive onboarding data';
COMMENT ON COLUMN profiles.target_audience IS 'General target audience selection';
COMMENT ON COLUMN profiles.target_audience_age_groups IS 'Detailed age group targeting';
COMMENT ON COLUMN profiles.target_audience_life_stages IS 'Life stage targeting (student, professional, etc.)';
COMMENT ON COLUMN profiles.target_audience_professional_types IS 'Professional type targeting';
COMMENT ON COLUMN profiles.target_audience_lifestyle_interests IS 'Lifestyle and interest targeting';
COMMENT ON COLUMN profiles.target_audience_buyer_behavior IS 'Buying behavior patterns';
COMMENT ON COLUMN profiles.platform_details IS 'JSON object storing platform-specific details';
COMMENT ON COLUMN profiles.platform_specific_tone IS 'JSON object storing tone preferences per platform';




