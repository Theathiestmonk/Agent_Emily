"""
Content Creation Agent using LangGraph
Generates weekly content for social media platforms one by one
"""

import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

import openai
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PostType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    CAROUSEL = "carousel"
    STORY = "story"
    ARTICLE = "article"

class ImageStyle(str, Enum):
    REALISTIC = "realistic"
    ARTISTIC = "artistic"
    CARTOON = "cartoon"
    MINIMALIST = "minimalist"
    PHOTOGRAPHIC = "photographic"
    ILLUSTRATION = "illustration"

class ContentImage(BaseModel):
    image_url: str
    image_prompt: str
    image_style: ImageStyle
    image_size: str = "1024x1024"
    image_quality: str = "standard"
    generation_model: str = "dall-e-3"
    generation_cost: Optional[float] = None
    generation_time: Optional[int] = None
    is_approved: bool = False

class ContentPost(BaseModel):
    platform: str
    post_type: PostType
    title: Optional[str] = None
    content: str
    hashtags: List[str] = []
    scheduled_date: str
    scheduled_time: str
    images: List[ContentImage] = []
    metadata: Dict[str, Any] = {}

class ContentCampaign(BaseModel):
    id: Optional[str] = None
    user_id: str
    campaign_name: str
    week_start_date: str
    week_end_date: str
    status: str = "draft"
    total_posts: int = 0
    generated_posts: int = 0

class UserImagePreferences(BaseModel):
    preferred_style: ImageStyle = ImageStyle.REALISTIC
    brand_colors: List[str] = []
    avoid_content: List[str] = []
    preferred_subjects: List[str] = []
    image_quality: str = "standard"

class ContentState(BaseModel):
    # User context
    user_profile: Dict[str, Any] = {}
    business_context: Dict[str, Any] = {}
    image_preferences: Optional[UserImagePreferences] = None
    
    # Campaign data
    campaign: Optional[ContentCampaign] = None
    platforms: List[str] = []
    
    # Platform iteration control
    current_platform_index: int = 0
    current_platform: Optional[str] = None
    completed_platforms: List[str] = []
    failed_platforms: List[str] = []
    
    # Content generation per platform
    platform_content: List[ContentPost] = []
    all_content: List[ContentPost] = []
    
    # Image generation tracking
    pending_image_requests: List[str] = []
    completed_image_requests: List[str] = []
    failed_image_requests: List[str] = []
    
    # Retry logic per platform
    max_retries_per_platform: int = 3
    current_platform_retries: int = 0
    
    # Progress tracking
    current_step: str = "initializing"
    progress_percentage: int = 0
    step_details: str = ""
    
    # Results
    success: bool = False
    error_message: Optional[str] = None
    weekly_summary: Optional[str] = None

# Platform-specific content generators
PLATFORM_GENERATORS = {
    "facebook": {
        "post_types": ["text", "image", "video", "carousel"],
        "max_length": 2000,
        "optimal_length": 40,
        "hashtag_limit": 3,
        "image_requirements": {
            "sizes": ["1200x630", "1080x1080", "1200x675"],
            "preferred_styles": ["realistic", "photographic"],
            "max_images_per_post": 10
        }
    },
    "instagram": {
        "post_types": ["image", "video", "carousel", "story"],
        "max_length": 2200,
        "optimal_length": 125,
        "hashtag_limit": 30,
        "image_requirements": {
            "sizes": ["1080x1080", "1080x1350", "1080x1920"],
            "preferred_styles": ["artistic", "realistic", "minimalist"],
            "max_images_per_post": 10
        }
    },
    "linkedin": {
        "post_types": ["text", "image", "video", "article"],
        "max_length": 3000,
        "optimal_length": 150,
        "hashtag_limit": 5,
        "image_requirements": {
            "sizes": ["1200x627", "1080x1080"],
            "preferred_styles": ["realistic", "professional"],
            "max_images_per_post": 1
        }
    },
    "twitter": {
        "post_types": ["text", "image", "video"],
        "max_length": 280,
        "optimal_length": 100,
        "hashtag_limit": 2,
        "image_requirements": {
            "sizes": ["1200x675", "1080x1080"],
            "preferred_styles": ["realistic", "minimalist"],
            "max_images_per_post": 4
        }
    },
    "youtube": {
        "post_types": ["text", "video"],
        "max_length": 5000,
        "optimal_length": 200,
        "hashtag_limit": 15,
        "image_requirements": {
            "sizes": ["1280x720", "1920x1080"],
            "preferred_styles": ["realistic", "illustration"],
            "max_images_per_post": 1
        }
    },
    "twitter/x": {
        "post_types": ["text", "image", "video"],
        "max_length": 280,
        "optimal_length": 100,
        "hashtag_limit": 2,
        "image_requirements": {
            "sizes": ["1200x675", "1080x1080"],
            "preferred_styles": ["realistic", "minimalist"],
            "max_images_per_post": 4
        }
    }
}

