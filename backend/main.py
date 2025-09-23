from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from scheduler.content_scheduler import ContentScheduler
from scheduler.background_scheduler import start_background_scheduler, stop_background_scheduler
from routers.connections import router as connections_router
from routers.content import router as content_router
from routers.social_media import router as social_media_router
from routers.social_media_connections import router as social_media_connections_router
from routers.chatbot import router as chatbot_router
from routers.media import router as media_router
from routers.google_connections import router as google_router
from routers.ads import router as ads_router
from routers.blogs import router as blogs_router

# Load environment variables
load_dotenv()

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO")
environment = os.getenv("ENVIRONMENT", "development")

if environment == "production":
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('emily.log')
        ]
    )
else:
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Emily API",
    description="Digital Marketing Agent API",
    version="1.0.0"
)

# Include routers (Google router first to handle /auth/google/callback)
app.include_router(google_router)
app.include_router(connections_router)
app.include_router(content_router)
app.include_router(social_media_router)
app.include_router(social_media_connections_router)
app.include_router(chatbot_router)
app.include_router(media_router)
app.include_router(ads_router)
app.include_router(blogs_router)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": environment}

# CORS configuration
environment = os.getenv("ENVIRONMENT", "development")

# Read CORS origins from environment variable
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # Parse comma-separated origins from environment variable
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    logger.info(f"CORS origins loaded from environment: {cors_origins}")
else:
    # No CORS origins configured
    if environment == "production":
        # In production, CORS_ORIGINS must be set in environment variables
        raise ValueError("CORS_ORIGINS environment variable must be set in production")
    else:
        # In development, allow all origins for flexibility
        cors_origins = ["*"]
        logger.warning("CORS origins set to '*' for development - this should not be used in production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
openai_api_key = os.getenv("OPENAI_API_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set")

if not openai_api_key:
    raise ValueError("OPENAI_API_KEY must be set")

supabase: Client = create_client(supabase_url, supabase_key)

# In-memory progress tracking
progress_store: Dict[str, Dict[str, Any]] = {}
progress_subscribers: Dict[str, List[asyncio.Queue]] = {}

# Progress tracking functions
async def update_progress(user_id: str, step: str, percentage: int, details: str, current_platform: str = None):
    """Update progress for a user"""
    progress_data = {
        "user_id": user_id,
        "step": step,
        "percentage": percentage,
        "details": details,
        "current_platform": current_platform,
        "timestamp": datetime.now().isoformat(),
        "is_generating": True
    }
    
    progress_store[user_id] = progress_data
    
    # Notify all subscribers
    if user_id in progress_subscribers:
        for queue in progress_subscribers[user_id]:
            try:
                await queue.put(progress_data)
            except:
                # Remove dead queues
                progress_subscribers[user_id].remove(queue)

async def complete_progress(user_id: str):
    """Mark progress as completed"""
    if user_id in progress_store:
        progress_store[user_id]["is_generating"] = False
        progress_store[user_id]["step"] = "completed"
        progress_store[user_id]["percentage"] = 100
        progress_store[user_id]["details"] = "Content generation completed!"
        
        # Notify subscribers
        if user_id in progress_subscribers:
            for queue in progress_subscribers[user_id]:
                try:
                    await queue.put(progress_store[user_id])
                except:
                    progress_subscribers[user_id].remove(queue)

def get_progress(user_id: str) -> Dict[str, Any]:
    """Get current progress for a user"""
    return progress_store.get(user_id, {"is_generating": False})

# Initialize content scheduler with progress callback
content_scheduler = ContentScheduler(supabase_url, supabase_key, openai_api_key, update_progress)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Start background scheduler on startup"""
    try:
        await start_background_scheduler(supabase_url, supabase_key, openai_api_key)
        logger.info("Background scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start background scheduler: {e}")
        # Continue without background scheduler for now
        logger.info("Continuing without background scheduler")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop background scheduler on shutdown"""
    try:
        await stop_background_scheduler()
        logger.info("Background scheduler stopped successfully")
    except Exception as e:
        logger.error(f"Error stopping background scheduler: {e}")

# Pydantic models
class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: User

class OnboardingData(BaseModel):
    business_name: str
    business_type: List[str]
    industry: List[str]
    business_description: str
    target_audience: Optional[List[str]] = []
    unique_value_proposition: str
    brand_voice: str
    brand_tone: str
    website_url: Optional[str] = ""
    phone_number: str
    street_address: Optional[str] = ""
    city: str
    state: str
    country: str
    timezone: str
    social_media_platforms: List[str]
    primary_goals: List[str]
    key_metrics_to_track: List[str]
    monthly_budget_range: str
    posting_frequency: str
    preferred_content_types: List[str]
    content_themes: List[str]
    main_competitors: Optional[str] = ""
    market_position: Optional[str] = ""
    products_or_services: Optional[str] = ""
    important_launch_dates: Optional[str] = ""
    planned_promotions_or_campaigns: Optional[str] = ""
    top_performing_content_types: Optional[List[str]] = []
    best_time_to_post: Optional[List[str]] = []
    successful_campaigns: Optional[str] = ""
    hashtags_that_work_well: Optional[str] = ""
    customer_pain_points: Optional[str] = ""
    typical_customer_journey: Optional[str] = ""
    automation_level: str
    platform_specific_tone: Optional[Dict[str, str]] = {}
    current_presence: Optional[List[str]] = []
    focus_areas: Optional[List[str]] = []
    platform_details: Optional[Dict[str, Any]] = {}
    facebook_page_name: Optional[str] = ""
    instagram_profile_link: Optional[str] = ""
    linkedin_company_link: Optional[str] = ""
    youtube_channel_link: Optional[str] = ""
    x_twitter_profile: Optional[str] = ""
    google_business_profile: Optional[str] = ""
    google_ads_account: Optional[str] = ""
    whatsapp_business: Optional[str] = ""
    email_marketing_platform: Optional[str] = ""
    meta_ads_accounts: Optional[str] = ""

# Utility functions
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        
        # Verify token with Supabase
        response = supabase.auth.get_user(token)
        if not response.user:
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# Routes
@app.get("/")
async def root():
    return {"message": "Emily API is running!"}

@app.get("/test-auth")
async def test_auth(current_user: User = Depends(get_current_user)):
    return {"message": "Authentication successful!", "user": current_user.email}

@app.get("/debug/users")
async def debug_users():
    """Debug endpoint to check users in both auth and profiles"""
    try:
        # Test Supabase connection with different approaches
        test_count = supabase.table("profiles").select("count").execute()
        
        # Try to get profiles with different select patterns
        profiles_all = supabase.table("profiles").select("*").execute()
        profiles_simple = supabase.table("profiles").select("id, name, onboarding_completed").execute()
        
        # Check if we're using service role
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        anon_key = os.getenv("SUPABASE_ANON_KEY")
        
        return {
            "supabase_url": os.getenv("SUPABASE_URL"),
            "using_service_role": bool(service_role_key),
            "using_anon_key": bool(anon_key),
            "test_count": test_count.data if hasattr(test_count, 'data') else str(test_count),
            "profiles_all": profiles_all.data if hasattr(profiles_all, 'data') else str(profiles_all),
            "profiles_simple": profiles_simple.data if hasattr(profiles_simple, 'data') else str(profiles_simple),
            "total_profiles": len(profiles_simple.data) if profiles_simple.data else 0
        }
    except Exception as e:
        return {"error": str(e), "supabase_url": os.getenv("SUPABASE_URL")}

@app.get("/debug/user/{user_id}")
async def debug_user(user_id: str):
    """Debug endpoint to check a specific user"""
    try:
        # Get specific profile
        profile_response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        
        return {
            "user_id": user_id,
            "profile": profile_response.data[0] if profile_response.data else None,
            "found": len(profile_response.data) > 0 if profile_response.data else False
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/content/{user_id}")
async def debug_content(user_id: str):
    """Debug endpoint to check generated content"""
    try:
        # Get campaigns
        campaigns_response = supabase.table("content_campaigns").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        # Get posts through campaigns
        posts_response = supabase.table("content_posts").select("*").order("created_at", desc=True).execute()
        
        # Filter posts by user's campaigns
        user_campaign_ids = [c["id"] for c in campaigns_response.data] if campaigns_response.data else []
        user_posts = [p for p in posts_response.data if p["campaign_id"] in user_campaign_ids] if posts_response.data else []
        
        return {
            "user_id": user_id,
            "campaigns": campaigns_response.data,
            "posts": user_posts,
            "total_campaigns": len(campaigns_response.data) if campaigns_response.data else 0,
            "total_posts": len(user_posts),
            "platforms": list(set([p["platform"] for p in user_posts])) if user_posts else []
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/content/trigger-weekly")
async def trigger_weekly_generation():
    """Manually trigger weekly content generation (for testing)"""
    try:
        result = await content_scheduler.run_weekly_content_generation()
        return {
            "success": True,
            "message": "Weekly content generation triggered successfully",
            "result": result
        }
    except Exception as e:
        logger.error(f"Error triggering weekly generation: {e}")
        return {
            "success": False,
            "message": f"Error triggering weekly generation: {str(e)}"
        }

@app.post("/content/cleanup")
async def cleanup_all_content():
    """Manually trigger content cleanup for all users (for testing)"""
    try:
        await content_scheduler.cleanup_all_existing_content()
        return {
            "success": True,
            "message": "Content cleanup completed successfully"
        }
    except Exception as e:
        logger.error(f"Error cleaning up content: {e}")
        return {
            "success": False,
            "message": f"Error cleaning up content: {str(e)}"
        }

@app.post("/debug/create-profile")
async def create_test_profile():
    """Create a test profile for debugging"""
    try:
        # Create a test profile with correct schema
        profile_data = {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "business_name": "Test Business",
            "onboarding_completed": True,
            "social_media_platforms": ["instagram", "facebook", "twitter"],
            "business_type": ["ecommerce"],
            "target_audience": ["young adults"],
            "primary_goals": ["brand awareness"],
            "business_description": "A test business for content generation",
            "brand_voice": "friendly",
            "brand_tone": "casual"
        }
        
        result = supabase.table("profiles").insert(profile_data).execute()
        
        return {
            "success": True,
            "profile": result.data[0] if result.data else None,
            "message": "Test profile created"
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/content/progress")
async def get_content_generation_progress(current_user: User = Depends(get_current_user)):
    """Get current content generation progress for the user"""
    return get_progress(current_user.id)

@app.get("/content/progress-stream")
async def progress_stream(token: str = None):
    """Server-Sent Events stream for real-time progress updates"""
    # Authenticate user from token parameter
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    
    try:
        response = supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = response.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    async def event_generator():
        # Create a queue for this connection
        queue = asyncio.Queue()
        
        # Add to subscribers
        if user_id not in progress_subscribers:
            progress_subscribers[user_id] = []
        progress_subscribers[user_id].append(queue)
        
        try:
            # Send initial progress if available
            initial_progress = get_progress(user_id)
            if initial_progress.get("is_generating"):
                yield f"data: {json.dumps(initial_progress)}\n\n"
            
            # Stream updates
            while True:
                try:
                    # Wait for progress update
                    progress_data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(progress_data)}\n\n"
                    
                    # If generation is complete, break
                    if not progress_data.get("is_generating", True):
                        break
                        
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                    
        finally:
            # Clean up
            if user_id in progress_subscribers:
                if queue in progress_subscribers[user_id]:
                    progress_subscribers[user_id].remove(queue)
                if not progress_subscribers[user_id]:
                    del progress_subscribers[user_id]
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.post("/auth/register", response_model=AuthResponse)
async def register(user: UserCreate):
    try:
        # Create user with Supabase Auth
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {
                    "name": user.name
                }
            }
        })
        
        print(f"Supabase response: {response}")  # Debug logging
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user"
            )
        
        # Check if email confirmation is required
        if not response.session:
            return {
                "message": "Registration successful! Please check your email to confirm your account.",
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "name": user.name,
                    "created_at": response.user.created_at
                }
            }
        
        return AuthResponse(
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
            user=User(
                id=response.user.id,
                email=response.user.email,
                name=user.name,
                created_at=response.user.created_at
            )
        )
        
    except Exception as e:
        print(f"Registration error: {str(e)}")  # Debug logging
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/auth/login", response_model=AuthResponse)
async def login(user: UserLogin):
    try:
        # Sign in with Supabase Auth
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        
        if not response.user or not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        return AuthResponse(
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
            user=User(
                id=response.user.id,
                email=response.user.email,
                name=response.user.user_metadata.get("name", response.user.email),
                created_at=response.user.created_at
            )
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@app.get("/auth/verify")
async def verify_token(current_user: User = Depends(get_current_user)):
    return {"user": current_user}

@app.post("/auth/logout")
async def logout():
    try:
        supabase.auth.sign_out()
        return {"message": "Successfully logged out"}
    except Exception as e:
        return {"message": "Logout completed"}

@app.post("/auth/refresh")
async def refresh_token(refresh_token: str):
    try:
        response = supabase.auth.refresh_session(refresh_token)
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@app.post("/auth/forgot-password")
async def forgot_password(email: str):
    """Send password reset OTP to user's email"""
    try:
        # First check if email exists
        try:
            user_response = supabase.auth.admin.get_user_by_email(email)
            if not user_response or not user_response.user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Email not found"
                )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found"
            )
        
        # Generate 6-digit OTP
        import random
        otp_code = str(random.randint(100000, 999999))
        
        # Store OTP in database with expiration (5 minutes)
        from datetime import datetime, timedelta
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Store OTP in a temporary table or use Supabase's built-in OTP
        # For now, we'll use Supabase's signInWithOtp for email verification
        response = supabase.auth.sign_in_with_otp({
            "email": email,
            "options": {
                "should_create_user": False
            }
        })
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return {"message": "Verification code sent to your email"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification code: {str(e)}"
        )

