"""
Media Generation Agent using LangGraph
Generates images for content posts using AI image generation
"""

import json
import asyncio
import logging
import base64
import io
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, TypedDict
from dataclasses import dataclass
from enum import Enum

import google.generativeai as genai
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from supabase import create_client, Client
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImageStyle(str, Enum):
    REALISTIC = "realistic"
    ARTISTIC = "artistic"
    CARTOON = "cartoon"
    MINIMALIST = "minimalist"
    PHOTOGRAPHIC = "photographic"
    ILLUSTRATION = "illustration"
    DIGITAL_ART = "digital_art"
    WATERCOLOR = "watercolor"
    OIL_PAINTING = "oil_painting"

class ImageSize(str, Enum):
    SQUARE_1024 = "1024x1024"
    SQUARE_512 = "512x512"
    LANDSCAPE_1792 = "1792x1024"
    PORTRAIT_1024 = "1024x1792"

class MediaAgentState(TypedDict):
    user_id: str
    post_id: Optional[str]
    post_data: Optional[Dict[str, Any]]
    image_prompt: Optional[str]
    image_style: Optional[ImageStyle]
    image_size: Optional[ImageSize]
    generated_image_url: Optional[str]
    generation_cost: Optional[float]
    generation_time: Optional[int]
    error_message: Optional[str]
    status: str  # pending, generating, completed, failed

