"""
Embedding Worker Scheduler
Automatically processes profile embeddings every 3 hours
Uses APScheduler to run the embedding worker periodically
"""

import logging
import os
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from services.embedding_service import EmbeddingService
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler: Optional[AsyncIOScheduler] = None

# Initialize embedding service and supabase client
embedding_service: Optional[EmbeddingService] = None
supabase: Optional[Client] = None


async def process_embeddings():
    """Process profiles that need embeddings generated or updated"""
    global embedding_service, supabase
    
    try:
        if not embedding_service or not supabase:
            # Initialize if not already done
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set")
                return
            
            supabase = create_client(supabase_url, supabase_key)
            embedding_service = EmbeddingService()
            logger.info("Embedding service and Supabase client initialized")
        
        # Get profiles that need embedding updates
        try:
            response = supabase.table("profiles")\
                .select("*")\
                .eq("embedding_needs_update", True)\
                .limit(20)\
                .execute()
        except Exception as e:
            # Fallback: get profiles without embeddings if column doesn't exist
            if "embedding_needs_update" in str(e) or "PGRST204" in str(e):
                logger.debug("embedding_needs_update column not found, checking for profiles without embeddings")
                response = supabase.table("profiles")\
                    .select("*")\
                    .is_("profile_embedding", "null")\
                    .limit(20)\
                    .execute()
            else:
                raise
        
        if not response.data:
            logger.debug("No profiles need embedding updates")
            return
        
        logger.info(f"Processing {len(response.data)} profiles for embedding generation...")
        
        processed_count = 0
        error_count = 0
        
        for profile in response.data:
            try:
                user_id = profile.get('id')
                if not user_id:
                    logger.warning("Profile missing id, skipping")
                    continue
                
                logger.info(f"Processing embedding for user {user_id}")
                
                # Generate embedding
                embedding = embedding_service.generate_embedding(profile)
                
                # Update profile with embedding
                update_data = {
                    "profile_embedding": embedding
                }
                
                # Try to include additional columns if they exist
                try:
                    # Test if columns exist
                    test_response = supabase.table("profiles")\
                        .select("embedding_needs_update, embedding_updated_at")\
                        .eq("id", user_id)\
                        .limit(1)\
                        .execute()
                    # If we get here, columns exist
                    update_data["embedding_needs_update"] = False
                    update_data["embedding_updated_at"] = "now()"
                except Exception:
                    # Columns don't exist, just update profile_embedding
                    pass
                
                update_response = supabase.table("profiles")\
                    .update(update_data)\
                    .eq("id", user_id)\
                    .execute()
                
                if update_response.data:
                    processed_count += 1
                    logger.info(f"Successfully generated embedding for user {user_id} ({processed_count}/{len(response.data)})")
                else:
                    error_count += 1
                    logger.error(f"Failed to update profile for user {user_id}")
                    
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing profile {profile.get('id', 'unknown')}: {e}")
        
        logger.info(f"Embedding processing complete: {processed_count} processed, {error_count} errors")
        
    except Exception as e:
        logger.error(f"Error in embedding worker scheduler: {e}", exc_info=True)


async def start_embedding_worker_scheduler():
    """Start the embedding worker scheduler"""
    global scheduler
    
    if scheduler and scheduler.running:
        logger.warning("Embedding worker scheduler is already running")
        return
    
    try:
        scheduler = AsyncIOScheduler()
        
        # Schedule job to run every 3 hours
        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(hours=3),
            id='process_profile_embeddings',
            name='Process Profile Embeddings',
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("Embedding worker scheduler started - will run every 3 hours")
        
    except Exception as e:
        logger.error(f"Failed to start embedding worker scheduler: {e}")
        raise


async def stop_embedding_worker_scheduler():
    """Stop the embedding worker scheduler"""
    global scheduler
    
    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("Embedding worker scheduler stopped")
    else:
        logger.warning("Embedding worker scheduler is not running")






