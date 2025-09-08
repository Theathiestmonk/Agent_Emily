-- OAuth States Table for secure state management
-- This table stores temporary OAuth states to prevent CSRF attacks

CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    state TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_platform ON oauth_states(user_id, platform);

-- Enable RLS (Row Level Security)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own states
CREATE POLICY "Users can access their own oauth states" ON oauth_states
    FOR ALL USING (auth.uid() = user_id);

-- Create policy for service role to access all states (for cleanup)
CREATE POLICY "Service role can access all oauth states" ON oauth_states
    FOR ALL USING (auth.role() = 'service_role');
