#!/usr/bin/env python3
"""
Cron job script to run embedding worker
This script can be called directly or via cron to process profiles needing embeddings
"""

import os
import sys
import argparse
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.embedding_worker import EmbeddingWorker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('embedding_worker.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Run embedding worker once"""
    parser = argparse.ArgumentParser(description="Run embedding worker for profiles or FAQs")
    parser.add_argument("--target", choices=["profiles", "faqs"], default="profiles", help="Which table to process")
    args = parser.parse_args()

    try:
        logger.info("Starting embedding worker cron job for %s...", args.target)
        worker = EmbeddingWorker(batch_size=20, poll_interval=60, target=args.target)
        processed = worker.run_once()
        logger.info("Embedding worker completed for %s. Processed %d rows.", args.target, processed)
        return 0
    except Exception as e:
        logger.error("Error in embedding worker cron job for %s: %s", args.target, e, exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())












