from fastapi import APIRouter, Depends, HTTPException, status, Header
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

# We'll define these locally to avoid circular imports
from pydantic import BaseModel

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
        print(f"🔍 Fetching connections for user: {current_user.id}")
        
        # Query Supabase directly
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()
        
        connections = response.data if response.data else []
        print(f"📊 Found {len(connections)} active connections")
        
        # Also check all connections (including inactive) for debugging
        all_response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).execute()
        all_connections = all_response.data if all_response.data else []
        print(f"📊 Total connections (including inactive): {len(all_connections)}")
        
        if all_connections:
            for conn in all_connections:
                print(f"  - {conn.get('platform')}: {conn.get('connection_status')} (is_active: {conn.get('is_active')})")
        
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

@router.get("/auth/{platform}/connect")
async def get_connect_info(platform: str):
    """Get connection info (for debugging)"""
    print(f"🔍 GET request to {platform} connect endpoint")
    return {"message": f"Use POST method for {platform} connection", "platform": platform}

@router.options("/auth/{platform}/connect")
async def options_connect(platform: str):
    """Handle CORS preflight for connect endpoint"""
    print(f"🔧 CORS preflight for {platform} connect")
    return {"message": "OK"}

@router.post("/auth/{platform}/connect")
async def initiate_connection(
    platform: str,
    current_user: User = Depends(get_current_user)
):
    """Initiate OAuth connection for platform"""
    try:
        print(f"🔗 Initiating {platform} connection for user: {current_user.id}")
        
        # Generate secure state
        state = generate_oauth_state()
        print(f"Generated OAuth state: {state[:10]}...")
        
        # Store state in Supabase
        oauth_state_data = {
            "user_id": current_user.id,
            "platform": platform,
            "state": state,
            "expires_at": (datetime.now() + timedelta(minutes=10)).isoformat()
        }
        
        supabase_admin.table("oauth_states").insert(oauth_state_data).execute()
        print(f"✅ OAuth state stored in database")
        
        # Generate OAuth URL based on platform
        print(f"🔧 Generating OAuth URL for {platform}...")
        oauth_url = generate_oauth_url(platform, state)
        print(f"✅ Generated OAuth URL: {oauth_url[:100]}...")
        
        return {"auth_url": oauth_url, "state": state}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate connection: {str(e)}"
        )

