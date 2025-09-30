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
        result = await image_editor_service.apply_manual_instructions(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            instructions=request.instructions
        )
        
        if result["success"]:
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
    """Save edited image by replacing the original"""
    try:
        result = await image_editor_service.save_edited_image(
            user_id=request.user_id,
            original_image_url=request.original_image_url,
            edited_image_url=request.edited_image_url
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in save_image endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