class MediaAgent:
    def __init__(self, supabase_url: str, supabase_key: str, gemini_api_key: str):
        # Use service role key for storage operations to bypass RLS
        service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if service_key:
            self.supabase: Client = create_client(supabase_url, service_key)
        else:
            self.supabase: Client = create_client(supabase_url, supabase_key)
        
        if not gemini_api_key:
            raise ValueError("Google Gemini API key is required")
        
        # Configure Gemini API
        genai.configure(api_key=gemini_api_key)
        self.gemini_model = 'gemini-2.5-flash'  # Use stable model for text generation
        self.gemini_image_model = 'gemini-2.5-flash-image-preview'  # Use image preview model for image generation
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow for media generation"""
        workflow = StateGraph(MediaAgentState)
        
        # Add nodes
        workflow.add_node("load_post", self.load_post_data)
        workflow.add_node("analyze_content", self.analyze_content_for_image)
        workflow.add_node("generate_prompt", self.generate_image_prompt)
        workflow.add_node("generate_image", self.generate_image)
        workflow.add_node("save_image", self.save_image_data)
        workflow.add_node("handle_error", self.handle_error)
        
        # Add edges
        workflow.set_entry_point("load_post")
        
        workflow.add_edge("load_post", "analyze_content")
        workflow.add_edge("analyze_content", "generate_prompt")
        workflow.add_edge("generate_prompt", "generate_image")
        workflow.add_edge("generate_image", "save_image")
        workflow.add_edge("save_image", END)
        
        # Error handling
        workflow.add_edge("handle_error", END)
        
        return workflow.compile()
    
    async def load_post_data(self, state: MediaAgentState) -> MediaAgentState:
        """Load post data from Supabase"""
        try:
            post_id = state.get("post_id")
            if not post_id:
                state["error_message"] = "No post ID provided"
                state["status"] = "failed"
                return state
            
            # Fetch post data with campaign info
            response = self.supabase.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", post_id).execute()
            
            if not response.data:
                logger.error(f"No data found for post {post_id}")
                state["error_message"] = f"Post with ID {post_id} not found"
                state["status"] = "failed"
                return state
            
            post_data = response.data[0]
            state["post_data"] = post_data
            state["user_id"] = post_data["content_campaigns"]["user_id"]
            state["status"] = "analyzing"
            
            return state
            
        except Exception as e:
            logger.error(f"Error loading post data: {str(e)}")
            state["error_message"] = f"Error loading post data: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def analyze_content_for_image(self, state: MediaAgentState) -> MediaAgentState:
        """Analyze content to determine if it needs an image and what style"""
        try:
            post_data = state.get("post_data")
            if not post_data:
                state["error_message"] = "No post data available for analysis"
                state["status"] = "failed"
                return state
            content = post_data.get("content", "")
            platform = post_data.get("platform", "")
            post_type = post_data.get("post_type", "text")
            
            # Check if post already has images (but allow regeneration)
            existing_images = self.supabase.table("content_images").select("*").eq("post_id", post_data["id"]).execute()
            
            if existing_images.data:
                logger.info(f"Post {post_data['id']} already has {len(existing_images.data)} images, allowing regeneration")
                # Don't fail, just log that we're regenerating
            
            # Determine if content needs an image
            needs_image = self._should_generate_image(content, platform, post_type)
            
            if not needs_image:
                state["error_message"] = "Content does not require an image"
                state["status"] = "failed"
                return state
            
            # Get user's image preferences
            user_prefs = self._get_user_image_preferences(state["user_id"])
            
            # Determine image style based on content and platform
            image_style = self._determine_image_style(content, platform, user_prefs)
            image_size = self._determine_image_size(platform)
            
            state["image_style"] = image_style
            state["image_size"] = image_size
            state["status"] = "prompt_generation"
            
            return state
            
        except Exception as e:
            logger.error(f"Error analyzing content: {str(e)}")
            state["error_message"] = f"Error analyzing content: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def generate_image_prompt(self, state: MediaAgentState) -> MediaAgentState:
        """Generate detailed image prompt using Google Gemini"""
        try:
            post_data = state.get("post_data")
            if not post_data:
                state["error_message"] = "No post data available for prompt generation"
                state["status"] = "failed"
                return state
            content = post_data.get("content", "")
            platform = post_data.get("platform", "")
            image_style = state["image_style"]
            
            # Get user profile for context including logo
            user_profile = self._get_user_profile(state["user_id"])
            logo_url = user_profile.get('logo_url', '')
            business_name = user_profile.get('business_name', 'Unknown')
            
            # Create prompt for image generation with logo integration
            logo_context = ""
            if logo_url:
                logo_context = f"""
            IMPORTANT: This business has a logo that should be prominently featured in the image.
            Business logo URL: {logo_url}
            The logo should be placed strategically in the image - either as a watermark in the corner, 
            integrated into the design, or as a central element depending on the content.
            Make sure the logo is clearly visible and well-positioned for brand recognition.
            """
            else:
                logo_context = f"""
            Note: This business ({business_name}) does not have a logo uploaded yet.
            The image should still be professional and branded for {business_name}.
            """
            
            prompt = f"""
            Create a detailed image prompt for a social media post on {platform}.
            
            Post content: {content}
            Platform: {platform}
            Image style: {image_style.value if image_style else 'realistic'}
            Business: {business_name}
            Industry: {', '.join(user_profile.get('industry', []))}
            Brand voice: {user_profile.get('brand_voice', 'Professional')}
            
            {logo_context}
            
            Generate a detailed, specific prompt that will create an engaging image for this social media post.
            The prompt should be optimized for {image_style.value if image_style else 'realistic'} style and suitable for {platform} audience.
            Include specific visual elements, composition, lighting, and mood.
            If a logo is available, ensure it's prominently and tastefully integrated into the design.
            Keep it under 500 characters for API limits.
            """
            
            try:
                response = genai.GenerativeModel(self.gemini_model).generate_content(
                    contents=f"""You are an expert at creating detailed image prompts for AI image generation. Create specific, visual prompts that will generate high-quality images for social media content.

IMPORTANT: When a business logo is available, you MUST include specific instructions about logo placement and integration in your generated prompt. The logo should be:
1. Clearly visible and readable
2. Strategically positioned (corner watermark, integrated into design, or central element)
3. Appropriately sized for the image dimensions
4. Consistent with the overall design aesthetic

