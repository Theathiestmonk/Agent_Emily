    -- Migration script to move main site blogs from blog_posts to main_site_blogs table
    -- This script identifies and migrates blogs that belong to the main ATSNAI.com website

    -- First, ensure the main_site_blogs table exists
    -- Run main_site_blogs_schema.sql first if not already done

    -- Step 1: Identify main site blogs
    -- Main site blogs are those that should appear on /add-blog page
    -- For now, we'll identify them as blogs where wordpress_site_id IS NULL
    -- You may need to adjust this criteria based on your specific needs

    DO $$
    DECLARE
        blog_count INTEGER;
        migrated_count INTEGER;
    BEGIN
        -- Count blogs that will be migrated
        SELECT COUNT(*) INTO blog_count 
        FROM blog_posts 
        WHERE wordpress_site_id IS NULL;
        
        RAISE NOTICE 'Found % blog posts with wordpress_site_id IS NULL to migrate', blog_count;
        
        -- Migrate blogs from blog_posts to main_site_blogs
        INSERT INTO main_site_blogs (
            id,
            title,
            content,
            excerpt,
            slug,
            status,
            post_type,
            format,
            categories,
            tags,
            scheduled_at,
            published_at,
            meta_description,
            meta_keywords,
            reading_time,
            word_count,
            seo_score,
            created_at,
            updated_at,
            metadata
        )
        SELECT 
            id,
            title,
            content,
            excerpt,
            slug,
            status,
            post_type,
            format,
            categories,
            tags,
            scheduled_at,
            published_at,
            meta_description,
            meta_keywords,
            reading_time,
            word_count,
            seo_score,
            created_at,
            updated_at,
            -- Include featured_image in metadata if it exists
            CASE 
                WHEN metadata ? 'featured_image' THEN metadata
                ELSE COALESCE(metadata, '{}'::jsonb)
            END as metadata
        FROM blog_posts
        WHERE wordpress_site_id IS NULL
        ON CONFLICT (slug) DO NOTHING; -- Skip if slug already exists
        
        GET DIAGNOSTICS migrated_count = ROW_COUNT;
        
        RAISE NOTICE 'Migrated % blog posts to main_site_blogs table', migrated_count;
        
        -- Show migration results
        SELECT COUNT(*) INTO blog_count FROM main_site_blogs;
        RAISE NOTICE 'Total blogs in main_site_blogs table: %', blog_count;
    END $$;

    -- Optional: After verifying the migration, you can delete migrated blogs from blog_posts
    -- Uncomment the following lines only after verifying the migration was successful:
    -- DELETE FROM blog_posts WHERE wordpress_site_id IS NULL;

    -- Show final counts
    DO $$
    DECLARE
        main_site_count INTEGER;
        user_blog_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO main_site_count FROM main_site_blogs;
        SELECT COUNT(*) INTO user_blog_count FROM blog_posts WHERE wordpress_site_id IS NOT NULL;
        
        RAISE NOTICE 'Migration Summary:';
        RAISE NOTICE '  Main site blogs (main_site_blogs): %', main_site_count;
        RAISE NOTICE '  User blogs (blog_posts): %', user_blog_count;
    END $$;

