from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import secrets
import string
from datetime import datetime, timedelta
import os
from cryptography.fernet import Fernet
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(supabase_url, supabase_key)

# We'll define these locally to avoid circular imports
from pydantic import BaseModel

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: str = Depends(lambda: None)):
    """Mock authentication for now"""
    # This is a simplified version - in production you'd verify the JWT token
    return User(
        id="d523ec90-d5ee-4393-90b7-8f117782fcf5",  # Your real user ID
        email="test@example.com", 
        name="Test User",
        created_at="2025-01-01T00:00:00Z"
    )

router = APIRouter(prefix="/connections", tags=["connections"])

# Encryption key for tokens
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
cipher = Fernet(ENCRYPTION_KEY)

def encrypt_token(token: str) -> str:
    """Encrypt token before storing"""
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    return cipher.decrypt(encrypted_token.encode()).decode()

def generate_oauth_state() -> str:
    """Generate secure OAuth state"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

@router.get("/")
async def get_connections(
    current_user: User = Depends(get_current_user)
):
    """Get all active connections for current user"""
    try:
        # Query Supabase directly
        response = supabase.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()
        
        connections = response.data if response.data else []
        
        # Remove sensitive data from response
        response_connections = []
        for conn in connections:
            conn_dict = {
                "id": conn["id"],
                "platform": conn["platform"],
                "page_id": conn.get("page_id"),
                "page_name": conn.get("page_name"),
                "page_username": conn.get("page_username"),
                "follower_count": conn.get("follower_count", 0),
                "connection_status": conn.get("connection_status", "active"),
                "is_active": conn.get("is_active", True),
                "last_sync": conn.get("last_sync"),
                "last_posted_at": conn.get("last_posted_at"),
                "connected_at": conn.get("connected_at"),
                "last_token_refresh": conn.get("last_token_refresh")
            }
            response_connections.append(conn_dict)
        
        return response_connections
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch connections: {str(e)}"
        )

@router.post("/auth/{platform}/connect")
async def initiate_connection(
    platform: str,
    current_user: User = Depends(get_current_user)
):
    """Initiate OAuth connection for platform"""
    try:
        # Generate secure state
        state = generate_oauth_state()
        
        # Store state in Supabase
        oauth_state_data = {
            "user_id": current_user.id,
            "platform": platform,
            "state": state,
            "expires_at": (datetime.now() + timedelta(minutes=10)).isoformat()
        }
        
        supabase.table("oauth_states").insert(oauth_state_data).execute()
        
        # Generate OAuth URL based on platform
        oauth_url = generate_oauth_url(platform, state)
        
        return {"auth_url": oauth_url, "state": state}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate connection: {str(e)}"
        )

@router.post("/auth/{platform}/callback")
async def handle_oauth_callback(
    platform: str,
    callback_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Handle OAuth callback and store connection"""
    try:
        # Verify state
        state_response = supabase.table("oauth_states").select("*").eq("state", callback_data.get("state")).eq("user_id", current_user.id).eq("platform", platform).execute()
        
        if not state_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state"
            )
        
        # Exchange code for tokens (mock for now)
        tokens = exchange_code_for_tokens(platform, callback_data.get("code"))
        
        # Get account information (mock for now)
        account_info = get_account_info(platform, tokens['access_token'])
        
        # Store connection in Supabase
        connection_data = {
            "user_id": current_user.id,
            "platform": platform,
            "page_id": account_info.get('page_id'),
            "page_name": account_info.get('page_name'),
            "page_username": account_info.get('username'),
            "follower_count": account_info.get('follower_count', 0),
            "access_token_encrypted": encrypt_token(tokens['access_token']),
            "refresh_token_encrypted": encrypt_token(tokens.get('refresh_token', '')),
            "token_expires_at": (datetime.now() + timedelta(seconds=tokens.get('expires_in', 3600))).isoformat(),
            "connection_status": 'active',
            "last_sync": datetime.now().isoformat()
        }
        
        connection_response = supabase.table("platform_connections").insert(connection_data).execute()
        
        # Remove used state
        supabase.table("oauth_states").delete().eq("state", callback_data.get("state")).execute()
        
        return {
            "success": True,
            "connection": {
                "id": connection_response.data[0]["id"],
                "platform": platform,
                "page_name": account_info.get('page_name'),
                "follower_count": account_info.get('follower_count', 0),
                "connection_status": 'active'
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to complete OAuth: {str(e)}"
        )

@router.delete("/{connection_id}")
async def disconnect_account(
    connection_id: str,
    current_user: User = Depends(get_current_user)
):
    """Disconnect account and revoke tokens"""
    try:
        # Verify connection belongs to user
        connection_response = supabase.table("platform_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).execute()
        
        if not connection_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connection not found"
            )
        
        # Mark as inactive
        supabase.table("platform_connections").update({
            "is_active": False,
            "disconnected_at": datetime.now().isoformat(),
            "connection_status": 'revoked'
        }).eq("id", connection_id).execute()
        
        return {"success": True, "message": "Account disconnected successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect: {str(e)}"
        )

# Helper functions for platform-specific OAuth
def generate_oauth_url(platform: str, state: str) -> str:
    """Generate OAuth URL for platform"""
    base_urls = {
        'facebook': 'https://www.facebook.com/v18.0/dialog/oauth',
        'instagram': 'https://api.instagram.com/oauth/authorize',
        'linkedin': 'https://www.linkedin.com/oauth/v2/authorization',
        'twitter': 'https://twitter.com/i/oauth2/authorize',
        'tiktok': 'https://www.tiktok.com/auth/authorize',
        'youtube': 'https://accounts.google.com/o/oauth2/v2/auth'
    }
    
    client_ids = {
        'facebook': os.getenv('FACEBOOK_CLIENT_ID'),
        'instagram': os.getenv('INSTAGRAM_CLIENT_ID'),
        'linkedin': os.getenv('LINKEDIN_CLIENT_ID'),
        'twitter': os.getenv('TWITTER_CLIENT_ID'),
        'tiktok': os.getenv('TIKTOK_CLIENT_ID'),
        'youtube': os.getenv('YOUTUBE_CLIENT_ID')
    }
    
    redirect_uris = {
        'facebook': f"{os.getenv('API_BASE_URL')}/connections/auth/facebook/callback",
        'instagram': f"{os.getenv('API_BASE_URL')}/connections/auth/instagram/callback",
        'linkedin': f"{os.getenv('API_BASE_URL')}/connections/auth/linkedin/callback",
        'twitter': f"{os.getenv('API_BASE_URL')}/connections/auth/twitter/callback",
        'tiktok': f"{os.getenv('API_BASE_URL')}/connections/auth/tiktok/callback",
        'youtube': f"{os.getenv('API_BASE_URL')}/connections/auth/youtube/callback"
    }
    
    base_url = base_urls.get(platform)
    client_id = client_ids.get(platform)
    redirect_uri = redirect_uris.get(platform)
    
    if not all([base_url, client_id, redirect_uri]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform {platform} not configured"
        )
    
    # Platform-specific OAuth parameters
    if platform == 'facebook':
        # Facebook permissions for:
        # 1. Post on Facebook (pages_manage_posts)
        # 2. Get post insights (pages_read_engagement, pages_show_list)
        # 3. Get page insights (pages_read_engagement, pages_show_list)
        # 4. Reply to comments (pages_messaging, pages_manage_engagement)
        return f"{base_url}?client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=pages_manage_posts,pages_read_engagement,pages_show_list,pages_manage_metadata,pages_messaging,pages_manage_engagement,pages_read_user_content"
    elif platform == 'instagram':
        return f"{base_url}?client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=user_profile,user_media"
    elif platform == 'linkedin':
        return f"{base_url}?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=w_member_social"
    elif platform == 'twitter':
        return f"{base_url}?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=tweet.read%20tweet.write%20users.read"
    elif platform == 'tiktok':
        return f"{base_url}?client_key={client_id}&redirect_uri={redirect_uri}&state={state}&scope=user.info.basic,video.publish"
    elif platform == 'youtube':
        return f"{base_url}?client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=https://www.googleapis.com/auth/youtube.upload"
    
    return ""

def exchange_code_for_tokens(platform: str, code: str) -> dict:
    """Exchange OAuth code for access tokens"""
    # This would contain platform-specific token exchange logic
    # For now, return mock data
    return {
        "access_token": f"mock_access_token_{platform}_{code[:8]}",
        "refresh_token": f"mock_refresh_token_{platform}_{code[:8]}",
        "expires_in": 3600
    }

def get_account_info(platform: str, access_token: str) -> dict:
    """Get account information from platform API"""
    # This would contain platform-specific API calls
    # For now, return mock data
    return {
        "page_id": f"mock_page_id_{platform}",
        "page_name": f"Mock {platform.title()} Page",
        "username": f"@mock_{platform}",
        "follower_count": 1000
    }

def revoke_tokens(platform: str, access_token: str) -> bool:
    """Revoke tokens with platform API"""
    # This would contain platform-specific token revocation logic
    return True

def refresh_platform_token(platform: str, refresh_token: str) -> dict:
    """Refresh platform access token"""
    # This would contain platform-specific token refresh logic
    return {
        "access_token": f"refreshed_access_token_{platform}",
        "refresh_token": f"refreshed_refresh_token_{platform}",
        "expires_in": 3600
    }
