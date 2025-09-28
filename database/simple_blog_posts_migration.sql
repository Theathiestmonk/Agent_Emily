-- Simple migration script to fix blog_posts foreign key relationships
-- This script removes the old foreign key and adds a new one to platform_connections

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

-- Drop the old foreign key constraint if it exists
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
    ELSE
        RAISE NOTICE 'Old foreign key constraint not found';
    END IF;
END $$;

-- Set all wordpress_site_id to NULL for now (we'll fix this later)
UPDATE blog_posts SET wordpress_site_id = NULL WHERE wordpress_site_id IS NOT NULL;

-- Add new foreign key constraint to platform_connections
ALTER TABLE blog_posts 
ADD CONSTRAINT blog_posts_wordpress_site_id_fkey 
FOREIGN KEY (wordpress_site_id) 
REFERENCES platform_connections(id) 
ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON CONSTRAINT blog_posts_wordpress_site_id_fkey ON blog_posts IS 'Foreign key to platform_connections table for WordPress sites';

-- Show migration results
DO $$
DECLARE
    total_blog_posts INTEGER;
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_blog_posts FROM blog_posts;
    SELECT COUNT(*) INTO null_count FROM blog_posts WHERE wordpress_site_id IS NULL;
    
    RAISE NOTICE 'Simple migration completed!';
    RAISE NOTICE 'Total blog posts: %', total_blog_posts;
    RAISE NOTICE 'Blog posts with NULL wordpress_site_id: %', null_count;
    RAISE NOTICE 'Note: wordpress_site_id will be populated when new blogs are created';
END $$;
