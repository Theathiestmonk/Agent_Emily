"""Embedding Worker Scheduler
Automatically processes profile and FAQ embeddings via APScheduler."""

import logging
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.embedding_worker import EmbeddingWorker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize scheduler handle
scheduler: Optional[AsyncIOScheduler] = None


async def process_embeddings(target: str):
    """Process rows that need embeddings generated for the given target."""
    try:
        worker = EmbeddingWorker(batch_size=20, poll_interval=60, target=target)
        processed = worker.run_once()
        if processed:
            logger.info("Processed %d %s rows for embeddings", processed, target)
        else:
            logger.debug("No %s rows require embedding updates", target)
    except Exception as e:
        logger.error("Error processing %s embeddings: %s", target, e, exc_info=True)


async def start_embedding_worker_scheduler():
    """Start the embedding worker scheduler."""
    global scheduler

    if scheduler and scheduler.running:
        logger.warning("Embedding worker scheduler is already running")
        return

    try:
        scheduler = AsyncIOScheduler()

        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(hours=3),
            args=["profiles"],
            id="process_profile_embeddings",
            name="Process Profile Embeddings",
            replace_existing=True,
        )

        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(minutes=15),
            args=["faqs"],
            id="process_faq_embeddings",
            name="Process FAQ Embeddings",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("Embedding worker scheduler started - profiles every 3h, FAQs every 15m")

    except Exception as e:
        logger.error("Failed to start embedding worker scheduler: %s", e)
        raise


async def stop_embedding_worker_scheduler():
    """Stop the embedding worker scheduler."""
    global scheduler

    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("Embedding worker scheduler stopped")
    else:
        logger.warning("Embedding worker scheduler is not running")
"""Embedding Worker Scheduler
Automatically processes profile and FAQ embeddings via APScheduler"""

import logging
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.embedding_worker import EmbeddingWorker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler: Optional[AsyncIOScheduler] = None


async def process_embeddings(target: str):
    """Process rows that need embeddings generated for the given target"""
    try:
        worker = EmbeddingWorker(batch_size=20, poll_interval=60, target=target)
        processed = worker.run_once()
        if processed:
            logger.info("Processed %d %s rows for embeddings", processed, target)
        else:
            logger.debug("No %s rows require embedding updates", target)
    except Exception as e:
        logger.error("Error processing %s embeddings: %s", target, e, exc_info=True)


async def start_embedding_worker_scheduler():
    """Start the embedding worker scheduler"""
    global scheduler
    
    if scheduler and scheduler.running:
        logger.warning("Embedding worker scheduler is already running")
        return
    
    try:
        scheduler = AsyncIOScheduler()
        
        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(hours=3),
            args=["profiles"],
            id='process_profile_embeddings',
            name='Process Profile Embeddings',
            replace_existing=True
        )
        
        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(minutes=15),
            args=["faqs"],
            id='process_faq_embeddings',
            name='Process FAQ Embeddings',
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("Embedding worker scheduler started - profiles run every 3h, faqs run every 15m")
        
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
"""Embedding Worker Scheduler
Automatically processes profile and FAQ embeddings.
Uses APScheduler to run the embedding worker periodically.
"""

import logging
from typing import Optional, Literal
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from services.embedding_worker import EmbeddingWorker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler: Optional[AsyncIOScheduler] = None

WORKER_SETTINGS = {
    "profiles": {"batch_size": 20, "poll_interval": 60},
    "faqs": {"batch_size": 20, "poll_interval": 60},
}

_workers: dict[Literal["profiles", "faqs"], EmbeddingWorker] = {}


def _get_worker(target: Literal["profiles", "faqs"]) -> EmbeddingWorker:
    if target not in _workers:
        settings = WORKER_SETTINGS[target]
        _workers[target] = EmbeddingWorker(
            batch_size=settings["batch_size"],
            poll_interval=settings["poll_interval"],
            target=target,
        )
    return _workers[target]


async def process_embeddings(target: Literal["profiles", "faqs"]) -> None:
    """Process embeddings for the given target."""
    worker = _get_worker(target)
    processed = worker.process_batch()
    if processed:
        logger.info("Processed %d %s rows this run", processed, target)
    else:
        logger.debug("No %s rows processed this run", target)


async def start_embedding_worker_scheduler() -> None:
    """Start the embedding worker scheduler."""
    global scheduler

    if scheduler and scheduler.running:
        logger.warning("Embedding worker scheduler is already running")
        return

    try:
        scheduler = AsyncIOScheduler()

        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(hours=3),
            args=["profiles"],
            id="process_profile_embeddings",
            name="Process Profile Embeddings",
            replace_existing=True,
        )

        scheduler.add_job(
            process_embeddings,
            trigger=IntervalTrigger(minutes=5),
            args=["faqs"],
            id="process_faq_embeddings",
            name="Process FAQ Embeddings",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("Embedding worker scheduler started")

    except Exception as e:
        logger.error("Failed to start embedding worker scheduler: %s", e)
        raise


async def stop_embedding_worker_scheduler() -> None:
    """Stop the embedding worker scheduler."""
    global scheduler

    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("Embedding worker scheduler stopped")
    else:
        logger.warning("Embedding worker scheduler is not running")
"""
Embedding Worker Scheduler
Automatically processes profile and FAQ embeddings.
Uses APScheduler to run the embedding worker periodically.
"""

import logging
from typing import Optional, Literal
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from services.embedding_worker import EmbeddingWorker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler: Optional[AsyncIOScheduler] = None

WORKER_SETTINGS = {
    "profiles": {"batch_size": 20, "poll_interval": 60},
    "faqs": {"batch_size": 20, "poll_interval": 60},
}

_workers: dict[Literal["profiles", "faqs"], EmbeddingWorker] = {}

def _get_worker(target: Literal["profiles", "faqs"]) -> EmbeddingWorker:
    if target not in _workers:
        settings = WORKER_SETTINGS[target]
        _workers[target] = EmbeddingWorker(
            batch_size=settings["batch_size"],
            poll_interval=settings["poll_interval"],
            target=target,
        )
    return _workers[target]


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












