from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, Request as FastAPIRequest
from fastapi.responses import HTMLResponse
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from cryptography.fernet import Fernet
import secrets
import string
from typing import List, Dict, Any
import os
import json
import base64
import uuid
import logging
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Configure logger
logger = logging.getLogger(__name__)

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

router = APIRouter(prefix="/connections/google", tags=["google-connections"])

# Google OAuth scopes
GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'openid',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
        
        # Extract token
        token = authorization.split(" ")[1]
        
        # Try to get user info from Supabase using the token
        try:
            user_response = supabase.auth.get_user(token)
            
            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_data = user_response.user
                return User(
                    id=user_data.id,
                    email=user_data.email or "unknown@example.com",
                    name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                    created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
                )
            else:
                return User(
                    id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                    email="test@example.com", 
                    name="Test User",
                    created_at="2025-01-01T00:00:00Z"
                )
                
        except Exception as e:
            print(f"Error authenticating with Supabase: {e}")
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
            
    except Exception as e:
        print(f"Error in get_current_user: {e}")
        return User(
            id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
            email="test@example.com", 
            name="Test User",
            created_at="2025-01-01T00:00:00Z"
        )

def generate_oauth_state():
    """Generate secure OAuth state"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def encrypt_token(token: str) -> str:
    """Encrypt token for storage"""
    key = os.getenv('ENCRYPTION_KEY')
    if not key:
        raise ValueError("ENCRYPTION_KEY not found")
    
    f = Fernet(key.encode())
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    key = os.getenv('ENCRYPTION_KEY')
    if not key:
        raise ValueError("ENCRYPTION_KEY not found")
    
    f = Fernet(key.encode())
    return f.decrypt(encrypted_token.encode()).decode()

def get_google_credentials_from_token(access_token: str, refresh_token: str = None) -> Credentials:
    """Create Google credentials from stored tokens"""
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
        scopes=GOOGLE_SCOPES
    )
    
    # Try to refresh the token if it's expired
    try:
        if creds.expired and creds.refresh_token:
            print("🔄 Token expired, attempting to refresh...")
            creds.refresh(Request())
            print("✅ Token refreshed successfully")
    except Exception as refresh_error:
        print(f"❌ Token refresh failed: {str(refresh_error)}")
        # Don't raise the error here, let the calling function handle it
    
    return creds

def refresh_and_update_tokens(user_id: str, credentials: Credentials) -> bool:
    """Refresh tokens and update database if successful"""
    try:
        if credentials.expired and credentials.refresh_token:
            print(f"🔄 Refreshing tokens for user: {user_id}")
            credentials.refresh(Request())
            print("✅ Tokens refreshed successfully")
            
            # Update the database with new tokens
            try:
                update_data = {
                    'access_token_encrypted': encrypt_token(credentials.token),
                    'refresh_token_encrypted': encrypt_token(credentials.refresh_token) if credentials.refresh_token else None,
                    'token_expires_at': credentials.expiry.isoformat() if credentials.expiry else None,
                    'updated_at': datetime.now().isoformat()
                }
                # Remove None values to avoid Supabase issues
                update_data = {k: v for k, v in update_data.items() if v is not None}
                
                result = supabase_admin.table('platform_connections').update(update_data).eq('user_id', user_id).eq('platform', 'google').execute()
                print(f"✅ Database updated with new tokens: {result.data}")
            except Exception as db_error:
                print(f"❌ Database update failed: {str(db_error)}")
                print(f"   Update data: {update_data}")
                raise
            
            print("✅ Database updated with new tokens")
            return True
    except Exception as e:
        print(f"❌ Token refresh failed: {str(e)}")
        return False
    
    return True  # Tokens are still valid

@router.get("/auth/initiate")
async def google_auth(current_user: User = Depends(get_current_user)):
    """Initiate Google OAuth flow"""
    try:
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
        
        # Detect environment (localhost vs production)
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        is_localhost = environment == 'development' or 'localhost' in os.getenv('API_BASE_URL', '').lower()
        
        # If GOOGLE_REDIRECT_URI is not set, construct it from API_BASE_URL
        if not redirect_uri:
            api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
            if not api_base_url:
                # Default based on environment
                if is_localhost:
                    api_base_url = 'http://localhost:8000'
                    print(f"🔧 Development mode detected, using localhost:8000")
                else:
                    api_base_url = 'https://agent-emily.onrender.com'
            redirect_uri = f"{api_base_url}/connections/google/callback"
            print(f"⚠️  GOOGLE_REDIRECT_URI not set, using constructed URI: {redirect_uri}")
        
        # Validate redirect URI format - ensure it's a full URL
        if redirect_uri and not (redirect_uri.startswith('http://') or redirect_uri.startswith('https://')):
            print(f"⚠️  Redirect URI doesn't start with http:// or https://: {redirect_uri}")
            # Try to construct full URL if only path is provided
            api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
            if not api_base_url:
                if is_localhost:
                    api_base_url = 'http://localhost:8000'
                else:
                    api_base_url = 'https://agent-emily.onrender.com'
            if redirect_uri.startswith('/'):
                redirect_uri = f"{api_base_url}{redirect_uri}"
                print(f"✅ Constructed full redirect URI: {redirect_uri}")
        
        if not all([client_id, client_secret]):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
            )
        
        # Final validation - redirect URI must be set and valid
        if not redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GOOGLE_REDIRECT_URI is not configured. Please set it in environment variables."
            )
        
        print(f"🔍 OAuth Configuration Check:")
        print(f"   Client ID: {client_id[:20] if client_id else 'NOT SET'}...")
        print(f"   Client Secret: {'SET' if client_secret else 'NOT SET'}")
        print(f"   Redirect URI: {redirect_uri}")
        print(f"   ⚠️  IMPORTANT: This redirect URI MUST exactly match what's in Google Cloud Console!")
        
        # Generate secure state
        state = generate_oauth_state()
        
        # Store state in database for validation
        oauth_state_data = {
            "user_id": current_user.id,
            "platform": "google",
            "state": state,
            "expires_at": (datetime.now() + timedelta(minutes=30)).isoformat()
        }
        
        supabase_admin.table("oauth_states").insert(oauth_state_data).execute()
        
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=GOOGLE_SCOPES
        )
        flow.redirect_uri = redirect_uri
        
        # Generate authorization URL with additional parameters for enterprise accounts
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent',  # Force consent screen to get refresh token
            hd=None  # Allow any hosted domain (can be set to specific domain if needed)
        )
        
        print(f"✅ Google OAuth initiated for user {current_user.id}")
        print(f"   Generated state: {state}")
        print(f"   State expires at: {oauth_state_data['expires_at']}")
        print(f"   🔴 CRITICAL - Redirect URI being sent to Google: {redirect_uri}")
        print(f"   ⚠️  This MUST exactly match Google Cloud Console authorized redirect URIs!")
        print(f"   Client ID: {client_id[:20] if client_id else 'NOT SET'}...")
        print(f"   Scopes: {len(GOOGLE_SCOPES)} scopes requested")
        print(f"   Auth URL (first 150 chars): {auth_url[:150]}...")
        
        # Extract redirect_uri from auth_url to verify it's correct
        import urllib.parse
        parsed_url = urllib.parse.urlparse(auth_url)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        redirect_in_url = query_params.get('redirect_uri', [None])[0]
        if redirect_in_url:
            decoded_redirect = urllib.parse.unquote(redirect_in_url)
            print(f"   🔍 Redirect URI in auth URL: {decoded_redirect}")
            if decoded_redirect != redirect_uri:
                print(f"   ⚠️  WARNING: Redirect URI mismatch!")
                print(f"      Flow has: {redirect_uri}")
                print(f"      URL has:  {decoded_redirect}")
                print(f"   ❌ This mismatch will cause 'unauthorized_client' error!")
        
        # Validate redirect URI format
        if redirect_uri:
            if not redirect_uri.startswith('http://') and not redirect_uri.startswith('https://'):
                logger.warning(f"⚠️  Redirect URI doesn't start with http:// or https://: {redirect_uri}")
            if 'localhost' in redirect_uri and not redirect_uri.startswith('http://localhost'):
                logger.warning(f"⚠️  Localhost redirect URI should use http:// not https://: {redirect_uri}")
        
        return {
            "auth_url": auth_url,
            "state": state,
            "message": "Redirect user to auth_url to complete Google OAuth"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate Google OAuth: {str(e)}"
        )

@router.get("/callback")
async def google_callback(request: FastAPIRequest):
    """Handle Google OAuth callback"""
    # Always read from query params directly to ensure we get them
    query_params = dict(request.query_params)
    code = query_params.get('code')
    state = query_params.get('state')
    error = query_params.get('error')
    
    # Log for debugging
    print(f"🔗 Full request URL: {request.url}")
    print(f"🔗 Query params: {query_params}")
    print(f"🔗 Extracted - code: {code[:20] if code else 'None'}..., state: {state[:20] if state else 'None'}..., error: {error}")
    
    return await handle_google_callback(code, state, error)


async def handle_google_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback"""
    try:
        # Check for OAuth error
        if error:
            # Detect environment for frontend URL
            environment = os.getenv('ENVIRONMENT', 'development').lower()
            is_localhost = environment == 'development' or 'localhost' in os.getenv('FRONTEND_URL', '').lower()
            if is_localhost:
                frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
            else:
                frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
            
            # Log detailed error information for debugging
            redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
            client_id = os.getenv('GOOGLE_CLIENT_ID')
            print(f"❌ Google OAuth Error: {error}")
            print(f"   Redirect URI: {redirect_uri}")
            print(f"   Client ID: {client_id[:20] if client_id else 'NOT SET'}...")
            
            # Provide more helpful error message for unauthorized_client
            error_message = error
            error_details = ""
            
            if "unauthorized_client" in error.lower():
                error_details = f"{error} - This usually means:\n1. The redirect URI doesn't match Google Cloud Console\n2. The OAuth client ID/secret is incorrect\n3. The app is in testing mode and your email isn't added as a test user\n4. For WORK EMAIL: The app may need to be verified by Google or your organization may block unverified apps\n\nCurrent redirect URI: {redirect_uri}\nPlease verify this matches exactly in Google Cloud Console."
            elif "access_denied" in error.lower():
                error_details = f"{error} - Access was denied. This can happen if:\n1. The app is in testing mode and your email isn't added as a test user\n2. For WORK EMAIL: Your organization's admin needs to approve the app\n3. For WORK EMAIL: The app needs to be verified by Google for sensitive scopes (Gmail, Drive, etc.)\n4. You clicked 'Cancel' on the consent screen"
            elif "invalid_scope" in error.lower():
                error_details = f"{error} - Invalid scope requested. For WORK EMAIL accounts, some scopes require app verification. Contact your Google Workspace admin or verify the app in Google Cloud Console."
            
            # URL encode the error message
            import urllib.parse
            encoded_error = urllib.parse.quote(error_details if error_details else error)
            
            return HTMLResponse(content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Connection Failed</title>
                <style>
                    body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }}
                    .error-box {{ background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                    .work-email-note {{ background: #e3f2fd; border: 1px solid #90caf9; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                    h2 {{ color: #c62828; }}
                    ul {{ line-height: 1.8; }}
                </style>
            </head>
            <body>
                <h2>Google Connection Failed</h2>
                <div class="error-box">
                    <p><strong>Error:</strong> {error}</p>
                    {f'<p>{error_details}</p>' if error_details else ''}
                </div>
                <div class="work-email-note">
                    <h3>⚠️ For Work/Enterprise Email Accounts:</h3>
                    <p>If you're using a work email (Google Workspace), you may encounter additional restrictions:</p>
                    <ul>
                        <li><strong>App Verification Required:</strong> Gmail, Drive, and other sensitive scopes require Google to verify your app for enterprise accounts</li>
                        <li><strong>Admin Approval:</strong> Your organization's Google Workspace admin may need to approve the app</li>
                        <li><strong>Domain Restrictions:</strong> Your organization may have policies blocking unverified apps</li>
                    </ul>
                    <p><strong>Solutions:</strong></p>
                    <ul>
                        <li>Ask your Google Workspace admin to approve the app</li>
                        <li>Complete Google's app verification process in Google Cloud Console</li>
                        <li>Use a personal Gmail account for testing (if allowed by your organization)</li>
                    </ul>
                </div>
                <script>
                    window.location.href = '{frontend_url}/google-callback?error={encoded_error}';
                </script>
            </body>
            </html>
            """)
        
        # Check for missing parameters
        if not code or not state:
            # Detect environment for frontend URL
            environment = os.getenv('ENVIRONMENT', 'development').lower()
            is_localhost = environment == 'development' or 'localhost' in os.getenv('FRONTEND_URL', '').lower()
            if is_localhost:
                frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
            else:
                frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
            print(f"Google OAuth callback - Missing parameters: code={code}, state={state}")
            return HTMLResponse(content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Connection Failed</title>
            </head>
            <body>
                <h2>Connection Failed</h2>
                <p>Error: Missing code or state parameter</p>
                <p>Debug: code={code}, state={state}</p>
                <script>
                    window.location.href = '{frontend_url}/google-callback?error=Missing code or state parameter';
                </script>
                <p>You can close this window and try again.</p>
            </body>
            </html>
            """)
        
        # Validate OAuth state
        print(f"🔍 Looking for OAuth state: {state}")
        state_response = supabase_admin.table("oauth_states").select("*").eq("state", state).eq("platform", "google").execute()
        print(f"🔍 State response: {state_response.data}")
        
        if not state_response.data:
            # Check if state exists but expired
            expired_state = supabase_admin.table("oauth_states").select("*").eq("state", state).execute()
            if expired_state.data:
                print(f"🔍 State found but expired: {expired_state.data[0]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state"
            )
        
        # Get the user_id from the state record
        state_record = state_response.data[0]
        user_id = state_record['user_id']
        expires_at = datetime.fromisoformat(state_record['expires_at'].replace('Z', '+00:00'))
        
        # Check if state has expired
        if datetime.now(expires_at.tzinfo) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth state has expired"
            )
        
        # Verify user profile exists (required for foreign key constraint)
        print(f"🔍 Verifying user profile exists for user_id: {user_id}")
        profile_check = supabase_admin.table('profiles').select('id').eq('id', user_id).execute()
        if not profile_check.data:
            print(f"⚠️  Profile not found for user_id: {user_id}, creating profile...")
            try:
                # Create profile if it doesn't exist
                supabase_admin.table('profiles').insert({
                    'id': user_id,
                    'name': None,
                    'onboarding_completed': False
                }).execute()
                print(f"✅ Created profile for user: {user_id}")
            except Exception as profile_error:
                print(f"❌ Error creating profile: {str(profile_error)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"User profile does not exist and could not be created: {str(profile_error)}"
                )
        
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
        
        # Detect environment (localhost vs production)
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        is_localhost = environment == 'development' or 'localhost' in os.getenv('API_BASE_URL', '').lower()
        
        # If GOOGLE_REDIRECT_URI is not set, construct it from API_BASE_URL
        if not redirect_uri:
            api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
            if not api_base_url:
                if is_localhost:
                    api_base_url = 'http://localhost:8000'
                else:
                    api_base_url = 'https://agent-emily.onrender.com'
            redirect_uri = f"{api_base_url}/connections/google/callback"
            logger.info(f"GOOGLE_REDIRECT_URI not set in callback, using constructed URI: {redirect_uri}")
        
        # Validate redirect URI format
        if redirect_uri and not (redirect_uri.startswith('http://') or redirect_uri.startswith('https://')):
            api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
            if not api_base_url:
                if is_localhost:
                    api_base_url = 'http://localhost:8000'
                else:
                    api_base_url = 'https://agent-emily.onrender.com'
            if api_base_url and redirect_uri.startswith('/'):
                redirect_uri = f"{api_base_url}{redirect_uri}"
                logger.info(f"Constructed full redirect URI in callback: {redirect_uri}")
        
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=GOOGLE_SCOPES
        )
        flow.redirect_uri = redirect_uri
        
        # Exchange code for token
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user info
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        # Use the validated user_id from the state, not from Google
        email = user_info.get('email')
        name = user_info.get('name')
        google_user_id = user_info.get('id')
        
        # Check if connection already exists
        existing_connection = supabase_admin.table('platform_connections').select('*').eq('user_id', user_id).eq('platform', 'google').execute()
        
        # Prepare connection data
        now_iso = datetime.now().isoformat()
        token_expires_iso = credentials.expiry.isoformat() if credentials.expiry else None
        
        # Encrypt tokens with validation
        try:
            access_token_enc = encrypt_token(credentials.token)
            if not access_token_enc or len(access_token_enc) == 0:
                raise ValueError("Access token encryption failed - empty result")
            print(f"✅ Access token encrypted (length: {len(access_token_enc)})")
        except Exception as e:
            print(f"❌ Error encrypting access token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to encrypt access token: {str(e)}"
            )
        
        refresh_token_enc = None
        if credentials.refresh_token:
            try:
                refresh_token_enc = encrypt_token(credentials.refresh_token)
                if not refresh_token_enc or len(refresh_token_enc) == 0:
                    print(f"⚠️  Refresh token encryption returned empty, setting to None")
                    refresh_token_enc = None
                else:
                    print(f"✅ Refresh token encrypted (length: {len(refresh_token_enc)})")
            except Exception as e:
                print(f"⚠️  Error encrypting refresh token: {str(e)}, continuing without it")
                refresh_token_enc = None
        
        if existing_connection.data:
            # Update existing connection
            print(f"🔄 Updating existing Google connection for user: {user_id}")
            try:
                update_data = {
                    'access_token_encrypted': access_token_enc,
                    'refresh_token_encrypted': refresh_token_enc,
                    'token_expires_at': token_expires_iso,
                    'updated_at': now_iso,
                    'is_active': True,
                    'connection_status': 'active',
                    'metadata': {
                        'gmail_sync_enabled': True,
                        'gmail_sync_status': 'active'
                    }
                }
                # Only update page_name if name is available
                if name:
                    update_data['page_name'] = name
                
                result = supabase_admin.table('platform_connections').update(update_data).eq('user_id', user_id).eq('platform', 'google').execute()
                print(f"✅ Updated Google connection: {result.data}")
            except Exception as e:
                print(f"❌ Error updating connection: {str(e)}")
                print(f"   Update data: {update_data}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update Google connection: {str(e)}"
                )
        else:
            # Create new connection
            print(f"🆕 Creating new Google connection for user: {user_id}")
            try:
                connection_data = {
                    'user_id': user_id,
                    'platform': 'google',
                    'page_id': google_user_id if google_user_id else None,  # Use Google user ID as page_id
                    'page_name': name if name else None,
                    'access_token_encrypted': access_token_enc,
                    'refresh_token_encrypted': refresh_token_enc,
                    'token_expires_at': token_expires_iso,
                    'is_active': True,
                    'connection_status': 'active',
                    'connected_at': now_iso,
                    'created_at': now_iso,
                    'updated_at': now_iso,
                    'metadata': {
                        'gmail_sync_enabled': True,
                        'gmail_sync_status': 'active'
                    }
                }
                
                # Remove None values to avoid issues
                connection_data = {k: v for k, v in connection_data.items() if v is not None}
                
                print(f"   Connection data keys: {list(connection_data.keys())}")
                result = supabase_admin.table('platform_connections').insert(connection_data).execute()
                print(f"✅ Created Google connection: {result.data}")
            except Exception as e:
                print(f"❌ Error creating connection: {str(e)}")
                print(f"   Connection data: {connection_data}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create Google connection: {str(e)}"
                )
        
        # Clean up used state
        supabase_admin.table("oauth_states").delete().eq("state", state).execute()
        
        # Return HTML page that redirects to frontend
        # Detect environment for frontend URL
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        is_localhost = environment == 'development' or 'localhost' in os.getenv('FRONTEND_URL', '').lower()
        if is_localhost:
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        else:
            frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Google Connection Successful</title>
        </head>
        <body>
            <script>
                // Redirect to frontend callback page
                window.location.href = '{frontend_url}/google-callback?code={code}&state={state}';
            </script>
            <p>Google account connected successfully! Redirecting...</p>
        </body>
        </html>
        """)
        
    except Exception as e:
        # Return HTML page that redirects to frontend with error
        # Detect environment for frontend URL
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        is_localhost = environment == 'development' or 'localhost' in os.getenv('FRONTEND_URL', '').lower()
        if is_localhost:
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        else:
            frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
        error_message = str(e).replace("'", "\\'").replace('"', '\\"')
        
        # Log detailed error for debugging
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        logger.error(f"❌ Google OAuth callback error: {e}")
        logger.error(f"   Redirect URI: {redirect_uri}")
        logger.error(f"   Client ID: {client_id[:20] if client_id else 'NOT SET'}...")
        logger.error(f"   Error type: {type(e).__name__}")
        
        # Provide more specific error messages
        if "Invalid or expired OAuth state" in str(e):
            error_message = "Invalid or expired OAuth state. Please try connecting again."
        elif "access_denied" in str(e).lower():
            error_message = "Access denied. The app may be in testing mode. Please contact the administrator."
        elif "invalid_grant" in str(e).lower():
            error_message = "Invalid authorization code. Please try connecting again."
        elif "unauthorized_client" in str(e).lower():
            error_message = f"Unauthorized client. Please verify: 1) Redirect URI matches Google Cloud Console exactly, 2) OAuth client credentials are correct, 3) Your email is added as a test user if app is in testing mode. Current redirect URI: {redirect_uri}"
        elif "redirect_uri_mismatch" in str(e).lower():
            error_message = f"Redirect URI mismatch. The redirect URI ({redirect_uri}) must exactly match what's configured in Google Cloud Console."
        
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Google Connection Failed</title>
        </head>
        <body>
            <script>
                // Redirect to frontend callback page with error
                window.location.href = '{frontend_url}/google-callback?error={error_message}';
            </script>
            <p>Google connection failed: {error_message}</p>
        </body>
        </html>
        """)

