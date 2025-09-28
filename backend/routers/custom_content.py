"""
API endpoints for Custom Content Creation Agent
"""

import os
import json
import logging
from typing import Dict, Any, Optional

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
    """Process user input in the conversation"""
    try:
        conversation_id = request.conversation_id
        
        # Get conversation state
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Process user input
        updated_state = await custom_content_agent.process_user_input(
            state, request.user_input, request.input_type
        )
        
        # Continue the conversation flow based on current step
        if updated_state["current_step"] != ConversationStep.ERROR:
            current_step = updated_state["current_step"]
            
            # Run the appropriate next step
            if current_step == ConversationStep.ASK_PLATFORM:
                result = await custom_content_agent.ask_platform(updated_state)
            elif current_step == ConversationStep.ASK_CONTENT_TYPE:
                result = await custom_content_agent.ask_content_type(updated_state)
            elif current_step == ConversationStep.ASK_DESCRIPTION:
                result = await custom_content_agent.ask_description(updated_state)
            elif current_step == ConversationStep.ASK_MEDIA:
                result = await custom_content_agent.ask_media(updated_state)
            elif current_step == ConversationStep.HANDLE_MEDIA:
                result = await custom_content_agent.handle_media(updated_state)
            elif current_step == ConversationStep.VALIDATE_MEDIA:
                result = await custom_content_agent.validate_media(updated_state)
            elif current_step == ConversationStep.CONFIRM_MEDIA:
                result = await custom_content_agent.confirm_media(updated_state)
                # If confirm_media transitions to GENERATE_CONTENT, continue the flow
                if result["current_step"] == ConversationStep.GENERATE_CONTENT:
                    logger.info("🔄 Chaining to generate_content")
                    result = await custom_content_agent.generate_content(result)
                    logger.info(f"🔄 After generate_content, current_step: {result['current_step']}")
                    # If generate_content transitions to PARSE_CONTENT, continue the flow
                    if result["current_step"] == ConversationStep.PARSE_CONTENT:
                        logger.info("🔄 Chaining to parse_content")
                        result = await custom_content_agent.parse_content(result)
                        logger.info(f"🔄 After parse_content, current_step: {result['current_step']}")
                        # Stop here to let frontend display the content card
                        # The next steps will be triggered by the next user interaction or automatically
            elif current_step == ConversationStep.GENERATE_CONTENT:
                logger.info("🔄 Calling generate_content")
                result = await custom_content_agent.generate_content(updated_state)
                logger.info(f"🔄 After generate_content, current_step: {result['current_step']}")
                # If generate_content transitions to PARSE_CONTENT, continue the flow
                if result["current_step"] == ConversationStep.PARSE_CONTENT:
                    logger.info("🔄 Chaining to parse_content")
                    result = await custom_content_agent.parse_content(result)
                    logger.info(f"🔄 After parse_content, current_step: {result['current_step']}")
                    # If parse_content transitions to OPTIMIZE_CONTENT, continue the flow
                    if result["current_step"] == ConversationStep.OPTIMIZE_CONTENT:
                        logger.info("🔄 Chaining to optimize_content")
                        result = await custom_content_agent.optimize_content(result)
                        logger.info(f"🔄 After optimize_content, current_step: {result['current_step']}")
                        # If optimize_content transitions to CONFIRM_CONTENT, continue the flow
                        if result["current_step"] == ConversationStep.CONFIRM_CONTENT:
                            logger.info("🔄 Chaining to confirm_content")
                            result = await custom_content_agent.confirm_content(result)
                            logger.info(f"🔄 After confirm_content, current_step: {result['current_step']}")
            elif current_step == ConversationStep.PARSE_CONTENT:
                logger.info("🔄 Calling parse_content")
                result = await custom_content_agent.parse_content(updated_state)
                logger.info(f"🔄 After parse_content, current_step: {result['current_step']}")
                # Stop here to let frontend display the content card
                # The next steps will be triggered automatically or by user interaction
            elif current_step == ConversationStep.GENERATE_MEDIA:
                result = await custom_content_agent.generate_media(updated_state)
            elif current_step == ConversationStep.OPTIMIZE_CONTENT:
                result = await custom_content_agent.optimize_content(updated_state)
                # If optimize_content transitions to CONFIRM_CONTENT, continue the flow
                if result["current_step"] == ConversationStep.CONFIRM_CONTENT:
                    result = await custom_content_agent.confirm_content(result)
            elif current_step == ConversationStep.CONFIRM_CONTENT:
                result = await custom_content_agent.confirm_content(updated_state)
                # If confirm_content transitions to SELECT_SCHEDULE, continue the flow
                if result["current_step"] == ConversationStep.SELECT_SCHEDULE:
                    result = await custom_content_agent.select_schedule(result)
            elif current_step == ConversationStep.SELECT_SCHEDULE:
                result = await custom_content_agent.select_schedule(updated_state)
            elif current_step == ConversationStep.SAVE_CONTENT:
                result = await custom_content_agent.save_content(updated_state)
            elif current_step == ConversationStep.DISPLAY_RESULT:
                result = await custom_content_agent.display_result(updated_state)
            else:
                result = updated_state
            
            # After platform selection, automatically move to content type selection
            if (current_step == ConversationStep.ASK_PLATFORM and 
                result.get("selected_platform") and 
                result.get("current_step") != ConversationStep.ERROR):
                result = await custom_content_agent.ask_content_type(result)
            
            # After content type selection, automatically move to description step
            elif (current_step == ConversationStep.ASK_CONTENT_TYPE and 
                  result.get("selected_content_type") and 
                  result.get("current_step") != ConversationStep.ERROR):
                result = await custom_content_agent.ask_description(result)
            
            # After description step, automatically move to media step
            elif (current_step == ConversationStep.ASK_DESCRIPTION and 
                  result.get("user_description") and 
                  result.get("current_step") != ConversationStep.ERROR):
                result = await custom_content_agent.ask_media(result)
            
            conversation_states[conversation_id] = result
        else:
            conversation_states[conversation_id] = updated_state
            result = updated_state
        
        # Return the latest message and state
        latest_message = result["conversation_messages"][-1]
        
        return {
            "conversation_id": conversation_id,
            "message": latest_message,
            "current_step": result["current_step"] if "result" in locals() else updated_state["current_step"],
            "progress_percentage": result["progress_percentage"] if "result" in locals() else updated_state["progress_percentage"],
            "state": {
                "selected_platform": result.get("selected_platform") if "result" in locals() else updated_state.get("selected_platform"),
                "selected_content_type": result.get("selected_content_type") if "result" in locals() else updated_state.get("selected_content_type"),
                "has_media": result.get("has_media") if "result" in locals() else updated_state.get("has_media"),
                "media_type": result.get("media_type") if "result" in locals() else updated_state.get("media_type"),
                "is_complete": result.get("is_complete") if "result" in locals() else updated_state.get("is_complete")
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
    """Upload media file for the conversation"""
    try:
        logger.info(f"Upload request received: conversation_id={conversation_id}, filename={file.filename}, content_type={file.content_type}")
        
        # Get conversation state
        if conversation_id not in conversation_states:
            logger.error(f"Conversation not found: {conversation_id}")
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        logger.info(f"Found conversation state for user: {state.get('user_id')}")
        
        # Read file content
        file_content = await file.read()
        logger.info(f"Read file content: {len(file_content)} bytes")
        
        # Upload media
        logger.info("Starting media upload...")
        updated_state = await custom_content_agent.upload_media(
            state, file_content, file.filename, file.content_type
        )
        logger.info(f"Media upload completed, new step: {updated_state.get('current_step')}")
        
        # If upload was successful, confirm media
        if updated_state.get("current_step") == ConversationStep.CONFIRM_MEDIA:
            logger.info("Asking user to confirm media...")
            result = await custom_content_agent.confirm_media(updated_state)
            logger.info(f"After confirm_media, current_step: {result['current_step']}")
        else:
            # Continue the conversation flow based on current step
            current_step = updated_state["current_step"]
            
            if current_step == ConversationStep.ASK_PLATFORM:
                result = await custom_content_agent.ask_platform(updated_state)
            elif current_step == ConversationStep.ASK_CONTENT_TYPE:
                result = await custom_content_agent.ask_content_type(updated_state)
            elif current_step == ConversationStep.ASK_DESCRIPTION:
                result = await custom_content_agent.ask_description(updated_state)
            elif current_step == ConversationStep.ASK_MEDIA:
                result = await custom_content_agent.ask_media(updated_state)
            elif current_step == ConversationStep.HANDLE_MEDIA:
                result = await custom_content_agent.handle_media(updated_state)
            elif current_step == ConversationStep.VALIDATE_MEDIA:
                result = await custom_content_agent.validate_media(updated_state)
            elif current_step == ConversationStep.CONFIRM_MEDIA:
                result = await custom_content_agent.confirm_media(updated_state)
                # If confirm_media transitions to GENERATE_CONTENT, continue the flow
                if result["current_step"] == ConversationStep.GENERATE_CONTENT:
                    logger.info("🔄 Chaining to generate_content")
                    result = await custom_content_agent.generate_content(result)
                    logger.info(f"🔄 After generate_content, current_step: {result['current_step']}")
                    # If generate_content transitions to PARSE_CONTENT, continue the flow
                    if result["current_step"] == ConversationStep.PARSE_CONTENT:
                        logger.info("🔄 Chaining to parse_content")
                        result = await custom_content_agent.parse_content(result)
                        logger.info(f"🔄 After parse_content, current_step: {result['current_step']}")
                        # Stop here to let frontend display the content card
                        # The next steps will be triggered by the next user interaction or automatically
            elif current_step == ConversationStep.PARSE_CONTENT:
                logger.info("🔄 Calling parse_content")
                result = await custom_content_agent.parse_content(updated_state)
                logger.info(f"🔄 After parse_content, current_step: {result['current_step']}")
                # Stop here to let frontend display the content card
                # The next steps will be triggered automatically or by user interaction
            elif current_step == ConversationStep.GENERATE_MEDIA:
                result = await custom_content_agent.generate_media(updated_state)
            elif current_step == ConversationStep.OPTIMIZE_CONTENT:
                result = await custom_content_agent.optimize_content(updated_state)
                # If optimize_content transitions to CONFIRM_CONTENT, continue the flow
                if result["current_step"] == ConversationStep.CONFIRM_CONTENT:
                    result = await custom_content_agent.confirm_content(result)
            elif current_step == ConversationStep.CONFIRM_CONTENT:
                result = await custom_content_agent.confirm_content(updated_state)
                # If confirm_content transitions to SELECT_SCHEDULE, continue the flow
                if result["current_step"] == ConversationStep.SELECT_SCHEDULE:
                    result = await custom_content_agent.select_schedule(result)
            elif current_step == ConversationStep.SELECT_SCHEDULE:
                result = await custom_content_agent.select_schedule(updated_state)
            elif current_step == ConversationStep.SAVE_CONTENT:
                result = await custom_content_agent.save_content(updated_state)
            elif current_step == ConversationStep.DISPLAY_RESULT:
                result = await custom_content_agent.display_result(updated_state)
            else:
                result = updated_state
        
        conversation_states[conversation_id] = result
        
        # Get the last message
        last_message = result["conversation_messages"][-1]
        logger.info(f"Returning message with structured_content: {bool(last_message.get('structured_content'))}")
        logger.info(f"Message keys: {list(last_message.keys())}")
        logger.info(f"Current step: {result['current_step']}")
        logger.info(f"Structured content type: {type(last_message.get('structured_content'))}")
        
        response_data = {
            "conversation_id": conversation_id,
            "message": last_message,
            "current_step": result["current_step"],
            "progress_percentage": result["progress_percentage"],
            "media_url": result.get("uploaded_media_url"),
            "media_filename": result.get("uploaded_media_filename"),
            "media_size": result.get("uploaded_media_size"),
            "media_type": result.get("uploaded_media_type")
        }
        
        logger.info(f"Response data keys: {list(response_data.keys())}")
        logger.info(f"Response message structured_content: {bool(response_data['message'].get('structured_content'))}")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error uploading media: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload media: {str(e)}")

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
