"""
Helper function to generate and update profile embeddings
Called when profiles are created or updated
"""

import logging
from typing import Dict, Any, Optional, List
from services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

# Global embedding service instance (lazy loaded)
_embedding_service: Optional[EmbeddingService] = None

def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service

async def generate_and_update_embedding(
    profile_data: Dict[str, Any],
    user_id: str,
    supabase
) -> bool:
    """
    Generate embedding for profile and update database
    
    Args:
        profile_data: Profile data dictionary
        user_id: User ID
        supabase: Supabase client instance
        
    Returns:
        True if embedding was generated and updated successfully, False otherwise
    """
    try:
        # Generate embedding
        embedding_service = get_embedding_service()
        embedding = embedding_service.generate_embedding(profile_data)
        
        if not embedding:
            logger.warning(f"Failed to generate embedding for user {user_id}")
            return False
        
        # Prepare update data
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
        
        # Update profile with embedding
        update_response = supabase.table("profiles")\
            .update(update_data)\
            .eq("id", user_id)\
            .execute()
        
        if update_response.data:
            logger.info(f"Successfully generated and updated embedding for user {user_id}")
            return True
        else:
            logger.error(f"Failed to update embedding for user {user_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error generating embedding for user {user_id}: {e}")
        return False







