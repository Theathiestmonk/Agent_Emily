-- Lead Management Schema
-- Add follow_up_at column to leads table for scheduling follow-ups

-- Add follow_up_at column if it doesn't exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of leads with follow-ups
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_at ON leads(follow_up_at) 
WHERE follow_up_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.follow_up_at IS 'Scheduled date and time for following up with the lead';


