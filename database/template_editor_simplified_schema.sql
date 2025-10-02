-- Simplified Template Editor Database Schema
-- This schema only includes workflow management, templates are stored as static files

-- Template editing workflows table
CREATE TABLE IF NOT EXISTS template_workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    template_id VARCHAR(100) NOT NULL, -- References static template ID
    current_node VARCHAR(100) NOT NULL,
    workflow_state JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- active, completed, failed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template editing sessions table
CREATE TABLE IF NOT EXISTS template_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id VARCHAR(255) REFERENCES template_workflows(workflow_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template analytics table (for usage tracking)
CREATE TABLE IF NOT EXISTS template_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id VARCHAR(100) NOT NULL, -- References static template ID
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- view, use, download, share
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template favorites table
CREATE TABLE IF NOT EXISTS template_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id VARCHAR(100) NOT NULL, -- References static template ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, template_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_template_workflows_user_id ON template_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_template_workflows_status ON template_workflows(status);
CREATE INDEX IF NOT EXISTS idx_template_workflows_template_id ON template_workflows(template_id);
CREATE INDEX IF NOT EXISTS idx_template_analytics_template_id ON template_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_template_analytics_user_id ON template_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_id ON template_favorites(user_id);

-- RLS (Row Level Security) policies
ALTER TABLE template_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;

-- Template workflows policies
CREATE POLICY "Users can view their own workflows" ON template_workflows
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflows" ON template_workflows
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows" ON template_workflows
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows" ON template_workflows
    FOR DELETE USING (auth.uid() = user_id);

-- Template sessions policies
CREATE POLICY "Users can view their own sessions" ON template_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON template_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON template_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Template analytics policies
CREATE POLICY "Users can view their own analytics" ON template_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" ON template_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Template favorites policies
CREATE POLICY "Users can view their own favorites" ON template_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON template_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON template_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Functions for template editor
CREATE OR REPLACE FUNCTION get_user_template_workflows(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    workflow_id VARCHAR(255),
    content_id UUID,
    template_id VARCHAR(100),
    current_node VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tw.id,
        tw.workflow_id,
        tw.content_id,
        tw.template_id,
        tw.current_node,
        tw.status,
        tw.created_at,
        tw.updated_at
    FROM template_workflows tw
    WHERE tw.user_id = user_uuid
    ORDER BY tw.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_template_analytics(template_id_param VARCHAR(100), days INTEGER DEFAULT 30)
RETURNS TABLE (
    action VARCHAR(50),
    count BIGINT,
    last_action TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.action,
        COUNT(*) as count,
        MAX(ta.created_at) as last_action
    FROM template_analytics ta
    WHERE ta.template_id = template_id_param
    AND ta.created_at >= NOW() - INTERVAL '1 day' * days
    GROUP BY ta.action
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_template_workflows_updated_at
    BEFORE UPDATE ON template_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
