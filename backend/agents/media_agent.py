"""
Media Generation Agent using LangGraph
Generates s for content posts using AI  generation
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
from services.token_usage_service import TokenUsageService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Style(str, Enum):
    REALISTIC = "realistic"
    ARTISTIC = "artistic"
    CARTOON = "cartoon"
    MINIMALIST = "minimalist"
    PHOTOGRAPHIC = "photographic"
    ILLUSTRATION = "illustration"
    DIGITAL_ART = "digital_art"
    WATERCOLOR = "watercolor"
    OIL_PAINTING = "oil_painting"

class Size(str, Enum):
    SQUARE_1024 = "1024x1024"
    SQUARE_512 = "512x512"
    LANDSCAPE_1792 = "1792x1024"
    PORTRAIT_1024 = "1024x1792"

# Type aliases for backward compatibility
ImageStyle = Style
ImageSize = Size

class MediaAgentState(TypedDict):
    user_id: str
    post_id: Optional[str]
    post_data: Optional[Dict[str, Any]]
    image_prompt: Optional[str]
    image_style: Optional[Style]
    image_size: Optional[Size]
    generated_image_url: Optional[str]
    generation_cost: Optional[float]
    generation_time: Optional[int]
    generation_model: Optional[str]
    generation_service: Optional[str]
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
        self.gemini_image_model = 'gemini-2.5-flash-image-preview'  # Use preview model for image generation
        self.token_tracker = TokenUsageService(supabase_url, service_key or supabase_key)
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
        
        # Normal flow
        workflow.add_edge("load_post", "analyze_content")
        workflow.add_edge("analyze_content", "generate_prompt")
        workflow.add_edge("generate_prompt", "generate_image")
        workflow.add_edge("generate_image", "save_image")
        workflow.add_edge("save_image", END)
        
        # Error handling - redirect to handle_error if any step fails
        workflow.add_conditional_edges(
            "load_post",
            lambda state: "handle_error" if state.get("status") == "failed" else "analyze_content"
        )
        workflow.add_conditional_edges(
            "analyze_content", 
            lambda state: "handle_error" if state.get("status") == "failed" else "generate_prompt"
        )
        workflow.add_conditional_edges(
            "generate_prompt",
            lambda state: "handle_error" if state.get("status") == "failed" else "generate_image"
        )
        workflow.add_conditional_edges(
            "generate_image",
            lambda state: "handle_error" if state.get("status") == "failed" else "save_image"
        )
        workflow.add_conditional_edges(
            "save_image",
            lambda state: "handle_error" if state.get("status") == "failed" else END
        )
        
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
            image_style = state.get("image_style", Style.REALISTIC)
            
            # Check if this is a sequential carousel image
            is_sequential_carousel = post_data.get("is_sequential_carousel", False)
            carousel_index = post_data.get("carousel_index", 0)
            total_carousel_images = post_data.get("total_carousel_images", 4)
            previous_prompts = post_data.get("previous_carousel_prompts", [])
            carousel_theme = post_data.get("carousel_theme", "")
            
            # Get user profile for context including brand colors
            user_profile = self._get_user_profile(state["user_id"])
            business_name = user_profile.get('business_name', 'Unknown')
            primary_color = user_profile.get('primary_color', '')
            secondary_color = user_profile.get('secondary_color', '')
            additional_colors = user_profile.get('additional_colors', [])
            
            # Build brand colors context
            brand_colors_context = ""
            colors_list = []
            if primary_color:
                colors_list.append(f"Primary color: {primary_color}")
            if secondary_color:
                colors_list.append(f"Secondary color: {secondary_color}")
            if additional_colors and isinstance(additional_colors, list):
                for i, color in enumerate(additional_colors, 1):
                    if color:
                        colors_list.append(f"Additional color {i}: {color}")
            
            if colors_list:
                brand_colors_context = f"""
            CRITICAL BRAND COLOR REQUIREMENTS:
            - The image MUST primarily use these brand colors: {', '.join(colors_list)}
            - Primary color ({primary_color}) should be the dominant color in the design
            - Secondary color ({secondary_color}) should be used as accent or complementary colors
            - Additional colors: {', '.join([c for c in additional_colors if c]) if additional_colors else 'None'}
            - Create a cohesive color palette using these brand colors
            - Ensure brand colors are prominent and well-integrated throughout the design
            - Use brand colors for backgrounds, text overlays, borders, or key visual elements
            - Maintain brand consistency by adhering strictly to this color scheme
            """
            else:
                brand_colors_context = """
            Note: No specific brand colors have been set. Use appropriate colors that match the business and content.
            """
            
            # Build sequential carousel context if this is part of a carousel
            carousel_sequence_context = ""
            if is_sequential_carousel:
                theme_context = f" Overall carousel theme: {carousel_theme}" if carousel_theme else ""
                if carousel_index == 0:
                    carousel_sequence_context = f"""
            SEQUENTIAL CAROUSEL IMAGE REQUIREMENTS (Image {carousel_index + 1} of {total_carousel_images}):{theme_context}
            - This is the FIRST image in a {total_carousel_images}-part sequential carousel story
            - Create an opening/introduction scene that sets up the narrative
            - Use a color palette and visual style that can be consistently maintained across all {total_carousel_images} images
            - Establish the visual theme, mood, and composition style that will continue in subsequent images
            - Make it engaging and attention-grabbing as the first image users will see
            - Set the foundation for a cohesive visual story that will flow through all {total_carousel_images} images
            """
                elif carousel_index < total_carousel_images - 1:
                    carousel_sequence_context = f"""
            SEQUENTIAL CAROUSEL IMAGE REQUIREMENTS (Image {carousel_index + 1} of {total_carousel_images}):{theme_context}
            - This is image {carousel_index + 1} in a {total_carousel_images}-part sequential carousel story
            - MUST maintain visual consistency with previous images: {', '.join(previous_prompts[:2]) if previous_prompts else 'N/A'}
            - Continue the narrative progression from the previous image(s)
            - Use the SAME color palette, visual style, and composition approach as previous images
            - Build upon the story/theme established in previous images
            - Create visual continuity: similar lighting, color tones, design elements, and mood
            - The image should feel like a natural continuation of the carousel sequence
            - Maintain the same artistic style, color scheme, and visual language as image {carousel_index}
            """
                else:  # Last image
                    carousel_sequence_context = f"""
            SEQUENTIAL CAROUSEL IMAGE REQUIREMENTS (Image {carousel_index + 1} of {total_carousel_images} - FINAL):{theme_context}
            - This is the FINAL image in a {total_carousel_images}-part sequential carousel story
            - MUST maintain visual consistency with all previous images: {', '.join(previous_prompts[:3]) if previous_prompts else 'N/A'}
            - Conclude the narrative and provide a satisfying ending to the carousel story
            - Use the SAME color palette, visual style, and composition approach as all previous images
            - Create visual continuity: similar lighting, color tones, design elements, and mood
            - Include a call-to-action or conclusion element that wraps up the story
            - The image should feel like a natural conclusion to the carousel sequence
            - Complete the visual narrative while maintaining consistency with images 1, 2, and 3
            """
            
            prompt = f"""
            Create a detailed image prompt for a social media post on {platform}.
            
            Post content: {content}
            Platform: {platform}
            Image style: {image_style.value if image_style else 'realistic'}
            Business: {business_name}
            Industry: {', '.join(user_profile.get('industry', []))}
            Brand voice: {user_profile.get('brand_voice', 'Professional')}
            
            {brand_colors_context}
            
            {carousel_sequence_context if is_sequential_carousel else ''}
            
            Generate a detailed, specific prompt that will create an engaging image for this social media post.
            The prompt should be optimized for {image_style.value if image_style else 'realistic'} style and suitable for {platform} audience.
            Include specific visual elements, composition, lighting, and mood.
            CRITICALLY IMPORTANT: The image MUST use the specified brand colors as the primary color scheme.
            {'CRITICALLY IMPORTANT: Maintain visual consistency and narrative flow with previous carousel images.' if is_sequential_carousel else ''}
            Keep it under 500 characters for API limits.
            """
            
            try:
                response = genai.GenerativeModel(self.gemini_model).generate_content(
                    contents=f"""You are an expert at creating detailed image prompts for AI image generation. Create specific, visual prompts that will generate high-quality images for social media content.

