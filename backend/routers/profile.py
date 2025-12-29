"""
Profile API endpoints
Handles profile-related operations including usage tracking
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client, Client

from routers.connections import get_current_user, User

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_service_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase_client: Client = create_client(supabase_url, supabase_service_key)

@router.get("/usage-counts")
async def get_usage_counts(current_user: User = Depends(get_current_user)):
    """Get current month's usage counts for tasks and images"""
    try:
        user_id = current_user.id

        # Simple direct query to get usage counts
        response = supabase_client.table('profiles').select('tasks_completed_this_month, images_generated_this_month').eq('id', user_id).execute()

        if response.data and len(response.data) > 0:
            profile = response.data[0]
            return {
                "tasks_count": profile.get('tasks_completed_this_month', 0),
                "images_count": profile.get('images_generated_this_month', 0)
            }
        else:
            logger.warning(f"No profile found for user {user_id}")
            return {
                "tasks_count": 0,
                "images_count": 0
            }

    except Exception as e:
        logger.error(f"Error fetching usage counts for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching usage counts: {str(e)}")

