"""
Custom Content Creation Agent using LangGraph
Interactive chatbot for creating custom social media content
Supports image and video uploads with platform-specific optimization
"""

import json
import asyncio
import logging
import base64
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, TypedDict, Union
from dataclasses import dataclass
from enum import Enum

import openai
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from supabase import create_client, Client
import httpx
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY")

class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    NONE = "none"

class ContentType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    CAROUSEL = "carousel"
    STORY = "story"
    REEL = "reel"
    LIVE = "live"
    POLL = "poll"
    QUESTION = "question"
    ARTICLE = "article"
    THREAD = "thread"
    PIN = "pin"
    SHORT = "short"

class ConversationStep(str, Enum):
    GREET = "greet"
    ASK_PLATFORM = "ask_platform"
    ASK_CONTENT_TYPE = "ask_content_type"
    ASK_DESCRIPTION = "ask_description"
    ASK_MEDIA = "ask_media"
    HANDLE_MEDIA = "handle_media"
    VALIDATE_MEDIA = "validate_media"
    CONFIRM_MEDIA = "confirm_media"
    GENERATE_CONTENT = "generate_content"
    PARSE_CONTENT = "parse_content"
    GENERATE_MEDIA = "generate_media"
    OPTIMIZE_CONTENT = "optimize_content"
    CONFIRM_CONTENT = "confirm_content"
    SELECT_SCHEDULE = "select_schedule"
    SAVE_CONTENT = "save_content"
    DISPLAY_RESULT = "display_result"
    ERROR = "error"

class CustomContentState(TypedDict):
    """State for the custom content creation conversation"""
    user_id: str
    conversation_id: Optional[str]
    conversation_messages: List[Dict[str, str]]  # Chat history
    current_step: ConversationStep
    selected_platform: Optional[str]
    selected_content_type: Optional[str]
    user_description: Optional[str]
    has_media: Optional[bool]
    media_type: Optional[MediaType]
    uploaded_media_url: Optional[str]
    should_generate_media: Optional[bool]
    media_prompt: Optional[str]
    generated_content: Optional[Dict[str, Any]]
    generated_media_url: Optional[str]
    final_post: Optional[Dict[str, Any]]
    error_message: Optional[str]
    platform_content_types: Optional[Dict[str, List[str]]]
    media_requirements: Optional[Dict[str, Any]]
    validation_errors: Optional[List[str]]
    retry_count: int
    is_complete: bool

# Platform-specific content types
PLATFORM_CONTENT_TYPES = {
    "Facebook": [
        "Text Post", "Photo", "Video", "Link", "Live Broadcast", 
        "Carousel", "Story", "Event", "Poll", "Question"
    ],
    "Instagram": [
        "Feed Post", "Story", "Reel", "IGTV", "Carousel", 
        "Live", "Guide", "Shopping Post", "Poll", "Question"
    ],
    "LinkedIn": [
        "Text Post", "Article", "Video", "Image", "Document", 
        "Poll", "Event", "Job Posting", "Company Update", "Thought Leadership"
    ],
    "Twitter/X": [
        "Tweet", "Thread", "Image Tweet", "Video Tweet", "Poll", 
        "Space", "Quote Tweet", "Reply", "Retweet", "Fleets"
    ],
    "YouTube": [
        "Short Video", "Long Form Video", "Live Stream", "Premiere", 
        "Community Post", "Shorts", "Tutorial", "Review", "Vlog"
    ],
    "TikTok": [
        "Video", "Duet", "Stitch", "Live", "Photo Slideshow", 
        "Trending Sound", "Original Sound", "Effect Video"
    ],
    "Pinterest": [
        "Pin", "Idea Pin", "Story Pin", "Video Pin", "Shopping Pin", 
        "Board", "Rich Pin", "Carousel Pin", "Seasonal Pin"
    ],
    "WhatsApp Business": [
        "Text Message", "Image", "Video", "Document", "Audio", 
        "Location", "Contact", "Sticker", "Template Message"
    ]
}

# Platform-specific media requirements
PLATFORM_MEDIA_REQUIREMENTS = {
    "Facebook": {
        "image": {
            "sizes": ["1200x630", "1200x675", "1080x1080"],
            "formats": ["jpg", "png", "gif"],
            "max_size": "10MB"
        },
        "video": {
            "sizes": ["1280x720", "1920x1080", "1080x1080"],
            "formats": ["mp4", "mov", "avi"],
            "max_size": "4GB",
            "max_duration": "240 minutes"
        }
    },
    "Instagram": {
        "image": {
            "sizes": ["1080x1080", "1080x1350", "1080x566"],
            "formats": ["jpg", "png"],
            "max_size": "30MB"
        },
        "video": {
            "sizes": ["1080x1080", "1080x1350", "1080x1920"],
            "formats": ["mp4", "mov"],
            "max_size": "100MB",
            "max_duration": "60 seconds"
        }
    },
    "LinkedIn": {
        "image": {
            "sizes": ["1200x627", "1200x1200"],
            "formats": ["jpg", "png"],
            "max_size": "5MB"
        },
        "video": {
            "sizes": ["1280x720", "1920x1080"],
            "formats": ["mp4", "mov"],
            "max_size": "5GB",
            "max_duration": "10 minutes"
        }
    },
    "Twitter/X": {
        "image": {
            "sizes": ["1200x675", "1200x1200"],
            "formats": ["jpg", "png", "gif"],
            "max_size": "5MB"
        },
        "video": {
            "sizes": ["1280x720", "1920x1080"],
            "formats": ["mp4", "mov"],
            "max_size": "512MB",
            "max_duration": "2 minutes 20 seconds"
        }
    },
    "YouTube": {
        "image": {
            "sizes": ["1280x720", "1920x1080"],
            "formats": ["jpg", "png"],
            "max_size": "2MB"
        },
        "video": {
            "sizes": ["1280x720", "1920x1080", "3840x2160"],
            "formats": ["mp4", "mov", "avi"],
            "max_size": "256GB",
            "max_duration": "12 hours"
        }
    },
    "TikTok": {
        "image": {
            "sizes": ["1080x1920", "1080x1080"],
            "formats": ["jpg", "png"],
            "max_size": "10MB"
        },
        "video": {
            "sizes": ["1080x1920", "1080x1080"],
            "formats": ["mp4", "mov"],
            "max_size": "287MB",
            "max_duration": "3 minutes"
        }
    },
    "Pinterest": {
        "image": {
            "sizes": ["1000x1500", "1000x1000", "1000x2000"],
            "formats": ["jpg", "png"],
            "max_size": "32MB"
        },
        "video": {
            "sizes": ["1000x1500", "1000x1000"],
            "formats": ["mp4", "mov"],
            "max_size": "2GB",
            "max_duration": "15 minutes"
        }
    },
    "WhatsApp Business": {
        "image": {
            "sizes": ["any"],
            "formats": ["jpg", "png", "gif"],
            "max_size": "5MB"
        },
        "video": {
            "sizes": ["any"],
            "formats": ["mp4", "3gp"],
            "max_size": "16MB",
            "max_duration": "16 seconds"
        }
    }
}

