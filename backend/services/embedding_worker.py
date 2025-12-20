"""
Background Embedding Worker Service
Processes profiles or FAQ entries that need embeddings generated or updated
Can run as a separate process or scheduled task
"""

import os
import sys
import time
import logging
from typing import Optional, Literal
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
    """Background worker to process embeddings for profiles or FAQs"""
    
    TARGET_CONFIG = {
        "profiles": {
            "table_name": "profiles",
            "embedding_column": "profile_embedding",
            "flag_column": "embedding_needs_update",
            "timestamp_column": "embedding_updated_at",
            "embed_from_text": False,
            "text_column": None,
        },
        "faqs": {
            "table_name": "faq_responses",
            "embedding_column": "embedding_faq",
            "flag_column": "embedding_needs_update",
            "timestamp_column": "embedding_updated_at",
            "embed_from_text": True,
            "text_column": "response",
        },
    }

    def __init__(self, *, batch_size: int = 10, poll_interval: int = 60, target: Literal["profiles", "faqs"] = "profiles"):
        """
        Initialize the embedding worker
        
        Args:
            batch_size: Number of rows to process in each batch
            poll_interval: Seconds to wait between polling cycles
            target: Which table to process; either `profiles` or `faqs`
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
        self.target = target

        config = self.TARGET_CONFIG.get(target)
        if not config:
            raise ValueError(f"Unknown embedding target '{target}'")

        self.table_name = config["table_name"]
        self.embedding_column = config["embedding_column"]
        self.flag_column = config["flag_column"]
        self.timestamp_column = config["timestamp_column"]
        self.embed_from_text = config["embed_from_text"]
        self.text_column = config["text_column"]
        
        logger.info(
            "EmbeddingWorker initialized target=%s batch_size=%d poll_interval=%ds",
            target,
            batch_size,
            poll_interval,
        )
    
    def _generate_embedding(self, record: dict) -> list[float]:
        if self.embed_from_text:
            text_value = (record.get(self.text_column) or "").strip()
            if not text_value:
                logger.warning("Empty %s text for record %s", self.text_column, record.get("id", "unknown"))
            return self.embedding_service.generate_embedding_from_text(text_value)
        return self.embedding_service.generate_embedding(record)

    def _query_for_batch(self):
        try:
            return (
                self.supabase.table(self.table_name)
                .select("*")
                .eq(self.flag_column, True)
                .limit(self.batch_size)
                .execute()
            )
        except Exception as e:
            if self.flag_column in str(e) or "PGRST204" in str(e):
                logger.warning(
                    "Column '%s' not available on table '%s'. Falling back to rows missing '%s'.",
                    self.flag_column,
                    self.table_name,
                    self.embedding_column,
                )
                return (
                    self.supabase.table(self.table_name)
                    .select("*")
                    .is_(self.embedding_column, "null")
                    .limit(self.batch_size)
                    .execute()
                )
            raise

    def process_batch(self) -> int:
        """
        Process a batch of rows that need embeddings
        
        Returns:
            Number of rows processed
        """
        try:
            response = self._query_for_batch()
            if not response.data:
                return 0

            processed_count = 0
            error_count = 0

            for record in response.data:
                try:
                    record_id = record.get("id")
                    if not record_id:
                        logger.warning("Record missing id on table '%s', skipping", self.table_name)
                        continue

                    logger.info("Processing embedding for [%s] %s", self.target, record_id)
                    embedding = self._generate_embedding(record)

                    update_data = {
                        self.embedding_column: embedding
                    }

                    try:
                        test_response = (
                            self.supabase.table(self.table_name)
                            .select(f"{self.flag_column},{self.timestamp_column}")
                            .eq("id", record_id)
                            .limit(1)
                            .execute()
                        )
                        update_data[self.flag_column] = False
                        update_data[self.timestamp_column] = "now()"
                    except Exception:
                        # Missing columns; fallback
                        pass

                    update_response = (
                        self.supabase.table(self.table_name)
                        .update(update_data)
                        .eq("id", record_id)
                        .execute()
                    )

                    if update_response.data:
                        processed_count += 1
                        logger.info(
                            "Successfully generated embedding for %s %s (%s/%s)",
                            self.target,
                            record_id,
                            processed_count,
                            len(response.data),
                        )
                    else:
                        error_count += 1
                        logger.error("Failed to update %s %s", self.target, record_id)
                except Exception as e:
                    error_count += 1
                    logger.error(
                        "Error processing %s %s: %s",
                        self.target,
                        record.get("id", "unknown"),
                        e,
                    )
                    continue

            logger.info(
                "Batch processing complete for %s: %d processed, %d errors",
                self.target,
                processed_count,
                error_count,
            )
            return processed_count

        except Exception as e:
            logger.error("Error in process_batch for %s: %s", self.target, e)
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
                    logger.debug(
                        "No %s rows to process, waiting %ds...",
                        self.target,
                        self.poll_interval,
                    )
                else:
                    logger.info(
                        "Processed %s %d rows, waiting %ds...",
                        self.target,
                        processed,
                        self.poll_interval,
                    )
                
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
    
    parser = argparse.ArgumentParser(description='Embedding Worker (profiles or FAQs)')
    parser.add_argument('--batch-size', type=int, default=10, help='Number of rows to process per batch')
    parser.add_argument('--poll-interval', type=int, default=60, help='Seconds between polling cycles')
    parser.add_argument('--target', choices=['profiles', 'faqs'], default='profiles', help='Which table to generate embeddings for')
    parser.add_argument('--once', action='store_true', help='Run once and exit (default: continuous)')
    
    args = parser.parse_args()
    
    worker = EmbeddingWorker(
        batch_size=args.batch_size,
        poll_interval=args.poll_interval,
        target=args.target,
    )
    
    if args.once:
        logger.info("Running worker once for %s...", args.target)
        processed = worker.run_once()
        logger.info("Processed %s rows: %d", args.target, processed)
    else:
        logger.info("Starting continuous worker for %s", args.target)
        worker.run_continuous()


if __name__ == "__main__":
    main()