@router.get("/gmail/messages")
async def get_gmail_messages(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Gmail messages"""
    try:
        print(f"🔍 Getting Gmail messages for user: {current_user.id}")
        
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        print(f"🔍 Connection query result: {len(connection.data) if connection.data else 0} connections found")
        
        if not connection.data:
            print("❌ No active Google connection found")
            return {"messages": [], "error": "No active Google connection found"}
        
        conn = connection.data[0]

        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None

        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)

        # Check if access token needs refresh and handle it
        try:
            # Test if token works by making a small API call
            test_service = build('gmail', 'v1', credentials=credentials)
            # This will trigger token refresh if needed
            test_call = test_service.users().getProfile(userId='me').execute()

            # If token was refreshed, save the new access token
            if hasattr(credentials, 'token') and credentials.token != access_token:
                print(f"🔄 Access token refreshed for user {current_user.id}")
                # Encrypt and save new access token
                encrypted_new_token = encrypt_token(credentials.token)
                supabase_admin.table('platform_connections').update({
                    'access_token_encrypted': encrypted_new_token,
                    'last_token_refresh': datetime.now().isoformat()
                }).eq('id', conn['id']).execute()

        except Exception as token_error:
            print(f"⚠️ Token refresh needed for user {current_user.id}: {token_error}")
            # Try to refresh the token manually
            try:
                from google.auth.transport.requests import Request as GoogleRequest
                credentials.refresh(GoogleRequest())

                # Save the refreshed token
                encrypted_new_token = encrypt_token(credentials.token)
                supabase_admin.table('platform_connections').update({
                    'access_token_encrypted': encrypted_new_token,
                    'last_token_refresh': datetime.now().isoformat()
                }).eq('id', conn['id']).execute()

                print(f"✅ Token manually refreshed for user {current_user.id}")

            except Exception as refresh_error:
                print(f"❌ Failed to refresh token for user {current_user.id}: {refresh_error}")
                return {"messages": [], "error": f"Token refresh failed: {str(refresh_error)}"}

        # Build Gmail service with refreshed credentials
        service = build('gmail', 'v1', credentials=credentials)

        # Get messages
        print(f"🔍 Fetching Gmail messages with limit: {limit}")
        try:
            results = service.users().messages().list(userId='me', maxResults=limit).execute()
            print(f"📧 Gmail API response: {results}")
            messages = results.get('messages', [])
            print(f"📧 Found {len(messages)} messages from Gmail API")
        except Exception as gmail_error:
            print(f"❌ Gmail API error: {str(gmail_error)}")
            print(f"❌ Error type: {type(gmail_error).__name__}")
            raise gmail_error
        
        # Get detailed message info
        detailed_messages = []
        print(f"🔍 Processing {len(messages)} messages...")
        for i, message in enumerate(messages):
            try:
                print(f"📧 Processing message {i+1}/{len(messages)}: {message['id']}")
                msg = service.users().messages().get(userId='me', id=message['id']).execute()
                payload = msg['payload']
                headers = payload.get('headers', [])
                
                # Extract subject and sender
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
                date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
                
                message_data = {
                    'id': message['id'],
                    'subject': subject,
                    'sender': sender,
                    'date': date,
                    'snippet': msg.get('snippet', '')
                }
                detailed_messages.append(message_data)
                print(f"✅ Processed message: {subject[:50]}...")
            except Exception as msg_error:
                print(f"❌ Error processing message {message['id']}: {str(msg_error)}")
                continue
        
        print(f"✅ Returning {len(detailed_messages)} detailed messages")
        return {"messages": detailed_messages}
        
    except Exception as e:
        print(f"❌ Error fetching Gmail messages: {str(e)}")
        return {"messages": [], "error": f"Failed to fetch Gmail messages: {str(e)}"}

@router.get("/drive/files")
async def get_drive_files(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Google Drive files"""
    try:
        print(f"🔍 Getting Drive files for user: {current_user.id}")
        
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
            print("❌ No active Google connection found for Drive files")
            return {"files": [], "error": "No active Google connection found"}
        
        conn = connection.data[0]
        
        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None
        
        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)
        
        # Build Drive service
        service = build('drive', 'v3', credentials=credentials)
        
        # Get files
        print(f"🔍 Fetching Drive files with limit: {limit}")
        results = service.files().list(
            pageSize=limit,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()
        files = results.get('files', [])
        print(f"📁 Found {len(files)} Drive files")
        
        return {"files": files}
        
    except Exception as e:
        print(f"❌ Error fetching Drive files: {str(e)}")
        return {"files": [], "error": f"Failed to fetch Drive files: {str(e)}"}

@router.get("/sheets/spreadsheets")
async def get_sheets_spreadsheets(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Google Sheets spreadsheets"""
    try:
        print(f"🔍 Getting Sheets for user: {current_user.id}")
        
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
            print("❌ No active Google connection found for Sheets")
            return {"spreadsheets": [], "error": "No active Google connection found"}
        
        conn = connection.data[0]
        
        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None
        
        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)
        
        # Build Drive service to find Sheets files
        service = build('drive', 'v3', credentials=credentials)
        
        # Search for Google Sheets files
        print(f"🔍 Fetching Sheets with limit: {limit}")
        results = service.files().list(
            q="mimeType='application/vnd.google-apps.spreadsheet'",
            pageSize=limit,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()
        spreadsheets = results.get('files', [])
        print(f"📊 Found {len(spreadsheets)} Sheets")
        
        return {"spreadsheets": spreadsheets}
        
    except Exception as e:
        print(f"❌ Error fetching Sheets: {str(e)}")
        return {"spreadsheets": [], "error": f"Failed to fetch Sheets: {str(e)}"}

@router.get("/docs/documents")
async def get_docs_documents(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Google Docs documents"""
    try:
        print(f"🔍 Getting Docs for user: {current_user.id}")
        
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
            print("❌ No active Google connection found for Docs")
            return {"documents": [], "error": "No active Google connection found"}
        
        conn = connection.data[0]
        
        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None
        
        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)
        
        # Build Drive service to find Docs files
        service = build('drive', 'v3', credentials=credentials)
        
        # Search for Google Docs files
        print(f"🔍 Fetching Docs with limit: {limit}")
        results = service.files().list(
            q="mimeType='application/vnd.google-apps.document'",
            pageSize=limit,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()
        documents = results.get('files', [])
        print(f"📄 Found {len(documents)} Docs")
        
        return {"documents": documents}
        
    except Exception as e:
        print(f"❌ Error fetching Docs: {str(e)}")
        return {"documents": [], "error": f"Failed to fetch Docs: {str(e)}"}

@router.post("/gmail/send")
async def send_gmail_message(
    to: str,
    subject: str,
    body: str,
    current_user: User = Depends(get_current_user)
):
    """Send Gmail message"""
    try:
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Google connection found"
            )
        
        conn = connection.data[0]

        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None

        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)

        # Check if access token needs refresh and handle it
        try:
            # Test if token works by making a small API call
            test_service = build('gmail', 'v1', credentials=credentials)
            # This will trigger token refresh if needed
            test_call = test_service.users().getProfile(userId='me').execute()

            # If token was refreshed, save the new access token
            if hasattr(credentials, 'token') and credentials.token != access_token:
                logger.info(f"🔄 Access token refreshed for user {current_user.id}")
                # Encrypt and save new access token
                encrypted_new_token = encrypt_token(credentials.token)
                supabase_admin.table('platform_connections').update({
                    'access_token_encrypted': encrypted_new_token,
                    'last_token_refresh': datetime.now().isoformat()
                }).eq('id', conn['id']).execute()

        except Exception as token_error:
            logger.warning(f"⚠️ Token refresh needed for user {current_user.id}: {token_error}")
            # Try to refresh the token manually
            try:
                from google.auth.transport.requests import Request as GoogleRequest
                credentials.refresh(GoogleRequest())

                # Save the refreshed token
                encrypted_new_token = encrypt_token(credentials.token)
                supabase_admin.table('platform_connections').update({
                    'access_token_encrypted': encrypted_new_token,
                    'last_token_refresh': datetime.now().isoformat()
                }).eq('id', conn['id']).execute()

                logger.info(f"✅ Token manually refreshed for user {current_user.id}")

            except Exception as refresh_error:
                logger.error(f"❌ Failed to refresh token for user {current_user.id}: {refresh_error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Token refresh failed: {str(refresh_error)}"
                )

        # Build Gmail service with refreshed credentials
        service = build('gmail', 'v1', credentials=credentials)
        
        # Create proper HTML email message
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import re
        
        # Check if body contains HTML tags (comprehensive check)
        html_pattern = re.compile(r'<[^>]+>')
        has_html_tags = bool(html_pattern.search(body))
        
        print(f"📧 Email body contains HTML: {has_html_tags}")
        print(f"📧 Body preview: {body[:200]}...")
        
        # Create multipart message
        msg = MIMEMultipart('alternative')
        msg['To'] = to
        msg['Subject'] = subject
        msg['MIME-Version'] = '1.0'
        
        if has_html_tags:
            print("📧 Creating HTML email with multipart structure")
            
            # For multipart/alternative, order matters:
            # 1. Plain text first (for clients that don't support HTML)
            # 2. HTML second (for clients that support HTML - they'll prefer this)
            
            # Create plain text version (strip HTML tags for fallback)
            plain_text = re.sub(r'<[^>]+>', '', body)  # Remove HTML tags
            # Decode HTML entities
            plain_text = plain_text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
            plain_text = plain_text.replace('&quot;', '"').replace('&#39;', "'")
            # Clean up extra whitespace
            plain_text = re.sub(r'\n\s*\n+', '\n\n', plain_text).strip()
            
            # Attach plain text part first
            text_part = MIMEText(plain_text, 'plain', 'utf-8')
            text_part.add_header('Content-Type', 'text/plain; charset=utf-8')
            msg.attach(text_part)
            print(f"📧 Plain text part: {plain_text[:100]}...")
            
            # Wrap HTML in proper document structure if not already wrapped
            # Some email clients require full HTML document structure
            if not body.strip().lower().startswith('<!doctype') and not body.strip().lower().startswith('<html'):
                html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
{body}
</body>
</html>"""
            else:
                html_body = body
            
            # Attach HTML part second (email clients will use this if they support HTML)
            # Explicitly set Content-Type to ensure it's recognized as HTML
            html_part = MIMEText(html_body, 'html', 'utf-8')
            html_part.add_header('Content-Type', 'text/html; charset=utf-8')
            msg.attach(html_part)
            print("📧 HTML part attached with proper document structure and Content-Type header")
        else:
            print("📧 Creating plain text email")
            # Plain text email only
            text_part = MIMEText(body, 'plain', 'utf-8')
            msg.attach(text_part)
        
        # Encode message properly for Gmail API
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        print(f"📧 Message encoded, length: {len(raw_message)}")
        
        # Create message dict
        message = {'raw': raw_message}
        
        # Send message
        result = service.users().messages().send(userId='me', body=message).execute()
        
        return {
            "success": True,
            "message_id": result['id'],
            "message": "Email sent successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )

@router.get("/gmail/test")
async def test_gmail_api(current_user: User = Depends(get_current_user)):
    """Test Gmail API access"""
    try:
        print(f"🧪 Testing Gmail API for user: {current_user.id}")
        
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
            return {"success": False, "error": "No active Google connection found"}
        
        conn = connection.data[0]
        
        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None
        
        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)
        
        # Try to refresh tokens if needed
        if not refresh_and_update_tokens(current_user.id, credentials):
            return {
                "success": False,
                "error": "Token refresh failed. Please re-authenticate your Google account.",
                "error_type": "TokenRefreshError"
            }
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)
        
        # Test basic Gmail API access
        print("🧪 Testing Gmail profile access...")
        profile = service.users().getProfile(userId='me').execute()
        print(f"✅ Gmail profile: {profile}")
        
        # Test message list access
        print("🧪 Testing Gmail messages list...")
        results = service.users().messages().list(userId='me', maxResults=1).execute()
        print(f"✅ Gmail messages list: {results}")
        
        return {
            "success": True,
            "profile": profile,
            "message_count": results.get('resultSizeEstimate', 0),
            "messages": results.get('messages', [])
        }
        
    except Exception as e:
        print(f"❌ Gmail API test error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }

@router.post("/reconnect")
async def reconnect_google_account(current_user: User = Depends(get_current_user)):
    """Reconnect Google account when tokens are invalid"""
    try:
        print(f"🔄 Reconnecting Google account for user: {current_user.id}")
        
        # Mark current connection as inactive
        try:
            update_result = supabase_admin.table('platform_connections').update({
                'is_active': False,
                'connection_status': 'reconnect_required',
                'updated_at': datetime.now().isoformat()
            }).eq('platform', 'google').eq('user_id', current_user.id).execute()
            print(f"✅ Marked existing connection as inactive: {update_result.data}")
        except Exception as update_error:
            print(f"⚠️  Warning: Could not mark connection as inactive (may not exist): {str(update_error)}")
            # Continue anyway - connection might not exist yet
        
        # Generate new OAuth URL
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
        
        # Detect environment (localhost vs production)
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        is_localhost = environment == 'development' or 'localhost' in os.getenv('API_BASE_URL', '').lower()
        
        # If GOOGLE_REDIRECT_URI is not set, construct it from API_BASE_URL
        if not redirect_uri:
            api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
            if not api_base_url:
                if is_localhost:
                    api_base_url = 'http://localhost:8000'
                else:
                    api_base_url = 'https://agent-emily.onrender.com'
            redirect_uri = f"{api_base_url}/connections/google/callback"
            logger.info(f"GOOGLE_REDIRECT_URI not set in reconnect, using constructed URI: {redirect_uri}")
        
        # Validate redirect URI format
        if redirect_uri and not (redirect_uri.startswith('http://') or redirect_uri.startswith('https://')):
            api_base_url = os.getenv('API_BASE_URL', '').rstrip('/')
            if not api_base_url:
                if is_localhost:
                    api_base_url = 'http://localhost:8000'
                else:
                    api_base_url = 'https://agent-emily.onrender.com'
            if api_base_url and redirect_uri.startswith('/'):
                redirect_uri = f"{api_base_url}{redirect_uri}"
                logger.info(f"Constructed full redirect URI in reconnect: {redirect_uri}")
        
        if not all([client_id, client_secret, redirect_uri]):
            return {
                "success": False,
                "error": "Google OAuth not configured"
            }
        
        # Generate secure state
        state = generate_oauth_state()
        
        # Store state in database for validation
        oauth_state_data = {
            "user_id": current_user.id,
            "platform": "google",
            "state": state,
            "expires_at": (datetime.now() + timedelta(minutes=30)).isoformat()
        }
        
        supabase_admin.table("oauth_states").insert(oauth_state_data).execute()
        
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=GOOGLE_SCOPES
        )
        flow.redirect_uri = redirect_uri
        
        # Generate authorization URL with additional parameters for enterprise accounts
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent',  # Force consent screen to get refresh token
            hd=None  # Allow any hosted domain (can be set to specific domain if needed)
        )
        
        return {
            "success": True,
            "auth_url": auth_url,
            "state": state,
            "message": "Please re-authenticate your Google account"
        }
        
    except Exception as e:
        print(f"❌ Error reconnecting Google account: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to reconnect: {str(e)}"
        }

@router.get("/connection-status")
async def get_connection_status(current_user: User = Depends(get_current_user)):
    """Check Google connection status"""
    try:
        print(f"🔍 Checking connection status for user: {current_user.id}")
        
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
            return {
                "connected": False,
                "error": "No active Google connection found",
                "user_id": current_user.id
            }
        
        conn = connection.data[0]
        return {
            "connected": True,
            "user_id": current_user.id,
            "connection_id": conn.get('id'),
            "page_name": conn.get('page_name'),
            "connected_at": conn.get('connected_at'),
            "connection_status": conn.get('connection_status')
        }
        
    except Exception as e:
        return {
            "connected": False,
            "error": f"Error checking connection: {str(e)}",
            "user_id": current_user.id
        }

@router.get("/health")
async def google_router_health():
    """Health check for Google router"""
    return {
        "status": "healthy",
        "router": "google_connections",
        "message": "Google connections router is working"
    }

@router.get("/test")
async def google_router_test():
    """Test endpoint to verify Google router is accessible"""
    return {
        "message": "Google router is working!",
        "endpoints": [
            "/connections/google/health",
            "/connections/google/debug/config",
            "/connections/google/auth/initiate",
            "/connections/google/callback"
        ]
    }

async def sync_gmail_inbox_for_user(
    user_id: str,
    user_email: str,
    days_back: int = 2,
    max_emails: int = 50
) -> Dict[str, Any]:
    """Sync Gmail inbox for a specific user (used by both API and background job)"""
    try:
        logger.info(f"🔄 Starting Gmail inbox sync for user: {user_id}")

        # Get user's Google connection
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', user_id).execute()

        if not connection.data:
            return {
                "success": False,
                "error": "No active Google connection found",
                "emails_processed": 0,
                "emails_stored": 0
            }

        conn = connection.data[0]

        # Check if Gmail sync is enabled for this user
        metadata = conn.get('metadata') or {}
        # Default to False for production safety
        gmail_sync_enabled = metadata.get('gmail_sync_enabled', False)
        if not gmail_sync_enabled:
            logger.info(f"📧 Gmail sync not enabled for user {user_id}")
            return {
                "success": False,
                "error": "Gmail sync not enabled for this user",
                "emails_processed": 0,
                "emails_stored": 0
            }

        # Decrypt tokens
        access_token = decrypt_token(conn['access_token_encrypted'])
        refresh_token = decrypt_token(conn['refresh_token_encrypted']) if conn.get('refresh_token_encrypted') else None

        # Create credentials
        credentials = get_google_credentials_from_token(access_token, refresh_token)

        # Check if access token needs refresh and handle it
        try:
            # Test if token works by making a small API call
            test_service = build('gmail', 'v1', credentials=credentials)
            # This will trigger token refresh if needed
            test_call = test_service.users().getProfile(userId='me').execute()

            # If token was refreshed, save the new access token
            if hasattr(credentials, 'token') and credentials.token != access_token:
                logger.info(f"🔄 Access token refreshed for user {user_id}")
                # Encrypt and save new access token
                encrypted_new_token = encrypt_token(credentials.token)
                supabase_admin.table('platform_connections').update({
                    'access_token_encrypted': encrypted_new_token,
                    'last_token_refresh': datetime.now().isoformat()
                }).eq('id', conn['id']).execute()

        except Exception as token_error:
            error_str = str(token_error).lower()
            logger.warning(f"⚠️ Token validation failed for user {user_id}: {token_error}")

            # Check if this is a 401 Unauthorized error
            if '401' in error_str or 'unauthorized' in error_str or 'invalid_grant' in error_str:
                logger.error(f"🚫 401 Unauthorized error for user {user_id} - token likely expired or invalid")

                # Debug: Check OAuth credentials
                debug_client_id = os.getenv('GOOGLE_CLIENT_ID')
                debug_client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
                logger.info(f"🔍 OAuth Debug - Client ID: {debug_client_id[:20] if debug_client_id else 'NOT SET'}...")
                logger.info(f"🔍 OAuth Debug - Client Secret: {'SET' if debug_client_secret else 'NOT SET'}")
                logger.info(f"🔍 OAuth Debug - Redirect URI: {os.getenv('GOOGLE_REDIRECT_URI', 'NOT SET')}")

                # Try to refresh the token manually if refresh token exists
                if refresh_token:
                    try:
                        from google.auth.transport.requests import Request as GoogleRequest
                        credentials.refresh(GoogleRequest())

                        # Save the refreshed token
                        encrypted_new_token = encrypt_token(credentials.token)
                        supabase_admin.table('platform_connections').update({
                            'access_token_encrypted': encrypted_new_token,
                            'last_token_refresh': datetime.now().isoformat()
                        }).eq('id', conn['id']).execute()

                        logger.info(f"✅ Token manually refreshed for user {user_id}")

                    except Exception as refresh_error:
                        refresh_error_str = str(refresh_error).lower()
                        logger.error(f"❌ Failed to refresh token for user {user_id}: {refresh_error}")

                        # If refresh token is invalid, mark connection as inactive
                        if 'invalid_grant' in refresh_error_str or '401' in refresh_error_str:
                            logger.error(f"🚫 Refresh token invalid for user {user_id} - deactivating connection")
                            supabase_admin.table('platform_connections').update({
                                'is_active': False,
                                'metadata': {
                                    **metadata,
                                    'deactivation_reason': 'Invalid refresh token',
                                    'deactivated_at': datetime.now().isoformat()
                                }
                            }).eq('id', conn['id']).execute()

                        return {
                            "success": False,
                            "error": f"Token refresh failed: {str(refresh_error)}",
                            "emails_processed": 0,
                            "emails_stored": 0
                        }
                else:
                    logger.error(f"🚫 No refresh token available for user {user_id}")
                    # Deactivate connection since we can't refresh without refresh token
                    supabase_admin.table('platform_connections').update({
                        'is_active': False,
                        'metadata': {
                            **metadata,
                            'deactivation_reason': 'No refresh token available',
                            'deactivated_at': datetime.now().isoformat()
                        }
                    }).eq('id', conn['id']).execute()

                    return {
                        "success": False,
                        "error": "No refresh token available and access token expired",
                        "emails_processed": 0,
                        "emails_stored": 0
                    }
            else:
                # For other token errors, continue and try to use the service anyway
                logger.warning(f"⚠️ Non-401 token error for user {user_id}, proceeding: {token_error}")

        # Build Gmail service with refreshed credentials
        service = build('gmail', 'v1', credentials=credentials)

        # User email is passed as parameter (from JWT token)

        # Calculate date filter (emails from the last N days)
        days_ago = datetime.now() - timedelta(days=days_back)
        date_filter = days_ago.strftime('%Y/%m/%d')

        # Query for inbound emails (exclude sent emails)
        query = f"after:{date_filter}"
        if user_email:
            query += f" -from:{user_email}"
        logger.info(f"📧 Gmail query for user {user_id}: {query}")
        logger.info(f"📧 Searching for emails from last {days_back} days, excluding emails from {user_email}")

        # Get messages
        try:
            results = service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_emails
            ).execute()
        except Exception as api_error:
            error_str = str(api_error).lower()
            if '401' in error_str or 'unauthorized' in error_str:
                logger.error(f"🚫 401 error during Gmail API call for user {user_id}: {api_error}")
                # Mark connection as inactive due to auth issues
                supabase_admin.table('platform_connections').update({
                    'is_active': False,
                    'metadata': {
                        **metadata,
                        'deactivation_reason': '401 during API call',
                        'deactivated_at': datetime.now().isoformat()
                    }
                }).eq('id', conn['id']).execute()
                return {
                    "success": False,
                    "error": f"Gmail API authentication failed: {str(api_error)}",
                    "emails_processed": 0,
                    "emails_stored": 0
                }
            else:
                raise api_error

        messages = results.get('messages', [])
        logger.info(f"📧 Found {len(messages)} inbound emails to process for user {user_id}")

        # Get user's leads for email matching
        leads_result = supabase_admin.table('leads').select('id, email, name').eq('user_id', user_id).execute()
        user_leads = leads_result.data or []
        lead_emails = [lead['email'] for lead in user_leads if lead.get('email')]
        logger.info(f"📧 User has {len(user_leads)} leads with {len(lead_emails)} email addresses: {lead_emails[:5]}{'...' if len(lead_emails) > 5 else ''}")

        processed_count = 0
        stored_count = 0

        # Process each message
        for message in messages:
            try:
                # Get full message details
                try:
                    msg = service.users().messages().get(
                        userId='me',
                        id=message['id'],
                        format='full'
                    ).execute()
                except Exception as msg_api_error:
                    error_str = str(msg_api_error).lower()
                    if '401' in error_str or 'unauthorized' in error_str:
                        logger.error(f"🚫 401 error getting message {message['id']} for user {user_id}: {msg_api_error}")
                        # Stop processing this user due to auth issues
                        supabase_admin.table('platform_connections').update({
                            'is_active': False,
                            'metadata': {
                                **metadata,
                                'deactivation_reason': '401 during message retrieval',
                                'deactivated_at': datetime.now().isoformat()
                            }
                        }).eq('id', conn['id']).execute()
                        return {
                            "success": False,
                            "error": f"Gmail API authentication failed during message retrieval: {str(msg_api_error)}",
                            "emails_processed": processed_count,
                            "emails_stored": stored_count
                        }
                    else:
                        logger.warning(f"⚠️ Error getting message {message['id']} for user {user_id}: {msg_api_error}")
                        continue

                # Extract email data
                email_data = extract_email_data(msg)
                if not email_data:
                    continue

                # Check if this email is from a lead
                lead = find_lead_by_email(email_data['from'], user_id)
                if not lead:
                    logger.info(f"📧 Email from '{email_data['from']}' not associated with any lead for user {user_id}, skipping. Subject: '{email_data.get('subject', 'No subject')}'")
                    continue

                # Check if this email is already stored (avoid duplicates)
                # Check both by message_id and by lead_id + message_id combination
                existing_conversation = supabase_admin.table('lead_conversations').select('id').eq('lead_id', lead['id']).eq('message_id', message['id']).execute()
                if existing_conversation.data:
                    logger.debug(f"📧 Email {message['id']} already stored for lead {lead['id']}, skipping")
                    continue

                # Store email in lead conversations
                conversation_data = {
                    'lead_id': lead['id'],
                    'message_type': 'email',
                    'content': email_data['body'],
                    'sender': email_data['from'],
                    'direction': 'inbound',
                    'message_id': message['id'],
                    'status': 'received',
                    'metadata': {
                        'subject': email_data['subject'],
                        'thread_id': msg.get('threadId'),
                        'labels': msg.get('labelIds', []),
                        'date': email_data['date'],
                        'to': email_data.get('to', []),
                        'cc': email_data.get('cc', []),
                        'bcc': email_data.get('bcc', [])
                    }
                }

                supabase_admin.table('lead_conversations').insert(conversation_data).execute()
                stored_count += 1
                logger.info(f"📧 Stored email from {email_data['from']} for lead {lead['id']} (user {user_id})")

            except Exception as msg_error:
                logger.error(f"❌ Error processing message {message['id']} for user {user_id}: {msg_error}")
                continue

            processed_count += 1

        # Update last sync timestamp
        supabase_admin.table("platform_connections").update({
            'metadata': {
                **metadata,
                'gmail_last_sync': datetime.now().isoformat(),
                'gmail_sync_status': 'completed'
            }
        }).eq('id', conn['id']).execute()

        logger.info(f"✅ Gmail inbox sync completed for user {user_id}: {processed_count} processed, {stored_count} stored")

        return {
            "success": True,
            "emails_processed": processed_count,
            "emails_stored": stored_count,
            "total_emails_found": len(messages)
        }

    except Exception as e:
        logger.error(f"❌ Error syncing Gmail inbox for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "emails_processed": 0,
            "emails_stored": 0
        }

@router.post("/gmail/sync-inbox")
async def sync_gmail_inbox(
    days_back: int = 2,
    max_emails: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Sync Gmail inbox and store inbound emails in lead conversations"""
    result = await sync_gmail_inbox_for_user(current_user.id, current_user.email, days_back, max_emails)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Failed to sync Gmail inbox")
        )

    return {
        "success": True,
        "message": f"Gmail inbox sync completed successfully",
        "stats": {
            "emails_processed": result["emails_processed"],
            "emails_stored": result["emails_stored"],
            "total_emails_found": result["total_emails_found"]
        }
    }