@app.get("/auth/check-email")
async def check_email_exists(email: str):
    """Check if an email already exists in the system"""
    try:
        # Try to get user by email using admin API
        try:
            # This will raise an exception if user doesn't exist
            user_response = supabase.auth.admin.get_user_by_email(email)
            if user_response and user_response.user:
                return {"exists": True, "message": "Email already exists"}
        except Exception as user_error:
            # Check if it's a "user not found" error
            error_message = str(user_error).lower()
            if "user not found" in error_message or "not found" in error_message:
                return {"exists": False, "message": "Email is available"}
            else:
                # Some other error occurred, log it and try alternative approach
                logger.warning(f"Admin API error: {user_error}")
                
                # Alternative: Try to list users and check manually
                try:
                    users_response = supabase.auth.admin.list_users()
                    email_exists = any(user.email == email for user in users_response)
                    if email_exists:
                        return {"exists": True, "message": "Email already exists"}
                    else:
                        return {"exists": False, "message": "Email is available"}
                except Exception as list_error:
                    logger.error(f"List users error: {list_error}")
                    raise list_error
            
    except Exception as e:
        logger.error(f"Error checking email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check email availability"
        )

@app.post("/auth/reset-password")
async def reset_password(email: str, otp: str, new_password: str):
    """Reset user password using OTP verification"""
    try:
        # Verify OTP with type 'email' (for signInWithOtp)
        verify_response = supabase.auth.verify_otp({
            "email": email,
            "token": otp,
            "type": "email"
        })
        
        if verify_response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=verify_response.error.message
            )
        
        # Update password using admin API
        update_response = supabase.auth.admin.update_user_by_id(
            verify_response.user.id,
            {"password": new_password}
        )
        
        if update_response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=update_response.error.message
            )
        
        return {"message": "Password updated successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )

# Onboarding endpoints
@app.get("/onboarding/profile")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    try:
        response = supabase.table("profiles").select("*").eq("id", current_user.id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile"
        )

@app.post("/onboarding/submit")
async def submit_onboarding(
    onboarding_data: OnboardingData,
    current_user: User = Depends(get_current_user)
):
    try:
        # Convert Pydantic model to dict
        data_dict = onboarding_data.dict()
        
        # Add onboarding_completed flag
        data_dict["onboarding_completed"] = True
        
        # Update the profile
        response = supabase.table("profiles").update(data_dict).eq("id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile"
            )
        
        return {"message": "Onboarding completed successfully", "profile": response.data[0]}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit onboarding: {str(e)}"
        )

