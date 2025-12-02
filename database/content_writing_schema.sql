-- Content Writing Table for storing video scripts and other content
-- Run this after the main schema.sql

-- Content Writing Table
CREATE TABLE IF NOT EXISTS content_writing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- instagram, facebook, etc.
    content_type TEXT NOT NULL, -- reel, feed_post, story, etc.
    video_script JSONB, -- Video script data (title, hook, scenes, CTA, hashtags, etc.)
    user_description TEXT, -- User's original content idea
    clarification_1 TEXT, -- Post goal/purpose
    clarification_2 TEXT, -- Target audience details
    clarification_3 TEXT, -- Tone/style
    business_context JSONB, -- Business context used for generation
    status TEXT DEFAULT 'draft', -- draft, approved, used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE content_writing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_writing
CREATE POLICY "Users can view own content writing" ON content_writing
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content writing" ON content_writing
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content writing" ON content_writing
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own content writing" ON content_writing
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_writing_user_id ON content_writing(user_id);
CREATE INDEX IF NOT EXISTS idx_content_writing_platform ON content_writing(platform);
CREATE INDEX IF NOT EXISTS idx_content_writing_content_type ON content_writing(content_type);
CREATE INDEX IF NOT EXISTS idx_content_writing_created_at ON content_writing(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_writing_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_content_writing_updated_at 
    BEFORE UPDATE ON content_writing 
    FOR EACH ROW 
    EXECUTE FUNCTION update_content_writing_updated_at_column();


