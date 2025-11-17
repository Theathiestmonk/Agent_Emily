"""
API endpoints for Custom Content Creation Agent
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.custom_content_agent import CustomContentAgent, CustomContentState, ConversationStep
from auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-content", tags=["custom-content"])

# Initialize the custom content agent
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is required")

custom_content_agent = CustomContentAgent(openai_api_key)
custom_content_graph = custom_content_agent.create_graph()

# In-memory storage for conversation states (in production, use Redis or database)
conversation_states: Dict[str, CustomContentState] = {}

class StartConversationRequest(BaseModel):
    user_id: str

class UserInputRequest(BaseModel):
    conversation_id: str
    user_input: str
    input_type: str = "text"

class MediaUploadRequest(BaseModel):
    conversation_id: str
    filename: str
    content_type: str

@router.post("/start")
async def start_conversation(
    request: StartConversationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Start a new custom content creation conversation"""
    try:
        # Create initial state
        initial_state: CustomContentState = {
            "user_id": request.user_id,
            "conversation_id": "",
            "conversation_messages": [],
            "current_step": ConversationStep.GREET,
            "selected_platform": None,
            "selected_content_type": None,
            "user_description": None,
            "has_media": None,
            "media_type": None,
            "uploaded_media_url": None,
            "should_generate_media": None,
            "generated_content": None,
            "generated_media_url": None,
            "final_post": None,
            "error_message": None,
            "platform_content_types": None,
            "media_requirements": None,
            "user_profile": None,
            "business_context": None,
            "is_complete": False,
            "progress_percentage": 0
        }
        
        # Run only the first step (greet_user) to get the initial greeting
        result = await custom_content_agent.greet_user(initial_state)
        
        # Store the conversation state
        conversation_id = result["conversation_id"]
        conversation_states[conversation_id] = result
        
        return {
            "conversation_id": conversation_id,
            "message": result["conversation_messages"][-1],
            "current_step": result["current_step"],
            "progress_percentage": result["progress_percentage"]
        }
        
    except Exception as e:
        logger.error(f"Error starting conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start conversation: {str(e)}")

@router.post("/input")
async def process_user_input(
    request: UserInputRequest,
    current_user: dict = Depends(get_current_user)
):
    """Process user input in the conversation using LangGraph"""
    try:
        conversation_id = request.conversation_id
        
        # Get conversation state
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Execute the conversation step using LangGraph
        result = await custom_content_agent.execute_conversation_step(
            state, request.user_input
        )
        
        # Update conversation state
        conversation_states[conversation_id] = result
        
        # Return the latest message and state
        latest_message = result["conversation_messages"][-1] if result["conversation_messages"] else {
            "role": "assistant",
            "content": "No message available",
            "timestamp": datetime.now().isoformat()
        }
        
        return {
            "conversation_id": conversation_id,
            "message": latest_message,
            "current_step": result["current_step"],
            "progress_percentage": result.get("progress_percentage", 0),
            "state": {
                "selected_platform": result.get("selected_platform"),
                "selected_content_type": result.get("selected_content_type"),
                "has_media": result.get("has_media"),
                "media_type": result.get("media_type"),
                "is_complete": result.get("is_complete", False),
                "error_message": result.get("error_message")
            }
        }
        
    except Exception as e:
        logger.error(f"Error processing user input: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process input: {str(e)}")