{prompt}"""
                )
                
                if response and hasattr(response, 'text') and response.text:
                    image_prompt = response.text.strip()
                    state["image_prompt"] = image_prompt
                    state["status"] = "generating"
                    
                    logger.info(f"Generated image prompt: {image_prompt[:100]}...")
                    return state
                else:
                    logger.error("Empty response from Gemini model")
                    raise Exception("Empty response from Gemini model")
                    
            except Exception as gemini_error:
                logger.error(f"Gemini API error in prompt generation: {str(gemini_error)}")
                # Fallback to a simple prompt if Gemini fails
                post_data = state["post_data"]
                content = post_data.get("content", "Social media post")
                platform = post_data.get("platform", "social media")
                image_style = state.get("image_style", Style.REALISTIC)
                
                # Check if this is a sequential carousel
                is_sequential_carousel = post_data.get("is_sequential_carousel", False)
                carousel_index = post_data.get("carousel_index", 0)
                total_carousel_images = post_data.get("total_carousel_images", 4)
                previous_prompts = post_data.get("previous_carousel_prompts", [])
                
                # Get user profile for fallback prompt
                user_profile = self._get_user_profile(state["user_id"])
                business_name = user_profile.get('business_name', 'Unknown')
                primary_color = user_profile.get('primary_color', '')
                secondary_color = user_profile.get('secondary_color', '')
                
                # Create fallback prompt with brand colors context
                color_context = ""
                if primary_color:
                    color_context = f" Use primary brand color {primary_color}"
                if secondary_color:
                    color_context += f" and secondary color {secondary_color}"
                
                # Add carousel sequence context to fallback
                carousel_context = ""
                if is_sequential_carousel:
                    if carousel_index == 0:
                        carousel_context = f" First image of {total_carousel_images}-part carousel story. Opening scene."
                    elif carousel_index < total_carousel_images - 1:
                        carousel_context = f" Image {carousel_index + 1} of {total_carousel_images}-part carousel. Continue story with visual consistency."
                    else:
                        carousel_context = f" Final image of {total_carousel_images}-part carousel. Conclude story with visual consistency."
                
                fallback_prompt = f"Professional {image_style.value if image_style else 'realistic'} {platform} post image for {business_name} featuring: {content[:100]}.{color_context}{carousel_context}"
                
                state["image_prompt"] = fallback_prompt
                state["status"] = "generating"
                
                logger.warning(f"Using fallback prompt due to Gemini error: {fallback_prompt}")
                logger.info(f"Fallback prompt set successfully: {fallback_prompt[:100]}...")
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
                business_name = user_profile.get('business_name', 'Unknown')
                primary_color = user_profile.get('primary_color', '')
                secondary_color = user_profile.get('secondary_color', '')
                
                # Create fallback prompt with brand colors context
                color_context = ""
                if primary_color:
                    color_context = f" Use primary brand color {primary_color}"
                if secondary_color:
                    color_context += f" and secondary color {secondary_color}"
                
                image_prompt = f"Professional {platform} post image for {business_name} featuring: {content[:100]}.{color_context}"
                
                logger.warning(f"Using fallback image prompt: {image_prompt}")
            
            image_size = state.get("image_size", ImageSize.SQUARE_1024)
            
            start_time = datetime.now()
            
            # Get user profile for brand colors
            user_profile = self._get_user_profile(state["user_id"])
            primary_color = user_profile.get('primary_color', '')
            secondary_color = user_profile.get('secondary_color', '')
            additional_colors = user_profile.get('additional_colors', [])
            
            # Build brand colors instruction
            brand_colors_instruction = ""
            if primary_color or secondary_color or (additional_colors and any([c for c in additional_colors if c])):
                colors_section = []
                if primary_color:
                    colors_section.append(f"Primary: {primary_color}")
                if secondary_color:
                    colors_section.append(f"Secondary: {secondary_color}")
                if additional_colors and isinstance(additional_colors, list):
                    additional_list = [c for c in additional_colors if c]
                    if additional_list:
                        colors_section.append(f"Additional: {', '.join(additional_list)}")
                
                brand_colors_instruction = f"""
