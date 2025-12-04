-- Add embedding columns to profiles table
-- This migration adds support for storing profile embeddings to reduce token costs

-- Add profile_embedding column as vector (pgvector extension, 384 dimensions for all-MiniLM-L6-v2)
-- Note: Requires pgvector extension to be enabled in Supabase
-- If pgvector is not available, use JSONB instead: profile_embedding jsonb NULL
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_embedding vector(384) NULL;

-- Add timestamp to track when embedding was last updated
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp with time zone NULL;

-- Add flag to indicate if embedding needs to be generated/updated
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS embedding_needs_update boolean NULL DEFAULT false;

-- Create index on embedding_needs_update for efficient querying by background worker
CREATE INDEX IF NOT EXISTS idx_profiles_embedding_needs_update 
ON public.profiles(embedding_needs_update) 
WHERE embedding_needs_update = true;

-- Create index on embedding_updated_at for tracking
CREATE INDEX IF NOT EXISTS idx_profiles_embedding_updated_at 
ON public.profiles(embedding_updated_at);

-- Add comment to document the column
COMMENT ON COLUMN public.profiles.profile_embedding IS 'Vector of 384 dimensions representing the profile embedding (pgvector extension)';
COMMENT ON COLUMN public.profiles.embedding_updated_at IS 'Timestamp when the profile embedding was last generated';
COMMENT ON COLUMN public.profiles.embedding_needs_update IS 'Flag indicating if embedding needs to be generated or updated';