def extract_email_data(message):
    """Extract email data from Gmail API message"""
    try:
        payload = message['payload']
        headers = payload['headers']

        # Extract headers
        subject = ''
        sender = ''
        to = []
        cc = []
        bcc = []
        date = ''

        for header in headers:
            name = header['name'].lower()
            value = header['value']

            if name == 'subject':
                subject = value
            elif name == 'from':
                sender = value
            elif name == 'to':
                to = [email.strip() for email in value.split(',')]
            elif name == 'cc':
                cc = [email.strip() for email in value.split(',')]
            elif name == 'bcc':
                bcc = [email.strip() for email in value.split(',')]
            elif name == 'date':
                date = value

        # Extract email body
        body = get_email_body(payload)

        # Extract sender email (remove name part if present)
        import re
        email_match = re.search(r'<([^>]+)>', sender)
        if email_match:
            sender_email = email_match.group(1)
        else:
            sender_email = sender.strip()

        return {
            'subject': subject,
            'from': sender_email,
            'to': to,
            'cc': cc,
            'bcc': bcc,
            'body': body,
            'date': date
        }

    except Exception as e:
        logger.error(f"❌ Error extracting email data: {e}")
        return None

def get_email_body(payload):
    """Extract email body from Gmail payload and remove quoted content"""
    try:
        body_text = ""

        if 'parts' in payload:
            # Multipart message
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    if 'data' in part['body']:
                        body_text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
                elif part['mimeType'] == 'text/html':
                    if 'data' in part['body']:
                        body_text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
        else:
            # Single part message
            if 'data' in payload['body']:
                body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')

        if not body_text or body_text == "No content available":
            return "No content available"

        # Remove quoted content (email replies)
        # Common patterns for quoted content:
        # 1. Lines starting with ">"
        # 2. "On [date] [person] wrote:"
        # 3. "-----Original Message-----"

        import re

        # Split by lines and find the first quoted content marker
        lines = body_text.split('\n')
        clean_lines = []

        for i, line in enumerate(lines):
            # Stop if we encounter quoted content markers
            if line.strip().startswith('>') or \
               re.search(r'^On\s+.*wrote:', line.strip()) or \
               '-----Original Message-----' in line or \
               '----- Forwarded Message -----' in line or \
               re.search(r'^From:\s+', line.strip()) and i > 0:  # Additional headers in replies
                break

            # Skip empty lines at the beginning
            if not line.strip() and len(clean_lines) == 0:
                continue

            clean_lines.append(line)

        # Join the clean lines
        clean_body = '\n'.join(clean_lines).strip()

        # If we ended up with empty content, return the original (might not have quoted content)
        if not clean_body:
            clean_body = body_text.strip()

        # Log the cleaned content for debugging (first 200 chars)
        logger.debug(f"📧 Cleaned email content: {clean_body[:200]}{'...' if len(clean_body) > 200 else ''}")

        return clean_body

    except Exception as e:
        logger.error(f"❌ Error extracting email body: {e}")
        return "Error extracting content"