@router.post("/upload-media")
async def upload_media(
    conversation_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload media file for the conversation using LangGraph"""
    try:
        logger.info(f"Upload request received: conversation_id={conversation_id}, filename={file.filename}, content_type={file.content_type}")
        
        # Validate file exists
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Get conversation state
        if conversation_id not in conversation_states:
            logger.error(f"Conversation not found: {conversation_id}")
            raise HTTPException(status_code=404, detail="Conversation not found. Please refresh and try again.")
        
        state = conversation_states[conversation_id]
        logger.info(f"Found conversation state for user: {state.get('user_id')}")
        
        # Validate file size (100MB limit for videos, 10MB for images)
        MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
        MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
        
        # Read file content with size check
        file_content = await file.read()
        file_size = len(file_content)
        logger.info(f"Read file content: {file_size} bytes")
        
        # Check if it's a video or image
        is_video = file.content_type and file.content_type.startswith('video/')
        max_size = MAX_VIDEO_SIZE if is_video else MAX_IMAGE_SIZE
        size_limit_mb = 100 if is_video else 10
        
        if file_size > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File size ({file_size / (1024*1024):.1f}MB) exceeds the maximum allowed size of {size_limit_mb}MB for {'videos' if is_video else 'images'}"
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Upload media using the agent
        updated_state = await custom_content_agent.upload_media(
            state, file_content, file.filename, file.content_type
        )
        logger.info(f"Media upload completed, new step: {updated_state.get('current_step')}")
        
        # Check for errors in the upload state
        if updated_state.get("error_message"):
            logger.error(f"Upload error in state: {updated_state.get('error_message')}")
            raise HTTPException(status_code=500, detail=updated_state.get("error_message"))
        
        # Execute the conversation step using LangGraph
        result = await custom_content_agent.execute_conversation_step(updated_state)
        
        # Update conversation state
        conversation_states[conversation_id] = result
        
        # Get the last message
        last_message = result["conversation_messages"][-1] if result["conversation_messages"] else {
            "role": "assistant",
            "content": "Media uploaded successfully",
            "timestamp": datetime.now().isoformat()
        }
        
        response_data = {
            "conversation_id": conversation_id,
            "message": last_message,
            "current_step": result["current_step"],
            "progress_percentage": result.get("progress_percentage", 0),
            "media_url": result.get("uploaded_media_url"),
            "media_filename": result.get("uploaded_media_filename"),
            "media_size": result.get("uploaded_media_size"),
            "media_type": result.get("uploaded_media_type"),
            "state": {
                "selected_platform": result.get("selected_platform"),
                "selected_content_type": result.get("selected_content_type"),
                "has_media": result.get("has_media"),
                "media_type": result.get("media_type"),
                "is_complete": result.get("is_complete", False),
                "error_message": result.get("error_message")
            }
        }
        
        logger.info(f"Media upload response prepared: {result['current_step']}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error uploading media: {e}", exc_info=True)
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Traceback: {error_traceback}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to upload media. Please check the file size and format, then try again. Error: {str(e)}"
        )

@router.get("/conversation/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation state and messages"""
    try:
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        return {
            "conversation_id": conversation_id,
            "messages": state["conversation_messages"],
            "current_step": state["current_step"],
            "progress_percentage": state["progress_percentage"],
            "state": {
                "selected_platform": state.get("selected_platform"),
                "selected_content_type": state.get("selected_content_type"),
                "has_media": state.get("has_media"),
                "media_type": state.get("media_type"),
                "is_complete": state.get("is_complete"),
                "final_post": state.get("final_post")
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {str(e)}")

@router.post("/conversation/{conversation_id}/continue")
async def continue_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Continue the conversation flow from current step"""
    try:
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Continue the conversation flow
        result = await custom_content_graph.ainvoke(state)
        conversation_states[conversation_id] = result
        
        return {
            "conversation_id": conversation_id,
            "message": result["conversation_messages"][-1],
            "current_step": result["current_step"],
            "progress_percentage": result["progress_percentage"],
            "state": {
                "selected_platform": result.get("selected_platform"),
                "selected_content_type": result.get("selected_content_type"),
                "has_media": result.get("has_media"),
                "media_type": result.get("media_type"),
                "is_complete": result.get("is_complete"),
                "final_post": result.get("final_post")
            }
        }
        
    except Exception as e:
        logger.error(f"Error continuing conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to continue conversation: {str(e)}")

@router.delete("/conversation/{conversation_id}")
async def end_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End and clean up a conversation"""
    try:
        if conversation_id in conversation_states:
            del conversation_states[conversation_id]
            return {"message": "Conversation ended successfully"}
        else:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
    except Exception as e:
        logger.error(f"Error ending conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to end conversation: {str(e)}")

@router.get("/platforms/{user_id}")
async def get_user_platforms(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's connected platforms for content creation"""
    try:
        # This would typically fetch from the database
        # For now, return a mock response
        return {
            "platforms": ["Facebook", "Instagram", "LinkedIn", "Twitter/X", "TikTok"]
        }
        
    except Exception as e:
        logger.error(f"Error getting user platforms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get platforms: {str(e)}")

@router.get("/content-types/{platform}")
async def get_content_types(platform: str):
    """Get available content types for a platform"""
    try:
        from agents.custom_content_agent import PLATFORM_CONTENT_TYPES
        
        content_types = PLATFORM_CONTENT_TYPES.get(platform, [])
        
        return {
            "platform": platform,
            "content_types": content_types
        }
        
    except Exception as e:
        logger.error(f"Error getting content types: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get content types: {str(e)}")

@router.get("/media-requirements/{platform}")
async def get_media_requirements(platform: str):
    """Get media requirements for a platform"""
    try:
        from agents.custom_content_agent import PLATFORM_MEDIA_REQUIREMENTS
        
        requirements = PLATFORM_MEDIA_REQUIREMENTS.get(platform, {})
        
        return {
            "platform": platform,
            "requirements": requirements
        }
        
    except Exception as e:
        logger.error(f"Error getting media requirements: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get media requirements: {str(e)}")
