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
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase = create_client(supabase_url, supabase_key)
        self.openai_client = OpenAI(api_key=openai_api_key)
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
            
            # Create image prompt based on ad content
            prompt = f"""
Create a professional, eye-catching advertisement image for:
Platform: {ad_data.get('platform', 'social media')}
Ad Title: {ad_data.get('title', '')}
Ad Copy: {ad_data.get('ad_copy', '')}
Call to Action: {ad_data.get('call_to_action', '')}
Target Audience: {ad_data.get('target_audience', 'general')}
Campaign Objective: {ad_data.get('campaign_objective', 'brand awareness')}

Style: Clean, modern, professional, high-quality
Format: Square for social media
Colors: Brand-appropriate, vibrant but not overwhelming
Text: Minimal text overlay, focus on visual impact
Mood: Engaging, trustworthy, conversion-focused
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
        """Generate image using DALL-E"""
        try:
            prompt = state["image_prompt"]
            size = state["image_size"].value if state["image_size"] else "1024x1024"
            
            logger.info(f"Generating image with prompt: {prompt[:100]}...")
            
            response = self.openai_client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size=size,
                quality="standard",
                n=1
            )
            
            image_url = response.data[0].url
            state["generated_image_url"] = image_url
            state["progress"] = 60
            logger.info("Image generated successfully")
            return state
            
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            state["error"] = str(e)
            return state
    
    async def _upload_to_supabase(self, state: AdsMediaAgentState) -> AdsMediaAgentState:
        """Upload image to Supabase storage"""
        try:
            image_url = state["generated_image_url"]
            if not image_url:
                state["error"] = "No image URL to upload"
                return state
            
            # Download image
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                image_data = response.content
            
            # Generate unique filename
            filename = f"ads/{state['user_id']}/{uuid.uuid4()}.png"
            
            # Upload to Supabase storage
            supabase_admin = self.get_supabase_admin()
            upload_response = supabase_admin.storage.from_("media").upload(
                filename,
                image_data,
                file_options={"content-type": "image/png"}
            )
            
            if upload_response.get("error"):
                raise Exception(f"Upload failed: {upload_response['error']}")
            
            # Get public URL
            public_url = supabase_admin.storage.from_("media").get_public_url(filename)
            state["supabase_image_url"] = public_url
            
            # Store metadata
            state["image_metadata"] = {
                "filename": filename,
                "original_url": image_url,
                "supabase_url": public_url,
                "size": len(image_data),
                "content_type": "image/png",
                "generated_at": datetime.now().isoformat()
            }
            
            state["progress"] = 80
            logger.info(f"Image uploaded to Supabase: {filename}")
            return state
            
        except Exception as e:
            logger.error(f"Error uploading to Supabase: {e}")
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
                "id": f"ad_image_{ad_id}_{int(datetime.now().timestamp())}",
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
