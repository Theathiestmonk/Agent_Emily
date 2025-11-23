-- Chatbot Scheduled Messages Schema
-- This table stores scheduled daily messages that are sent to users at specific times

-- Create chatbot_scheduled_messages table
CREATE TABLE IF NOT EXISTS chatbot_scheduled_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('morning', 'mid_morning', 'afternoon', 'evening', 'night')),
    content TEXT NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_delivered BOOLEAN DEFAULT FALSE,
    
    -- Indexes for faster queries
    CONSTRAINT idx_chatbot_scheduled_messages_user_time UNIQUE(user_id, scheduled_time, message_type)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_chatbot_scheduled_messages_user_delivered 
ON chatbot_scheduled_messages(user_id, is_delivered);

CREATE INDEX IF NOT EXISTS idx_chatbot_scheduled_messages_scheduled_time 
ON chatbot_scheduled_messages(scheduled_time);

CREATE INDEX IF NOT EXISTS idx_chatbot_scheduled_messages_user_type 
ON chatbot_scheduled_messages(user_id, message_type);

-- Create chatbot_conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_type VARCHAR(20) NOT NULL, -- 'user' or 'bot'
    content TEXT NOT NULL,
    intent VARCHAR(100), -- classified intent if bot message
    metadata JSONB DEFAULT '{}'::jsonb, -- additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for chatbot_conversations if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user_date 
ON chatbot_conversations(user_id, created_at);

-- Update chatbot_conversations table to link delivered scheduled messages
-- Add scheduled_message_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chatbot_conversations' 
        AND column_name = 'scheduled_message_id'
    ) THEN
        ALTER TABLE chatbot_conversations 
        ADD COLUMN scheduled_message_id UUID REFERENCES chatbot_scheduled_messages(id) ON DELETE SET NULL;
        
        -- Create index for the foreign key
        CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_scheduled_message 
        ON chatbot_conversations(scheduled_message_id);
    END IF;
END $$;

-- Add comment to table
COMMENT ON TABLE chatbot_scheduled_messages IS 'Stores scheduled daily WhatsApp-style messages sent to users at specific times (9 AM, 11:30 AM, 2 PM, 6 PM, 9:30 PM)';
COMMENT ON COLUMN chatbot_scheduled_messages.message_type IS 'Type of scheduled message: morning, mid_morning, afternoon, evening, night';
COMMENT ON COLUMN chatbot_scheduled_messages.scheduled_time IS 'When the message should be sent (stored in UTC, converted from user timezone)';
COMMENT ON COLUMN chatbot_scheduled_messages.delivered_at IS 'When the message was actually delivered to the user in the chat';
COMMENT ON COLUMN chatbot_scheduled_messages.metadata IS 'Stores data used to generate the message (trends, analytics, etc.)';
COMMENT ON COLUMN chatbot_scheduled_messages.is_delivered IS 'Whether the message has been delivered to the user in the chat interface';

