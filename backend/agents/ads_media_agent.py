"""
Ads Media Generation Agent using LangGraph
Generates images for ad campaigns using AI image generation and stores them in Supabase storage
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

class AdsMediaAgentState(TypedDict):
    user_id: str
    ad_id: Optional[str]
    ad_data: Optional[Dict[str, Any]]
    image_prompt: Optional[str]
    image_style: Optional[ImageStyle]
    image_size: Optional[ImageSize]
    generated_image_url: Optional[str]
    supabase_image_url: Optional[str]
    image_metadata: Optional[Dict[str, Any]]
    error: Optional[str]
    progress: int

class AdsMediaAgent:
    def __init__(self, supabase_url: str, supabase_key: str, gemini_api_key: str):
        self.supabase = create_client(supabase_url, supabase_key)
        
        if not gemini_api_key:
            raise ValueError("Google Gemini API key is required")
        
        # Configure Gemini API
        genai.configure(api_key=gemini_api_key)
        self.gemini_model = 'gemini-2.5-flash'  # Use stable model for text generation
        self.gemini_image_model = 'gemini-2.5-flash-image-preview'  # Use preview model for image generation
        
        self.graph = self._build_graph()
    
    def get_supabase_admin(self):
        """Get Supabase admin client for database operations"""
        return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow for ads media generation"""
        workflow = StateGraph(AdsMediaAgentState)
        
        # Add nodes
        workflow.add_node("initialize", self._initialize)
        workflow.add_node("fetch_ad_data", self._fetch_ad_data)
        workflow.add_node("generate_image_prompt", self._generate_image_prompt)
        workflow.add_node("generate_image", self._generate_image)
        workflow.add_node("upload_to_supabase", self._upload_to_supabase)
        workflow.add_node("update_ad_media", self._update_ad_media)
        workflow.add_node("error_handler", self._error_handler)
        
        # Add edges
        workflow.set_entry_point("initialize")
        workflow.add_edge("initialize", "fetch_ad_data")
        workflow.add_edge("fetch_ad_data", "generate_image_prompt")
        workflow.add_edge("generate_image_prompt", "generate_image")
        workflow.add_edge("generate_image", "upload_to_supabase")
        workflow.add_edge("upload_to_supabase", "update_ad_media")
        workflow.add_edge("update_ad_media", END)
        workflow.add_edge("error_handler", END)
        
        return workflow.compile()
    
    async def _initialize(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Initialize the ads media generation process"""
        try:
            logger.info(f"Initializing ads media generation for user: {state['user_id']}")
            state["progress"] = 10
            return state
        except Exception as e:
            logger.error(f"Error in initialize: {e}")
            state["error"] = str(e)
            return state
    
    async def _fetch_ad_data(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Fetch ad data from database"""
        try:
            if not state.get("ad_id"):
                state["error"] = "No ad ID provided"
                return state
            
            supabase_admin = self.get_supabase_admin()
            response = supabase_admin.table("ad_copies").select("*").eq("id", state["ad_id"]).execute()
            
            if not response.data:
                state["error"] = "Ad not found"
                return state
            
            state["ad_data"] = response.data[0]
            state["progress"] = 20
            logger.info(f"Fetched ad data for: {state['ad_id']}")
            return state
            
        except Exception as e:
            logger.error(f"Error fetching ad data: {e}")
            state["error"] = str(e)
            return state
    
    async def _generate_image_prompt(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Generate image prompt based on ad data"""
        try:
            ad_data = state["ad_data"]
            user_id = state["user_id"]
            
            # Get user profile for logo context
            user_profile = self._get_user_profile(user_id)
            logo_url = user_profile.get('logo_url', '')
            business_name = user_profile.get('business_name', 'Unknown')
            
            # Create logo context for the prompt
            logo_context = ""
            if logo_url:
                # For DALL-E, we need to describe the logo in the prompt since it doesn't support reference images
                logo_context = f"""
IMPORTANT: This business has a logo that should be prominently featured in the advertisement.
Business logo URL: {logo_url}
The logo should be strategically placed - either as a watermark in the corner, 
integrated into the design, or as a central element depending on the ad content.
Make sure the logo is clearly visible and well-positioned for brand recognition.
Since DALL-E cannot process reference images, create a professional logo design that would be appropriate for {business_name} in the {', '.join(user_profile.get('industry', ['business']))} industry.
"""
            else:
                logo_context = f"""
Note: This business ({business_name}) does not have a logo uploaded yet.
The advertisement should still be professional and branded for {business_name}.
Create a professional logo design that would be appropriate for {business_name} in the {', '.join(user_profile.get('industry', ['business']))} industry.
"""
            
            # Create image prompt based on ad content
            prompt = f"""
Create a professional, eye-catching advertisement image for:
Platform: {ad_data.get('platform', 'social media')}
Ad Title: {ad_data.get('title', '')}
Ad Copy: {ad_data.get('ad_copy', '')}
Call to Action: {ad_data.get('call_to_action', '')}
Target Audience: {ad_data.get('target_audience', 'general')}
Campaign Objective: {ad_data.get('campaign_objective', 'brand awareness')}
Business: {business_name}

{logo_context}

Style: Clean, modern, professional, high-quality
Format: Square for social media
Colors: Brand-appropriate, vibrant but not overwhelming
Text: Minimal text overlay, focus on visual impact
Mood: Engaging, trustworthy, conversion-focused
If a logo is available, ensure it's prominently and tastefully integrated into the design.
"""
            
            state["image_prompt"] = prompt.strip()
            state["image_style"] = ImageStyle.PHOTOGRAPHIC
            state["image_size"] = ImageSize.SQUARE_1024
            state["progress"] = 30
            logger.info("Generated image prompt")
            return state
            
        except Exception as e:
            logger.error(f"Error generating image prompt: {e}")
            state["error"] = str(e)
            return state
    
    async def _generate_image(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Generate image using Gemini 2.5 Flash Image Preview"""
        try:
            # Check if Gemini image model is available
            if not self.gemini_image_model:
                raise Exception("Gemini image model not configured. Please set GEMINI_API_KEY environment variable.")
            
            image_prompt = state.get("image_prompt")
            if not image_prompt:
                state["error"] = "No image prompt available"
                return state
            
            logger.info(f"Generating image with Gemini using prompt: {image_prompt[:100]}...")
            
            # Get user profile and logo for image generation
            user_profile = self._get_user_profile(state["user_id"])
            logo_url = user_profile.get('logo_url', '')
            
            start_time = datetime.now()
            
            try:
                # Prepare contents for Gemini API call
                contents = []
                
                # Add structured text prompt for image generation
                gemini_prompt = f"""
You are a professional graphic designer and image generator. Create a high-quality advertisement image based on the following requirements.

IMAGE GENERATION PROMPT: {image_prompt}

DESIGN REQUIREMENTS:
1. Generate a NEW IMAGE that matches the prompt description
2. Create a visually appealing, professional advertisement image
3. Use high resolution and professional quality
4. Ensure the image is engaging and eye-catching for advertisements
5. Apply modern design principles and good composition
6. Use appropriate colors, lighting, and visual elements
7. Make sure the image tells a story and conveys the intended message
8. Ensure the image is optimized for advertising platforms
9. Create a cohesive and professional design
10. OUTPUT: Return the final generated image, not text description

TECHNICAL SPECIFICATIONS:
- High resolution and professional quality
- Suitable for advertising campaigns
- Engaging and visually appealing
- Professional composition and lighting
- Clear and impactful visual elements

QUALITY CONTROL:
✓ Image is high quality and professional
✓ Composition is well-balanced and engaging
✓ Colors and lighting are appropriate
✓ Image conveys the intended message
✓ Suitable for advertising platforms

OUTPUT: A single, professionally designed advertisement image that matches the prompt requirements with high visual quality.
"""
                
                contents.append(gemini_prompt)
                
                # Add logo image if available
                if logo_url:
                    try:
                        logo_image_data = await self._download_logo_image(logo_url)
                        if logo_image_data:
                            # Add logo as reference image
                            contents.append({
                                "text": "LOGO INTEGRATION: Use this business logo as a reference and integrate it prominently into the generated advertisement image. Place it strategically - either as a watermark in the corner, integrated into the design, or as a central element depending on the content. Make sure the logo is clearly visible and well-positioned for brand recognition."
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
                logger.info(f"Calling Gemini model: {self.gemini_image_model}")
                logger.info(f"Prompt length: {len(gemini_prompt)} characters")
                
                response = genai.GenerativeModel(self.gemini_image_model).generate_content(
                    contents=contents,
                )
                
                # Extract the generated image from the response
                image_data = None
                logger.info(f"Gemini response received: {len(response.candidates) if response.candidates else 0} candidates")
                
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
                    
                    # Check if Gemini returned text with image URLs
                    text_content = ""
                    if response.candidates and len(response.candidates) > 0:
                        candidate = response.candidates[0]
                        if candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, 'text') and part.text:
                                    text_content += part.text
                    
                    if text_content:
                        logger.info(f"Gemini returned text response: {text_content[:200]}...")
                        
                        # Try to extract image URLs from text
                        import re
                        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:jpg|jpeg|png|gif|webp|svg)'
                        image_urls = re.findall(url_pattern, text_content, re.IGNORECASE)
                        
                        if image_urls:
                            logger.info(f"Found {len(image_urls)} image URLs in text response")
                            # Use the first image URL found
                            image_url = image_urls[0]
                            logger.info(f"Downloading image from URL: {image_url}")
                            
                            try:
                                # Download and upload the image
                                storage_url = await self._download_and_upload_image(image_url, state["ad_id"])
                                state["generated_image_url"] = storage_url
                                state["progress"] = 60
                                
                                generation_time = (datetime.now() - start_time).total_seconds()
                                logger.info(f"Image downloaded and uploaded successfully in {generation_time:.2f} seconds")
                                return state
                                
                            except Exception as download_error:
                                logger.error(f"Failed to download image from URL: {download_error}")
                                # Continue to fallback
                        
                        logger.error(f"Gemini text response: {text_content[:500]}...")
                    
                    raise Exception("No image data returned from Gemini")
                
                # Gemini returns image data as bytes, not base64
                if isinstance(image_data, bytes):
                    image_bytes = image_data
                else:
                    # If it's base64 string, decode it
                    image_bytes = base64.b64decode(image_data)
                
                # Upload image bytes directly to Supabase storage
                logger.info(f"Uploading image bytes: {len(image_bytes)} bytes")
                image_url = await self._upload_image_bytes(image_bytes, state["ad_id"])
                
                state["generated_image_url"] = image_url
                state["progress"] = 60
                
                # Calculate generation time
                generation_time = (datetime.now() - start_time).total_seconds()
                logger.info(f"Image generated successfully with Gemini in {generation_time:.2f} seconds")
                
                return state
                
            except Exception as gemini_error:
                logger.error(f"Gemini image generation failed: {gemini_error}")
                # No fallback - let it fail gracefully
                if not state.get("generated_image_url"):
                    state["error"] = f"Gemini image generation failed: {str(gemini_error)}"
                    logger.error("No image generated, failing gracefully")
                else:
                    logger.info("Image was already generated successfully, continuing")
                return state
                
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            # Only set error if no image was generated
            if not state.get("generated_image_url"):
                state["error"] = str(e)
            else:
                logger.info("Image was generated successfully despite error, continuing")
            return state
    
    async def _upload_to_supabase(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Image is already uploaded in _generate_image method, just update state"""
        try:
            # Image is already uploaded directly to Supabase in _generate_image
            # Just update the state with the URL
            image_url = state["generated_image_url"]
            if not image_url:
                logger.error("No image URL available - image generation failed")
                state["error"] = "No image was generated"
                return state
            
            state["supabase_image_url"] = image_url
            
            # Store metadata
            state["image_metadata"] = {
                "filename": f"generated/{state['ad_id']}_generated_{uuid.uuid4().hex[:8]}.png",
                "original_url": image_url,
                "supabase_url": image_url,
                "size": 0,  # Size not available for direct upload
                "content_type": "image/png",
                "generated_at": datetime.now().isoformat(),
                "generation_service": "gemini"
            }
            
            state["progress"] = 80
            logger.info(f"Image URL set in state: {image_url}")
            return state
            
        except Exception as e:
            logger.error(f"Error updating state with image URL: {e}")
            state["error"] = str(e)
            return state
    
    async def _update_ad_media(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Update ad with media URL and metadata"""
        try:
            ad_id = state["ad_id"]
            supabase_url = state["supabase_image_url"]
            metadata = state["image_metadata"]
            
            supabase_admin = self.get_supabase_admin()
            
            # Update ad with media URL
            update_response = supabase_admin.table("ad_copies").update({
                "media_url": supabase_url,
                "metadata": {
                    **state["ad_data"].get("metadata", {}),
                    "image_metadata": metadata
                },
                "updated_at": datetime.now().isoformat()
            }).eq("id", ad_id).execute()
            
            if not update_response.data:
                raise Exception("Failed to update ad with media URL")
            
            # Create ad image record
            image_record = {
                "ad_id": ad_id,
                "image_url": supabase_url,
                "image_prompt": state["image_prompt"],
                "image_style": state["image_style"].value if state["image_style"] else "photographic",
                "image_size": state["image_size"].value if state["image_size"] else "1024x1024",
                "image_quality": "standard",
                "generation_model": "dall-e-3",
                "is_approved": False,
                "created_at": datetime.now().isoformat()
            }
            
            image_response = supabase_admin.table("ad_images").insert(image_record).execute()
            
            if not image_response.data:
                logger.warning("Failed to create ad image record")
            
            state["progress"] = 100
            logger.info(f"Ad media updated successfully: {ad_id}")
            return state
            
        except Exception as e:
            logger.error(f"Error updating ad media: {e}")
            state["error"] = str(e)
            return state
    
    def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile for context"""
        try:
            supabase_admin = self.get_supabase_admin()
            response = supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
            if response.data:
                return response.data[0]
            return {}
        except Exception as e:
            logger.error(f"Error fetching user profile: {str(e)}")
            return {}
    
    async def _error_handler(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Handle errors in the workflow"""
        logger.error(f"Error in ads media generation workflow: {state.get('error')}")
        return state
    
    async def generate_media_for_ad(self, user_id: str, ad_id: str) -> Dict[str, Any]:
        """Generate media for a specific ad"""
        try:
            logger.info(f"Starting media generation for ad: {ad_id}")
            
            # Initialize state
            state = {
                "user_id": user_id,
                "ad_id": ad_id,
                "progress": 0
            }
            
            # Run the workflow
            result = await self.graph.ainvoke(state)
            
            if result.get("error"):
                return {
                    "success": False,
                    "error": result["error"],
                    "progress": result.get("progress", 0)
                }
            
            return {
                "success": True,
                "ad_id": ad_id,
                "media_url": result.get("supabase_image_url"),
                "progress": result.get("progress", 100),
                "metadata": result.get("image_metadata", {})
            }
            
        except Exception as e:
            logger.error(f"Error in generate_media_for_ad: {e}")
            return {
                "success": False,
                "error": str(e),
                "progress": 0
            }
    
    async def generate_media_for_campaign(self, user_id: str, campaign_id: str) -> Dict[str, Any]:
        """Generate media for all ads in a campaign"""
        try:
            logger.info(f"Starting media generation for campaign: {campaign_id}")
            
            supabase_admin = self.get_supabase_admin()
            
            # Get all ads in the campaign
            response = supabase_admin.table("ad_copies").select("id").eq("campaign_id", campaign_id).execute()
            
            if not response.data:
                return {
                    "success": False,
                    "error": "No ads found in campaign",
                    "processed_ads": 0
                }
            
            ad_ids = [ad["id"] for ad in response.data]
            processed_ads = 0
            errors = []
            
            # Generate media for each ad
            for ad_id in ad_ids:
                try:
                    result = await self.generate_media_for_ad(user_id, ad_id)
                    if result["success"]:
                        processed_ads += 1
                    else:
                        errors.append(f"Ad {ad_id}: {result['error']}")
                except Exception as e:
                    errors.append(f"Ad {ad_id}: {str(e)}")
            
            return {
                "success": processed_ads > 0,
                "campaign_id": campaign_id,
                "processed_ads": processed_ads,
                "total_ads": len(ad_ids),
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error in generate_media_for_campaign: {e}")
            return {
                "success": False,
                "error": str(e),
                "processed_ads": 0
            }
    
    async def _download_logo_image(self, logo_url: str) -> Optional[str]:
        """Download logo image and return as base64 string"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(logo_url)
                if response.status_code == 200:
                    image_data = response.content
                    return base64.b64encode(image_data).decode('utf-8')
                else:
                    logger.warning(f"Failed to download logo: HTTP {response.status_code}")
                    return None
        except Exception as e:
            logger.warning(f"Error downloading logo: {e}")
            return None
    
    async def _upload_image_bytes(self, image_bytes: bytes, ad_id: str) -> str:
        """Upload image bytes directly to Supabase storage"""
        try:
            # Generate unique filename
            filename = f"{ad_id}_generated_{uuid.uuid4().hex[:8]}.png"
            file_path = f"generated/{filename}"
            
            # Upload to Supabase storage
            supabase_admin = self.get_supabase_admin()
            storage_response = supabase_admin.storage.from_("ai-generated-images").upload(
                file_path,
                image_bytes,
                file_options={"content-type": "image/png"}
            )
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Failed to upload image: {storage_response.error}")
            
            # Get public URL
            public_url = supabase_admin.storage.from_("ai-generated-images").get_public_url(file_path)
            
            logger.info(f"Successfully uploaded image to Supabase: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading image bytes: {str(e)}")
            raise Exception(f"Failed to upload image: {str(e)}")
    
    async def _download_and_upload_image(self, image_url: str, ad_id: str) -> str:
        """Download image from URL and upload to Supabase storage"""
        try:
            import httpx
            
            # Download the image
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url, timeout=30.0)
                response.raise_for_status()
                image_bytes = response.content
            
            # Upload to Supabase
            return await self._upload_image_bytes(image_bytes, ad_id)
            
        except Exception as e:
            logger.error(f"Error downloading and uploading image: {str(e)}")
            raise Exception(f"Failed to download and upload image: {str(e)}")
