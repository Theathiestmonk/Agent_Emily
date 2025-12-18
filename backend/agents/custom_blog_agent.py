"""
Custom Blog Creation Agent using LangGraph
Interactive chatbot for creating custom blog posts
"""

import json
import asyncio
import logging
import uuid
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, TypedDict
from enum import Enum

import openai
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from services.token_usage_service import TokenUsageService
import requests
from requests.auth import HTTPBasicAuth
from urllib.parse import urlparse
from cryptography.fernet import Fernet

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

# Encryption setup for WordPress passwords
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if ENCRYPTION_KEY:
    try:
        cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize encryption cipher: {e}")
        cipher = None
else:
    cipher = None

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    if not cipher:
        raise ValueError("Encryption key not configured")
    try:
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        logger.error(f"Error decrypting token: {e}")
        raise

class BlogType(str, Enum):
    EDUCATIONAL = "educational"
    PRACTICAL_GUIDES = "practical guides"
    PROMOTIONAL = "promotional"
    STORY_BASED = "story based"

class BlogLength(str, Enum):
    SHORT = "short"  # 500-800 words
    MEDIUM = "medium"  # 800-1200 words
    LONG = "long"  # 1200+ words

class ImageOption(str, Enum):
    YES = "yes"  # image inside blog
    NO = "no"  # only featured
    BOTH = "both"  # both

class ConversationStep(str, Enum):
    GREET = "greet"
    ASK_BLOG_TYPE = "ask_blog_type"
    ASK_BLOG_TOPIC = "ask_blog_topic"
    ASK_KEYWORDS = "ask_keywords"
    ASK_BLOG_LENGTH = "ask_blog_length"
    ASK_IMAGES = "ask_images"
    HANDLE_IMAGE = "handle_image"
    CONFIRM_OUTLINE = "confirm_outline"
    GENERATE_BLOG = "generate_blog"
    ASK_SCHEDULE = "ask_schedule"
    ASK_PUBLISH_OPTION = "ask_publish_option"
    SAVE_BLOG = "save_blog"
    DISPLAY_RESULT = "display_result"
    ERROR = "error"

class CustomBlogState(TypedDict):
    """State for the custom blog creation conversation"""
    user_id: str
    conversation_id: Optional[str]
    conversation_messages: List[Dict[str, str]]
    current_step: ConversationStep
    selected_blog_type: Optional[BlogType]
    blog_topic: Optional[str]
    keywords: Optional[List[str]]
    blog_length: Optional[BlogLength]
    image_option: Optional[ImageOption]
    should_generate_image: Optional[bool]
    uploaded_image_url: Optional[str]
    generated_image_url: Optional[str]
    image_prompt: Optional[str]
    outline: Optional[str]
    generated_blog: Optional[Dict[str, Any]]
    scheduled_at: Optional[str]
    publish_option: Optional[str]  # "draft" or "publish"
    user_profile: Optional[Dict[str, Any]]
    business_context: Optional[Dict[str, Any]]
    final_blog: Optional[Dict[str, Any]]
    error_message: Optional[str]
    retry_count: int
    is_complete: bool
    progress_percentage: int