@app.get("/onboarding/status")
async def get_onboarding_status(current_user: User = Depends(get_current_user)):
    try:
        response = supabase.table("profiles").select("onboarding_completed").eq("id", current_user.id).execute()
        if not response.data:
            return {"onboarding_completed": False}
        
        return {"onboarding_completed": response.data[0].get("onboarding_completed", False)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check onboarding status"
        )

# Content Management Endpoints
@app.post("/content/generate")
async def generate_content_for_user(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Generate content for the current user"""
    try:
        # Initialize progress
        await update_progress(
            current_user.id,
            "initializing",
            0,
            "Starting content generation..."
        )
        
        # Run content generation in background
        background_tasks.add_task(
            run_content_generation_with_progress,
            current_user.id
        )
        
        return {"message": "Content generation started", "user_id": current_user.id}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start content generation: {str(e)}"
        )

async def run_content_generation_with_progress(user_id: str):
    """Run content generation with progress tracking"""
    try:
        logger.info(f"Starting content generation for user: {user_id}")
        
        # Update progress
        await update_progress(user_id, "starting", 5, "Initializing content generation...")
        
        # Run the actual content generation
        result = await content_scheduler.run_single_user_generation(user_id)
        
        logger.info(f"Content generation result: {result}")
        
        if result['success']:
            await update_progress(user_id, "completed", 100, "Content generation completed successfully!")
        else:
            await update_progress(user_id, "error", 0, f"Content generation failed: {result.get('message', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"Error in content generation: {e}")
        await update_progress(user_id, "error", 0, f"Content generation failed: {str(e)}")
    finally:
        # Mark as completed after a delay
        await asyncio.sleep(2)
        await complete_progress(user_id)

@app.get("/content/campaigns")
async def get_user_campaigns(current_user: User = Depends(get_current_user)):
    """Get all content campaigns for the current user"""
    try:
        response = supabase.table("content_campaigns").select("*").eq("user_id", current_user.id).order("created_at", desc=True).execute()
        
        return {"campaigns": response.data}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch campaigns: {str(e)}"
        )

@app.get("/content/campaigns/{campaign_id}/posts")
async def get_campaign_posts(
    campaign_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all posts for a specific campaign"""
    try:
        # Verify campaign belongs to user
        campaign_response = supabase.table("content_campaigns").select("id").eq("id", campaign_id).eq("user_id", current_user.id).execute()
        
        if not campaign_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )
        
        # Get posts
        posts_response = supabase.table("content_posts").select("*, content_images(*)").eq("campaign_id", campaign_id).order("scheduled_date").execute()
        
        return {"posts": posts_response.data}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch posts: {str(e)}"
        )

