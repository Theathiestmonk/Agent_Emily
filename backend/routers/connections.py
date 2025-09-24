from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import HTMLResponse
from typing import List, Optional
from datetime import datetime, timedelta
import os
import secrets
import string
from cryptography.fernet import Fernet
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



class WordPressConnection(BaseModel):

    site_name: str

    site_url: str

    username: str

    password: str



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

# Import Google callback handler
from routers.google_connections import handle_google_callback

@router.get("/auth/google/callback")
async def google_oauth_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback from /connections/auth/google/callback path"""
    print(f"🔗 Google OAuth callback received at /connections/auth/google/callback - code: {code[:10] if code else 'None'}..., state: {state[:10] if state else 'None'}..., error: {error}")
    return await handle_google_callback(code, state, error)



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

    # Skip Google platform as it has its own router

    if platform == "google":

        raise HTTPException(status_code=404, detail="Not Found")
    
    
    
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

    # Skip Google platform as it has its own router

    if platform == "google":

        raise HTTPException(status_code=404, detail="Not Found")
    
    
    
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

    print(f"🔗 Main connections router callback - platform: {platform}, code: {code[:10] if code else 'None'}..., state: {state[:10] if state else 'None'}...")

    
    
    # Skip Google platform as it has its own router

    if platform == "google":

        print(f"❌ Redirecting Google callback to Google router")

        raise HTTPException(status_code=404, detail="Not Found")
    
    
    
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
        
        # Regular platform state lookup
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
        
        
        
        # Exchange code for tokens
        print(f"🔄 Exchanging {platform} code for tokens...")

        tokens = exchange_code_for_tokens(platform, code)

        print(f"✅ Tokens received: {tokens.keys() if tokens else 'None'}")

        # Get account information
        print(f"🔍 Getting account info for {platform}...")
        
        if platform == "instagram":
            print("🔄 Instagram OAuth - using Facebook token exchange and account info...")
            print(f"🔑 Access token (first 20 chars): {tokens['access_token'][:20]}...")

        account_info = get_account_info(platform, tokens['access_token'])

        print(f"📊 Account info result: {account_info}")
        
        if platform == "instagram":
            print("🔍 Instagram-specific debug info:")
            print(f"   - Has account_info: {account_info is not None}")
            if account_info:
                print(f"   - Has instagram_id: {account_info.get('instagram_id') is not None}")
                print(f"   - Has page_id: {account_info.get('page_id') is not None}")
                print(f"   - Has page_name: {account_info.get('page_name') is not None}")
                print(f"   - Account type: {account_info.get('account_type', 'unknown')}")

        
        
        # Handle case where account info is None (especially for Instagram)

        if account_info is None:

            if platform == "instagram":
                # For Instagram, provide helpful setup instructions
                print("🔄 No Instagram Business account found. Providing setup instructions...")
                
                return HTMLResponse(f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Instagram Setup Required</title>
                    <style>
                        body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }}
                        .step {{ background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #1877f2; }}
                        .button {{ background: #1877f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }}
                        .button:hover {{ background: #166fe5; }}
                    </style>
                </head>
                <body>
                    <h2>Instagram Business Account Setup Required</h2>
                    <p>To connect Instagram, you need to set up your Instagram Business account first:</p>
                    
                    <div class="step">
                        <h3>Step 1: Convert to Business Account</h3>
                        <p>In your Instagram app, go to Settings → Account → Switch to Professional Account → Business</p>
                    </div>
                    
                    <div class="step">
                        <h3>Step 2: Connect to Facebook Page</h3>
                        <p>In your Instagram app, go to Settings → Account → Linked Accounts → Facebook → Connect to a Page</p>
                    </div>
                    
                    <div class="step">
                        <h3>Step 3: Try Again</h3>
                        <p>Once your Instagram Business account is connected to a Facebook Page, try connecting again.</p>
                    </div>
                    
                    <a href="javascript:window.close()" class="button">Close and Try Again</a>
                    
                    <script>
                        if (window.opener) {{
                            window.opener.postMessage({{
                                type: 'OAUTH_ERROR',
                                platform: 'instagram',
                                error: 'Instagram Business account setup required. Please connect your Instagram to a Facebook Page first.'
                            }}, '*');
                        }}
                    </script>
                </body>
                </html>
                """)

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
            # For Instagram, use instagram_id as page_id since that's what the table expects
            if account_info.get('instagram_id'):
                connection_data["page_id"] = account_info.get('instagram_id')
            
            # Only include fields that exist in the database schema
            # Skip account_type, media_count, and other custom fields

        elif platform == "linkedin":

            connection_data["linkedin_id"] = account_info.get('linkedin_id')

            connection_data["organization_id"] = account_info.get('organization_id')

            connection_data["headline"] = account_info.get('headline')

            connection_data["email"] = account_info.get('email')

            connection_data["profile_picture"] = account_info.get('profile_picture')

            connection_data["account_type"] = account_info.get('account_type', 'personal')

            connection_data["is_organization"] = account_info.get('is_organization', False)
        
        
        
        # Try to insert, if it fails due to duplicate key, update instead
        try:
            connection_response = supabase_admin.table("platform_connections").insert(connection_data).execute()
        except Exception as e:
            if "duplicate key value violates unique constraint" in str(e):
                # Update existing connection
                connection_response = supabase_admin.table("platform_connections").update(connection_data).eq("user_id", user_id).eq("platform", platform).eq("page_id", account_info.get('page_id')).execute()
            else:
                raise e
        
        # For Facebook connections, also create Instagram connection if Instagram Business account exists
        if platform == 'facebook' and account_info.get('instagram_id'):
            print(f"📱 Facebook connection includes Instagram Business account: {account_info.get('instagram_id')}")
            
            instagram_connection_data = {
                "user_id": user_id,
                "platform": "instagram",
                "page_id": account_info.get('instagram_id'),  # Use instagram_id as page_id
                "page_name": account_info.get('username', ''),
                "page_username": account_info.get('username', ''),
                "follower_count": account_info.get('follower_count', 0),
                "access_token_encrypted": encrypt_token(page_access_token),  # Same token works for both
                "refresh_token_encrypted": encrypt_token(tokens.get('refresh_token', '')),
                "token_expires_at": (datetime.now() + timedelta(seconds=tokens.get('expires_in', 3600))).isoformat(),
                "connection_status": 'active',
                "is_active": True,
                "last_sync": datetime.now().isoformat()
                # Skip account_type, media_count and other custom fields that don't exist in DB
            }
            
            try:
                instagram_connection_response = supabase_admin.table("platform_connections").insert(instagram_connection_data).execute()
                print(f"✅ Created Instagram connection: {instagram_connection_response.data[0]['id'] if instagram_connection_response.data else 'unknown'}")
            except Exception as e:
                if "duplicate key value violates unique constraint" in str(e):
                    # Update existing Instagram connection
                    instagram_connection_response = supabase_admin.table("platform_connections").update(instagram_connection_data).eq("user_id", user_id).eq("platform", "instagram").eq("page_id", account_info.get('instagram_id')).execute()
                    print(f"✅ Updated existing Instagram connection")
                else:
                    print(f"❌ Error creating Instagram connection: {e}")
        
        
        
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

        missing_config.append(f"client_id for {platform} (check {platform.upper()}_CLIENT_ID env var)")

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

        # 4. Read ads data (ads_read, ads_management, business_management)

        # Removed invalid scopes: pages_manage_metadata, pages_messaging, pages_manage_engagement, pages_read_user_content

        return f"{base_url}?client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=pages_manage_posts,pages_read_engagement,pages_show_list,ads_read,ads_management,business_management"

    elif platform == 'instagram':
        # Instagram for Business uses Facebook OAuth with specific scopes
        # Based on how Zapier and other professional tools handle Instagram
        print("🔄 Instagram for Business OAuth - using Facebook OAuth with Instagram scopes...")
        
        # Use Instagram redirect URI for Instagram OAuth
        instagram_redirect_uri = f"{os.getenv('API_BASE_URL', '').rstrip('/')}/connections/auth/instagram/callback"
        
        # Instagram for Business requires specific scopes
        # Based on Facebook's official documentation and Zapier's implementation
        instagram_scopes = [
            "pages_show_list",           # List Facebook Pages
            "pages_read_engagement",     # Read page engagement data
            "instagram_basic",           # Basic Instagram account info
            "instagram_content_publish", # Publish to Instagram
            "pages_manage_posts",        # Manage page posts
            "business_management"        # Business management
        ]
        
        scope_string = ",".join(instagram_scopes)
        
        return f"{base_url}?client_id={client_id}&redirect_uri={instagram_redirect_uri}&state={state}&scope={scope_string}"

    elif platform == 'linkedin':
        # LinkedIn scopes for both personal and page management:
        # - openid, profile, email: Basic user info
        # - w_member_social: Post, comment, and react on personal profile
        # - w_organization_social: Post, comment, and react on behalf of organizations
        # - r_organization_social: Read organization data
        # - rw_organization_admin: Read and write organization data
        oauth_url = f"{base_url}?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=openid%20profile%20email%20w_member_social%20w_organization_social%20r_organization_social%20rw_organization_admin"
        print(f"🔗 Generated LinkedIn OAuth URL: {oauth_url}")
        return oauth_url

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
        # Instagram uses Facebook OAuth, so use Facebook token exchange
        # with Instagram redirect URI
        instagram_redirect_uri = f"{os.getenv('API_BASE_URL', '').rstrip('/')}/connections/auth/instagram/callback"
        return exchange_facebook_code_for_tokens(code, instagram_redirect_uri)

    elif platform == "linkedin":

        return exchange_linkedin_code_for_tokens(code)

    elif platform == "twitter":

        return exchange_twitter_code_for_tokens(code)

    else:

        raise ValueError(f"Unsupported platform: {platform}")