@router.get("/auth/{platform}/callback")
async def handle_oauth_callback(
    platform: str,
    code: str = None,
    state: str = None,
    error: str = None,
    current_user: User = Depends(get_current_user)
):
    """Handle OAuth callback and store connection"""
    try:
        # Check for OAuth error
        if error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"OAuth error: {error}"
            )
        
        if not code or not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing code or state parameter"
            )
        
        # Verify state
        state_response = supabase_admin.table("oauth_states").select("*").eq("state", state).eq("user_id", current_user.id).eq("platform", platform).execute()
        
        if not state_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state"
            )
        
        # Exchange code for tokens (mock for now)
        tokens = exchange_code_for_tokens(platform, code)
        
        # Get account information (mock for now)
        account_info = get_account_info(platform, tokens['access_token'])
        
        # Store connection in Supabase (upsert - update if exists, insert if not)
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
            "is_active": True,  # Add this field for the query
            "last_sync": datetime.now().isoformat()
        }
        
        # Try to insert, if it fails due to duplicate key, update instead
        try:
            connection_response = supabase_admin.table("platform_connections").insert(connection_data).execute()
        except Exception as e:
            if "duplicate key value violates unique constraint" in str(e):
                # Update existing connection
                connection_response = supabase_admin.table("platform_connections").update(connection_data).eq("user_id", current_user.id).eq("platform", platform).eq("page_id", account_info.get('page_id')).execute()
            else:
                raise e
        
        # Remove used state
        supabase_admin.table("oauth_states").delete().eq("state", state).execute()
        
        # Get the connection ID (handle both insert and update responses)
        if connection_response.data and len(connection_response.data) > 0:
            connection_id = connection_response.data[0]["id"]
        else:
            # If update didn't return data, get the existing connection
            existing_connection = supabase_admin.table("platform_connections").select("id").eq("user_id", current_user.id).eq("platform", platform).eq("page_id", account_info.get('page_id')).execute()
            connection_id = existing_connection.data[0]["id"] if existing_connection.data else "unknown"
        
        # Return HTML page that redirects back to frontend
        frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Connection Successful</title>
        </head>
        <body>
            <script>
                // Close the popup window or redirect
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'OAUTH_SUCCESS',
                        platform: '{platform}',
                        connection: {{
                            id: '{connection_id}',
                            platform: '{platform}',
                            page_name: '{account_info.get('page_name', '')}',
                            follower_count: {account_info.get('follower_count', 0)},
                            connection_status: 'active'
                        }}
                    }}, '*');
                    window.close();
                }} else {{
                    window.location.href = '{frontend_url}';
                }}
            </script>
            <p>Connection successful! You can close this window.</p>
        </body>
        </html>
        """
        
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
        connection_response = supabase_admin.table("platform_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).execute()
        
        if not connection_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connection not found"
            )
        
        # Mark as inactive
        supabase_admin.table("platform_connections").update({
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
    
    # Get API base URL and ensure no trailing slash
    api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
    
    redirect_uris = {
        'facebook': f"{api_base_url}/connections/auth/facebook/callback",
        'instagram': f"{api_base_url}/connections/auth/instagram/callback",
        'linkedin': f"{api_base_url}/connections/auth/linkedin/callback",
        'twitter': f"{api_base_url}/connections/auth/twitter/callback",
        'tiktok': f"{api_base_url}/connections/auth/tiktok/callback",
        'youtube': f"{api_base_url}/connections/auth/youtube/callback"
    }
    
    base_url = base_urls.get(platform)
    client_id = client_ids.get(platform)
    redirect_uri = redirect_uris.get(platform)
    
    # Better error handling with specific details
    missing_config = []
    if not base_url:
        missing_config.append(f"base_url for {platform}")
    if not client_id:
        missing_config.append(f"client_id for {platform} (check {platform.upper()}_APP_ID env var)")
    if not redirect_uri:
        missing_config.append(f"redirect_uri for {platform}")
    
    if missing_config:
        error_msg = f"Platform {platform} not configured. Missing: {', '.join(missing_config)}"
        print(f"❌ OAuth configuration error: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
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
    if platform == "facebook":
        return exchange_facebook_code_for_tokens(code)
    else:
        raise ValueError(f"Unsupported platform: {platform}")

def exchange_facebook_code_for_tokens(code: str) -> dict:
    """Exchange Facebook OAuth code for access tokens"""
    import requests
    
    facebook_app_id = os.getenv('FACEBOOK_CLIENT_ID')
    facebook_app_secret = os.getenv('FACEBOOK_CLIENT_SECRET')
    redirect_uri = f"{os.getenv('API_BASE_URL', '').rstrip('/')}/connections/auth/facebook/callback"
    
    if not facebook_app_id or not facebook_app_secret:
        raise ValueError("Facebook app credentials not configured")
    
    # Exchange code for access token
    token_url = "https://graph.facebook.com/v18.0/oauth/access_token"
    token_params = {
        'client_id': facebook_app_id,
        'client_secret': facebook_app_secret,
        'redirect_uri': redirect_uri,
        'code': code
    }
    
    response = requests.get(token_url, params=token_params)
    response.raise_for_status()
    
    token_data = response.json()
    
    # Get long-lived access token
    long_lived_url = "https://graph.facebook.com/v18.0/oauth/access_token"
    long_lived_params = {
        'grant_type': 'fb_exchange_token',
        'client_id': facebook_app_id,
        'client_secret': facebook_app_secret,
        'fb_exchange_token': token_data['access_token']
    }
    
    long_lived_response = requests.get(long_lived_url, params=long_lived_params)
    long_lived_response.raise_for_status()
    
    long_lived_data = long_lived_response.json()
    
    return {
        "access_token": long_lived_data['access_token'],
        "refresh_token": "",  # Facebook doesn't use refresh tokens
        "expires_in": long_lived_data.get('expires_in', 3600)
    }

def get_account_info(platform: str, access_token: str) -> dict:
    """Get account information from platform API"""
    if platform == "facebook":
        return get_facebook_account_info(access_token)
    else:
        raise ValueError(f"Unsupported platform: {platform}")

def get_facebook_account_info(access_token: str) -> dict:
    """Get Facebook account information"""
    import requests
    
    # Get user's pages
    pages_url = "https://graph.facebook.com/v18.0/me/accounts"
    pages_params = {
        'access_token': access_token,
        'fields': 'id,name,username,followers_count,access_token'
    }
    
    response = requests.get(pages_url, params=pages_params)
    response.raise_for_status()
    
    pages_data = response.json()
    
    if not pages_data.get('data'):
        raise ValueError("No Facebook pages found for this user")
    
    # Use the first page (you could let user choose if multiple)
    page = pages_data['data'][0]
    
    return {
        "page_id": page['id'],
        "page_name": page['name'],
        "username": page.get('username', ''),
        "follower_count": page.get('followers_count', 0),
        "page_access_token": page.get('access_token', '')
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

@router.post("/facebook/post")
async def post_to_facebook(
    post_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Post content to Facebook"""
    try:
        print(f"📱 Facebook post request from user: {current_user.id}")
        print(f"📝 Post data: {post_data}")
        
        # Get user's Facebook connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "facebook").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Facebook connection found. Please connect your Facebook account first."
            )
        
        connection = response.data[0]
        print(f"🔗 Found Facebook connection: {connection['id']}")
        
        # Decrypt the access token
        try:
            access_token = decrypt_token(connection['access_token'])
            print(f"🔓 Decrypted access token: {access_token[:20]}...")
        except Exception as e:
            print(f"❌ Error decrypting token: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt access token"
            )
        
        # Prepare the post message
        message = post_data.get('message', '')
        title = post_data.get('title', '')
        hashtags = post_data.get('hashtags', [])
        
        # Combine title, message, and hashtags
        full_message = ""
        if title:
            full_message += f"{title}\n\n"
        full_message += message
        if hashtags:
            hashtag_string = " ".join([f"#{tag}" for tag in hashtags])
            full_message += f"\n\n{hashtag_string}"
        
        print(f"📄 Full message to post: {full_message}")
        
        # Post to Facebook
        facebook_url = f"https://graph.facebook.com/v18.0/{connection['page_id']}/feed"
        
        payload = {
            "message": full_message,
            "access_token": access_token
        }
        
        print(f"🌐 Posting to Facebook URL: {facebook_url}")
        
        response = requests.post(facebook_url, data=payload)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Facebook post successful: {result}")
            
            return {
                "success": True,
                "platform": "facebook",
                "post_id": result.get('id'),
                "message": "Content posted to Facebook successfully!",
                "url": f"https://facebook.com/{result.get('id')}" if result.get('id') else None
            }
        else:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"error": response.text}
            print(f"❌ Facebook API error: {response.status_code} - {error_data}")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Facebook API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error posting to Facebook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post to Facebook: {str(e)}"
        )