CRITICAL BRAND COLOR REQUIREMENTS (MUST FOLLOW):
- PRIMARY COLOR: Use {primary_color} as the dominant color in the design
- SECONDARY COLOR: Use {secondary_color} as accent colors
{f"- ADDITIONAL COLORS: {', '.join([c for c in additional_colors if c])}" if additional_colors and any([c for c in additional_colors if c]) else ""}
- The image MUST primarily use these exact brand colors in the color palette
- Primary color should dominate backgrounds, main elements, or key visual areas
- Secondary color should be used for accents, highlights, borders, or complementary elements
- Create visual harmony using this specific brand color scheme
- Do NOT deviate from these brand colors - maintain strict brand consistency
- Apply these colors to backgrounds, text, graphics, borders, or any visual elements as appropriate
"""
            
            # Generate image using Gemini 2.5 Flash Image Preview
            
            try:
                # Prepare contents for Gemini API call
                contents = []
                
                # Add structured text prompt for image generation
                gemini_prompt = f"""
You are a professional graphic designer and image generator. Create a high-quality social media post image based on the following requirements.

IMAGE GENERATION PROMPT: {image_prompt}

{brand_colors_instruction}

DESIGN REQUIREMENTS:
1. Generate a NEW IMAGE that matches the prompt description
2. Create a visually appealing, professional image suitable for social media
3. Use high resolution and professional quality
4. Ensure the image is engaging and eye-catching
5. Apply modern design principles and good composition
6. Use appropriate colors, lighting, and visual elements - MUST follow brand color requirements above
7. Make sure the image tells a story and conveys the intended message
8. Ensure the image is optimized for social media platforms
9. Create a cohesive and professional design that reflects the brand identity
10. OUTPUT: Return the final generated image, not text description

