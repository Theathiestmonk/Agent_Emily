"""
Post Publisher Scheduler
Automatically publishes scheduled posts when their scheduled time arrives
Uses exact time scheduling instead of polling for efficiency
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from supabase import create_client, Client
import httpx
import os
from cryptography.fernet import Fernet
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PostPublisher:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        
        # In-memory schedule: post_id -> scheduled task
        self.scheduled_tasks: Dict[str, asyncio.Task] = {}
        # Store post data for publishing
        self.post_data_cache: Dict[str, Dict[str, Any]] = {}
        
        # Get encryption key from environment (same as connections router)
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if encryption_key:
            try:
                self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
            except Exception as e:
                logger.warning(f"Failed to initialize encryption: {e}. Tokens may be stored in plaintext.")
                self.cipher = None
        else:
            logger.warning("ENCRYPTION_KEY not set. Tokens may be stored in plaintext.")
            self.cipher = None
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt an encrypted token (same logic as connections router)"""
        if not self.cipher:
            # If no encryption, assume token is already plaintext
            return encrypted_token
        
        try:
            return self.cipher.decrypt(encrypted_token.encode()).decode()
        except Exception as e:
            logger.warning(f"Failed to decrypt token, trying as plaintext: {e}")
            # If decryption fails, try using as plaintext (for backward compatibility)
            # Also check if token starts with common OAuth prefixes (EAAB for Facebook, etc.)
            if encrypted_token.startswith(('EAAB', 'EAA', 'AQA')):
                return encrypted_token
            raise
    
    async def start(self):
        """Start the post publisher scheduler"""
        if self.is_running:
            logger.warning("Post publisher is already running")
            return
        
        self.is_running = True
        # Load existing scheduled posts from database on startup
        await self._load_existing_scheduled_posts()
        logger.info("Post publisher started - using exact time scheduling (no polling)")
    
    async def stop(self):
        """Stop the post publisher scheduler"""
        self.is_running = False
        # Cancel all scheduled tasks
        for task in self.scheduled_tasks.values():
            task.cancel()
        self.scheduled_tasks.clear()
        self.post_data_cache.clear()
        logger.info("Post publisher stopped")
    
    async def _load_existing_scheduled_posts(self):
        """Load existing scheduled posts from database on startup"""
        try:
            now = datetime.now()
            # Get all scheduled posts
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns(user_id)"
            ).eq("status", "scheduled").execute()
            
            if not response.data:
                return
            
            for post in response.data:
                try:
                    scheduled_date = post.get("scheduled_date")
                    scheduled_time = post.get("scheduled_time", "12:00:00")
                    
                    if not scheduled_date:
                        continue
                    
                    # Combine date and time
                    if isinstance(scheduled_date, str):
                        scheduled_date_obj = datetime.fromisoformat(scheduled_date).date()
                    else:
                        scheduled_date_obj = scheduled_date
                    
                    if isinstance(scheduled_time, str):
                        time_parts = scheduled_time.split(":")
                        hour = int(time_parts[0])
                        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                        second = int(time_parts[2]) if len(time_parts) > 2 else 0
                        scheduled_time_obj = datetime.min.replace(
                            hour=hour, minute=minute, second=second
                        ).time()
                    else:
                        scheduled_time_obj = scheduled_time
                    
                    scheduled_datetime = datetime.combine(scheduled_date_obj, scheduled_time_obj)
                    
                    # Only schedule future posts
                    if scheduled_datetime > now:
                        await self.schedule_post(post, scheduled_datetime)
                except Exception as e:
                    logger.error(f"Error loading scheduled post {post.get('id')}: {e}")
        except Exception as e:
            logger.error(f"Error loading existing scheduled posts: {e}")
    
    async def register_scheduled_post(self, post_id: str, scheduled_at: str, platform: str, user_id: str):
        """Register a scheduled post from frontend - called when post is scheduled"""
        try:
            # Cancel existing task if any
            if post_id in self.scheduled_tasks:
                self.scheduled_tasks[post_id].cancel()
            
            # Parse scheduled time
            scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
            if scheduled_datetime.tzinfo:
                scheduled_datetime = scheduled_datetime.replace(tzinfo=None)
            
            now = datetime.now()
            if scheduled_datetime <= now:
                # If already past, publish immediately
                logger.info(f"Post {post_id} scheduled time has passed, publishing immediately")
                await self._publish_post_by_id(post_id)
                return
            
            # Get post data from database
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns(user_id)"
            ).eq("id", post_id).execute()
            
            if not response.data:
                logger.error(f"Post {post_id} not found")
                return
            
            post = response.data[0]
            await self.schedule_post(post, scheduled_datetime)
            logger.info(f"Registered scheduled post {post_id} for {scheduled_datetime}")
            
        except Exception as e:
            logger.error(f"Error registering scheduled post {post_id}: {e}")
    
    async def schedule_post(self, post: Dict[str, Any], scheduled_datetime: datetime):
        """Schedule a post to be published at exact time"""
        post_id = post.get("id")
        if not post_id:
            return
        
        # Check if post is already published - don't schedule published posts
        post_status = post.get("status", "").lower()
        if post_status == "published":
            logger.info(f"Post {post_id} is already published, skipping scheduling")
            return
        
        # Check if post is already scheduled to prevent duplicates
        if post_id in self.scheduled_tasks:
            task = self.scheduled_tasks[post_id]
            # Check if task is still running (not cancelled or done)
            if not task.done():
                logger.info(f"Post {post_id} is already scheduled, skipping duplicate registration")
                return
            else:
                # Task is done/cancelled, remove it and reschedule
                del self.scheduled_tasks[post_id]
        
        # Store post data
        self.post_data_cache[post_id] = post
        
        # Calculate delay
        now = datetime.now()
        delay = (scheduled_datetime - now).total_seconds()
        
        if delay <= 0:
            # Publish immediately
            asyncio.create_task(self._publish_post_by_id(post_id))
            return
        
        # Schedule task
        async def publish_at_time():
            try:
                await asyncio.sleep(delay)
                await self._publish_post_by_id(post_id)
            except asyncio.CancelledError:
                logger.info(f"Publish task for post {post_id} was cancelled")
            except Exception as e:
                logger.error(f"Error in scheduled publish for post {post_id}: {e}")
        
        task = asyncio.create_task(publish_at_time())
        self.scheduled_tasks[post_id] = task
        logger.info(f"Scheduled post {post_id} to publish in {delay:.1f} seconds ({scheduled_datetime})")
    
    async def _publish_post_by_id(self, post_id: str):
        """Publish a post by ID"""
        try:
            # Get post data from cache or database
            if post_id in self.post_data_cache:
                post = self.post_data_cache[post_id]
            else:
                response = self.supabase.table("content_posts").select(
                    "*, content_campaigns(user_id)"
                ).eq("id", post_id).execute()
                if not response.data:
                    logger.error(f"Post {post_id} not found for publishing")
                    return
                post = response.data[0]
            
            await self.publish_post(post)
            # Clean up
            if post_id in self.scheduled_tasks:
                del self.scheduled_tasks[post_id]
            if post_id in self.post_data_cache:
                del self.post_data_cache[post_id]
        except Exception as e:
            logger.error(f"Error publishing post {post_id}: {e}")
    
    async def cancel_scheduled_post(self, post_id: str):
        """Cancel a scheduled post"""
        if post_id in self.scheduled_tasks:
            self.scheduled_tasks[post_id].cancel()
            del self.scheduled_tasks[post_id]
        if post_id in self.post_data_cache:
            del self.post_data_cache[post_id]
        logger.info(f"Cancelled scheduled post {post_id}")
    
    async def check_and_publish_scheduled_posts(self):
        """Check for scheduled posts that need to be published"""
        try:
            now = datetime.now()
            
            # Query for scheduled posts where scheduled_date + scheduled_time <= now
            # We need to combine scheduled_date and scheduled_time into a datetime
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns(user_id)"
            ).eq("status", "scheduled").execute()
            
            if not response.data:
                return
            
            posts_to_publish = []
            
            for post in response.data:
                try:
                    scheduled_date = post.get("scheduled_date")
                    scheduled_time = post.get("scheduled_time", "12:00:00")
                    
                    if not scheduled_date:
                        continue
                    
                    # Combine date and time into datetime
                    if isinstance(scheduled_date, str):
                        scheduled_date_obj = datetime.fromisoformat(scheduled_date).date()
                    else:
                        scheduled_date_obj = scheduled_date
                    
                    if isinstance(scheduled_time, str):
                        # Parse time string (HH:MM:SS or HH:MM)
                        time_parts = scheduled_time.split(":")
                        hour = int(time_parts[0])
                        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                        second = int(time_parts[2]) if len(time_parts) > 2 else 0
                        scheduled_time_obj = datetime.min.replace(
                            hour=hour, minute=minute, second=second
                        ).time()
                    else:
                        scheduled_time_obj = scheduled_time
                    
                    # Combine into datetime
                    scheduled_datetime = datetime.combine(scheduled_date_obj, scheduled_time_obj)
                    
                    # Check if scheduled time has passed
                    if scheduled_datetime <= now:
                        posts_to_publish.append(post)
                        
                except Exception as e:
                    logger.error(f"Error parsing scheduled time for post {post.get('id')}: {e}")
                    continue
            
            # Publish each post
            for post in posts_to_publish:
                try:
                    post_id = post.get("id")
                    # Double-check status before publishing (in case it was published between query and now)
                    current_status = post.get("status", "").lower()
                    if current_status == "published":
                        logger.info(f"Post {post_id} is already published, skipping")
                        continue
                    
                    await self.publish_post(post)
                except Exception as e:
                    logger.error(f"Error publishing post {post.get('id')}: {e}")
                    # Continue with other posts even if one fails
                    continue
                    
        except Exception as e:
            logger.error(f"Error checking scheduled posts: {e}")
    
    async def publish_post(self, post: Dict[str, Any]):
        """Publish a single post to its platform"""
        try:
            post_id = post.get("id")
            platform = post.get("platform", "").lower()
            
            # Check if post is already published - prevent duplicate publishing
            post_status = post.get("status", "").lower()
            if post_status == "published":
                logger.info(f"Post {post_id} is already published, skipping duplicate publish")
                return
            
            # Double-check by querying database for current status
            try:
                current_post = self.supabase.table("content_posts").select("status, metadata").eq("id", post_id).execute()
                if current_post.data:
                    current_status = current_post.data[0].get("status", "").lower()
                    current_metadata = current_post.data[0].get("metadata", {}) or {}
                    
                    # Check if already published
                    if current_status == "published":
                        logger.info(f"Post {post_id} is already published in database, skipping duplicate publish")
                        return
                    
                    # Check if currently being published (prevent concurrent publishes)
                    if isinstance(current_metadata, dict) and current_metadata.get("_publishing"):
                        publishing_at = current_metadata.get("_publishing_at")
                        if publishing_at:
                            # If publishing flag is older than 5 minutes, allow retry (might be stuck)
                            try:
                                publishing_time = datetime.fromisoformat(publishing_at)
                                if (datetime.now() - publishing_time).total_seconds() < 300:  # 5 minutes
                                    logger.info(f"Post {post_id} is currently being published, skipping duplicate publish")
                                    return
                            except:
                                pass
            except Exception as e:
                logger.warning(f"Could not verify post status from database: {e}, continuing with publish")
            
            # Get user_id from campaign relationship
            user_id = None
            campaign_data = post.get("content_campaigns")
            if isinstance(campaign_data, dict):
                user_id = campaign_data.get("user_id")
            elif isinstance(campaign_data, list) and len(campaign_data) > 0:
                user_id = campaign_data[0].get("user_id")
            
            # Fallback: get user_id from campaign_id
            if not user_id:
                campaign_id = post.get("campaign_id")
                if campaign_id:
                    try:
                        campaign_response = self.supabase.table("content_campaigns").select("user_id").eq("id", campaign_id).execute()
                        if campaign_response.data:
                            user_id = campaign_response.data[0].get("user_id")
                    except Exception as e:
                        logger.error(f"Error fetching campaign for post {post_id}: {e}")
            
            if not user_id:
                logger.error(f"No user_id found for post {post_id}")
                return
            
            logger.info(f"Publishing post {post_id} to {platform} for user {user_id}")
            
            # Get platform connection
            connection_response = self.supabase.table("platform_connections").select("*").eq(
                "user_id", user_id
            ).eq("platform", platform).eq("is_active", True).execute()
            
            if not connection_response.data:
                logger.warning(f"No active {platform} connection found for user {user_id}")
                # Update status to draft instead of published
                self.supabase.table("content_posts").update({
                    "status": "draft",
                    "metadata": {
                        **post.get("metadata", {}),
                        "publish_error": f"No active {platform} connection found"
                    }
                }).eq("id", post_id).execute()
                return
            
            connection = connection_response.data[0]
            
            # Check if this is a carousel post
            post_type = post.get("post_type", "").lower()
            metadata = post.get("metadata", {})
            carousel_images = metadata.get("carousel_images", [])
            is_carousel = post_type == "carousel" or (carousel_images and len(carousel_images) > 0)
            
            # Prepare post data
            post_data = {
                "message": post.get("content", ""),
                "title": post.get("title", ""),
                "hashtags": post.get("hashtags", []),
                "content_id": post_id
            }
            
            if is_carousel and carousel_images:
                post_data["post_type"] = "carousel"
                post_data["carousel_images"] = carousel_images
            else:
                # Check if primary_image_url is actually a video
                image_url = post.get("primary_image_url", "")
                post_type = post.get("post_type", "")
                metadata = post.get("metadata", {})
                
                # Check post_type first
                is_video = False
                if post_type and post_type.lower() == 'video':
                    is_video = True
                    logger.info(f"Video detected from post_type for post {post_id}")
                # Check metadata.media_type
                elif metadata and metadata.get('media_type') == 'video':
                    is_video = True
                    logger.info(f"Video detected from metadata.media_type for post {post_id}")
                # Check file extension as fallback
                elif image_url:
                    video_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.3gp']
                    url_lower = image_url.lower().split('?')[0]
                    is_video = any(url_lower.endswith(ext) for ext in video_extensions)
                    if is_video:
                        logger.info(f"Video detected from file extension for post {post_id}")
                
                if image_url:
                    if is_video:
                        post_data["is_video"] = True
                        post_data["video_url"] = image_url
                        post_data["image_url"] = ""  # Clear image_url for video
                    else:
                        post_data["image_url"] = image_url
                        post_data["video_url"] = ""  # Clear video_url for image
                else:
                    post_data["image_url"] = ""
                    post_data["video_url"] = ""
            
            # Mark as publishing immediately to prevent duplicate attempts
            # Use a temporary status or metadata flag
            try:
                self.supabase.table("content_posts").update({
                    "metadata": {
                        **post.get("metadata", {}),
                        "_publishing": True,
                        "_publishing_at": datetime.now().isoformat()
                    }
                }).eq("id", post_id).execute()
            except Exception as e:
                logger.warning(f"Could not set publishing flag: {e}")
            
            # Publish based on platform
            success = False
            published_at = datetime.now().isoformat()
            
            if platform == "facebook":
                success = await self._publish_to_facebook(connection, post_data)
            elif platform == "instagram":
                success = await self._publish_to_instagram(connection, post_data)
            elif platform == "linkedin":
                success = await self._publish_to_linkedin(connection, post_data)
            elif platform == "youtube":
                success = await self._publish_to_youtube(connection, post_data)
            else:
                logger.warning(f"Platform {platform} not supported for auto-publishing")
                # Update status to draft
                self.supabase.table("content_posts").update({
                    "status": "draft",
                    "metadata": {
                        **post.get("metadata", {}),
                        "publish_error": f"Platform {platform} not supported for auto-publishing",
                        "_publishing": False
                    }
                }).eq("id", post_id).execute()
                return
            
            # Update post status immediately after publishing
            if success:
                self.supabase.table("content_posts").update({
                    "status": "published",
                    "published_at": published_at,
                    "metadata": {
                        **post.get("metadata", {}),
                        "_publishing": False
                    }
                }).eq("id", post_id).execute()
                logger.info(f"Successfully published post {post_id} to {platform}")
            else:
                # Update status to draft on failure
                self.supabase.table("content_posts").update({
                    "status": "draft",
                    "metadata": {
                        **post.get("metadata", {}),
                        "publish_error": "Failed to publish post",
                        "_publishing": False
                    }
                }).eq("id", post_id).execute()
                logger.error(f"Failed to publish post {post_id} to {platform}")
                
        except Exception as e:
            logger.error(f"Error publishing post {post.get('id')}: {e}")
            # Update status to draft on error and clear publishing flag
            try:
                post_id = post.get("id")
                current_metadata = post.get("metadata", {}) or {}
                self.supabase.table("content_posts").update({
                    "status": "draft",
                    "metadata": {
                        **current_metadata,
                        "publish_error": str(e),
                        "_publishing": False
                    }
                }).eq("id", post_id).execute()
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up publishing flag: {cleanup_error}")
    
    async def _publish_to_facebook(self, connection: Dict[str, Any], post_data: Dict[str, Any]) -> bool:
        """Publish to Facebook"""
        try:
            access_token = self.decrypt_token(connection.get("access_token_encrypted", ""))
            page_id = connection.get("page_id") or connection.get("facebook_page_id")
            
            if not page_id:
                logger.error("No page_id found in Facebook connection")
                return False
            
            if not access_token:
                logger.error("No access token found in Facebook connection")
                return False
            
            # Prepare message
            message = post_data.get("message", "")
            title = post_data.get("title", "")
            hashtags = post_data.get("hashtags", [])
            
            full_message = ""
            if title:
                full_message += f"{title}\n\n"
            full_message += message
            if hashtags:
                hashtag_string = " ".join([f"#{tag.replace('#', '')}" for tag in hashtags])
                full_message += f"\n\n{hashtag_string}"
            
            image_url = post_data.get("image_url", "")
            carousel_images = post_data.get("carousel_images", [])
            is_carousel = post_data.get("post_type") == "carousel" or (carousel_images and len(carousel_images) > 0)
            
            async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for carousel
                # Handle carousel post
                if is_carousel and carousel_images:
                    logger.info(f"Publishing Facebook carousel with {len(carousel_images)} images")
                    
                    # Step 1: Create photo containers for each image (published=false)
                    photo_ids = []
                    for idx, img_url in enumerate(carousel_images):
                        try:
                            photo_url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                            photo_params = {
                                "url": img_url,
                                "published": "false",
                                "access_token": access_token
                            }
                            
                            photo_response = await client.post(photo_url, params=photo_params)
                            if photo_response.status_code == 200:
                                photo_data = photo_response.json()
                                photo_id = photo_data.get('id')
                                if photo_id:
                                    photo_ids.append({"media_fbid": photo_id})
                                    logger.info(f"Created photo container {idx + 1}/{len(carousel_images)}: {photo_id}")
                                else:
                                    logger.warning(f"Photo container {idx + 1} created but no ID returned")
                            else:
                                error_data = photo_response.json() if photo_response.headers.get('content-type', '').startswith('application/json') else {"error": photo_response.text}
                                logger.error(f"Failed to create photo container {idx + 1}: {error_data}")
                                return False
                        except Exception as e:
                            logger.error(f"Error creating photo container {idx + 1}: {e}")
                            return False
                    
                    if not photo_ids:
                        logger.error("Failed to create photo containers for carousel")
                        return False
                    
                    # Step 2: Create carousel post with attached_media
                    import json
                    url = f"https://graph.facebook.com/v18.0/{page_id}/feed"
                    params = {
                        "message": full_message,
                        "attached_media": json.dumps(photo_ids),  # JSON string of photo IDs
                        "access_token": access_token
                    }
                    
                    logger.info(f"Posting carousel to feed endpoint with {len(photo_ids)} photos")
                    response = await client.post(url, params=params)
                    
                    # Parse response
                    try:
                        response_data = response.json()
                    except:
                        response_text = response.text
                        logger.error(f"Facebook API returned non-JSON response: {response_text}")
                        return False
                    
                    if response.status_code == 200:
                        if response_data.get("id"):
                            logger.info(f"Facebook carousel post published: {response_data.get('id')}")
                            return True
                        else:
                            logger.error(f"Facebook carousel post failed - no ID in response: {response_data}")
                            return False
                    else:
                        error_message = response_data.get("error", {}).get("message", "Unknown error") if isinstance(response_data, dict) else str(response_data)
                        logger.error(f"Facebook carousel API error: {error_message}")
                        return False
                
                # Determine if media is a video or image
                is_video = False
                if image_url:
                    video_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.3gp']
                    image_url_lower = image_url.lower()
                    url_without_query = image_url_lower.split('?')[0]
                    is_video = any(url_without_query.endswith(ext) for ext in video_extensions)
                
                # Post to Facebook based on media type
                if image_url:
                    if is_video:
                        # For videos, use videos endpoint
                        url = f"https://graph.facebook.com/v18.0/{page_id}/videos"
                        params = {
                            "file_url": image_url,
                            "description": full_message,
                            "access_token": access_token
                        }
                    else:
                        # For images, use photos endpoint
                        url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                        params = {
                            "url": image_url,
                            "caption": full_message,
                            "access_token": access_token
                        }
                else:
                    # For text-only posts, use feed endpoint
                    url = f"https://graph.facebook.com/v18.0/{page_id}/feed"
                    params = {
                        "message": full_message,
                        "access_token": access_token
                    }
                
                response = await client.post(url, params=params)
                
                # Parse response
                try:
                    response_data = response.json()
                except:
                    response_text = response.text
                    logger.error(f"Facebook API returned non-JSON response: {response_text}")
                    return False
                
                if response.status_code == 200:
                    if response_data.get("id"):
                        logger.info(f"Facebook post published: {response_data.get('id')}")
                        return True
                    else:
                        logger.error(f"Facebook post failed - no ID in response: {response_data}")
                        return False
                else:
                    error_message = response_data.get("error", {}).get("message", "Unknown error") if isinstance(response_data, dict) else str(response_data)
                    error_code = response_data.get("error", {}).get("code", response.status_code) if isinstance(response_data, dict) else response.status_code
                    error_type = response_data.get("error", {}).get("type", "Unknown") if isinstance(response_data, dict) else "Unknown"
                    logger.error(f"Facebook API error ({error_code}, {error_type}): {error_message}. Full response: {response_data}")
                    return False
                    
        except httpx.HTTPStatusError as e:
            error_data = {}
            try:
                error_data = e.response.json() if e.response else {}
            except:
                error_data = {"error": str(e)}
            error_msg = error_data.get("error", {}).get("message", str(e)) if isinstance(error_data, dict) else str(e)
            logger.error(f"HTTP error publishing to Facebook: {error_msg}. Status: {e.response.status_code if e.response else 'unknown'}. Response: {error_data}")
            return False
        except Exception as e:
            logger.error(f"Error publishing to Facebook: {type(e).__name__}: {str(e)}", exc_info=True)
            return False
    
    async def _publish_to_instagram(self, connection: Dict[str, Any], post_data: Dict[str, Any]) -> bool:
        """Publish to Instagram"""
        try:
            access_token = self.decrypt_token(connection.get("access_token_encrypted", ""))
            page_id = connection.get("page_id") or connection.get("instagram_page_id")
            
            if not page_id:
                logger.error("No page_id found in Instagram connection")
                return False
            
            # Check if this is a carousel post
            carousel_images = post_data.get("carousel_images", [])
            is_carousel = post_data.get("post_type") == "carousel" or (carousel_images and len(carousel_images) > 0)
            
            if is_carousel and carousel_images:
                # Handle carousel post
                logger.info(f"Publishing Instagram carousel with {len(carousel_images)} images")
                
                # Prepare caption
                message = post_data.get("message", "")
                title = post_data.get("title", "")
                hashtags = post_data.get("hashtags", [])
                
                caption = ""
                if title:
                    caption += f"{title}\n\n"
                caption += message
                if hashtags:
                    hashtag_string = " ".join([f"#{tag.replace('#', '')}" for tag in hashtags])
                    caption += f"\n\n{hashtag_string}"
                
                async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for carousel
                    # Step 1: Create media containers for each image (is_carousel_item=true)
                    container_ids = []
                    for idx, img_url in enumerate(carousel_images):
                        try:
                            container_url = f"https://graph.facebook.com/v18.0/{page_id}/media"
                            container_params = {
                                "image_url": img_url,
                                "is_carousel_item": "true",
                                "access_token": access_token
                            }
                            
                            container_response = await client.post(container_url, params=container_params)
                            if container_response.status_code == 200:
                                container_result = container_response.json()
                                container_id = container_result.get('id')
                                if container_id:
                                    container_ids.append(container_id)
                                    logger.info(f"Created media container {idx + 1}/{len(carousel_images)}: {container_id}")
                                else:
                                    logger.warning(f"Media container {idx + 1} created but no ID returned")
                            else:
                                error_data = container_response.json() if container_response.headers.get('content-type', '').startswith('application/json') else {"error": container_response.text}
                                logger.error(f"Failed to create media container {idx + 1}: {error_data}")
                                return False
                        except Exception as e:
                            logger.error(f"Error creating media container {idx + 1}: {e}")
                            return False
                    
                    if not container_ids:
                        logger.error("Failed to create media containers for carousel")
                        return False
                    
                    # Step 2: Create carousel container with children parameter
                    carousel_url = f"https://graph.facebook.com/v18.0/{page_id}/media"
                    carousel_params = {
                        "media_type": "CAROUSEL",
                        "children": ",".join(container_ids),  # Comma-separated list of container IDs
                        "caption": caption,
                        "access_token": access_token
                    }
                    
                    logger.info(f"Creating Instagram carousel container with {len(container_ids)} children")
                    carousel_response = await client.post(carousel_url, params=carousel_params)
                    
                    if carousel_response.status_code != 200:
                        error_data = carousel_response.json() if carousel_response.headers.get('content-type', '').startswith('application/json') else {"error": carousel_response.text}
                        logger.error(f"Failed to create carousel container: {error_data}")
                        return False
                    
                    carousel_result = carousel_response.json()
                    creation_id = carousel_result.get('id')
                    
                    if not creation_id:
                        logger.error("Failed to create carousel container - no creation ID returned")
                        return False
                    
                    # Step 3: Publish the carousel
                    publish_url = f"https://graph.facebook.com/v18.0/{page_id}/media_publish"
                    publish_params = {
                        "creation_id": creation_id,
                        "access_token": access_token
                    }
                    
                    logger.info(f"Publishing Instagram carousel: {creation_id}")
                    publish_response = await client.post(publish_url, params=publish_params)
                    
                    if publish_response.status_code == 200:
                        publish_result = publish_response.json()
                        post_id = publish_result.get('id')
                        logger.info(f"Instagram carousel post published: {post_id}")
                        return True
                    else:
                        error_data = publish_response.json() if publish_response.headers.get('content-type', '').startswith('application/json') else {"error": publish_response.text}
                        logger.error(f"Failed to publish Instagram carousel: {error_data}")
                        return False
            
            # Instagram requires image or video, so check if we have one
            image_url = post_data.get("image_url", "")
            video_url = post_data.get("video_url", "")
            media_url = video_url if video_url else image_url
            
            if not media_url:
                logger.warning("Instagram post requires an image or video, but none provided")
                return False
            
            # Check if media is a video or image
            # First check if is_video flag is already set (from post_type/metadata detection in publish_post)
            is_video = post_data.get("is_video", False)
            if not is_video and media_url:
                # Fallback: Check if URL is a video by file extension (handle URLs with query parameters)
                video_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.3gp']
                media_url_lower = media_url.lower()
                # Remove query parameters for extension check
                url_without_query = media_url_lower.split('?')[0]
                is_video = any(url_without_query.endswith(ext) for ext in video_extensions)
            
            if is_video:
                logger.info(f"Media type detection: Video/Reel - URL: {media_url[:100] if media_url else 'N/A'}...")
            else:
                logger.info(f"Media type detection: Image - URL: {media_url[:100] if media_url else 'N/A'}...")
            
            # Prepare caption
            message = post_data.get("message", "")
            title = post_data.get("title", "")
            hashtags = post_data.get("hashtags", [])
            
            caption = ""
            if title:
                caption += f"{title}\n\n"
            caption += message
            if hashtags:
                hashtag_string = " ".join([f"#{tag.replace('#', '')}" for tag in hashtags])
                caption += f"\n\n{hashtag_string}"
            
            # Step 1: Create media container
            container_url = f"https://graph.facebook.com/v18.0/{page_id}/media"
            
            # Prepare container params based on media type
            if is_video:
                # For posts with videos/reels
                container_params = {
                    "media_type": "REELS",
                    "video_url": media_url,  # Use video_url for reels
                    "caption": caption,
                    "access_token": access_token
                }
                logger.info(f"Creating Instagram reel with video")
            else:
                # For posts with images
                container_params = {
                    "image_url": media_url,
                    "caption": caption,
                    "access_token": access_token
                }
                logger.info(f"Creating Instagram post with image")
            
            # Use longer timeout for videos/reels as they take longer to process
            timeout = 180.0 if is_video else 60.0
            async with httpx.AsyncClient(timeout=timeout) as client:
                # Create container
                container_response = await client.post(container_url, params=container_params)
                container_response.raise_for_status()
                container_result = container_response.json()
                creation_id = container_result.get("id")
                
                if not creation_id:
                    logger.error(f"Failed to create Instagram media container: {container_result}")
                    return False
                
                # For videos/reels, wait for processing before publishing (with shorter timeout for better UX)
                if is_video:
                    # Check status and wait for processing
                    status_url = f"https://graph.facebook.com/v18.0/{creation_id}"
                    max_wait_time = 120  # Maximum 2 minutes wait
                    wait_interval = 5  # Check every 5 seconds
                    elapsed_time = 0
                    
                    while elapsed_time < max_wait_time:
                        await asyncio.sleep(wait_interval)
                        elapsed_time += wait_interval
                        
                        status_response = await client.get(status_url, params={"access_token": access_token, "fields": "status_code"})
                        if status_response.status_code == 200:
                            status_data = status_response.json()
                            status_code = status_data.get("status_code")
                            
                            # Status codes: "FINISHED" = ready, "IN_PROGRESS" = still processing, "ERROR" = failed
                            if status_code == "FINISHED":
                                logger.info(f"Video processing finished, ready to publish")
                                break
                            elif status_code == "ERROR":
                                logger.error(f"Video processing failed with error status")
                                return False
                            # If IN_PROGRESS, continue waiting
                        else:
                            logger.warning(f"Could not check video status, proceeding anyway")
                            break
                
                # Step 2: Publish the container
                publish_url = f"https://graph.facebook.com/v18.0/{page_id}/media_publish"
                publish_params = {
                    "creation_id": creation_id,
                    "access_token": access_token
                }
                
                publish_response = await client.post(publish_url, params=publish_params)
                publish_response.raise_for_status()
                publish_result = publish_response.json()
                
                if publish_result.get("id"):
                    post_id = publish_result.get("id")
                    logger.info(f"Instagram {'reel' if is_video else 'post'} published: {post_id}")
                    return True
                else:
                    logger.error(f"Instagram post failed: {publish_result}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error publishing to Instagram: {e}")
            return False
    
    async def _publish_to_linkedin(self, connection: Dict[str, Any], post_data: Dict[str, Any]) -> bool:
        """Publish to LinkedIn"""
        try:
            access_token = self.decrypt_token(connection.get("access_token_encrypted", ""))
            linkedin_id = connection.get("linkedin_id") or connection.get("page_id")
            
            if not linkedin_id:
                logger.error("No linkedin_id found in LinkedIn connection")
                return False
            
            # Prepare message
            message = post_data.get("message", "")
            title = post_data.get("title", "")
            hashtags = post_data.get("hashtags", [])
            
            full_message = ""
            if title:
                full_message += f"{title}\n\n"
            full_message += message
            if hashtags:
                hashtag_string = " ".join([f"#{tag.replace('#', '')}" for tag in hashtags])
                full_message += f"\n\n{hashtag_string}"
            
            # Post to LinkedIn using UGC API
            url = "https://api.linkedin.com/v2/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            # Determine if posting to organization or personal profile
            organization_id = connection.get("organization_id")
            if organization_id:
                author_urn = f"urn:li:organization:{organization_id}"
            else:
                author_urn = f"urn:li:person:{linkedin_id}"
            
            payload = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": full_message
                        },
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            # Add image if available
            image_url = post_data.get("image_url", "")
            if image_url:
                # For LinkedIn, we'd need to upload the image first and get an asset URN
                # For now, we'll skip image support in auto-publish
                pass
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                result = response.json()
                
                if result.get("id"):
                    logger.info(f"LinkedIn post published: {result.get('id')}")
                    return True
                else:
                    logger.error(f"LinkedIn post failed: {result}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error publishing to LinkedIn: {e}")
            return False
    
    async def _publish_to_youtube(self, connection: Dict[str, Any], post_data: Dict[str, Any]) -> bool:
        """Publish to YouTube (Community Post)"""
        try:
            # YouTube community posts require different API calls
            # For now, we'll skip YouTube auto-publishing as it's more complex
            logger.warning("YouTube auto-publishing not yet implemented")
            return False
        except Exception as e:
            logger.error(f"Error publishing to YouTube: {e}")
            return False

# Global publisher instance
post_publisher: Optional[PostPublisher] = None

async def start_post_publisher(supabase_url: str, supabase_key: str):
    """Start the post publisher"""
    global post_publisher
    post_publisher = PostPublisher(supabase_url, supabase_key)
    await post_publisher.start()

async def stop_post_publisher():
    """Stop the post publisher"""
    global post_publisher
    if post_publisher:
        await post_publisher.stop()

