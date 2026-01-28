"""
Simplified Image Editor API - No LangGraph
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.image_editor_service import image_editor_service
from auth import get_current_user
from supabase import create_client, Client
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simple-image-editor", tags=["simple-image-editor"])

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Request Models
class AddLogoRequest(BaseModel):
    user_id: str
    input_image_url: str
    content: str
    position: str = "bottom_right"

class ApplyTemplateRequest(BaseModel):
    user_id: str
    input_image_url: str
    content: str
    template_name: str

class ManualEditRequest(BaseModel):
    user_id: str
    input_image_url: str
    content: str
    instructions: str

class SaveImageRequest(BaseModel):
    user_id: str
    post_id: str
    original_image_url: str
    edited_image_url: str

@router.get("/profiles/{user_id}")
async def get_user_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user profile for image editor"""
    try:
        logger.info(f"Getting profile for user {user_id}")
        
        result = supabase.table('profiles').select('*').eq('id', user_id).execute()
        
        if result.data:
            return result.data[0]
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
            
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add-logo")
async def add_logo(
    request: AddLogoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add logo to image"""
    try:
        logger.info(f"Add logo request for user {request.user_id}")
        result = await image_editor_service.add_logo_to_image(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            position=request.position
        )
        
        if result["success"]:
            return result
        else:
            logger.error(f"Add logo failed: {result['error']}")
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in add_logo endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/apply-template")
async def apply_template(
    request: ApplyTemplateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply template to image"""
    try:
        result = await image_editor_service.apply_template(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            template_name=request.template_name
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in apply_template endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/manual-edit")
async def manual_edit(
    request: ManualEditRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply manual editing instructions"""
    try:
        from middleware.credit_middleware import check_credits_before_action, increment_usage_after_action

        # Check credits before image editing
        await check_credits_before_action(request.user_id, 'image')
        result = await image_editor_service.apply_manual_instructions(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            instructions=request.instructions
        )
        
        if result["success"]:
            # Increment usage after successful image editing
            await increment_usage_after_action(request.user_id, 'image')
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in manual_edit endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-image")
async def save_image(
    request: SaveImageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save edited image by updating the content record with new image URL"""
    try:
        logger.info(f"Saving edited image for user {request.user_id}")
        logger.info(f"Post ID: {request.post_id}")
        logger.info(f"Original URL: {request.original_image_url}")
        logger.info(f"Edited URL: {request.edited_image_url}")

        # Update the images array in the created_content table
        # First, get the current content to see the images array, carousel_images, and metadata
        content_result = supabase.table('created_content').select('images, carousel_images, metadata').eq('id', request.post_id).execute()

        if not content_result.data:
            raise HTTPException(status_code=404, detail="Content post not found")

        content_data = content_result.data[0]
        # Ensure we have lists, not None
        current_images = content_data.get('images') or []
        if not isinstance(current_images, list):
            current_images = []
        current_carousel_images = content_data.get('carousel_images') or []
        if not isinstance(current_carousel_images, list):
            current_carousel_images = []
        current_metadata = content_data.get('metadata') or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        
        logger.info(f"Current images in post {request.post_id}: {current_images}")
        logger.info(f"Current carousel_images in post {request.post_id}: {current_carousel_images}")
        logger.info(f"Current metadata in post {request.post_id}: {current_metadata}")
        logger.info(f"Looking for original URL: {request.original_image_url}")

        # Helper function to compare URLs (ignoring query parameters)
        def url_matches(url1, url2):
            if not url1 or not url2:
                return False
            try:
                url1_base = url1.split('?')[0] if '?' in url1 else url1
                url2_base = url2.split('?')[0] if '?' in url2 else url2
                return url1_base == url2_base or url1 == url2
            except Exception as e:
                logger.warning(f"Error comparing URLs {url1} and {url2}: {e}")
                return False

        # Find and replace in images array
        original_found = False
        updated_images = []

        for img in current_images:
            try:
                # Handle both string URLs and object URLs
                img_url = None
                if isinstance(img, str):
                    img_url = img
                elif isinstance(img, dict):
                    img_url = img.get('image_url') or img.get('url') or str(img)
                else:
                    img_url = str(img) if img else None
                
                if img_url and url_matches(img_url, request.original_image_url):
                    updated_images.append(request.edited_image_url)
                    original_found = True
                    logger.info(f"Found and replaced image in images array: {img_url} -> {request.edited_image_url}")
                else:
                    updated_images.append(img)
            except Exception as e:
                logger.warning(f"Error processing image in images array: {e}")
                updated_images.append(img)

        # Find and replace in carousel_images array
        carousel_updated = False
        updated_carousel_images = []
        
        for img in current_carousel_images:
            try:
                img_url = None
                if isinstance(img, str):
                    img_url = img
                elif isinstance(img, dict):
                    img_url = img.get('url') or img.get('image_url') or str(img)
                else:
                    img_url = str(img) if img else None
                
                if img_url and url_matches(img_url, request.original_image_url):
                    updated_carousel_images.append(request.edited_image_url)
                    carousel_updated = True
                    original_found = True
                    logger.info(f"Found and replaced image in carousel_images array: {img_url} -> {request.edited_image_url}")
                else:
                    updated_carousel_images.append(img)
            except Exception as e:
                logger.warning(f"Error processing image in carousel_images array: {e}")
                updated_carousel_images.append(img)

        # Update metadata.carousel_images if it exists
        metadata_updated = False
        updated_metadata = current_metadata.copy() if isinstance(current_metadata, dict) else {}
        
        if isinstance(updated_metadata, dict):
            # Update metadata.carousel_images
            if 'carousel_images' in updated_metadata and isinstance(updated_metadata['carousel_images'], list):
                updated_metadata_carousel = []
                for img in updated_metadata['carousel_images']:
                    try:
                        img_url = None
                        if isinstance(img, str):
                            img_url = img
                        elif isinstance(img, dict):
                            img_url = img.get('url') or img.get('image_url') or str(img)
                        else:
                            img_url = str(img) if img else None
                        
                        if img_url and url_matches(img_url, request.original_image_url):
                            updated_metadata_carousel.append(request.edited_image_url)
                            metadata_updated = True
                            original_found = True
                            logger.info(f"Found and replaced image in metadata.carousel_images: {img_url} -> {request.edited_image_url}")
                        else:
                            updated_metadata_carousel.append(img)
                    except Exception as e:
                        logger.warning(f"Error processing image in metadata.carousel_images: {e}")
                        updated_metadata_carousel.append(img)
                updated_metadata['carousel_images'] = updated_metadata_carousel
            
            # Update metadata.images if it exists
            if 'images' in updated_metadata and isinstance(updated_metadata['images'], list):
                updated_metadata_images = []
                for img in updated_metadata['images']:
                    try:
                        img_url = None
                        if isinstance(img, str):
                            img_url = img
                        elif isinstance(img, dict):
                            img_url = img.get('url') or img.get('image_url') or str(img)
                        else:
                            img_url = str(img) if img else None
                        
                        if img_url and url_matches(img_url, request.original_image_url):
                            updated_metadata_images.append(request.edited_image_url)
                            metadata_updated = True
                            original_found = True
                            logger.info(f"Found and replaced image in metadata.images: {img_url} -> {request.edited_image_url}")
                        else:
                            updated_metadata_images.append(img)
                    except Exception as e:
                        logger.warning(f"Error processing image in metadata.images: {e}")
                        updated_metadata_images.append(img)
                updated_metadata['images'] = updated_metadata_images

        if original_found:
            # Prepare update data
            update_data = {
                'images': updated_images
            }
            
            # Only update carousel_images if it exists or was modified
            if current_carousel_images and len(current_carousel_images) > 0:
                update_data['carousel_images'] = updated_carousel_images
            
            # Only update metadata if it exists and was modified
            if isinstance(updated_metadata, dict) and updated_metadata:
                update_data['metadata'] = updated_metadata
            
            logger.info(f"Updating database with data: {update_data}")
            update_result = supabase.table('created_content').update(update_data).eq('id', request.post_id).execute()

            if not update_result.data:
                logger.error(f"Update result: {update_result}")
                raise HTTPException(status_code=400, detail="Failed to update images in database")
            
            logger.info(f"Successfully updated image URL for post {request.post_id}")

            # Also update any conversation messages that reference this image
            try:
                # Find conversation messages that contain the old image URL in text
                messages_with_image = supabase.table('atsn_conversation_messages').select('id, text').like('text', f'%{request.original_image_url}%').execute()

                if messages_with_image.data:
                    for message in messages_with_image.data:
                        updated_text = message['text'].replace(request.original_image_url, request.edited_image_url)
                        supabase.table('atsn_conversation_messages').update({
                            'text': updated_text
                        }).eq('id', message['id']).execute()

                    logger.info(f"Updated {len(messages_with_image.data)} conversation messages with image URLs")

                # Also update metadata JSON field if it contains image_url
                metadata_messages = supabase.table('atsn_conversation_messages').select('id, metadata').eq('metadata->>image_url', request.original_image_url).execute()
        
                if metadata_messages.data:
                    for message in metadata_messages.data:
                        updated_metadata = message['metadata'].copy()
                        updated_metadata['image_url'] = request.edited_image_url
                        supabase.table('atsn_conversation_messages').update({
                            'metadata': updated_metadata
                        }).eq('id', message['id']).execute()

                    logger.info(f"Updated {len(metadata_messages.data)} conversation metadata records")

            except Exception as e:
                logger.warning(f"Failed to update conversation messages: {e}")
                # Don't fail the entire operation if conversation update fails

            # ✅ Increment image count after successful editing
            try:
                # Read current image count and increment
                profile_result = supabase.table('profiles').select('images_generated_this_month').eq('id', request.user_id).execute()
                if profile_result.data and len(profile_result.data) > 0:
                    current_image_count = profile_result.data[0]['images_generated_this_month'] or 0
                    supabase.table('profiles').update({
                        'images_generated_this_month': current_image_count + 1
                    }).eq('id', request.user_id).execute()
                    logger.info(f"Incremented image count for user {request.user_id} after successful editing (from {current_image_count} to {current_image_count + 1})")
            except Exception as counter_error:
                logger.error(f"Error incrementing image count after editing: {counter_error}")

        else:
            logger.error(f"Original image not found in any array.")
            logger.error(f"Original URL: {request.original_image_url}")
            logger.error(f"Available images: {current_images}")
            logger.error(f"Available carousel_images: {current_carousel_images}")
            logger.error(f"Available metadata.carousel_images: {updated_metadata.get('carousel_images', [])}")
            logger.error(f"Available metadata.images: {updated_metadata.get('images', [])}")
            raise HTTPException(
                status_code=400, 
                detail=f"Original image not found in content. Original URL: {request.original_image_url}. Please check the logs for available images."
            )

        return {
            "success": True,
            "message": "Image saved successfully! The content has been updated with the edited image.",
            "post_id": request.post_id,
            "new_image_url": request.edited_image_url
        }
            
    except Exception as e:
        logger.error(f"Error in save_image endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
