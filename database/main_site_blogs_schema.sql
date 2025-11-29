-- Main Site Blogs Schema
-- This schema stores blog posts for the main ATSNAI.com website
-- Separate from Emily user blogs which are stored in blog_posts table

-- Main Site Blogs Table
CREATE TABLE IF NOT EXISTS main_site_blogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    slug VARCHAR(500) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, scheduled
    post_type VARCHAR(50) DEFAULT 'post', -- post, page
    format VARCHAR(50) DEFAULT 'standard', -- standard, aside, chat, gallery, link, image, quote, status, video, audio
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    featured_image TEXT, -- URL to featured image
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    meta_description TEXT,
    meta_keywords TEXT[] DEFAULT '{}',
    reading_time INTEGER DEFAULT 0, -- in minutes
    word_count INTEGER DEFAULT 0,
    seo_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_status ON main_site_blogs(status);
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_slug ON main_site_blogs(slug);
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_scheduled_at ON main_site_blogs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_published_at ON main_site_blogs(published_at);
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_created_at ON main_site_blogs(created_at);
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_categories ON main_site_blogs USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_main_site_blogs_tags ON main_site_blogs USING GIN(tags);

-- Add comments for documentation
COMMENT ON TABLE main_site_blogs IS 'Blog posts for the main ATSNAI.com website. Separate from Emily user blogs.';
COMMENT ON COLUMN main_site_blogs.status IS 'Blog post status: draft, published, scheduled';
COMMENT ON COLUMN main_site_blogs.post_type IS 'Type of post: post, page';
COMMENT ON COLUMN main_site_blogs.format IS 'Post format: standard, aside, chat, gallery, link, image, quote, status, video, audio';
COMMENT ON COLUMN main_site_blogs.categories IS 'Array of blog post categories';
COMMENT ON COLUMN main_site_blogs.tags IS 'Array of blog post tags';
COMMENT ON COLUMN main_site_blogs.reading_time IS 'Estimated reading time in minutes';
COMMENT ON COLUMN main_site_blogs.word_count IS 'Number of words in the content';
COMMENT ON COLUMN main_site_blogs.seo_score IS 'SEO optimization score (0-100)';

