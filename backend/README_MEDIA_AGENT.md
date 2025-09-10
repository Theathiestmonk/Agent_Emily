# Media Generation Agent

## Overview
The Media Generation Agent automatically generates AI-powered images for content posts stored in Supabase. It uses DALL-E 3 to create high-quality, platform-optimized images based on post content and user preferences.

## Features

### 🤖 AI Image Generation
- **DALL-E 3 Integration**: Uses OpenAI's DALL-E 3 for high-quality image generation
- **Smart Content Analysis**: Automatically determines if a post needs an image
- **Platform Optimization**: Generates images optimized for different social media platforms
- **Style Detection**: Automatically selects appropriate image styles based on content

### 🎨 Image Styles
- **Realistic**: Photorealistic images for professional content
- **Artistic**: Creative and artistic interpretations
- **Cartoon**: Fun, playful cartoon-style images
- **Minimalist**: Clean, simple designs
- **Photographic**: High-quality photo-style images
- **Illustration**: Detailed illustrations
- **Digital Art**: Modern digital artwork
- **Watercolor**: Artistic watercolor paintings
- **Oil Painting**: Classic oil painting style

### 📱 Platform Support
- **Instagram**: Square format (1024x1024)
- **Facebook**: Square format (1024x1024)
- **LinkedIn**: Square format (1024x1024)
- **Twitter**: Square format (1024x1024)
- **YouTube**: Landscape format (1792x1024)

## API Endpoints

### Generate Image for Post
```http
POST /media/generate
Content-Type: application/json

{
  "post_id": "uuid",
  "style": "realistic",  // optional
  "size": "1024x1024"    // optional
}
```

### Batch Image Generation
```http
POST /media/generate/batch
Content-Type: application/json

{
  "post_ids": ["uuid1", "uuid2", "uuid3"],
  "style": "artistic",   // optional
  "size": "1024x1024"    // optional
}
```

### Get Post Images
```http
GET /media/posts/{post_id}/images
```

### Get User Images
```http
GET /media/user/images?limit=50&offset=0
```

### Approve Image
```http
PUT /media/images/{image_id}/approve
```

### Delete Image
```http
DELETE /media/images/{image_id}
```

### Get Available Styles
```http
GET /media/styles
```

### Get Media Statistics
```http
GET /media/stats
```

## Database Schema

### content_images Table
```sql
CREATE TABLE content_images (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES content_posts(id),
    image_url TEXT NOT NULL,
    image_prompt TEXT NOT NULL,
    image_style TEXT,
    image_size TEXT DEFAULT '1024x1024',
    image_quality TEXT DEFAULT 'standard',
    generation_model TEXT DEFAULT 'dall-e-3',
    generation_cost DECIMAL(10,4),
    generation_time INTEGER,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### user_image_preferences Table
```sql
CREATE TABLE user_image_preferences (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    preferred_style TEXT DEFAULT 'realistic',
    brand_colors TEXT[],
    avoid_content TEXT[],
    preferred_subjects TEXT[],
    image_quality TEXT DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Usage Examples

### Python
```python
from agents.media_agent import create_media_agent

# Create media agent
media_agent = create_media_agent(
    supabase_url="your-supabase-url",
    supabase_key="your-supabase-key",
    openai_api_key="your-openai-key"
)

# Generate image for a post
result = await media_agent.generate_media_for_post("post-uuid")

if result["success"]:
    print(f"Image generated: {result['image_url']}")
    print(f"Cost: ${result['cost']}")
else:
    print(f"Error: {result['error']}")
```

### JavaScript/Frontend
```javascript
// Generate image for a post
const response = await fetch('/api/media/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    post_id: 'post-uuid',
    style: 'realistic',
    size: '1024x1024'
  })
});

const result = await response.json();
console.log('Generated image:', result.image_url);
```

## Configuration

### Environment Variables
```bash
OPENAI_API_KEY=your-openai-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### DALL-E 3 Pricing (as of 2024)
- **1024x1024**: $0.040 per image
- **1024x1792**: $0.080 per image
- **1792x1024**: $0.080 per image
- **HD Quality**: 2x the standard price

## Smart Features

### Content Analysis
The agent automatically analyzes post content to determine:
- Whether an image is needed
- Appropriate image style
- Platform-specific optimizations
- Brand consistency

### User Preferences
- **Preferred Styles**: Set default image styles
- **Brand Colors**: Incorporate brand colors into images
- **Avoid Content**: Specify content to avoid
- **Preferred Subjects**: Focus on specific subjects

### Cost Management
- Tracks generation costs per user
- Provides cost estimates before generation
- Supports budget limits and warnings

## Error Handling

The agent includes comprehensive error handling for:
- Invalid post IDs
- Missing user permissions
- API rate limits
- Network failures
- Invalid image prompts
- Generation failures

## Monitoring

### Logging
- Detailed logs for all operations
- Error tracking and debugging
- Performance metrics
- Cost tracking

### Statistics
- Total images generated
- Success/failure rates
- Average generation time
- Total costs per user

## Future Enhancements

### Planned Features
- **Multiple AI Models**: Support for Midjourney, Stable Diffusion
- **Video Generation**: AI-generated video content
- **Batch Processing**: Background processing for large batches
- **Custom Templates**: User-defined image templates
- **A/B Testing**: Multiple image variations
- **Analytics**: Image performance tracking

### Integration Options
- **Nano Banana**: Alternative AI model support
- **Custom Models**: Integration with custom AI models
- **External APIs**: Support for other image generation services

## Testing

Run the test script to verify functionality:
```bash
python test_media_agent.py
```

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure OpenAI API key has sufficient credits
4. Check Supabase permissions and RLS policies