def exchange_facebook_code_for_tokens(code: str, redirect_uri: str = None) -> dict:

    """Exchange Facebook OAuth code for access tokens"""

    import requests

    

    facebook_app_id = os.getenv('FACEBOOK_CLIENT_ID')

    facebook_app_secret = os.getenv('FACEBOOK_CLIENT_SECRET')

    if not redirect_uri:
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



def exchange_twitter_code_for_tokens(code: str) -> dict:

    """Exchange Twitter OAuth code for access tokens"""

    import requests

    import base64

    

    twitter_client_id = os.getenv('TWITTER_CLIENT_ID')

    twitter_client_secret = os.getenv('TWITTER_CLIENT_SECRET')

    redirect_uri = f"{os.getenv('API_BASE_URL', '').rstrip('/')}/connections/auth/twitter/callback"

    

    if not twitter_client_id or not twitter_client_secret:

        raise ValueError("Twitter app credentials not configured")

    

    # Create basic auth header for Twitter API

    credentials = f"{twitter_client_id}:{twitter_client_secret}"

    encoded_credentials = base64.b64encode(credentials.encode()).decode()

    

    # Exchange code for access token

    token_url = "https://api.twitter.com/2/oauth2/token"

    token_data = {

        'grant_type': 'authorization_code',

        'code': code,

        'redirect_uri': redirect_uri,

        'code_verifier': 'challenge'  # Twitter requires PKCE

    }

    

    headers = {

        'Authorization': f'Basic {encoded_credentials}',

        'Content-Type': 'application/x-www-form-urlencoded'

    }

    

    response = requests.post(token_url, data=token_data, headers=headers)

    response.raise_for_status()

    

    token_response = response.json()

    

    return {

        "access_token": token_response['access_token'],

        "refresh_token": token_response.get('refresh_token', ''),

        "expires_in": token_response.get('expires_in', 7200)

    }