@app.get("/content/posts/{post_id}")
async def get_post_details(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific post"""
    try:
        # Get post with campaign info to verify ownership
        response = supabase.table("content_posts").select("*, content_campaigns!inner(user_id), content_images(*)").eq("id", post_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        post = response.data[0]
        if post["content_campaigns"]["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return {"post": post}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch post: {str(e)}"
        )

@app.put("/content/posts/{post_id}")
async def update_post(
    post_id: str,
    post_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Update a specific post"""
    try:
        # Verify post ownership
        post_response = supabase.table("content_posts").select("id, content_campaigns!inner(user_id)").eq("id", post_id).execute()
        
        if not post_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        if post_response.data[0]["content_campaigns"]["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Update post
        update_response = supabase.table("content_posts").update(post_data).eq("id", post_id).execute()
        
        return {"message": "Post updated successfully", "post": update_response.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update post: {str(e)}"
        )

@app.get("/content/templates")
async def get_content_templates(platform: Optional[str] = None):
    """Get content templates, optionally filtered by platform"""
    try:
        query = supabase.table("content_templates").select("*").eq("is_active", True)
        
        if platform:
            query = query.eq("platform", platform)
        
        response = query.execute()
        
        return {"templates": response.data}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch templates: {str(e)}"
        )

@app.get("/content/image-preferences")
async def get_image_preferences(current_user: User = Depends(get_current_user)):
    """Get user's image generation preferences"""
    try:
        response = supabase.table("user_image_preferences").select("*").eq("user_id", current_user.id).execute()
        
        if response.data:
            return {"preferences": response.data[0]}
        else:
            return {"preferences": None}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch image preferences: {str(e)}"
        )

