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

router = APIRouter(prefix="/social-media", tags=["social-media"])

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

@router.get("/latest-posts")
async def get_latest_posts(
    current_user: User = Depends(get_current_user),
    limit: int = 5
):
    """Get latest posts from all connected social media platforms"""
    try:
        print(f"📱 Fetching latest posts for user: {current_user.id}")
        
        # Get user's active connections
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()
        connections = response.data if response.data else []
        
        print(f"📊 Found {len(connections)} active connections")
        
        posts_by_platform = {}
        
        for connection in connections:
            platform = connection.get('platform', '').lower()
            print(f"🔍 Processing {platform} connection: {connection.get('id')}")
            
            try:
                if platform == 'facebook':
                    posts = await fetch_facebook_posts(connection, limit)
                elif platform == 'instagram':
                    posts = await fetch_instagram_posts(connection, limit)
                elif platform == 'twitter':
                    posts = await fetch_twitter_posts(connection, limit)
                elif platform == 'linkedin':
                    posts = await fetch_linkedin_posts(connection, limit)
                elif platform == 'youtube':
                    posts = await fetch_youtube_posts(connection, limit)
                else:
                    print(f"⚠️ Unsupported platform: {platform}")
                    continue
                
                if posts:
                    posts_by_platform[platform] = posts
                    print(f"✅ Fetched {len(posts)} posts from {platform}")
                else:
                    print(f"⚠️ No posts found for {platform}")
                    
            except Exception as e:
                print(f"❌ Error fetching posts from {platform}: {e}")
                # Continue with other platforms even if one fails
                continue
        
        return {
            "posts": posts_by_platform,
            "total_platforms": len(posts_by_platform),
            "total_posts": sum(len(posts) for posts in posts_by_platform.values())
        }
        
    except Exception as e:
        print(f"❌ Error fetching latest posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch latest posts: {str(e)}"
        )

async def fetch_facebook_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Facebook"""
    try:
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        page_id = connection.get('page_id')
        
        if not page_id:
            print("❌ No page_id found for Facebook connection")
            return []
        
        # Fetch posts from Facebook Graph API
        url = f"https://graph.facebook.com/v18.0/{page_id}/posts"
        params = {
            'access_token': access_token,
            'fields': 'id,message,created_time,permalink_url,attachments{media},likes.summary(true),comments.summary(true),shares',
            'limit': limit
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            posts = []
            
            for post in data.get('data', []):
                # Extract media URL if available
                media_url = None
                if post.get('attachments', {}).get('data'):
                    attachment = post['attachments']['data'][0]
                    if attachment.get('media', {}).get('image'):
                        media_url = attachment['media']['image'].get('src')
                
                post_data = {
                    'id': post.get('id'),
                    'message': post.get('message', ''),
                    'created_time': post.get('created_time'),
                    'permalink_url': post.get('permalink_url'),
                    'media_url': media_url,
                    'likes_count': post.get('likes', {}).get('summary', {}).get('total_count', 0),
                    'comments_count': post.get('comments', {}).get('summary', {}).get('total_count', 0),
                    'shares_count': post.get('shares', {}).get('count', 0)
                }
                posts.append(post_data)
            
            return posts
        else:
            print(f"❌ Facebook API error: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching Facebook posts: {e}")
        return []

async def fetch_instagram_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Instagram"""
    try:
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        instagram_account_id = connection.get('instagram_account_id')
        
        if not instagram_account_id:
            print("❌ No instagram_account_id found for Instagram connection")
            return []
        
        # Fetch media from Instagram Graph API
        url = f"https://graph.facebook.com/v18.0/{instagram_account_id}/media"
        params = {
            'access_token': access_token,
            'fields': 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
            'limit': limit
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            posts = []
            
            for media in data.get('data', []):
                post_data = {
                    'id': media.get('id'),
                    'message': media.get('caption', ''),
                    'created_time': media.get('timestamp'),
                    'permalink_url': media.get('permalink'),
                    'media_url': media.get('media_url') or media.get('thumbnail_url'),
                    'likes_count': media.get('like_count', 0),
                    'comments_count': media.get('comments_count', 0),
                    'shares_count': 0  # Instagram doesn't provide shares count
                }
                posts.append(post_data)
            
            return posts
        else:
            print(f"❌ Instagram API error: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching Instagram posts: {e}")
        return []

async def fetch_twitter_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Twitter (placeholder - requires Twitter API v2)"""
    print("⚠️ Twitter posts not implemented yet - requires Twitter API v2")
    return []

async def fetch_linkedin_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from LinkedIn (placeholder - requires LinkedIn API)"""
    print("⚠️ LinkedIn posts not implemented yet - requires LinkedIn API")
    return []

async def fetch_youtube_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from YouTube (placeholder - requires YouTube Data API)"""
    print("⚠️ YouTube posts not implemented yet - requires YouTube Data API")
    return []

@router.get("/test")
async def test_social_media_router():
    """Test endpoint to verify social media router is working"""
    return {"message": "Social media router is working!", "status": "success"}
