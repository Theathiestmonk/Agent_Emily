"""
API endpoints for Custom Blog Creation Agent
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
import uuid
import os
from supabase import create_client

from agents.custom_blog_agent import CustomBlogAgent, CustomBlogState, ConversationStep
from auth import get_current_user

# Initialize Supabase for image uploads
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin = create_client(supabase_url, supabase_service_key) if supabase_url and supabase_service_key else None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-blog", tags=["custom-blog"])

# Initialize the custom blog agent
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is required")

custom_blog_agent = CustomBlogAgent(openai_api_key)

# In-memory storage for conversation states (in production, use Redis or database)
conversation_states: Dict[str, CustomBlogState] = {}

class StartConversationRequest(BaseModel):
    user_id: str

class UserInputRequest(BaseModel):
    conversation_id: str
    user_input: str
    input_type: str = "text"

@router.post("/start")
async def start_conversation(
    request: StartConversationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Start a new custom blog creation conversation"""
    try:
        # Create initial state
        initial_state: CustomBlogState = {
            "user_id": request.user_id,
            "conversation_id": "",
            "conversation_messages": [],
            "current_step": ConversationStep.GREET,
            "selected_blog_type": None,
            "blog_topic": None,
            "keywords": None,
            "blog_length": None,
            "image_option": None,
            "outline": None,
            "generated_blog": None,
            "final_blog": None,
            "error_message": None,
            "retry_count": 0,
            "is_complete": False,
            "progress_percentage": 0
        }
        
        # Run only the first step (greet_user) to get the initial greeting
        result = await custom_blog_agent.greet_user(initial_state)
        
        # Store the conversation state
        conversation_id = result["conversation_id"]
        conversation_states[conversation_id] = result
        
        return {
            "conversation_id": conversation_id,
            "message": result["conversation_messages"][-1],
            "current_step": result["current_step"],
            "progress_percentage": result["progress_percentage"],
            "state": {
                "selected_blog_type": result.get("selected_blog_type"),
                "blog_topic": result.get("blog_topic"),
                "keywords": result.get("keywords"),
                "blog_length": result.get("blog_length"),
                "image_option": result.get("image_option"),
                "is_complete": result.get("is_complete", False),
                "error_message": result.get("error_message")
            }
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
        
        # Execute the conversation step
        result = await custom_blog_agent.execute_conversation_step(
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
                "selected_blog_type": result.get("selected_blog_type"),
                "blog_topic": result.get("blog_topic"),
                "keywords": result.get("keywords"),
                "blog_length": result.get("blog_length"),
                "image_option": result.get("image_option"),
                "is_complete": result.get("is_complete", False),
                "error_message": result.get("error_message"),
                "final_blog": result.get("final_blog")
            }
        }
        
    except Exception as e:
        logger.error(f"Error processing user input: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process input: {str(e)}")

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
                "selected_blog_type": state.get("selected_blog_type"),
                "blog_topic": state.get("blog_topic"),
                "keywords": state.get("keywords"),
                "blog_length": state.get("blog_length"),
                "image_option": state.get("image_option"),
                "is_complete": state.get("is_complete"),
                "final_blog": state.get("final_blog")
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {str(e)}")

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

