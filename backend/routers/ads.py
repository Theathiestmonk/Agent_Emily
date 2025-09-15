"""
Ads Router - Handle ad creation, management, and analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from agents.ads_creation_agent import AdsCreationAgent
from agents.ads_media_agent import AdsMediaAgent

# Initialize security
security = HTTPBearer()
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

# Create client with anon key for user authentication
supabase: Client = create_client(supabase_url, supabase_anon_key)

# Create admin client for database operations
if supabase_service_key:
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)
else:
    supabase_admin = supabase  # Fallback to anon client

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials"
            )
        
        return {
            "id": response.user.id,
            "email": response.user.email,
            "name": response.user.user_metadata.get("name", response.user.email),
            "created_at": response.user.created_at
        }
        
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ads", tags=["ads"])
security = HTTPBearer()

class AdCopyResponse(BaseModel):
    id: str
    title: str
    ad_copy: str
    platform: str
    ad_type: str
    call_to_action: str
    target_audience: str
    budget_range: str
    campaign_objective: str
    scheduled_at: datetime
    status: str
    media_url: Optional[str] = None
    hashtags: List[str] = []
    metadata: Dict[str, Any] = {}
    campaign_id: str
    created_at: datetime

class AdCampaignResponse(BaseModel):
    id: str
    user_id: str
    campaign_name: str
    campaign_objective: str
    target_audience: str
    budget_range: str
    platforms: List[str]
    start_date: datetime
    end_date: datetime
    status: str
    total_ads: int
    approved_ads: int
    created_at: datetime
    metadata: Dict[str, Any] = {}

class AdUpdateRequest(BaseModel):
    title: Optional[str] = None
    ad_copy: Optional[str] = None
    call_to_action: Optional[str] = None
    hashtags: Optional[List[str]] = None
    status: Optional[str] = None

class CampaignUpdateRequest(BaseModel):
    campaign_name: Optional[str] = None
    campaign_objective: Optional[str] = None
    target_audience: Optional[str] = None
    budget_range: Optional[str] = None
    status: Optional[str] = None

@router.get("/by-date")
async def get_ads_by_date(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get all ads for a specific date"""
    try:
        supabase_client = supabase_admin
        
        # Parse date and get date range
        target_date = datetime.fromisoformat(date)
        start_date = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
        
        # Get ads for the date range
        response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id,
                campaign_name,
                campaign_objective,
                target_audience,
                budget_range,
                platforms,
                start_date,
                end_date,
                status,
                total_ads,
                approved_ads,
                created_at,
                metadata
            )
        """).eq("ad_campaigns.user_id", current_user["id"]).gte("scheduled_at", start_date.isoformat()).lt("scheduled_at", end_date.isoformat()).execute()
        
        ads = []
        for ad in response.data:
            ads.append(AdCopyResponse(**ad))
        
        return {"ads": ads, "date": date, "count": len(ads)}
        
    except Exception as e:
        logger.error(f"Error fetching ads by date: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns")
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    """Get all campaigns for the current user"""
    try:
        supabase_client = supabase_admin
        
        response = supabase_client.table("ad_campaigns").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()
        
        campaigns = []
        for campaign in response.data:
            campaigns.append(AdCampaignResponse(**campaign))
        
        return {"campaigns": campaigns, "count": len(campaigns)}
        
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific campaign"""
    try:
        supabase_client = supabase_admin
        
        response = supabase_client.table("ad_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        campaign = AdCampaignResponse(**response.data[0])
        
        # Get ads for this campaign
        ads_response = supabase.table("ad_copies").select("*").eq("campaign_id", campaign_id).execute()
        ads = [AdCopyResponse(**ad) for ad in ads_response.data]
        
        return {"campaign": campaign, "ads": ads, "ads_count": len(ads)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_ads(current_user: dict = Depends(get_current_user)):
    """Generate ads for the current user"""
    try:
        # Initialize ads creation agent
        import os
        ads_agent = AdsCreationAgent(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_ANON_KEY"),
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Generate ads
        result = await ads_agent.generate_ads_for_user(current_user["id"])
        
        if result["success"]:
            return {
                "message": "Ads generation started successfully",
                "ads_generated": result["ads_generated"],
                "campaign_id": result["campaign_id"],
                "platforms_processed": result["platforms_processed"]
            }
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error generating ads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ad_id}")
async def get_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific ad"""
    try:
        supabase_client = supabase_admin
        
        response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id,
                campaign_name,
                campaign_objective,
                target_audience,
                budget_range,
                platforms,
                start_date,
                end_date,
                status,
                total_ads,
                approved_ads,
                created_at,
                metadata
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        ad = AdCopyResponse(**response.data[0])
        
        # Get ad images
        images_response = supabase.table("ad_images").select("*").eq("ad_id", ad_id).execute()
        ad.images = images_response.data
        
        return {"ad": ad}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{ad_id}")
async def update_ad(
    ad_id: str,
    ad_data: AdUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Update ad
        update_data = {k: v for k, v in ad_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now().isoformat()
        
        response = supabase_client.table("ad_copies").update(update_data).eq("id", ad_id).execute()
        
        if response.data:
            return {"message": "Ad updated successfully", "ad": AdCopyResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to update ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ad_id}/approve")
async def approve_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Update ad status
        response = supabase_client.table("ad_copies").update({
            "status": "approved",
            "updated_at": datetime.now().isoformat()
        }).eq("id", ad_id).execute()
        
        if response.data:
            # Update campaign approved count
            campaign_id = response.data[0]["campaign_id"]
            supabase_client.table("ad_campaigns").update({
                "approved_ads": supabase.table("ad_campaigns").select("approved_ads").eq("id", campaign_id).execute().data[0]["approved_ads"] + 1
            }).eq("id", campaign_id).execute()
            
            return {"message": "Ad approved successfully", "ad": AdCopyResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to approve ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ad_id}/reject")
async def reject_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Update ad status
        response = supabase_client.table("ad_copies").update({
            "status": "rejected",
            "updated_at": datetime.now().isoformat()
        }).eq("id", ad_id).execute()
        
        if response.data:
            return {"message": "Ad rejected successfully", "ad": AdCopyResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to reject ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{ad_id}")
async def delete_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Delete ad images first
        supabase_client.table("ad_images").delete().eq("ad_id", ad_id).execute()
        
        # Delete ad
        response = supabase_client.table("ad_copies").delete().eq("id", ad_id).execute()
        
        if response.data:
            return {"message": "Ad deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ad_id}/performance")
async def get_ad_performance(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get performance metrics for an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Get performance data
        response = supabase_client.table("ad_performance").select("*").eq("ad_id", ad_id).order("date_recorded", desc=True).execute()
        
        return {"performance": response.data, "ad_id": ad_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ad performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    campaign_data: CampaignUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a campaign"""
    try:
        supabase_client = supabase_admin
        
        # Check if campaign exists and belongs to user
        campaign_response = supabase.table("ad_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user["id"]).execute()
        
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Update campaign
        update_data = {k: v for k, v in campaign_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now().isoformat()
        
        response = supabase_client.table("ad_campaigns").update(update_data).eq("id", campaign_id).execute()
        
        if response.data:
            return {"message": "Campaign updated successfully", "campaign": AdCampaignResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to update campaign")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a campaign and all its ads"""
    try:
        supabase_client = supabase_admin
        
        # Check if campaign exists and belongs to user
        campaign_response = supabase.table("ad_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user["id"]).execute()
        
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get all ads for this campaign
        ads_response = supabase.table("ad_copies").select("id").eq("campaign_id", campaign_id).execute()
        ad_ids = [ad["id"] for ad in ads_response.data]
        
        # Delete ad images
        if ad_ids:
            supabase_client.table("ad_images").delete().in_("ad_id", ad_ids).execute()
        
        # Delete ads
        if ad_ids:
            supabase_client.table("ad_copies").delete().in_("id", ad_ids).execute()
        
        # Delete campaign
        response = supabase_client.table("ad_campaigns").delete().eq("id", campaign_id).execute()
        
        if response.data:
            return {"message": "Campaign deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete campaign")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ad_id}/generate-media")
async def generate_ad_media(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate media for a specific ad"""
    try:
        # Initialize ads media agent
        ads_media_agent = AdsMediaAgent(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_ANON_KEY"),
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Generate media for the ad
        result = await ads_media_agent.generate_media_for_ad(current_user["id"], ad_id)
        
        if result["success"]:
            return {
                "message": "Media generation completed successfully",
                "ad_id": ad_id,
                "media_url": result["media_url"],
                "metadata": result["metadata"]
            }
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error generating ad media: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns/{campaign_id}/generate-media")
async def generate_campaign_media(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate media for all ads in a campaign"""
    try:
        # Initialize ads media agent
        ads_media_agent = AdsMediaAgent(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_ANON_KEY"),
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Generate media for the campaign
        result = await ads_media_agent.generate_media_for_campaign(current_user["id"], campaign_id)
        
        if result["success"]:
            return {
                "message": "Campaign media generation completed",
                "campaign_id": campaign_id,
                "processed_ads": result["processed_ads"],
                "total_ads": result["total_ads"],
                "errors": result.get("errors", [])
            }
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error generating campaign media: {e}")
        raise HTTPException(status_code=500, detail=str(e))
