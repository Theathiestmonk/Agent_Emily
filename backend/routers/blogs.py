from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
from datetime import datetime
from supabase import create_client
from pydantic import BaseModel
import logging
from cryptography.fernet import Fernet

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

supabase = create_client(supabase_url, supabase_anon_key)
supabase_admin = create_client(supabase_url, supabase_service_key)

# Encryption setup
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

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    try:
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        print(f"❌ Error decrypting token: {e}")
        raise

# Security
security = HTTPBearer()

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        
        if response and hasattr(response, 'user') and response.user:
            user_data = response.user
            return User(
                id=user_data.id,
                email=user_data.email or "unknown@example.com",
                name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
            )
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
            
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

router = APIRouter(prefix="/api/blogs", tags=["blogs"])

@router.get("/")
async def get_blogs(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by status"),
    site_id: Optional[str] = Query(None, description="Filter by WordPress site ID"),
    limit: int = Query(50, description="Number of blogs to return"),
    offset: int = Query(0, description="Number of blogs to skip")
):
    """Get all blogs for the current user"""
    try:
        logger.info(f"Fetching blogs for user: {current_user.id}")
        
        query = supabase_admin.table("blog_posts").select("*, wordpress_connections(site_name, site_url)").eq("author_id", current_user.id)
        
        if status:
            query = query.eq("status", status)
        if site_id:
            query = query.eq("wordpress_site_id", site_id)
        
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} blogs")
        return {"blogs": blogs, "total": len(blogs)}
        
    except Exception as e:
        logger.error(f"Error fetching blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blogs: {str(e)}")

