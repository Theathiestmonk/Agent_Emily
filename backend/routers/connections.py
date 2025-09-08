from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional
import secrets
import string
from datetime import datetime, timedelta
import os
from cryptography.fernet import Fernet
import json
import requests
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
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    print("⚠️  WARNING: ENCRYPTION_KEY not set! Generating a new key. This will cause existing tokens to be unreadable.")
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print(f"🔑 Generated encryption key: {ENCRYPTION_KEY}")
else:
    print(f"🔑 Using provided encryption key: {ENCRYPTION_KEY[:20]}...")

try:
    cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    print(f"❌ Error initializing cipher: {e}")
    raise

def encrypt_token(token: str) -> str:
    """Encrypt token before storing"""
    try:
        return cipher.encrypt(token.encode()).decode()
    except Exception as e:
        print(f"❌ Error encrypting token: {e}")
        raise

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    try:
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        print(f"❌ Error decrypting token: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        print(f"🔍 Token to decrypt: {encrypted_token[:50]}...")
        print(f"🔑 Current encryption key: {ENCRYPTION_KEY[:20]}...")
        raise

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
        
        # Remove sensitive data from response (but keep token for debugging)
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
                "last_token_refresh": conn.get("last_token_refresh"),
                "access_token": conn.get("access_token_encrypted", "NOT_FOUND")[:50] + "..." if conn.get("access_token_encrypted") else "MISSING"
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
    error: str = None
):
    """Handle OAuth callback and store connection"""
    try:
        print(f"🔗 OAuth callback for {platform} - code: {code[:10] if code else 'None'}..., state: {state[:10] if state else 'None'}...")
        
        # Check for OAuth error
        if error:
            print(f"❌ OAuth error: {error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"OAuth error: {error}"
            )
        
        if not code or not state:
            print(f"❌ Missing parameters - code: {bool(code)}, state: {bool(state)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing code or state parameter"
            )
        
        # Verify state - find the state first to get the user_id
        print(f"🔍 Looking for OAuth state: {state[:10]}...")
        state_response = supabase_admin.table("oauth_states").select("*").eq("state", state).eq("platform", platform).execute()
        
        print(f"📊 State query result: {state_response.data}")
        
        if not state_response.data:
            print(f"❌ No OAuth state found for state: {state[:10]}...")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state"
            )
        
        # Get the user_id from the state record
        state_record = state_response.data[0]
        user_id = state_record['user_id']
        expires_at = datetime.fromisoformat(state_record['expires_at'].replace('Z', '+00:00'))
        
        print(f"✅ Found OAuth state for user: {user_id}, expires at: {expires_at}")
        
        # Check if state has expired
        if datetime.now(expires_at.tzinfo) > expires_at:
            print(f"❌ OAuth state expired at {expires_at}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth state has expired"
            )
        
        # Exchange code for tokens (mock for now)
        tokens = exchange_code_for_tokens(platform, code)
        
        # Get account information
        print(f"🔍 Getting account info for {platform}...")
        account_info = get_account_info(platform, tokens['access_token'])
        print(f"📊 Account info result: {account_info}")
        
        # Handle case where account info is None (especially for Instagram)
        if account_info is None:
            if platform == "instagram":
                raise Exception("No Instagram Business account found. Please ensure your Instagram account is connected to a Facebook Page and is a Business or Creator account.")
            elif platform == "linkedin":
                raise Exception("Failed to retrieve LinkedIn account information. Please check that your LinkedIn app has the correct permissions and scopes.")
            else:
                raise Exception(f"Failed to retrieve {platform} account information")
        
        # Store connection in Supabase (upsert - update if exists, insert if not)
        # Use page access token for posting, not user access token
        page_access_token = account_info.get('page_access_token', tokens['access_token'])
        
        connection_data = {
            "user_id": user_id,
            "platform": platform,
            "page_id": account_info.get('page_id'),
            "page_name": account_info.get('page_name'),
            "page_username": account_info.get('username'),
            "follower_count": account_info.get('follower_count', 0),
            "access_token_encrypted": encrypt_token(page_access_token),  # Store page token, not user token
            "refresh_token_encrypted": encrypt_token(tokens.get('refresh_token', '')),
            "token_expires_at": (datetime.now() + timedelta(seconds=tokens.get('expires_in', 3600))).isoformat(),
            "connection_status": 'active',
            "is_active": True,  # Add this field for the query
            "last_sync": datetime.now().isoformat()
        }
        
        # Add platform-specific fields
        if platform == "instagram":
            connection_data["instagram_id"] = account_info.get('instagram_id')
            connection_data["account_type"] = account_info.get('account_type')
            connection_data["media_count"] = account_info.get('media_count', 0)
        elif platform == "linkedin":
            connection_data["linkedin_id"] = account_info.get('linkedin_id')
            connection_data["headline"] = account_info.get('headline')
            connection_data["email"] = account_info.get('email')
            connection_data["profile_picture"] = account_info.get('profile_picture')
        
        # Try to insert, if it fails due to duplicate key, update instead
        try:
            connection_response = supabase_admin.table("platform_connections").insert(connection_data).execute()
        except Exception as e:
            if "duplicate key value violates unique constraint" in str(e):
                # Update existing connection
                connection_response = supabase_admin.table("platform_connections").update(connection_data).eq("user_id", user_id).eq("platform", platform).eq("page_id", account_info.get('page_id')).execute()
            else:
                raise e
        
        # Remove used state
        supabase_admin.table("oauth_states").delete().eq("state", state).execute()
        
        # Get the connection ID (handle both insert and update responses)
        if connection_response.data and len(connection_response.data) > 0:
            connection_id = connection_response.data[0]["id"]
        else:
            # If update didn't return data, get the existing connection
            existing_connection = supabase_admin.table("platform_connections").select("id").eq("user_id", user_id).eq("platform", platform).eq("page_id", account_info.get('page_id')).execute()
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
        print(f"❌ OAuth callback error for {platform}: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        
        # Return a more detailed error page
        frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
        error_message = str(e).replace("'", "\\'").replace('"', '\\"')
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Connection Failed</title>
        </head>
        <body>
            <h2>Connection Failed</h2>
            <p>Error: {error_message}</p>
            <script>
                // Close the popup window or redirect
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'OAUTH_ERROR',
                        platform: '{platform}',
                        error: '{error_message}'
                    }}, '*');
                    window.close();
                }} else {{
                    window.location.href = '{frontend_url}';
                }}
            </script>
            <p>You can close this window and try again.</p>
        </body>
        </html>
        """

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
        'instagram': 'https://www.facebook.com/v18.0/dialog/oauth',  # Use Facebook OAuth for Instagram
        'linkedin': 'https://www.linkedin.com/oauth/v2/authorization',
        'twitter': 'https://twitter.com/i/oauth2/authorize',
        'tiktok': 'https://www.tiktok.com/auth/authorize',
        'youtube': 'https://accounts.google.com/o/oauth2/v2/auth'
    }
    
    client_ids = {
        'facebook': os.getenv('FACEBOOK_CLIENT_ID'),
        'instagram': os.getenv('FACEBOOK_CLIENT_ID'),  # Always use Facebook App ID for Instagram
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
        # Instagram uses Facebook OAuth with Instagram-specific scopes
        # Added pages_manage_posts for proper Instagram Business account access
        return f"{base_url}?client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,pages_manage_posts"
    elif platform == 'linkedin':
        return f"{base_url}?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=openid%20profile%20email%20w_member_social"
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
    elif platform == "instagram":
        return exchange_instagram_code_for_tokens(code)
    elif platform == "linkedin":
        return exchange_linkedin_code_for_tokens(code)
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

def exchange_instagram_code_for_tokens(code: str) -> dict:
    """Exchange Instagram OAuth code for access tokens"""
    import requests
    
    # Instagram uses the same credentials as Facebook
    instagram_app_id = os.getenv('FACEBOOK_CLIENT_ID')  # Always use Facebook App ID
    instagram_app_secret = os.getenv('FACEBOOK_CLIENT_SECRET')  # Always use Facebook App Secret
    redirect_uri = f"{os.getenv('API_BASE_URL', '').rstrip('/')}/connections/auth/instagram/callback"
    
    if not instagram_app_id or not instagram_app_secret:
        raise ValueError("Instagram app credentials not configured (using Facebook credentials)")
    
    # Exchange code for access token
    token_url = "https://graph.facebook.com/v18.0/oauth/access_token"
    token_params = {
        'client_id': instagram_app_id,
        'client_secret': instagram_app_secret,
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
        'client_id': instagram_app_id,
        'client_secret': instagram_app_secret,
        'fb_exchange_token': token_data['access_token']
    }
    
    long_lived_response = requests.get(long_lived_url, params=long_lived_params)
    long_lived_response.raise_for_status()
    
    long_lived_data = long_lived_response.json()
    
    return {
        "access_token": long_lived_data['access_token'],
        "refresh_token": "",  # Instagram doesn't use refresh tokens
        "expires_in": long_lived_data.get('expires_in', 3600)
    }

def exchange_linkedin_code_for_tokens(code: str) -> dict:
    """Exchange LinkedIn OAuth code for access tokens"""
    import requests
    
    linkedin_client_id = os.getenv('LINKEDIN_CLIENT_ID')
    linkedin_client_secret = os.getenv('LINKEDIN_CLIENT_SECRET')
    redirect_uri = f"{os.getenv('API_BASE_URL', '').rstrip('/')}/connections/auth/linkedin/callback"
    
    if not linkedin_client_id or not linkedin_client_secret:
        raise ValueError("LinkedIn app credentials not configured")
    
    # Exchange code for access token
    token_url = "https://www.linkedin.com/oauth/v2/accessToken"
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': linkedin_client_id,
        'client_secret': linkedin_client_secret,
        'redirect_uri': redirect_uri
    }
    
    response = requests.post(token_url, data=token_data)
    response.raise_for_status()
    
    token_response = response.json()
    
    return {
        "access_token": token_response['access_token'],
        "refresh_token": token_response.get('refresh_token', ''),
        "expires_in": token_response.get('expires_in', 3600)
    }

def get_account_info(platform: str, access_token: str) -> dict:
    """Get account information from platform API"""
    if platform == "facebook":
        return get_facebook_account_info(access_token)
    elif platform == "instagram":
        return get_instagram_account_info(access_token)
    elif platform == "linkedin":
        return get_linkedin_account_info(access_token)
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

def get_instagram_account_info(access_token: str):
    """Get Instagram account information using Graph API"""
    try:
        print(f"🔍 Getting Instagram account info with token: {access_token[:20]}...")
        
        # Get Instagram Business Account ID
        pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
        print(f"🌐 Fetching pages from: {pages_url}")
        pages_response = requests.get(pages_url)
        
        print(f"📊 Pages response status: {pages_response.status_code}")
        
        if pages_response.status_code != 200:
            error_text = pages_response.text
            print(f"❌ Error fetching pages: {pages_response.status_code} - {error_text}")
            try:
                error_data = pages_response.json()
                error_message = error_data.get('error', {}).get('message', 'Unknown error')
                print(f"❌ Facebook API error: {error_message}")
            except:
                print(f"❌ Raw error response: {error_text}")
            return None
        
        pages_data = pages_response.json()
        pages = pages_data.get('data', [])
        
        print(f"📄 Found {len(pages)} pages")
        
        if not pages:
            print("❌ No Facebook pages found for this user")
            return None
        
        # Find page with Instagram account
        instagram_account = None
        instagram_page = None
        
        for page in pages:
            print(f"🔍 Checking page: {page.get('name', 'Unknown')} (ID: {page.get('id', 'Unknown')})")
            print(f"🔍 Page data: {page}")
            
            # Check for Instagram Business account
            if page.get('instagram_business_account'):
                instagram_account = page['instagram_business_account']
                instagram_page = page
                print(f"✅ Found Instagram account: {instagram_account}")
                break
            else:
                print(f"❌ No Instagram Business account found on page: {page.get('name', 'Unknown')}")
                
                # Try to get more details about this page to see why no Instagram account
                try:
                    page_details_url = f"https://graph.facebook.com/v18.0/{page['id']}?fields=instagram_business_account,connected_instagram_account&access_token={access_token}"
                    page_details_response = requests.get(page_details_url)
                    if page_details_response.status_code == 200:
                        page_details = page_details_response.json()
                        print(f"🔍 Page details: {page_details}")
                    else:
                        print(f"❌ Could not get page details: {page_details_response.status_code}")
                except Exception as e:
                    print(f"❌ Error getting page details: {e}")
        
        if not instagram_account:
            print("❌ No Instagram Business account found connected to any Facebook page")
            print("💡 User needs to:")
            print("   1. Convert Instagram to Business account")
            print("   2. Connect Instagram to a Facebook Page")
            print("   3. Ensure the page has Instagram Business account linked")
            return None
        
        instagram_id = instagram_account['id']
        print(f"📱 Instagram Business Account ID: {instagram_id}")
        
        # Get Instagram account details
        instagram_url = f"https://graph.facebook.com/v18.0/{instagram_id}?fields=id,username,account_type,media_count,followers_count&access_token={access_token}"
        print(f"🌐 Fetching Instagram details from: {instagram_url}")
        instagram_response = requests.get(instagram_url)
        
        print(f"📊 Instagram response status: {instagram_response.status_code}")
        
        if instagram_response.status_code != 200:
            error_text = instagram_response.text
            print(f"❌ Error fetching Instagram account: {instagram_response.status_code} - {error_text}")
            try:
                error_data = instagram_response.json()
                error_message = error_data.get('error', {}).get('message', 'Unknown error')
                print(f"❌ Instagram API error: {error_message}")
            except:
                print(f"❌ Raw error response: {error_text}")
            return None
        
        instagram_data = instagram_response.json()
        print(f"✅ Instagram account data: {instagram_data}")
        
        return {
            'instagram_id': instagram_data['id'],
            'username': instagram_data['username'],
            'account_type': instagram_data['account_type'],
            'media_count': instagram_data.get('media_count', 0),
            'follower_count': instagram_data.get('followers_count', 0),
            'page_id': instagram_page['id'],
            'page_name': instagram_page['name'],
            'page_access_token': instagram_page.get('access_token', access_token)
        }
        
    except Exception as e:
        print(f"❌ Error getting Instagram account info: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        return None

def get_linkedin_account_info(access_token: str) -> dict:
    """Get LinkedIn account information using OpenID Connect"""
    import requests
    
    try:
        print(f"🔍 Getting LinkedIn account info with token: {access_token[:20]}...")
        
        # Use OpenID Connect endpoint
        profile_url = "https://api.linkedin.com/v2/userinfo"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Get user info using OpenID Connect
        profile_response = requests.get(profile_url, headers=headers)
        print(f"📊 LinkedIn userinfo response status: {profile_response.status_code}")
        
        if profile_response.status_code != 200:
            error_text = profile_response.text
            print(f"❌ Error fetching LinkedIn userinfo: {profile_response.status_code} - {error_text}")
            
            # Fallback to standard API if OpenID Connect fails
            print("🔄 Falling back to standard LinkedIn API...")
            fallback_url = "https://api.linkedin.com/v2/me"
            fallback_response = requests.get(fallback_url, headers=headers)
            
            if fallback_response.status_code != 200:
                print(f"❌ Fallback also failed: {fallback_response.status_code} - {fallback_response.text}")
                return None
            
            profile_data = fallback_response.json()
            print(f"✅ LinkedIn fallback profile data: {profile_data}")
            
            # Extract from fallback response
            linkedin_id = profile_data.get('id', '')
            first_name = ""
            last_name = ""
            if 'firstName' in profile_data:
                first_name = profile_data['firstName'].get('localized', {}).get('en_US', '')
            
            if 'lastName' in profile_data:
                last_name = profile_data['lastName'].get('localized', {}).get('en_US', '')
            
            headline = ""
            if 'headline' in profile_data:
                headline = profile_data['headline'].get('localized', {}).get('en_US', '')
            
            return {
                'linkedin_id': linkedin_id,
                'first_name': first_name,
                'last_name': last_name,
                'email': '',  # Not available in fallback
                'profile_picture': '',
                'headline': headline,
                'follower_count': 0,
                'page_id': linkedin_id,
                'page_name': f"{first_name} {last_name}".strip()
            }
        
        profile_data = profile_response.json()
        print(f"✅ LinkedIn userinfo data: {profile_data}")
        
        # Extract profile information from OpenID Connect response
        linkedin_id = profile_data.get('sub', '')  # OpenID Connect uses 'sub' for user ID
        first_name = profile_data.get('given_name', '')
        last_name = profile_data.get('family_name', '')
        email_address = profile_data.get('email', '')
        profile_picture = profile_data.get('picture', '')
        headline = profile_data.get('headline', '')
        
        return {
            'linkedin_id': linkedin_id,
            'first_name': first_name,
            'last_name': last_name,
            'email': email_address,
            'profile_picture': profile_picture,
            'headline': headline,
            'follower_count': 0,  # LinkedIn doesn't provide follower count in basic API
            'page_id': linkedin_id,  # Use LinkedIn ID as page_id for consistency
            'page_name': f"{first_name} {last_name}".strip()
        }
        
    except Exception as e:
        print(f"❌ Error getting LinkedIn account info: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        return None

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

@router.get("/facebook/debug")
async def debug_facebook_connection(
    current_user: User = Depends(get_current_user)
):
    """Debug Facebook connection data"""
    try:
        print(f"🔍 Debug Facebook connection for user: {current_user.id}")
        
        # Get user's Facebook connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "facebook").eq("is_active", True).execute()
        
        if not response.data:
            return {"error": "No active Facebook connection found"}
        
        connection = response.data[0]
        
        # Try to decrypt the token
        try:
            access_token = decrypt_token(connection['access_token'])
            token_status = "encrypted"
        except:
            access_token = connection['access_token']
            token_status = "unencrypted"
        
        return {
            "connection_id": connection['id'],
            "page_id": connection['page_id'],
            "page_name": connection['page_name'],
            "token_length": len(access_token),
            "token_start": access_token[:20] + "..." if len(access_token) > 20 else access_token,
            "token_status": token_status,
            "is_active": connection['is_active'],
            "connected_at": connection['connected_at']
        }
        
    except Exception as e:
        print(f"❌ Debug error: {e}")
        return {"error": str(e)}

@router.get("/facebook/test")
async def test_facebook_connection():
    """Test Facebook connection without authentication"""
    try:
        print("🔍 Testing Facebook connection data")
        
        # Get any Facebook connection
        response = supabase_admin.table("platform_connections").select("*").eq("platform", "facebook").eq("is_active", True).limit(1).execute()
        
        if not response.data:
            return {"error": "No active Facebook connections found"}
        
        connection = response.data[0]
        
        return {
            "connection_id": connection['id'],
            "user_id": connection['user_id'],
            "page_id": connection['page_id'],
            "page_name": connection['page_name'],
            "token_length": len(connection['access_token']),
            "token_start": connection['access_token'][:20] + "..." if len(connection['access_token']) > 20 else connection['access_token'],
            "is_active": connection['is_active'],
            "connected_at": connection['connected_at']
        }
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        return {"error": str(e)}

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
        
        # Decrypt the access token (using correct field name)
        try:
            access_token = decrypt_token(connection['access_token_encrypted'])
            print(f"🔓 Decrypted access token: {access_token[:20]}...")
        except Exception as e:
            print(f"❌ Error decrypting token: {e}")
            print(f"🔍 Connection data: {connection}")
            
            # Check if the token is already in plaintext (not encrypted)
            if connection.get('access_token_encrypted', '').startswith('EAAB'):
                print("🔓 Token appears to be unencrypted, using directly")
                access_token = connection['access_token_encrypted']
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to decrypt access token. Please reconnect your Facebook account."
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
        
        # First, validate the access token by getting page info
        try:
            validate_url = f"https://graph.facebook.com/v18.0/{connection['page_id']}?access_token={access_token}"
            print(f"🔍 Validating token with URL: {validate_url}")
            
            validate_response = requests.get(validate_url)
            print(f"🔍 Token validation response: {validate_response.status_code}")
            
            if validate_response.status_code != 200:
                validate_error = validate_response.json() if validate_response.headers.get('content-type', '').startswith('application/json') else {"error": validate_response.text}
                print(f"❌ Token validation failed: {validate_error}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid or expired access token: {validate_error.get('error', {}).get('message', 'Token validation failed')}"
                )
            
            page_info = validate_response.json()
            print(f"✅ Token valid, page info: {page_info}")
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️  Token validation error (continuing anyway): {e}")
        
        # Post to Facebook using the correct API format
        facebook_url = f"https://graph.facebook.com/v18.0/{connection['page_id']}/feed"
        
        # Use form data with access_token as a parameter
        payload = {
            "message": full_message,
            "access_token": access_token
        }
        
        # Also try with access_token as URL parameter
        facebook_url_with_token = f"https://graph.facebook.com/v18.0/{connection['page_id']}/feed?access_token={access_token}"
        
        print(f"🌐 Posting to Facebook URL: {facebook_url}")
        print(f"📄 Payload: {payload}")
        print(f"🔑 Access token length: {len(access_token)}")
        print(f"📱 Page ID: {connection['page_id']}")
        
        # Try posting with access_token in URL first (recommended method)
        print(f"🌐 Trying URL method: {facebook_url_with_token}")
        response = requests.post(facebook_url_with_token, data={"message": full_message})
        
        if response.status_code != 200:
            print(f"❌ URL method failed, trying form data method")
            # Fallback to form data method
            response = requests.post(facebook_url, data=payload)
        
        print(f"📊 Facebook API response status: {response.status_code}")
        print(f"📄 Facebook API response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Facebook post successful: {result}")
            
            # Update content status in Supabase to 'published'
            try:
                # Get the content ID from the post data (we need to add this to the request)
                content_id = post_data.get('content_id')
                if content_id:
                    update_response = supabase_admin.table("content_posts").update({
                        "status": "published",
                        "published_at": datetime.now().isoformat(),
                        "facebook_post_id": result.get('id')
                    }).eq("id", content_id).execute()
                    
                    print(f"✅ Updated content status in database: {update_response}")
                else:
                    print("⚠️  No content_id provided, skipping database update")
            except Exception as e:
                print(f"⚠️  Error updating content status in database: {e}")
                # Don't fail the whole request if database update fails
            
            return {
                "success": True,
                "platform": "facebook",
                "post_id": result.get('id'),
                "message": "Content posted to Facebook successfully!",
                "url": f"https://facebook.com/{result.get('id')}" if result.get('id') else None
            }
        else:
            try:
                error_data = response.json()
                print(f"❌ Facebook API error (JSON): {response.status_code} - {error_data}")
            except:
                error_text = response.text
                print(f"❌ Facebook API error (Text): {response.status_code} - {error_text}")
                error_data = {"error": {"message": error_text}}
            
            # More specific error handling
            error_message = "Unknown error"
            if isinstance(error_data, dict):
                if "error" in error_data:
                    if isinstance(error_data["error"], dict):
                        error_message = error_data["error"].get("message", "Unknown error")
                    else:
                        error_message = str(error_data["error"])
                else:
                    error_message = str(error_data)
            
            print(f"🔍 Parsed error message: {error_message}")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Facebook API error: {error_message}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error posting to Facebook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post to Facebook: {str(e)}"
        )

@router.get("/instagram/debug")
async def debug_instagram_connection(
    current_user: User = Depends(get_current_user)
):
    """Debug Instagram connection data"""
    try:
        print(f"🔍 Debug Instagram connection for user: {current_user.id}")
        
        # Get user's Instagram connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "instagram").eq("is_active", True).execute()
        
        if not response.data:
            return {"error": "No active Instagram connection found"}
        
        connection = response.data[0]
        
        # Try to decrypt the token
        try:
            access_token = decrypt_token(connection['access_token_encrypted'])
            token_status = "encrypted"
        except:
            access_token = connection['access_token_encrypted']
            token_status = "unencrypted"
        
        return {
            "connection_id": connection['id'],
            "instagram_id": connection.get('instagram_id'),
            "username": connection.get('page_username'),
            "token_length": len(access_token),
            "token_start": access_token[:20] + "..." if len(access_token) > 20 else access_token,
            "token_status": token_status,
            "is_active": connection['is_active'],
            "connected_at": connection['connected_at']
        }
        
    except Exception as e:
        print(f"❌ Debug Instagram error: {e}")
        return {"error": str(e)}

@router.get("/linkedin/test")
async def test_linkedin_connection():
    """Test LinkedIn connection configuration"""
    try:
        linkedin_client_id = os.getenv('LINKEDIN_CLIENT_ID')
        linkedin_client_secret = os.getenv('LINKEDIN_CLIENT_SECRET')
        api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
        
        if not linkedin_client_id or not linkedin_client_secret:
            return {
                "error": "LinkedIn credentials not configured",
                "missing": {
                    "client_id": not linkedin_client_id,
                    "client_secret": not linkedin_client_secret
                }
            }
        
        # Generate a test OAuth URL
        state = generate_oauth_state()
        test_oauth_url = f"https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={linkedin_client_id}&redirect_uri={api_base_url}/connections/auth/linkedin/callback&state={state}&scope=openid%20profile%20email%20w_member_social"
        
        return {
            "message": "LinkedIn configuration looks good!",
            "client_id": linkedin_client_id,
            "redirect_uri": f"{api_base_url}/connections/auth/linkedin/callback",
            "test_oauth_url": test_oauth_url,
            "status": "ready"
        }
        
    except Exception as e:
        print(f"❌ LinkedIn test error: {e}")
        return {"error": str(e)}

@router.post("/linkedin/post")
async def post_to_linkedin(
    post_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Post content to LinkedIn"""
    try:
        print(f"📱 LinkedIn post request from user: {current_user.id}")
        print(f"📝 Post data: {post_data}")
        
        # Get user's LinkedIn connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "linkedin").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active LinkedIn connection found. Please connect your LinkedIn account first."
            )
        
        connection = response.data[0]
        print(f"🔗 Found LinkedIn connection: {connection['id']}")
        
        # Decrypt the access token
        try:
            access_token = decrypt_token(connection['access_token_encrypted'])
            print(f"🔓 Decrypted access token: {access_token[:20]}...")
        except Exception as e:
            print(f"❌ Error decrypting token: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt access token. Please reconnect your LinkedIn account."
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
            hashtag_string = " ".join([f"#{tag.replace('#', '')}" for tag in hashtags])
            full_message += f"\n\n{hashtag_string}"
        
        # Post to LinkedIn using the Share API
        linkedin_url = "https://api.linkedin.com/v2/shares"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
        }
        
        # Get the user's LinkedIn ID from the connection
        linkedin_id = connection.get('linkedin_id') or connection.get('page_id')
        if not linkedin_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LinkedIn ID not found in connection data"
            )
        
        # Create the share payload
        share_payload = {
            "author": f"urn:li:person:{linkedin_id}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": full_message
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        print(f"🌐 Posting to LinkedIn API: {linkedin_url}")
        print(f"📋 Share payload: {share_payload}")
        
        response = requests.post(linkedin_url, headers=headers, json=share_payload)
        
        print(f"📊 LinkedIn API response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ LinkedIn post successful: {result}")
            
            # Update last posted timestamp
            try:
                supabase_admin.table("platform_connections").update({
                    "last_posted_at": datetime.now().isoformat()
                }).eq("id", connection['id']).execute()
            except Exception as e:
                print(f"⚠️  Error updating last_posted_at: {e}")
            
            return {
                "success": True,
                "platform": "linkedin",
                "post_id": result.get('id'),
                "message": "Content posted to LinkedIn successfully!",
                "url": f"https://linkedin.com/feed/update/{result.get('id')}" if result.get('id') else None
            }
        else:
            try:
                error_data = response.json()
                print(f"❌ LinkedIn API error (JSON): {response.status_code} - {error_data}")
            except:
                error_text = response.text
                print(f"❌ LinkedIn API error (Text): {response.status_code} - {error_text}")
                error_data = {"error": {"message": error_text}}
            
            error_message = "Unknown error"
            if isinstance(error_data, dict) and "error" in error_data:
                if isinstance(error_data["error"], dict):
                    error_message = error_data["error"].get("message", "Unknown error")
                else:
                    error_message = str(error_data["error"])
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"LinkedIn API error: {error_message}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error posting to LinkedIn: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post to LinkedIn: {str(e)}"
        )

