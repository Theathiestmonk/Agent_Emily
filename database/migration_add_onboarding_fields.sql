-- Migration script to add onboarding fields to existing profiles table
-- Run this if you already have a profiles table

-- Add onboarding_completed column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add basic business information columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_type TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_audience TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unique_value_proposition TEXT;

-- Add brand & contact information columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_voice TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_tone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Add social media & goals columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_media_platforms TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_goals TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS key_metrics_to_track TEXT[];

-- Add content strategy columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_budget_range TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posting_frequency TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_content_types TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS content_themes TEXT[];

-- Add market & competition columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS main_competitors TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS market_position TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS products_or_services TEXT;

-- Add campaign planning columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS important_launch_dates TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS planned_promotions_or_campaigns TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS top_performing_content_types TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS best_time_to_post TEXT[];

-- Add performance & customer columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_campaigns TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_content_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hashtags_that_work_well TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS customer_pain_points TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS typical_customer_journey TEXT;

-- Add automation & platform columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS automation_level TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS platform_specific_tone JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_presence TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS focus_areas TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS platform_details JSONB;

-- Add platform-specific links and accounts columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_page_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_profile_link TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_company_link TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS youtube_channel_link TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS x_twitter_profile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_business_profile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_ads_account TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_business TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_marketing_platform TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meta_ads_accounts TEXT;

-- Update the trigger function to handle the new onboarding_completed field
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, onboarding_completed)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', FALSE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();




