-- Blog Writing Schema
-- This schema supports blog post creation and management for WordPress sites

-- Blog Campaigns Table
CREATE TABLE IF NOT EXISTS blog_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_description TEXT,
    target_audience TEXT,
    content_themes TEXT[] DEFAULT '{}',
    posting_frequency VARCHAR(50) DEFAULT 'weekly',
    wordpress_sites UUID[] DEFAULT '{}',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_posts INTEGER DEFAULT 0,
    published_posts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    slug VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    post_type VARCHAR(50) DEFAULT 'post',
    format VARCHAR(50) DEFAULT 'standard',
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wordpress_site_id UUID NOT NULL REFERENCES wordpress_connections(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    wordpress_post_id VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT[] DEFAULT '{}',
    reading_time INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    seo_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Blog Post Performance Table (for analytics)
CREATE TABLE IF NOT EXISTS blog_post_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    wordpress_post_id VARCHAR(255),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_campaigns_user_id ON blog_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_campaigns_status ON blog_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_blog_campaigns_start_date ON blog_campaigns(start_date);

CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_wordpress_site_id ON blog_posts(wordpress_site_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled_at ON blog_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_categories ON blog_posts USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_blog_performance_blog_post_id ON blog_post_performance(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_performance_wordpress_post_id ON blog_post_performance(wordpress_post_id);

-- Enable Row Level Security
ALTER TABLE blog_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for blog_campaigns
CREATE POLICY "Users can view their own blog campaigns" ON blog_campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blog campaigns" ON blog_campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blog campaigns" ON blog_campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blog campaigns" ON blog_campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for blog_posts
CREATE POLICY "Users can view their own blog posts" ON blog_posts
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can insert their own blog posts" ON blog_posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own blog posts" ON blog_posts
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own blog posts" ON blog_posts
    FOR DELETE USING (auth.uid() = author_id);

-- Create RLS policies for blog_post_performance
CREATE POLICY "Users can view performance for their blog posts" ON blog_post_performance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM blog_posts 
            WHERE blog_posts.id = blog_post_performance.blog_post_id 
            AND blog_posts.author_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert performance for their blog posts" ON blog_post_performance
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM blog_posts 
            WHERE blog_posts.id = blog_post_performance.blog_post_id 
            AND blog_posts.author_id = auth.uid()
        )
    );

CREATE POLICY "Users can update performance for their blog posts" ON blog_post_performance
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM blog_posts 
            WHERE blog_posts.id = blog_post_performance.blog_post_id 
            AND blog_posts.author_id = auth.uid()
        )
    );

-- Create functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_blog_campaigns_updated_at
    BEFORE UPDATE ON blog_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_campaigns_updated_at();

CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_posts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE blog_campaigns IS 'Blog campaigns for organizing and managing blog post creation';
COMMENT ON TABLE blog_posts IS 'Individual blog posts with WordPress-specific formatting and metadata';
COMMENT ON TABLE blog_post_performance IS 'Performance analytics for blog posts';

COMMENT ON COLUMN blog_campaigns.content_themes IS 'Array of content themes for the campaign';
COMMENT ON COLUMN blog_campaigns.wordpress_sites IS 'Array of WordPress site IDs for this campaign';
COMMENT ON COLUMN blog_campaigns.posting_frequency IS 'How often to post: daily, weekly, bi-weekly, monthly';

COMMENT ON COLUMN blog_posts.slug IS 'URL-friendly version of the title';
COMMENT ON COLUMN blog_posts.format IS 'WordPress post format: standard, aside, chat, gallery, link, image, quote, status, video, audio';
COMMENT ON COLUMN blog_posts.categories IS 'Array of blog post categories';
COMMENT ON COLUMN blog_posts.tags IS 'Array of blog post tags';
COMMENT ON COLUMN blog_posts.wordpress_site_id IS 'Reference to the WordPress site this post belongs to';
COMMENT ON COLUMN blog_posts.wordpress_post_id IS 'ID of the post in WordPress after publishing';
COMMENT ON COLUMN blog_posts.reading_time IS 'Estimated reading time in minutes';
COMMENT ON COLUMN blog_posts.word_count IS 'Number of words in the content';
COMMENT ON COLUMN blog_posts.seo_score IS 'SEO optimization score (0-100)';

COMMENT ON COLUMN blog_post_performance.engagement_rate IS 'Calculated engagement rate as percentage';
COMMENT ON COLUMN blog_post_performance.last_updated IS 'When performance data was last updated';
