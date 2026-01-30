-- Add metadata column to platform_connections table for Gmail sync settings
-- This table already has access_token_encrypted, refresh_token_encrypted, google_email, etc.
-- The metadata column will store Gmail sync preferences and status

-- Add the metadata column
ALTER TABLE public.platform_connections
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_platform_connections_metadata
ON public.platform_connections USING GIN (metadata);

-- Verify the column was added
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'platform_connections'
AND table_schema = 'public'
AND column_name = 'metadata';

-- Add unique constraint to prevent duplicate email entries in lead_conversations
-- This ensures one Gmail message can only be stored once per lead
ALTER TABLE public.lead_conversations
ADD CONSTRAINT IF NOT EXISTS lead_conversations_unique_email
UNIQUE (lead_id, message_id);

-- Create additional index for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_lead_conversations_lead_message
ON public.lead_conversations (lead_id, message_id);

-- Verify the constraint was added
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'lead_conversations'
AND tc.constraint_name = 'lead_conversations_unique_email';

-- Test: Check if any existing connections have metadata
SELECT
    id,
    platform,
    google_email,
    metadata
FROM platform_connections
WHERE platform = 'google' AND is_active = true
LIMIT 5;
