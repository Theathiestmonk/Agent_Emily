from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional, Dict, Any
import os
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from cryptography.fernet import Fernet
import json

# Load environment variables
load_dotenv()

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

router = APIRouter(prefix="/analytics", tags=["analytics"])

def get_encryption_key():
    """Get or generate encryption key for token decryption"""
    encryption_key = os.getenv("ENCRYPTION_KEY")
    if not encryption_key:
        print("⚠️ No ENCRYPTION_KEY found, generating new key")
        key = Fernet.generate_key()
        encryption_key = key.decode()
        print(f"🔑 Generated new encryption key: {encryption_key[:20]}...")
        print("⚠️ Please set this as ENCRYPTION_KEY in your environment variables")
    else:
        print(f"🔑 Using existing encryption key: {encryption_key[:20]}...")
    
    return encryption_key.encode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt access token"""
    try:
        encryption_key = get_encryption_key()
        fernet = Fernet(encryption_key)
        decrypted_token = fernet.decrypt(encrypted_token.encode()).decode()
        print(f"✅ Successfully decrypted token: {decrypted_token[:20]}...")
        return decrypted_token
    except Exception as e:
        print(f"❌ Error decrypting token: {e}")
        # Try to use token as-is if decryption fails (for backward compatibility)
        print("🔄 Trying to use token as-is...")
        return encrypted_token

@router.get("/insights")
async def get_analytics_insights(
    current_user: User = Depends(get_current_user),
    time_range: str = "7d"
):
    """Get analytics insights from all connected social media platforms"""
    try:
        print(f"📊 Fetching analytics insights for user: {current_user.id}, time_range: {time_range}")
        
        # Get user's active connections
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()
        connections = response.data if response.data else []
        
        print(f"📊 Found {len(connections)} active connections")
        print(f"📊 Connection details: {connections}")
        
        if not connections:
            print("⚠️ No active connections found - returning empty analytics")
            return {
                "analytics": {
                    "overview": {
                        'total_reach': 0,
                        'total_engagement': 0,
                        'total_posts': 0,
                        'engagement_rate': 0,
                        'reach_trend': 0,
                        'engagement_trend': 0,
                        'posts_trend': 0,
                        'rate_trend': 0
                    }
                },
                "time_range": time_range,
                "total_platforms": 0
            }
        
        analytics_by_platform = {}
        total_reach = 0
        total_engagement = 0
        total_posts = 0
        total_likes = 0
        total_comments = 0
        total_shares = 0
        
        for connection in connections:
            platform = connection.get('platform', '').lower()
            print(f"🔍 Processing {platform} analytics: {connection.get('id')}")
            
            try:
                if platform == 'facebook':
                    platform_analytics = await fetch_facebook_analytics(connection, time_range)
                elif platform == 'instagram':
                    platform_analytics = await fetch_instagram_analytics(connection, time_range)
                elif platform == 'twitter':
                    platform_analytics = await fetch_twitter_analytics(connection, time_range)
                elif platform == 'linkedin':
                    platform_analytics = await fetch_linkedin_analytics(connection, time_range)
                elif platform == 'youtube':
                    platform_analytics = await fetch_youtube_analytics(connection, time_range)
                else:
                    print(f"⚠️ Unsupported platform: {platform}")
                    continue
                
                if platform_analytics:
                    analytics_by_platform[platform] = platform_analytics
                    
                    # Aggregate totals
                    total_reach += platform_analytics.get('reach', 0)
                    total_engagement += platform_analytics.get('engagement', 0)
                    total_posts += platform_analytics.get('posts', 0)
                    total_likes += platform_analytics.get('likes', 0)
                    total_comments += platform_analytics.get('comments', 0)
                    total_shares += platform_analytics.get('shares', 0)
                    
                    print(f"✅ Fetched analytics from {platform}")
                else:
                    print(f"⚠️ No analytics found for {platform}")
                    
            except Exception as e:
                print(f"❌ Error fetching analytics from {platform}: {e}")
                # Continue with other platforms even if one fails
                continue
        
        # Calculate overview metrics
        engagement_rate = (total_engagement / total_reach * 100) if total_reach > 0 else 0
        
        overview = {
            'total_reach': total_reach,
            'total_engagement': total_engagement,
            'total_posts': total_posts,
            'engagement_rate': engagement_rate,
            'reach_trend': 0,  # No trend data available
            'engagement_trend': 0,
            'posts_trend': 0,
            'rate_trend': 0
        }
        
        print(f"📊 Analytics summary:")
        print(f"  - Total reach: {total_reach}")
        print(f"  - Total engagement: {total_engagement}")
        print(f"  - Total posts: {total_posts}")
        print(f"  - Engagement rate: {engagement_rate}%")
        print(f"  - Platform analytics: {list(analytics_by_platform.keys())}")
        print(f"  - Analytics by platform details: {analytics_by_platform}")
        print(f"  - Overview details: {overview}")
        
        return {
            "analytics": {
                **analytics_by_platform,
                "overview": overview
            },
            "time_range": time_range,
            "total_platforms": len(analytics_by_platform)
        }
        
    except Exception as e:
        print(f"❌ Error fetching analytics insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analytics insights: {str(e)}"
        )

async def fetch_facebook_analytics(connection: dict, time_range: str) -> Dict[str, Any]:
    """Fetch analytics from Facebook"""
    try:
        print(f"📊 Fetching Facebook analytics for connection: {connection.get('id')}")
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        page_id = connection.get('page_id')
        
        if not page_id:
            print("❌ No page_id found for Facebook connection")
            return None
        
        # Calculate date range
        end_date = datetime.now()
        if time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)
        
        # Fetch page insights from Facebook Graph API
        url = f"https://graph.facebook.com/v18.0/{page_id}/insights"
        params = {
            'access_token': access_token,
            'metric': 'page_impressions,page_engaged_users,page_post_engagements,page_fans',
            'period': 'day',
            'since': start_date.strftime('%Y-%m-%d'),
            'until': end_date.strftime('%Y-%m-%d')
        }
        
        print(f"🌐 Facebook Analytics API URL: {url}")
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Facebook Analytics response: {data}")
            
            # Process the insights data
            insights = data.get('data', [])
            print(f"📊 Available insights: {[insight.get('name') for insight in insights]}")
            
            analytics = {
                'reach': 0,
                'engagement': 0,
                'posts': 0,
                'likes': 0,
                'comments': 0,
                'shares': 0,
                'engagement_rate': 0,
                'reach_trend': 0,
                'engagement_trend': 0,
                'likes_trend': 0,
                'comments_trend': 0,
                'shares_trend': 0
            }
            
            for insight in insights:
                metric_name = insight.get('name')
                values = insight.get('values', [])
                
                print(f"📊 Processing metric: {metric_name} with {len(values)} values")
                
                if values:
                    total_value = sum(value.get('value', 0) for value in values)
                    print(f"📊 Total value for {metric_name}: {total_value}")
                    
                    if metric_name == 'page_impressions':
                        analytics['reach'] = total_value
                    elif metric_name == 'page_engaged_users':
                        analytics['engagement'] = total_value
                    elif metric_name == 'page_post_engagements':
                        analytics['posts'] = total_value
                    elif metric_name == 'page_fan_adds':
                        analytics['likes'] = total_value
                    elif metric_name == 'page_actions_post_reactions_total':
                        analytics['likes'] = total_value
                    elif metric_name == 'page_actions_post_comments':
                        analytics['comments'] = total_value
                    elif metric_name == 'page_actions_post_shares':
                        analytics['shares'] = total_value
            
            # If no specific metrics found, try to get basic page info
            if analytics['reach'] == 0 and analytics['engagement'] == 0:
                print("⚠️ No specific metrics found, trying to get basic page data...")
                # Try to get basic page info as fallback
                page_url = f"https://graph.facebook.com/v18.0/{page_id}"
                page_response = requests.get(page_url, params={'access_token': access_token}, timeout=10)
                if page_response.status_code == 200:
                    page_data = page_response.json()
                    print(f"📊 Page data: {page_data}")
                    # Use follower count as basic reach
                    analytics['reach'] = page_data.get('fan_count', 0)
                    analytics['engagement'] = page_data.get('engagement', 0)
                    analytics['posts'] = 1  # At least one post exists if we can access the page
            
            # Calculate engagement rate
            if analytics['reach'] > 0:
                analytics['engagement_rate'] = (analytics['engagement'] / analytics['reach']) * 100
            
            print(f"✅ Facebook analytics processed: {analytics}")
            return analytics
        else:
            print(f"❌ Facebook Analytics API error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error fetching Facebook analytics: {e}")
        return None

async def fetch_instagram_analytics(connection: dict, time_range: str) -> Dict[str, Any]:
    """Fetch analytics from Instagram"""
    try:
        print(f"📊 Fetching Instagram analytics for connection: {connection.get('id')}")
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        page_id = connection.get('page_id')
        
        if not page_id:
            print("❌ No page_id found for Instagram connection")
            return None
        
        # First, get the Instagram Business account ID
        instagram_account_url = f"https://graph.facebook.com/v18.0/{page_id}"
        instagram_account_params = {
            'access_token': access_token,
            'fields': 'instagram_business_account'
        }
        
        account_response = requests.get(instagram_account_url, params=instagram_account_params, timeout=10)
        
        if account_response.status_code != 200:
            print(f"❌ Instagram account lookup error: {account_response.status_code}")
            return None
        
        account_data = account_response.json()
        instagram_business_account = account_data.get('instagram_business_account')
        
        if not instagram_business_account:
            print("❌ No Instagram Business account found")
            return None
        
        instagram_account_id = instagram_business_account.get('id')
        
        # Fetch Instagram insights
        url = f"https://graph.facebook.com/v18.0/{instagram_account_id}/insights"
        params = {
            'access_token': access_token,
            'metric': 'impressions,reach,profile_views,website_clicks',
            'period': 'day'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Instagram Analytics response: {data}")
            
            # Process insights data
            insights = data.get('data', [])
            print(f"📊 Available Instagram insights: {[insight.get('name') for insight in insights]}")
            
            analytics = {
                'reach': 0,
                'engagement': 0,
                'posts': 0,
                'likes': 0,
                'comments': 0,
                'shares': 0,
                'engagement_rate': 0,
                'reach_trend': 0,
                'engagement_trend': 0,
                'likes_trend': 0,
                'comments_trend': 0,
                'shares_trend': 0
            }
            
            for insight in insights:
                metric_name = insight.get('name')
                values = insight.get('values', [])
                
                print(f"📊 Processing Instagram metric: {metric_name} with {len(values)} values")
                
                if values:
                    total_value = sum(value.get('value', 0) for value in values)
                    print(f"📊 Total value for {metric_name}: {total_value}")
                    
                    if metric_name == 'reach':
                        analytics['reach'] = total_value
                    elif metric_name == 'impressions':
                        analytics['engagement'] = total_value
                    elif metric_name == 'profile_views':
                        analytics['posts'] = total_value
                    elif metric_name == 'website_clicks':
                        analytics['shares'] = total_value
            
            # If no specific metrics found, try to get basic account info
            if analytics['reach'] == 0 and analytics['engagement'] == 0:
                print("⚠️ No specific Instagram metrics found, trying to get basic account data...")
                # Try to get basic account info as fallback
                account_url = f"https://graph.facebook.com/v18.0/{instagram_account_id}"
                account_response = requests.get(account_url, params={'access_token': access_token}, timeout=10)
                if account_response.status_code == 200:
                    account_data = account_response.json()
                    print(f"📊 Instagram account data: {account_data}")
                    # Use follower count as basic reach
                    analytics['reach'] = account_data.get('followers_count', 0)
                    analytics['engagement'] = account_data.get('media_count', 0) * 10  # Estimate
                    analytics['posts'] = account_data.get('media_count', 0)
            
            # Calculate engagement rate
            if analytics['reach'] > 0:
                analytics['engagement_rate'] = (analytics['engagement'] / analytics['reach']) * 100
            
            print(f"✅ Instagram analytics processed: {analytics}")
            return analytics
        else:
            print(f"❌ Instagram Analytics API error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error fetching Instagram analytics: {e}")
        return None

async def fetch_twitter_analytics(connection: dict, time_range: str) -> Dict[str, Any]:
    """Fetch analytics from Twitter (placeholder - requires Twitter API v2)"""
    print("⚠️ Twitter analytics not implemented yet - requires Twitter API v2")
    return None

async def fetch_linkedin_analytics(connection: dict, time_range: str) -> Dict[str, Any]:
    """Fetch analytics from LinkedIn (placeholder - requires LinkedIn API)"""
    print("⚠️ LinkedIn analytics not implemented yet - requires LinkedIn API")
    return None

async def fetch_youtube_analytics(connection: dict, time_range: str) -> Dict[str, Any]:
    """Fetch analytics from YouTube (placeholder - requires YouTube Data API)"""
    print("⚠️ YouTube analytics not implemented yet - requires YouTube Data API")
    return None

@router.get("/test")
async def test_analytics_router():
    """Test endpoint to verify analytics router is working"""
    return {"message": "Analytics router is working!", "status": "success"}
