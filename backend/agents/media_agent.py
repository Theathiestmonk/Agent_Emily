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

from google import genai
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
        self.supabase: Client = create_client(supabase_url, supabase_key)
        if not gemini_api_key:
            raise ValueError("Google Gemini API key is required")
        
        # Configure Gemini API with latest library
        self.gemini_client = genai.Client(api_key=gemini_api_key)
        self.gemini_model = 'gemini-2.0-flash-exp'  # Latest model for image generation
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
            logger.info(f"Media agent querying post {post_id}")
            response = self.supabase.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", post_id).execute()
            
            logger.info(f"Media agent query response: {response}")
            logger.info(f"Response data: {response.data}")
            logger.info(f"Response count: {response.count}")
            
            if not response.data:
                logger.error(f"No data found for post {post_id}")
                state["error_message"] = f"Post with ID {post_id} not found"
                state["status"] = "failed"
                return state
            
            post_data = response.data[0]
            state["post_data"] = post_data
            state["user_id"] = post_data["content_campaigns"]["user_id"]
            state["status"] = "analyzing"
            
            logger.info(f"Loaded post data for post {post_id}")
            return state
            
        except Exception as e:
            logger.error(f"Error loading post data: {str(e)}")
            state["error_message"] = f"Error loading post data: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def analyze_content_for_image(self, state: MediaAgentState) -> MediaAgentState:
        """Analyze content to determine if it needs an image and what style"""
        try:
            post_data = state["post_data"]
            content = post_data.get("content", "")
            platform = post_data.get("platform", "")
            post_type = post_data.get("post_type", "text")
            
            # Check if post already has images
            existing_images = self.supabase.table("content_images").select("*").eq("post_id", post_data["id"]).execute()
            
            if existing_images.data:
                state["error_message"] = "Post already has generated images"
                state["status"] = "failed"
                return state
            
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
            
            logger.info(f"Analyzed content for post {post_data['id']}, style: {image_style}, size: {image_size}")
            logger.info(f"Style type: {type(image_style)}, Size type: {type(image_size)}")
            return state
            
        except Exception as e:
            logger.error(f"Error analyzing content: {str(e)}")
            state["error_message"] = f"Error analyzing content: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def generate_image_prompt(self, state: MediaAgentState) -> MediaAgentState:
        """Generate detailed image prompt using Google Gemini"""
        try:
            post_data = state["post_data"]
            content = post_data.get("content", "")
            platform = post_data.get("platform", "")
            image_style = state["image_style"]
            
            # Get user profile for context
            user_profile = self._get_user_profile(state["user_id"])
            
            # Create prompt for image generation
            prompt = f"""
            Create a detailed image prompt for a social media post on {platform}.
            
            Post content: {content}
            Platform: {platform}
            Image style: {image_style}
            Business: {user_profile.get('business_name', 'Unknown')}
            Industry: {', '.join(user_profile.get('industry', []))}
            Brand voice: {user_profile.get('brand_voice', 'Professional')}
            
            Generate a detailed, specific prompt that will create an engaging image for this social media post.
            The prompt should be optimized for {image_style} style and suitable for {platform} audience.
            Include specific visual elements, composition, lighting, and mood.
            Keep it under 400 characters for API limits.
            """
            
            try:
                response = self.gemini_client.models.generate_content(
                    model='gemini-2.0-flash-exp',
                    contents=f"You are an expert at creating detailed image prompts for AI image generation. Create specific, visual prompts that will generate high-quality images for social media content.\n\n{prompt}"
                )
                
                if response and hasattr(response, 'text') and response.text:
                    image_prompt = response.text.strip()
                    state["image_prompt"] = image_prompt
                    state["status"] = "generating"
                    
                    logger.info(f"Generated image prompt: {image_prompt}")
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
                
                fallback_prompt = f"Professional {image_style.value if image_style else 'realistic'} {platform} post image featuring: {content[:100]}"
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
        """Generate image using Google Gemini 2.0 Flash Exp"""
        try:
            # Check if Gemini model is available
            if not self.gemini_model:
                raise Exception("Gemini model not configured. Please set GEMINI_API_KEY environment variable.")
            
            image_prompt = state.get("image_prompt")
            if not image_prompt:
                # Fallback prompt if Gemini prompt generation failed
                post_data = state.get("post_data", {})
                content = post_data.get("content", "Social media post")
                platform = post_data.get("platform", "social media")
                image_prompt = f"Professional {platform} post image for: {content[:100]}"
                logger.warning(f"Using fallback image prompt: {image_prompt}")
            
            image_size = state["image_size"]
            
            start_time = datetime.now()
            
            # Generate image using Gemini 2.0 Flash Exp
            logger.info(f"Generating image with prompt: {image_prompt}")
            logger.info(f"Image size: {image_size.value if image_size else '1024x1024'}")
            logger.info(f"Gemini model available: {bool(self.gemini_model)}")
            
            try:
                # Use Gemini 2.0 Flash Exp model for image generation
                logger.info("Using Gemini 2.0 Flash Exp model for image generation")
                
                # Generate image using the latest Gemini client
                response = self.gemini_client.models.generate_content(
                    model='gemini-2.0-flash-exp',
                    contents=f"Create a high-quality, professional image for social media: {image_prompt}"
                )
                
                image_url = None
                # Check if response contains image data
                if response and hasattr(response, 'parts'):
                    for part in response.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            # Convert image data to base64 data URL
                            import base64
                            image_data = part.inline_data.data
                            image_url = f"data:image/png;base64,{base64.b64encode(image_data).decode()}"
                            logger.info(f"Successfully generated image with Gemini 2.0 Flash Exp")
                            break
                
                # If the main model doesn't work, try alternative models
                if not image_url:
                    logger.warning("Gemini 2.0 Flash Exp model failed, trying alternative models")
                    alternative_models = [
                        "gemini-1.5-flash",
                        "gemini-1.5-pro"
                    ]
                    
                    for model_name in alternative_models:
                        try:
                            logger.info(f"Trying alternative model: {model_name}")
                            
                            alt_response = self.gemini_client.models.generate_content(
                                model=model_name,
                                contents=f"Generate a high-quality image for social media: {image_prompt}"
                            )
                            
                            if alt_response and hasattr(alt_response, 'parts'):
                                for part in alt_response.parts:
                                    if hasattr(part, 'inline_data') and part.inline_data:
                                        import base64
                                        image_data = part.inline_data.data
                                        image_url = f"data:image/png;base64,{base64.b64encode(image_data).decode()}"
                                        logger.info(f"Successfully generated image with {model_name}")
                                        break
                            
                            if image_url:
                                break
                                
                        except Exception as alt_error:
                            logger.warning(f"Alternative model {model_name} failed: {str(alt_error)}")
                            continue
                
                # If no model worked, create a placeholder
                if not image_url:
                    logger.warning("All Gemini image models failed, using placeholder")
                    import urllib.parse
                    safe_prompt = urllib.parse.quote(image_prompt[:50].replace('\n', ' ').replace('\r', ''))
                    image_url = f"https://via.placeholder.com/{image_size.value if image_size else '1024x1024'}/0066CC/FFFFFF?text={safe_prompt}"
                
                logger.info(f"Generated image URL: {image_url[:100]}...")
                
            except Exception as api_error:
                logger.error(f"Gemini API error: {str(api_error)}")
                if "insufficient_quota" in str(api_error).lower():
                    raise Exception("Gemini API quota exceeded. Please check your billing.")
                elif "invalid_api_key" in str(api_error).lower():
                    raise Exception("Invalid Gemini API key. Please check your configuration.")
                else:
                    raise Exception(f"Gemini API error: {str(api_error)}")
            
            end_time = datetime.now()
            generation_time = int((end_time - start_time).total_seconds())
            
            if not image_url:
                raise Exception("No image URL generated")
            
            # Calculate cost (approximate)
            cost = self._calculate_generation_cost(image_size, "standard")
            
            # Handle image upload to Supabase storage
            logger.info(f"Processing image for upload to Supabase storage...")
            logger.info(f"Post ID: {state['post_id']}")
            
            try:
                if image_url.startswith('data:image/'):
                    # Handle base64 data URL from Gemini
                    storage_url = await self._upload_base64_image(image_url, state["post_id"])
                    logger.info(f"Successfully uploaded base64 image to storage: {storage_url}")
                else:
                    # Handle regular URL (placeholder)
                    storage_url = await self._download_and_upload_image(image_url, state["post_id"])
                    logger.info(f"Successfully uploaded URL image to storage: {storage_url}")
            except Exception as upload_error:
                logger.error(f"Failed to upload image to storage: {str(upload_error)}")
                # Fallback to using the original URL if upload fails
                storage_url = image_url
                logger.info(f"Using original URL as fallback: {storage_url}")
            
            state["generated_image_url"] = storage_url
            state["generation_cost"] = cost
            state["generation_time"] = generation_time
            state["status"] = "saving"
            
            logger.info(f"Generated image in {generation_time}s, cost: ${cost}, stored at: {storage_url}")
            return state
            
        except Exception as e:
            logger.error(f"Error generating image: {str(e)}")
            state["error_message"] = f"Error generating image: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def save_image_data(self, state: MediaAgentState) -> MediaAgentState:
        """Save generated image data to Supabase"""
        try:
            post_data = state["post_data"]
            
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
                "generation_model": "gemini-2.0-flash-exp",
                "generation_cost": state["generation_cost"],
                "generation_time": state["generation_time"],
                "is_approved": False
            }
            
            logger.info(f"Saving image data: {image_data}")
            
            if existing_images.data and len(existing_images.data) > 0:
                # Update existing image
                image_id = existing_images.data[0]["id"]
                logger.info(f"Updating existing image with ID: {image_id}")
                response = self.supabase.table("content_images").update(image_data).eq("id", image_id).execute()
            else:
                # Create new image record
                image_data["post_id"] = post_data["id"]
                logger.info("Creating new image record")
                response = self.supabase.table("content_images").insert(image_data).execute()
            
            if response.data:
                state["status"] = "completed"
                logger.info(f"Saved image data for post {post_data['id']}")
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
        
        # Check content length and keywords
        content_lower = content.lower()
        
        # Keywords that suggest image content
        image_keywords = [
            "photo", "picture", "image", "visual", "see", "look", "show",
            "behind the scenes", "process", "step by step", "tutorial",
            "infographic", "chart", "graph", "diagram", "illustration"
        ]
        
        has_image_keywords = any(keyword in content_lower for keyword in image_keywords)
        
        # Platform-specific rules
        if platform == "instagram" and len(content) > 100:
            return True
        elif platform == "facebook" and has_image_keywords:
            return True
        elif platform == "linkedin" and "infographic" in content_lower:
            return True
        
        return False
    
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

    async def _upload_base64_image(self, data_url: str, post_id: str) -> str:
        """Upload base64 data URL image to Supabase storage"""
        try:
            # Extract base64 data from data URL
            if not data_url.startswith('data:image/'):
                raise Exception("Invalid data URL format")
            
            # Parse data URL: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
            header, base64_data = data_url.split(',', 1)
            image_format = header.split('/')[1].split(';')[0]  # Extract format (png, jpeg, etc.)
            
            # Decode base64 data
            import base64
            image_data = base64.b64decode(base64_data)
            
            # Generate unique filename
            filename = f"{post_id}_{uuid.uuid4().hex[:8]}.{image_format}"
            file_path = f"generated/{filename}"
            
            # Upload to Supabase storage
            logger.info(f"Uploading base64 image to storage: {file_path}")
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_data,
                file_options={"content-type": f"image/{image_format}"}
            )
            
            logger.info(f"Storage response: {storage_response}")
            
            # Check if upload was successful
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload to storage: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            logger.info(f"Generated public URL: {public_url}")
            
            logger.info(f"Successfully uploaded base64 image to storage: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading base64 image: {str(e)}")
            raise e

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
            logger.info(f"Uploading to storage: {file_path}")
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_data,
                file_options={"content-type": f"image/{file_extension}"}
            )
            
            logger.info(f"Storage response: {storage_response}")
            
            # Check if upload was successful (UploadResponse object doesn't have .get() method)
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload to storage: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            logger.info(f"Generated public URL: {public_url}")
            
            logger.info(f"Successfully uploaded image to storage: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Error downloading and uploading image: {str(e)}")
            # Fallback to original URL if storage upload fails
            logger.warning(f"Falling back to original URL: {image_url}")
            return image_url
    
    async def generate_media_for_post(self, post_id: str) -> Dict[str, Any]:
        """Main entry point for generating media for a post"""
        initial_state = MediaAgentState(
            user_id="",
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
