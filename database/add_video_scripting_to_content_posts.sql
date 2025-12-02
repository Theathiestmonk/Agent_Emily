-- Add video_scripting column to content_posts table
-- Run this migration to add video script support to content posts

-- Add video_scripting column to content_posts table
ALTER TABLE content_posts 
ADD COLUMN IF NOT EXISTS video_scripting JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_content_posts_video_scripting 
ON content_posts(video_scripting) 
WHERE video_scripting IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN content_posts.video_scripting IS 'Video script data for Reel content (title, hook, scenes, CTA, hashtags, etc.)';


