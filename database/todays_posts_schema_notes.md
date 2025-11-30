# Today's Posts Message Schema Notes

## Overview
The "today's posts" messages are stored in the `chatbot_conversations` table using the existing schema. No schema changes are required.

## Implementation Details

### Database Table
- **Table**: `chatbot_conversations`
- **Existing Fields Used**:
  - `user_id`: UUID - Links message to user
  - `message_type`: VARCHAR(20) - Set to 'bot'
  - `content`: TEXT - Message content (e.g., "Hi {business_name}, you have a post for today:")
  - `intent`: VARCHAR(100) - Set to 'todays_posts'
  - `metadata`: JSONB - Stores additional data
  - `created_at`: TIMESTAMP WITH TIME ZONE - Used to check if message exists for today

### Metadata Structure
The `metadata` JSONB field contains:
```json
{
  "message_type": "todays_posts",
  "has_posts": true/false,
  "posts_count": number,
  "date": "YYYY-MM-DD"
}
```

### Checking for Existing Messages
To check if a "today's posts" message already exists for a user on a given day:
1. Query `chatbot_conversations` table
2. Filter by:
   - `user_id` = current user
   - `message_type` = 'bot'
   - `created_at` >= today's start (UTC)
   - `created_at` < today's end (UTC)
3. Check if any message has `metadata.message_type === 'todays_posts'`

### Endpoint
- **GET** `/chatbot/today-posts`
- Checks if message exists for today
- Fetches today's scheduled posts from `content_posts` table
- Saves message to `chatbot_conversations` if not already saved
- Returns posts data and `already_generated` flag

### Indexes
The existing index `idx_chatbot_conversations_user_date` on `(user_id, created_at)` is sufficient for efficient queries.







