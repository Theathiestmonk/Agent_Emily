"""
Background Scheduler for Weekly Content and Ads Generation
Runs every Sunday at 4:00 AM IST when the server is running
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import pytz

from scheduler.content_scheduler import ContentScheduler
from scheduler.ads_scheduler import AdsScheduler
from scheduler.blog_scheduler import BlogScheduler
from scheduler.post_publisher import start_post_publisher, stop_post_publisher

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BackgroundScheduler:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.openai_api_key = openai_api_key
        self.content_scheduler = None
        self.ads_scheduler = None
        self.blog_scheduler = None
        self.is_running = False
        
    async def start(self):
        """Start the background scheduler"""
        if self.is_running:
            logger.warning("Background scheduler is already running")
            return
            
        self.is_running = True
        self.content_scheduler = ContentScheduler(self.supabase_url, self.supabase_key, self.openai_api_key)
        self.ads_scheduler = AdsScheduler(self.supabase_url, self.supabase_key, self.openai_api_key)
        self.blog_scheduler = BlogScheduler(self.supabase_url, self.supabase_key, self.openai_api_key)
        
        # Start all schedulers
        await self.content_scheduler.start()
        await self.ads_scheduler.start()
        await self.blog_scheduler.start()
        
        # Start post publisher for auto-publishing scheduled posts
        await start_post_publisher(self.supabase_url, self.supabase_key)
        
        logger.info("Background scheduler started - will run every Sunday at 4:00 AM IST")
        logger.info("Post publisher started - checking for scheduled posts every minute")
        
    async def stop(self):
        """Stop the background scheduler"""
        self.is_running = False
        
        # Stop all schedulers
        if self.content_scheduler:
            await self.content_scheduler.stop()
        if self.ads_scheduler:
            await self.ads_scheduler.stop()
        if self.blog_scheduler:
            await self.blog_scheduler.stop()
        
        # Stop post publisher
        await stop_post_publisher()
            
        logger.info("Background scheduler stopped")
        
    async def generate_content_for_user(self, user_id: str):
        """Generate content for a specific user (manual trigger)"""
        try:
            if not self.content_scheduler:
                self.content_scheduler = ContentScheduler(self.supabase_url, self.supabase_key, self.openai_api_key)
                
            result = await self.content_scheduler.generate_content_for_user(user_id)
            return result
            
        except Exception as e:
            logger.error(f"Error generating content for user {user_id}: {e}")
            return {"success": False, "error": str(e), "posts_generated": 0, "campaign_id": None}
            
    async def generate_ads_for_user(self, user_id: str):
        """Generate ads for a specific user (manual trigger)"""
        try:
            if not self.ads_scheduler:
                self.ads_scheduler = AdsScheduler(self.supabase_url, self.supabase_key, self.openai_api_key)
                
            result = await self.ads_scheduler.generate_ads_for_user(user_id)
            return result
            
        except Exception as e:
            logger.error(f"Error generating ads for user {user_id}: {e}")
            return {"success": False, "error": str(e), "ads_generated": 0, "campaign_id": None}

# Global scheduler instance
background_scheduler: Optional[BackgroundScheduler] = None

async def start_background_scheduler(supabase_url: str, supabase_key: str, openai_api_key: str):
    """Start the background scheduler"""
    global background_scheduler
    background_scheduler = BackgroundScheduler(supabase_url, supabase_key, openai_api_key)
    await background_scheduler.start()

async def stop_background_scheduler():
    """Stop the background scheduler"""
    global background_scheduler
    if background_scheduler:
        await background_scheduler.stop()