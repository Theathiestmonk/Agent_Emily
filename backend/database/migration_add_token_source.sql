-- Add token_source column to platform_connections table
-- This column will track whether the token was obtained via OAuth or manually entered

ALTER TABLE platform_connections 
ADD COLUMN token_source VARCHAR(20) DEFAULT 'oauth';

-- Update existing records to have 'oauth' as the default token source
UPDATE platform_connections 
SET token_source = 'oauth' 
WHERE token_source IS NULL;

-- Add comment to the column
COMMENT ON COLUMN platform_connections.token_source IS 'Source of the access token: oauth or manual';