def get_account_info(platform: str, access_token: str) -> dict:

    """Get account information from platform API"""

    if platform == "facebook":

        return get_facebook_account_info(access_token)

    elif platform == "instagram":
        # Instagram for Business uses Facebook OAuth but needs Instagram-specific handling
        # Follow the same pattern as Zapier and other professional tools
        print("🔄 Instagram for Business - getting account info via Facebook OAuth...")
        
        # Get Facebook account info first (this is what Instagram for Business uses)
        facebook_info = get_facebook_account_info(access_token)
        
        if facebook_info and facebook_info.get('instagram_id'):
            print(f"✅ Found Instagram Business account via Facebook: {facebook_info.get('instagram_id')}")
            return facebook_info
        
        # If no Instagram found in Facebook info, try dedicated Instagram function
        print("🔄 No Instagram found in Facebook info, trying dedicated Instagram function...")
        return get_instagram_account_info(access_token)

    elif platform == "linkedin":

        return get_linkedin_account_info(access_token)

    elif platform == "twitter":

        return get_twitter_account_info(access_token)

    else:

        raise ValueError(f"Unsupported platform: {platform}")



def get_facebook_account_info(access_token: str) -> dict:

    """Get Facebook account information"""

    import requests

    
    
    # Get user's pages

    pages_url = "https://graph.facebook.com/v18.0/me/accounts"

    pages_params = {

        'access_token': access_token,

        'fields': 'id,name,username,followers_count,access_token,instagram_business_account'

    }

    
    
    response = requests.get(pages_url, params=pages_params)

    response.raise_for_status()

    
    
    pages_data = response.json()

    
    
    if not pages_data.get('data'):

        raise ValueError("No Facebook pages found for this user")
    
    
    
    # Use the first page (you could let user choose if multiple)

    page = pages_data['data'][0]

    
    
    # Check if this page has an Instagram Business account
    instagram_account = page.get('instagram_business_account')
    
    result = {
        "page_id": page['id'],
        "page_name": page['name'],
        "username": page.get('username', ''),
        "follower_count": page.get('followers_count', 0),
        "page_access_token": page.get('access_token', '')
    }
    
    # If Instagram Business account exists, include Instagram data
    if instagram_account:
        print(f"✅ Found Instagram Business account: {instagram_account}")
        result.update({
            "instagram_id": instagram_account['id'],
            "instagram_username": instagram_account.get('username', ''),
            "account_type": "business"
        })
    
    return result



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
                        
                        # Check if Instagram account is in the detailed response
                        if page_details.get('instagram_business_account'):
                            instagram_account = page_details['instagram_business_account']
                            instagram_page = page
                            print(f"✅ Found Instagram account in page details: {instagram_account}")
                            break
                        elif page_details.get('connected_instagram_account'):
                            # Sometimes it's under connected_instagram_account
                            instagram_account = page_details['connected_instagram_account']
                            instagram_page = page
                            print(f"✅ Found Instagram account under connected_instagram_account: {instagram_account}")
                            break
                    else:
                        print(f"❌ Could not get page details: {page_details_response.status_code} - {page_details_response.text}")

                except Exception as e:

                    print(f"❌ Error getting page details: {e}")
        
        
        
        # If still no Instagram account found, try alternative method
        if not instagram_account:
            print("🔄 Trying alternative method to find Instagram Business account...")
            try:
                # Try to get Instagram accounts directly
                instagram_accounts_url = f"https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account&access_token={access_token}"
                instagram_response = requests.get(instagram_accounts_url)
                
                if instagram_response.status_code == 200:
                    instagram_data = instagram_response.json()
                    print(f"🔍 Instagram accounts response: {instagram_data}")
                    
                    for account in instagram_data.get('data', []):
                        if account.get('instagram_business_account'):
                            instagram_account = account['instagram_business_account']
                            instagram_page = account
                            print(f"✅ Found Instagram account via alternative method: {instagram_account}")
                            break
                else:
                    print(f"❌ Alternative method failed: {instagram_response.status_code} - {instagram_response.text}")
            except Exception as e:
                print(f"❌ Error with alternative method: {e}")

        if not instagram_account:
            print("❌ No Instagram Business account found connected to any Facebook page")
            print("💡 User needs to:")
            print("   1. Convert Instagram to Business account")
            print("   2. Connect Instagram to a Facebook Page")
            print("   3. Ensure the page has Instagram Business account linked")
            
            # Return a helpful error message instead of None
            raise Exception("No Instagram Business account found. Please ensure your Instagram account is connected to a Facebook Page and is a Business or Creator account. You can do this by going to your Instagram app settings and connecting it to a Facebook Page.")
        
        
        
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

    """Get LinkedIn account information using openid, profile, email, and w_member_social scopes"""

    import requests

    
    
    try:

        print(f"🔍 Getting LinkedIn account info with token: {access_token[:20]}...")

        
        
        headers = {

            'Authorization': f'Bearer {access_token}',

            'Content-Type': 'application/json',

            'X-Restli-Protocol-Version': '2.0.0'

        }

        
        
        # Try OpenID Connect endpoint first (for openid and profile scopes)

        try:

            print("🔄 Trying OpenID Connect endpoint...")

            userinfo_url = "https://api.linkedin.com/v2/userinfo"

            userinfo_response = requests.get(userinfo_url, headers=headers)

            print(f"📊 LinkedIn userinfo response status: {userinfo_response.status_code}")

            
            
            if userinfo_response.status_code == 200:

                userinfo_data = userinfo_response.json()

                print(f"✅ LinkedIn userinfo data: {userinfo_data}")

                
                
                # Extract from OpenID Connect response

                linkedin_id = userinfo_data.get('sub', '')

                first_name = userinfo_data.get('given_name', '')

                last_name = userinfo_data.get('family_name', '')

                email_address = userinfo_data.get('email', '')

                profile_picture = userinfo_data.get('picture', '')

                headline = userinfo_data.get('headline', '')

                
                
                return {

                    'linkedin_id': linkedin_id,

                    'first_name': first_name,

                    'last_name': last_name,

                    'email': email_address,

                    'profile_picture': profile_picture,

                    'headline': headline,

                    'follower_count': 0,

                    'page_id': linkedin_id,

                    'page_name': f"{first_name} {last_name}".strip(),

                    'account_type': 'personal',

                    'is_organization': False

                }

        except Exception as e:

            print(f"⚠️ OpenID Connect failed: {e}")
        
        
        
        # Fallback to standard LinkedIn API

        print("🔄 Falling back to standard LinkedIn API...")

        profile_url = "https://api.linkedin.com/v2/me"

        profile_response = requests.get(profile_url, headers=headers)

        print(f"📊 LinkedIn profile response status: {profile_response.status_code}")

        
        
        if profile_response.status_code != 200:

            print(f"❌ Error fetching LinkedIn profile: {profile_response.status_code} - {profile_response.text}")

            return None
        
        
        
        profile_data = profile_response.json()

        print(f"✅ LinkedIn profile data: {profile_data}")

        
        
        # Extract profile information

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
        
        
        
        # Try to get user's email

        email_address = ""

        try:

            email_url = "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))"

            email_response = requests.get(email_url, headers=headers)

            if email_response.status_code == 200:

                email_data = email_response.json()

                email_address = email_data.get('elements', [{}])[0].get('handle~', {}).get('emailAddress', '')

                print(f"✅ Email fetched: {email_address}")

            else:

                print(f"⚠️ Could not fetch email: {email_response.status_code} - {email_response.text}")

        except Exception as e:

            print(f"⚠️ Could not fetch email: {e}")
        
        
        
        # Try to get organization data for page management
        organizations = []
        try:
            print("🔄 Getting organization info for page management...")
            org_url = "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED"
            org_response = requests.get(org_url, headers=headers)
            print(f"📊 LinkedIn organizations response status: {org_response.status_code}")
            
            if org_response.status_code == 200:
                org_data = org_response.json()
                print(f"✅ LinkedIn organizations data: {org_data}")
                
                for org in org_data.get('elements', []):
                    org_entity = org.get('organizationalTarget', {})
                    org_id = org_entity.get('~', '').split(':')[-1] if '~' in org_entity.get('~', '') else ''
                    
                    if org_id:
                        # Get organization details
                        try:
                            org_details_url = f"https://api.linkedin.com/v2/organizations/{org_id}"
                            org_details_response = requests.get(org_details_url, headers=headers)
                            
                            if org_details_response.status_code == 200:
                                org_details = org_details_response.json()
                                organizations.append({
                                    'id': org_id,
                                    'name': org_details.get('name', 'Unknown Organization'),
                                    'account_type': 'organization',
                                    'platform': 'linkedin',
                                    'role': org.get('role', 'ADMINISTRATOR')
                                })
                                print(f"✅ Added organization: {org_details.get('name', 'Unknown')}")
                        except Exception as e:
                            print(f"❌ Error getting org details for {org_id}: {e}")
            else:
                print(f"❌ LinkedIn organizations failed: {org_response.status_code} - {org_response.text}")
                
        except Exception as e:
            print(f"❌ LinkedIn organizations error: {e}")

        print("👤 Using personal LinkedIn account")

        return {

            'linkedin_id': linkedin_id,

            'first_name': first_name,

            'last_name': last_name,

            'email': email_address,

            'profile_picture': '',

            'headline': headline,

            'follower_count': 0,

            'page_id': linkedin_id,

            'page_name': f"{first_name} {last_name}".strip(),

            'account_type': 'personal',

            'is_organization': False,
            
            'organizations': organizations  # Include available organizations for page management

        }
        
        
        
    except Exception as e:

        print(f"❌ Error getting LinkedIn account info: {e}")

        print(f"❌ Error type: {type(e).__name__}")

        import traceback

        print(f"❌ Traceback: {traceback.format_exc()}")

        return None



