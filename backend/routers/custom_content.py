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
            "progress_percentage": 0,
            # Carousel fields
            "carousel_images": None,
            "carousel_image_source": None,
            "current_carousel_index": 0,
            "carousel_max_images": 10,
            "uploaded_carousel_images": None,
            "carousel_upload_done": False,
            "carousel_theme": None
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
                "error_message": result.get("error_message"),
                # Carousel-related fields
                "carousel_images": result.get("carousel_images"),
                "carousel_image_source": result.get("carousel_image_source"),
                "current_carousel_index": result.get("current_carousel_index", 0),
                "carousel_max_images": result.get("carousel_max_images", 10),
                "uploaded_carousel_images": result.get("uploaded_carousel_images"),
                "carousel_upload_done": result.get("carousel_upload_done", False),
                "carousel_theme": result.get("carousel_theme")
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

@router.post("/generate-all-carousel-images")
async def generate_all_carousel_images(
    conversation_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Generate all 4 carousel images at once"""
    try:
        logger.info(f"generate-all-carousel-images endpoint called for conversation: {conversation_id}")
        if conversation_id not in conversation_states:
            logger.error(f"Conversation not found: {conversation_id}")
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Verify it's a carousel post
        if state.get("selected_content_type", "").lower() != "carousel":
            raise HTTPException(status_code=400, detail="This conversation is not for a carousel post")
        
        # Generate image using media agent
        from agents.media_agent import create_media_agent
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Image generation not available - GEMINI_API_KEY not set")
        
        media_agent = create_media_agent(supabase_url, supabase_service_key, gemini_api_key)
        
        # Build description for carousel images
        user_description = state.get("user_description", "Carousel post")
        platform = state.get("selected_platform", "Facebook")
        business_context = state.get("business_context") or {}
        carousel_theme = state.get("carousel_theme", f"Sequential carousel story about: {user_description}")
        
        # Validate required fields
        user_id = state.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found in conversation state")
        
        # Generate all 4 images sequentially
        generated_images = []
        previous_prompts = []
        
        for image_index in range(4):
            # Create sequential, related description for each image
            if image_index == 0:
                image_description = f"{carousel_theme} - Image 1 of 4: Opening/Introduction scene. This is the first image in a 4-part sequential carousel story that will tell a cohesive narrative."
            elif image_index == 1:
                image_description = f"{carousel_theme} - Image 2 of 4: Development/Building scene. This is the second image in a 4-part sequential carousel story, building on the first image. The style, color palette, and theme must match the previous image to maintain visual consistency."
            elif image_index == 2:
                image_description = f"{carousel_theme} - Image 3 of 4: Peak/Climax scene. This is the third image in a 4-part sequential carousel story, continuing the narrative from the previous images. Maintain visual consistency, color palette, and story progression."
            else:  # image_index == 3
                image_description = f"{carousel_theme} - Image 4 of 4: Conclusion/Call to action scene. This is the final image in a 4-part sequential carousel story, concluding the narrative. Must visually connect to and complete the story from all previous images with consistent style and colors."
            
            # Add business context
            business_name = ""
            if isinstance(business_context, dict):
                business_name = business_context.get("business_name", "")
            if business_name:
                image_description += f" for {business_name}"
            
            # Add context about previous images for sequential coherence
            if previous_prompts:
                image_description += f" Previous images in this carousel sequence: {', '.join(previous_prompts[:2])}. Ensure visual consistency, color palette, and narrative flow."
            
            # Generate image
            from agents.media_agent import MediaAgentState
            image_state = MediaAgentState(
                user_id=user_id,
                post_id=conversation_id,
                post_data={
                    "content": image_description,
                    "platform": platform.lower() if platform else "facebook",
                    "user_description": user_description,
                    "carousel_index": image_index,
                    "total_carousel_images": 4,
                    "previous_carousel_prompts": previous_prompts,
                    "is_sequential_carousel": True,
                    "carousel_theme": carousel_theme
                },
                image_prompt=None,
                image_style=None,
                image_size=None,
                generated_image_url=None,
                generation_cost=None,
                generation_time=None,
                generation_model=None,
                generation_service=None,
                error_message=None,
                status="pending"
            )
            
            try:
                logger.info(f"Generating carousel image {image_index + 1}/4 for conversation {conversation_id}")
                
                image_state = await media_agent.generate_image_prompt(image_state)
                if not image_state:
                    raise HTTPException(status_code=500, detail=f"Failed to generate image prompt for image {image_index + 1}")
                
                result = await media_agent.generate_image(image_state)
                if not result or not isinstance(result, dict):
                    raise HTTPException(status_code=500, detail=f"Failed to generate image {image_index + 1}")
                
                if result.get("status") != "completed" or not result.get("generated_image_url"):
                    error_msg = result.get("error_message", "Unknown error")
                    raise HTTPException(status_code=500, detail=f"Failed to generate image {image_index + 1}: {error_msg}")
                
                image_url = result.get("generated_image_url")
                image_prompt = image_state.get("image_prompt", "") if isinstance(image_state, dict) else ""
                
                generated_images.append({
                    "url": image_url,
                    "index": image_index,
                    "prompt": image_prompt,
                    "approved": False
                })
                
                previous_prompts.append(image_prompt)
                logger.info(f"Successfully generated carousel image {image_index + 1}/4")
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error generating carousel image {image_index + 1}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to generate carousel image {image_index + 1}: {str(e)}")
        
        # Update state with all generated images
        state["carousel_images"] = generated_images
        state["current_step"] = ConversationStep.APPROVE_CAROUSEL_IMAGES
        conversation_states[conversation_id] = state
        
        # Trigger the approve_carousel_images step to add the approval message
        result = await custom_content_agent.approve_carousel_images(state, user_input=None)
        conversation_states[conversation_id] = result
        
        return {
            "success": True,
            "images": generated_images,
            "total_images": len(generated_images),
            "message": "All 4 carousel images generated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating all carousel images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate carousel images: {str(e)}")

@router.post("/generate-carousel-image")
async def generate_carousel_image(
    conversation_id: str = Form(...),
    image_index: int = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Generate a single carousel image using AI (kept for backward compatibility)"""
    try:
        if conversation_id not in conversation_states:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Verify it's a carousel post
        if state.get("selected_content_type", "").lower() != "carousel":
            raise HTTPException(status_code=400, detail="This conversation is not for a carousel post")
        
        # Verify image index is valid (0-3)
        if image_index < 0 or image_index >= 4:
            raise HTTPException(status_code=400, detail="Image index must be between 0 and 3")
        
        # Generate image using media agent
        from agents.media_agent import create_media_agent
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Image generation not available - GEMINI_API_KEY not set")
        
        media_agent = create_media_agent(supabase_url, supabase_service_key, gemini_api_key)
        
        # Build description for this specific carousel image
        user_description = state.get("user_description", "Carousel post")
        platform = state.get("selected_platform", "Facebook")
        business_context = state.get("business_context") or {}  # Ensure it's always a dict, not None
        carousel_images = state.get("carousel_images", []) or []  # Ensure it's always a list
        carousel_theme = state.get("carousel_theme", f"Sequential carousel story about: {user_description}")
        
        # Get previous images' prompts to maintain sequential relationship
        previous_prompts = []
        if carousel_images:
            for img in carousel_images:
                if isinstance(img, dict) and img.get("prompt"):
                    previous_prompts.append(img.get("prompt"))
        
        # Create sequential, related description for each image in carousel
        # Each image should build on the previous ones to tell a cohesive story
        if image_index == 0:
            # First image: Introduction/Opening
            image_description = f"{carousel_theme} - Image 1 of 4: Opening/Introduction scene. This is the first image in a 4-part sequential carousel story that will tell a cohesive narrative."
        elif image_index == 1:
            # Second image: Development/Building
            image_description = f"{carousel_theme} - Image 2 of 4: Development/Building scene. This is the second image in a 4-part sequential carousel story, building on the first image. The style, color palette, and theme must match the previous image to maintain visual consistency."
        elif image_index == 2:
            # Third image: Peak/Climax
            image_description = f"{carousel_theme} - Image 3 of 4: Peak/Climax scene. This is the third image in a 4-part sequential carousel story, continuing the narrative from the previous images. Maintain visual consistency, color palette, and story progression."
        else:  # image_index == 3
            # Fourth image: Conclusion/Call to action
            image_description = f"{carousel_theme} - Image 4 of 4: Conclusion/Call to action scene. This is the final image in a 4-part sequential carousel story, concluding the narrative. Must visually connect to and complete the story from all previous images with consistent style and colors."
        
        # Add business context (safely handle None)
        business_name = ""
        if isinstance(business_context, dict):
            business_name = business_context.get("business_name", "")
        if business_name:
            image_description += f" for {business_name}"
        
        # Add context about previous images for sequential coherence
        if previous_prompts:
            image_description += f" Previous images in this carousel sequence: {', '.join(previous_prompts[:2])}. Ensure visual consistency, color palette, and narrative flow."
        
        # Validate required fields
        user_id = state.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found in conversation state")
        
        # Generate image
        from agents.media_agent import MediaAgentState
        image_state = MediaAgentState(
            user_id=user_id,
            post_id=conversation_id,
            post_data={
                "content": image_description,
                "platform": platform.lower() if platform else "facebook",
                "user_description": user_description,
                "carousel_index": image_index,
                "total_carousel_images": 4,
                "previous_carousel_prompts": previous_prompts,
                "is_sequential_carousel": True,
                "carousel_theme": carousel_theme
            },
            image_prompt=None,
            image_style=None,
            image_size=None,
            generated_image_url=None,
            generation_cost=None,
            generation_time=None,
            generation_model=None,
            generation_service=None,
            error_message=None,
            status="pending"
        )
        
        # Generate prompt and image
        try:
            logger.info(f"Generating carousel image {image_index + 1} for conversation {conversation_id}")
            logger.info(f"Image description: {image_description[:200]}...")
            
            image_state = await media_agent.generate_image_prompt(image_state)
            if not image_state:
                logger.error("generate_image_prompt returned None")
                raise HTTPException(status_code=500, detail="Failed to generate image prompt - media agent returned None")
            
            logger.info(f"Image prompt generated: {image_state.get('image_prompt', 'N/A')[:100]}...")
            
            result = await media_agent.generate_image(image_state)
            if not result:
                logger.error("generate_image returned None")
                raise HTTPException(status_code=500, detail="Failed to generate image - media agent returned None")
            
            logger.info(f"Image generation result status: {result.get('status', 'N/A')}")
            
            # Ensure result is a dict-like object
            if not isinstance(result, dict):
                raise HTTPException(status_code=500, detail=f"Unexpected result type from media agent: {type(result)}")
            
            if result.get("status") != "completed" or not result.get("generated_image_url"):
                error_msg = result.get("error_message", "Unknown error")
                raise HTTPException(status_code=500, detail=f"Failed to generate image: {error_msg}")
            
            image_url = result.get("generated_image_url")
            if not image_url:
                raise HTTPException(status_code=500, detail="Image generation completed but no image URL returned")
            
            # Add to carousel images list (ensure it's initialized)
            carousel_images = state.get("carousel_images") or []
            if not isinstance(carousel_images, list):
                carousel_images = []
            
            # Safely get image prompt
            image_prompt = ""
            if isinstance(image_state, dict):
                image_prompt = image_state.get("image_prompt", "")
            
            carousel_images.append({
                "url": image_url,
                "index": image_index,
                "prompt": image_prompt,
                "approved": False
            })
            state["carousel_images"] = carousel_images
            conversation_states[conversation_id] = state
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in carousel image generation: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to generate carousel image: {str(e)}")
        
        return {
            "success": True,
            "image_url": image_url,
            "image_index": image_index,
            "total_images": len(carousel_images),
            "max_images": 4
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating carousel image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate carousel image: {str(e)}")

@router.post("/upload-carousel-images")
async def upload_carousel_images(
    conversation_id: str = Form(...),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload multiple carousel images"""
    try:
        logger.info(f"upload-carousel-images endpoint called for conversation: {conversation_id}, files: {len(files)}")
        if conversation_id not in conversation_states:
            logger.error(f"Conversation not found: {conversation_id}")
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        state = conversation_states[conversation_id]
        
        # Verify it's a carousel post
        if state.get("selected_content_type", "").lower() != "carousel":
            raise HTTPException(status_code=400, detail="This conversation is not for a carousel post")
        
        max_images = state.get("carousel_max_images", 10)
        # CRITICAL: Get existing uploaded images BEFORE the loop to preserve them
        current_uploaded = state.get("uploaded_carousel_images") or []
        if not isinstance(current_uploaded, list):
            current_uploaded = []
        current_count = len(current_uploaded)
        
        # Check if adding these files would exceed max
        if current_count + len(files) > max_images:
            raise HTTPException(
                status_code=400, 
                detail=f"Uploading {len(files)} images would exceed the maximum of {max_images} images. You can upload up to {max_images - current_count} more images."
            )
        
        # Validate file sizes (10MB per image)
        MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
        
        uploaded_urls = []
        for file in files:
            if not file.filename:
                continue
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            if file_size > MAX_IMAGE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {file.filename} exceeds the maximum size of 10MB"
                )
            
            if file_size == 0:
                continue
            
            # Upload media using the agent
            updated_state = await custom_content_agent.upload_media(
                state, file_content, file.filename, file.content_type
            )
            
            # Get the uploaded URL
            uploaded_url = updated_state.get("uploaded_media_url")
            if uploaded_url:
                uploaded_urls.append(uploaded_url)
            
            # Preserve uploaded_carousel_images from original state
            # upload_media might not preserve it, so we maintain it separately
            if "uploaded_carousel_images" not in updated_state or not updated_state.get("uploaded_carousel_images"):
                updated_state["uploaded_carousel_images"] = current_uploaded.copy()
            
            # Update state with the returned state
            state = updated_state
        
        # CRITICAL: Append new images to existing list (don't replace)
        # This ensures images accumulate across multiple uploads
        current_uploaded.extend(uploaded_urls)
        state["uploaded_carousel_images"] = current_uploaded
        conversation_states[conversation_id] = state
        
        logger.info(f"✅ Carousel images updated: {len(current_uploaded)} total (added {len(uploaded_urls)} new)")
        
        # Check if we should ask if done
        new_count = len(current_uploaded)
        if new_count >= max_images:
            # At max, proceed to done confirmation
            state["current_step"] = ConversationStep.CONFIRM_CAROUSEL_UPLOAD_DONE
        else:
            # Not at max, ask if done
            state["current_step"] = ConversationStep.CONFIRM_CAROUSEL_UPLOAD_DONE
        
        conversation_states[conversation_id] = state
        
        return {
            "success": True,
            "uploaded_count": len(uploaded_urls),
            "total_images": new_count,
            "max_images": max_images,
            "image_urls": uploaded_urls
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading carousel images: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload carousel images: {str(e)}")

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
                "final_post": state.get("final_post"),
                "carousel_images": state.get("carousel_images"),
                "carousel_image_source": state.get("carousel_image_source"),
                "current_carousel_index": state.get("current_carousel_index", 0),
                "carousel_max_images": state.get("carousel_max_images", 10),
                "uploaded_carousel_images": state.get("uploaded_carousel_images"),
                "carousel_upload_done": state.get("carousel_upload_done", False),
                "carousel_theme": state.get("carousel_theme")
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