class CustomBlogAgent:
    """Custom Blog Creation Agent"""
    
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        self.client = openai.OpenAI(api_key=openai_api_key)
        self.supabase = supabase
        self.token_tracker = TokenUsageService(supabase_url, supabase_key) if supabase_url and supabase_key else None
    
    def _get_timestamp(self) -> str:
        """Get current timestamp without seconds (format: YYYY-MM-DDTHH:MM)"""
        return datetime.now().strftime('%Y-%m-%dT%H:%M')
    
    async def greet_user(self, state: CustomBlogState) -> CustomBlogState:
        """Welcome the user and initialize conversation"""
        try:
            conversation_id = str(uuid.uuid4())
            
            state["conversation_id"] = conversation_id
            state["conversation_messages"] = []
            state["current_step"] = ConversationStep.ASK_BLOG_TYPE
            state["retry_count"] = 0
            state["is_complete"] = False
            state["progress_percentage"] = 0
            
            # Load user profile and business context
            user_profile = await self._load_user_profile(state["user_id"])
            state["user_profile"] = user_profile
            state["business_context"] = self._extract_business_context(user_profile)
            
            # Load WordPress connections to link blog to default site
            wordpress_connection = await self._load_wordpress_connection(state["user_id"])
            state["wordpress_connection"] = wordpress_connection
            if wordpress_connection:
                logger.info(f"✅ WordPress connection loaded: {wordpress_connection.get('site_name')} (ID: {wordpress_connection.get('id')})")
            else:
                logger.info(f"⚠️ No WordPress connection found for user {state['user_id']}")
            
            welcome_message = {
                "role": "assistant",
                "content": "Hi! I'm Emily 👋 I'll help you create an amazing blog post. Let's start by selecting the type of blog you want to create:",
                "timestamp": self._get_timestamp(),
                "options": [
                    {"value": "educational", "label": "📚 Educational"},
                    {"value": "practical guides", "label": "📖 Practical Guides"},
                    {"value": "promotional", "label": "📢 Promotional"},
                    {"value": "story based", "label": "📖 Story Based"}
                ]
            }
            
            state["conversation_messages"].append(welcome_message)
            state["progress_percentage"] = 10
            
            logger.info(f"Greeted user {state['user_id']} for custom blog creation")
            
        except Exception as e:
            logger.error(f"Error in greet_user: {e}")
            state["error_message"] = f"Failed to initialize conversation: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_blog_type(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process blog type selection"""
        try:
            state["current_step"] = ConversationStep.ASK_BLOG_TOPIC
            state["progress_percentage"] = 20
            
            if user_input:
                # Normalize user input
                user_input_lower = user_input.lower().strip()
                
                # Map user input to blog type
                blog_type_map = {
                    "educational": BlogType.EDUCATIONAL,
                    "practical guides": BlogType.PRACTICAL_GUIDES,
                    "practical": BlogType.PRACTICAL_GUIDES,
                    "guides": BlogType.PRACTICAL_GUIDES,
                    "promotional": BlogType.PROMOTIONAL,
                    "promo": BlogType.PROMOTIONAL,
                    "story based": BlogType.STORY_BASED,
                    "story": BlogType.STORY_BASED
                }
                
                # Try to find matching blog type
                selected_type = None
                for key, blog_type in blog_type_map.items():
                    if key in user_input_lower:
                        selected_type = blog_type
                        break
                
                if not selected_type:
                    # Default to first option if no match
                    selected_type = BlogType.EDUCATIONAL
                
                state["selected_blog_type"] = selected_type
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
            
            # Ask for blog topic with dynamic question based on type
            blog_type = state.get("selected_blog_type", BlogType.EDUCATIONAL)
            
            topic_questions = {
                BlogType.EDUCATIONAL: "What educational topic would you like to write about?",
                BlogType.PRACTICAL_GUIDES: "What practical guide would you like to create? What topic or skill should it cover?",
                BlogType.PROMOTIONAL: "What product or service would you like to promote? Please describe it:",
                BlogType.STORY_BASED: "What story would you like to tell? What's the main theme or narrative?"
            }
            
            question = topic_questions.get(blog_type, "What topic would you like to write about?")
            
            message = {
                "role": "assistant",
                "content": f"Great choice! {question}",
                "timestamp": self._get_timestamp()
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user for blog topic (type: {blog_type})")
            
        except Exception as e:
            logger.error(f"Error in ask_blog_type: {e}")
            state["error_message"] = f"Failed to process blog type: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_blog_topic(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process blog topic and move to keywords"""
        try:
            state["current_step"] = ConversationStep.ASK_KEYWORDS
            state["progress_percentage"] = 30
            
            if user_input:
                state["blog_topic"] = user_input.strip()
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
            
            message = {
                "role": "assistant",
                "content": "Perfect! Now, would you like to provide up to 3 primary keywords for SEO? (This is optional)",
                "timestamp": self._get_timestamp(),
                "options": [
                    {"value": "skip", "label": "⏭️ Skip (Use AI suggestions)"}
                ]
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user for keywords (topic: {state.get('blog_topic')})")
            
        except Exception as e:
            logger.error(f"Error in ask_blog_topic: {e}")
            state["error_message"] = f"Failed to process blog topic: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_keywords(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process keywords and move to blog length"""
        try:
            state["current_step"] = ConversationStep.ASK_BLOG_LENGTH
            state["progress_percentage"] = 40
            
            # Handle both None and empty string cases
            user_input_clean = (user_input or "").strip().lower()
            
            # Handle skip option - check for various skip variations
            if not user_input_clean or user_input_clean in ["skip", "⏭️ skip", "skip (use ai suggestions)"] or "skip" in user_input_clean:
                # Generate keywords using AI when user skips
                keywords = await self._suggest_keywords(state)
                state["keywords"] = keywords
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": "Skip",
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
                
                message = {
                    "role": "assistant",
                    "content": f"Got it! I've suggested these keywords for you: {', '.join(keywords)}",
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(message)
            elif user_input_clean:
                    # Parse keywords - can be comma-separated, space-separated, or JSON array
                    try:
                        # Try to parse as JSON first (for structured input from frontend)
                        keywords_data = json.loads(user_input_clean)
                        if isinstance(keywords_data, dict) and "keywords" in keywords_data:
                            keywords = [k.strip() for k in keywords_data["keywords"] if k.strip()][:3]
                        elif isinstance(keywords_data, list):
                            keywords = [k.strip() for k in keywords_data if k.strip()][:3]
                        else:
                            keywords = [k.strip() for k in user_input_clean.replace(',', ' ').split()[:3]]
                    except json.JSONDecodeError:
                        # Not JSON, parse as text
                        keywords = [k.strip() for k in user_input_clean.replace(',', ' ').split()[:3]]
                    
                    state["keywords"] = keywords
                    
                    # Add user message
                    user_message = {
                        "role": "user",
                        "content": user_input,
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(user_message)
                    
                    if keywords:
                        message = {
                            "role": "assistant",
                            "content": f"Great! I'll use these keywords: {', '.join(keywords)}",
                            "timestamp": self._get_timestamp()
                        }
                        state["conversation_messages"].append(message)
                    else:
                    # Generate keywords using AI if parsing resulted in empty keywords
                        keywords = await self._suggest_keywords(state)
                        state["keywords"] = keywords
                    message = {
                        "role": "assistant",
                        "content": f"No problem! I've suggested these keywords for you: {', '.join(keywords)}",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
            
            # Ask for blog length
            message = {
                "role": "assistant",
                "content": "What length would you like for your blog post?",
                "timestamp": self._get_timestamp(),
                "options": [
                    {"value": "short", "label": "📝 Short (500-800 words)"},
                    {"value": "medium", "label": "📄 Medium (800-1200 words)"},
                    {"value": "long", "label": "📚 Long (1200+ words)"}
                ]
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user for blog length (keywords: {state.get('keywords')})")
            
        except Exception as e:
            logger.error(f"Error in ask_keywords: {e}")
            state["error_message"] = f"Failed to process keywords: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_blog_length(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process blog length and move to images"""
        try:
            state["current_step"] = ConversationStep.ASK_IMAGES
            state["progress_percentage"] = 50
            
            if user_input:
                user_input_lower = user_input.lower().strip()
                
                # Map user input to blog length
                length_map = {
                    "short": BlogLength.SHORT,
                    "medium": BlogLength.MEDIUM,
                    "long": BlogLength.LONG
                }
                
                selected_length = length_map.get(user_input_lower, BlogLength.MEDIUM)
                state["blog_length"] = selected_length
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
            
            # Ask about images - simple yes/no
            message = {
                "role": "assistant",
                "content": "Do you want to add an image to your blog post?",
                "timestamp": self._get_timestamp(),
                "options": [
                    {"value": "yes", "label": "✅ Yes"},
                    {"value": "no", "label": "❌ No"}
                ]
            }
            state["conversation_messages"].append(message)
            
            logger.info(f"Asked user for image option (length: {state.get('blog_length')})")
            
        except Exception as e:
            logger.error(f"Error in ask_blog_length: {e}")
            state["error_message"] = f"Failed to process blog length: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_images(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process image option - if yes, continue to image handling; if no, skip to outline"""
        try:
            if user_input:
                user_input_lower = user_input.lower().strip()
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
            
                if user_input_lower == "no":
                    # User doesn't want images - skip image steps and go directly to outline
                    state["image_option"] = ImageOption.NO
                    state["should_generate_image"] = False
                    state["uploaded_image_url"] = None
                    state["generated_image_url"] = None
                    
                    message = {
                        "role": "assistant",
                        "content": "Got it! I'll proceed without images. Now let me create an outline for your blog post...",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    
                    # Skip to outline generation
                    state["current_step"] = ConversationStep.CONFIRM_OUTLINE
                    state["progress_percentage"] = 60
                    
                    # Generate outline directly
                    outline = await self._generate_outline(state)
                    state["outline"] = outline
                    
                    # Ask for outline confirmation
                    message = {
                        "role": "assistant",
                        "content": f"Perfect! I've created an outline for your blog post:\n\n{outline}\n\nWould you like me to proceed with writing the blog based on this outline?",
                        "timestamp": self._get_timestamp(),
                        "options": [
                            {"value": "yes", "label": "✅ Yes, proceed"},
                            {"value": "no", "label": "❌ No, let me revise"}
                        ]
                    }
                    state["conversation_messages"].append(message)
                    
                    logger.info(f"User chose no images, skipped to outline generation")
                    return state
                elif user_input_lower == "yes":
                    # User wants images - continue to image handling
                    state["image_option"] = ImageOption.YES
                    state["current_step"] = ConversationStep.HANDLE_IMAGE
                    state["progress_percentage"] = 55
                    
                    message = {
                        "role": "assistant",
                        "content": "Great! How would you like to add an image to your blog?",
                        "timestamp": self._get_timestamp(),
                        "options": [
                            {"value": "generate", "label": "🎨 Generate image with AI"},
                            {"value": "upload", "label": "📤 Upload my own image"},
                            {"value": "skip", "label": "⏭️ Skip for now"}
                        ]
                    }
                    state["conversation_messages"].append(message)
                    
                    logger.info(f"User chose yes for images, proceeding to image handling")
                    return state
                else:
                    # Invalid input - ask again
                    message = {
                        "role": "assistant",
                        "content": "Please choose 'Yes' or 'No'. Do you want to add an image to your blog post?",
                        "timestamp": self._get_timestamp(),
                        "options": [
                            {"value": "yes", "label": "✅ Yes"},
                            {"value": "no", "label": "❌ No"}
                        ]
                    }
                    state["conversation_messages"].append(message)
                    return state
            else:
                # No user input yet - this shouldn't happen, but handle gracefully
                state["current_step"] = ConversationStep.ASK_IMAGES
                state["progress_percentage"] = 50
            
            logger.info(f"Processed image option (image option: {state.get('image_option')})")
            
        except Exception as e:
            logger.error(f"Error in ask_images: {e}")
            state["error_message"] = f"Failed to process image option: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def handle_image(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Handle image generation or upload"""
        try:
            state["progress_percentage"] = 58
            should_proceed = False  # Initialize flag
            
            if user_input:
                user_input_lower = user_input.lower().strip()
                
                if user_input_lower == "generate":
                    state["should_generate_image"] = True
                    # Image generation will be handled by API endpoint
                    # Stay in HANDLE_IMAGE step to wait for image generation
                    state["current_step"] = ConversationStep.HANDLE_IMAGE
                    message = {
                        "role": "assistant",
                        "content": "Great! I'm generating an image for your blog post. This may take a moment...",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    return state
                elif user_input_lower == "upload":
                    state["should_generate_image"] = False
                    # Image upload will be handled by frontend/API
                    # Stay in HANDLE_IMAGE step to wait for upload
                    state["current_step"] = ConversationStep.HANDLE_IMAGE
                    message = {
                        "role": "assistant",
                        "content": "Please upload your image below:",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    return state
                elif user_input_lower == "approve":
                    # User approved the generated image, proceed to outline
                    user_message = {
                        "role": "user",
                        "content": "I approve this image",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(user_message)
                    message = {
                        "role": "assistant",
                        "content": "Perfect! Image approved. Now let me create an outline for your blog post...",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    # Continue to outline generation (don't return early)
                elif user_input_lower == "regenerate":
                    # User wants to regenerate image, clear current image
                    state["generated_image_url"] = None
                    user_message = {
                        "role": "user",
                        "content": "Regenerate image",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(user_message)
                    message = {
                        "role": "assistant",
                        "content": "No problem! I'll generate a new image for you. This may take a moment...",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    # Stay in HANDLE_IMAGE step - frontend will call generate-image endpoint again
                    state["current_step"] = ConversationStep.HANDLE_IMAGE
                    state["should_generate_image"] = True  # Set flag to trigger regeneration
                    return state
                elif user_input_lower in ["uploaded", "generated", "skip"]:
                    # Image has been uploaded/generated or skipped, proceed to outline
                    if user_input_lower == "skip":
                        state["should_generate_image"] = False
                        state["uploaded_image_url"] = None
                        state["generated_image_url"] = None
                        # Add confirmation message for skip
                        message = {
                            "role": "assistant",
                            "content": "No problem! I'll proceed without images. Now let me create an outline for your blog post...",
                            "timestamp": self._get_timestamp()
                        }
                        state["conversation_messages"].append(message)
                    # Add confirmation message if image was handled
                    elif user_input_lower == "uploaded" and state.get("uploaded_image_url"):
                        user_message = {
                            "role": "user",
                            "content": "Image uploaded",
                            "timestamp": self._get_timestamp()
                        }
                        state["conversation_messages"].append(user_message)
                        message = {
                            "role": "assistant",
                            "content": "Perfect! Image uploaded successfully. Now let me create an outline for your blog post...",
                            "timestamp": self._get_timestamp()
                        }
                        state["conversation_messages"].append(message)
                    elif user_input_lower == "generated" and state.get("generated_image_url"):
                        # This case is now handled by approve/regenerate flow
                        pass
                else:
                    state["should_generate_image"] = False
                
                # Add user message if not already added
                if user_input_lower not in ["uploaded", "generated", "approve"]:
                    user_message = {
                        "role": "user",
                        "content": user_input,
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(user_message)
                
                # Check if we should proceed to outline generation
                # Only proceed if user approved, skipped, or uploaded image
                if user_input_lower in ["approve", "skip"]:
                    # User approved or skipped - proceed to outline
                    should_proceed = True
                elif user_input_lower == "uploaded" and state.get("uploaded_image_url"):
                    # Image uploaded - proceed to outline
                    should_proceed = True
                elif user_input_lower in ["generate", "upload", "regenerate"]:
                    # User is still in image selection/generation - don't proceed yet
                    should_proceed = False
                    return state
                else:
                    # Unknown input - don't proceed
                    should_proceed = False
                    return state
            else:
                # No user input - first time in handle_image, don't generate outline yet
                should_proceed = False
                return state
            
            # Generate outline (after image is approved, skipped, or uploaded)
            if should_proceed:
                state["current_step"] = ConversationStep.CONFIRM_OUTLINE
                state["progress_percentage"] = 60
                outline = await self._generate_outline(state)
                state["outline"] = outline
                
                # Ask for outline confirmation
                message = {
                    "role": "assistant",
                    "content": f"Perfect! I've created an outline for your blog post:\n\n{outline}\n\nWould you like me to proceed with writing the blog based on this outline?",
                    "timestamp": self._get_timestamp(),
                    "options": [
                        {"value": "yes", "label": "✅ Yes, proceed"},
                        {"value": "no", "label": "❌ No, let me revise"}
                    ]
                }
                state["conversation_messages"].append(message)
                
                logger.info(f"Generated outline and asked for confirmation")
            
        except Exception as e:
            logger.error(f"Error in handle_image: {e}")
            state["error_message"] = f"Failed to handle image: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def confirm_outline(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process outline confirmation and generate blog"""
        try:
            # Check if blog is already generated
            if state.get("generated_blog"):
                # Blog is already generated, check if user is confirming it
                if user_input:
                    user_input_lower = user_input.lower().strip()
                    
                    # Add user message
                    user_message = {
                        "role": "user",
                        "content": user_input,
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(user_message)
                    
                    if "no" in user_input_lower or "revise" in user_input_lower or "change" in user_input_lower:
                        # Go back to ask_images to regenerate
                        state["current_step"] = ConversationStep.ASK_IMAGES
                        state["generated_blog"] = None  # Clear generated blog
                        message = {
                            "role": "assistant",
                            "content": "No problem! Let me regenerate the blog. Would you like to change the image option?",
                            "timestamp": self._get_timestamp()
                        }
                        state["conversation_messages"].append(message)
                        return state
                    elif "yes" in user_input_lower or "great" in user_input_lower or "good" in user_input_lower:
                        # User confirmed, proceed to schedule
                        return await self.ask_schedule(state)
                else:
                    # No user input yet, blog is generated, wait for confirmation
                    return state
            
            # Blog not generated yet, proceed with generation
            state["current_step"] = ConversationStep.GENERATE_BLOG
            state["progress_percentage"] = 70
            
            if user_input:
                user_input_lower = user_input.lower().strip()
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
                
                if "no" in user_input_lower or "revise" in user_input_lower:
                    # Go back to ask_images to regenerate outline
                    state["current_step"] = ConversationStep.ASK_IMAGES
                    message = {
                        "role": "assistant",
                        "content": "No problem! Let me regenerate the outline. Would you like to change the image option?",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    return state
            
            # Generate blog content
            state["progress_percentage"] = 80
            message = {
                "role": "assistant",
                "content": "Great! I'm now writing your blog post. This may take a moment...",
                "timestamp": self._get_timestamp()
            }
            state["conversation_messages"].append(message)
            
            blog_content = await self._generate_blog_content(state)
            state["generated_blog"] = blog_content
            state["progress_percentage"] = 85
            
            # Display generated blog and ask for confirmation
            blog_text = blog_content.get("content", "")
            title = blog_content.get("title", "Untitled Blog Post")
            
            # Get featured image if available
            featured_image = state.get("generated_image_url") or state.get("uploaded_image_url")
            
            # Build preview message with image if available
            preview_content = f"Perfect! I've written your blog post:\n\n**{title}**\n\n"
            if featured_image:
                preview_content += f"![Featured Image]({featured_image})\n\n"
            preview_content += f"{blog_text}\n\nDoes this look good to you?"
            
            message = {
                "role": "assistant",
                "content": preview_content,
                "timestamp": self._get_timestamp(),
                "image_url": featured_image if featured_image else None,
                "options": [
                    {"value": "yes", "label": "✅ Yes, it looks great!"},
                    {"value": "no", "label": "❌ No, let me make changes"}
                ]
            }
            state["conversation_messages"].append(message)
            state["current_step"] = ConversationStep.CONFIRM_OUTLINE
            
            logger.info(f"Generated blog content (title: {title})")
            
            # Wait for user confirmation before proceeding to schedule
            return state
            
        except Exception as e:
            logger.error(f"Error in confirm_outline: {e}")
            state["error_message"] = f"Failed to generate blog: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def generate_blog(self, state: CustomBlogState) -> CustomBlogState:
        """Generate blog content (called from confirm_outline)"""
        return await self.confirm_outline(state)
    
    async def ask_schedule(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Ask user for schedule/timeline - combined with publish/draft options"""
        try:
            state["progress_percentage"] = 85
            
            if user_input:
                # Parse schedule input (can be "now", "schedule", "draft", or datetime string)
                user_input_clean = user_input.strip().lower()
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
                
                if user_input_clean == "now" or user_input_clean == "publish":
                    # Publish now - save directly as published
                    state["scheduled_at"] = None
                    state["publish_option"] = "publish"
                    # Save directly without extra steps
                    return await self.save_blog(state)
                elif user_input_clean == "draft":
                    # Save as draft - save directly as draft
                    state["scheduled_at"] = None
                    state["publish_option"] = "draft"
                    # Save directly without extra steps
                    return await self.save_blog(state)
                elif user_input_clean == "schedule":
                    # User wants to schedule - stay in ASK_SCHEDULE step to show date/time inputs
                    # Frontend will show date/time inputs
                    state["current_step"] = ConversationStep.ASK_SCHEDULE
                    message = {
                        "role": "assistant",
                        "content": "Please select a date and time for scheduling:",
                        "timestamp": self._get_timestamp()
                    }
                    state["conversation_messages"].append(message)
                    return state
                else:
                    # Try to parse as datetime (from date/time inputs)
                    try:
                        # Handle ISO format (YYYY-MM-DDTHH:MM)
                        scheduled_datetime = datetime.fromisoformat(user_input.replace('Z', '+00:00'))
                        state["scheduled_at"] = scheduled_datetime.isoformat()
                        # If scheduled, set publish_option to "publish" and save directly as scheduled
                        state["publish_option"] = "publish"
                        # Automatically proceed to save blog (skip publish option step)
                        return await self.save_blog(state)
                    except:
                        # If parsing fails, treat as "now" and publish
                        state["scheduled_at"] = None
                        state["publish_option"] = "publish"
                        return await self.save_blog(state)
            else:
                # First time asking - show all options in one step
                state["current_step"] = ConversationStep.ASK_SCHEDULE
                state["progress_percentage"] = 85
                message = {
                    "role": "assistant",
                    "content": "How would you like to proceed with this blog post?",
                    "timestamp": self._get_timestamp(),
                    "options": [
                        {"value": "publish", "label": "🚀 Publish Now"},
                        {"value": "schedule", "label": "�� Schedule for Later"},
                        {"value": "draft", "label": "💾 Save as Draft"}
                    ]
                }
                state["conversation_messages"].append(message)
                return state
            
        except Exception as e:
            logger.error(f"Error in ask_schedule: {e}")
            state["error_message"] = f"Failed to process schedule: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def ask_publish_option(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Process publish option and save blog"""
        try:
            state["progress_percentage"] = 90
            
            if user_input:
                user_input_lower = user_input.lower().strip()
                
                if "publish" in user_input_lower or "now" in user_input_lower:
                    state["publish_option"] = "publish"
                else:
                    # Default to draft if not explicitly publish
                    state["publish_option"] = "draft"
                
                # Add user message
                user_message = {
                    "role": "user",
                    "content": user_input,
                    "timestamp": self._get_timestamp()
                }
                state["conversation_messages"].append(user_message)
                
                # Move to save blog
                return await self.save_blog(state)
            else:
                # First time asking - show publish options (only when "Publish Now" was selected from schedule)
                state["current_step"] = ConversationStep.ASK_PUBLISH_OPTION
                state["progress_percentage"] = 90
                message = {
                    "role": "assistant",
                    "content": "How would you like to save this blog post?",
                    "timestamp": self._get_timestamp(),
                    "options": [
                        {"value": "publish", "label": "🚀 Publish Now"},
                        {"value": "draft", "label": "💾 Save as Draft"}
                    ]
                }
                state["conversation_messages"].append(message)
                return state
            
        except Exception as e:
            logger.error(f"Error in ask_publish_option: {e}")
            state["error_message"] = f"Failed to process publish option: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def save_blog(self, state: CustomBlogState) -> CustomBlogState:
        """Save blog to database"""
        try:
            state["current_step"] = ConversationStep.DISPLAY_RESULT
            state["progress_percentage"] = 100
            
            generated_blog = state.get("generated_blog")
            if not generated_blog:
                raise ValueError("No blog content to save")
            
            # Determine status based on publish option
            publish_option = state.get("publish_option", "draft")
            status = "published" if publish_option == "publish" else "draft"
            
            # Get scheduled_at if provided
            scheduled_at = state.get("scheduled_at")
            # Ensure scheduled_at is properly formatted as ISO string if provided
            if scheduled_at:
                try:
                    # If it's already a string, parse and reformat to ensure proper ISO format
                    if isinstance(scheduled_at, str):
                        # Parse the datetime string
                        scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                        scheduled_at = scheduled_datetime.isoformat()
                    elif isinstance(scheduled_at, datetime):
                        scheduled_at = scheduled_at.isoformat()
                except Exception as e:
                    logger.warning(f"Error parsing scheduled_at: {e}, setting to None")
                    scheduled_at = None
                
            if scheduled_at and status == "published":
                status = "scheduled"
            else:
                scheduled_at = None
            
            # Get featured image URL if available
            featured_image = state.get("generated_image_url") or state.get("uploaded_image_url")
            
            # Get WordPress connection if available
            wordpress_connection = state.get("wordpress_connection")
            # If wordpress_connection is not in state, try to reload it
            if not wordpress_connection:
                logger.info("⚠️ WordPress connection not found in state, attempting to reload...")
                wordpress_connection = await self._load_wordpress_connection(state.get("user_id"))
                if wordpress_connection:
                    state["wordpress_connection"] = wordpress_connection
                    logger.info(f"✅ WordPress connection reloaded: {wordpress_connection.get('site_name')}")
            
            wordpress_site_id = None
            site_name = None
            website_url = None
            
            if wordpress_connection:
                wordpress_site_id = wordpress_connection.get("id")
                site_name = wordpress_connection.get("site_name", "")
                website_url = wordpress_connection.get("site_url", "")
                logger.info(f"🔗 Linking blog to WordPress site: {site_name} (ID: {wordpress_site_id}, URL: {website_url})")
            else:
                logger.info(f"⚠️ No WordPress connection in state - blog will be standalone")
            
            # Generate slug from title (same logic as regular blog creation)
            title = generated_blog.get("title", "Untitled Blog Post")
            slug = re.sub(r'[^\w\s-]', '', title.lower())  # Remove special characters
            slug = re.sub(r'[-\s]+', '-', slug)  # Replace spaces and multiple dashes with single dash
            slug = slug.strip('-')[:200]  # Remove leading/trailing dashes and limit length
            
            # Ensure slug is unique by appending timestamp if needed
            existing_slug_check = self.supabase.table("blog_posts").select("id").eq("slug", slug).execute()
            if existing_slug_check.data:
                slug = f"{slug}-{int(datetime.now().timestamp())}"
            
            # Get metadata and add featured_image to it (same as regular blog creation)
            metadata = {
                "blog_type": state.get("selected_blog_type"),
                "blog_length": state.get("blog_length"),
                "image_option": state.get("image_option"),
                "generated_via": "custom_blog_chatbot"
            }
            
            # Store featured_image in metadata if provided
            if featured_image:
                metadata['featured_image'] = featured_image
            
            # Prepare excerpt from actual blog content (not outline)
            blog_content = generated_blog.get("content", "")
            # Remove HTML tags for excerpt
            clean_content = re.sub(r'<[^>]+>', '', blog_content)  # Remove HTML tags
            clean_content = clean_content.replace('\n', ' ').strip()  # Remove newlines
            # Create excerpt from first 200 characters of actual content
            excerpt = generated_blog.get("excerpt", "")
            if not excerpt or len(excerpt) < 50:  # If excerpt is too short or missing, use content
                excerpt = clean_content[:200] + ('...' if len(clean_content) > 200 else '')
            
            # Clean blog content - remove [IMAGE: ...] placeholders
            # These are just placeholders and shouldn't appear in final content
            cleaned_content = re.sub(r'\[IMAGE:[^\]]+\]', '', blog_content)
            cleaned_content = cleaned_content.strip()
            
            # Prepare blog data (matching regular blog creation structure)
            blog_data = {
                "id": str(uuid.uuid4()),
                "title": title,
                "content": cleaned_content,  # Use cleaned content without image placeholders
                "excerpt": excerpt,
                "slug": slug,
                "status": status.lower(),  # Normalize to lowercase
                "post_type": "post",  # Default post type
                "format": "standard",  # Default format
                "categories": [state.get("selected_blog_type", "educational")],
                "tags": [],  # Don't use keywords as tags - keywords are for SEO in content only
                "word_count": generated_blog.get("word_count", 0),
                "reading_time": generated_blog.get("reading_time", 0),
                "author_id": state.get("user_id"),
                "scheduled_at": scheduled_at,  # ISO format datetime string or None
                "wordpress_site_id": wordpress_site_id,  # Link to WordPress if connection exists
                "site_name": site_name,  # WordPress site name (stored in metadata if column doesn't exist)
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "metadata": metadata
            }
            
            # Store website_url in metadata since the column doesn't exist in blog_posts table
            if website_url:
                blog_data["metadata"]["website_url"] = website_url
            
            # Save to database using self.supabase (service role client)
            logger.info(f"💾 Saving blog to database: {blog_data.get('title')}")
            logger.info(f"   - WordPress Site ID: {blog_data.get('wordpress_site_id')}")
            logger.info(f"   - Site Name: {blog_data.get('site_name')}")
            logger.info(f"   - Website URL: {blog_data.get('metadata', {}).get('website_url', 'N/A')}")
            logger.info(f"   - Status: {blog_data.get('status')}")
            logger.info(f"   - Scheduled At: {blog_data.get('scheduled_at')}")
            response = self.supabase.table("blog_posts").insert(blog_data).execute()
            
            if not response.data:
                raise ValueError("Failed to save blog to database")
            
            saved_blog = response.data[0]
            
            # Verify saved blog has WordPress connection data
            logger.info(f"✅ Blog saved successfully!")
            logger.info(f"   - Saved Blog ID: {saved_blog.get('id')}")
            logger.info(f"   - Saved WordPress Site ID: {saved_blog.get('wordpress_site_id')}")
            logger.info(f"   - Saved Site Name: {saved_blog.get('site_name')}")
            logger.info(f"   - Saved Website URL: {saved_blog.get('metadata', {}).get('website_url', 'N/A')}")
            logger.info(f"   - Saved Scheduled At: {saved_blog.get('scheduled_at')}")
            
            # If status is "published" and WordPress connection exists, publish to WordPress
            wordpress_post_id = None
            logger.info(f"🔍 Checking publish conditions:")
            logger.info(f"   - Status: '{status}'")
            logger.info(f"   - WordPress Site ID: {wordpress_site_id}")
            logger.info(f"   - WordPress Connection exists: {wordpress_connection is not None}")
            if wordpress_connection:
                logger.info(f"   - WordPress Connection ID: {wordpress_connection.get('id')}")
            
            if status == "published" and wordpress_site_id and wordpress_connection:
                try:
                    logger.info(f"🚀 Publishing blog to WordPress...")
                    wordpress_post_id = await self._publish_to_wordpress(saved_blog, wordpress_connection)
                    if wordpress_post_id:
                        # Update blog with WordPress post ID
                        self.supabase.table("blog_posts").update({
                            "wordpress_post_id": wordpress_post_id,
                            "published_at": datetime.now().isoformat()
                        }).eq("id", saved_blog['id']).execute()
                        logger.info(f"✅ Blog published to WordPress with post ID: {wordpress_post_id}")
                        saved_blog['wordpress_post_id'] = wordpress_post_id
                    else:
                        logger.warning(f"⚠️ Failed to publish to WordPress, but blog saved as published")
                except Exception as e:
                    logger.error(f"❌ Error publishing to WordPress: {e}", exc_info=True)
                    # Don't fail the whole operation, just log the error
                    # The blog is still saved as "published" in the database
            else:
                if status != "published":
                    logger.info(f"⏭️ Skipping WordPress publish - status is '{status}', not 'published'")
                elif not wordpress_site_id:
                    logger.info(f"⏭️ Skipping WordPress publish - no WordPress site ID")
                elif not wordpress_connection:
                    logger.info(f"⏭️ Skipping WordPress publish - no WordPress connection")
            
            state["final_blog"] = saved_blog
            state["is_complete"] = True
            
            status_text = "published" if status == "published" else ("scheduled" if status == "scheduled" else "saved as draft")
            if wordpress_post_id:
                message = {
                    "role": "assistant",
                    "content": f"🎉 Success! Your blog post '{saved_blog['title']}' has been {status_text} and is now live on WordPress! You can find it in your blog dashboard!",
                    "timestamp": self._get_timestamp()
                }
            else:
                message = {
                    "role": "assistant",
                    "content": f"🎉 Success! Your blog post '{saved_blog['title']}' has been {status_text}. You can find it in your blog dashboard!",
                    "timestamp": self._get_timestamp()
                }
            state["conversation_messages"].append(message)
            
            logger.info(f"Blog saved successfully: {saved_blog['id']}")
            
        except Exception as e:
            logger.error(f"Error in save_blog: {e}")
            state["error_message"] = f"Failed to save blog: {str(e)}"
            state["current_step"] = ConversationStep.ERROR
            
        return state
    
    async def execute_conversation_step(self, state: CustomBlogState, user_input: str = None) -> CustomBlogState:
        """Execute the current conversation step"""
        try:
            current_step = state.get("current_step", ConversationStep.GREET)
            
            logger.info(f"Executing conversation step: {current_step}")
            
            if current_step == ConversationStep.GREET:
                result = await self.greet_user(state)
            elif current_step == ConversationStep.ASK_BLOG_TYPE:
                result = await self.ask_blog_type(state, user_input)
            elif current_step == ConversationStep.ASK_BLOG_TOPIC:
                result = await self.ask_blog_topic(state, user_input)
            elif current_step == ConversationStep.ASK_KEYWORDS:
                result = await self.ask_keywords(state, user_input)
            elif current_step == ConversationStep.ASK_BLOG_LENGTH:
                result = await self.ask_blog_length(state, user_input)
            elif current_step == ConversationStep.ASK_IMAGES:
                result = await self.ask_images(state, user_input)
            elif current_step == ConversationStep.CONFIRM_OUTLINE:
                result = await self.confirm_outline(state, user_input)
            elif current_step == ConversationStep.GENERATE_BLOG:
                result = await self.generate_blog(state)
            elif current_step == ConversationStep.HANDLE_IMAGE:
                result = await self.handle_image(state, user_input)
            elif current_step == ConversationStep.ASK_SCHEDULE:
                result = await self.ask_schedule(state, user_input)
            elif current_step == ConversationStep.ASK_PUBLISH_OPTION:
                # This step is now handled by ask_schedule - redirect to ask_schedule
                result = await self.ask_schedule(state, user_input)
            elif current_step == ConversationStep.SAVE_BLOG:
                result = await self.save_blog(state)
            else:
                result = state
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing conversation step: {e}")
            state["error_message"] = str(e)
            state["current_step"] = ConversationStep.ERROR
            return state
    
    async def _suggest_keywords(self, state: CustomBlogState) -> List[str]:
        """Suggest keywords based on blog topic and type"""
        try:
            blog_topic = state.get("blog_topic", "")
            blog_type = state.get("selected_blog_type", BlogType.EDUCATIONAL)
            
            prompt = f"Based on this blog topic: '{blog_topic}'\nAnd blog type: {blog_type}\n\nSuggest 3 primary SEO keywords (just the keywords, comma-separated, no explanation):"
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an SEO expert. Provide only keywords, comma-separated."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=50
            )
            
            # Track token usage
            user_id = state.get("user_id")
            if user_id and self.token_tracker:
                await self.token_tracker.track_chat_completion_usage(
                    user_id=user_id,
                    feature_type="custom_blog",
                    model_name="gpt-4o-mini",
                    response=response,
                    request_metadata={"action": "suggest_keywords", "blog_topic": state.get("blog_topic")}
                )
            
            keywords_text = response.choices[0].message.content.strip()
            keywords = [k.strip() for k in keywords_text.split(',')[:3]]
            
            return keywords
            
        except Exception as e:
            logger.error(f"Error suggesting keywords: {e}")
            # Fallback keywords
            return ["blog", "content", "article"]
    
    async def _generate_outline(self, state: CustomBlogState) -> str:
        """Generate blog outline"""
        try:
            blog_topic = state.get("blog_topic", "")
            blog_type = state.get("selected_blog_type", BlogType.EDUCATIONAL)
            keywords = state.get("keywords", [])
            blog_length = state.get("blog_length", BlogLength.MEDIUM)
            
            length_targets = {
                BlogLength.SHORT: "500-800 words",
                BlogLength.MEDIUM: "800-1200 words",
                BlogLength.LONG: "1200+ words"
            }
            
            # Get business context for personalized outline
            business_context = state.get("business_context", {})
            business_name = business_context.get("business_name", "")
            industry = business_context.get("industry", "")
            target_audience = business_context.get("target_audience", "")
            brand_voice = business_context.get("brand_voice", "")
            
            # Build context string
            context_info = ""
            if business_name:
                context_info += f"\nBusiness: {business_name}"
            if industry:
                context_info += f"\nIndustry: {industry}"
            if target_audience:
                context_info += f"\nTarget Audience: {target_audience}"
            if brand_voice:
                context_info += f"\nBrand Voice: {brand_voice}"
            
            prompt = f"""Create a detailed outline for a {blog_type} blog post about: {blog_topic}

Target length: {length_targets.get(blog_length, '800-1200 words')}
SEO Keywords (to be naturally integrated): {', '.join(keywords) if keywords else 'None specified'}
{context_info}

The outline should:
- Be relevant to the business, industry, and target audience mentioned above
- Align with the brand voice
- Include the keywords naturally in section headings and content

Provide a structured outline with:
1. Introduction
2. Main sections (3-5 sections)
3. Conclusion

Format as a clear, numbered list with section titles and brief descriptions."""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert blog writer. Create clear, structured outlines."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            # Track token usage
            user_id = state.get("user_id")
            if user_id and self.token_tracker:
                await self.token_tracker.track_chat_completion_usage(
                    user_id=user_id,
                    feature_type="custom_blog",
                    model_name="gpt-4o-mini",
                    response=response,
                    request_metadata={"action": "generate_outline", "blog_topic": state.get("blog_topic")}
                )
            
            outline = response.choices[0].message.content.strip()
            return outline
            
        except Exception as e:
            logger.error(f"Error generating outline: {e}")
            return "1. Introduction\n2. Main Content\n3. Conclusion"
    
    async def _generate_blog_content(self, state: CustomBlogState) -> Dict[str, Any]:
        """Generate full blog content"""
        try:
            blog_topic = state.get("blog_topic", "")
            blog_type = state.get("selected_blog_type", BlogType.EDUCATIONAL)
            keywords = state.get("keywords", [])
            blog_length = state.get("blog_length", BlogLength.MEDIUM)
            outline = state.get("outline", "")
            image_option = state.get("image_option", ImageOption.NO)
            
            length_targets = {
                BlogLength.SHORT: "500-800",
                BlogLength.MEDIUM: "800-1200",
                BlogLength.LONG: "1200+"
            }
            
            word_count_target = length_targets.get(blog_length, "800-1200")
            
            # Determine if images should be included
            include_images = image_option in [ImageOption.YES, ImageOption.BOTH]
            
            # Get business context for personalized content (already includes embeddings if available)
            business_context = state.get("business_context", {})
            
            # Build task description
            task_description = f"""Write a comprehensive {blog_type} blog post based on this outline:

OUTLINE:
{outline}

TOPIC: {blog_topic}
TARGET LENGTH: {word_count_target} words
SEO KEYWORDS (integrate naturally into content, NOT as hashtags): {', '.join(keywords) if keywords else 'None - use topic-related terms naturally'}
INCLUDE IMAGES IN CONTENT: {'Yes - mention image concepts naturally in text where appropriate' if include_images else 'No - text only, no image references'}

CRITICAL STRUCTURE REQUIREMENTS:
- Write in clean, professional HTML format with proper semantic structure
- DO NOT add [IMAGE: description] placeholders or any image placeholders in the content
- The featured image will be added separately - do NOT reference images in the content
- Structure the content with clear sections using proper HTML headings (h2, h3)
- Each section should have a clear purpose and flow logically
- Use proper paragraph tags (<p>) for body text
- Create well-organized sections that can be displayed in a two-column or structured layout
- Avoid redundant titles or headings - the title is already set, focus on content sections
- Include sections like:
  * Introduction paragraph (hook the reader)
  * Main content sections with subheadings
  * Key points or benefits (use lists where appropriate)
  * Conclusion that ties everything together
- Make sections scannable and easy to read
- Use proper HTML formatting: <h2> for main sections, <h3> for subsections, <p> for paragraphs, <ul>/<li> for lists

Content Requirements:
- Write engaging, well-structured content that aligns with the brand voice, brand tone, and target audience
- Follow the outline provided
- IMPORTANT: Integrate the provided SEO keywords naturally throughout the content. Use them in headings, subheadings, and body paragraphs where they fit contextually. DO NOT use them as hashtags (#keyword) or list them separately
- Make it informative and valuable
- Ensure the content is relevant to the business context, industry, and brand values
- The keywords should appear naturally in the content for SEO purposes, not as social media hashtags
- Personalize the content to reflect the business name, industry, and target audience mentioned above
- Use the brand voice and tone consistently throughout the content
- DO NOT repeat the title in the content - start directly with the introduction
- Keep the structure clean and professional, matching a modern business website layout

Return a JSON object with:
{{
    "title": "Blog post title",
    "content": "Full HTML content with proper structure (h2, h3, p tags, lists)",
    "excerpt": "Brief excerpt (150-200 characters)",
    "word_count": <number>,
    "reading_time": <number in minutes>
}}"""
            
            # Use embedding-aware prompt builder
            from utils.embedding_context import build_embedding_prompt
            
            prompt = build_embedding_prompt(
                context=business_context,
                task_description=task_description,
                additional_requirements=f"Blog Type: {blog_type}, Topic: {blog_topic}, Target Length: {word_count_target} words, Keywords: {', '.join(keywords) if keywords else 'None'}, Include Images: {'Yes' if include_images else 'No'}"
            )
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert blog writer specializing in creating well-structured, professional blog content for business websites. Your content should be clean, organized, and ready for publication. Always return valid JSON only. Focus on creating structured HTML content with proper headings, paragraphs, and lists - avoid redundant titles or image references."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            # Track token usage
            user_id = state.get("user_id")
            if user_id and self.token_tracker:
                await self.token_tracker.track_chat_completion_usage(
                    user_id=user_id,
                    feature_type="custom_blog",
                    model_name="gpt-4o",
                    response=response,
                    request_metadata={"action": "generate_content", "blog_topic": state.get("blog_topic")}
                )
            
            content_text = response.choices[0].message.content.strip()
            
            # Try to parse JSON
            try:
                # Remove markdown code blocks if present
                if "```json" in content_text:
                    content_text = content_text.split("```json")[1].split("```")[0].strip()
                elif "```" in content_text:
                    content_text = content_text.split("```")[1].split("```")[0].strip()
                
                blog_data = json.loads(content_text)
            except json.JSONDecodeError:
                # Fallback: create structure from text
                blog_data = {
                    "title": blog_topic,
                    "content": content_text,
                    "excerpt": content_text[:200] + "..." if len(content_text) > 200 else content_text,
                    "word_count": len(content_text.split()),
                    "reading_time": max(1, len(content_text.split()) // 200)
                }
            
            return blog_data
            
        except Exception as e:
            logger.error(f"Error generating blog content: {e}")
            # Return fallback content
            return {
                "title": state.get("blog_topic", "Untitled Blog Post"),
                "content": f"<p>Blog content about {state.get('blog_topic', 'your topic')}</p>",
                "excerpt": f"Blog about {state.get('blog_topic', 'your topic')}",
                "word_count": 0,
                "reading_time": 0
            }
    
    async def _load_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Load user profile from Supabase including embeddings"""
        try:
            # Include embeddings in the query
            response = self.supabase.table("profiles").select("*, profile_embedding").eq("id", user_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                logger.warning(f"No profile found for user {user_id}")
                return {}
                
        except Exception as e:
            logger.error(f"Error loading user profile for user {user_id}: {e}")
            return {}
    
    def _extract_business_context(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract business context from user profile, using embeddings if available"""
        from utils.embedding_context import get_profile_context_with_embedding
        
        # Use embedding context utility which prefers embeddings if available
        return get_profile_context_with_embedding(profile_data)
    
    async def _publish_to_wordpress(self, blog: Dict[str, Any], wordpress_connection: Dict[str, Any]) -> Optional[str]:
        """Publish blog to WordPress using REST API"""
        try:
            # Get WordPress connection details from platform_connections
            wordpress_response = self.supabase.table("platform_connections").select("*").eq("id", wordpress_connection.get("id")).eq("platform", "wordpress").execute()
            
            if not wordpress_response.data:
                logger.error("WordPress connection not found in platform_connections")
                return None
            
            wordpress_site = wordpress_response.data[0]
            
            # Decrypt WordPress app password
            try:
                app_password = decrypt_token(wordpress_site['wordpress_app_password_encrypted'])
            except Exception as e:
                logger.error(f"Error decrypting WordPress app password: {e}")
                return None
            
            # Get featured image URL from metadata
            featured_image_url = None
            if blog.get('metadata') and isinstance(blog.get('metadata'), dict):
                featured_image_url = blog['metadata'].get('featured_image')
            
            # Clean blog content
            blog_content = blog.get('content', '')
            if not blog_content or not blog_content.strip():
                blog_content = blog.get('excerpt', '')
            
            if blog_content:
                # Fix double-encoded HTML entities
                blog_content = blog_content.replace('&amp;amp;', '&amp;')
                blog_content = blog_content.replace('&amp;lt;', '&lt;')
                blog_content = blog_content.replace('&amp;gt;', '&gt;')
                blog_content = blog_content.replace('&amp;quot;', '&quot;')
                blog_content = blog_content.strip()
            
            # Prepare WordPress post data
            # Note: WordPress REST API expects categories and tags as integer IDs, not strings
            # We'll store them in meta instead to avoid type errors
            wordpress_data = {
                "title": blog['title'],
                "content": blog_content,
                "excerpt": blog.get('excerpt', ''),
                "status": "publish",
                "format": blog.get('format', 'standard'),
                "meta": {
                    "description": blog.get('meta_description', ''),
                    "keywords": blog.get('meta_keywords', [])
                }
            }
            
            # Store categories and tags in meta instead of direct fields
            # WordPress REST API expects integer IDs for categories/tags, not strings
            if blog.get('categories'):
                wordpress_data['meta']['_blog_categories'] = ', '.join(blog.get('categories', []))
            if blog.get('tags'):
                wordpress_data['meta']['_blog_tags'] = ', '.join(blog.get('tags', []))
            
            # WordPress REST API URL
            rest_api_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts"
            media_api_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/media"
            
            logger.info(f"Publishing to WordPress: {rest_api_url}")
            
            # Create session
            session = requests.Session()
            session.cookies.clear()
            
            # Upload featured image if available
            featured_media_id = None
            if featured_image_url:
                try:
                    logger.info(f"Uploading featured image: {featured_image_url}")
                    headers = {'User-Agent': 'Agent-Emily/1.0', 'Accept': 'image/*'}
                    image_response = requests.get(featured_image_url, timeout=30, headers=headers, stream=True)
                    
                    if image_response.status_code == 200:
                        image_content = image_response.content
                        if image_content and len(image_content) > 0:
                            parsed_url = urlparse(featured_image_url)
                            filename = parsed_url.path.split('/')[-1] or 'blog-image.jpg'
                            if '?' in filename:
                                filename = filename.split('?')[0]
                            
                            content_type = image_response.headers.get('Content-Type', '')
                            if not content_type or not content_type.startswith('image/'):
                                filename_lower = filename.lower()
                                if filename_lower.endswith('.png'):
                                    content_type = 'image/png'
                                elif filename_lower.endswith('.gif'):
                                    content_type = 'image/gif'
                                elif filename_lower.endswith('.webp'):
                                    content_type = 'image/webp'
                                else:
                                    content_type = 'image/jpeg'
                            
                            # Upload to WordPress
                            files = {'file': (filename, image_content, content_type)}
                            media_response = session.post(
                                media_api_url,
                                files=files,
                                auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                                headers={'User-Agent': 'Agent-Emily/1.0'},
                                timeout=30
                            )
                            
                            if media_response.status_code == 201:
                                media_data = media_response.json()
                                featured_media_id = media_data.get('id')
                                logger.info(f"Featured image uploaded: Media ID {featured_media_id}")
                            else:
                                logger.warning(f"Failed to upload featured image: {media_response.status_code}")
                except Exception as img_error:
                    logger.warning(f"Error uploading featured image: {img_error}")
            
            # Add featured image to post data if uploaded
            if featured_media_id:
                wordpress_data['featured_media'] = featured_media_id
            
            # Publish post to WordPress
            response = session.post(
                rest_api_url,
                json=wordpress_data,
                auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Agent-Emily/1.0'
                },
                timeout=30,
                allow_redirects=False
            )
            
            if response.status_code == 201:
                post_data = response.json()
                wordpress_post_id = str(post_data.get('id'))
                logger.info(f"✅ Blog published to WordPress: Post ID {wordpress_post_id}")
                return wordpress_post_id
            else:
                logger.error(f"Failed to publish to WordPress: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error publishing to WordPress: {e}")
            return None
    
    async def _load_wordpress_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Load WordPress connection for user (default/first active connection)"""
        try:
            logger.info(f"🔍 Loading WordPress connection for user: {user_id}")
            response = self.supabase.table("platform_connections").select("*").eq("user_id", user_id).eq("platform", "wordpress").eq("is_active", True).limit(1).execute()
            
            logger.info(f"   - Found {len(response.data) if response.data else 0} WordPress connection(s)")
            
            if response.data and len(response.data) > 0:
                connection = response.data[0]
                logger.info(f"   - Connection ID: {connection.get('id')}")
                logger.info(f"   - Connection keys: {list(connection.keys())}")
                
                # Try multiple possible field names for site name
                site_name = (
                    connection.get("wordpress_site_name") or 
                    connection.get("site_name") or 
                    connection.get("page_name") or
                    ""
                )
                
                site_url = (
                    connection.get("wordpress_site_url") or 
                    connection.get("site_url") or
                    connection.get("website_url") or
                    ""
                )
                
                logger.info(f"   - Site Name: {site_name}")
                logger.info(f"   - Site URL: {site_url}")
                
                result = {
                    "id": connection.get("id"),
                    "site_name": site_name,
                    "site_url": site_url,
                    "username": connection.get("wordpress_username") or connection.get("username", "")
                }
                
                return result
            else:
                logger.info(f"⚠️ No WordPress connection found for user {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error loading WordPress connection for user {user_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None

