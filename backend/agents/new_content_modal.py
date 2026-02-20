"""
New Content Modal Agent - Handles content creation from the NewPostModal form
Built with FastAPI and LLM integration for direct form-based content creation.
"""

import os
import logging
import re
import uuid
import base64
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import google.generativeai as genai
import openai
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

# Initialize OpenAI client
openai_api_key = os.getenv('OPENAI_API_KEY')
openai_client = openai.OpenAI(api_key=openai_api_key) if openai_api_key else None

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

JSON_ONLY_INSTRUCTION = """

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text, comments, or additional text before or after the JSON.
Return ONLY the JSON object, nothing else."""


class NewContentModalAgent:
    """Agent for handling content creation from the NewPostModal form"""

    def __init__(self):
        self.supabase = supabase
        self.openai_client = openai_client

    async def _get_image_base64(self, image_url: str) -> Optional[Dict[str, str]]:
        """Download an image from a URL and return its base64 representation and media type."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url, timeout=30.0)
                if response.status_code == 200:
                    image_content = response.content
                    base64_image = base64.b64encode(image_content).decode('utf-8')
                    media_type = response.headers.get('content-type', 'image/jpeg')
                    return {
                        "base64": base64_image,
                        "media_type": media_type
                    }
                else:
                    logger.error(f"Failed to download image from {image_url}: Status {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error downloading image from {image_url}: {e}")
            return None

    async def create_content_from_modal(self, form_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Create content based on NewPostModal form data

        Args:
            form_data: Form data from NewPostModal (channel, platform, content_type, media, content_idea, Post_type, Image_type)
            user_id: User ID

        Returns:
            Dict with success status and content data or error message
        """
        try:
            logger.info(f"🎯 Creating content from modal form for user: {user_id}")
            logger.info(f"Form data: {form_data}")

            # Load business context
            business_context = await self._get_business_context(user_id)
            profile_assets = await self._get_profile_assets(user_id)

            # Extract form fields
            channel = form_data.get('channel')
            platform = form_data.get('platform')
            content_type = form_data.get('content_type')
            media_option = form_data.get('media')  # 'Generate', 'Upload', 'Without media'
            content_idea = form_data.get('content_idea')
            post_type = form_data.get('Post_type')
            image_type = form_data.get('Image_type')
            uploaded_files = form_data.get('uploaded_files', [])
            
            # Debug logging for carousel with uploads
            if content_type == 'carousel':
                logger.info(f"🔍 Carousel creation - media_option: '{media_option}', uploaded_files count: {len(uploaded_files) if uploaded_files else 0}, uploaded_files: {uploaded_files}")

            # Generate content based on content type
            content_result = await self._generate_content_by_type(
                content_type, platform, content_idea, post_type, media_option,
                image_type, business_context, profile_assets, user_id, uploaded_files
            )

            if not content_result['success']:
                return content_result

            # Save to database
            save_result = await self._save_content_to_database(
                content_result['content_data'], user_id, platform, content_type
            )

            if not save_result['success']:
                return save_result

            return {
                'success': True,
                'message': 'Content created successfully',
                'content_id': save_result['content_id'],
                'content': content_result['content_data'].get('content', ''),
                'title': content_result['content_data'].get('title', ''),
                'images': content_result['content_data'].get('images', []),
                'hashtags': content_result['content_data'].get('hashtags', [])
            }

        except Exception as e:
            logger.error(f"❌ Error creating content from modal: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': f"Failed to create content: {str(e)}"
            }

    async def _get_business_context(self, user_id: str) -> Dict[str, Any]:
        """Get business context from user profile"""
        try:
            profile_fields = [
                "business_name", "business_description", "brand_tone", "industry",
                "target_audience", "brand_voice", "unique_value_proposition",
                "primary_color", "secondary_color", "brand_colors", "logo_url"
            ]

            profile_response = supabase.table("profiles").select(", ".join(profile_fields)).eq("id", user_id).execute()

            if profile_response.data and len(profile_response.data) > 0:
                profile_data = profile_response.data[0]
                return {
                    'business_name': profile_data.get('business_name', 'Business'),
                    'business_description': profile_data.get('business_description', ''),
                    'brand_tone': profile_data.get('brand_tone', 'Professional'),
                    'industry': profile_data.get('industry', 'General'),
                    'target_audience': profile_data.get('target_audience', 'General audience'),
                    'brand_voice': profile_data.get('brand_voice', 'Professional and friendly'),
                    'unique_value_proposition': profile_data.get('unique_value_proposition', ''),
                }
            else:
                logger.warning(f"No profile data found for user_id: {user_id}")
                return self._get_default_business_context()

        except Exception as e:
            logger.error(f"Error loading business context: {e}")
            return self._get_default_business_context()

    def _get_default_business_context(self) -> Dict[str, Any]:
        """Get default business context when profile is not available"""
        return {
            'business_name': 'Business',
            'business_description': '',
            'brand_tone': 'Professional',
            'industry': 'General',
            'target_audience': 'General audience',
            'brand_voice': 'Professional and friendly',
            'unique_value_proposition': '',
        }

    async def _get_profile_assets(self, user_id: str) -> Dict[str, Any]:
        """Get profile assets for content generation"""
        try:
            profile_response = supabase.table("profiles").select(
                "primary_color, secondary_color, brand_colors, logo_url"
            ).eq("id", user_id).execute()

            if profile_response.data and len(profile_response.data) > 0:
                profile_data = profile_response.data[0]
                return {
                    'primary_color': profile_data.get('primary_color'),
                    'secondary_color': profile_data.get('secondary_color'),
                    'brand_colors': profile_data.get('brand_colors') or [],
                    'logo': profile_data.get('logo_url')
                }
            else:
                return {'primary_color': None, 'secondary_color': None, 'brand_colors': [], 'logo': None}

        except Exception as e:
            logger.error(f"Error loading profile assets: {e}")
            return {'primary_color': None, 'secondary_color': None, 'brand_colors': [], 'logo': None}

    async def _generate_content_by_type(self, content_type: str, platform: str, content_idea: str,
                                      post_type: str, media_option: str, image_type: str,
                                      business_context: Dict, profile_assets: Dict, user_id: str,
                                      uploaded_files: List[Dict] = None) -> Dict[str, Any]:
        """Generate content based on content type"""

        try:
            if uploaded_files is None:
                uploaded_files = []

            if content_type == 'static_post':
                return await self._generate_static_post(platform, content_idea, post_type, media_option,
                                                       image_type, business_context, profile_assets, user_id, uploaded_files)
            elif content_type == 'carousel':
                return await self._generate_carousel(platform, content_idea, post_type, media_option, business_context, profile_assets, user_id, uploaded_files)
            elif content_type == 'short_video or reel':
                return await self._generate_short_video(platform, content_idea, post_type, media_option,
                                                       business_context, profile_assets, user_id, uploaded_files)
            elif content_type == 'blog':
                return await self._generate_blog_post(content_idea, post_type, media_option,
                                                    business_context, profile_assets, user_id)
            else:
                return {
                    'success': False,
                    'error': f"Unsupported content type: {content_type}"
                }

        except Exception as e:
            logger.error(f"Error generating content for type {content_type}: {e}")
            return {
                'success': False,
                'error': f"Failed to generate {content_type} content: {str(e)}"
            }

    async def _generate_static_post(self, platform: str, content_idea: str, post_type: str,
                                  media_option: str, image_type: str, business_context: Dict,
                                  profile_assets: Dict, user_id: str, uploaded_files: List[Dict] = None) -> Dict[str, Any]:
        """Generate static post content"""

        # Handle uploaded media if provided
        if media_option == 'Upload' and uploaded_files:
            # Use uploaded files - analyze the first image to generate caption
            if uploaded_files and len(uploaded_files) > 0:
                uploaded_file = uploaded_files[0]  # Use first uploaded file for caption generation
                media_url = uploaded_file.get('url')

                if media_url:
                    # Generate caption based on uploaded image
                    prompt = f"""Analyze the uploaded image above and create an engaging social media caption for {platform}.

Business Context:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Content Idea: {content_idea}
- Post Type: {post_type}

Look at the image and describe what you see. Then create a caption that:
1. Complements and references the visual elements in the image
2. Aligns with the content idea: "{content_idea}"
3. Uses the specified post type: {post_type}
4. Includes relevant hashtags for {platform}
5. Is engaging and matches the brand voice

Make sure the caption actually references elements from the image you analyzed.

Return a JSON object with this exact structure:
{{
    "caption": "The full post caption with hashtags",
    "hashtags": ["hashtag1", "hashtag2"],
    "title": "Brief title for the post"
}}

{JSON_ONLY_INSTRUCTION}"""

                    if not openai_client:
                        return {'success': False, 'error': 'OpenAI client not available'}

                    # Get base64 for image
                    image_data = await self._get_image_base64(media_url)
                    
                    if not image_data:
                        logger.warning(f"Failed to get base64 for image {media_url}, falling back to URL")
                        image_url_payload = {"url": media_url}
                    else:
                        image_url_payload = {"url": f"data:{image_data['media_type']};base64,{image_data['base64']}"}

                    response = openai_client.chat.completions.create(
                        model="gpt-4o",
                        messages=[{
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": image_url_payload
                                }
                            ]
                        }],
                        max_tokens=800,
                        temperature=0.7
                    )

                    content_json = self._parse_json_response(response.choices[0].message.content)
                    if not content_json:
                        return {'success': False, 'error': 'Failed to parse LLM response'}

                    content_data = {
                        'title': content_json.get('title', f"Post about {content_idea[:50]}"),
                        'content': content_json.get('caption', ''),
                        'hashtags': content_json.get('hashtags', []),
                        'images': [media_url]  # Use the uploaded image
                    }

                    return {
                        'success': True,
                        'content_data': content_data
                    }

        # Generate caption using LLM (for Generate or Without media options)
        # Safe string concatenation to avoid f-string curly brace conflicts
        safe_content_idea = str(content_idea).replace('{', '{{').replace('}', '}}')
        prompt = f"""Create an engaging social media post for {platform} about: {safe_content_idea}

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

CONTENT REQUIREMENTS:
- Platform-optimized for {platform}
- Engaging and attention-grabbing
- Include relevant hashtags
- Brand-appropriate tone
- Call-to-action when appropriate

Return a JSON object with this exact structure:
{{
    "caption": "The full post caption with hashtags",
    "hashtags": ["hashtag1", "hashtag2"],
    "title": "Brief title for the post"
}}

{JSON_ONLY_INSTRUCTION}"""

        if not openai_client:
            return {'success': False, 'error': 'OpenAI client not available'}

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.7
        )

        content_json = self._parse_json_response(response.choices[0].message.content)
        if not content_json:
            return {'success': False, 'error': 'Failed to parse LLM response'}

        content_data = {
            'title': content_json.get('title', f"Post about {content_idea[:50]}"),
            'content': content_json.get('caption', ''),
            'hashtags': content_json.get('hashtags', []),
            'images': []
        }

        # Generate or handle media
        if media_option == 'Generate':
            image_url = await self._generate_image_for_content(
                content_idea, image_type, business_context, profile_assets, platform
            )
            if image_url:
                content_data['images'] = [image_url]

        return {
            'success': True,
            'content_data': content_data
        }

    async def _generate_carousel(self, platform: str, content_idea: str, post_type: str,
                               media_option: str, business_context: Dict, profile_assets: Dict, user_id: str, uploaded_files: List[Dict] = None) -> Dict[str, Any]:
        """Generate carousel content"""

        # Debug logging
        logger.info(f"🔍 _generate_carousel called - media_option: {media_option}, uploaded_files: {uploaded_files}, type: {type(uploaded_files)}, length: {len(uploaded_files) if uploaded_files else 0}")

        # Handle uploaded media if provided
        if media_option == 'Upload' and uploaded_files and len(uploaded_files) > 0:
            logger.info(f"📸 Using uploaded files for carousel: {len(uploaded_files)} files")
            
            # Use uploaded files directly - extract URLs
            carousel_images = []
            for uploaded_file in uploaded_files:
                file_url = uploaded_file.get('url')
                if file_url:
                    carousel_images.append(file_url)
            
            if not carousel_images:
                return {'success': False, 'error': 'No valid uploaded file URLs found'}
            
            # Generate caption based on uploaded images
            prompt = f"""Analyze the uploaded carousel images and create an engaging social media caption for {platform}.

Business Context:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Content Idea: {content_idea}
- Post Type: {post_type}

Look at the uploaded images and create a caption that:
1. Complements and references the visual elements in the carousel
2. Aligns with the content idea: "{content_idea}"
3. Uses the specified post type: {post_type}
4. Includes relevant hashtags for {platform}
5. Is engaging and matches the brand voice

Return a JSON object with this exact structure:
{{
    "caption": "The full post caption with hashtags",
    "hashtags": ["hashtag1", "hashtag2"],
    "title": "Brief title for the carousel"
}}

{JSON_ONLY_INSTRUCTION}"""

            if not openai_client:
                return {'success': False, 'error': 'OpenAI client not available'}

            # Use GPT-4o for vision analysis
            messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
            
            # Add image URLs to the message
            for img_url in carousel_images[:4]:  # Limit to first 4 images for API efficiency
                image_data = await self._get_image_base64(img_url)
                if image_data:
                    messages[0]["content"].append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{image_data['media_type']};base64,{image_data['base64']}"}
                    })
                else:
                    logger.warning(f"Failed to get base64 for image {img_url}, falling back to URL")
                    messages[0]["content"].append({
                        "type": "image_url",
                        "image_url": {"url": img_url}
                    })

            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=800,
                temperature=0.7
            )

            content_json = self._parse_json_response(response.choices[0].message.content)
            if not content_json:
                return {'success': False, 'error': 'Failed to parse LLM response'}

            content_data = {
                'title': content_json.get('title', f"Carousel about {content_idea[:50]}"),
                'content': content_json.get('caption', ''),
                'hashtags': content_json.get('hashtags', []),
                'carousel_images': carousel_images,  # Use uploaded images
                'slides': []  # No slides needed when using uploaded images
            }

            return {
                'success': True,
                'content_data': content_data
            }

        # Generate carousel content and images (when media_option is 'Generate' or 'Without media')
        prompt = f"""Create a carousel post for {platform} about: {content_idea}

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

Create a 4-slide carousel with:
1. Hook slide (attention-grabbing)
2. Value slide (main benefit)
3. Proof/Social slide (testimonials/social proof)
4. CTA slide (call to action)

Return a JSON object with this exact structure:
{{
    "title": "Carousel title",
    "caption": "Overall carousel caption",
    "hashtags": ["hashtag1", "hashtag2"],
    "slides": [
        {{"number": 1, "content": "Slide 1 text", "image_prompt": "Visual description for slide 1"}},
        {{"number": 2, "content": "Slide 2 text", "image_prompt": "Visual description for slide 2"}},
        {{"number": 3, "content": "Slide 3 text", "image_prompt": "Visual description for slide 3"}},
        {{"number": 4, "content": "Slide 4 text", "image_prompt": "Visual description for slide 4"}}
    ]
}}

{JSON_ONLY_INSTRUCTION}"""

        if not openai_client:
            return {'success': False, 'error': 'OpenAI client not available'}

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.7
        )

        content_json = self._parse_json_response(response.choices[0].message.content)
        if not content_json:
            return {'success': False, 'error': 'Failed to parse LLM response'}

        # Generate carousel images only if media_option is 'Generate'
        carousel_images = []
        if media_option == 'Generate':
            for slide in content_json.get('slides', []):
                image_url = await self._generate_carousel_slide_image(
                    slide['image_prompt'], business_context, profile_assets
                )
                if image_url:
                    carousel_images.append(image_url)
        # If media_option is 'Without media', carousel_images will remain empty

        content_data = {
            'title': content_json.get('title', f"Carousel about {content_idea[:50]}"),
            'content': content_json.get('caption', ''),
            'hashtags': content_json.get('hashtags', []),
            'carousel_images': carousel_images,
            'slides': content_json.get('slides', [])
        }

        return {
            'success': True,
            'content_data': content_data
        }

    async def _generate_short_video(self, platform: str, content_idea: str, post_type: str,
                                  media_option: str, business_context: Dict, profile_assets: Dict, user_id: str, uploaded_files: List[Dict] = None) -> Dict[str, Any]:
        """Generate short video/reel content"""

        # Handle uploaded video if provided
        if media_option == 'Upload' and uploaded_files:
            # Use uploaded video file - extract video URL
            if uploaded_files and len(uploaded_files) > 0:
                uploaded_file = uploaded_files[0]  # Use first uploaded file
                media_url = uploaded_file.get('url') or uploaded_file.get('media_url')

                if media_url:
                    # Generate caption and hashtags based on uploaded video
                    prompt = f"""Create a social media caption and hashtags for a video about: {content_idea}

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

Note: The user has already uploaded their own video. Create an engaging caption and relevant hashtags that complement the video content.

Return a JSON object with this exact structure:
{{
    "title": "Video title",
    "caption": "Social media caption for the video",
    "hashtags": ["hashtag1", "hashtag2"]
}}

{JSON_ONLY_INSTRUCTION}"""

                    if not openai_client:
                        return {'success': False, 'error': 'OpenAI client not available'}

                    response = openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=1000,
                        temperature=0.8
                    )

                    content_json = self._parse_json_response(response.choices[0].message.content)
                    if not content_json:
                        return {'success': False, 'error': 'Failed to parse LLM response'}

                    content_data = {
                        'title': content_json.get('title', f"Video about {content_idea[:50]}"),
                        'content': content_json.get('caption', ''),
                        # No script stored for uploaded videos since users provide their own video content
                        'hashtags': content_json.get('hashtags', []),
                        'media_url': media_url,  # Store the uploaded video URL
                        'images': []
                    }

                    return {
                        'success': True,
                        'content_data': content_data
                    }

        # Generate video script and caption using LLM (for Generate or Without media options)
        # First, generate the video script
        script_prompt = f"""You are a professional short-form video script writer creating viral content for {platform} Reels.

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

CONTENT IDEA: {content_idea}

Create a complete 15-30 second video script optimized for virality that includes:

1. HOOK (0:00-0:03): Attention-grabbing opening that stops the scroll
2. VALUE (0:03-0:15): Main content/benefit delivered clearly
3. PROOF (0:15-0:25): Social proof, example, or demonstration
4. CTA (0:25-0:30): Clear call-to-action

FORMAT REQUIREMENTS:
- Use timestamp format: MM:SS - [Visual/Voiceover] Content
- Example: "0:00 - [Visual: Quick cut] Hook text here"
- Keep each segment concise and punchy
- Make it scroll-stopping and engaging
- Optimize for {platform} algorithm

Return ONLY the script in this format:
0:00 - [Visual: ...] Hook content
0:03 - [Voiceover: ...] Main value content
0:15 - [Visual: ...] Proof/demonstration
0:25 - [Voiceover: ...] Call-to-action

Make it viral-worthy and engaging!"""

        if not openai_client:
            return {'success': False, 'error': 'OpenAI client not available'}

        # Generate script
        script_response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": script_prompt}],
            max_tokens=800,
            temperature=0.9
        )

        generated_script = script_response.choices[0].message.content.strip()

        # Now generate caption based on the script
        caption_prompt = f"""Based on this short video script, create a compelling title and Instagram caption for the reel.

VIDEO SCRIPT:
{generated_script}

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

TASK:
Create a viral-worthy Instagram Reel title and caption that will:
1. Hook viewers in the first 3 words
2. Use trending hashtags and emojis naturally
3. Include a strong call-to-action
4. Be optimized for Instagram's algorithm

FORMAT (Return ONLY this format):
TITLE: [Compelling 1-5 word title]
CAPTION: [Scroll-stopping caption with emojis, 100-150 characters]

Make it authentic, engaging, and optimized for maximum engagement!"""

        try:
            caption_response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": caption_prompt}],
                max_tokens=300,
                temperature=0.9
            )
            caption_result = caption_response.choices[0].message.content.strip()

            # Parse title and caption
            title = ""
            caption = ""
            for line in caption_result.split('\n'):
                line = line.strip()
                if line.startswith('TITLE:'):
                    title = line.replace('TITLE:', '').strip()
                elif line.startswith('CAPTION:'):
                    caption = line.replace('CAPTION:', '').strip()

            # Extract hashtags from caption or generate them
            hashtags = []
            if caption:
                # Extract hashtags from caption
                hashtag_matches = re.findall(r'#(\w+)', caption)
                hashtags = hashtag_matches[:10]  # Limit to 10 hashtags

            # If no hashtags found, generate some
            if not hashtags:
                hashtag_prompt = f"""Generate 5-8 relevant hashtags for a {platform} reel about: {content_idea}
                
Return only hashtags separated by spaces, no # symbols needed.
Example: marketing socialmedia business tips"""
                
                hashtag_response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": hashtag_prompt}],
                    max_tokens=100,
                    temperature=0.7
                )
                hashtag_text = hashtag_response.choices[0].message.content.strip()
                hashtags = [tag.strip() for tag in hashtag_text.split() if tag.strip()][:10]

            content_data = {
                'title': title if title else f"Reel: {content_idea[:30]}",
                'content': caption if caption else generated_script[:200] + "...",
                'short_video_script': generated_script,  # Store the script
                'hashtags': hashtags,
                'images': []
            }

            logger.info(f"✅ Generated reel script and caption: '{title}'")

        except Exception as caption_error:
            logger.warning(f"Failed to generate reel caption: {caption_error}")
            # Fallback: use script as content
            content_data = {
                'title': f"Reel: {content_idea[:30]}",
                'content': generated_script[:200] + "...",
                'short_video_script': generated_script,  # Store the script
                'hashtags': [],
                'images': []
            }

        # Generate video thumbnail if needed
        if media_option == 'Generate':
            thumbnail_url = await self._generate_video_thumbnail(
                content_idea, business_context, profile_assets
            )
            if thumbnail_url:
                content_data['images'] = [thumbnail_url]

        return {
            'success': True,
            'content_data': content_data
        }

    async def _generate_long_video(self, platform: str, content_idea: str, post_type: str,
                                 media_option: str, business_context: Dict, profile_assets: Dict, user_id: str) -> Dict[str, Any]:
        """Generate long video content"""

        prompt = f"""Create a long-form video concept for {platform} about: {content_idea}

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

Create a comprehensive video concept with:
1. Video title and hook
2. Detailed outline/structure
3. Key talking points
4. Visual concepts
5. Thumbnail ideas

Return a JSON object with this exact structure:
{{
    "title": "Video title",
    "description": "Detailed video description",
    "outline": ["Section 1", "Section 2", "Section 3"],
    "key_points": ["Point 1", "Point 2", "Point 3"],
    "caption": "Social media caption",
    "hashtags": ["hashtag1", "hashtag2"],
    "thumbnail_concept": "Thumbnail visual description"
}}

{JSON_ONLY_INSTRUCTION}"""

        if not openai_client:
            return {'success': False, 'error': 'OpenAI client not available'}

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.7
        )

        content_json = self._parse_json_response(response.choices[0].message.content)
        if not content_json:
            return {'success': False, 'error': 'Failed to parse LLM response'}

        content_data = {
            'title': content_json.get('title', f"Video about {content_idea[:50]}"),
            'content': content_json.get('caption', ''),
            'hashtags': content_json.get('hashtags', []),
            'video_description': content_json.get('description', ''),
            'video_outline': content_json.get('outline', []),
            'images': []
        }

        # Generate thumbnail if needed
        if media_option == 'Generate':
            thumbnail_url = await self._generate_video_thumbnail(
                content_json.get('thumbnail_concept', content_idea), business_context, profile_assets
            )
            if thumbnail_url:
                content_data['images'] = [thumbnail_url]

        return {
            'success': True,
            'content_data': content_data
        }

    async def _generate_blog_post(self, content_idea: str, post_type: str, media_option: str,
                                business_context: Dict, profile_assets: Dict, user_id: str) -> Dict[str, Any]:
        """Generate blog post content"""

        prompt = f"""Create a comprehensive blog post about: {content_idea}

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
- Post Type: {post_type}

Create a complete blog post with:
1. SEO-optimized title
2. Compelling introduction
3. Well-structured body with headings
4. Practical conclusion
5. Meta description and tags

Return a JSON object with this exact structure:
{{
    "title": "SEO-optimized blog title",
    "excerpt": "150-160 character summary",
    "content": "Full HTML blog content with headings",
    "categories": ["Category 1", "Category 2"],
    "tags": ["tag1", "tag2", "tag3"],
    "featured_image_prompt": "Description for featured image"
}}

{JSON_ONLY_INSTRUCTION}"""

        if not openai_client:
            return {'success': False, 'error': 'OpenAI client not available'}

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.7
        )

        content_json = self._parse_json_response(response.choices[0].message.content)
        if not content_json:
            return {'success': False, 'error': 'Failed to parse LLM response'}

        content_data = {
            'title': content_json.get('title', f"Blog about {content_idea[:50]}"),
            'content': content_json.get('content', ''),
            'excerpt': content_json.get('excerpt', ''),
            'categories': content_json.get('categories', []),
            'tags': content_json.get('tags', []),
            'hashtags': content_json.get('tags', []),  # Use tags as hashtags too
            'images': []
        }

        # Generate featured image if needed
        if media_option == 'Generate':
            featured_image_url = await self._generate_blog_featured_image(
                content_json.get('featured_image_prompt', content_idea), business_context, profile_assets
            )
            if featured_image_url:
                content_data['images'] = [featured_image_url]

        return {
            'success': True,
            'content_data': content_data
        }

    async def _generate_image_for_content(self, content_idea: str, image_type: str,
                                        business_context: Dict, profile_assets: Dict, platform: str) -> Optional[str]:
        """Generate image for content using Gemini"""
        try:
            prompt = f"""Create a {image_type} image for {platform} about: {content_idea}

Business: {business_context.get('business_name', 'Business')}
Style: Professional, engaging, optimized for {platform}
Brand colors: {', '.join(profile_assets.get('brand_colors', []))}
Logo available: {'Yes' if profile_assets.get('logo') else 'No'}

Make it visually appealing and brand-consistent."""

            # Add logo if available
            contents = [prompt]
            if profile_assets.get('logo'):
                try:
                    logo_url = profile_assets['logo']
                    async with httpx.AsyncClient(follow_redirects=True) as client:
                        logo_response = await client.get(logo_url)
                        logo_response.raise_for_status()
                        logo_data = logo_response.content

                    contents.append({
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(logo_data).decode('utf-8')
                        }
                    })
                except Exception as e:
                    logger.warning(f"Failed to include logo: {e}")

            # Generate image
            gemini_image_model = 'gemini-2.5-flash-image'
            model = genai.GenerativeModel(gemini_image_model)
            # Wrap blocking call in asyncio.to_thread to avoid blocking the event loop
            image_response = await asyncio.to_thread(model.generate_content, contents=contents)

            if image_response.candidates and len(image_response.candidates) > 0:
                candidate = image_response.candidates[0]
                if candidate.content.parts:
                    for part in candidate.content.parts:
                        if part.inline_data and part.inline_data.data:
                            image_data = part.inline_data.data
                            if not isinstance(image_data, bytes):
                                image_data = base64.b64decode(image_data)

                            # Upload to Supabase
                            filename = f"content_images/{uuid.uuid4()}.png"
                            storage_response = supabase.storage.from_("ai-generated-images").upload(
                                filename, image_data,
                                file_options={"content-type": "image/png", "upsert": "false"}
                            )

                            # Check if upload was successful (Supabase storage upload doesn't return status, but we can check for errors)
                            if storage_response:
                                # Check if there's no error attribute or if error is None/Falsy
                                if not hasattr(storage_response, 'error') or not storage_response.error:
                                    image_url = supabase.storage.from_("ai-generated-images").get_public_url(filename)
                                    logger.info(f"✅ Image generated and uploaded: {image_url}")
                                    return image_url

            logger.error("Failed to generate image")
            return None

        except Exception as e:
            logger.error(f"Error generating image: {e}")
            return None

    async def _generate_carousel_slide_image(self, image_prompt: str, business_context: Dict, profile_assets: Dict) -> Optional[str]:
        """Generate carousel slide image"""
        try:
            prompt = f"""Create a carousel slide image: {image_prompt}

Business: {business_context.get('business_name', 'Business')}
Style: Clean, professional, visually appealing for social media carousel"""

            gemini_image_model = 'gemini-2.5-flash-image'
            model = genai.GenerativeModel(gemini_image_model)
            # Wrap blocking call in asyncio.to_thread to avoid blocking the event loop
            image_response = await asyncio.to_thread(model.generate_content, contents=[prompt])

            if image_response.candidates and len(image_response.candidates) > 0:
                candidate = image_response.candidates[0]
                if candidate.content.parts:
                    for part in candidate.content.parts:
                        if part.inline_data and part.inline_data.data:
                            image_data = part.inline_data.data
                            if not isinstance(image_data, bytes):
                                image_data = base64.b64decode(image_data)

                            # Upload to Supabase
                            filename = f"carousel_images/{uuid.uuid4()}.png"
                            storage_response = supabase.storage.from_("ai-generated-images").upload(
                                filename, image_data,
                                file_options={"content-type": "image/png", "upsert": "false"}
                            )

                            # Check if upload was successful (Supabase storage upload doesn't return status, but we can check for errors)
                            if storage_response:
                                # Check if there's no error attribute or if error is None/Falsy
                                if not hasattr(storage_response, 'error') or not storage_response.error:
                                    image_url = supabase.storage.from_("ai-generated-images").get_public_url(filename)
                                    logger.info(f"✅ Image generated and uploaded: {image_url}")
                                    return image_url

            return None

        except Exception as e:
            logger.error(f"Error generating carousel slide image: {e}")
            return None

    async def _generate_video_thumbnail(self, content_idea: str, business_context: Dict, profile_assets: Dict) -> Optional[str]:
        """Generate video thumbnail"""
        try:
            prompt = f"""Create an eye-catching video thumbnail for: {content_idea}

Business: {business_context.get('business_name', 'Business')}
Style: Click-worthy, professional, optimized for 9:16 aspect ratio
Design: Bold text overlay, vibrant colors, compelling visuals"""

            gemini_image_model = 'gemini-2.5-flash-image'
            model = genai.GenerativeModel(gemini_image_model)
            # Wrap blocking call in asyncio.to_thread to avoid blocking the event loop
            image_response = await asyncio.to_thread(model.generate_content, contents=[prompt])

            if image_response.candidates and len(image_response.candidates) > 0:
                candidate = image_response.candidates[0]
                if candidate.content.parts:
                    for part in candidate.content.parts:
                        if part.inline_data and part.inline_data.data:
                            image_data = part.inline_data.data
                            if not isinstance(image_data, bytes):
                                image_data = base64.b64decode(image_data)

                            # Upload to Supabase
                            filename = f"video_thumbnails/{uuid.uuid4()}.png"
                            storage_response = supabase.storage.from_("ai-generated-images").upload(
                                filename, image_data,
                                file_options={"content-type": "image/png", "upsert": "false"}
                            )

                            # Check if upload was successful (Supabase storage upload doesn't return status, but we can check for errors)
                            if storage_response:
                                # Check if there's no error attribute or if error is None/Falsy
                                if not hasattr(storage_response, 'error') or not storage_response.error:
                                    image_url = supabase.storage.from_("ai-generated-images").get_public_url(filename)
                                    logger.info(f"✅ Image generated and uploaded: {image_url}")
                                    return image_url

            return None

        except Exception as e:
            logger.error(f"Error generating video thumbnail: {e}")
            return None

    async def _generate_blog_featured_image(self, image_prompt: str, business_context: Dict, profile_assets: Dict) -> Optional[str]:
        """Generate blog featured image"""
        try:
            prompt = f"""Create a professional blog featured image: {image_prompt}

Business: {business_context.get('business_name', 'Business')}
Style: High-quality, professional, suitable for blog header
Format: Landscape, visually appealing, brand-consistent"""

            gemini_image_model = 'gemini-2.5-flash-image'
            model = genai.GenerativeModel(gemini_image_model)
            # Wrap blocking call in asyncio.to_thread to avoid blocking the event loop
            image_response = await asyncio.to_thread(model.generate_content, contents=[prompt])

            if image_response.candidates and len(image_response.candidates) > 0:
                candidate = image_response.candidates[0]
                if candidate.content.parts:
                    for part in candidate.content.parts:
                        if part.inline_data and part.inline_data.data:
                            image_data = part.inline_data.data
                            if not isinstance(image_data, bytes):
                                image_data = base64.b64decode(image_data)

                            # Upload to Supabase
                            filename = f"blog_featured/{uuid.uuid4()}.png"
                            storage_response = supabase.storage.from_("ai-generated-images").upload(
                                filename, image_data,
                                file_options={"content-type": "image/png", "upsert": "false"}
                            )

                            # Check if upload was successful (Supabase storage upload doesn't return status, but we can check for errors)
                            if storage_response:
                                # Check if there's no error attribute or if error is None/Falsy
                                if not hasattr(storage_response, 'error') or not storage_response.error:
                                    image_url = supabase.storage.from_("ai-generated-images").get_public_url(filename)
                                    logger.info(f"✅ Image generated and uploaded: {image_url}")
                                    return image_url

            return None

        except Exception as e:
            logger.error(f"Error generating blog featured image: {e}")
            return None

    def _parse_json_response(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Parse JSON response from LLM, handling various formats"""
        try:
            # Clean the response
            cleaned = response_text.strip()

            # Remove markdown code blocks if present
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.startswith('```'):
                cleaned = cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]

            cleaned = cleaned.strip()

            # Handle common LLM formatting issues
            # Remove extra opening braces at the start
            if cleaned.startswith('{{'):
                cleaned = '{' + cleaned[2:]

            # Remove extra closing braces at the end
            if cleaned.endswith('}}'):
                cleaned = cleaned[:-2] + '}'

            # Parse JSON
            import json
            return json.loads(cleaned)

        except Exception as e:
            logger.error(f"Error parsing JSON response: {e}")
            logger.error(f"Cleaned response: {cleaned[:500]}")
            logger.error(f"Original response: {response_text[:500]}")
            return None

    async def _save_content_to_database(self, content_data: Dict[str, Any], user_id: str,
                                      platform: str, content_type: str) -> Dict[str, Any]:
        """Save generated content to the database"""
        try:
            content_id = str(uuid.uuid4())

            # Prepare data for created_content table
            db_data = {
                'id': content_id,
                'user_id': user_id,
                'title': content_data.get('title', ''),
                'content': content_data.get('content', ''),
                'platform': platform,
                'content_type': content_type,
                'status': 'draft',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }

            # Add optional fields
            if content_data.get('hashtags'):
                db_data['hashtags'] = content_data['hashtags']

            if content_data.get('images'):
                db_data['images'] = content_data['images']

            if content_data.get('media_url'):
                db_data['media_url'] = content_data['media_url']
                # For videos, also store in metadata to help frontend recognize it
                if content_type == 'short_video or reel' or content_data.get('media_url', '').endswith('.mp4'):
                    if 'metadata' not in db_data:
                        db_data['metadata'] = {}
                    if not isinstance(db_data['metadata'], dict):
                        db_data['metadata'] = {}
                    db_data['metadata']['media_type'] = 'video'
                    db_data['metadata']['is_video'] = True

            if content_data.get('carousel_images'):
                db_data['carousel_images'] = content_data['carousel_images']
                # Also store in metadata for consistency with frontend expectations
                if 'metadata' not in db_data:
                    db_data['metadata'] = {}
                if not isinstance(db_data['metadata'], dict):
                    db_data['metadata'] = {}
                db_data['metadata']['carousel_images'] = content_data['carousel_images']
                db_data['metadata']['total_images'] = len(content_data['carousel_images'])

            if content_data.get('short_video_script'):
                db_data['short_video_script'] = content_data['short_video_script']

            if content_data.get('video_description'):
                db_data['video_description'] = content_data['video_description']

            if content_data.get('video_outline'):
                db_data['video_outline'] = content_data['video_outline']

            # Handle blog-specific fields
            if content_type == 'blog':
                db_data['excerpt'] = content_data.get('excerpt', '')
                db_data['categories'] = content_data.get('categories', [])
                db_data['tags'] = content_data.get('tags', [])

            # Save to database
            response = supabase.table('created_content').insert(db_data).execute()

            if response.data:
                logger.info(f"✅ Content saved to database with ID: {content_id}")
                return {
                    'success': True,
                    'content_id': content_id
                }
            else:
                logger.error("Failed to save content to database")
                return {
                    'success': False,
                    'error': 'Failed to save content to database'
                }

        except Exception as e:
            logger.error(f"Error saving content to database: {e}")
            return {
                'success': False,
                'error': f'Failed to save content: {str(e)}'
            }


# Singleton instance
new_content_modal_agent = NewContentModalAgent()