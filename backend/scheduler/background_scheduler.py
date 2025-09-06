"""
Background Scheduler for Weekly Content Generation
Runs every Sunday at 4:00 AM IST when the server is running
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import pytz

from scheduler.content_scheduler import ContentScheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BackgroundScheduler:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.openai_api_key = openai_api_key
        self.scheduler = None
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the background scheduler"""
        if self.is_running:
            logger.warning("Background scheduler is already running")
            return
            
        self.is_running = True
        self.scheduler = ContentScheduler(self.supabase_url, self.supabase_key, self.openai_api_key)
        
        # Start the background task
        self.task = asyncio.create_task(self._run_scheduler())
        logger.info("Background scheduler started - will run every Sunday at 4:00 AM IST")
        
    async def stop(self):
        """Stop the background scheduler"""
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Background scheduler stopped")
        
    async def _run_scheduler(self):
        """Main scheduler loop"""
        while self.is_running:
            try:
                # Check if it's Sunday at 4:00 AM IST
                if self._should_run_now():
                    logger.info("Starting scheduled weekly content generation...")
                    await self._run_weekly_generation()
                else:
                    # Sleep for 1 hour and check again
                    await asyncio.sleep(3600)  # 1 hour
                    
            except asyncio.CancelledError:
                logger.info("Scheduler task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                # Sleep for 1 hour before retrying
                await asyncio.sleep(3600)
                
    def _should_run_now(self) -> bool:
        """Check if it's time to run the weekly generation"""
        try:
            # Get current time in IST
            ist = pytz.timezone('Asia/Kolkata')
            now_ist = datetime.now(ist)
            
            # Check if it's Sunday (weekday 6) and between 4:00-4:59 AM
            is_sunday = now_ist.weekday() == 6  # Sunday is 6
            is_4am_hour = now_ist.hour == 4
            
            # Also check if we haven't run this week already
            # We'll use a simple file-based check to avoid running multiple times
            if is_sunday and is_4am_hour:
                return self._check_if_not_run_this_week(now_ist)
                
            return False
            
        except Exception as e:
            logger.error(f"Error checking schedule time: {e}")
            return False
            
    def _check_if_not_run_this_week(self, current_time: datetime) -> bool:
        """Check if we haven't already run this week"""
        try:
            # Get the start of this week (Monday)
            week_start = current_time - timedelta(days=current_time.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Check if we have a marker file for this week
            import os
            marker_file = f"weekly_run_{week_start.strftime('%Y_%m_%d')}.marker"
            marker_path = os.path.join(os.path.dirname(__file__), marker_file)
            
            if os.path.exists(marker_path):
                logger.info(f"Weekly generation already ran this week (marker: {marker_file})")
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Error checking weekly run status: {e}")
            return True  # If we can't check, assume we should run
            
    async def _run_weekly_generation(self):
        """Run the weekly content generation"""
        try:
            logger.info("Executing scheduled weekly content generation...")
            
            # Run the content generation
            result = await self.scheduler.run_weekly_content_generation()
            
            # Create a marker file to indicate we've run this week
            self._create_weekly_marker()
            
            logger.info(f"Weekly content generation completed: {result}")
            
        except Exception as e:
            logger.error(f"Error in weekly content generation: {e}")
            
    def _create_weekly_marker(self):
        """Create a marker file to indicate weekly generation has run"""
        try:
            import os
            ist = pytz.timezone('Asia/Kolkata')
            now_ist = datetime.now(ist)
            week_start = now_ist - timedelta(days=now_ist.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            marker_file = f"weekly_run_{week_start.strftime('%Y_%m_%d')}.marker"
            marker_path = os.path.join(os.path.dirname(__file__), marker_file)
            
            with open(marker_path, 'w') as f:
                f.write(f"Weekly generation completed at {now_ist.isoformat()}\n")
                
            logger.info(f"Created weekly marker file: {marker_file}")
            
        except Exception as e:
            logger.error(f"Error creating weekly marker: {e}")

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