def find_lead_by_email(email, user_id):
    """Find a lead by email address"""
    try:
        # Search for lead with matching email
        lead = supabase_admin.table('leads').select('*').eq('user_id', user_id).eq('email', email).execute()

        if lead.data:
            return lead.data[0]

        # Also check if email is in lead metadata or additional emails
        leads = supabase_admin.table('leads').select('*').eq('user_id', user_id).execute()

        for lead in leads.data or []:
            # Check metadata for additional emails
            if lead.get('metadata'):
                metadata = lead['metadata']
                if isinstance(metadata, dict):
                    additional_emails = metadata.get('additional_emails', [])
                    if email in additional_emails:
                        return lead

        return None

    except Exception as e:
        logger.error(f"❌ Error finding lead by email {email}: {e}")
        return None

@router.get("/gmail/sync-status")
async def get_gmail_sync_status(current_user: User = Depends(get_current_user)):
    """Get Gmail sync status and last sync time"""
    try:
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()

        if not connection.data:
            return {
                "connected": False,
                "sync_enabled": False,
                "last_sync": None,
                "status": "not_connected"
            }

        conn = connection.data[0]
        metadata = conn.get('metadata')

        # Handle case where metadata column doesn't exist yet
        if metadata is None:
            return {
                "connected": True,
                "sync_enabled": False,
                "last_sync": None,
                "status": "migration_needed",
                "message": "Run setup_gmail_sync.sql in Supabase SQL editor to enable Gmail sync"
            }

        return {
            "connected": True,
            "sync_enabled": metadata.get('gmail_sync_enabled', False),
            "last_sync": metadata.get('gmail_last_sync'),
            "status": metadata.get('gmail_sync_status', 'never_synced')
        }

    except Exception as e:
        logger.error(f"❌ Error getting Gmail sync status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync status: {str(e)}"
        )

