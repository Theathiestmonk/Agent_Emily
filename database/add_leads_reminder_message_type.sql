-- Migration: Add 'leads_reminder' to chatbot_scheduled_messages message_type check constraint
-- This allows the new 10 AM leads reminder message type

-- Drop the existing check constraint
ALTER TABLE chatbot_scheduled_messages 
DROP CONSTRAINT IF EXISTS chatbot_scheduled_messages_message_type_check;

-- Add the new check constraint with 'leads_reminder' included
ALTER TABLE chatbot_scheduled_messages 
ADD CONSTRAINT chatbot_scheduled_messages_message_type_check 
CHECK (message_type IN ('morning', 'leads_reminder', 'mid_morning', 'afternoon', 'evening', 'night'));

-- Update the comment to reflect the new message type
COMMENT ON COLUMN chatbot_scheduled_messages.message_type IS 'Type of scheduled message: morning, leads_reminder, mid_morning, afternoon, evening, night';