class ContentCreationAgent:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str, progress_callback=None):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.openai_client = openai.AsyncOpenAI(api_key=openai_api_key)
        self.progress_callback = progress_callback
        self.graph = self._build_graph()
    
    async def update_progress(self, user_id: str, step: str, percentage: int, details: str, current_platform: str = None):
        """Update progress using callback"""
        if self.progress_callback:
            await self.progress_callback(user_id, step, percentage, details, current_platform)
        
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph for content creation"""
        graph = StateGraph(ContentState)
        
        # Add nodes
        graph.add_node("load_profile", self.load_user_profile)
        graph.add_node("extract_context", self.extract_business_context)
        graph.add_node("initialize_campaign", self.initialize_content_campaign)
        graph.add_node("check_platforms", self.check_more_platforms)
        graph.add_node("select_platform", self.select_next_platform)
        graph.add_node("load_platform_context", self.load_platform_specific_context)
        graph.add_node("generate_platform_content", self.generate_platform_content)
        graph.add_node("generate_platform_images", self.generate_platform_images)
        graph.add_node("validate_platform_content", self.validate_platform_content)
        graph.add_node("should_retry_platform", self.should_retry_platform)
        graph.add_node("refine_platform_content", self.refine_platform_content)
        graph.add_node("store_platform_content", self.store_platform_content)
        graph.add_node("mark_platform_complete", self.mark_platform_complete)
        graph.add_node("generate_summary", self.generate_weekly_summary)
        graph.add_node("send_notification", self.send_notification)
        
        # Add edges
        graph.set_entry_point("load_profile")
        graph.add_edge("load_profile", "extract_context")
        graph.add_edge("extract_context", "initialize_campaign")
        graph.add_edge("initialize_campaign", "check_platforms")
        
        # Conditional edges
        graph.add_conditional_edges(
            "check_platforms",
            self.should_continue_platforms,
            {
                "continue": "select_platform",
                "complete": "generate_summary"
            }
        )
        
        graph.add_edge("select_platform", "load_platform_context")
        graph.add_edge("load_platform_context", "generate_platform_content")
        graph.add_edge("generate_platform_content", "generate_platform_images")
        graph.add_edge("generate_platform_images", "validate_platform_content")
        
        graph.add_conditional_edges(
            "validate_platform_content",
            self.is_content_valid,
            {
                "valid": "store_platform_content",
                "invalid": "should_retry_platform"
            }
        )
        
        graph.add_conditional_edges(
            "should_retry_platform",
            self.should_retry_platform_decision,
            {
                "retry": "refine_platform_content",
                "skip": "mark_platform_complete"
            }
        )
        
        graph.add_edge("refine_platform_content", "validate_platform_content")
        graph.add_edge("store_platform_content", "mark_platform_complete")
        graph.add_edge("mark_platform_complete", "check_platforms")
        graph.add_edge("generate_summary", "send_notification")
        graph.add_edge("send_notification", END)
        
        return graph.compile()
    
    async def load_user_profile(self, state: ContentState) -> ContentState:
        """Load user profile from Supabase"""
        try:
            user_id = state.user_profile.get('user_id')
            logger.info(f"Loading profile for user: {user_id}")
            
            # Update progress
            await self.update_progress(
                user_id, 
                "loading_profile", 
                10, 
                "Loading user profile and preferences..."
            )
            
            # Get user profile
            profile_response = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if profile_response.data:
                profile_data = profile_response.data[0]
                # Keep the user_id for compatibility
                profile_data['user_id'] = profile_data['id']
                state.user_profile = profile_data
                logger.info(f"Loaded profile for: {state.user_profile.get('business_name')}")
            else:
                raise Exception("User profile not found")
                
        except Exception as e:
            logger.error(f"Error loading user profile: {e}")
            state.error_message = f"Failed to load user profile: {str(e)}"
            
        return state
    
    async def extract_business_context(self, state: ContentState) -> ContentState:
        """Extract business context from user profile"""
        try:
            profile = state.user_profile
            
            state.business_context = {
                "business_name": profile.get("business_name", ""),
                "business_type": profile.get("business_type", []),
                "industry": profile.get("industry", []),
                "business_description": profile.get("business_description", ""),
                "target_audience": profile.get("target_audience", []),
                "unique_value_proposition": profile.get("unique_value_proposition", ""),
                "brand_voice": profile.get("brand_voice", ""),
                "brand_tone": profile.get("brand_tone", ""),
                "social_media_platforms": profile.get("social_media_platforms", []),
                "primary_goals": profile.get("primary_goals", []),
                "content_themes": profile.get("content_themes", []),
                "monthly_budget_range": profile.get("monthly_budget_range", ""),
                "automation_level": profile.get("automation_level", "")
            }
            
            # Set platforms from user profile
            state.platforms = profile.get("social_media_platforms", [])
            
            logger.info(f"Extracted business context for: {state.business_context['business_name']}")
            logger.info(f"Platforms to generate content for: {state.platforms}")
            
        except Exception as e:
            logger.error(f"Error extracting business context: {e}")
            state.error_message = f"Failed to extract business context: {str(e)}"
            
        return state
    
    async def cleanup_existing_content(self, user_id: str) -> None:
        """Delete all existing content for the user before generating new content"""
        try:
            logger.info(f"Cleaning up existing content for user: {user_id}")
            
            # Get all campaigns for the user
            campaigns_response = self.supabase.table("content_campaigns").select("id, created_at").eq("user_id", user_id).execute()
            
            if campaigns_response.data:
                campaign_ids = [campaign["id"] for campaign in campaigns_response.data]
                logger.info(f"Found {len(campaign_ids)} existing campaigns to delete")
                
                # Delete all posts for these campaigns
                for campaign_id in campaign_ids:
                    posts_response = self.supabase.table("content_posts").delete().eq("campaign_id", campaign_id).execute()
                    logger.info(f"Deleted posts for campaign {campaign_id}")
                
                # Delete all campaigns
                campaigns_delete_response = self.supabase.table("content_campaigns").delete().eq("user_id", user_id).execute()
                logger.info(f"Deleted {len(campaign_ids)} campaigns for user {user_id}")
                
                # Delete any associated images
                for campaign_id in campaign_ids:
                    images_response = self.supabase.table("content_images").delete().in_("post_id", 
                        self.supabase.table("content_posts").select("id").eq("campaign_id", campaign_id).execute().data or []
                    ).execute()
                    logger.info(f"Deleted images for campaign {campaign_id}")
            
            logger.info(f"Content cleanup completed for user: {user_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up existing content: {e}")
            # Don't raise exception, just log the error and continue

    async def initialize_content_campaign(self, state: ContentState) -> ContentState:
        """Initialize content campaign in Supabase"""
        try:
            user_id = state.user_profile.get('user_id')
            
            # Clean up existing content first
            await self.cleanup_existing_content(user_id)
            
            # Update progress
            await self.update_progress(
                user_id, 
                "initializing", 
                5, 
                "Initializing content campaign..."
            )
            
            # Calculate week dates - start from today and go 7 days forward
            today = datetime.now()
            week_start = today
            week_end = today + timedelta(days=6)
            
            campaign_data = {
                "user_id": user_id,
                "campaign_name": f"Weekly Content - {week_start.strftime('%Y-%m-%d')}",
                "week_start_date": week_start.strftime('%Y-%m-%d'),
                "week_end_date": week_end.strftime('%Y-%m-%d'),
                "status": "generating",
                "total_posts": len(state.platforms) * 7,  # 7 days per platform
                "generated_posts": 0
            }
            
            # Insert campaign
            campaign_response = self.supabase.table("content_campaigns").insert(campaign_data).execute()
            
            if campaign_response.data:
                campaign_data = campaign_response.data[0]
                state.campaign = ContentCampaign(**campaign_data)
                logger.info(f"Created campaign: {state.campaign.campaign_name} with ID: {state.campaign.id}")
                
                # Update progress with campaign ID
                await self.update_progress(
                    user_id, 
                    "campaign_created", 
                    15, 
                    f"Campaign created: {state.campaign.campaign_name}"
                )
            else:
                raise Exception("Failed to create campaign")
                
        except Exception as e:
            logger.error(f"Error initializing campaign: {e}")
            state.error_message = f"Failed to initialize campaign: {str(e)}"
            
        return state
    
    async def check_more_platforms(self, state: ContentState) -> ContentState:
        """Check if there are more platforms to process"""
        return state
    
    def should_continue_platforms(self, state: ContentState) -> str:
        """Check if there are more platforms to process"""
        logger.info(f"Checking platforms: index={state.current_platform_index}, total={len(state.platforms)}, completed={state.completed_platforms}")
        if state.current_platform_index < len(state.platforms):
            return "continue"
        return "complete"
    
    async def select_next_platform(self, state: ContentState) -> ContentState:
        """Select the next platform to process"""
        if state.current_platform_index < len(state.platforms):
            state.current_platform = state.platforms[state.current_platform_index]
            state.current_platform_retries = 0
            state.platform_content = []  # Clear previous platform content
            logger.info(f"Processing platform: {state.current_platform}")
        return state
    
    async def load_platform_specific_context(self, state: ContentState) -> ContentState:
        """Load platform-specific context and preferences"""
        try:
            # Get user image preferences
            prefs_response = self.supabase.table("user_image_preferences").select("*").eq("user_id", state.user_profile["user_id"]).execute()
            
            if prefs_response.data:
                prefs_data = prefs_response.data[0]
                state.image_preferences = UserImagePreferences(
                    preferred_style=ImageStyle(prefs_data.get("preferred_style", "realistic")),
                    brand_colors=prefs_data.get("brand_colors", []),
                    avoid_content=prefs_data.get("avoid_content", []),
                    preferred_subjects=prefs_data.get("preferred_subjects", []),
                    image_quality=prefs_data.get("image_quality", "standard")
                )
            else:
                # Create default preferences
                state.image_preferences = UserImagePreferences()
                
            logger.info(f"Loaded platform context for: {state.current_platform}")
            
        except Exception as e:
            logger.error(f"Error loading platform context: {e}")
            state.error_message = f"Failed to load platform context: {str(e)}"
            
        return state
    
    async def generate_platform_content(self, state: ContentState) -> ContentState:
        """Generate content for the current platform"""
        try:
            platform = state.current_platform
            platform_config = PLATFORM_GENERATORS[platform.lower()]
            business_context = state.business_context
            
            logger.info(f"Generating content for {platform}")
            
            # Update progress
            user_id = state.user_profile.get('user_id')
            progress_percentage = 20 + (state.current_platform_index * 60 // len(state.platforms))
            await self.update_progress(
                user_id, 
                "generating_content", 
                progress_percentage, 
                f"Generating content for {platform}...",
                platform
            )
            
            # Generate 7 days of content for this platform
            content_posts = []
            
            for day in range(7):
                try:
                    post = await self.generate_single_post(
                        platform=platform,
                        platform_config=platform_config,
                        business_context=business_context,
                        day_of_week=day,
                        image_preferences=state.image_preferences
                    )
                    content_posts.append(post)
                except Exception as e:
                    logger.error(f"Failed to generate post for {platform} day {day}: {e}")
                    # Skip this post instead of adding fallback content
                    continue
            
            if content_posts:
                state.platform_content = content_posts
                logger.info(f"Generated {len(content_posts)} posts for {platform}")
            else:
                logger.error(f"No content generated for {platform} - all posts failed")
                state.error_message = f"Failed to generate any content for {platform}. Please check your OpenAI API key and try again."
                state.failed_platforms.append(platform)
            
        except Exception as e:
            logger.error(f"Error generating platform content: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            state.error_message = f"Failed to generate content for {state.current_platform}: {str(e)}"
            
        return state
    
    async def generate_single_post(self, platform: str, platform_config: dict, 
                                 business_context: dict, day_of_week: int, 
                                 image_preferences: UserImagePreferences) -> ContentPost:
        """Generate a single post for a specific platform"""
        try:
            # Get content template for platform
            template_response = self.supabase.table("content_templates").select("*").eq("platform", platform).eq("is_active", True).execute()
            
            if template_response.data:
                template = template_response.data[0]
                template_prompt = template["template_prompt"]
            else:
                # Default template
                template_prompt = "Create engaging content for {business_name} on {platform}. Make it relevant to {industry} industry."
            
            # Format template with business context
            formatted_prompt = template_prompt.format(
                business_name=business_context["business_name"],
                platform=platform,
                industry=", ".join(business_context["industry"]),
                brand_voice=business_context["brand_voice"],
                brand_tone=business_context["brand_tone"],
                topic=self.get_topic_for_day(day_of_week)
            )
            
            # Create the full prompt for content generation
            full_prompt = f"""
            {formatted_prompt}
            
            Business Context:
            - Business: {business_context['business_name']}
            - Industry: {', '.join(business_context['industry'])}
            - Brand Voice: {business_context['brand_voice']}
            - Brand Tone: {business_context['brand_tone']}
            - Target Audience: {', '.join(business_context['target_audience'])}
            - Content Themes: {', '.join(business_context['content_themes'])}
            
            Platform Requirements:
            - Platform: {platform}
            - Max Length: {platform_config['max_length']} characters
            - Optimal Length: {platform_config['optimal_length']} characters
            - Hashtag Limit: {platform_config['hashtag_limit']}
            - Day of Week: {self.get_day_name(day_of_week)}
            
            Please generate content that:
            1. Matches the brand voice and tone
            2. Is appropriate for the platform
            3. Engages the target audience
            4. Includes relevant hashtags (within limit)
            5. Is optimized for the platform's character limits
            
            Return your response as a valid JSON object with this structure:
            {{
                "content": "Your generated content here",
                "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
                "post_type": "text",
                "title": "Optional title if needed"
            }}
            """
            
            # Call OpenAI API
            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": full_prompt}],
                max_tokens=platform_config['max_length'],
                temperature=0.7
            )
            
            # Parse JSON response
            try:
                content_data = json.loads(response.choices[0].message.content)
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                content_data = {
                    "content": response.choices[0].message.content,
                    "hashtags": [],
                    "post_type": "text",
                    "title": None
                }
            
            # Calculate scheduled date and time
            scheduled_date = self.calculate_date(day_of_week)
            scheduled_time = self.get_optimal_time(platform)
            
            return ContentPost(
                platform=platform,
                post_type=PostType(content_data.get("post_type", "text")),
                title=content_data.get("title"),
                content=content_data["content"],
                hashtags=content_data.get("hashtags", [])[:platform_config['hashtag_limit']],
                scheduled_date=scheduled_date,
                scheduled_time=scheduled_time,
                metadata={
                    "generated_by": "emily_agent",
                    "day_of_week": day_of_week,
                    "template_used": template.get("template_name", "default") if template_response.data else "default"
                }
            )
            
        except Exception as e:
            logger.error(f"Error generating single post for {platform}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Don't return fallback content, let the calling function handle the error
            raise e
    
    async def generate_platform_images(self, state: ContentState) -> ContentState:
        """Generate images for the current platform content"""
        try:
            platform = state.current_platform
            platform_config = PLATFORM_GENERATORS[platform.lower()]
            image_preferences = state.image_preferences
            
            logger.info(f"Generating images for {platform}")
            
            # Generate images for each post
            for post in state.platform_content:
                if post.post_type in ["image", "carousel"]:
                    # Generate image for this post
                    image = await self.generate_single_image(
                        post=post,
                        platform=platform,
                        platform_config=platform_config,
                        image_preferences=image_preferences
                    )
                    if image:
                        post.images.append(image)
            
            logger.info(f"Generated images for {platform}")
            
        except Exception as e:
            logger.error(f"Error generating platform images: {e}")
            # Don't fail the entire process for image generation errors
            logger.warning(f"Continuing without images for {platform}")
            
        return state
    
    async def generate_single_image(self, post: ContentPost, platform: str, 
                                  platform_config: dict, image_preferences: UserImagePreferences) -> Optional[ContentImage]:
        """Generate a single image for a post"""
        try:
            # Get image template for platform
            template_response = self.supabase.table("content_templates").select("*").eq("platform", platform).eq("is_active", True).execute()
            
            if template_response.data:
                template = template_response.data[0]
                image_prompt_template = template.get("image_prompt_template", "")
                image_style = template.get("image_style", "realistic")
            else:
                image_prompt_template = "Professional image related to {content}"
                image_style = "realistic"
            
            # Format image prompt
            image_prompt = image_prompt_template.format(
                content=post.content[:100],  # First 100 chars
                business_name=state.business_context["business_name"],
                industry=", ".join(state.business_context["industry"]),
                brand_colors=", ".join(image_preferences.brand_colors) if image_preferences.brand_colors else "professional colors"
            )
            
            # Add style and quality instructions
            full_image_prompt = f"{image_prompt}, {image_style} style, high quality, professional"
            
            # Call DALL-E API
            response = await self.openai_client.images.generate(
                model="dall-e-3",
                prompt=full_image_prompt,
                size="1024x1024",
                quality="standard",
                n=1
            )
            
            # Create image record
            image = ContentImage(
                image_url=response.data[0].url,
                image_prompt=full_image_prompt,
                image_style=ImageStyle(image_style),
                image_size="1024x1024",
                image_quality="standard",
                generation_model="dall-e-3",
                is_approved=False
            )
            
            return image
            
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            return None
    
    async def validate_platform_content(self, state: ContentState) -> ContentState:
        """Validate generated content for the current platform"""
        try:
            platform = state.current_platform
            platform_config = PLATFORM_GENERATORS[platform.lower()]
            
            # Basic validation
            is_valid = True
            for post in state.platform_content:
                if len(post.content) > platform_config['max_length']:
                    is_valid = False
                    logger.warning(f"Post too long for {platform}: {len(post.content)} chars")
                    break
                    
                if len(post.hashtags) > platform_config['hashtag_limit']:
                    is_valid = False
                    logger.warning(f"Too many hashtags for {platform}: {len(post.hashtags)}")
                    break
            
            if is_valid:
                logger.info(f"Content validation passed for {platform}")
            else:
                logger.warning(f"Content validation failed for {platform}")
                
        except Exception as e:
            logger.error(f"Error validating content: {e}")
            is_valid = False
            
        return state
    
    def is_content_valid(self, state: ContentState) -> str:
        """Check if generated content is valid"""
        if state.platform_content and len(state.platform_content) == 7:
            return "valid"
        return "invalid"
    
    async def should_retry_platform(self, state: ContentState) -> ContentState:
        """Check if we should retry the current platform"""
        return state
    
    def should_retry_platform_decision(self, state: ContentState) -> str:
        """Decision function for retry logic"""
        if state.current_platform_retries < state.max_retries_per_platform:
            return "retry"
        return "skip"
    
    async def refine_platform_content(self, state: ContentState) -> ContentState:
        """Refine content for the current platform"""
        try:
            state.current_platform_retries += 1
            logger.info(f"Refining content for {state.current_platform} (attempt {state.current_platform_retries})")
            
            # Re-generate content with more specific instructions
            platform = state.current_platform
            platform_config = PLATFORM_GENERATORS[platform.lower()]
            business_context = state.business_context
            
            # Generate refined content
            content_posts = []
            for day in range(7):
                post = await self.generate_single_post(
                    platform=platform,
                    platform_config=platform_config,
                    business_context=business_context,
                    day_of_week=day,
                    image_preferences=state.image_preferences
                )
                content_posts.append(post)
            
            state.platform_content = content_posts
            logger.info(f"Refined content for {platform}")
            
        except Exception as e:
            logger.error(f"Error refining content: {e}")
            state.error_message = f"Failed to refine content for {state.current_platform}: {str(e)}"
            
        return state
    
    async def store_platform_content(self, state: ContentState) -> ContentState:
        """Store content for the current platform in Supabase"""
        try:
            platform = state.current_platform
            campaign_id = state.campaign.id
            
            # Only store if we have content to store
            if not state.platform_content:
                logger.warning(f"No content to store for {platform}")
                return state
            
            logger.info(f"Storing {len(state.platform_content)} posts for {platform}")
            
            # Store each post
            for post in state.platform_content:
                # Prepare post data
                post_data = {
                    "campaign_id": campaign_id,
                    "platform": post.platform,
                    "post_type": post.post_type.value,
                    "title": post.title,
                    "content": post.content,
                    "hashtags": post.hashtags,
                    "scheduled_date": post.scheduled_date,
                    "scheduled_time": post.scheduled_time,
                    "status": "draft",
                    "metadata": post.metadata
                }
                
                # Insert post
                post_response = self.supabase.table("content_posts").insert(post_data).execute()
                
                if post_response.data:
                    post_id = post_response.data[0]["id"]
                    
                    # Store images if any
                    for image in post.images:
                        image_data = {
                            "post_id": post_id,
                            "image_url": image.image_url,
                            "image_prompt": image.image_prompt,
                            "image_style": image.image_style.value,
                            "image_size": image.image_size,
                            "image_quality": image.image_quality,
                            "generation_model": image.generation_model,
                            "generation_cost": image.generation_cost,
                            "generation_time": image.generation_time,
                            "is_approved": image.is_approved
                        }
                        
                        self.supabase.table("content_images").insert(image_data).execute()
            
            # Update campaign progress
            self.supabase.table("content_campaigns").update({
                "generated_posts": state.campaign.generated_posts + len(state.platform_content)
            }).eq("id", campaign_id).execute()
            
            # Add to all content
            state.all_content.extend(state.platform_content)
            state.completed_platforms.append(platform)
            
            logger.info(f"Stored {len(state.platform_content)} posts for {platform}")
            
        except Exception as e:
            logger.error(f"Error storing platform content: {e}")
            state.error_message = f"Failed to store content for {state.current_platform}: {str(e)}"
            
        return state
    
    async def mark_platform_complete(self, state: ContentState) -> ContentState:
        """Mark current platform as complete and move to next"""
        # Add current platform to completed list
        if state.current_platform:
            state.completed_platforms.append(state.current_platform)
            logger.info(f"Completed platform: {state.current_platform}")
        
        # Move to next platform
        state.current_platform_index += 1
        state.platform_content = []  # Clear for next platform
        state.current_platform = None  # Reset current platform
        
        return state
    
    async def generate_weekly_summary(self, state: ContentState) -> ContentState:
        """Generate weekly summary of created content"""
        try:
            total_posts = len(state.all_content)
            platforms_used = list(set([post.platform for post in state.all_content]))
            
            summary = f"""
            Weekly Content Generation Complete!
            
            Campaign: {state.campaign.campaign_name}
            Total Posts Generated: {total_posts}
            Platforms: {', '.join(platforms_used)}
            Completed Platforms: {', '.join(state.completed_platforms)}
            Failed Platforms: {', '.join(state.failed_platforms)}
            
            Content is ready for review and scheduling.
            """
            
            state.weekly_summary = summary
            state.success = True
            
            # Update campaign status
            self.supabase.table("content_campaigns").update({
                "status": "completed"
            }).eq("id", state.campaign.id).execute()
            
            logger.info("Generated weekly summary")
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            state.error_message = f"Failed to generate summary: {str(e)}"
            
        return state
    
    async def send_notification(self, state: ContentState) -> ContentState:
        """Send notification about completed content generation"""
        try:
            # Here you would integrate with your notification system
            # For now, just log the completion
            logger.info(f"Content generation completed for user: {state.user_profile['user_id']}")
            logger.info(f"Summary: {state.weekly_summary}")
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            
        return state
    
    # Helper methods
    def get_topic_for_day(self, day_of_week: int) -> str:
        """Get topic for specific day of week (0=today, 1=tomorrow, etc.)"""
        topics = [
            "today's fresh content",
            "tomorrow's insights",
            "mid-week updates",
            "Thursday highlights",
            "Friday features",
            "weekend content",
            "Sunday reflection"
        ]
        return topics[day_of_week]
    
    def get_day_name(self, day_of_week: int) -> str:
        """Get day name for day of week (0=today, 1=tomorrow, etc.)"""
        today = datetime.now()
        target_date = today + timedelta(days=day_of_week)
        return target_date.strftime('%A')
    
    def calculate_date(self, day_of_week: int) -> str:
        """Calculate scheduled date for day of week starting from today"""
        today = datetime.now()
        # day_of_week is 0-6 where 0 is today, 1 is tomorrow, etc.
        scheduled_date = today + timedelta(days=day_of_week)
        return scheduled_date.strftime('%Y-%m-%d')
    
    def get_optimal_time(self, platform: str) -> str:
        """Get optimal posting time for platform"""
        optimal_times = {
            "facebook": "09:00",
            "instagram": "11:00",
            "linkedin": "08:00",
            "twitter": "12:00",
            "youtube": "14:00",
            "twitter/x": "12:00"
        }
        return optimal_times.get(platform, "09:00")
    
    async def run_weekly_generation(self, user_id: str) -> Dict[str, Any]:
        """Run weekly content generation for a user"""
        try:
            logger.info(f"Starting weekly generation for user: {user_id}")
            
            # Initialize state
            state = ContentState(
                user_profile={"user_id": user_id},
                platforms=[],
                all_content=[],
                completed_platforms=[],
                failed_platforms=[]
            )
            
            logger.info(f"Initialized state: {state}")
            
            # Run the graph with increased recursion limit
            logger.info("Running LangGraph...")
            result = await self.graph.ainvoke(state, config={"recursion_limit": 100})
            logger.info(f"Graph result: {result}")
            
            return {
                "success": result.get("success", True),
                "error_message": result.get("error_message"),
                "weekly_summary": result.get("weekly_summary"),
                "total_posts": len(result.get("all_content", [])),
                "completed_platforms": result.get("completed_platforms", []),
                "failed_platforms": result.get("failed_platforms", [])
            }
            
        except Exception as e:
            logger.error(f"Error running weekly generation: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "error_message": str(e),
                "weekly_summary": None,
                "total_posts": 0,
                "completed_platforms": [],
                "failed_platforms": []
            }