@router.post("/gmail/test-sync")
async def test_gmail_sync(current_user: User = Depends(get_current_user)):
    """Manually trigger Gmail sync for testing (bypasses rate limiting)"""
    try:
        logger.info(f"🧪 Manual Gmail sync test triggered for user {current_user.id}")

        # Force sync regardless of rate limiting
        result = await sync_gmail_inbox_for_user(
            user_id=current_user.id,
            user_email=current_user.email,
            days_back=2,  # Check last 2 days
            max_emails=10  # Max 10 emails for testing
        )

        return {
            "success": result["success"],
            "message": f"Test sync completed: {result['emails_processed']} emails processed, {result['emails_stored']} emails stored",
            "stats": result
        }

    except Exception as e:
        logger.error(f"❌ Error in manual Gmail sync test: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test sync failed: {str(e)}"
        )

@router.post("/gmail/sync/enable")
async def enable_gmail_sync(current_user: User = Depends(get_current_user)):
    """Enable automatic Gmail sync for the user"""
    try:
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()

        if not connection.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Google connection found"
            )

        conn = connection.data[0]
        metadata = conn.get('metadata') or {}

        # Update metadata to enable sync
        updated_metadata = {
            **metadata,
            'gmail_sync_enabled': True
        }

        # Handle case where metadata column doesn't exist yet
        try:
            supabase_admin.table('platform_connections').update({
                'metadata': updated_metadata
            }).eq('id', conn['id']).execute()
        except Exception as e:
            if "does not exist" in str(e):
                logger.warning(f"📧 metadata column doesn't exist yet, skipping enable sync for user {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database migration needed: Run setup_gmail_sync.sql in Supabase SQL editor first"
                )
            else:
                raise e

        supabase_admin.table('platform_connections').update({
            'metadata': updated_metadata
        }).eq('id', conn['id']).execute()

        logger.info(f"✅ Enabled Gmail sync for user {current_user.id}")

        return {
            "success": True,
            "message": "Gmail sync enabled successfully",
            "sync_enabled": True
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error enabling Gmail sync for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable Gmail sync: {str(e)}"
        )

