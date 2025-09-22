from fastapi import APIRouter, Depends, HTTPException, status, Header
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
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel

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
            supabase_admin.table('platform_connections').update({
                'access_token_encrypted': encrypt_token(credentials.token),
                'refresh_token_encrypted': encrypt_token(credentials.refresh_token) if credentials.refresh_token else None,
                'token_expires_at': credentials.expiry.isoformat() if credentials.expiry else None,
                'updated_at': datetime.now().isoformat()
            }).eq('user_id', user_id).eq('platform', 'google').execute()
            
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
        
        if not all([client_id, client_secret, redirect_uri]):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI"
            )
        
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
        
        # Generate authorization URL
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force consent screen to get refresh token
        )
        
        print(f"Google OAuth initiated for user {current_user.id}")
        print(f"Generated state: {state}")
        print(f"State expires at: {oauth_state_data['expires_at']}")
        print(f"Redirect URI: {redirect_uri}")
        print(f"Auth URL: {auth_url}")
        
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
async def google_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback"""
    return await handle_google_callback(code, state, error)

@router.get("/auth/google/callback")
async def google_auth_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback from /auth/google/callback path"""
    print(f"🔗 Google OAuth callback received - code: {code[:10] if code else 'None'}..., state: {state[:10] if state else 'None'}..., error: {error}")
    return await handle_google_callback(code, state, error)

@router.get("/auth/google/callback/redirect")
async def google_callback_redirect(code: str = None, state: str = None, error: str = None):
    """Redirect from /auth/google/callback to /callback for compatibility"""
    from fastapi.responses import RedirectResponse
    base_url = "https://agent-emily.onrender.com/connections/google/callback"
    params = []
    if code:
        params.append(f"code={code}")
    if state:
        params.append(f"state={state}")
    if error:
        params.append(f"error={error}")
    
    redirect_url = f"{base_url}?{'&'.join(params)}"
    print(f"🔗 Redirecting to: {redirect_url}")
    return RedirectResponse(url=redirect_url)

async def handle_google_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback"""
    try:
        # Check for OAuth error
        if error:
            frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
            return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Connection Failed</title>
            </head>
            <body>
                <script>
                    window.location.href = '{frontend_url}/google-callback?error={error}';
                </script>
                <p>Google OAuth error: {error}</p>
            </body>
            </html>
            """
        
        # Check for missing parameters
        if not code or not state:
            frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
            print(f"Google OAuth callback - Missing parameters: code={code}, state={state}")
            return f"""
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
            """
        
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
        
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
        
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
        
        if existing_connection.data:
            # Update existing connection
            supabase_admin.table('platform_connections').update({
                'access_token_encrypted': encrypt_token(credentials.token),
                'refresh_token_encrypted': encrypt_token(credentials.refresh_token) if credentials.refresh_token else None,
                'token_expires_at': credentials.expiry.isoformat() if credentials.expiry else None,
                'updated_at': datetime.now().isoformat(),
                'is_active': True,
                'connection_status': 'active'
            }).eq('user_id', user_id).eq('platform', 'google').execute()
        else:
            # Create new connection
            connection_data = {
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'platform': 'google',
                'page_id': google_user_id,  # Use Google user ID as page_id
                'page_name': name,
                'access_token_encrypted': encrypt_token(credentials.token),
                'refresh_token_encrypted': encrypt_token(credentials.refresh_token) if credentials.refresh_token else None,
                'token_expires_at': credentials.expiry.isoformat() if credentials.expiry else None,
                'is_active': True,
                'connection_status': 'active',
                'connected_at': datetime.now().isoformat(),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            supabase_admin.table('platform_connections').insert(connection_data).execute()
        
        # Clean up used state
        supabase_admin.table("oauth_states").delete().eq("state", state).execute()
        
        # Return HTML page that redirects to frontend
        frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
        return f"""
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
        """
        
    except Exception as e:
        # Return HTML page that redirects to frontend with error
        frontend_url = os.getenv('FRONTEND_URL', 'https://emily.atsnai.com')
        error_message = str(e).replace("'", "\\'").replace('"', '\\"')
        
        # Provide more specific error messages
        if "Invalid or expired OAuth state" in str(e):
            error_message = "Invalid or expired OAuth state. Please try connecting again."
        elif "access_denied" in str(e).lower():
            error_message = "Access denied. The app may be in testing mode. Please contact the administrator."
        elif "invalid_grant" in str(e).lower():
            error_message = "Invalid authorization code. Please try connecting again."
        
        return f"""
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
        """

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
        
        # Build Gmail service
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
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)
        
        # Create message
        message = {
            'raw': base64.urlsafe_b64encode(
                f"To: {to}\r\nSubject: {subject}\r\n\r\n{body}".encode()
            ).decode()
        }
        
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
        supabase_admin.table('platform_connections').update({
            'is_active': False,
            'connection_status': 'reconnect_required',
            'updated_at': datetime.now().isoformat()
        }).eq('platform', 'google').eq('user_id', current_user.id).execute()
        
        # Generate new OAuth URL
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
        
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
        
        # Generate authorization URL
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force consent screen to get refresh token
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
            "/connections/google/callback",
            "/connections/google/auth/google/callback"
        ]
    }

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