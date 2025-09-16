"""
Content Creation Scheduler
Runs weekly content generation for all users with completed onboarding
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any

from supabase import create_client, Client
from agents.content_creation_agent import ContentCreationAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ContentScheduler:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str, progress_callback=None):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.content_agent = ContentCreationAgent(supabase_url, supabase_key, openai_api_key, progress_callback)
        self.running = False

    async def start(self):
        """Start the content scheduler"""
        if self.running:
            logger.warning("Content scheduler is already running")
            return
        
        self.running = True
        logger.info("Content scheduler started")

    async def stop(self):
        """Stop the content scheduler"""
        self.running = False
        logger.info("Content scheduler stopped")
        
    async def get_users_with_completed_onboarding(self) -> List[Dict[str, Any]]:
        """Get all users who have completed onboarding"""
        try:
            response = self.supabase.table("profiles").select("id, business_name, social_media_platforms").eq("onboarding_completed", True).execute()
            
            if response.data:
                logger.info(f"Found {len(response.data)} users with completed onboarding")
                return response.data
            else:
                logger.info("No users with completed onboarding found")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching users: {e}")
            return []
    
    async def cleanup_all_existing_content(self) -> None:
        """Clean up all existing content for all users"""
        try:
            logger.info("Starting global content cleanup...")
            
            # Get all campaigns
            campaigns_response = self.supabase.table("content_campaigns").select("id, user_id").execute()
            
            if campaigns_response.data:
                campaign_ids = [campaign["id"] for campaign in campaigns_response.data]
                logger.info(f"Found {len(campaign_ids)} campaigns to delete")
                
                # Delete all posts for these campaigns
                for campaign_id in campaign_ids:
                    posts_response = self.supabase.table("content_posts").delete().eq("campaign_id", campaign_id).execute()
                    logger.info(f"Deleted posts for campaign {campaign_id}")
                
                # Delete all campaigns
                campaigns_delete_response = self.supabase.table("content_campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                logger.info(f"Deleted {len(campaign_ids)} campaigns")
                
                # Delete any associated images
                for campaign_id in campaign_ids:
                    images_response = self.supabase.table("content_images").delete().in_("post_id", 
                        self.supabase.table("content_posts").select("id").eq("campaign_id", campaign_id).execute().data or []
                    ).execute()
                    logger.info(f"Deleted images for campaign {campaign_id}")
            
            logger.info("Global content cleanup completed")
            
        except Exception as e:
            logger.error(f"Error in global content cleanup: {e}")

    async def run_weekly_content_generation(self) -> Dict[str, Any]:
        """Run weekly content generation for all eligible users"""
        try:
            logger.info("Starting weekly content generation...")
            
            # Get users with completed onboarding
            users = await self.get_users_with_completed_onboarding()
            
            if not users:
                logger.info("No users to generate content for")
                return {
                    "success": True,
                    "message": "No users to generate content for",
                    "total_users": 0,
                    "successful_generations": 0,
                    "failed_generations": 0
                }
            
            successful_generations = 0
            failed_generations = 0
            results = []
            
            # Generate content for each user
            for user in users:
                try:
                    logger.info(f"Generating content for user: {user['business_name']} ({user['id']})")
                    
                    # Check if user has social media platforms configured
                    if not user.get('social_media_platforms'):
                        logger.warning(f"User {user['business_name']} has no social media platforms configured, skipping")
                        continue
                    
                    # Run content generation
                    result = await self.content_agent.run_weekly_generation(user['id'])
                    
                    if result['success']:
                        successful_generations += 1
                        logger.info(f"Successfully generated content for {user['business_name']}: {result['total_posts']} posts")
                    else:
                        failed_generations += 1
                        logger.error(f"Failed to generate content for {user['business_name']}: {result['error_message']}")
                    
                    results.append({
                        "user_id": user['id'],
                        "business_name": user['business_name'],
                        "success": result['success'],
                        "total_posts": result['total_posts'],
                        "completed_platforms": result['completed_platforms'],
                        "failed_platforms": result['failed_platforms'],
                        "error_message": result.get('error_message')
                    })
                    
                except Exception as e:
                    failed_generations += 1
                    logger.error(f"Error generating content for user {user['id']}: {e}")
                    results.append({
                        "user_id": user['id'],
                        "business_name": user['business_name'],
                        "success": False,
                        "total_posts": 0,
                        "completed_platforms": [],
                        "failed_platforms": [],
                        "error_message": str(e)
                    })
            
            # Log summary
            logger.info(f"Weekly content generation completed:")
            logger.info(f"Total users: {len(users)}")
            logger.info(f"Successful generations: {successful_generations}")
            logger.info(f"Failed generations: {failed_generations}")
            
            return {
                "success": True,
                "message": "Weekly content generation completed",
                "total_users": len(users),
                "successful_generations": successful_generations,
                "failed_generations": failed_generations,
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error in weekly content generation: {e}")
            return {
                "success": False,
                "message": f"Error in weekly content generation: {str(e)}",
                "total_users": 0,
                "successful_generations": 0,
                "failed_generations": 0,
                "results": []
            }
    
    async def run_single_user_generation(self, user_id: str) -> Dict[str, Any]:
        """Run content generation for a single user"""
        try:
            logger.info(f"Generating content for single user: {user_id}")
            
            # Check if user exists and has completed onboarding
            user_response = self.supabase.table("profiles").select("id, business_name, onboarding_completed, social_media_platforms").eq("id", user_id).execute()
            
            logger.info(f"User lookup result: {user_response.data}")
            
            if not user_response.data:
                # Try to get all profiles to debug
                all_profiles = self.supabase.table("profiles").select("id, business_name").execute()
                logger.info(f"All profiles in database: {all_profiles.data}")
                
                return {
                    "success": False,
                    "message": f"User not found. Looking for: {user_id}",
                    "total_posts": 0
                }
            
            user = user_response.data[0]
            
            if not user.get('onboarding_completed'):
                return {
                    "success": False,
                    "message": "User has not completed onboarding",
                    "total_posts": 0
                }
            
            if not user.get('social_media_platforms'):
                return {
                    "success": False,
                    "message": "User has no social media platforms configured",
                    "total_posts": 0
                }
            
            # Run content generation
            logger.info(f"Starting content generation for user: {user_id}")
            result = await self.content_agent.run_weekly_generation(user_id)
            logger.info(f"Content generation result: {result}")
            
            return {
                "success": result['success'],
                "message": result.get('weekly_summary', 'Content generation completed'),
                "total_posts": result['total_posts'],
                "completed_platforms": result['completed_platforms'],
                "failed_platforms": result['failed_platforms'],
                "error_message": result.get('error_message'),
                "full_result": result  # Include full result for debugging
            }
            
        except Exception as e:
            logger.error(f"Error generating content for user {user_id}: {e}")
            return {
                "success": False,
                "message": f"Error generating content: {str(e)}",
                "total_posts": 0
            }

# Standalone function for cron job
async def run_weekly_content_generation():
    """Standalone function to run weekly content generation"""
    import os
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    
    if not all([supabase_url, supabase_key, openai_api_key]):
        logger.error("Missing required environment variables")
        return
    
    # Create scheduler and run
    scheduler = ContentScheduler(supabase_url, supabase_key, openai_api_key)
    result = await scheduler.run_weekly_content_generation()
    
    logger.info(f"Weekly content generation result: {result}")
    return result

if __name__ == "__main__":
    # Run the weekly content generation
    asyncio.run(run_weekly_content_generation())
