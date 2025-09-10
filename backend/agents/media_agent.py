"""
Media Generation Agent using LangGraph
Generates images for content posts using AI image generation
"""

import json
import asyncio
import logging
import base64
import io
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, TypedDict
from dataclasses import dataclass
from enum import Enum

from openai import OpenAI
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
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        if not openai_api_key:
            raise ValueError("OpenAI API key is required")
        self.openai_client = OpenAI(api_key=openai_api_key)
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
        """Generate detailed image prompt using OpenAI"""
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
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert at creating detailed image prompts for AI image generation. Create specific, visual prompts that will generate high-quality images for social media content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.7
            )
            
            image_prompt = response.choices[0].message.content.strip()
            state["image_prompt"] = image_prompt
            state["status"] = "generating"
            
            logger.info(f"Generated image prompt: {image_prompt}")
            return state
            
        except Exception as e:
            logger.error(f"Error generating image prompt: {str(e)}")
            state["error_message"] = f"Error generating image prompt: {str(e)}"
            state["status"] = "failed"
            return state
    
    async def generate_image(self, state: MediaAgentState) -> MediaAgentState:
        """Generate image using DALL-E 3"""
        try:
            # Check if OpenAI client is available
            if not self.openai_client:
                raise Exception("OpenAI client not configured. Please set OPENAI_API_KEY environment variable.")
            
            image_prompt = state["image_prompt"]
            image_size = state["image_size"]
            
            start_time = datetime.now()
            
            # Generate image using DALL-E 3
            logger.info(f"Generating image with prompt: {image_prompt}")
            logger.info(f"Image size: {image_size.value if image_size else '1024x1024'}")
            logger.info(f"OpenAI client available: {bool(self.openai_client)}")
            
            try:
                response = self.openai_client.images.generate(
                    model="dall-e-3",
                    prompt=image_prompt,
                    size=image_size.value if image_size else "1024x1024",
                    quality="standard",
                    n=1
                )
                
                logger.info(f"DALL-E response received: {bool(response)}")
                logger.info(f"Response data length: {len(response.data) if response.data else 0}")
                
            except Exception as api_error:
                logger.error(f"DALL-E API error: {str(api_error)}")
                if "insufficient_quota" in str(api_error).lower():
                    raise Exception("OpenAI API quota exceeded. Please check your billing.")
                elif "invalid_api_key" in str(api_error).lower():
                    raise Exception("Invalid OpenAI API key. Please check your configuration.")
                else:
                    raise Exception(f"DALL-E API error: {str(api_error)}")
            
            end_time = datetime.now()
            generation_time = int((end_time - start_time).total_seconds())
            
            if not response.data or len(response.data) == 0:
                raise Exception("No image data returned from DALL-E")
            
            image_url = response.data[0].url
            if not image_url:
                raise Exception("No image URL returned from DALL-E")
            
            # Calculate cost (approximate)
            cost = self._calculate_generation_cost(image_size, "standard")
            
            state["generated_image_url"] = image_url
            state["generation_cost"] = cost
            state["generation_time"] = generation_time
            state["status"] = "saving"
            
            logger.info(f"Generated image in {generation_time}s, cost: ${cost}, URL: {image_url}")
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
                "generation_model": "dall-e-3",
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
        # DALL-E 3 pricing (as of 2024)
        costs = {
            ImageSize.SQUARE_1024: 0.040,
            ImageSize.SQUARE_512: 0.020,
            ImageSize.LANDSCAPE_1792: 0.080,
            ImageSize.PORTRAIT_1024: 0.080
        }
        
        # Handle None image_size
        if image_size is None:
            image_size = ImageSize.SQUARE_1024
        
        base_cost = costs.get(image_size, 0.040)
        
        if quality == "hd":
            base_cost *= 2
        
        return round(base_cost, 4)
    
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
def create_media_agent(supabase_url: str, supabase_key: str, openai_api_key: str) -> MediaAgent:
    """Create and return a MediaAgent instance"""
    return MediaAgent(supabase_url, supabase_key, openai_api_key)