@router.get("/instagram/test-account")
async def test_instagram_account(
    current_user: User = Depends(get_current_user)
):
    """Test Instagram account setup without storing connection"""
    try:
        print(f"🔍 Testing Instagram account setup for user: {current_user.id}")
        
        # Get a fresh access token by simulating the OAuth flow
        # This will help us debug what's happening
        facebook_app_id = os.getenv('FACEBOOK_CLIENT_ID')
        facebook_app_secret = os.getenv('FACEBOOK_CLIENT_SECRET')
        
        if not facebook_app_id or not facebook_app_secret:
            return {"error": "Facebook app credentials not configured"}
        
        # Generate a test OAuth URL
        state = generate_oauth_state()
        oauth_url = generate_oauth_url("instagram", state)
        
        return {
            "message": "Use this URL to test Instagram connection",
            "oauth_url": oauth_url,
            "instructions": [
                "1. Click the OAuth URL above",
                "2. Grant permissions for Instagram",
                "3. Check if you see any error messages",
                "4. If successful, the callback will show detailed debug info"
            ],
            "facebook_app_id": facebook_app_id,
            "required_setup": [
                "Instagram Business account",
                "Connected to Facebook Page",
                "Page has Instagram Business account linked"
            ]
        }
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        return {"error": str(e)}