@app.put("/content/image-preferences")
async def update_image_preferences(
    preferences: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Update user's image generation preferences"""
    try:
        # Check if preferences exist
        existing_response = supabase.table("user_image_preferences").select("id").eq("user_id", current_user.id).execute()
        
        if existing_response.data:
            # Update existing preferences
            response = supabase.table("user_image_preferences").update(preferences).eq("user_id", current_user.id).execute()
        else:
            # Create new preferences
            preferences["user_id"] = current_user.id
            response = supabase.table("user_image_preferences").insert(preferences).execute()
        
        return {"message": "Image preferences updated successfully", "preferences": response.data[0]}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update image preferences: {str(e)}"
        )

# Admin endpoints (for testing and manual triggers)
@app.post("/admin/content/generate-all")
async def generate_content_for_all_users(background_tasks: BackgroundTasks):
    """Generate content for all users (admin endpoint)"""
    try:
        # Run content generation for all users in background
        background_tasks.add_task(
            content_scheduler.run_weekly_content_generation
        )
        
        return {"message": "Content generation started for all users"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start content generation: {str(e)}"
        )

# Ads endpoints
@app.get("/ads/{platform}")
async def get_platform_ads(
    platform: str,
    current_user: User = Depends(get_current_user)
):
    """Get active ads for a specific platform"""
    try:
        # Get user's connections for the platform
        connections_response = supabase.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", platform).eq("is_active", True).execute()
        
        if not connections_response.data:
            return {"ads": []}
        
        ads = []
        
        # For each connection, fetch ads from the platform
        for connection in connections_response.data:
            try:
                platform_ads = await fetch_ads_from_platform(platform, connection)
                ads.extend(platform_ads)
            except Exception as e:
                print(f"Error fetching ads for {platform} connection {connection['id']}: {e}")
                continue
        
        return {"ads": ads}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch {platform} ads: {str(e)}"
        )

