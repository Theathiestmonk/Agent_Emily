# Emily Content Creation Agent

## Overview

The Content Creation Agent is an AI-powered system that automatically generates weekly social media content for users. It uses LangGraph for orchestration and OpenAI for content and image generation.

## Features

- **Platform-by-Platform Generation**: Generates content one platform at a time to avoid overwhelming the LLM
- **AI Image Generation**: Creates custom images using DALL-E 3
- **Weekly Scheduling**: Runs every Sunday to generate content for the upcoming week
- **Database Storage**: Stores all content in Supabase with proper relationships
- **Retry Logic**: Handles failures gracefully with retry mechanisms
- **User Preferences**: Respects user's image and content preferences

## Architecture

### LangGraph Flow

```
Start → Load Profile → Extract Context → Initialize Campaign
  ↓
Check Platforms → Select Platform → Load Context → Generate Content
  ↓
Generate Images → Validate Content → Store Content → Mark Complete
  ↓
Next Platform (if any) → Generate Summary → Send Notification → End
```

### Database Schema

- **content_campaigns**: Weekly content campaigns
- **content_posts**: Individual social media posts
- **content_images**: AI-generated images for posts
- **content_templates**: Platform-specific content templates
- **user_image_preferences**: User's image generation preferences
- **image_generation_requests**: Track image generation requests

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements_content_agent.txt
```

### 2. Environment Variables

Add to your `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. Database Setup

Run the content creation schema:

```sql
-- In Supabase SQL Editor
\i database/content_creation_schema.sql
```

### 4. Test the Agent

```bash
python test_content_agent.py
```

## Usage

### Manual Content Generation

```python
from agents.content_creation_agent import ContentCreationAgent

agent = ContentCreationAgent(supabase_url, supabase_key, openai_api_key)
result = await agent.run_weekly_generation(user_id)
```

### API Endpoints

- `POST /content/generate` - Generate content for current user
- `GET /content/campaigns` - Get user's campaigns
- `GET /content/campaigns/{campaign_id}/posts` - Get campaign posts
- `GET /content/posts/{post_id}` - Get post details
- `PUT /content/posts/{post_id}` - Update post
- `GET /content/templates` - Get content templates
- `GET /content/image-preferences` - Get image preferences
- `PUT /content/image-preferences` - Update image preferences

### Weekly Cron Job

Set up a cron job to run every Sunday:

```bash
# Add to crontab
0 9 * * 0 /path/to/python /path/to/backend/cron_weekly_content.py
```

## Content Generation Process

### 1. Profile Loading
- Loads user profile from Supabase
- Extracts business context and preferences
- Gets social media platforms list

### 2. Campaign Initialization
- Creates a new content campaign
- Sets week start/end dates
- Initializes tracking variables

### 3. Platform Processing
For each platform:
- Loads platform-specific context
- Generates 7 days of content
- Creates AI-generated images
- Validates content against platform requirements
- Stores content in database

### 4. Content Generation
- Uses OpenAI GPT-4 for text generation
- Uses DALL-E 3 for image generation
- Applies platform-specific constraints
- Incorporates user preferences and brand voice

### 5. Storage and Tracking
- Stores each post in `content_posts` table
- Stores images in `content_images` table
- Updates campaign progress
- Tracks completion status

## Platform Support

### Facebook
- Post types: text, image, video, carousel
- Max length: 2000 characters
- Optimal length: 40 characters
- Hashtag limit: 3
- Image sizes: 1200x630, 1080x1080, 1200x675

### Instagram
- Post types: image, video, carousel, story
- Max length: 2200 characters
- Optimal length: 125 characters
- Hashtag limit: 30
- Image sizes: 1080x1080, 1080x1350, 1080x1920

### LinkedIn
- Post types: text, image, video, article
- Max length: 3000 characters
- Optimal length: 150 characters
- Hashtag limit: 5
- Image sizes: 1200x627, 1080x1080

### Twitter
- Post types: text, image, video
- Max length: 280 characters
- Optimal length: 100 characters
- Hashtag limit: 2
- Image sizes: 1200x675, 1080x1080

## Error Handling

- **Retry Logic**: Failed platforms are retried up to 3 times
- **Graceful Degradation**: Continues processing other platforms if one fails
- **Detailed Logging**: Comprehensive logging for debugging
- **Database Transactions**: Ensures data consistency

## Monitoring

- Check logs in `/tmp/emily_content_generation.log`
- Monitor campaign status in Supabase
- Track image generation costs
- Monitor API usage and limits

## Customization

### Content Templates
Add custom templates in the `content_templates` table:

```sql
INSERT INTO content_templates (platform, content_type, template_name, template_prompt, image_prompt_template, image_style) 
VALUES ('instagram', 'image', 'Product Showcase', 'Create a product showcase post for {business_name}...', 'Product photo of {product}...', 'realistic');
```

### Image Preferences
Users can customize image generation:

```python
preferences = {
    "preferred_style": "artistic",
    "brand_colors": ["#FF6B6B", "#4ECDC4"],
    "avoid_content": ["text", "watermarks"],
    "preferred_subjects": ["people", "products"],
    "image_quality": "hd"
}
```

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**: Check API key and rate limits
2. **Supabase Connection**: Verify URL and key
3. **Image Generation Failures**: Check DALL-E 3 availability
4. **Content Validation**: Review platform requirements

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance

- **Concurrent Processing**: Handles multiple users simultaneously
- **Background Tasks**: Non-blocking content generation
- **Efficient Queries**: Optimized database queries
- **Rate Limiting**: Respects API limits

## Security

- **Row Level Security**: Users can only access their own content
- **API Authentication**: All endpoints require authentication
- **Input Validation**: Pydantic models validate all inputs
- **Error Sanitization**: Sensitive data not exposed in errors
