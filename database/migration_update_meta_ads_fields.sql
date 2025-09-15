-- Migration to update Meta Ads fields from text to boolean checkboxes
-- Remove meta_ads_accounts text field and add boolean fields for Facebook and Instagram Ads

-- Add new boolean columns for Meta Ads sub-options
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS meta_ads_facebook BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS meta_ads_instagram BOOLEAN DEFAULT FALSE;

-- Remove the old text field (commented out for safety - uncomment when ready to apply)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS meta_ads_accounts;

-- Note: The meta_ads_accounts column is kept for now to avoid data loss
-- You can drop it manually after confirming the new structure works correctly
