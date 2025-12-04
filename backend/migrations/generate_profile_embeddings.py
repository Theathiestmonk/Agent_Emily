"""
Migration script to generate embeddings for existing profiles
Run this once to backfill embeddings for all existing users
"""

import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from services.embedding_service import EmbeddingService
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_profile_embeddings(batch_size: int = 50, dry_run: bool = False):
    """
    Generate embeddings for all existing profiles
    
    Args:
        batch_size: Number of profiles to process in each batch
        dry_run: If True, only mark profiles for update without generating embeddings
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set in environment variables")
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    if not dry_run:
        embedding_service = EmbeddingService()
        logger.info("Embedding service initialized")
    else:
        logger.info("DRY RUN MODE - profiles will be marked but embeddings will not be generated")
    
    # Get all profiles
    logger.info("Fetching all profiles...")
    response = supabase.table("profiles").select("*").execute()
    
    if not response.data:
        logger.info("No profiles found")
        return
    
    total_profiles = len(response.data)
    logger.info(f"Found {total_profiles} profiles to process")
    
    updated_count = 0
    error_count = 0
    skipped_count = 0
    
    # Process in batches
    for i in range(0, total_profiles, batch_size):
        batch = response.data[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (total_profiles + batch_size - 1) // batch_size
        
        logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} profiles)...")
        
        for profile in batch:
            try:
                user_id = profile.get('id')
                if not user_id:
                    logger.warning("Profile missing id, skipping")
                    skipped_count += 1
                    continue
                
                # Skip if embedding already exists and is recent
                if profile.get('profile_embedding') and not dry_run:
                    logger.debug(f"Skipping user {user_id} - embedding already exists")
                    skipped_count += 1
                    continue
                
                if dry_run:
                    # Just mark for update (if column exists)
                    try:
                        supabase.table("profiles").update({
                            "embedding_needs_update": True
                        }).eq("id", user_id).execute()
                        updated_count += 1
                        logger.info(f"Marked user {user_id} for embedding update ({updated_count}/{total_profiles})")
                    except Exception as e:
                        if "embedding_needs_update" in str(e) or "PGRST204" in str(e):
                            logger.warning("Column 'embedding_needs_update' doesn't exist yet. Run database migration first.")
                            logger.info(f"Skipping user {user_id} - database migration needed")
                            skipped_count += 1
                        else:
                            raise
                else:
                    # Generate embedding
                    logger.info(f"Generating embedding for user {user_id}...")
                    embedding = embedding_service.generate_embedding(profile)
                    
                    # Update profile - only include columns that exist
                    update_data = {
                        "profile_embedding": embedding
                    }
                    
                    # Try to update additional columns if they exist (check by attempting to query)
                    try:
                        # Test if columns exist by trying to select them
                        test_response = supabase.table("profiles").select("embedding_needs_update, embedding_updated_at").eq("id", user_id).limit(1).execute()
                        # If we get here, columns exist
                        update_data["embedding_needs_update"] = False
                        update_data["embedding_updated_at"] = "now()"
                    except Exception as col_check_error:
                        # Columns don't exist, just update profile_embedding
                        if "PGRST204" in str(col_check_error) or "embedding_needs_update" in str(col_check_error):
                            logger.debug(f"Additional embedding columns don't exist, only updating profile_embedding")
                        else:
                            # Some other error, log it but continue
                            logger.warning(f"Could not check for additional columns: {col_check_error}")
                    
                    # Update profile with available columns
                    try:
                        supabase.table("profiles").update(update_data).eq("id", user_id).execute()
                        updated_count += 1
                        logger.info(f"Generated embedding for user {user_id} ({updated_count}/{total_profiles})")
                    except Exception as update_error:
                        if "profile_embedding" in str(update_error) or "PGRST204" in str(update_error):
                            logger.error(f"Column 'profile_embedding' doesn't exist. Please run database migration first: database/add_profile_embedding.sql")
                            error_count += 1
                        else:
                            raise
                
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing user {profile.get('id', 'unknown')}: {e}")
        
        logger.info(f"Batch {batch_num} complete: {updated_count} updated, {error_count} errors, {skipped_count} skipped")
    
    logger.info("=" * 80)
    logger.info("Migration Summary:")
    logger.info(f"  Total profiles: {total_profiles}")
    logger.info(f"  Updated: {updated_count}")
    logger.info(f"  Skipped: {skipped_count}")
    logger.info(f"  Errors: {error_count}")
    logger.info("=" * 80)
    
    if dry_run:
        logger.info("DRY RUN complete. Profiles have been marked for embedding generation.")
        logger.info("Run the embedding worker or run this script again without --dry-run to generate embeddings.")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate embeddings for existing profiles')
    parser.add_argument('--batch-size', type=int, default=50, help='Number of profiles to process per batch')
    parser.add_argument('--dry-run', action='store_true', help='Only mark profiles for update, do not generate embeddings')
    
    args = parser.parse_args()
    
    try:
        migrate_profile_embeddings(
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)

