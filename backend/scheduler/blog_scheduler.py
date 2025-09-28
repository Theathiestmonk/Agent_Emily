import asyncio
import logging
import os
from datetime import datetime, timedelta
from supabase import create_client
from agents.blog_writing_agent import BlogWritingAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BlogScheduler:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.openai_api_key = openai_api_key
        self.blog_agent = BlogWritingAgent(supabase_url, supabase_key, openai_api_key)
        self.running = False

    async def start(self):
        """Start the blog scheduler"""
        if self.running:
            logger.warning("Blog scheduler is already running")
            return
        
        self.running = True
        logger.info("Starting blog scheduler")
        
        # Start the main scheduler loop
        asyncio.create_task(self._run_scheduler())

    async def stop(self):
        """Stop the blog scheduler"""
        self.running = False
        logger.info("Blog scheduler stopped")

    async def _run_scheduler(self):
        """Main scheduler loop"""
        while self.running:
            try:
                # Check if it's time to generate blogs (weekly on Sundays at 6:00 AM IST)
                now = datetime.now()
                
                # Check if it's Sunday (weekday 6) and between 6:00-6:30 AM
                if now.weekday() == 6 and 6 <= now.hour <= 6 and now.minute < 30:
                    logger.info("It's time for weekly blog generation")
                    await self._generate_weekly_blogs()
                
                # Wait for 30 minutes before checking again
                await asyncio.sleep(30 * 60)  # 30 minutes
                
            except Exception as e:
                logger.error(f"Error in blog scheduler loop: {e}")
                await asyncio.sleep(5 * 60)  # Wait 5 minutes on error

    async def _generate_weekly_blogs(self):
        """Generate weekly blogs for all users with WordPress connections"""
        try:
            logger.info("Starting weekly blog generation")
            
            # Get Supabase admin client
            supabase_admin = create_client(self.supabase_url, os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
            
            # Get all users with active WordPress connections
            response = supabase_admin.table("platform_connections").select("user_id").eq("platform", "wordpress").eq("is_active", True).execute()
            
            if not response.data:
                logger.info("No users with WordPress connections found")
                return
            
            # Get unique user IDs
            user_ids = list(set([conn["user_id"] for conn in response.data]))
            logger.info(f"Found {len(user_ids)} users with WordPress connections")
            
            # Generate blogs for each user
            for user_id in user_ids:
                try:
                    logger.info(f"Generating blogs for user: {user_id}")
                    
                    # Check if user already has blogs generated this week
                    week_start = datetime.now() - timedelta(days=datetime.now().weekday())
                    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
                    
                    existing_blogs_response = supabase_admin.table("blog_posts").select("id").eq("author_id", user_id).gte("created_at", week_start.isoformat()).execute()
                    
                    if existing_blogs_response.data and len(existing_blogs_response.data) > 0:
                        logger.info(f"User {user_id} already has blogs for this week, skipping")
                        continue
                    
                    # Generate blogs for this user
                    result = await self.blog_agent.generate_blogs_for_user(user_id)
                    
                    if result["success"]:
                        logger.info(f"Successfully generated {result['total_blogs']} blogs for user {user_id}")
                    else:
                        logger.error(f"Failed to generate blogs for user {user_id}: {result.get('error', 'Unknown error')}")
                    
                    # Add delay between users to avoid rate limiting
                    await asyncio.sleep(10)
                    
                except Exception as e:
                    logger.error(f"Error generating blogs for user {user_id}: {e}")
                    continue
            
            logger.info("Weekly blog generation completed")
            
        except Exception as e:
            logger.error(f"Error in weekly blog generation: {e}")

    async def generate_blogs_for_user(self, user_id: str):
        """Generate blogs for a specific user (manual trigger)"""
        try:
            logger.info(f"Manually generating blogs for user: {user_id}")
            
            result = await self.blog_agent.generate_blogs_for_user(user_id)
            
            if result["success"]:
                logger.info(f"Successfully generated {result['total_blogs']} blogs for user {user_id}")
            else:
                logger.error(f"Failed to generate blogs for user {user_id}: {result.get('error', 'Unknown error')}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating blogs for user {user_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "blogs": [],
                "campaign": None
            }