@router.get("/instagram/test-pages")
async def test_instagram_pages(
    current_user: User = Depends(get_current_user)
):
    """Test what pages and Instagram accounts are accessible"""
    try:
        print(f"🔍 Testing Instagram pages access for user: {current_user.id}")
        
        # Get a fresh access token by simulating the OAuth flow
        facebook_app_id = os.getenv('FACEBOOK_CLIENT_ID')
        facebook_app_secret = os.getenv('FACEBOOK_CLIENT_SECRET')
        
        if not facebook_app_id or not facebook_app_secret:
            return {"error": "Facebook app credentials not configured"}
        
        # Generate a test OAuth URL with more detailed scopes
        state = generate_oauth_state()
        
        # Test with more comprehensive scopes
        test_oauth_url = f"https://www.facebook.com/v18.0/dialog/oauth?client_id={facebook_app_id}&redirect_uri=https://agent-emily.onrender.com/connections/auth/instagram/callback&state={state}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,pages_manage_posts"
        
        return {
            "message": "Test Instagram pages access",
            "test_oauth_url": test_oauth_url,
            "debug_steps": [
                "1. Click the test OAuth URL above",
                "2. Grant ALL permissions (especially pages_manage_posts)",
                "3. Check the callback for detailed page information",
                "4. Look for Instagram Business account in the response"
            ],
            "common_issues": [
                "Instagram not properly linked to Facebook Page",
                "Missing pages_manage_posts permission",
                "Instagram account is Creator instead of Business",
                "Facebook Page doesn't have Instagram Business account"
            ],
            "facebook_app_id": facebook_app_id
        }
        
    except Exception as e:
        print(f"❌ Test pages error: {e}")
        return {"error": str(e)}

