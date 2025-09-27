-- Migration script to update blog_posts table to reference platform_connections instead of wordpress_connections
-- This script updates the foreign key relationships and data

-- First, let's check the current state
DO $$
DECLARE
    blog_count INTEGER;
    wordpress_platform_count INTEGER;
BEGIN
    -- Check existing counts
    SELECT COUNT(*) INTO blog_count FROM blog_posts WHERE wordpress_site_id IS NOT NULL;
    SELECT COUNT(*) INTO wordpress_platform_count FROM platform_connections WHERE platform = 'wordpress' AND is_active = true;
    
    RAISE NOTICE 'Found % blog posts with wordpress_site_id', blog_count;
    RAISE NOTICE 'Found % active WordPress platform connections', wordpress_platform_count;
END $$;

-- Update blog_posts to reference platform_connections
-- We need to map the old wordpress_connections IDs to the new platform_connections IDs
UPDATE blog_posts 
SET wordpress_site_id = pc.id
FROM platform_connections pc
WHERE blog_posts.wordpress_site_id IS NOT NULL
AND pc.platform = 'wordpress'
AND pc.wordpress_metadata ? 'original_id'
AND pc.wordpress_metadata->>'original_id' = blog_posts.wordpress_site_id::text;

-- For any remaining blog_posts that couldn't be mapped, try to match by site URL
UPDATE blog_posts 
SET wordpress_site_id = pc.id
FROM platform_connections pc
WHERE blog_posts.wordpress_site_id IS NOT NULL
AND pc.platform = 'wordpress'
AND pc.wordpress_site_url = (
    SELECT wc.site_url 
    FROM wordpress_connections wc 
    WHERE wc.id = blog_posts.wordpress_site_id::uuid
);

-- Update the foreign key constraint to reference platform_connections
-- First, drop the old foreign key constraint if it exists
DO $$
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'blog_posts_wordpress_site_id_fkey'
        AND table_name = 'blog_posts'
    ) THEN
        ALTER TABLE blog_posts DROP CONSTRAINT blog_posts_wordpress_site_id_fkey;
        RAISE NOTICE 'Dropped old foreign key constraint';
    END IF;
END $$;

-- Add new foreign key constraint to platform_connections
ALTER TABLE blog_posts 
ADD CONSTRAINT blog_posts_wordpress_site_id_fkey 
FOREIGN KEY (wordpress_site_id) 
REFERENCES platform_connections(id) 
ON DELETE CASCADE;

-- Note: We cannot use a CHECK constraint with subqueries in PostgreSQL
-- Instead, we'll rely on the foreign key constraint and application-level validation
-- The foreign key constraint already ensures wordpress_site_id references platform_connections(id)

-- Update any blog_posts that couldn't be mapped to have NULL wordpress_site_id
UPDATE blog_posts 
SET wordpress_site_id = NULL
WHERE wordpress_site_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM platform_connections 
    WHERE id = blog_posts.wordpress_site_id 
    AND platform = 'wordpress'
);

-- Show migration results
DO $$
DECLARE
    updated_count INTEGER;
    null_count INTEGER;
    total_blog_posts INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count FROM blog_posts WHERE wordpress_site_id IS NOT NULL;
    SELECT COUNT(*) INTO null_count FROM blog_posts WHERE wordpress_site_id IS NULL;
    SELECT COUNT(*) INTO total_blog_posts FROM blog_posts;
    
    RAISE NOTICE 'Migration completed!';
    RAISE NOTICE 'Total blog posts: %', total_blog_posts;
    RAISE NOTICE 'Blog posts with valid WordPress site ID: %', updated_count;
    RAISE NOTICE 'Blog posts with NULL WordPress site ID: %', null_count;
END $$;

-- Add comment for documentation
COMMENT ON CONSTRAINT blog_posts_wordpress_site_id_fkey ON blog_posts IS 'Foreign key to platform_connections table for WordPress sites';