@router.post("/gmail/sync/disable")
async def disable_gmail_sync(current_user: User = Depends(get_current_user)):
    """Disable automatic Gmail sync for the user"""
    try:
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()

        if not connection.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Google connection found"
            )

        conn = connection.data[0]
        metadata = conn.get('metadata') or {}

        # Update metadata to disable sync
        updated_metadata = {
            **metadata,
            'gmail_sync_enabled': False
        }

        # Handle case where metadata column doesn't exist yet
        try:
            supabase_admin.table('platform_connections').update({
                'metadata': updated_metadata
            }).eq('id', conn['id']).execute()
        except Exception as e:
            if "does not exist" in str(e):
                logger.warning(f"📧 metadata column doesn't exist yet, skipping disable sync for user {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database migration needed: Run setup_gmail_sync.sql in Supabase SQL editor first"
                )
            else:
                raise e

        logger.info(f"✅ Disabled Gmail sync for user {current_user.id}")

        return {
            "success": True,
            "message": "Gmail sync disabled successfully",
            "sync_enabled": False
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error disabling Gmail sync for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable Gmail sync: {str(e)}"
        )

@router.get("/debug/config")
async def debug_google_config():
    """Debug endpoint to check Google OAuth configuration"""
    return {
        "client_id": "SET" if os.getenv('GOOGLE_CLIENT_ID') else "MISSING",
        "client_secret": "SET" if os.getenv('GOOGLE_CLIENT_SECRET') else "MISSING",
        "redirect_uri": os.getenv('GOOGLE_REDIRECT_URI'),
        "frontend_url": os.getenv('FRONTEND_URL'),
        "encryption_key": "SET" if os.getenv('ENCRYPTION_KEY') else "MISSING",
        "supabase_url": "SET" if os.getenv('SUPABASE_URL') else "MISSING",
        "supabase_service_key": "SET" if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else "MISSING",
        "environment": os.getenv('ENVIRONMENT', 'unknown')
    }

@router.get("/debug/redirect-uri")
async def debug_redirect_uri():
    """Debug endpoint to verify redirect URI configuration"""
    redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
    api_base_url = os.getenv('API_BASE_URL')
    environment = os.getenv('ENVIRONMENT')
    
    return {
        "GOOGLE_REDIRECT_URI": redirect_uri,
        "API_BASE_URL": api_base_url,
        "ENVIRONMENT": environment,
        "redirect_uri_length": len(redirect_uri) if redirect_uri else 0,
        "redirect_uri_repr": repr(redirect_uri) if redirect_uri else None,
        "constructed_uri": f"{api_base_url}/connections/google/callback" if api_base_url else None
    }

@router.get("/disconnect")
async def disconnect_google(current_user: User = Depends(get_current_user)):
    """Disconnect Google account"""
    try:
        # Update connection status
        supabase_admin.table('platform_connections').update({
            'is_active': False,
            'connection_status': 'disconnected',
            'disconnected_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }).eq('platform', 'google').eq('user_id', current_user.id).execute()
        
        return {
            "success": True,
            "message": "Google account disconnected successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect Google account: {str(e)}"
        )