@router.post("/instagram/post")
async def post_to_instagram(
    post_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Post content to Instagram"""
    try:
        print(f"📱 Instagram post request from user: {current_user.id}")
        print(f"📝 Post data: {post_data}")
        
        # Get user's Instagram connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "instagram").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Instagram connection found. Please connect your Instagram account first."
            )
        
        connection = response.data[0]
        print(f"🔗 Found Instagram connection: {connection['id']}")
        
        # Decrypt the access token
        try:
            access_token = decrypt_token(connection['access_token_encrypted'])
            print(f"🔓 Decrypted access token: {access_token[:20]}...")
        except Exception as e:
            print(f"❌ Error decrypting token: {e}")
            
            # Check if the token is already in plaintext (not encrypted)
            if connection.get('access_token_encrypted', '').startswith('EAAB'):
                print("🔓 Token appears to be unencrypted, using directly")
                access_token = connection['access_token_encrypted']
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to decrypt access token. Please reconnect your Instagram account."
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
        
        # Get Instagram Business Account ID
        instagram_id = connection.get('instagram_id')
        if not instagram_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Instagram account ID not found. Please reconnect your Instagram account."
            )
        
        # Create media container first
        create_media_url = f"https://graph.facebook.com/v18.0/{instagram_id}/media"
        
        # For text-only posts, we need to create a media container with a caption
        media_data = {
            "caption": full_message,
            "access_token": access_token
        }
        
        print(f"🌐 Creating Instagram media container: {create_media_url}")
        print(f"📄 Media data: {media_data}")
        
        # Create the media container
        media_response = requests.post(create_media_url, data=media_data)
        
        if media_response.status_code != 200:
            try:
                error_data = media_response.json()
                print(f"❌ Instagram API error (JSON): {media_response.status_code} - {error_data}")
            except:
                error_text = media_response.text
                print(f"❌ Instagram API error (Text): {media_response.status_code} - {error_text}")
                error_data = {"error": {"message": error_text}}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Instagram API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
            )
        
        media_result = media_response.json()
        media_id = media_result.get('id')
        
        if not media_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create Instagram media container"
            )
        
        print(f"✅ Instagram media container created: {media_id}")
        
        # Publish the media
        publish_url = f"https://graph.facebook.com/v18.0/{instagram_id}/media_publish"
        publish_data = {
            "creation_id": media_id,
            "access_token": access_token
        }
        
        print(f"🌐 Publishing Instagram media: {publish_url}")
        publish_response = requests.post(publish_url, data=publish_data)
        
        if publish_response.status_code != 200:
            try:
                error_data = publish_response.json()
                print(f"❌ Instagram publish error (JSON): {publish_response.status_code} - {error_data}")
            except:
                error_text = publish_response.text
                print(f"❌ Instagram publish error (Text): {publish_response.status_code} - {error_text}")
                error_data = {"error": {"message": error_text}}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Instagram publish error: {error_data.get('error', {}).get('message', 'Unknown error')}"
            )
        
        publish_result = publish_response.json()
        post_id = publish_result.get('id')
        
        print(f"✅ Instagram post published: {post_id}")
        
        # Update content status in Supabase to 'published'
        try:
            content_id = post_data.get('content_id')
            if content_id:
                update_response = supabase_admin.table("content_posts").update({
                    "status": "published",
                    "published_at": datetime.now().isoformat(),
                    "instagram_post_id": post_id
                }).eq("id", content_id).execute()
                
                print(f"✅ Updated content status in database: {update_response}")
            else:
                print("⚠️  No content_id provided, skipping database update")
        except Exception as e:
            print(f"⚠️  Error updating content status in database: {e}")
            # Don't fail the whole request if database update fails
        
        return {
            "success": True,
            "platform": "instagram",
            "post_id": post_id,
            "message": "Content posted to Instagram successfully!",
            "url": f"https://instagram.com/p/{post_id}" if post_id else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error posting to Instagram: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post to Instagram: {str(e)}"
        )
