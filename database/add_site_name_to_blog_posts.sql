-- Add site_name column to blog_posts table for frontend display
-- This column will store the WordPress site name for easy display

-- Add site_name column to blog_posts table
ALTER TABLE blog_posts 
ADD COLUMN IF NOT EXISTS site_name text NULL;

-- Add comment for documentation
COMMENT ON COLUMN blog_posts.site_name IS 'WordPress site name for frontend display';

-- Add index for better performance when querying by site name
CREATE INDEX IF NOT EXISTS idx_blog_posts_site_name ON blog_posts(site_name) WHERE site_name IS NOT NULL;

-- Update existing blog_posts with site names from platform_connections
UPDATE blog_posts 
SET site_name = pc.wordpress_site_name
FROM platform_connections pc
WHERE blog_posts.wordpress_site_id = pc.id
AND pc.platform = 'wordpress'
AND blog_posts.site_name IS NULL;

-- Show migration results
DO $$
DECLARE
    updated_count INTEGER;
    total_blog_posts INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count FROM blog_posts WHERE site_name IS NOT NULL;
    SELECT COUNT(*) INTO total_blog_posts FROM blog_posts;
    
    RAISE NOTICE 'Site name migration completed!';
    RAISE NOTICE 'Total blog posts: %', total_blog_posts;
    RAISE NOTICE 'Blog posts with site name: %', updated_count;
END $$;
