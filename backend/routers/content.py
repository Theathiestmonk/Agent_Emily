from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional
import os
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Get Supabase client
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

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

# Content update model
class ContentUpdate(BaseModel):
    title: str
    content: str
    hashtags: List[str]
    scheduled_date: str
    scheduled_time: str
    status: str

# Content status update model
class ContentStatusUpdate(BaseModel):
    status: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required"
            )
        
        # Extract token
        token = authorization.split(" ")[1]
        
        # Try to get user info from Supabase using the token
        try:
            user_response = supabase.auth.get_user(token)
            
            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_data = user_response.user
                return User(
                    id=user_data.id,
                    email=user_data.email or "unknown@example.com",
                    name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                    created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token or user not found"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

router = APIRouter(prefix="/content", tags=["content"])

@router.get("/test")
async def test_content_router():
    """Test endpoint to verify content router is working"""
    return {"message": "Content router is working!", "status": "success"}

@router.get("/scheduled")
async def get_scheduled_content(
    current_user: User = Depends(get_current_user)
):
    """Get scheduled content for the current day"""
    try:
        # Get today's date
        today = datetime.now()
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Query Supabase for scheduled content from content_posts table
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).gte("scheduled_date", today_start.date().isoformat()).lte("scheduled_date", today_end.date().isoformat()).order("scheduled_date").execute()
        
        content_items = response.data if response.data else []
        
        # Format response
        formatted_content = []
        for item in content_items:
            platform_value = item.get("platform", "unknown")
            
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": platform_value,
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": None,  # Will be populated from content_images if needed
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "date": today.strftime("%Y-%m-%d"),
            "count": len(formatted_content)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch scheduled content: {str(e)}"
        )

@router.get("/all")
async def get_all_content(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """Get all content for the user"""
    try:
        # Query Supabase for all content from content_posts table
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).order("scheduled_date", desc=True).range(offset, offset + limit - 1).execute()
        
        content_items = response.data if response.data else []
        
        # Format response
        formatted_content = []
        for item in content_items:
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": item.get("platform", "unknown"),
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": None,  # Will be populated from content_images if needed
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "count": len(formatted_content),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch content: {str(e)}"
        )

@router.get("/by-date")
async def get_content_by_date(
    date: str,
    current_user: User = Depends(get_current_user)
):
    """Get content for a specific date"""
    try:
        # Parse the date
        try:
            target_date = datetime.fromisoformat(date).date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD format."
            )
        
        # Query Supabase for content on the specific date
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).eq("scheduled_date", target_date.isoformat()).order("scheduled_time").execute()
        
        content_items = response.data if response.data else []
        
        # Format response
        formatted_content = []
        for item in content_items:
            platform_value = item.get("platform", "unknown")
            
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": platform_value,
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": None,  # Will be populated from content_images if needed
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "date": target_date.isoformat(),
            "count": len(formatted_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch content for date {date}: {str(e)}"
        )

@router.put("/update/{content_id}")
async def update_content(
    content_id: str,
    update_data: ContentUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update content by ID"""
    try:
        # Convert Pydantic model to dict
        update_dict = update_data.dict()
        
        # First verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", content_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        # Update the content
        update_response = supabase_admin.table("content_posts").update({
            "title": update_dict["title"],
            "content": update_dict["content"],
            "hashtags": update_dict["hashtags"],
            "scheduled_date": update_dict["scheduled_date"],
            "scheduled_time": update_dict["scheduled_time"],
            "status": update_dict["status"]
        }).eq("id", content_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update content"
            )
        
        updated_content = update_response.data[0]
        
        return {
            "success": True,
            "message": "Content updated successfully",
            "content": {
                "id": updated_content["id"],
                "title": updated_content["title"],
                "content": updated_content["content"],
                "platform": updated_content["platform"],
                "scheduled_at": f"{updated_content['scheduled_date']}T{updated_content['scheduled_time']}",
                "status": updated_content["status"],
                "hashtags": updated_content["hashtags"],
                "updated_at": updated_content["updated_at"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update content: {str(e)}"
        )

@router.put("/update-status/{content_id}")
async def update_content_status(
    content_id: str,
    status_data: ContentStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update content status by ID"""
    try:
        # First verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", content_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        # Update only the status
        update_response = supabase_admin.table("content_posts").update({
            "status": status_data.status
        }).eq("id", content_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update content status"
            )
        
        updated_content = update_response.data[0]
        
        return {
            "success": True,
            "message": "Content status updated successfully",
            "content": {
                "id": updated_content["id"],
                "status": updated_content["status"],
                "updated_at": updated_content["updated_at"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update content status: {str(e)}"
        )

@router.delete("/{content_id}")
async def delete_content(
    content_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete content post and associated images"""
    try:
        # First verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", content_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        content = content_response.data[0]
        
        # Delete associated images first
        try:
            # Get all images associated with this content
            images_response = supabase_admin.table("content_images").select("*").eq("post_id", content_id).execute()
            
            if images_response.data:
                # Delete images from Supabase storage if they exist
                for image in images_response.data:
                    if image.get("image_url"):
                        try:
                            # Extract file path from URL for storage deletion
                            image_url = image["image_url"]
                            if "ai-generated-images" in image_url:
                                # Extract file path from Supabase storage URL
                                file_path = image_url.split("ai-generated-images/")[-1]
                                if file_path:
                                    # Delete from Supabase storage
                                    supabase_admin.storage.from_("ai-generated-images").remove([file_path])
                        except Exception as storage_error:
                            # Continue even if storage deletion fails
                            pass
                
                # Delete image records from database
                supabase_admin.table("content_images").delete().eq("post_id", content_id).execute()
                
        except Exception as image_error:
            # Continue with content deletion even if image deletion fails
            pass
        
        # Delete the content post
        delete_response = supabase_admin.table("content_posts").delete().eq("id", content_id).execute()
        
        if not delete_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete content"
            )
        
        return {
            "success": True,
            "message": "Content and associated images deleted successfully",
            "deleted_content": {
                "id": content_id,
                "title": content.get("title", ""),
                "platform": content.get("platform", ""),
                "deleted_at": datetime.now().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete content: {str(e)}"
        )