TECHNICAL SPECIFICATIONS:
- High resolution and professional quality
- Suitable for social media posting
- Engaging and visually appealing
- Professional composition and lighting
- Clear and impactful visual elements
- Brand colors must be prominently and correctly applied

QUALITY CONTROL:
✓ Image is high quality and professional
✓ Composition is well-balanced and engaging
✓ Brand colors are correctly and prominently used throughout
✓ Colors and lighting are appropriate
✓ Image conveys the intended message
✓ Suitable for social media platforms
✓ Brand consistency maintained through color usage

OUTPUT: A single, professionally designed image that matches the prompt requirements with high visual quality and strict adherence to brand colors.
"""
                
                contents.append(gemini_prompt)
                
                # Use Gemini's native image generation capability
                logger.info(f"Calling Gemini model: {self.gemini_image_model}")
                logger.info(f"Prompt length: {len(gemini_prompt)} characters")
                
                response = genai.GenerativeModel(self.gemini_image_model).generate_content(
                    contents=contents,
                )
                
                # Extract the generated image from the response
                image_data = None
                logger.info(f"Gemini response received: {len(response.candidates) if response.candidates else 0} candidates")
                logger.info(f"Response type: {type(response)}")
                
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    logger.info(f"Processing candidate with {len(candidate.content.parts) if candidate.content.parts else 0} parts")
                    
                    for i, part in enumerate(candidate.content.parts):
                        logger.info(f"Part {i}: inline_data={part.inline_data is not None}, text={hasattr(part, 'text') and bool(part.text)}")
                        if part.inline_data is not None and part.inline_data.data:
                            image_data = part.inline_data.data
                            logger.info(f"Found image data in part {i}: {len(image_data)} bytes")
                            break
                        elif hasattr(part, 'text') and part.text:
                            logger.info(f"Part {i} contains text: {part.text[:100]}...")
                else:
                    logger.warning("No candidates in Gemini response")
                
                if not image_data:
                    logger.error("No image data found in Gemini response")
                    logger.error(f"Response structure: candidates={len(response.candidates) if response.candidates else 0}")
                    
                    # Try to get any text response for debugging
                    if response.candidates and len(response.candidates) > 0:
                        candidate = response.candidates[0]
                        logger.error(f"Candidate structure: content={hasattr(candidate, 'content')}, parts={len(candidate.content.parts) if hasattr(candidate, 'content') and candidate.content.parts else 0}")
                        
                        if candidate.content.parts:
                            text_content = ""
                            for i, part in enumerate(candidate.content.parts):
                                logger.error(f"Part {i}: inline_data={hasattr(part, 'inline_data') and part.inline_data is not None}, text={hasattr(part, 'text') and bool(part.text)}")
                                if hasattr(part, 'text') and part.text:
                                    text_content += part.text
                            logger.error(f"Gemini text response: {text_content[:500]}...")
                    raise Exception("No image data returned from Gemini")
                
                # Gemini returns image data as bytes, not base64
                if isinstance(image_data, bytes):
                    image_bytes = image_data
                else:
                    # If it's base64 string, decode it
                    image_bytes = base64.b64decode(image_data)
                
                # Upload the image bytes directly to Supabase storage
                logger.info(f"Uploading image bytes: {len(image_bytes)} bytes")
                storage_url = await self._upload_image_bytes(image_bytes, state["post_id"])
                logger.info(f"Image uploaded successfully: {storage_url}")
                
                # Track token usage for Gemini image generation
                # Note: Gemini doesn't provide usage object, so we track with estimated values
                user_id = state.get("user_id")
                if user_id:
                    # Create a mock response object for tracking
                    class MockGeminiResponse:
                        def __init__(self):
                            self.id = getattr(response, 'model_name', 'gemini-2.5-flash-image-preview')
                            self.data = [{"url": storage_url}]
                            self.usage = None  # Gemini doesn't provide usage
                    
                    mock_response = MockGeminiResponse()
                    await self.token_tracker.track_image_generation_usage(
                        user_id=user_id,
                        feature_type="image_generation",
                        model_name=self.gemini_image_model,  # Use actual model name: gemini-2.5-flash-image-preview
                        response=mock_response,
                        image_count=1,
                        image_size=str(image_size),
                        request_metadata={
                            "post_id": state["post_id"],
                            "prompt": image_prompt[:200] if len(image_prompt) > 200 else image_prompt,
                            "size": str(image_size),
                            "service": "gemini"
                        }
                    )
                
            except Exception as api_error:
                logger.error(f"Error generating image with Gemini: {str(api_error)}")
                logger.error(f"API Error details: {type(api_error).__name__}: {str(api_error)}")
                
                # Check if it's a configuration issue
                if "API key" in str(api_error).lower() or "authentication" in str(api_error).lower():
                    logger.error("Gemini API key issue detected - check GEMINI_API_KEY environment variable")
                    raise Exception(f"Gemini API configuration error: {str(api_error)}")
                elif "quota" in str(api_error).lower() or "limit" in str(api_error).lower():
                    logger.error("Gemini API quota exceeded")
                    raise Exception(f"Gemini API quota exceeded: {str(api_error)}")
                else:
                    # Try DALL-E as fallback if available
                    logger.warning("Gemini failed, trying DALL-E as fallback...")
                    try:
                        storage_url = await self._generate_with_dalle(image_prompt, image_size, state["post_id"], state.get("user_id"))
                        logger.info(f"DALL-E fallback successful: {storage_url}")
                        # Update metadata for DALL-E
                        state["generation_model"] = "dall-e-3"
                        state["generation_service"] = "openai_dalle"
                        state["generated_image_url"] = storage_url
                        state["generation_cost"] = self._calculate_generation_cost(image_size, "standard")
                        state["generation_time"] = int((datetime.now() - start_time).total_seconds())
                        state["status"] = "completed"
                    except Exception as dalle_error:
                        logger.error(f"DALL-E fallback also failed: {str(dalle_error)}")
                        # Final fallback to placeholder
                        logger.warning("Falling back to generated placeholder image")
                        storage_url = await self._generate_fallback_image(image_prompt, image_size, state["post_id"])
                        # Update metadata for fallback
                        state["generation_model"] = "fallback_placeholder"
                        state["generation_service"] = "internal_fallback"
                        state["generated_image_url"] = storage_url
                        state["generation_cost"] = 0
                        state["generation_time"] = int((datetime.now() - start_time).total_seconds())
                        state["status"] = "completed"
            
            end_time = datetime.now()
            generation_time = int((end_time - start_time).total_seconds())
            
            if not storage_url:
                raise Exception("No image URL generated")
            
            # Calculate cost (approximate)
            cost = self._calculate_generation_cost(image_size, "standard")
            
            state["generated_image_url"] = storage_url
            state["generation_cost"] = cost
            state["generation_time"] = generation_time
            state["generation_model"] = "gemini-2.5-flash-image-preview"
            state["generation_service"] = "google_gemini"
            state["status"] = "completed"
            
            logger.info(f"✅ Image generation completed successfully: {storage_url}")
            
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
                logger.error("No image URL to save - image generation failed")
                logger.error(f"State keys: {list(state.keys())}")
                logger.error(f"Error message: {state.get('error_message', 'No error message')}")
                
                # Try to generate a fallback image
                try:
                    logger.warning("Attempting to generate fallback image...")
                    fallback_url = await self._generate_fallback_image(
                        state.get("image_prompt", "Social media post"), 
                        state.get("image_size", ImageSize.SQUARE_1024), 
                        post_data["id"]
                    )
                    state["generated_image_url"] = fallback_url
                    state["generation_model"] = "fallback_placeholder"
                    state["generation_service"] = "internal_fallback"
                    logger.info(f"Fallback image generated: {fallback_url}")
                except Exception as fallback_error:
                    logger.error(f"Fallback image generation also failed: {fallback_error}")
                    raise Exception("No image URL to save - all generation methods failed")
            
            if not state.get("image_prompt"):
                logger.warning("No image prompt found, creating fallback prompt...")
                # Create a fallback prompt based on post data
                post_content = post_data.get("content", "Social media post")
                platform = post_data.get("platform", "social media")
                business_name = post_data.get("business_name", "Business")
                
                fallback_prompt = f"Professional {platform} post image featuring: {post_content[:100]}"
                state["image_prompt"] = fallback_prompt
                logger.info(f"Created fallback prompt: {fallback_prompt}")
            
            # Check if image already exists for this post
            existing_images = self.supabase.table("content_images").select("id").eq("post_id", post_data["id"]).order("created_at", desc=True).limit(1).execute()
            
            image_data = {
                "image_url": state["generated_image_url"],
                "image_prompt": state["image_prompt"],
                "image_style": state.get("image_style", Style.REALISTIC).value if state.get("image_style") else "realistic",
                "image_size": state.get("image_size", ImageSize.SQUARE_1024).value if state.get("image_size") else "1024x1024",
                "image_quality": "standard",
                "generation_model": state.get("generation_model", "unknown"),
                "generation_service": state.get("generation_service", "unknown"),
                "generation_cost": state.get("generation_cost", 0),
                "generation_time": state.get("generation_time", 0),
                "is_approved": False
            }
            
            # Save to content_images (temporary - for migration period)
            if existing_images.data and len(existing_images.data) > 0:
                # Update existing image
                image_id = existing_images.data[0]["id"]
                response = self.supabase.table("content_images").update(image_data).eq("id", image_id).execute()
            else:
                # Create new image record
                image_data["post_id"] = post_data["id"]
                response = self.supabase.table("content_images").insert(image_data).execute()
            
            # Update content_posts with primary image data
            # Always update primary_image_url with the newly generated image
            # This ensures the latest generated image is shown, even if not yet approved
            post_id = post_data["id"]
            is_approved = image_data.get("is_approved", False)
            generated_image_url = state["generated_image_url"]
            
            logger.info(f"Updating content_posts.primary_image_url for post {post_id} with new image: {generated_image_url}")
            
            # Always set the newly generated image as primary
            # This ensures users see the latest generated image when they refresh
            update_data = {
                "primary_image_url": generated_image_url,
                "primary_image_prompt": state["image_prompt"],
                "primary_image_approved": is_approved
            }
            
            try:
                # Force update primary_image_url - this should always happen for newly generated images
                logger.info(f"🔧 Attempting to update content_posts.primary_image_url for post {post_id}")
                logger.info(f"🔧 Update data: {update_data}")
                
                update_response = self.supabase.table("content_posts").update(update_data).eq("id", post_id).execute()
                logger.info(f"🔧 Update response: {update_response}")
                
                # Always verify the update succeeded with a small delay
                import time
                time.sleep(0.1)  # Small delay to ensure database write completes
                
                verify_response = self.supabase.table("content_posts").select("primary_image_url, primary_image_approved").eq("id", post_id).execute()
                if verify_response.data and len(verify_response.data) > 0:
                    current_url = verify_response.data[0].get("primary_image_url")
                    current_approved = verify_response.data[0].get("primary_image_approved")
                    
                    if current_url == generated_image_url:
                        logger.info(f"✅ VERIFIED: content_posts.primary_image_url successfully updated for post {post_id}")
                        logger.info(f"✅ Current URL: {current_url}")
                        logger.info(f"✅ Approved status: {current_approved}")
                    else:
                        logger.error(f"❌ VERIFICATION FAILED for post {post_id}")
                        logger.error(f"❌ Expected: {generated_image_url}")
                        logger.error(f"❌ Got: {current_url}")
                        # Try one more time with explicit update
                        logger.warning(f"🔄 Retrying update for post {post_id}")
                        retry_response = self.supabase.table("content_posts").update({
                            "primary_image_url": generated_image_url
                        }).eq("id", post_id).execute()
                        logger.info(f"🔄 Retry response: {retry_response}")
                else:
                    logger.error(f"❌ Could not verify update - no data returned for post {post_id}")
                    
                if update_response.data and len(update_response.data) > 0:
                    logger.info(f"✅ Successfully updated content_posts.primary_image_url for post {post_id}")
                    logger.info(f"Updated post data: {update_response.data[0]}")
                else:
                    logger.warning(f"⚠️ Update response has no data for post {post_id}")
            except Exception as update_error:
                logger.error(f"❌ Error updating content_posts for post {post_id}: {str(update_error)}")
                logger.error(f"❌ Error type: {type(update_error)}")
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                # Don't raise - allow the image to be saved even if primary update fails
                # The image is still in content_images table
            
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

    async def _upload_image_bytes(self, image_bytes: bytes, post_id: str) -> str:
        """Upload image bytes directly to Supabase storage"""
        try:
            # Generate unique filename
            filename = f"{post_id}_generated_{uuid.uuid4().hex[:8]}.png"
            file_path = f"generated/{filename}"
            
            # Upload to Supabase storage
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_bytes,
                file_options={"content-type": "image/png"}
            )
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload image: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            
            logger.info(f"Successfully uploaded image to Supabase: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading image bytes: {str(e)}")
            raise Exception(f"Failed to upload image: {str(e)}")

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
            import httpx
            
            # Download the image
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url, timeout=30.0)
                response.raise_for_status()
                image_bytes = response.content
            
            # Upload to Supabase
            return await self._upload_image_bytes(image_bytes, post_id)
            
        except Exception as e:
            logger.error(f"Error downloading and uploading image: {str(e)}")
            raise Exception(f"Failed to download and upload image: {str(e)}")

    async def _download_and_upload_image_old(self, image_url: str, post_id: str) -> str:
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
    
    async def _generate_with_dalle(self, prompt: str, image_size: ImageSize, post_id: str, user_id: str = None) -> str:
        """Generate image using DALL-E as fallback"""
        try:
            import openai
            
            # Check if OpenAI API key is available
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                raise Exception("OpenAI API key not available for DALL-E fallback")
            
            # Configure OpenAI
            client = openai.AsyncOpenAI(api_key=openai_api_key)
            
            # Convert image size to DALL-E format
            dalle_size = "1024x1024"  # DALL-E 3 only supports 1024x1024
            if hasattr(image_size, 'value'):
                size_str = image_size.value
            else:
                size_str = str(image_size) if image_size else '1024x1024'
            
            # Generate image with DALL-E
            response = await client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size=dalle_size,
                quality="standard",
                n=1
            )
            
            # Track token usage
            if user_id:
                # Determine model name based on size (DALL-E 3 HD for 1024x1792)
                model_name = "dall-e-3-hd" if "1792" in dalle_size else "dall-e-3"
                await self.token_tracker.track_image_generation_usage(
                    user_id=user_id,
                    feature_type="image_generation",
                    model_name=model_name,
                    response=response,
                    image_count=1,
                    image_size=dalle_size,
                    request_metadata={
                        "post_id": post_id,
                        "prompt": prompt[:200] if len(prompt) > 200 else prompt,
                        "size": dalle_size,
                        "quality": "standard"
                    }
                )
            
            image_url = response.data[0].url
            
            # Download and upload to Supabase
            storage_url = await self._download_and_upload_image(image_url, post_id)
            
            logger.info(f"DALL-E generated image successfully: {storage_url}")
            return storage_url
            
        except Exception as e:
            logger.error(f"Error generating image with DALL-E: {str(e)}")
            raise Exception(f"DALL-E generation failed: {str(e)}")

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
            
            # Upload to Supabase storage using the new method
            return await self._upload_image_bytes(image_bytes, post_id)
            
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
                "generation_model": result.get("generation_model"),
                "generation_service": result.get("generation_service"),
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
