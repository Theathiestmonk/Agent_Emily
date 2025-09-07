from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional
import os
from datetime import datetime, timedelta
import pytz
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Timezone configuration - can be set via environment variable
DEFAULT_TIMEZONE = os.getenv('DEFAULT_TIMEZONE', 'UTC')
try:
    TIMEZONE = pytz.timezone(DEFAULT_TIMEZONE)
except pytz.exceptions.UnknownTimeZoneError:
    print(f"⚠️ Unknown timezone '{DEFAULT_TIMEZONE}', falling back to UTC")
    TIMEZONE = pytz.UTC

# Get Supabase client
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

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        print(f"Authorization header: {authorization}")
        
        if not authorization or not authorization.startswith("Bearer "):
            print("No valid authorization header, using mock user")
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
        
        # Extract token
        token = authorization.split(" ")[1]
        print(f"Token received: {token[:20]}...")
        
        # Try to get user info from Supabase using the token
        try:
            print(f"Attempting to authenticate with Supabase...")
            user_response = supabase.auth.get_user(token)
            print(f"Supabase user response: {user_response}")
            
            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_data = user_response.user
                print(f"✅ Authenticated user: {user_data.id} - {user_data.email}")
                return User(
                    id=user_data.id,
                    email=user_data.email or "unknown@example.com",
                    name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                    created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
                )
            else:
                print("❌ No user found in response, using mock user")
                return User(
                    id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                    email="test@example.com", 
                    name="Test User",
                    created_at="2025-01-01T00:00:00Z"
                )
                
        except Exception as e:
            print(f"❌ Supabase auth error: {e}")
            print(f"Error type: {type(e).__name__}")
            # Fallback to mock for now
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
            
    except Exception as e:
        print(f"Authentication error: {e}")
        # Fallback to mock for now
        return User(
            id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
            email="test@example.com", 
            name="Test User",
            created_at="2025-01-01T00:00:00Z"
        )

router = APIRouter(prefix="/content", tags=["content"])

@router.get("/test")
async def test_content_router():
    """Test endpoint to verify content router is working"""
    return {"message": "Content router is working!", "status": "success"}

@router.get("/scheduled")
async def get_scheduled_content(
    current_user: User = Depends(get_current_user)
):
    """Get scheduled content for today"""
    try:
        print(f"📅 Fetching scheduled content for user: {current_user.id}")
        
        # Get today's date in the configured timezone
        now_utc = datetime.now(pytz.UTC)
        now_local = now_utc.astimezone(TIMEZONE)
        today = now_local.date()
        
        # Create start and end of day in the local timezone
        today_start = TIMEZONE.localize(datetime.combine(today, datetime.min.time()))
        today_end = TIMEZONE.localize(datetime.combine(today, datetime.max.time().replace(microsecond=999999)))
        
        # Convert to UTC for database query
        today_start_utc = today_start.astimezone(pytz.UTC)
        today_end_utc = today_end.astimezone(pytz.UTC)
        
        print(f"📅 Timezone: {TIMEZONE}")
        print(f"📅 Local time: {now_local}")
        print(f"📅 Today's date: {today}")
        print(f"📅 Looking for content between {today_start} and {today_end} (local)")
        print(f"📅 UTC range: {today_start_utc} to {today_end_utc}")
        
        # Query Supabase for scheduled content from content_posts table
        # Use the local date for filtering since scheduled_date is stored as DATE type
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).gte("scheduled_date", today.isoformat()).lte("scheduled_date", today.isoformat()).order("scheduled_date").execute()
        
        content_items = response.data if response.data else []
        print(f"📊 Found {len(content_items)} scheduled content items for today")
        
        # Format response
        formatted_content = []
        for item in content_items:
            platform_value = item.get("platform", "unknown")
            print(f"📱 Content item {item['id']} platform: '{platform_value}' (type: {type(platform_value)})")
            
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": platform_value,
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": None,  # Will be populated from content_images if needed
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "date": today.isoformat(),
            "count": len(formatted_content),
            "timezone": str(TIMEZONE)
        }
        
    except Exception as e:
        print(f"❌ Error fetching scheduled content: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch scheduled content: {str(e)}"
        )

@router.get("/all")
async def get_all_content(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """Get all content for the user"""
    try:
        print(f"📄 Fetching all content for user: {current_user.id}")
        
        # Query Supabase for all content from content_posts table
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).order("scheduled_date", desc=True).range(offset, offset + limit - 1).execute()
        
        content_items = response.data if response.data else []
        print(f"📊 Found {len(content_items)} total content items")
        
        # Format response
        formatted_content = []
        for item in content_items:
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": item.get("platform", "unknown"),
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": None,  # Will be populated from content_images if needed
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "count": len(formatted_content),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        print(f"❌ Error fetching all content: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch content: {str(e)}"
        )