@router.post("/upload-image")
async def upload_image(
    conversation_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload image for custom blog creation"""
    try:
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.")
        
        # Read file content
        file_content = await file.read()
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size too large. Maximum size is 10MB.")
        
        # Determine file extension
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
        if file_ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            file_ext = 'png'
        
        # Upload to Supabase Storage - use conversation_id as folder
        file_name = f"{conversation_id}/{uuid.uuid4()}.{file_ext}"
        bucket_name = "blog image"
        
        # Upload image
        upload_response = supabase_admin.storage.from_(bucket_name).upload(
            file_name,
            file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        
        # Get public URL
        image_url = supabase_admin.storage.from_(bucket_name).get_public_url(file_name)
        
        # Update conversation state with uploaded image URL
        state["uploaded_image_url"] = image_url
        conversation_states[conversation_id] = state
        
        # Continue conversation - move to outline generation
        result = await custom_blog_agent.handle_image(state, "uploaded")
        conversation_states[conversation_id] = result
        
        latest_message = result["conversation_messages"][-1] if result["conversation_messages"] else {
            "role": "assistant",
            "content": "Image uploaded successfully!",
            "timestamp": datetime.now().isoformat()
        }
        
        return {
            "conversation_id": conversation_id,
            "message": latest_message,
            "current_step": result["current_step"],
            "progress_percentage": result.get("progress_percentage", 0),
            "image_url": image_url,
            "state": {
                "uploaded_image_url": image_url,
                "is_complete": result.get("is_complete", False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.post("/generate-image")
async def generate_image(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate image for custom blog creation"""
    try:
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Generate image using Gemini API (via media agent)
        # Uses Google Gemini 2.5 Flash Image Preview model for image generation
        from agents.media_agent import create_media_agent
        
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Image generation not available - GEMINI_API_KEY not set")
        
        media_agent = create_media_agent(supabase_url, supabase_service_key, gemini_api_key)
        
        # Get blog information and user profile context
        blog_topic = state.get("blog_topic", "Blog post")
        blog_type = state.get("selected_blog_type", "educational")
        keywords = state.get("keywords", [])
        business_context = state.get("business_context", {})
        user_profile = state.get("user_profile", {})
        
        # Build blog content description for image generation
        # Include topic, type, keywords, and business context
        blog_description = f"{blog_type} blog post about: {blog_topic}"
        if keywords:
            blog_description += f" (Keywords: {', '.join(keywords)})"
        
        # Add business context if available
        business_name = business_context.get("business_name", "")
        industry = business_context.get("industry", "")
        target_audience = business_context.get("target_audience", "")
        
        if business_name:
            blog_description += f" for {business_name}"
        if industry:
            blog_description += f" in the {industry} industry"
        if target_audience:
            blog_description += f" targeting {target_audience}"
        
        # Use media agent to generate image with proper profile context
        # The media agent will use generate_image_prompt which uses user profile
        from agents.media_agent import MediaAgentState
        image_state = MediaAgentState(
            user_id=state["user_id"],
            post_id=conversation_id,  # Use conversation_id as temporary post_id
            post_data={
                "content": blog_description,
                "platform": "blog",
                "blog_topic": blog_topic,
                "blog_type": blog_type,
                "keywords": keywords
            },
            image_prompt=None,  # Let media agent generate prompt using profile
            image_style=None,
            image_size=None,
            generated_image_url=None,
            generation_cost=None,
            generation_time=None,
            error_message=None,
            status="pending"
        )
        
        # Generate image prompt first (uses user profile and business context)
        image_state = await media_agent.generate_image_prompt(image_state)
        
        # Then generate the actual image
        result = await media_agent.generate_image(image_state)
        
        if result["status"] != "completed" or not result.get("generated_image_url"):
            raise HTTPException(status_code=500, detail="Failed to generate image")
        
        image_url = result["generated_image_url"]
        
        # Update conversation state
        state["generated_image_url"] = image_url
        state["should_generate_image"] = True
        conversation_states[conversation_id] = state
        
        # Ask user to approve or regenerate image (DO NOT proceed to outline yet)
        message = {
            "role": "assistant",
            "content": f"Great! I've generated an image for your blog post using AI. Here it is:\n\n![Generated Image]({image_url})\n\nAre you satisfied with this image?",
            "timestamp": datetime.now().isoformat(),
            "image_url": image_url,
            "options": [
                {"value": "approve", "label": "✅ Yes, I like it"},
                {"value": "regenerate", "label": "🔄 Regenerate image"},
                {"value": "skip", "label": "⏭️ Skip image"}
            ]
        }
        state["conversation_messages"].append(message)
        state["current_step"] = ConversationStep.HANDLE_IMAGE
        # DO NOT call handle_image here - wait for user approval
        conversation_states[conversation_id] = state
        
        return {
            "conversation_id": conversation_id,
            "message": message,
            "current_step": state["current_step"],
            "progress_percentage": state.get("progress_percentage", 58),
            "image_url": image_url,
            "state": {
                "generated_image_url": image_url,
                "is_complete": False
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

