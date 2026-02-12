"""
Authentication utilities
"""

import os
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Security
security = HTTPBearer()

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        print(f"🔍 Auth - Received token: {token[:20]}...")
        
        # Temporary test token for development
        if token == "test-token":
            print("🔍 Auth - Using test token for development")
            return User(
                id="22ecf157-2eef-4aea-b1a7-67e7c09127d0",  # Valid user ID from Supabase
                email="test@example.com",
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
        
        # Verify token with Supabase
        try:
            response = supabase.auth.get_user(token)
            print(f"🔍 Auth - Supabase response: {response}")
            
            if not response.user:
                print(f"🔍 Auth - No user found in response: {response}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # Convert created_at to string if it's a datetime object
            created_at_str = response.user.created_at
            if hasattr(created_at_str, 'isoformat'):
                created_at_str = created_at_str.isoformat()
            else:
                created_at_str = str(created_at_str)
            
            return User(
                id=response.user.id,
                email=response.user.email,
                name=response.user.user_metadata.get("name", response.user.email),
                created_at=created_at_str
            )
        except Exception as supabase_error:
            # Handle Supabase-specific errors
            error_str = str(supabase_error).lower()
            print(f"🔍 Auth - Supabase error: {supabase_error}")
            print(f"🔍 Auth - Exception type: {type(supabase_error)}")
            
            # Check for expired token
            if "expired" in error_str or "token is expired" in error_str or "invalid claims" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired. Please refresh your session and try again."
                )
            # Re-raise the original exception to be handled by outer try-except
            raise supabase_error
            
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"🔍 Auth - Exception occurred: {e}")
        print(f"🔍 Auth - Exception type: {type(e)}")
        
        # Provide more specific error messages
        error_detail = "Could not validate credentials"
        error_str = str(e).lower()
        
        if "expired" in error_str or "token is expired" in error_str:
            error_detail = "Token expired. Please refresh your session and try again."
        elif "timeout" in error_str or "timed out" in error_str:
            error_detail = "Authentication timeout. Please check your internet connection and try again."
        elif "ssl" in error_str or "handshake" in error_str:
            error_detail = "Connection error. Please check your internet connection and try again."
        elif "connection" in error_str:
            error_detail = "Cannot connect to authentication service. Please try again."
        elif "invalid" in error_str and "token" in error_str:
            error_detail = "Invalid or expired token. Please log in again."
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail
        )

def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current user and verify they have admin privileges based on subscription plan
    Raises 403 if user is not an admin
    Admin access is granted to users with 'admin' subscription plan
    """
    try:
        # First get the current user
        user = get_current_user(credentials)
        print(f"🔍 Admin Auth - User authenticated: {user.id}")

        # Check if user has admin subscription plan
        profile_response = supabase.table("profiles").select("subscription_plan, subscription_status").eq("id", user.id).execute()
        print(f"🔍 Admin Auth - Profile response: {profile_response.data}")

        if not profile_response.data:
            print(f"🔍 Admin Auth - No profile found for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User profile not found"
            )

        profile = profile_response.data[0]
        subscription_plan = profile.get("subscription_plan")
        subscription_status = profile.get("subscription_status")

        print(f"🔍 Admin Auth - User {user.id} has plan: {subscription_plan}, status: {subscription_status}")

        # Check if user has 'admin' subscription plan
        is_admin = subscription_plan == "admin"

        if not is_admin:
            print(f"🔍 Admin Auth - User {user.id} does not have admin plan (has: {subscription_plan})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required. Admin subscription plan is required."
            )

        print(f"🔍 Admin Auth - User {user.id} granted admin access")
        return user
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔍 Admin Auth - Exception occurred: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not verify admin access"
        )