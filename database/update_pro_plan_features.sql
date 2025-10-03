-- Update Pro plan features to reflect managed agents service
-- This script updates the Pro plan features in the database

-- Update the Pro plan features
UPDATE subscription_plans 
SET features = '["Managed Agents", "Advanced Analytics", "Priority Support", "Custom Integrations"]'
WHERE name = 'pro';

-- Verify the update
SELECT 
    name,
    display_name,
    features
FROM subscription_plans 
WHERE name = 'pro';