def get_twitter_account_info(access_token: str) -> dict:

    """Get Twitter account information using Twitter API v2"""

    import requests

    

    try:

        print(f"🔍 Getting Twitter account info with token: {access_token[:20]}...")

        

        headers = {

            'Authorization': f'Bearer {access_token}',

            'Content-Type': 'application/json'

        }

        

        # Get user information from Twitter API v2

        user_url = "https://api.twitter.com/2/users/me"

        user_params = {

            'user.fields': 'id,username,name,public_metrics,verified,profile_image_url'

        }

        

        user_response = requests.get(user_url, headers=headers, params=user_params)

        print(f"📊 Twitter user response status: {user_response.status_code}")

        

        if user_response.status_code == 200:

            user_data = user_response.json()

            print(f"✅ Twitter user data: {user_data}")

            

            if 'data' in user_data:

                user_info = user_data['data']

                return {

                    "account_id": user_info['id'],

                    "account_name": user_info['username'],

                    "display_name": user_info['name'],

                    "profile_picture": user_info.get('profile_image_url', ''),

                    "verified": user_info.get('verified', False),

                    "followers_count": user_info.get('public_metrics', {}).get('followers_count', 0),

                    "following_count": user_info.get('public_metrics', {}).get('following_count', 0),

                    "tweet_count": user_info.get('public_metrics', {}).get('tweet_count', 0)

                }

            else:

                print(f"❌ No user data in Twitter response: {user_data}")

                return None

        else:

            print(f"❌ Twitter API error: {user_response.status_code} - {user_response.text}")

            return None

            

    except Exception as e:

        print(f"❌ Error getting Twitter account info: {e}")

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

        image_url = post_data.get('image_url', '')

        
        
        # Combine title, message, and hashtags

        full_message = ""

        if title:

            full_message += f"{title}\n\n"

        full_message += message

        if hashtags:

            hashtag_string = " ".join([f"#{tag}" for tag in hashtags])

            full_message += f"\n\n{hashtag_string}"
        
        
        
        print(f"📄 Full message to post: {full_message}")

        print(f"🖼️ Image URL: {image_url}")

        
        
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

        
        
        # Prepare payload based on whether we have an image

        if image_url:

            # For posts with images, we need to use photos endpoint

            facebook_url = f"https://graph.facebook.com/v18.0/{connection['page_id']}/photos"

            payload = {

                "message": full_message,

                "url": image_url,  # Facebook will fetch the image from this URL

                "access_token": access_token

            }

            print(f"🖼️ Posting with image to photos endpoint")

        else:

            # For text-only posts, use feed endpoint

            payload = {

                "message": full_message,

                "access_token": access_token

            }

            print(f"📝 Posting text-only to feed endpoint")
        
        
        
        # Also try with access_token as URL parameter

        facebook_url_with_token = f"{facebook_url}?access_token={access_token}"

        
        
        print(f"🌐 Posting to Facebook URL: {facebook_url}")

        print(f"📄 Payload: {payload}")

        print(f"🔑 Access token length: {len(access_token)}")

        print(f"📱 Page ID: {connection['page_id']}")

        
        
        # Try posting with access_token in URL first (recommended method)

        print(f"🌐 Trying URL method: {facebook_url_with_token}")

        if image_url:

            # For photos, send URL parameter separately

            response = requests.post(facebook_url_with_token, data={

                "message": full_message,

                "url": image_url

            })

        else:

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

            "instagram_id": connection.get('page_id'),  # Instagram ID is stored in page_id field

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