{prompt}"""
                )
                
                if response and hasattr(response, 'text') and response.text:
                    image_prompt = response.text.strip()
                    state["image_prompt"] = image_prompt
                    state["status"] = "generating"
                    
                    return state
                else:
                    raise Exception("Empty response from Gemini model")
                    
            except Exception as gemini_error:
                logger.error(f"Gemini API error in prompt generation: {str(gemini_error)}")
                # Fallback to a simple prompt if Gemini fails
                post_data = state["post_data"]
                content = post_data.get("content", "Social media post")
                platform = post_data.get("platform", "social media")
                image_style = state["image_style"]
                
                # Get user profile for fallback prompt
                user_profile = self._get_user_profile(state["user_id"])
                logo_url = user_profile.get('logo_url', '')
                business_name = user_profile.get('business_name', 'Unknown')
                
                # Create fallback prompt with logo context
                if logo_url:
                    fallback_prompt = f"Professional {image_style.value if image_style else 'realistic'} {platform} post image for {business_name} featuring: {content[:100]}. Include the business logo prominently positioned in the image."
                else:
                    fallback_prompt = f"Professional {image_style.value if image_style else 'realistic'} {platform} post image for {business_name} featuring: {content[:100]}"
                
                state["image_prompt"] = fallback_prompt
                state["status"] = "generating"
                
                logger.warning(f"Using fallback prompt due to Gemini error: {fallback_prompt}")
                return state
            
        except Exception as e:
            logger.error(f"Error generating image prompt: {str(e)}")
            state["error_message"] = f"Error generating image prompt: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def generate_image(self, state: MediaAgentState) -> MediaAgentState:
        """Generate image using Gemini 2.5 Flash Image Preview (Nano Banana)"""
        try:
            # Check if Gemini image model is available
            if not self.gemini_image_model:
                raise Exception("Gemini image model not configured. Please set GEMINI_API_KEY environment variable.")
            
            image_prompt = state.get("image_prompt")
            if not image_prompt:
                # Fallback prompt if Gemini prompt generation failed
                post_data = state.get("post_data", {})
                if not post_data:
                    state["error_message"] = "No post data available for image generation"
                    state["status"] = "failed"
                    return state
                content = post_data.get("content", "Social media post")
                platform = post_data.get("platform", "social media")
                
                # Get user profile for fallback prompt
                user_profile = self._get_user_profile(state["user_id"])
                logo_url = user_profile.get('logo_url', '')
                business_name = user_profile.get('business_name', 'Unknown')
                
                # Create fallback prompt with logo context
                if logo_url:
                    image_prompt = f"Professional {platform} post image for {business_name} featuring: {content[:100]}. Include the business logo prominently positioned in the image."
                else:
                    image_prompt = f"Professional {platform} post image for {business_name} featuring: {content[:100]}"
                
                logger.warning(f"Using fallback image prompt: {image_prompt}")
            
            image_size = state["image_size"]
            
            start_time = datetime.now()
            
            # Get user profile and logo for image generation
            user_profile = self._get_user_profile(state["user_id"])
            logo_url = user_profile.get('logo_url', '')
            
            # Generate image using Gemini 2.5 Flash Image Preview
            
            try:
                # Prepare contents for Gemini API call
                contents = []
                
                # Add text prompt
                contents.append(image_prompt)
                
                # Add logo image if available
                if logo_url:
                    try:
                        logo_image_data = await self._download_logo_image(logo_url)
                        if logo_image_data:
                            # Add logo as reference image
                            contents.append({
                                "text": "Use this business logo as a reference and integrate it prominently into the generated image. Place it strategically - either as a watermark in the corner, integrated into the design, or as a central element depending on the content. Make sure the logo is clearly visible and well-positioned for brand recognition."
                            })
                            contents.append({
                                "inline_data": {
                                    "mime_type": "image/png",
                                    "data": logo_image_data
                                }
                            })
                    except Exception as logo_error:
                        logger.warning(f"Failed to include logo in image generation: {logo_error}")
                        # Continue without logo if there's an error
                
                # Use Gemini's native image generation capability
                response = genai.GenerativeModel(self.gemini_image_model).generate_content(
                    contents=contents,
                )
                
                # Extract the generated image from the response
                image_data = None
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    
                    for part in candidate.content.parts:
                        if part.inline_data is not None:
                            image_data = part.inline_data.data
                            break
                else:
                    logger.warning("No candidates in Gemini response")
                
                if not image_data:
                    logger.error("No image data found in Gemini response")
                    raise Exception("No image data returned from Gemini")
                
                # Gemini returns image data as bytes, not base64
                if isinstance(image_data, bytes):
                    image_bytes = image_data
                else:
                    # If it's base64 string, decode it
                    image_bytes = base64.b64decode(image_data)
                
                # Upload the image to Supabase storage
                storage_url = await self._upload_base64_image(image_bytes, state["post_id"])
                
            except Exception as api_error:
                logger.error(f"Error generating image with Gemini: {str(api_error)}")
                # Fallback to generating a simple placeholder image
                logger.warning("Falling back to generated placeholder image")
                storage_url = await self._generate_fallback_image(image_prompt, image_size, state["post_id"])
            
            end_time = datetime.now()
            generation_time = int((end_time - start_time).total_seconds())
            
            if not storage_url:
                raise Exception("No image URL generated")
            
            # Calculate cost (approximate)
            cost = self._calculate_generation_cost(image_size, "standard")
            
            state["generated_image_url"] = storage_url
            state["generation_cost"] = cost
            state["generation_time"] = generation_time
            state["status"] = "saving"
            
            return state
            
        except Exception as e:
            logger.error(f"Error generating image: {str(e)}")
            state["error_message"] = f"Error generating image: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def save_image_data(self, state: MediaAgentState) -> MediaAgentState:
        """Save generated image data to Supabase"""
        try:
            post_data = state.get("post_data")
            if not post_data:
                state["error_message"] = "No post data available for saving image"
                state["status"] = "failed"
                return state
            
            # Validate required data before saving
            if not state.get("generated_image_url"):
                raise Exception("No image URL to save")
            
            if not state.get("image_prompt"):
                raise Exception("No image prompt to save")
            
            # Check if image already exists for this post
            existing_images = self.supabase.table("content_images").select("id").eq("post_id", post_data["id"]).order("created_at", desc=True).limit(1).execute()
            
            image_data = {
                "image_url": state["generated_image_url"],
                "image_prompt": state["image_prompt"],
                "image_style": state["image_style"].value if state["image_style"] else "realistic",
                "image_size": state["image_size"].value if state["image_size"] else "1024x1024",
                "image_quality": "standard",
                "generation_model": "gemini-2.5-flash-image-preview",
                "generation_cost": state["generation_cost"],
                "generation_time": state["generation_time"],
                "is_approved": False
            }
            
            
            if existing_images.data and len(existing_images.data) > 0:
                # Update existing image
                image_id = existing_images.data[0]["id"]
                response = self.supabase.table("content_images").update(image_data).eq("id", image_id).execute()
            else:
                # Create new image record
                image_data["post_id"] = post_data["id"]
                response = self.supabase.table("content_images").insert(image_data).execute()
            
            if response.data:
                state["status"] = "completed"
            else:
                state["error_message"] = "Failed to save image data"
                state["status"] = "failed"
            
            return state
            
        except Exception as e:
            logger.error(f"Error saving image data: {str(e)}")
            state["error_message"] = f"Error saving image data: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def handle_error(self, state: MediaAgentState) -> MediaAgentState:
        """Handle errors and log them"""
        error_msg = state.get("error_message", "Unknown error")
        logger.error(f"Media generation failed: {error_msg}")
        return state
    
    def _should_generate_image(self, content: str, platform: str, post_type: str) -> bool:
        """Determine if content needs an image"""
        # Always generate for image posts
        if post_type in ["image", "carousel"]:
            return True
        
        # Always generate for Instagram (visual platform)
        if platform.lower() == "instagram":
            return True
        
        # Check content length and keywords
        content_lower = content.lower()
        
        # Keywords that suggest image content
        image_keywords = [
            "photo", "picture", "image", "visual", "see", "look", "show",
            "behind the scenes", "process", "step by step", "tutorial",
            "infographic", "chart", "graph", "diagram", "illustration",
            "new", "announcement", "launch", "product", "service", "event"
        ]
        
        has_image_keywords = any(keyword in content_lower for keyword in image_keywords)
        
        # Platform-specific rules (more permissive)
        if platform.lower() == "facebook" and (has_image_keywords or len(content) > 50):
            return True
        elif platform.lower() == "linkedin" and (has_image_keywords or len(content) > 100):
            return True
        elif platform.lower() == "twitter" and (has_image_keywords or len(content) > 50):
            return True
        elif platform.lower() == "youtube" and has_image_keywords:
            return True
        
        # Default: generate image for content longer than 30 characters
        return len(content) > 30
    
    def _get_user_image_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user's image preferences"""
        try:
            response = self.supabase.table("user_image_preferences").select("*").eq("user_id", user_id).execute()
            if response.data:
                return response.data[0]
            return {}
        except Exception as e:
            logger.error(f"Error fetching user preferences: {str(e)}")
            return {}
    
    def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile for context"""
        try:
            response = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            if response.data:
                return response.data[0]
            return {}
        except Exception as e:
            logger.error(f"Error fetching user profile: {str(e)}")
            return {}
    
    def _determine_image_style(self, content: str, platform: str, user_prefs: Dict[str, Any]) -> ImageStyle:
        """Determine appropriate image style"""
        # Check user preferences first
        if user_prefs.get("preferred_style"):
            try:
                return ImageStyle(user_prefs["preferred_style"])
            except ValueError:
                pass
        
        # Platform-specific defaults
        platform_styles = {
            "instagram": ImageStyle.PHOTOGRAPHIC,
            "facebook": ImageStyle.REALISTIC,
            "linkedin": ImageStyle.REALISTIC,
            "twitter": ImageStyle.MINIMALIST,
            "youtube": ImageStyle.ARTISTIC
        }
        
        # Content-based style detection
        content_lower = content.lower()
        
        if "artistic" in content_lower or "creative" in content_lower:
            return ImageStyle.ARTISTIC
        elif "professional" in content_lower or "business" in content_lower:
            return ImageStyle.REALISTIC
        elif "fun" in content_lower or "playful" in content_lower:
            return ImageStyle.CARTOON
        elif "minimal" in content_lower or "simple" in content_lower:
            return ImageStyle.MINIMALIST
        
        return platform_styles.get(platform, ImageStyle.REALISTIC)
    
    def _determine_image_size(self, platform: str) -> ImageSize:
        """Determine appropriate image size for platform"""
        platform_sizes = {
            "instagram": ImageSize.SQUARE_1024,
            "facebook": ImageSize.SQUARE_1024,
            "linkedin": ImageSize.SQUARE_1024,
            "twitter": ImageSize.SQUARE_1024,
            "youtube": ImageSize.LANDSCAPE_1792
        }
        
        return platform_sizes.get(platform, ImageSize.SQUARE_1024)
    
    def _calculate_generation_cost(self, image_size: ImageSize, quality: str) -> float:
        """Calculate approximate generation cost"""
        # Gemini 2.5 Flash Image pricing (as of 2024) - very cost effective
        # Note: Gemini image generation is significantly cheaper than DALL-E
        costs = {
            ImageSize.SQUARE_1024: 0.0008,  # Very cheap compared to DALL-E
            ImageSize.SQUARE_512: 0.0005,
            ImageSize.LANDSCAPE_1792: 0.0012,
            ImageSize.PORTRAIT_1024: 0.0012
        }
        
        # Handle None image_size
        if image_size is None:
            image_size = ImageSize.SQUARE_1024
        
        base_cost = costs.get(image_size, 0.040)
        
        if quality == "hd":
            base_cost *= 2
        
        return round(base_cost, 4)

    async def _upload_base64_image(self, image_bytes: bytes, post_id: str) -> str:
        """Upload image bytes to Supabase storage"""
        try:
            # Generate unique filename with PNG format (Gemini returns PNG)
            filename = f"{post_id}_{uuid.uuid4().hex[:8]}.png"
            file_path = f"generated/{filename}"
            
            # Use the provided image bytes directly
            image_data = image_bytes
            
            # Upload to Supabase storage
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_data,
                file_options={"content-type": "image/png"}
            )
            
            # Check if upload was successful
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload to storage: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading base64 image: {str(e)}")
            raise e

    async def _download_logo_image(self, logo_url: str) -> str:
        """Download logo image and convert to base64 for Gemini API"""
        try:
            import base64
            import httpx
            
            # Download logo image
            async with httpx.AsyncClient() as client:
                response = await client.get(logo_url)
                response.raise_for_status()
                image_data = response.content
            
            # Convert to base64
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return base64_data
            
        except Exception as e:
            logger.error(f"Error downloading logo image: {str(e)}")
            return None

    async def _download_and_upload_image(self, image_url: str, post_id: str) -> str:
        """Download image from URL and upload to Supabase storage"""
        try:
            # Download image from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                response.raise_for_status()
                image_data = response.content
            
            # Generate unique filename
            file_extension = image_url.split('.')[-1].split('?')[0]  # Get extension from URL
            if file_extension not in ['jpg', 'jpeg', 'png', 'webp']:
                file_extension = 'png'  # Default to PNG
            
            filename = f"{post_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
            file_path = f"generated/{filename}"
            
            # Upload to Supabase storage
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_data,
                file_options={"content-type": f"image/{file_extension}"}
            )
            
            # Check if upload was successful (UploadResponse object doesn't have .get() method)
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload to storage: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            return public_url
            
        except Exception as e:
            logger.error(f"Error downloading and uploading image: {str(e)}")
            # Fallback to original URL if storage upload fails
            logger.warning(f"Falling back to original URL: {image_url}")
            return image_url

    async def _generate_fallback_image(self, prompt: str, image_size: ImageSize, post_id: str) -> str:
        """Generate a simple fallback image when Gemini fails"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            import textwrap
            
            # Parse image size
            if hasattr(image_size, 'value'):
                size_str = image_size.value
            else:
                size_str = str(image_size) if image_size else '1024x1024'
            
            width, height = map(int, size_str.split('x'))
            
            # Create a simple image with gradient background
            image = Image.new('RGB', (width, height), color='#f0f0f0')
            draw = ImageDraw.Draw(image)
            
            # Add gradient background
            for y in range(height):
                color_value = int(240 - (y / height) * 40)  # Gradient from light to slightly darker
                draw.line([(0, y), (width, y)], fill=(color_value, color_value, color_value))
            
            # Add text content
            try:
                # Try to use a default font
                font_size = min(width, height) // 20
                font = ImageFont.load_default()
            except:
                font = None
            
            # Prepare text
            text_lines = textwrap.wrap(prompt[:100], width=30)  # Limit text length
            if not text_lines:
                text_lines = ["Generated Content"]
            
            # Calculate text position
            text_height = len(text_lines) * (font_size + 10) if font else len(text_lines) * 20
            start_y = (height - text_height) // 2
            
            # Draw text
            for i, line in enumerate(text_lines):
                text_width = draw.textlength(line, font=font) if font else len(line) * 6
                x = (width - text_width) // 2
                y = start_y + i * (font_size + 10 if font else 20)
                
                # Add text shadow
                draw.text((x+2, y+2), line, fill='#666666', font=font)
                # Add main text
                draw.text((x, y), line, fill='#333333', font=font)
            
            # Add a simple border
            draw.rectangle([0, 0, width-1, height-1], outline='#cccccc', width=2)
            
            # Convert to bytes
            img_buffer = io.BytesIO()
            image.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            image_bytes = img_buffer.getvalue()
            
            # Upload to Supabase storage
            filename = f"{post_id}_fallback_{uuid.uuid4().hex[:8]}.png"
            file_path = f"generated/{filename}"
            
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_bytes,
                file_options={"content-type": "image/png"}
            )
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload fallback image: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            
            return public_url
            
        except Exception as e:
            logger.error(f"Error generating fallback image: {str(e)}")
            # Ultimate fallback - return a simple data URL
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiB2aWV3Qm94PSIwIDAgMTAyNCAxMDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MTIiIHk9IjUxMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmaWxsPSIjMzMzMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgUGxhY2Vob2xkZXI8L3RleHQ+PC9zdmc+"
    
    async def generate_media_for_post(self, post_id: str, user_id: str = None) -> Dict[str, Any]:
        """Main entry point for generating media for a post"""
        initial_state = MediaAgentState(
            user_id=user_id or "",
            post_id=post_id,
            post_data=None,
            image_prompt=None,
            image_style=None,
            image_size=None,
            generated_image_url=None,
            generation_cost=None,
            generation_time=None,
            error_message=None,
            status="pending"
        )
        
        try:
            result = await self.graph.ainvoke(initial_state)
            return {
                "success": result["status"] == "completed",
                "status": result["status"],
                "image_url": result.get("generated_image_url"),
                "cost": result.get("generation_cost"),
                "generation_time": result.get("generation_time"),
                "error": result.get("error_message")
            }
        except Exception as e:
            logger.error(f"Error in media generation workflow: {str(e)}")
            return {
                "success": False,
                "status": "failed",
                "error": str(e)
            }

# Factory function to create media agent
def create_media_agent(supabase_url: str, supabase_key: str, gemini_api_key: str) -> MediaAgent:
    """Create and return a MediaAgent instance"""
    return MediaAgent(supabase_url, supabase_key, gemini_api_key)
