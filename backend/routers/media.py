"""
Media Generation API endpoints
Handles image generation for content posts
"""

import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from supabase import create_client, Client

from routers.connections import get_current_user, User
from agents.media_agent import create_media_agent, ImageStyle, ImageSize

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

# Create client with anon key for user authentication
supabase: Client = create_client(supabase_url, supabase_anon_key)

# Create admin client for database operations
if supabase_service_key:
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)
else:
    supabase_admin = supabase  # Fallback to anon client

# Initialize OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.warning("OpenAI API key not found in environment variables")

class ImageGenerationRequest(BaseModel):
    post_id: str = Field(..., description="ID of the post to generate image for")
    style: Optional[ImageStyle] = Field(None, description="Image style preference")
    size: Optional[ImageSize] = Field(None, description="Image size preference")

class ImageGenerationResponse(BaseModel):
    success: bool
    status: str
    image_url: Optional[str] = None
    cost: Optional[float] = None
    generation_time: Optional[int] = None
    error: Optional[str] = None

class BatchImageGenerationRequest(BaseModel):
    post_ids: List[str] = Field(..., description="List of post IDs to generate images for")
    style: Optional[ImageStyle] = Field(None, description="Default image style for all posts")
    size: Optional[ImageSize] = Field(None, description="Default image size for all posts")

class BatchImageGenerationResponse(BaseModel):
    total_posts: int
    successful: int
    failed: int
    results: List[ImageGenerationResponse]