@router.get("/linkedin/organizations")
async def get_linkedin_organizations(
    current_user: User = Depends(get_current_user)
):
    """Get available LinkedIn organizations for the user"""
    try:
        print(f"🏢 Getting LinkedIn organizations for user: {current_user.id}")
        
        # Get user's LinkedIn connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "linkedin").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active LinkedIn connection found. Please connect your LinkedIn account first."
            )
        
        connection = response.data[0]
        
        try:
            access_token = decrypt_token(connection['access_token_encrypted'])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt access token. Please reconnect your LinkedIn account."
            )
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
        }
        
        # Get organization data
        org_url = "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED"
        org_response = requests.get(org_url, headers=headers)
        
        if org_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch organizations: {org_response.text}"
            )
        
        org_data = org_response.json()
        organizations = []
        
        for org in org_data.get('elements', []):
            org_entity = org.get('organizationalTarget', {})
            org_id = org_entity.get('~', '').split(':')[-1] if '~' in org_entity.get('~', '') else ''
            
            if org_id:
                try:
                    # Get organization details
                    org_details_url = f"https://api.linkedin.com/v2/organizations/{org_id}"
                    org_details_response = requests.get(org_details_url, headers=headers)
                    
                    if org_details_response.status_code == 200:
                        org_details = org_details_response.json()
                        organizations.append({
                            'id': org_id,
                            'name': org_details.get('name', 'Unknown Organization'),
                            'description': org_details.get('description', ''),
                            'logo_url': org_details.get('logoV2', {}).get('original~', {}).get('elements', [{}])[0].get('identifiers', [{}])[0].get('identifier', ''),
                            'role': org.get('role', 'ADMINISTRATOR')
                        })
                except Exception as e:
                    print(f"❌ Error getting org details for {org_id}: {e}")
                    # Add basic org info even if details fail
                    organizations.append({
                        'id': org_id,
                        'name': 'LinkedIn Organization',
                        'description': '',
                        'logo_url': '',
                        'role': org.get('role', 'ADMINISTRATOR')
                    })
        
        return {
            "success": True,
            "organizations": organizations,
            "message": f"Found {len(organizations)} organizations"
        }
        
    except Exception as e:
        print(f"❌ LinkedIn organizations error: {e}")
        return {"error": str(e)}

