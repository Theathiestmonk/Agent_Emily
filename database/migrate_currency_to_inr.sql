-- Migration script to update currency from USD to INR
-- Run this script if your database was created with USD as the default currency

-- 1. Update existing subscription_transactions records from USD to INR
UPDATE subscription_transactions 
SET currency = 'INR' 
WHERE currency = 'USD' OR currency IS NULL;

-- 2. Update the default value for the currency column
ALTER TABLE subscription_transactions 
ALTER COLUMN currency SET DEFAULT 'INR';

-- 3. Keep subscription plans prices as they are
-- Note: Prices remain unchanged, only currency display changes from USD to INR

-- 4. Verify the changes
SELECT 
    'subscription_transactions' as table_name,
    currency,
    COUNT(*) as count
FROM subscription_transactions 
GROUP BY currency
UNION ALL
SELECT 
    'subscription_plans' as table_name,
    'N/A' as currency,
    COUNT(*) as count
FROM subscription_plans;

-- 5. Show current plan prices (unchanged)
SELECT 
    name,
    display_name,
    price_monthly,
    price_yearly,
    ROUND(price_monthly/100.0, 2) as monthly_price_display,
    ROUND(price_yearly/100.0, 2) as yearly_price_display
FROM subscription_plans;
