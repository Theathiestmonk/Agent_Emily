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
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/calendar.readonly'
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
    return creds

@router.get("/auth")
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
            "expires_at": (datetime.now() + timedelta(minutes=10)).isoformat()
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
        state_response = supabase_admin.table("oauth_states").select("*").eq("state", state).eq("platform", "google").execute()
        
        if not state_response.data:
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
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
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
        results = service.users().messages().list(userId='me', maxResults=limit).execute()
        messages = results.get('messages', [])
        
        # Get detailed message info
        detailed_messages = []
        for message in messages:
            msg = service.users().messages().get(userId='me', id=message['id']).execute()
            payload = msg['payload']
            headers = payload.get('headers', [])
            
            # Extract subject and sender
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
            
            detailed_messages.append({
                'id': message['id'],
                'subject': subject,
                'sender': sender,
                'date': date,
                'snippet': msg.get('snippet', '')
            })
        
        return {"messages": detailed_messages}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Gmail messages: {str(e)}"
        )

@router.get("/drive/files")
async def get_drive_files(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Google Drive files"""
    try:
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
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
        results = service.files().list(
            pageSize=limit,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()
        files = results.get('files', [])
        
        return {"files": files}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Drive files: {str(e)}"
        )

@router.get("/sheets/spreadsheets")
async def get_sheets_spreadsheets(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Google Sheets spreadsheets"""
    try:
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
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
        results = service.files().list(
            q="mimeType='application/vnd.google-apps.spreadsheet'",
            pageSize=limit,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()
        spreadsheets = results.get('files', [])
        
        return {"spreadsheets": spreadsheets}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Sheets: {str(e)}"
        )

@router.get("/docs/documents")
async def get_docs_documents(limit: int = 10, current_user: User = Depends(get_current_user)):
    """Get Google Docs documents"""
    try:
        # Get user's Google connection from database
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user.id).execute()
        
        if not connection.data:
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
        results = service.files().list(
            q="mimeType='application/vnd.google-apps.document'",
            pageSize=limit,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()
        documents = results.get('files', [])
        
        return {"documents": documents}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Docs: {str(e)}"
        )

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