@router.post("/linkedin/upload-image")
async def upload_linkedin_image(
    image_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Upload image to LinkedIn for use in posts"""
    try:
        print(f"📸 LinkedIn image upload request from user: {current_user.id}")
        
        # Get user's LinkedIn connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "linkedin").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active LinkedIn connection found. Please connect your LinkedIn account first."
            )
        
        connection = response.data[0]
        
        # Decrypt the access token
        try:
            access_token = decrypt_token(connection['access_token_encrypted'])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt access token. Please reconnect your LinkedIn account."
            )
        
        # Get the user's LinkedIn ID
        linkedin_id = connection.get('linkedin_id') or connection.get('page_id')
        if not linkedin_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LinkedIn ID not found in connection data"
            )
        
        # Step 1: Register the image upload
        register_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
        }
        
        register_payload = {
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                "owner": f"urn:li:person:{linkedin_id}",
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }
                ]
            }
        }
        
        print(f"🔄 Registering image upload...")
        register_response = requests.post(register_url, headers=headers, json=register_payload)
        
        if not register_response.ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to register image upload: {register_response.text}"
            )
        
        register_data = register_response.json()
        upload_url = register_data['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']['uploadUrl']
        asset_urn = register_data['value']['asset']
        
        print(f"✅ Image upload registered. Asset URN: {asset_urn}")
        
        # Step 2: Upload the image binary data
        # Note: In a real implementation, you'd need to fetch the image from the provided URL
        # and upload it as binary data. For now, we'll return the asset URN for use in posts.
        
        return {
            "success": True,
            "asset_urn": asset_urn,
            "message": "Image upload registered successfully. Use the asset_urn in your post."
        }
        
    except Exception as e:
        print(f"❌ LinkedIn image upload error: {e}")
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
        
        
        
        # Post to LinkedIn using the UGC API (new recommended approach)

        linkedin_url = "https://api.linkedin.com/v2/ugcPosts"

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
        
        # Check if user wants to post to an organization (page)
        organization_id = post_data.get('organization_id')
        if organization_id:
            # Post to organization page
            author_urn = f"urn:li:organization:{organization_id}"
            print(f"🏢 Posting to organization: {organization_id}")
        else:
            # Post to personal profile
            author_urn = f"urn:li:person:{linkedin_id}"
            print(f"👤 Posting to personal profile: {linkedin_id}")
        
        
        
        # Get visibility setting from post data (default to PUBLIC)

        visibility = post_data.get('visibility', 'PUBLIC')

        if visibility not in ['PUBLIC', 'CONNECTIONS']:

            visibility = 'PUBLIC'

        

        

        # Get image URL if provided

        image_url = post_data.get('image_url', '')

        

        

        # Determine share media category and prepare media

        share_media_category = "NONE"

        media = []

        

        if image_url:

            # For proper image support, we need to upload the image first

            # For now, we'll handle image URLs as articles

            # In a full implementation, you'd call the image upload endpoint first

            share_media_category = "ARTICLE"

            media = [{

                "status": "READY",

                "description": {

                    "text": title or "Shared image"

                },

                "originalUrl": image_url,

                "title": {

                    "text": title or "Shared content"

                }

            }]

        elif any(keyword in full_message.lower() for keyword in ['http://', 'https://', 'www.']):

            # Check if message contains URLs

            share_media_category = "ARTICLE"

            # Extract URL from message (simple implementation)

            import re

            url_match = re.search(r'https?://[^\s]+', full_message)

            if url_match:

                extracted_url = url_match.group(0)

                media = [{

                    "status": "READY",

                    "description": {

                        "text": title or "Shared article"

                    },

                    "originalUrl": extracted_url,

                    "title": {

                        "text": title or "Shared content"

                    }

                }]

        

        

        # Create the UGC post payload

        ugc_payload = {

            "author": author_urn,

            "lifecycleState": "PUBLISHED",

            "specificContent": {

                "com.linkedin.ugc.ShareContent": {

                    "shareCommentary": {

                        "text": full_message

                    },

                    "shareMediaCategory": share_media_category

                }

            },

            "visibility": {

                "com.linkedin.ugc.MemberNetworkVisibility": visibility

            }

        }

        

        # Add media if present

        if media:

            ugc_payload["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = media

        
        
        print(f"🌐 Posting to LinkedIn API: {linkedin_url}")

        print(f"📋 UGC payload: {ugc_payload}")

        
        
        response = requests.post(linkedin_url, headers=headers, json=ugc_payload)

        
        
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

        image_url = post_data.get('image_url', '')

        
        
        # Combine title, message, and hashtags

        full_message = ""

        if title:

            full_message += f"{title}\n\n"

        full_message += message

        if hashtags:

            hashtag_string = " ".join([f"#{tag}" for tag in hashtags])

            full_message += f"\n\n{hashtag_string}"
        
        
        
        print(f"📄 Full message to post: {full_message}")

        print(f"🖼️ Image URL: {image_url}")

        
        
        # Get Instagram Business Account ID (stored in page_id field)

        instagram_id = connection.get('page_id')

        if not instagram_id:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail="Instagram account ID not found. Please reconnect your Instagram account."

            )
        
        
        
        # Create media container first

        create_media_url = f"https://graph.facebook.com/v18.0/{instagram_id}/media"

        
        
        # Prepare media data based on whether we have an image

        if image_url:

            # For posts with images

            media_data = {

                "image_url": image_url,

                "caption": full_message,

                "access_token": access_token

            }

            print(f"🖼️ Creating Instagram post with image")

        else:

            # For text-only posts, we need to create a media container with a caption

            media_data = {

                "caption": full_message,

                "access_token": access_token

            }

            print(f"📝 Creating Instagram text-only post")
        
        
        
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



# WordPress Connection Endpoints

@router.get("/wordpress")

async def get_wordpress_connections(

    current_user: User = Depends(get_current_user)

):

    """Get all WordPress connections for current user"""

    try:

        print(f"🔍 Fetching WordPress connections for user: {current_user.id}")

        
        
        response = supabase_admin.table("wordpress_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()

        
        
        connections = response.data if response.data else []

        print(f"📊 Found {len(connections)} active WordPress connections")

        
        
        # Remove sensitive data from response

        response_connections = []

        for conn in connections:

            conn_dict = {

                "id": conn["id"],

                "site_name": conn["site_name"],

                "site_url": conn["site_url"],

                "username": conn["username"],

                "is_active": conn["is_active"],

                "last_checked_at": conn["last_checked_at"],

                "connected_at": conn["created_at"],

                "metadata": conn.get("metadata", {})

            }

            response_connections.append(conn_dict)
        
        
        
        return response_connections

    except Exception as e:

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Failed to fetch WordPress connections: {str(e)}"

        )



@router.post("/wordpress")

async def create_wordpress_connection(

    connection_data: WordPressConnection,

    current_user: User = Depends(get_current_user)

):

    """Create a new WordPress connection"""

    try:

        print(f"🔗 Creating WordPress connection for user: {current_user.id}")

        print(f"📝 Site: {connection_data.site_name} ({connection_data.site_url})")

        
        
        # Validate WordPress site URL

        if not connection_data.site_url.startswith(('http://', 'https://')):

            connection_data.site_url = f"https://{connection_data.site_url}"
        
        

        # Test the connection using WordPress XML-RPC authentication
        xmlrpc_url = f"{connection_data.site_url.rstrip('/')}/xmlrpc.php"
        
        print(f"🔍 Testing WordPress connection with XML-RPC: {xmlrpc_url}")
        
        try:
            import xmlrpc.client
            server = xmlrpc.client.ServerProxy(xmlrpc_url)
            
            # Test if XML-RPC is enabled
            methods = server.system.listMethods()
            print(f"🔍 XML-RPC methods available: {len(methods)}")
            
            # Try to get user info to test authentication
            user_info = server.wp.getProfile(1, connection_data.username, connection_data.password)
            print(f"✅ WordPress XML-RPC authentication successful!")
            print(f"🔍 User: {user_info.get('display_name', 'Unknown')}")
            print(f"🔍 Email: {user_info.get('user_email', 'Unknown')}")
            
        except Exception as e:
            print(f"❌ WordPress XML-RPC authentication failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to authenticate with WordPress. Please check your credentials and ensure XML-RPC is enabled. Error: {str(e)}"
            )
        
        # user_info is now available outside the try block
        
        # Encrypt the password
        encrypted_password = encrypt_token(connection_data.password)

        
        
        # Store connection in Supabase

        connection_record = {

            "user_id": current_user.id,

            "site_name": connection_data.site_name,

            "site_url": connection_data.site_url,

            "username": connection_data.username,

            "password": encrypted_password,

            "is_active": True,

            "last_checked_at": datetime.now().isoformat(),

            "metadata": {

                "site_title": user_info.get('display_name', connection_data.site_name),

                "site_description": user_info.get('description', ''),

                "user_display_name": user_info.get('display_name', connection_data.username),

                "user_email": user_info.get('user_email', ''),

                "capabilities": user_info.get('capabilities', {}),

                "wordpress_version": user_info.get('wordpress_version', 'Unknown')

            }

        }

        
        
        response = supabase_admin.table("wordpress_connections").insert(connection_record).execute()

        
        
        if not response.data:

            raise HTTPException(

                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

                detail="Failed to store WordPress connection"

            )
        
        
        
        connection_id = response.data[0]["id"]

        print(f"✅ WordPress connection created: {connection_id}")

        
        
        return {

            "success": True,

            "connection_id": connection_id,

            "message": f"Successfully connected to {connection_data.site_name}",

            "site_info": {

                "site_name": connection_data.site_name,

                "site_url": connection_data.site_url,

                "site_title": user_info.get('display_name', connection_data.site_name),

                "user_display_name": user_info.get('display_name', connection_data.site_name)

            }

        }
        
        
        
    except HTTPException:

        raise

    except requests.exceptions.RequestException as e:

        print(f"❌ WordPress connection error: {e}")

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=f"Failed to connect to WordPress site. Please check your site URL and credentials. Error: {str(e)}"

        )

    except Exception as e:

        print(f"❌ Error creating WordPress connection: {e}")

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Failed to create WordPress connection: {str(e)}"

        )



@router.put("/wordpress/{connection_id}")

async def update_wordpress_connection(

    connection_id: str,

    connection_data: WordPressConnection,

    current_user: User = Depends(get_current_user)

):

    """Update an existing WordPress connection"""

    try:

        print(f"🔧 Updating WordPress connection {connection_id} for user: {current_user.id}")

        
        
        # Verify connection belongs to user

        existing_response = supabase_admin.table("wordpress_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).execute()

        
        
        if not existing_response.data:

            raise HTTPException(

                status_code=status.HTTP_404_NOT_FOUND,

                detail="WordPress connection not found"

            )
        
        
        
        # Validate WordPress site URL

        if not connection_data.site_url.startswith(('http://', 'https://')):

            connection_data.site_url = f"https://{connection_data.site_url}"
        
        

        # Test the connection using WordPress XML-RPC authentication
        xmlrpc_url = f"{connection_data.site_url.rstrip('/')}/xmlrpc.php"
        
        print(f"🔍 Testing updated WordPress connection with XML-RPC: {xmlrpc_url}")
        
        try:
            import xmlrpc.client
            server = xmlrpc.client.ServerProxy(xmlrpc_url)
            
            # Test if XML-RPC is enabled
            methods = server.system.listMethods()
            print(f"🔍 XML-RPC methods available: {len(methods)}")
            
            # Try to get user info to test authentication
            user_info = server.wp.getProfile(1, connection_data.username, connection_data.password)
            print(f"✅ WordPress XML-RPC authentication successful!")
            print(f"🔍 User: {user_info.get('display_name', 'Unknown')}")
            print(f"🔍 Email: {user_info.get('user_email', 'Unknown')}")
            
        except Exception as e:
            print(f"❌ WordPress XML-RPC authentication failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to authenticate with WordPress. Please check your credentials and ensure XML-RPC is enabled. Error: {str(e)}"
            )
        
        # Encrypt the password
        encrypted_password = encrypt_token(connection_data.password)

        
        
        # Update connection in Supabase

        update_data = {

            "site_name": connection_data.site_name,

            "site_url": connection_data.site_url,

            "username": connection_data.username,

            "password": encrypted_password,

            "last_checked_at": datetime.now().isoformat(),

            "metadata": {

                "site_title": user_info.get('display_name', connection_data.site_name),

                "site_description": user_info.get('description', ''),

                "user_display_name": user_info.get('display_name', connection_data.site_name),

                "user_email": user_info.get('user_email', ''),

                "capabilities": user_info.get('capabilities', {}),

                "wordpress_version": user_info.get('wordpress_version', 'Unknown')

            }

        }

        
        
        response = supabase_admin.table("wordpress_connections").update(update_data).eq("id", connection_id).eq("user_id", current_user.id).execute()

        
        
        if not response.data:

            raise HTTPException(

                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

                detail="Failed to update WordPress connection"

            )
        
        
        
        print(f"✅ WordPress connection updated: {connection_id}")

        
        
        return {

            "success": True,

            "message": f"Successfully updated connection to {connection_data.site_name}",

            "site_info": {

                "site_name": connection_data.site_name,

                "site_url": connection_data.site_url,

                "site_title": user_info.get('display_name', connection_data.site_name),

                "user_display_name": user_info.get('display_name', connection_data.site_name)

            }

        }
        
        
        
    except HTTPException:

        raise

    except requests.exceptions.RequestException as e:

        print(f"❌ WordPress connection error: {e}")

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=f"Failed to connect to WordPress site. Please check your site URL and credentials. Error: {str(e)}"

        )

    except Exception as e:

        print(f"❌ Error updating WordPress connection: {e}")

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Failed to update WordPress connection: {str(e)}"

        )



@router.delete("/wordpress/{connection_id}")

async def delete_wordpress_connection(

    connection_id: str,

    current_user: User = Depends(get_current_user)

):

    """Delete a WordPress connection"""

    try:

        print(f"🗑️ Deleting WordPress connection {connection_id} for user: {current_user.id}")

        
        
        # Verify connection belongs to user

        existing_response = supabase_admin.table("wordpress_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).execute()

        
        
        if not existing_response.data:

            raise HTTPException(

                status_code=status.HTTP_404_NOT_FOUND,

                detail="WordPress connection not found"

            )
        
        
        
        # Mark as inactive instead of deleting

        response = supabase_admin.table("wordpress_connections").update({

            "is_active": False,

            "updated_at": datetime.now().isoformat()

        }).eq("id", connection_id).eq("user_id", current_user.id).execute()

        
        
        if not response.data:

            raise HTTPException(

                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

                detail="Failed to delete WordPress connection"

            )
        
        
        
        print(f"✅ WordPress connection deleted: {connection_id}")

        
        
        return {

            "success": True,

            "message": "WordPress connection deleted successfully"

        }
        
        
        
    except HTTPException:

        raise

    except Exception as e:

        print(f"❌ Error deleting WordPress connection: {e}")

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Failed to delete WordPress connection: {str(e)}"

        )



@router.post("/wordpress/{connection_id}/test")

async def test_wordpress_connection(

    connection_id: str,

    current_user: User = Depends(get_current_user)

):

    """Test a WordPress connection"""

    try:

        print(f"🔍 Testing WordPress connection {connection_id} for user: {current_user.id}")

        
        
        # Get connection details

        response = supabase_admin.table("wordpress_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).eq("is_active", True).execute()

        
        
        if not response.data:

            raise HTTPException(

                status_code=status.HTTP_404_NOT_FOUND,

                detail="WordPress connection not found"

            )
        
        
        
        connection = response.data[0]
        
        
        
        # Decrypt the password
        try:
            password = decrypt_token(connection['password'])
        except Exception as e:
            print(f"❌ Error decrypting password: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt password"
            )
        
        # Test the connection using WordPress XML-RPC authentication
        xmlrpc_url = f"{connection['site_url'].rstrip('/')}/xmlrpc.php"
        
        print(f"🔍 Testing WordPress connection with XML-RPC: {xmlrpc_url}")
        
        try:
            import xmlrpc.client
            server = xmlrpc.client.ServerProxy(xmlrpc_url)
            
            # Test if XML-RPC is enabled
            methods = server.system.listMethods()
            print(f"🔍 XML-RPC methods available: {len(methods)}")
            
            # Try to get user info to test authentication
            user_info = server.wp.getProfile(1, connection['username'], password)
            print(f"✅ WordPress XML-RPC authentication successful!")
            print(f"🔍 User: {user_info.get('display_name', 'Unknown')}")
            print(f"🔍 Email: {user_info.get('user_email', 'Unknown')}")
            
        except Exception as e:
            print(f"❌ WordPress XML-RPC authentication failed: {e}")
            # Update last_checked_at even if test failed
            supabase_admin.table("wordpress_connections").update({
                "last_checked_at": datetime.now().isoformat()
            }).eq("id", connection_id).execute()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to authenticate with WordPress. Please check your credentials and ensure XML-RPC is enabled. Error: {str(e)}"
            )

        
        
        # Update last_checked_at and metadata

        supabase_admin.table("wordpress_connections").update({

            "last_checked_at": datetime.now().isoformat(),

            "metadata": {

                "site_title": user_info.get('display_name', connection_data.site_name),

                "site_description": user_info.get('description', ''),

                "user_display_name": user_info.get('display_name', connection_data.site_name),

                "user_email": user_info.get('user_email', ''),

                "capabilities": user_info.get('capabilities', {}),

                "wordpress_version": user_info.get('wordpress_version', 'Unknown'),

                "last_test_status": "success",

                "last_test_at": datetime.now().isoformat()

            }

        }).eq("id", connection_id).execute()

        
        
        return {

            "success": True,

            "message": "WordPress connection test successful",

            "site_info": {

                "site_name": connection['site_name'],

                "site_url": connection['site_url'],

                "site_title": user_info.get('display_name', connection_data.site_name),

                "user_display_name": user_info.get('display_name', connection_data.site_name),

                "user_email": user_info.get('user_email', ''),

                "capabilities": user_info.get('capabilities', {}),

                "wordpress_version": user_info.get('wordpress_version', 'Unknown')

            }

        }
        
        
        
    except HTTPException:

        raise

    except requests.exceptions.RequestException as e:

        print(f"❌ WordPress connection test error: {e}")

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=f"Failed to test WordPress connection. Please check your site URL and credentials. Error: {str(e)}"

        )

    except Exception as e:

        print(f"❌ Error testing WordPress connection: {e}")

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Failed to test WordPress connection: {str(e)}"

        )

