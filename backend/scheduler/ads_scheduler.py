"""
Ads Scheduler for Weekly Ads Generation
Runs every Sunday at 4:00 AM IST when the server is running
"""

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
import pytz

from agents.ads_creation_agent import AdsCreationAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdsScheduler:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.openai_api_key = openai_api_key
        self.ads_agent = None
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the ads scheduler"""
        if self.is_running:
            logger.warning("Ads scheduler is already running")
            return
            
        self.is_running = True
        self.ads_agent = AdsCreationAgent(self.supabase_url, self.supabase_key, self.openai_api_key)
        
        # Start the background task
        self.task = asyncio.create_task(self._run_scheduler())
        logger.info("Ads scheduler started - will run every Sunday at 4:00 AM IST")
        
    async def stop(self):
        """Stop the ads scheduler"""
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Ads scheduler stopped")
        
    async def _run_scheduler(self):
        """Run the ads scheduler loop"""
        ist = pytz.timezone('Asia/Kolkata')
        
        while self.is_running:
            try:
                # Get current time in IST
                now = datetime.now(ist)
                
                # Check if it's Sunday at 4:00 AM IST
                if now.weekday() == 6 and now.hour == 4 and now.minute == 0:
                    logger.info("Starting weekly ads generation...")
                    await self._generate_weekly_ads()
                    
                    # Wait for 1 minute to avoid running multiple times
                    await asyncio.sleep(60)
                else:
                    # Check every minute
                    await asyncio.sleep(60)
                    
            except Exception as e:
                logger.error(f"Error in ads scheduler loop: {e}")
                await asyncio.sleep(60)  # Wait before retrying
                
    async def _generate_weekly_ads(self):
        """Generate weekly ads for all users"""
        try:
            from supabase import create_client
            
            supabase = create_client(self.supabase_url, self.supabase_key)
            supabase_admin = create_client(self.supabase_url, os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
            
            # Get all users with social media platforms
            response = supabase.table("profiles").select("id, social_media_platforms").not_.is_("social_media_platforms", "null").execute()
            
            if not response.data:
                logger.info("No users found with social media platforms")
                return
                
            logger.info(f"Found {len(response.data)} users for ads generation")
            
            # Generate ads for each user
            for user in response.data:
                try:
                    user_id = user["id"]
                    platforms = user.get("social_media_platforms", [])
                    
                    if not platforms:
                        logger.info(f"User {user_id} has no social media platforms, skipping")
                        continue
                    
                    logger.info(f"Generating ads for user {user_id} with platforms: {platforms}")
                    
                    # Generate ads using the ads creation agent
                    result = await self.ads_agent.generate_ads_for_user(user_id)
                    
                    if result["success"]:
                        logger.info(f"Successfully generated {result['ads_generated']} ads for user {user_id}")
                    else:
                        logger.error(f"Failed to generate ads for user {user_id}: {result['error']}")
                        
                except Exception as e:
                    logger.error(f"Error generating ads for user {user['id']}: {e}")
                    continue
                    
            logger.info("Weekly ads generation completed")
            
        except Exception as e:
            logger.error(f"Error in weekly ads generation: {e}")
            
    async def generate_ads_for_user(self, user_id: str):
        """Generate ads for a specific user (manual trigger)"""
        try:
            if not self.ads_agent:
                self.ads_agent = AdsCreationAgent(self.supabase_url, self.supabase_key, self.openai_api_key)
                
            result = await self.ads_agent.generate_ads_for_user(user_id)
            return result
            
        except Exception as e:
            logger.error(f"Error generating ads for user {user_id}: {e}")
            return {"success": False, "error": str(e), "ads_generated": 0, "campaign_id": None}