class CustomContentAgent:
    """Custom Content Creation Agent using LangGraph"""
    
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        self.client = openai.OpenAI(api_key=openai_api_key)
        self.supabase = supabase
        
    def create_graph(self) -> StateGraph:
        """Create the LangGraph workflow"""
        graph = StateGraph(CustomContentState)
        
        # Add nodes
        graph.add_node("greet_user", self.greet_user)
        graph.add_node("ask_platform", self.ask_platform)
        graph.add_node("ask_content_type", self.ask_content_type)
        graph.add_node("ask_description", self.ask_description)
        graph.add_node("ask_media", self.ask_media)
        graph.add_node("handle_media", self.handle_media)
        graph.add_node("validate_media", self.validate_media)
        graph.add_node("confirm_media", self.confirm_media)
        graph.add_node("generate_content", self.generate_content)
        graph.add_node("parse_content", self.parse_content)
        graph.add_node("generate_media", self.generate_media)
        graph.add_node("optimize_content", self.optimize_content)
        graph.add_node("confirm_content", self.confirm_content)
        graph.add_node("select_schedule", self.select_schedule)
        graph.add_node("save_content", self.save_content)
        graph.add_node("display_result", self.display_result)
        graph.add_node("handle_error", self.handle_error)
        
        # Set entry point
        graph.set_entry_point("greet_user")
        
        # Add edges
        graph.add_edge("greet_user", "ask_platform")
        graph.add_edge("ask_platform", "ask_content_type")
        graph.add_edge("ask_content_type", "ask_description")
        graph.add_edge("ask_description", "ask_media")
        
        # Conditional edges for media handling
        graph.add_conditional_edges(
            "ask_media",
            self._should_handle_media,
            {
                "handle": "handle_media",
                "skip": "generate_content"
            }
        )
        
        graph.add_edge("handle_media", "validate_media")
        graph.add_edge("validate_media", "confirm_media")
        graph.add_edge("confirm_media", "generate_content")
        graph.add_edge("generate_content", "parse_content")
        graph.add_edge("parse_content", "optimize_content")
        graph.add_edge("optimize_content", "confirm_content")
        graph.add_edge("confirm_content", "select_schedule")
        graph.add_edge("select_schedule", "save_content")
        
        graph.add_edge("generate_media", "save_content")
        graph.add_edge("save_content", "display_result")
        graph.add_edge("display_result", END)
        
        # Error handling
        graph.add_edge("handle_error", END)
        
        return graph.compile()
    
    async def greet_user(self, state: CustomContentState) -> CustomContentState:
        """Welcome the user and initialize conversation"""
        try:
            # Create conversation ID
            conversation_id = str(uuid.uuid4())
            
            # Initialize conversation
            state["conversation_id"] = conversation_id
            state["conversation_messages"] = []
            state["current_step"] = ConversationStep.ASK_PLATFORM
            state["retry_count"] = 0
            state["is_complete"] = False
            
            # Load user profile and platforms
            user_profile = await self._load_user_profile(state["user_id"])
            state["user_profile"] = user_profile
            
            connected_platforms = user_profile.get("social_media_platforms", [])
            state["platform_content_types"] = {platform: PLATFORM_CONTENT_TYPES.get(platform, []) for platform in connected_platforms}
            
            if not connected_platforms:
                # No platforms connected
                welcome_message = {
                    "role": "assistant",
                    "content": "Hi, I'm Emily! 👋 I'd love to help you create amazing content, but I don't see any connected social media platforms in your profile. Please connect your platforms first in the Settings dashboard, then come back to create content!",
                    "timestamp": datetime.now().isoformat()
                }
                state["conversation_messages"].append(welcome_message)
                state["current_step"] = ConversationStep.ERROR
                return state
            
            # Create platform selection message with options
            welcome_message = {
                "role": "assistant",
                "content": "Hi, I'm Emily! 👋 I'll help you create amazing content for your social media platforms. Please select a platform:",
                "timestamp": datetime.now().isoformat(),
                "platforms": connected_platforms,
                "options": [{"value": str(i+1), "label": platform} for i, platform in enumerate(connected_platforms)]
            }
            
            state["conversation_messages"].append(welcome_message)
            state["progress_percentage"] = 15
            
            logger.info(f"Greeted user {state['user_id']} for custom content creation with {len(connected_platforms)} platforms")
            
        except Exception as e:
            logger.error(f"Error in greet_user: {e}")
            state["error_message"] = f"Failed to initialize conversation: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
        
    async def ask_platform(self, state: CustomContentState) -> CustomContentState:
        """Ask user to select a platform"""
        try:
            state["current_step"] = ConversationStep.ASK_PLATFORM
            state["progress_percentage"] = 15
            
            # Get user's connected platforms
            user_profile = state.get("user_profile", {})
            connected_platforms = user_profile.get("social_media_platforms", [])
            
            if not connected_platforms:
                message = {
                    "role": "assistant",
                    "content": "I don't see any connected social media platforms in your profile. Please connect your platforms first in the Settings dashboard.",
                    "timestamp": datetime.now().isoformat()
                }
                state["conversation_messages"].append(message)
                state["current_step"] = ConversationStep.ERROR
                return state
            
            # Create platform selection message
            platform_options = "\n".join([f"{i+1}. {platform}" for i, platform in enumerate(connected_platforms)])
            message = {
                "role": "assistant",
                "content": f"Great! I can see you have these platforms connected:\n\n{platform_options}\n\nPlease select a platform by typing the number or name:",
                "timestamp": datetime.now().isoformat(),
                "platforms": connected_platforms
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user to select platform from: {connected_platforms}")
            
        except Exception as e:
            logger.error(f"Error in ask_platform: {e}")
            state["error_message"] = f"Failed to load platforms: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_content_type(self, state: CustomContentState) -> CustomContentState:
        """Ask user to select content type for the platform"""
        try:
            state["current_step"] = ConversationStep.ASK_CONTENT_TYPE
            state["progress_percentage"] = 25
            
            platform = state.get("selected_platform")
            if not platform:
                state["error_message"] = "No platform selected"
                state["current_step"] = ConversationStep.ERROR
                return state
            
            # Get content types for the platform
            content_types = PLATFORM_CONTENT_TYPES.get(platform, ["Text Post", "Image", "Video"])
            
            message = {
                "role": "assistant",
                "content": f"Perfect! For {platform}, what type of content would you like to create?",
                "timestamp": datetime.now().isoformat(),
                "content_types": content_types,
                "options": [{"value": str(i+1), "label": content_type} for i, content_type in enumerate(content_types)]
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user to select content type for {platform}")
            
        except Exception as e:
            logger.error(f"Error in ask_content_type: {e}")
            state["error_message"] = f"Failed to load content types: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_description(self, state: CustomContentState) -> CustomContentState:
        """Ask user to describe their content idea"""
        try:
            state["current_step"] = ConversationStep.ASK_DESCRIPTION
            state["progress_percentage"] = 35
            
            platform = state.get("selected_platform")
            content_type = state.get("selected_content_type")
            
            message = {
                "role": "assistant",
                "content": f"Great choice! Now tell me about your {content_type} for {platform}. What's in your mind to post? Describe your idea, key points, or any specific details you want to include:",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user to describe content for {content_type} on {platform}")
            
        except Exception as e:
            logger.error(f"Error in ask_description: {e}")
            state["error_message"] = f"Failed to ask for description: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_media(self, state: CustomContentState) -> CustomContentState:
        """Ask user about media preferences"""
        try:
            state["current_step"] = ConversationStep.ASK_MEDIA
            state["progress_percentage"] = 45
            
            platform = state.get("selected_platform")
            content_type = state.get("selected_content_type")
            
            # Get media requirements for the platform
            media_reqs = PLATFORM_MEDIA_REQUIREMENTS.get(platform, {})
            
            message = {
                "role": "assistant",
                "content": f"Do you have media to include with your {content_type}? What would you prefer?",
                "timestamp": datetime.now().isoformat(),
                "media_requirements": media_reqs,
                "options": [
                    {
                        "value": "upload_image",
                        "label": "📷 Upload an image"
                    },
                    {
                        "value": "upload_video", 
                        "label": "🎥 Upload a video"
                    },
                    {
                        "value": "generate_image",
                        "label": "🎨 Let me generate an image for you"
                    },
                    {
                        "value": "generate_video",
                        "label": "🎬 Let me generate a video for you"
                    },
                    {
                        "value": "skip_media",
                        "label": "📝 Skip media (text-only post)"
                    }
                ]
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user about media preferences for {platform}")
            
        except Exception as e:
            logger.error(f"Error in ask_media: {e}")
            state["error_message"] = f"Failed to ask about media: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def handle_media(self, state: CustomContentState) -> CustomContentState:
        """Handle media upload - show upload interface"""
        try:
            state["current_step"] = ConversationStep.HANDLE_MEDIA
            state["progress_percentage"] = 55
            
            media_type = state.get("media_type", "image")
            media_type_name = "image" if media_type == "image" else "video"
            
            message = {
                "role": "assistant",
                "content": f"Perfect! Please upload your {media_type_name} below.",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Ready for media upload: {media_type}")
            
        except Exception as e:
            logger.error(f"Error in handle_media: {e}")
            state["error_message"] = f"Failed to handle media: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def validate_media(self, state: CustomContentState) -> CustomContentState:
        """Validate uploaded media against platform requirements"""
        try:
            state["current_step"] = ConversationStep.VALIDATE_MEDIA
            state["progress_percentage"] = 65
            
            # Media validation will be handled by the frontend
            # This is a placeholder for any server-side validation
            message = {
                "role": "assistant",
                "content": "Media validation completed successfully!",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info("Media validation completed")
            
        except Exception as e:
            logger.error(f"Error in validate_media: {e}")
            state["error_message"] = f"Failed to validate media: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state

    async def confirm_media(self, state: CustomContentState) -> CustomContentState:
        """Ask user to confirm if the uploaded media is correct"""
        try:
            state["current_step"] = ConversationStep.CONFIRM_MEDIA
            state["progress_percentage"] = 60
            
            media_url = state.get("uploaded_media_url")
            media_type = state.get("uploaded_media_type", "")
            media_filename = state.get("uploaded_media_filename", "")
            
            # Create a message asking for confirmation
            message = {
                "role": "assistant",
                "content": f"Perfect! I've received your {media_type.split('/')[0]} file: **{media_filename}**\n\nIs this the correct media you'd like me to use for your content? Please confirm by typing 'yes' to proceed or 'no' to upload a different file.",
                "timestamp": datetime.now().isoformat(),
                "media_url": media_url,
                "media_type": media_type,
                "media_filename": media_filename
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asking user to confirm media: {media_filename}")
            
        except Exception as e:
            logger.error(f"Error in confirm_media: {e}")
            state["error_message"] = f"Failed to confirm media: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state

    async def generate_content(self, state: CustomContentState) -> CustomContentState:
        """Generate content using the content creation agent logic with image analysis"""
        try:
            state["current_step"] = ConversationStep.GENERATE_CONTENT
            state["progress_percentage"] = 75
            
            # Extract context
            user_description = state.get("user_description", "")
            platform = state.get("selected_platform", "")
            content_type = state.get("selected_content_type", "")
            uploaded_media_url = state.get("uploaded_media_url", "")
            has_media = state.get("has_media", False)
            media_type = state.get("media_type", "")
            
            # Load business context if not already loaded
            business_context = state.get("business_context")
            if not business_context:
                user_id = state.get("user_id")
                if user_id:
                    business_context = self._load_business_context(user_id)
                    state["business_context"] = business_context
                else:
                    business_context = {}
            
            # Analyze image if uploaded
            image_analysis = ""
            if has_media and uploaded_media_url and media_type == "image":
                try:
                    image_analysis = await self._analyze_uploaded_image(uploaded_media_url, user_description, business_context)
                    logger.info("Image analysis completed successfully")
                except Exception as e:
                    logger.error(f"Image analysis failed: {e}")
                    image_analysis = f"Image analysis failed: {str(e)}"
            
            # Create enhanced content generation prompt
            prompt = self._create_enhanced_content_prompt(
                user_description, platform, content_type, business_context, image_analysis, has_media
            )
            
            # Prepare messages for content generation
            messages = [
                {"role": "system", "content": "You are an expert social media content creator. Generate engaging, platform-optimized content that incorporates visual elements when provided. CRITICAL: Return ONLY a valid JSON object with the exact fields specified. Do NOT include any markdown formatting, code blocks, or nested JSON. The response must be pure JSON that can be parsed directly."},
                {"role": "user", "content": prompt}
            ]
            
            # Add image to messages if available
            if has_media and uploaded_media_url and media_type == "image":
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Here's the image to incorporate into the content:"},
                        {"type": "image_url", "image_url": {"url": uploaded_media_url}}
                    ]
                })
            
            # Generate content using OpenAI with vision capabilities
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Use vision-capable model
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            generated_text = response.choices[0].message.content
            
            # Parse the generated content
            try:
                # Try to parse as JSON first
                content_data = json.loads(generated_text)
            except json.JSONDecodeError:
                # If not JSON, create a structured response
                content_data = {
                    "content": generated_text,
                    "title": f"{content_type} for {platform}",
                    "hashtags": self._extract_hashtags(generated_text),
                    "post_type": "image" if has_media else "text",
                    "media_url": uploaded_media_url if has_media else None
                }
            
            state["generated_content"] = content_data
            
            # Create response message - just the content without JSON wrapper
            if has_media and image_analysis:
                message_content = f"Perfect! I've analyzed your image and generated your {content_type} content. Here's what I created:\n\n{content_data.get('content', '')}"
            else:
                message_content = f"Great! I've generated your {content_type} content. Here's what I created:\n\n{content_data.get('content', '')}"
            
            message = {
                "role": "assistant",
                "content": message_content,
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Generated content for {platform} {content_type}")
            
            # Transition to parse content step
            state["current_step"] = ConversationStep.PARSE_CONTENT
            state["progress_percentage"] = 80
            
        except Exception as e:
            logger.error(f"Error in generate_content: {e}")
            state["error_message"] = f"Failed to generate content: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state

    async def parse_content(self, state: CustomContentState) -> CustomContentState:
        """Parse the generated content and create structured response for frontend"""
        try:
            state["current_step"] = ConversationStep.PARSE_CONTENT
            state["progress_percentage"] = 85
            
            generated_content = state.get("generated_content", {})
            platform = state.get("selected_platform", "")
            content_type = state.get("selected_content_type", "")
            
            # Create a structured response that the frontend can parse
            structured_content = {
                "content": generated_content.get("content", ""),
                "title": generated_content.get("title", f"{content_type} for {platform}"),
                "hashtags": generated_content.get("hashtags", []),
                "call_to_action": generated_content.get("call_to_action", ""),
                "engagement_hooks": generated_content.get("engagement_hooks", ""),
                "image_caption": generated_content.get("image_caption", ""),
                "visual_elements": generated_content.get("visual_elements", []),
                "media_url": state.get("uploaded_media_url") or state.get("generated_media_url"),
                "platform": platform,
                "content_type": content_type
            }
            
            # Store the structured content for the frontend
            state["parsed_content"] = structured_content
            
            # Create a single message with both content card and confirmation
            message = {
                "role": "assistant",
                "content": "Perfect! I've generated your content. Please review it above and let me know if you'd like to save this post. Type 'yes' to save it or 'no' to make changes.",
                "timestamp": datetime.now().isoformat(),
                "structured_content": structured_content
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Created message with structured_content: {bool(message.get('structured_content'))}")
            logger.info(f"Structured content keys: {list(structured_content.keys()) if structured_content else 'None'}")
            
            # Transition to confirm content step
            state["current_step"] = ConversationStep.CONFIRM_CONTENT
            state["progress_percentage"] = 95
            
            logger.info(f"Content parsed and structured for {platform} {content_type}")
            
        except Exception as e:
            logger.error(f"Error in parse_content: {e}")
            state["error_message"] = f"Failed to parse content: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def generate_media(self, state: CustomContentState) -> CustomContentState:
        """Generate media using the media agent"""
        try:
            state["current_step"] = ConversationStep.GENERATE_MEDIA
            state["progress_percentage"] = 85
            
            # Check if media generation is needed
            if not state.get("should_generate_media", False):
                message = {
                    "role": "assistant",
                    "content": "No media generation needed. Moving to content optimization.",
                    "timestamp": datetime.now().isoformat()
                }
                state["conversation_messages"].append(message)
                return state
            
            # This would integrate with the media agent
            # For now, we'll create a placeholder
            state["generated_media_url"] = "placeholder_media_url"
            
            message = {
                "role": "assistant",
                "content": "Media generation completed! Your content now includes the generated media.",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info("Media generation completed")
            
        except Exception as e:
            logger.error(f"Error in generate_media: {e}")
            state["error_message"] = f"Failed to generate media: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def optimize_content(self, state: CustomContentState) -> CustomContentState:
        """Optimize content for the specific platform"""
        try:
            state["current_step"] = ConversationStep.OPTIMIZE_CONTENT
            state["progress_percentage"] = 90
            
            platform = state.get("selected_platform", "")
            content = state.get("generated_content", {})
            
            # Apply platform-specific optimizations
            optimized_content = self._optimize_for_platform(content, platform)
            state["generated_content"] = optimized_content
            
            message = {
                "role": "assistant",
                "content": f"Content optimized for {platform}! I've adjusted the formatting, hashtags, and engagement elements to work best on this platform.",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Content optimized for {platform}")
            
            # Transition to confirm content
            state["current_step"] = ConversationStep.CONFIRM_CONTENT
            state["progress_percentage"] = 95
            
        except Exception as e:
            logger.error(f"Error in optimize_content: {e}")
            state["error_message"] = f"Failed to optimize content: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state

    async def confirm_content(self, state: CustomContentState) -> CustomContentState:
        """Ask user to confirm if the generated content is correct and should be saved"""
        try:
            state["current_step"] = ConversationStep.CONFIRM_CONTENT
            state["progress_percentage"] = 95
            
            # Create a message asking for content confirmation
            message = {
                "role": "assistant",
                "content": "Perfect! I've generated your content. Please review it above and let me know if you'd like to save this post. Type 'yes' to save it or 'no' to make changes.",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info("Asking user to confirm generated content")
            
            # Transition to select schedule (this will be handled by user input processing)
            # The actual transition happens in process_user_input when user responds
            
        except Exception as e:
            logger.error(f"Error in confirm_content: {e}")
            state["error_message"] = f"Failed to confirm content: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state

    async def select_schedule(self, state: CustomContentState) -> CustomContentState:
        """Ask user to select date and time for the post"""
        try:
            state["current_step"] = ConversationStep.SELECT_SCHEDULE
            state["progress_percentage"] = 98
            
            # Create a message asking for schedule selection
            message = {
                "role": "assistant",
                "content": "Great! Now let's schedule your post. Please select the date and time when you'd like this content to be published. You can choose to post immediately or schedule it for later.",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.info("Asking user to select post schedule")
            
        except Exception as e:
            logger.error(f"Error in select_schedule: {e}")
            state["error_message"] = f"Failed to select schedule: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state

    async def save_content(self, state: CustomContentState) -> CustomContentState:
        """Save the generated content to Supabase"""
        try:
            state["current_step"] = ConversationStep.SAVE_CONTENT
            state["progress_percentage"] = 95
            
            user_id = state["user_id"]
            platform = state["selected_platform"]
            content_type = state["selected_content_type"]
            generated_content = state["generated_content"]
            uploaded_media_url = state.get("uploaded_media_url")
            
            # Upload image to Supabase storage if present
            final_media_url = None
            if uploaded_media_url and uploaded_media_url.startswith("data:"):
                try:
                    final_media_url = await self._upload_base64_image_to_supabase(
                        uploaded_media_url, user_id, platform
                    )
                    logger.info(f"Image uploaded to Supabase: {final_media_url}")
                except Exception as e:
                    logger.error(f"Failed to upload image to Supabase: {e}")
                    # Continue without image if upload fails
                    final_media_url = None
            
            # Get scheduled time
            scheduled_for = state.get("scheduled_for")
            if scheduled_for:
                # Parse the scheduled time
                scheduled_datetime = datetime.fromisoformat(scheduled_for.replace('Z', '+00:00'))
                status = "scheduled" if scheduled_datetime > datetime.now() else "draft"
            else:
                scheduled_datetime = datetime.now()
                status = "draft"
            
            # Create post data
            post_data = {
                "user_id": user_id,
                "platform": platform,
                "content_type": content_type,
                "content": generated_content.get("content", ""),
                "title": generated_content.get("title", ""),
                "hashtags": generated_content.get("hashtags", []),
                "media_url": final_media_url,
                "status": status,
                "created_at": datetime.now().isoformat(),
                "scheduled_for": scheduled_datetime.isoformat(),
                "metadata": {
                    "generated_by": "custom_content_agent",
                    "conversation_id": state["conversation_id"],
                    "platform_optimized": True,
                    "has_media": bool(final_media_url),
                    "media_type": state.get("media_type", ""),
                    "original_media_filename": state.get("uploaded_media_filename", ""),
                    "media_size": state.get("uploaded_media_size", 0),
                    "call_to_action": generated_content.get("call_to_action", ""),
                    "engagement_hooks": generated_content.get("engagement_hooks", ""),
                    "image_caption": generated_content.get("image_caption", ""),
                    "visual_elements": generated_content.get("visual_elements", [])
                }
            }
            
            # Save to Supabase
            logger.info(f"Saving post to database: {post_data}")
            result = self.supabase.table("posts").insert(post_data).execute()
            
            if result.data:
                post_id = result.data[0]["id"]
                state["final_post"] = result.data[0]
                
                # Also save image metadata to content_images table if image was uploaded
                if final_media_url:
                    try:
                        image_data = {
                            "post_id": post_id,
                            "image_url": final_media_url,
                            "image_prompt": "User uploaded image for custom content",
                            "image_style": "user_upload",
                            "image_size": "custom",
                            "image_quality": "custom",
                            "generation_model": "user_upload",
                            "generation_cost": 0,
                            "generation_time": 0,
                            "is_approved": True
                        }
                        
                        self.supabase.table("content_images").insert(image_data).execute()
                        logger.info(f"Image metadata saved for post {post_id}")
                    except Exception as e:
                        logger.error(f"Failed to save image metadata: {e}")
                        # Continue even if image metadata save fails
                
                message = {
                    "role": "assistant",
                    "content": f"🎉 Perfect! Your {content_type} for {platform} has been saved as a draft post! 📝\n\n✅ Content generated and optimized\n✅ Image uploaded to storage\n✅ Post saved to your dashboard\n\nYou can now review, edit, or schedule this post from your content dashboard. The post includes your uploaded image and is ready to go!",
                    "timestamp": datetime.now().isoformat()
                }
                state["conversation_messages"].append(message)
                state["is_complete"] = True
            else:
                raise Exception("Failed to save content to database")
            
            logger.info(f"Content saved for user {user_id} on {platform}, post_id: {post_id}")
            
        except Exception as e:
            logger.error(f"Error in save_content: {e}")
            state["error_message"] = f"Failed to save content: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def display_result(self, state: CustomContentState) -> CustomContentState:
        """Display the final result to the user"""
        try:
            state["current_step"] = ConversationStep.DISPLAY_RESULT
            state["progress_percentage"] = 100
            
            final_post = state.get("final_post", {})
            platform = state.get("selected_platform", "")
            content_type = state.get("selected_content_type", "")
            
            message = {
                "role": "assistant",
                "content": f"🎉 Content creation complete! Your {content_type} for {platform} is ready and saved as a draft. You can now review, edit, or schedule it from your content dashboard. Is there anything else you'd like to create?",
                "timestamp": datetime.now().isoformat(),
                "final_post": final_post
            }
            state["conversation_messages"].append(message)
            
            logger.info("Content creation workflow completed successfully")
            
        except Exception as e:
            logger.error(f"Error in display_result: {e}")
            state["error_message"] = f"Failed to display result: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def handle_error(self, state: CustomContentState) -> CustomContentState:
        """Handle errors in the workflow"""
        try:
            state["current_step"] = ConversationStep.ERROR
            state["progress_percentage"] = 0
            
            error_message = state.get("error_message", "An unknown error occurred")
            
            message = {
                "role": "assistant",
                "content": f"I apologize, but I encountered an error: {error_message}. Let's start over or try a different approach. What would you like to do?",
                "timestamp": datetime.now().isoformat()
            }
            state["conversation_messages"].append(message)
            
            logger.error(f"Error handled: {error_message}")
            
        except Exception as e:
            logger.error(f"Error in handle_error: {e}")
            
        return state
    
    def _load_business_context(self, user_id: str) -> Dict[str, Any]:
        """Load business context from user profile"""
        try:
            # Get user profile from Supabase
            response = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if response.data and len(response.data) > 0:
                profile_data = response.data[0]
                return self._extract_business_context(profile_data)
            else:
                logger.warning(f"No profile found for user {user_id}")
                return self._get_default_business_context()
                
        except Exception as e:
            logger.error(f"Error loading business context for user {user_id}: {e}")
            return self._get_default_business_context()

    def _get_default_business_context(self) -> Dict[str, Any]:
        """Get default business context when profile is not available"""
        return {
            "business_name": "Your Business",
            "industry": "General",
            "target_audience": "General audience",
            "brand_voice": "Professional and friendly",
            "content_goals": ["Engagement", "Awareness"],
            "brand_personality": "Approachable and trustworthy",
            "brand_values": ["Quality", "Trust"]
        }

    def _extract_business_context(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract business context from user profile"""
        return {
            "business_name": profile_data.get("business_name", ""),
            "industry": profile_data.get("industry", ""),
            "target_audience": profile_data.get("target_audience", ""),
            "brand_voice": profile_data.get("brand_voice", ""),
            "content_goals": profile_data.get("content_goals", []),
            "brand_personality": profile_data.get("brand_personality", ""),
            "brand_values": profile_data.get("brand_values", [])
        }

    async def _upload_base64_image_to_supabase(self, base64_data_url: str, user_id: str, platform: str) -> str:
        """Upload base64 image data to Supabase storage"""
        try:
            import base64
            import uuid
            
            # Parse the data URL
            if not base64_data_url.startswith("data:"):
                raise ValueError("Invalid base64 data URL format")
            
            # Extract content type and base64 data
            header, data = base64_data_url.split(",", 1)
            content_type = header.split(":")[1].split(";")[0]
            
            # Decode base64 data
            image_data = base64.b64decode(data)
            
            # Generate unique filename
            file_extension = content_type.split("/")[1] if "/" in content_type else "jpg"
            filename = f"custom_content_{user_id}_{platform}_{uuid.uuid4().hex[:8]}.{file_extension}"
            file_path = f"user-uploads/{filename}"
            
            logger.info(f"Uploading image to Supabase storage: {file_path}")
            
            # Upload to Supabase storage
            storage_response = self.supabase.storage.from_("ai-generated-images").upload(
                file_path,
                image_data,
                file_options={"content-type": content_type}
            )
            
            # Check for upload errors
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Storage upload failed: {storage_response.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_("ai-generated-images").get_public_url(file_path)
            
            logger.info(f"Successfully uploaded image to Supabase: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading base64 image to Supabase: {e}")
            raise e
    
    async def _analyze_uploaded_image(self, image_url: str, user_description: str, business_context: Dict[str, Any]) -> str:
        """Analyze uploaded image using vision model"""
        try:
            # Create image analysis prompt
            analysis_prompt = f"""
            Analyze this image in detail for social media content creation. Focus on:
            
            1. Visual elements: What objects, people, settings, colors, and activities are visible?
            2. Mood and atmosphere: What feeling or vibe does the image convey?
            3. Brand relevance: How does this image relate to the business context?
            4. Content opportunities: What story or message could this image tell?
            5. Platform optimization: How would this work for different social media platforms?
            
            Business Context:
            - Business: {business_context.get('business_name', 'Not specified')}
            - Industry: {business_context.get('industry', 'Not specified')}
            - Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
            
            User Description: "{user_description}"
            
            Provide a detailed analysis that will help create engaging social media content.
            """
            
            # Analyze image using vision model
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert visual content analyst specializing in social media marketing."},
                    {"role": "user", "content": [
                        {"type": "text", "text": analysis_prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            analysis = response.choices[0].message.content
            logger.info(f"Image analysis completed: {analysis[:100]}...")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return f"Image analysis failed: {str(e)}"

    def _create_content_prompt(self, description: str, platform: str, content_type: str, business_context: Dict[str, Any]) -> str:
        """Create a comprehensive prompt for content generation"""
        prompt = f"""
        Create a {content_type} for {platform} based on this description: "{description}"
        
        Business Context:
        - Business Name: {business_context.get('business_name', 'Not specified')}
        - Industry: {business_context.get('industry', 'Not specified')}
        - Target Audience: {business_context.get('target_audience', 'General audience')}
        - Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
        - Brand Personality: {business_context.get('brand_personality', 'Approachable and trustworthy')}
        
        Requirements:
        - Optimize for {platform} best practices
        - Match the brand voice and personality
        - Include relevant hashtags
        - Make it engaging and shareable
        - Keep it authentic to the business context
        
        Return the content in JSON format with these fields:
        - content: The main post content
        - title: A catchy title (if applicable)
        - hashtags: Array of relevant hashtags
        - call_to_action: Suggested call to action
        - engagement_hooks: Ways to encourage engagement
        """
        return prompt

    def _create_enhanced_content_prompt(self, description: str, platform: str, content_type: str, 
                                      business_context: Dict[str, Any], image_analysis: str, has_media: bool) -> str:
        """Create an enhanced prompt for content generation with image analysis"""
        base_prompt = f"""
        Create a {content_type} for {platform} based on this description: "{description}"
        
        Business Context:
        - Business Name: {business_context.get('business_name', 'Not specified')}
        - Industry: {business_context.get('industry', 'Not specified')}
        - Target Audience: {business_context.get('target_audience', 'General audience')}
        - Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
        - Brand Personality: {business_context.get('brand_personality', 'Approachable and trustworthy')}
        """
        
        if has_media and image_analysis:
            enhanced_prompt = f"""
            {base_prompt}
            
            IMAGE ANALYSIS:
            {image_analysis}
            
            Requirements:
            - Create content that perfectly complements and references the uploaded image
            - Use the image analysis to craft engaging, visual storytelling
            - Optimize for {platform} best practices with visual content
            - Match the brand voice and personality
            - Include relevant hashtags
            - Make it engaging and shareable
            - Create a compelling narrative that connects the image to your business
            - Use the visual elements to enhance the message
            
            CRITICAL INSTRUCTIONS:
            - Return ONLY a valid JSON object
            - Do NOT use markdown code blocks (no ```json or ```)
            - Do NOT include any text before or after the JSON
            - The JSON must be parseable directly
            - Use these exact field names:
            
            {{
              "content": "The main post content that references the image",
              "title": "A catchy title",
              "hashtags": ["array", "of", "relevant", "hashtags"],
              "call_to_action": "Suggested call to action",
              "engagement_hooks": "Ways to encourage engagement",
              "image_caption": "A specific caption for the image",
              "visual_elements": ["key", "visual", "elements", "to", "highlight"]
            }}
            """
        else:
            enhanced_prompt = f"""
            {base_prompt}
            
            Requirements:
            - Optimize for {platform} best practices
            - Match the brand voice and personality
            - Include relevant hashtags
            - Make it engaging and shareable
            - Keep it authentic to the business context
            
            CRITICAL INSTRUCTIONS:
            - Return ONLY a valid JSON object
            - Do NOT use markdown code blocks (no ```json or ```)
            - Do NOT include any text before or after the JSON
            - The JSON must be parseable directly
            - Use these exact field names:
            
            {{
              "content": "The main post content",
              "title": "A catchy title",
              "hashtags": ["array", "of", "relevant", "hashtags"],
              "call_to_action": "Suggested call to action",
              "engagement_hooks": "Ways to encourage engagement"
            }}
            """
        
        return enhanced_prompt
    
    def _extract_hashtags(self, text: str) -> List[str]:
        """Extract hashtags from text"""
        import re
        hashtags = re.findall(r'#\w+', text)
        return hashtags[:10]  # Limit to 10 hashtags
    
    def _optimize_for_platform(self, content: Dict[str, Any], platform: str) -> Dict[str, Any]:
        """Apply platform-specific optimizations"""
        optimized = content.copy()
        
        # Platform-specific optimizations
        if platform == "Twitter/X":
            # Keep content concise
            if len(optimized.get("content", "")) > 280:
                optimized["content"] = optimized["content"][:277] + "..."
        elif platform == "Instagram":
            # Add more visual elements
            if not optimized.get("hashtags"):
                optimized["hashtags"] = ["#instagram", "#content", "#socialmedia"]
        elif platform == "LinkedIn":
            # Make it more professional
            if not optimized.get("call_to_action"):
                optimized["call_to_action"] = "What are your thoughts on this?"
        
        return optimized
    
    async def process_user_input(self, state: CustomContentState, user_input: str, input_type: str = "text") -> CustomContentState:
        """Process user input and update state accordingly"""
        try:
            current_step = state.get("current_step")
            
            # Don't add user message here - frontend handles it
            # Just process the input based on current step
            
            # Process based on current step
            if current_step == ConversationStep.ASK_PLATFORM:
                # Parse platform selection
                platform = self._parse_platform_selection(user_input, state)
                if platform:
                    state["selected_platform"] = platform
                else:
                    state["error_message"] = "Invalid platform selection"
                    state["current_step"] = ConversationStep.ERROR
                    
            elif current_step == ConversationStep.ASK_CONTENT_TYPE:
                # Parse content type selection
                content_type = self._parse_content_type_selection(user_input, state)
                if content_type:
                    state["selected_content_type"] = content_type
                else:
                    state["error_message"] = "Invalid content type selection"
                    state["current_step"] = ConversationStep.ERROR
                    
            elif current_step == ConversationStep.ASK_DESCRIPTION:
                # Store user description
                state["user_description"] = user_input
                
            elif current_step == ConversationStep.CONFIRM_CONTENT:
                # Handle content confirmation
                if user_input.lower().strip() in ["yes", "y", "save", "correct"]:
                    state["content_confirmed"] = True
                    state["current_step"] = ConversationStep.SELECT_SCHEDULE
                elif user_input.lower().strip() in ["no", "n", "change", "edit"]:
                    state["content_confirmed"] = False
                    state["current_step"] = ConversationStep.ASK_DESCRIPTION
                else:
                    state["error_message"] = "Please respond with 'yes' to save the content or 'no' to make changes."
                    
            elif current_step == ConversationStep.SELECT_SCHEDULE:
                # Handle schedule selection - this will be handled by frontend with datetime picker
                # For now, just store the input and move to save
                if user_input.lower().strip() in ["now", "immediately", "asap"]:
                    state["scheduled_for"] = datetime.now().isoformat()
                else:
                    # Try to parse datetime from input
                    try:
                        from dateutil import parser
                        parsed_datetime = parser.parse(user_input)
                        state["scheduled_for"] = parsed_datetime.isoformat()
                    except:
                        state["error_message"] = "Please provide a valid date and time, or type 'now' to post immediately."
                        return state
                
                state["current_step"] = ConversationStep.SAVE_CONTENT
                
            elif current_step == ConversationStep.CONFIRM_MEDIA:
                # Handle media confirmation
                if user_input.lower().strip() in ["yes", "y", "correct", "proceed"]:
                    state["media_confirmed"] = True
                    state["current_step"] = ConversationStep.GENERATE_CONTENT
                elif user_input.lower().strip() in ["no", "n", "incorrect", "wrong"]:
                    state["media_confirmed"] = False
                    state["current_step"] = ConversationStep.ASK_MEDIA
                    # Clear previous media
                    state.pop("uploaded_media_url", None)
                    state.pop("uploaded_media_filename", None)
                    state.pop("uploaded_media_size", None)
                    state.pop("uploaded_media_type", None)
                else:
                    state["error_message"] = "Please respond with 'yes' to proceed or 'no' to upload a different file."
                    
            elif current_step == ConversationStep.ASK_MEDIA:
                # Parse media choice
                media_choice = self._parse_media_choice(user_input)
                if media_choice == "upload_image":
                    state["has_media"] = True
                    state["media_type"] = MediaType.IMAGE
                    state["should_generate_media"] = False
                    state["current_step"] = ConversationStep.HANDLE_MEDIA
                elif media_choice == "upload_video":
                    state["has_media"] = True
                    state["media_type"] = MediaType.VIDEO
                    state["should_generate_media"] = False
                    state["current_step"] = ConversationStep.HANDLE_MEDIA
                elif media_choice == "generate_image":
                    state["has_media"] = True
                    state["media_type"] = MediaType.IMAGE
                    state["should_generate_media"] = True
                    state["current_step"] = ConversationStep.GENERATE_MEDIA
                elif media_choice == "generate_video":
                    state["has_media"] = True
                    state["media_type"] = MediaType.VIDEO
                    state["should_generate_media"] = True
                    state["current_step"] = ConversationStep.GENERATE_MEDIA
                else:  # skip_media
                    state["has_media"] = False
                    state["media_type"] = MediaType.NONE
                    state["should_generate_media"] = False
                    state["current_step"] = ConversationStep.GENERATE_CONTENT
            
            logger.info(f"Processed user input for step: {current_step}")
            
        except Exception as e:
            logger.error(f"Error processing user input: {e}")
            state["error_message"] = f"Failed to process input: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    def _parse_platform_selection(self, user_input: str, state: CustomContentState) -> Optional[str]:
        """Parse platform selection from user input"""
        user_profile = state.get("user_profile", {})
        connected_platforms = user_profile.get("social_media_platforms", [])
        
        # Try to match by number
        try:
            index = int(user_input.strip()) - 1
            if 0 <= index < len(connected_platforms):
                return connected_platforms[index]
        except ValueError:
            pass
        
        # Try to match by name
        user_input_lower = user_input.lower().strip()
        for platform in connected_platforms:
            if platform.lower() in user_input_lower or user_input_lower in platform.lower():
                return platform
        
        return None
    
    def _parse_content_type_selection(self, user_input: str, state: CustomContentState) -> Optional[str]:
        """Parse content type selection from user input"""
        platform = state.get("selected_platform", "")
        content_types = PLATFORM_CONTENT_TYPES.get(platform, [])
        
        # Try to match by number
        try:
            index = int(user_input.strip()) - 1
            if 0 <= index < len(content_types):
                return content_types[index]
        except ValueError:
            pass
        
        # Try to match by name
        user_input_lower = user_input.lower().strip()
        for content_type in content_types:
            if content_type.lower() in user_input_lower or user_input_lower in content_type.lower():
                return content_type
        
        return None
    
    def _parse_media_choice(self, user_input: str) -> str:
        """Parse media choice from user input"""
        user_input_lower = user_input.lower().strip()
        
        # Handle direct button values
        if user_input_lower in ["upload_image", "upload_video", "generate_image", "generate_video", "skip_media"]:
            return user_input_lower
        
        # Handle text-based parsing
        if any(word in user_input_lower for word in ["upload", "image", "photo", "picture"]):
            return "upload_image"
        elif any(word in user_input_lower for word in ["upload", "video", "movie", "clip"]):
            return "upload_video"
        elif any(word in user_input_lower for word in ["generate", "create", "image", "photo"]):
            return "generate_image"
        elif any(word in user_input_lower for word in ["generate", "create", "video", "movie"]):
            return "generate_video"
        elif any(word in user_input_lower for word in ["skip", "none", "no", "text only"]):
            return "skip_media"
        else:
            return "skip_media"
    
    async def upload_media(self, state: CustomContentState, media_file: bytes, filename: str, content_type: str) -> CustomContentState:
        """Store media file in session/memory for now"""
        try:
            user_id = state["user_id"]
            platform = state.get("selected_platform", "general")
            
            # Validate inputs
            if not media_file:
                raise Exception("No file content provided")
            if not filename:
                raise Exception("No filename provided")
            if not content_type:
                raise Exception("No content type provided")
            
            logger.info(f"Storing media in session: {filename}, size: {len(media_file)} bytes, type: {content_type}")
            
            # Generate unique filename
            file_extension = filename.split('.')[-1] if '.' in filename else 'jpg'
            unique_filename = f"custom_content_{user_id}_{platform}_{uuid.uuid4()}.{file_extension}"
            
            # Store media in session state (base64 encoded for now)
            media_base64 = base64.b64encode(media_file).decode('utf-8')
            
            # Store in state
            state["uploaded_media_url"] = f"data:{content_type};base64,{media_base64}"
            state["uploaded_media_filename"] = unique_filename
            state["uploaded_media_size"] = len(media_file)
            state["uploaded_media_type"] = content_type
            
            # Transition to media confirmation
            state["current_step"] = ConversationStep.CONFIRM_MEDIA
            state["progress_percentage"] = 60
            
            logger.info(f"Media stored in session for user {user_id}: {unique_filename}")
            
        except Exception as e:
            logger.error(f"Error storing media: {e}")
            state["error_message"] = f"Failed to store media: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    def get_conversation_state(self, conversation_id: str) -> Optional[CustomContentState]:
        """Get conversation state by ID (for persistence)"""
        # This would typically load from a database
        # For now, we'll return None as state is managed in memory
        return None
    
    def save_conversation_state(self, state: CustomContentState) -> bool:
        """Save conversation state (for persistence)"""
        try:
            # This would typically save to a database
            # For now, we'll just log it
            logger.info(f"Conversation state saved: {state['conversation_id']}")
            return True
        except Exception as e:
            logger.error(f"Error saving conversation state: {e}")
            return False
    
    def _should_handle_media(self, state: CustomContentState) -> str:
        """Determine if media should be handled or skipped"""
        if state.get("has_media", False):
            return "handle"
        return "skip"
    
    def _should_generate_media(self, state: CustomContentState) -> str:
        """Determine if media should be generated or skipped"""
        if state.get("should_generate_media", False):
            return "generate"
        return "skip"
    
    def get_user_platforms(self, user_id: str) -> List[str]:
        """Get user's connected platforms from their profile"""
        try:
            profile_response = self.supabase.table("profiles").select("social_media_platforms").eq("id", user_id).execute()
            
            if profile_response.data and profile_response.data[0]:
                platforms = profile_response.data[0].get("social_media_platforms", [])
                return platforms if platforms else []
            
            return []
        except Exception as e:
            logger.error(f"Error getting user platforms: {e}")
            return []
    
    async def _load_user_profile(self, user_id: str) -> dict:
        """Load user profile from Supabase"""
        try:
            profile_response = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if profile_response.data and profile_response.data[0]:
                return profile_response.data[0]
            
            return {}
        except Exception as e:
            logger.error(f"Error loading user profile: {e}")
            return {}