@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_for_post(
    request: ImageGenerationRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate an image for a specific post"""
    try:
        logger.info(f"Media router: Generating image for post {request.post_id}, user {current_user.id}")
        
        # Verify post belongs to user
        post_response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", request.post_id).execute()
        
        logger.info(f"Media router query response: {post_response}")
        logger.info(f"Media router response data: {post_response.data}")
        
        if not post_response.data:
            logger.error(f"Media router: No post found with ID {request.post_id}")
            raise HTTPException(status_code=404, detail="Post not found")
        
        post_data = post_response.data[0]
        if post_data["content_campaigns"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Create media agent
        if not openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        media_agent = create_media_agent(supabase_url, supabase_service_key or supabase_anon_key, openai_api_key)
        
        # Generate image
        result = await media_agent.generate_media_for_post(request.post_id)
        
        return ImageGenerationResponse(**result)
        
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating image: {str(e)}")

@router.post("/generate/batch", response_model=BatchImageGenerationResponse)
async def generate_images_for_posts(
    request: BatchImageGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Generate images for multiple posts in batch"""
    try:
        # Verify all posts belong to user
        posts_response = supabase_admin.table("content_posts").select("id, content_campaigns!inner(*)").in_("id", request.post_ids).execute()
        
        if not posts_response.data:
            raise HTTPException(status_code=404, detail="No posts found")
        
        # Check ownership
        user_posts = [post for post in posts_response.data if post["content_campaigns"]["user_id"] == current_user.id]
        if len(user_posts) != len(request.post_ids):
            raise HTTPException(status_code=403, detail="Some posts don't belong to you")
        
        # Create media agent
        if not openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        media_agent = create_media_agent(supabase_url, supabase_service_key or supabase_anon_key, openai_api_key)
        
        # Generate images for each post
        results = []
        successful = 0
        failed = 0
        
        for post_id in request.post_ids:
            try:
                result = await media_agent.generate_media_for_post(post_id)
                results.append(ImageGenerationResponse(**result))
                
                if result["success"]:
                    successful += 1
                else:
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Error generating image for post {post_id}: {str(e)}")
                results.append(ImageGenerationResponse(
                    success=False,
                    status="failed",
                    error=str(e)
                ))
                failed += 1
        
        return BatchImageGenerationResponse(
            total_posts=len(request.post_ids),
            successful=successful,
            failed=failed,
            results=results
        )
        
    except Exception as e:
        logger.error(f"Error in batch image generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in batch generation: {str(e)}")

@router.get("/posts/{post_id}/images")
async def get_post_images(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all generated images for a specific post"""
    try:
        # Verify post belongs to user
        post_response = supabase_admin.table("content_posts").select("id, content_campaigns!inner(*)").eq("id", post_id).execute()
        
        if not post_response.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        if post_response.data[0]["content_campaigns"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get images for the post
        images_response = supabase_admin.table("content_images").select("*").eq("post_id", post_id).execute()
        
        return {
            "post_id": post_id,
            "images": images_response.data,
            "total": len(images_response.data)
        }
        
    except Exception as e:
        logger.error(f"Error fetching post images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching images: {str(e)}")

@router.get("/user/images")
async def get_user_images(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get all generated images for the current user"""
    try:
        # Get user's posts first
        posts_response = supabase_admin.table("content_posts").select("id, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).execute()
        
        if not posts_response.data:
            return {
                "images": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        post_ids = [post["id"] for post in posts_response.data]
        
        # Get images for user's posts
        images_response = supabase_admin.table("content_images").select("""
            *,
            content_posts!inner(
                id,
                platform,
                title,
                content_campaigns!inner(
                    campaign_name
                )
            )
        """).in_("post_id", post_ids).range(offset, offset + limit - 1).execute()
        
        return {
            "images": images_response.data,
            "total": len(images_response.data),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error fetching user images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching images: {str(e)}")

@router.put("/images/{image_id}/approve")
async def approve_image(
    image_id: str,
    current_user: User = Depends(get_current_user)
):
    """Approve a generated image"""
    try:
        # Verify image belongs to user
        image_response = supabase_admin.table("content_images").select("*, content_posts!inner(content_campaigns!inner(*))").eq("id", image_id).execute()
        
        if not image_response.data:
            raise HTTPException(status_code=404, detail="Image not found")
        
        if image_response.data[0]["content_posts"]["content_campaigns"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update approval status
        update_response = supabase_admin.table("content_images").update({
            "is_approved": True
        }).eq("id", image_id).execute()
        
        if update_response.data:
            return {"success": True, "message": "Image approved successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to approve image")
        
    except Exception as e:
        logger.error(f"Error approving image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error approving image: {str(e)}")

@router.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a generated image"""
    try:
        # Verify image belongs to user
        image_response = supabase_admin.table("content_images").select("*, content_posts!inner(content_campaigns!inner(*))").eq("id", image_id).execute()
        
        if not image_response.data:
            raise HTTPException(status_code=404, detail="Image not found")
        
        if image_response.data[0]["content_posts"]["content_campaigns"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete image
        delete_response = supabase_admin.table("content_images").delete().eq("id", image_id).execute()
        
        if delete_response.data:
            return {"success": True, "message": "Image deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete image")
        
    except Exception as e:
        logger.error(f"Error deleting image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting image: {str(e)}")

@router.get("/styles")
async def get_available_styles():
    """Get available image styles"""
    return {
        "styles": [style.value for style in ImageStyle],
        "sizes": [size.value for size in ImageSize]
    }

@router.get("/stats")
async def get_media_stats(current_user: User = Depends(get_current_user)):
    """Get media generation statistics for the user"""
    try:
        # Get user's posts
        posts_response = supabase_admin.table("content_posts").select("id, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).execute()
        
        if not posts_response.data:
            return {
                "total_posts": 0,
                "posts_with_images": 0,
                "total_images": 0,
                "total_cost": 0.0,
                "average_generation_time": 0
            }
        
        post_ids = [post["id"] for post in posts_response.data]
        
        # Get image statistics
        images_response = supabase_admin.table("content_images").select("""
            generation_cost,
            generation_time
        """).in_("post_id", post_ids).execute()
        
        total_images = len(images_response.data)
        total_cost = sum(img.get("generation_cost", 0) or 0 for img in images_response.data)
        avg_time = sum(img.get("generation_time", 0) or 0 for img in images_response.data) / max(total_images, 1)
        
        return {
            "total_posts": len(posts_response.data),
            "posts_with_images": len(set(img["post_id"] for img in images_response.data)),
            "total_images": total_images,
            "total_cost": round(total_cost, 4),
            "average_generation_time": round(avg_time, 2)
        }
        
    except Exception as e:
        logger.error(f"Error fetching media stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
