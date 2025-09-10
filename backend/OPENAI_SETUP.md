# OpenAI API Setup for Media Generation

## Overview
The Media Agent uses OpenAI's DALL-E 3 API to generate images for content posts. To enable this feature, you need to configure the OpenAI API key.

## Setup Instructions

### 1. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it starts with `sk-`)

### 2. Configure Environment Variable

#### For Local Development:
1. Copy `env.example` to `.env` in the backend directory
2. Set the `OPENAI_API_KEY` variable:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

#### For Production (Render):
1. Go to your Render dashboard
2. Select your backend service
3. Go to Environment tab
4. Add environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: `sk-your-actual-api-key-here`

### 3. Verify Setup
After setting the API key, restart your backend service and test the media generation feature.

## Cost Information
- DALL-E 3 costs approximately $0.040 per image (1024x1024, standard quality)
- Each image generation takes 10-30 seconds
- Images are stored in Supabase and can be reused

## Troubleshooting

### Common Issues:
1. **"OpenAI API key not configured"**
   - Check that `OPENAI_API_KEY` is set in your environment
   - Restart the backend service after setting the key

2. **"Invalid OpenAI API key"**
   - Verify the API key is correct and active
   - Check that the key has DALL-E access

3. **"OpenAI API quota exceeded"**
   - Check your OpenAI billing settings
   - Add payment method if needed

4. **"No image URL returned from DALL-E"**
   - Check OpenAI service status
   - Verify API key has sufficient credits

## Security Notes
- Never commit API keys to version control
- Use environment variables for all sensitive data
- Rotate API keys regularly
- Monitor usage to prevent unexpected charges
