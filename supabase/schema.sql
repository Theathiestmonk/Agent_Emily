-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for content images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('content-images', 'content-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for content images bucket
CREATE POLICY "Content images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'content-images');

CREATE POLICY "Authenticated users can upload content images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'content-images' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update their own content images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'content-images' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete their own content images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'content-images' 
        AND auth.role() = 'authenticated'
    );

