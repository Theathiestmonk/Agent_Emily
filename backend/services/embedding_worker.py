"""
Background Embedding Worker Service
Processes profiles that need embeddings generated or updated
Can run as a separate process or scheduled task
"""

import os
import sys
import time
import logging
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.embedding_service import EmbeddingService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EmbeddingWorker:
    """Background worker to process profile embeddings"""
    
    def __init__(self, batch_size: int = 10, poll_interval: int = 60):
        """
        Initialize the embedding worker
        
        Args:
            batch_size: Number of profiles to process in each batch
            poll_interval: Seconds to wait between polling cycles
        """
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set in environment variables")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.embedding_service = EmbeddingService()
        self.batch_size = batch_size
        self.poll_interval = poll_interval
        self.running = False
        
        logger.info(f"EmbeddingWorker initialized with batch_size={batch_size}, poll_interval={poll_interval}s")
    
    def process_batch(self) -> int:
        """
        Process a batch of profiles that need embeddings
        
        Returns:
            Number of profiles processed
        """
        try:
            # Get profiles that need embedding updates
            # First check if the column exists by trying to query it
            try:
                response = self.supabase.table("profiles")\
                    .select("*")\
                    .eq("embedding_needs_update", True)\
                    .limit(self.batch_size)\
                    .execute()
            except Exception as e:
                if "embedding_needs_update" in str(e) or "PGRST204" in str(e):
                    logger.warning("Column 'embedding_needs_update' doesn't exist. Run database migration: database/add_profile_embedding.sql")
                    # Fallback: get all profiles without embedding
                    response = self.supabase.table("profiles")\
                        .select("*")\
                        .is_("profile_embedding", "null")\
                        .limit(self.batch_size)\
                        .execute()
                else:
                    raise
            
            if not response.data:
                return 0
            
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
                    embedding = self.embedding_service.generate_embedding(profile)
                    
                    # Update profile with embedding
                    update_data = {
                        "profile_embedding": embedding
                    }
                    
                    # Try to include additional columns if they exist
                    try:
                        # Test if columns exist
                        test_response = self.supabase.table("profiles")\
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
                    
                    update_response = self.supabase.table("profiles")\
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
                    # Continue processing other profiles even if one fails
            
            logger.info(f"Batch processing complete: {processed_count} processed, {error_count} errors")
            return processed_count
            
        except Exception as e:
            logger.error(f"Error in process_batch: {e}")
            return 0
    
    def run_once(self) -> int:
        """
        Run a single processing cycle
        
        Returns:
            Number of profiles processed
        """
        return self.process_batch()
    
    def run_continuous(self):
        """
        Run the worker continuously, polling at specified intervals
        """
        self.running = True
        logger.info("Starting embedding worker in continuous mode...")
        
        try:
            while self.running:
                processed = self.process_batch()
                
                if processed == 0:
                    logger.debug(f"No profiles to process, waiting {self.poll_interval}s...")
                else:
                    logger.info(f"Processed {processed} profiles, waiting {self.poll_interval}s...")
                
                # Wait for poll interval
                time.sleep(self.poll_interval)
                
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, stopping worker...")
            self.running = False
        except Exception as e:
            logger.error(f"Error in continuous run: {e}")
            self.running = False
            raise
    
    def stop(self):
        """Stop the continuous worker"""
        self.running = False
        logger.info("Embedding worker stopped")


def main():
    """Main entry point for running the worker as a standalone script"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Profile Embedding Worker')
    parser.add_argument('--batch-size', type=int, default=10, help='Number of profiles to process per batch')
    parser.add_argument('--poll-interval', type=int, default=60, help='Seconds between polling cycles')
    parser.add_argument('--once', action='store_true', help='Run once and exit (default: continuous)')
    
    args = parser.parse_args()
    
    worker = EmbeddingWorker(
        batch_size=args.batch_size,
        poll_interval=args.poll_interval
    )
    
    if args.once:
        logger.info("Running worker once...")
        processed = worker.run_once()
        logger.info(f"Processed {processed} profiles")
    else:
        worker.run_continuous()


if __name__ == "__main__":
    main()

