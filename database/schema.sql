-- Emily Digital Marketing Agent Database Schema
-- Using Supabase Auth for user management

-- Create profiles table to extend Supabase Auth users
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Basic Business Information
    business_name TEXT,
    business_type TEXT[], -- Array of business types
    industry TEXT[], -- Array of industries
    business_description TEXT,
    target_audience TEXT[], -- Array of target audiences
    unique_value_proposition TEXT,
    
    -- Brand & Contact Information
    brand_voice TEXT,
    brand_tone TEXT,
    website_url TEXT,
    phone_number TEXT,
    street_address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    timezone TEXT,
    
    -- Social Media & Goals
    social_media_platforms TEXT[], -- Array of platforms
    primary_goals TEXT[], -- Array of goals
    key_metrics_to_track TEXT[], -- Array of metrics
    
    -- Content Strategy
    monthly_budget_range TEXT,
    posting_frequency TEXT,
    preferred_content_types TEXT[], -- Array of content types
    content_themes TEXT[], -- Array of themes
    
    -- Market & Competition
    main_competitors TEXT,
    market_position TEXT,
    products_or_services TEXT,
    
    -- Campaign Planning
    important_launch_dates TEXT,
    planned_promotions_or_campaigns TEXT,
    top_performing_content_types TEXT[], -- Array of content types
    best_time_to_post TEXT[], -- Array of times
    
    -- Performance & Customer
    successful_campaigns TEXT,
    hashtags_that_work_well TEXT,
    customer_pain_points TEXT,
    typical_customer_journey TEXT,
    
    -- Automation & Platform Details
    automation_level TEXT,
    platform_specific_tone JSONB, -- JSON object for platform-specific tones
    current_presence TEXT[], -- Array of current presence
    focus_areas TEXT[], -- Array of focus areas
    platform_details JSONB, -- JSON object for platform details
    
    -- Platform-specific links and accounts
    facebook_page_name TEXT,
    instagram_profile_link TEXT,
    linkedin_company_link TEXT,
    youtube_channel_link TEXT,
    x_twitter_profile TEXT,
    google_business_profile TEXT,
    google_ads_account TEXT,
    whatsapp_business TEXT,
    email_marketing_platform TEXT,
    meta_ads_facebook BOOLEAN DEFAULT FALSE,
    meta_ads_instagram BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, onboarding_completed)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', FALSE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