async def fetch_ads_from_platform(platform: str, connection: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch ads from a specific platform using the connection data"""
    try:
        import httpx
        
        # Get the access token from the connection
        access_token = connection.get('access_token_encrypted')
        if not access_token:
            print(f"No access token found for {platform} connection")
            return []
        
        # Decrypt the access token (in production, you'd use proper encryption)
        # For now, assuming the token is stored as plain text for testing
        token = access_token
        
        if platform.lower() == 'facebook':
            return await fetch_facebook_ads(connection, token)
        elif platform.lower() == 'instagram':
            return await fetch_instagram_ads(connection, token)
        elif platform.lower() == 'linkedin':
            return await fetch_linkedin_ads(connection, token)
        elif platform.lower() == 'twitter':
            return await fetch_twitter_ads(connection, token)
        elif platform.lower() == 'youtube':
            return await fetch_youtube_ads(connection, token)
        else:
            return []
            
    except Exception as e:
        print(f"Error fetching ads from {platform}: {e}")
        return []

async def fetch_facebook_ads(connection: Dict[str, Any], token: str) -> List[Dict[str, Any]]:
    """Fetch Facebook ads using Marketing API"""
    try:
        import httpx
        
        # First, get the ad accounts associated with the user
        url = "https://graph.facebook.com/v18.0/me/adaccounts"
        params = {
            'access_token': token,
            'fields': 'id,name,account_status,currency,timezone_name',
            'limit': 50
        }
        
        async with httpx.AsyncClient() as client:
            # Get ad accounts
            response = await client.get(url, params=params)
            response.raise_for_status()
            accounts_data = response.json()
            
            ads = []
            
            # For each ad account, get the ads
            for account in accounts_data.get('data', []):
                account_id = account.get('id')
                if not account_id:
                    continue
                
                # Get ads for this account
                ads_url = f"https://graph.facebook.com/v18.0/{account_id}/ads"
                ads_params = {
                    'access_token': token,
                    'fields': 'id,name,status,objective,created_time,updated_time,insights{impressions,clicks,spend,reach,ctr,cpc,cpm}',
                    'limit': 50
                }
                
                try:
                    ads_response = await client.get(ads_url, params=ads_params)
                    if ads_response.status_code == 200:
                        ads_data = ads_response.json()
                        
                        for ad_data in ads_data.get('data', []):
                            insights = ad_data.get('insights', {}).get('data', [{}])[0] if ad_data.get('insights', {}).get('data') else {}
                            
                            ad = {
                                'id': ad_data.get('id'),
                                'name': ad_data.get('name', 'Unnamed Ad'),
                                'type': 'Facebook Ad',
                                'status': ad_data.get('status', 'unknown'),
                                'objective': ad_data.get('objective', 'Unknown'),
                                'budget': 0,  # Facebook doesn't provide budget in this endpoint
                                'spent': float(insights.get('spend', 0)),
                                'impressions': int(insights.get('impressions', 0)),
                                'clicks': int(insights.get('clicks', 0)),
                                'reach': int(insights.get('reach', 0)),
                                'ctr': float(insights.get('ctr', 0)),
                                'cpc': float(insights.get('cpc', 0)),
                                'cpm': float(insights.get('cpm', 0)),
                                'startDate': ad_data.get('created_time', '').split('T')[0] if ad_data.get('created_time') else '',
                                'endDate': '',  # Facebook doesn't provide end date in this endpoint
                                'platform': 'facebook',
                                'pageName': connection.get('page_name', 'Facebook Page')
                            }
                            ads.append(ad)
                    else:
                        print(f"Error fetching ads for account {account_id}: {ads_response.status_code} - {ads_response.text}")
                        
                except Exception as e:
                    print(f"Error fetching ads for account {account_id}: {e}")
                    continue
            
            return ads
            
    except Exception as e:
        print(f"Error fetching Facebook ads: {e}")
        return []

async def fetch_instagram_ads(connection: Dict[str, Any], token: str) -> List[Dict[str, Any]]:
    """Fetch Instagram ads using Business API"""
    try:
        import httpx
        
        # Instagram Business API endpoint for ads
        url = "https://graph.facebook.com/v18.0/me/adaccounts"
        params = {
            'access_token': token,
            'fields': 'id,name'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            ads = []
            for account in data.get('data', []):
                account_id = account.get('id')
                if account_id:
                    # Get ads for this account
                    ads_url = f"https://graph.facebook.com/v18.0/{account_id}/ads"
                    ads_params = {
                        'access_token': token,
                        'fields': 'id,name,status,objective,created_time,updated_time,insights{impressions,clicks,spend,reach,ctr,cpc,cpm}',
                        'limit': 50
                    }
                    
                    ads_response = await client.get(ads_url, params=ads_params)
                    if ads_response.status_code == 200:
                        ads_data = ads_response.json()
                        for ad_data in ads_data.get('data', []):
                            insights = ad_data.get('insights', {}).get('data', [{}])[0] if ad_data.get('insights', {}).get('data') else {}
                            
                            ad = {
                                'id': ad_data.get('id'),
                                'name': ad_data.get('name', 'Unnamed Ad'),
                                'type': 'Instagram Ad',
                                'status': ad_data.get('status', 'unknown'),
                                'objective': ad_data.get('objective', 'Unknown'),
                                'budget': 0,
                                'spent': float(insights.get('spend', 0)),
                                'impressions': int(insights.get('impressions', 0)),
                                'clicks': int(insights.get('clicks', 0)),
                                'reach': int(insights.get('reach', 0)),
                                'ctr': float(insights.get('ctr', 0)),
                                'cpc': float(insights.get('cpc', 0)),
                                'cpm': float(insights.get('cpm', 0)),
                                'startDate': ad_data.get('created_time', '').split('T')[0] if ad_data.get('created_time') else '',
                                'endDate': '',
                                'platform': 'instagram',
                                'pageName': connection.get('page_name', 'Instagram Account')
                            }
                            ads.append(ad)
            
            return ads
            
    except Exception as e:
        print(f"Error fetching Instagram ads: {e}")
        return []

async def fetch_linkedin_ads(connection: Dict[str, Any], token: str) -> List[Dict[str, Any]]:
    """Fetch LinkedIn ads using Marketing API"""
    try:
        # LinkedIn Marketing API implementation would go here
        # For now, return empty array as LinkedIn API requires different authentication
        return []
    except Exception as e:
        print(f"Error fetching LinkedIn ads: {e}")
        return []

async def fetch_twitter_ads(connection: Dict[str, Any], token: str) -> List[Dict[str, Any]]:
    """Fetch Twitter ads using Ads API"""
    try:
        # Twitter Ads API implementation would go here
        # For now, return empty array as Twitter API requires different authentication
        return []
    except Exception as e:
        print(f"Error fetching Twitter ads: {e}")
        return []

async def fetch_youtube_ads(connection: Dict[str, Any], token: str) -> List[Dict[str, Any]]:
    """Fetch YouTube ads using Google Ads API"""
    try:
        # YouTube/Google Ads API implementation would go here
        # For now, return empty array as Google Ads API requires different authentication
        return []
    except Exception as e:
        print(f"Error fetching YouTube ads: {e}")
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