# Campaign routes (must come before {blog_id} route)
@router.get("/campaigns/")
async def get_campaigns(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get all blog campaigns for the current user"""
    try:
        logger.info(f"Fetching campaigns for user: {current_user.id}")
        
        query = supabase_admin.table("blog_campaigns").select("*").eq("user_id", current_user.id)
        
        if status:
            query = query.eq("status", status)
        
        query = query.order("created_at", desc=True)
        
        response = query.execute()
        campaigns = response.data if response.data else []
        
        logger.info(f"Found {len(campaigns)} campaigns")
        return {"campaigns": campaigns, "total": len(campaigns)}
        
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns: {str(e)}")

@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific campaign by ID"""
    try:
        logger.info(f"Fetching campaign {campaign_id} for user: {current_user.id}")
        
        response = supabase_admin.table("blog_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        campaign = response.data[0]
        logger.info(f"Campaign found: {campaign['campaign_name']}")
        return {"campaign": campaign}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaign: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaign: {str(e)}")

@router.get("/campaigns/{campaign_id}/blogs")
async def get_campaign_blogs(
    campaign_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all blogs for a specific campaign"""
    try:
        logger.info(f"Fetching blogs for campaign {campaign_id} for user: {current_user.id}")
        
        # First verify the campaign belongs to the user
        campaign_response = supabase_admin.table("blog_campaigns").select("id").eq("id", campaign_id).eq("user_id", current_user.id).execute()
        
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get blogs for this campaign
        response = supabase_admin.table("blog_posts").select("*, wordpress_connections(site_name, site_url)").eq("campaign_id", campaign_id).eq("author_id", current_user.id).order("created_at", desc=True).execute()
        
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} blogs for campaign {campaign_id}")
        return {"blogs": blogs, "total": len(blogs)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaign blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaign blogs: {str(e)}")

# Stats route (must come before {blog_id} route)
@router.get("/stats/")
async def get_blog_stats(
    current_user: User = Depends(get_current_user)
):
    """Get blog statistics for the current user"""
    try:
        logger.info(f"Fetching blog stats for user: {current_user.id}")
        
        # Get total blogs
        total_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).execute()
        total_blogs = total_response.count if total_response.count else 0
        
        # Get published blogs
        published_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).eq("status", "published").execute()
        published_blogs = published_response.count if published_response.count else 0
        
        # Get draft blogs
        draft_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).eq("status", "draft").execute()
        draft_blogs = draft_response.count if draft_response.count else 0
        
        # Get scheduled blogs
        scheduled_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).eq("status", "scheduled").execute()
        scheduled_blogs = scheduled_response.count if scheduled_response.count else 0
        
        # Get total campaigns
        campaigns_response = supabase_admin.table("blog_campaigns").select("id", count="exact").eq("user_id", current_user.id).execute()
        total_campaigns = campaigns_response.count if campaigns_response.count else 0
        
        stats = {
            "total_blogs": total_blogs,
            "published_blogs": published_blogs,
            "draft_blogs": draft_blogs,
            "scheduled_blogs": scheduled_blogs,
            "total_campaigns": total_campaigns
        }
        
        logger.info(f"Blog stats: {stats}")
        return {"stats": stats}
        
    except Exception as e:
        logger.error(f"Error fetching blog stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog stats: {str(e)}")

@router.get("/{blog_id}")
async def get_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog by ID"""
    try:
        logger.info(f"Fetching blog {blog_id} for user: {current_user.id}")
        
        response = supabase_admin.table("blog_posts").select("*, wordpress_connections(site_name, site_url)").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = response.data[0]
        logger.info(f"Blog found: {blog['title']}")
        return {"blog": blog}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog: {str(e)}")

@router.post("/generate")
async def generate_blogs(
    current_user: User = Depends(get_current_user)
):
    """Generate new blog posts for the user"""
    try:
        logger.info(f"Generating blogs for user: {current_user.id}")
        
        # Import here to avoid circular imports
        from agents.blog_writing_agent import BlogWritingAgent
        
        # Initialize blog writing agent
        blog_agent = BlogWritingAgent(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_ANON_KEY"),
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Generate blogs
        result = await blog_agent.generate_blogs_for_user(current_user.id)
        
        if result["success"]:
            logger.info(f"Blog generation successful: {result['total_blogs']} blogs created")
            return result
        else:
            logger.error(f"Blog generation failed: {result['error']}")
            raise HTTPException(status_code=500, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error generating blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate blogs: {str(e)}")

@router.put("/{blog_id}")
async def update_blog(
    blog_id: str,
    blog_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update a blog post"""
    try:
        logger.info(f"Updating blog {blog_id} for user: {current_user.id}")
        
        # Verify blog belongs to user
        existing_response = supabase_admin.table("blog_posts").select("id").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        # Update blog
        update_data = {
            **blog_data,
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase_admin.table("blog_posts").update(update_data).eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update blog")
        
        logger.info(f"Blog updated: {blog_id}")
        return {"message": "Blog updated successfully", "blog": response.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update blog: {str(e)}")

@router.delete("/{blog_id}")
async def delete_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a blog post"""
    try:
        logger.info(f"Deleting blog {blog_id} for user: {current_user.id}")
        
        # Verify blog belongs to user
        existing_response = supabase_admin.table("blog_posts").select("id").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        # Delete blog
        supabase_admin.table("blog_posts").delete().eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        logger.info(f"Blog deleted: {blog_id}")
        return {"message": "Blog deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete blog: {str(e)}")

@router.post("/{blog_id}/publish")
async def publish_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Publish a blog to WordPress"""
    try:
        logger.info(f"Publishing blog {blog_id} for user: {current_user.id}")
        
        # Get blog details
        blog_response = supabase_admin.table("blog_posts").select("*, wordpress_connections(*)").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        wordpress_site = blog["wordpress_connections"]
        
        if not wordpress_site:
            raise HTTPException(status_code=400, detail="WordPress site not found")
        
        # Decrypt WordPress app password
        try:
            app_password = decrypt_token(wordpress_site['wordpress_app_password_encrypted'])
        except Exception as e:
            logger.error(f"Error decrypting WordPress app password: {e}")
            raise HTTPException(status_code=500, detail="Failed to decrypt WordPress app password")
        
        # Format blog content for WordPress API
        wordpress_data = {
            "title": blog['title'],
            "content": blog['content'],
            "excerpt": blog.get('excerpt', ''),
            "status": "publish",
            "format": blog.get('format', 'standard'),
            "categories": blog.get('categories', []),
            "tags": blog.get('tags', []),
            "meta": {
                "description": blog.get('meta_description', ''),
                "keywords": blog.get('meta_keywords', [])
            }
        }
        
        # Post to WordPress using REST API authentication
        rest_api_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts"
        
        logger.info(f"Publishing to WordPress using REST API: {rest_api_url}")
        
        try:
            import requests
            from requests.auth import HTTPBasicAuth
            
            # Prepare post data for REST API
            post_data = {
                'title': wordpress_data['title'],
                'content': wordpress_data['content'],
                'excerpt': wordpress_data['excerpt'],
                'status': 'publish',
                'format': wordpress_data['format'],
                'meta': {
                    '_yoast_wpseo_metadesc': wordpress_data['meta']['description'],
                    '_yoast_wpseo_focuskw': ', '.join(wordpress_data['meta']['keywords'])
                }
            }
            
            # Add categories and tags if provided
            if wordpress_data['categories']:
                post_data['categories'] = wordpress_data['categories']
            if wordpress_data['tags']:
                post_data['tags'] = wordpress_data['tags']
            
            # Create a new session to avoid cookie persistence issues
            session = requests.Session()
            
            # Disable automatic cookie handling to prevent multiple cookies issue
            session.cookies.clear()
            
            # Publish the post using REST API
            response = session.post(
                rest_api_url,
                json=post_data,
                auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Agent-Emily/1.0'
                },
                timeout=30,
                allow_redirects=False  # Prevent redirects that might cause cookie issues
            )
            
            if response.status_code == 201:
                wordpress_post_id = response.json()['id']
                logger.info(f"Blog published to WordPress via REST API: Post ID {wordpress_post_id}")
            elif response.status_code == 401:
                # Check if it's a cookie-related issue
                if 'Set-Cookie' in response.headers:
                    logger.warning(f"WordPress returned cookies in 401 response: {response.headers.get('Set-Cookie', 'None')}")
                
                raise HTTPException(
                    status_code=400,
                    detail="WordPress authentication failed. Please check your username and app password. Make sure you're using an Application Password, not your regular WordPress password."
                )
            elif response.status_code == 403:
                raise HTTPException(
                    status_code=400,
                    detail="WordPress REST API access denied. Please ensure your user has proper permissions."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"WordPress REST API returned status {response.status_code}. Error: {response.text}"
                )
            
        except requests.exceptions.RequestException as e:
            logger.error(f"WordPress REST API publishing failed: {e}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to publish to WordPress via REST API. Error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"WordPress REST API publishing failed: {e}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to publish to WordPress via REST API. Error: {str(e)}"
            )
        
        # Update blog with WordPress post ID
        update_data = {
            "status": "published",
            "published_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "wordpress_post_id": wordpress_post_id
        }
        
        supabase_admin.table("blog_posts").update(update_data).eq("id", blog_id).execute()
        
        logger.info(f"Blog published to WordPress: {blog_id} -> Post ID: {wordpress_post_id}")
        return {
            "message": "Blog published successfully", 
            "blog_id": blog_id,
            "wordpress_post_id": str(wordpress_post_id),
            "wordpress_url": f"{wordpress_site['site_url'].rstrip('/')}/?p={wordpress_post_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error publishing blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish blog: {str(e)}")


