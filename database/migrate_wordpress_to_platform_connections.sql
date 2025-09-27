-- Migration script to move WordPress connections from wordpress_connections to platform_connections
-- This script migrates existing WordPress connections to the unified platform_connections table

-- First, let's check if we have any existing WordPress connections to migrate
DO $$
DECLARE
    wordpress_count INTEGER;
    platform_count INTEGER;
BEGIN
    -- Check existing counts
    SELECT COUNT(*) INTO wordpress_count FROM wordpress_connections WHERE is_active = true;
    SELECT COUNT(*) INTO platform_count FROM platform_connections WHERE platform = 'wordpress' AND is_active = true;
    
    RAISE NOTICE 'Found % WordPress connections to migrate', wordpress_count;
    RAISE NOTICE 'Found % existing WordPress platform connections', platform_count;
END $$;

-- Migrate WordPress connections to platform_connections table
INSERT INTO platform_connections (
    user_id,
    platform,
    page_id,
    page_name,
    page_username,
    is_active,
    last_sync,
    connection_status,
    connected_at,
    created_at,
    updated_at,
    wordpress_site_url,
    wordpress_username,
    wordpress_app_password_encrypted,
    wordpress_site_name,
    wordpress_user_id,
    wordpress_user_email,
    wordpress_user_display_name,
    wordpress_capabilities,
    wordpress_version,
    wordpress_last_checked_at,
    wordpress_metadata
)
SELECT 
    wc.user_id,
    'wordpress' as platform,
    wc.id as page_id,  -- Use the wordpress_connection ID as page_id
    wc.site_name as page_name,
    wc.username as page_username,
    wc.is_active,
    wc.last_checked_at as last_sync,
    CASE 
        WHEN wc.is_active THEN 'active'
        ELSE 'inactive'
    END as connection_status,
    wc.created_at as connected_at,
    wc.created_at,
    wc.updated_at,
    wc.site_url as wordpress_site_url,
    wc.username as wordpress_username,
    wc.password as wordpress_app_password_encrypted,  -- Note: this is already encrypted
    wc.site_name as wordpress_site_name,
    NULL as wordpress_user_id,  -- Will be populated when we test the connection
    NULL as wordpress_user_email,
    NULL as wordpress_user_display_name,
    wc.metadata as wordpress_capabilities,
    NULL as wordpress_version,
    wc.last_checked_at as wordpress_last_checked_at,
    wc.metadata as wordpress_metadata
FROM wordpress_connections wc
WHERE NOT EXISTS (
    -- Only migrate if not already exists in platform_connections
    SELECT 1 FROM platform_connections pc 
    WHERE pc.user_id = wc.user_id 
    AND pc.platform = 'wordpress' 
    AND pc.wordpress_site_url = wc.site_url
);

-- Update the migrated records with proper WordPress metadata
UPDATE platform_connections 
SET 
    wordpress_metadata = COALESCE(wordpress_metadata, '{}'::jsonb) || jsonb_build_object(
        'migrated_from', 'wordpress_connections',
        'migrated_at', NOW(),
        'original_id', page_id
    )
WHERE platform = 'wordpress' 
AND wordpress_metadata ? 'migrated_from' = false;

-- Create a view for backward compatibility (optional)
CREATE OR REPLACE VIEW wordpress_connections_view AS
SELECT 
    pc.id,
    pc.user_id,
    pc.page_name as site_name,
    pc.wordpress_site_url as site_url,
    pc.wordpress_username as username,
    pc.wordpress_app_password_encrypted as password,
    pc.is_active,
    pc.wordpress_last_checked_at as last_checked_at,
    pc.created_at,
    pc.updated_at,
    pc.wordpress_metadata as metadata
FROM platform_connections pc
WHERE pc.platform = 'wordpress';

-- Add comments for documentation
COMMENT ON VIEW wordpress_connections_view IS 'Backward compatibility view for WordPress connections migrated to platform_connections';

-- Show migration results
DO $$
DECLARE
    migrated_count INTEGER;
    total_platform_wordpress INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count FROM platform_connections WHERE platform = 'wordpress';
    SELECT COUNT(*) INTO total_platform_wordpress FROM platform_connections WHERE platform = 'wordpress' AND wordpress_metadata ? 'migrated_from';
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Total WordPress connections in platform_connections: %', migrated_count;
    RAISE NOTICE 'Migrated from wordpress_connections table: %', total_platform_wordpress;
END $$;
