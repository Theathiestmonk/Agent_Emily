from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import uuid
import re
import urllib.parse
from datetime import datetime
from supabase import create_client
from pydantic import BaseModel
import logging
from cryptography.fernet import Fernet
import requests

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
security = HTTPBearer(auto_error=False)

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        if not credentials or not credentials.credentials:
            logger.warning("No credentials provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization credentials required"
            )
            
        token = credentials.credentials
        logger.info(f"Authenticating user with token: {token[:20]}...")
        
        response = supabase.auth.get_user(token)
        logger.info(f"Supabase auth response: {response}")
        
        if response and hasattr(response, 'user') and response.user:
            user_data = response.user
            logger.info(f"User authenticated: {user_data.id}")
            return User(
                id=user_data.id,
                email=user_data.email or "unknown@example.com",
                name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
            )
        else:
            logger.warning("No user found in response")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or user not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

router = APIRouter(prefix="/api/blogs", tags=["blogs"])

@router.get("/public")
async def get_public_blogs(
    status: Optional[str] = Query("published", description="Filter by status"),
    limit: int = Query(50, description="Number of blogs to return"),
    offset: int = Query(0, description="Number of blogs to skip")
):
    """Get public blogs - no authentication required"""
    try:
        logger.info(f"Fetching public blogs with status: {status}")
        
        # Get published blogs for public display
        # Normalize status to lowercase for consistency
        status_filter = (status or "published").lower()
        
        query = supabase_admin.table("blog_posts").select("*")
        query = query.eq("status", status_filter)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} public blogs with status '{status_filter}'")
        logger.info(f"Sample blog statuses: {[b.get('status') for b in blogs[:3]]}")
        return {"blogs": blogs, "total": len(blogs)}
        
    except Exception as e:
        logger.error(f"Error fetching public blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blogs: {str(e)}")

@router.get("/public/all")
async def get_all_blogs_public(
    limit: int = Query(100, description="Number of blogs to return"),
    offset: int = Query(0, description="Number of blogs to skip")
):
    """Get all blogs (published and draft) - public endpoint for admin page"""
    try:
        logger.info(f"Fetching all blogs (admin view)")
        
        query = supabase_admin.table("blog_posts").select("*")
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} total blogs")
        return {"blogs": blogs, "total": len(blogs)}
        
    except Exception as e:
        logger.error(f"Error fetching all blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blogs: {str(e)}")

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
        
        # Get blogs without join for now - we'll add the join back after migration
        query = supabase_admin.table("blog_posts").select("*").eq("author_id", current_user.id)
        
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

@router.get("/public/by-slug")
async def get_public_blog_by_slug_query(
    slug: str = Query(..., description="Blog slug")
):
    """Get a specific published blog by slug - public endpoint (query parameter version)
    Uses query parameter to avoid issues with special characters in path
    """
    try:
        # Decode the slug in case it's URL encoded
        try:
            decoded_slug = urllib.parse.unquote(urllib.parse.unquote(slug))
            if decoded_slug == slug:
                decoded_slug = urllib.parse.unquote(slug)
        except:
            decoded_slug = slug
        
        logger.info(f"Fetching public blog - received slug: '{slug}', decoded: '{decoded_slug}'")
        
        # Get all published blogs to find the matching one
        all_published = supabase_admin.table("blog_posts").select("id, slug, title, status").eq("status", "published").execute()
        logger.info(f"Total published blogs: {len(all_published.data or [])}")
        
        matching_blog = None
        
        if all_published.data:
            logger.info(f"Available slugs in DB: {[b.get('slug') for b in all_published.data]}")
            
            # Try multiple matching strategies
            for blog in all_published.data:
                blog_slug = blog.get('slug', '')
                # Try exact match (decoded)
                if blog_slug == decoded_slug:
                    matching_blog = blog
                    logger.info(f"✓ Found exact match with decoded slug: {blog_slug}")
                    break
                # Try exact match (original as received)
                if blog_slug == slug:
                    matching_blog = blog
                    logger.info(f"✓ Found exact match with original slug: {blog_slug}")
                    break
                # Try case-insensitive match
                if blog_slug.lower() == decoded_slug.lower():
                    matching_blog = blog
                    logger.info(f"✓ Found case-insensitive match: {blog_slug}")
                    break
                # Try matching by removing question marks and timestamps (handles ? vs %3F differences)
                # Remove timestamp suffix (e.g., -1762770338)
                import re
                blog_slug_base = re.sub(r'-\d+$', '', blog_slug)
                decoded_slug_base = re.sub(r'-\d+$', '', decoded_slug)
                blog_slug_clean = blog_slug_base.replace('?', '').replace('%3F', '').replace('&', '')
                decoded_slug_clean = decoded_slug_base.replace('?', '').replace('%3F', '').replace('&', '')
                if blog_slug_clean and decoded_slug_clean and blog_slug_clean == decoded_slug_clean:
                    matching_blog = blog
                    logger.info(f"✓ Found match after cleaning: {blog_slug} (cleaned: {blog_slug_clean})")
                    break
        
        if not matching_blog:
            logger.warning(f"✗ Blog not found with slug: '{decoded_slug}' (received: '{slug}')")
            logger.warning(f"Available slugs: {[b.get('slug') for b in (all_published.data or [])]}")
            raise HTTPException(status_code=404, detail=f"Blog not found. Searched for: {decoded_slug}")
        
        # Fetch full blog data
        response = supabase_admin.table("blog_posts").select("*").eq("id", matching_blog['id']).execute()
        
        if not response.data or len(response.data) == 0:
            logger.error(f"Failed to fetch full blog data for ID: {matching_blog['id']}")
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = response.data[0]
        logger.info(f"✓ Blog found: {blog['title']} (ID: {blog['id']})")
        return {"blog": blog}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog: {str(e)}")

@router.get("/{blog_id}")
async def get_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog by ID"""
    try:
        logger.info(f"Fetching blog {blog_id} for user: {current_user.id}")
        
        response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
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

@router.post("/")
async def create_blog(
    blog_data: dict,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Create a new blog post manually - public endpoint"""
    try:
        # Try to get user if authenticated, otherwise use None
        user_id = None
        try:
            if credentials and credentials.credentials:
                response = supabase.auth.get_user(credentials.credentials)
                if response and hasattr(response, 'user') and response.user:
                    user_id = response.user.id
                    logger.info(f"Creating blog for authenticated user: {user_id}")
                else:
                    logger.info("Creating blog without authentication")
            else:
                logger.info("Creating blog without authentication")
        except Exception as auth_error:
            logger.info(f"Creating blog without authentication: {auth_error}")
        
        # Generate slug from title if not provided
        title = blog_data.get('title', 'Untitled')
        # Create slug: lowercase, replace spaces/special chars with dashes, remove multiple dashes
        if not blog_data.get('slug'):
            slug = re.sub(r'[^\w\s-]', '', title.lower())  # Remove special characters
            slug = re.sub(r'[-\s]+', '-', slug)  # Replace spaces and multiple dashes with single dash
            slug = slug.strip('-')[:200]  # Remove leading/trailing dashes and limit length
        else:
            slug = blog_data.get('slug')
        
        # Ensure slug is unique by appending timestamp if needed
        existing_slug_check = supabase_admin.table("blog_posts").select("id").eq("slug", slug).execute()
        if existing_slug_check.data:
            slug = f"{slug}-{int(datetime.now().timestamp())}"
        
        # Prepare blog data - make author_id optional if no user
        # Get metadata and add featured_image to it if column doesn't exist
        metadata = blog_data.get('metadata', {})
        featured_image = blog_data.get('featured_image')
        
        # Store featured_image in metadata if column doesn't exist in schema
        if featured_image:
            metadata['featured_image'] = featured_image
        
        new_blog = {
            "id": str(uuid.uuid4()),
            "title": title,
            "content": blog_data.get('content', ''),
            "excerpt": blog_data.get('excerpt', ''),
            "slug": slug,
            "status": (blog_data.get('status', 'draft') or 'draft').lower(),  # Normalize to lowercase
            "post_type": blog_data.get('post_type', 'post'),
            "format": blog_data.get('format', 'standard'),
            "categories": blog_data.get('categories', []),
            "tags": blog_data.get('tags', []),
            "wordpress_site_id": blog_data.get('wordpress_site_id'),
            "scheduled_at": blog_data.get('scheduled_at'),
            "published_at": blog_data.get('published_at'),
            "wordpress_post_id": blog_data.get('wordpress_post_id'),
            "meta_description": blog_data.get('meta_description', ''),
            "meta_keywords": blog_data.get('meta_keywords', []),
            "reading_time": blog_data.get('reading_time', 0),
            "word_count": blog_data.get('word_count', 0),
            "seo_score": blog_data.get('seo_score', 0),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "metadata": metadata
        }
        
        # Only include featured_image if column exists (try-catch will handle if it doesn't)
        # For now, we'll store it in metadata to avoid schema issues
        
        # Only set author_id if user is authenticated - make it optional for public blogs
        # This avoids foreign key constraint issues when no user is logged in
        if user_id:
            new_blog["author_id"] = user_id
            logger.info(f"Creating blog for authenticated user: {user_id}")
        else:
            # Don't set author_id - let database handle it as NULL if column allows it
            # If column requires it, we'll handle the error gracefully
            logger.info("Creating blog without author_id (public blog)")
            # Try to insert without author_id first
            try:
                # Remove author_id from new_blog if it exists
                if "author_id" in new_blog:
                    del new_blog["author_id"]
            except:
                pass
        
        # Insert blog into database
        try:
            response = supabase_admin.table("blog_posts").insert(new_blog).execute()
            
            if not response.data:
                raise HTTPException(status_code=500, detail="Failed to create blog")
            
            logger.info(f"Blog created: {new_blog['id']}")
            return {"message": "Blog created successfully", "blog": response.data[0]}
        except Exception as insert_error:
            # If insert fails due to author_id constraint, try with a valid system user
            error_str = str(insert_error)
            if "author_id" in error_str.lower() or "foreign key" in error_str.lower():
                logger.warning(f"Insert failed due to author_id constraint: {insert_error}")
                logger.info("Attempting to create blog with system user fallback")
                
                # Try to get any existing user from the database as fallback
                try:
                    # Get first user from profiles or users table
                    user_fallback = supabase_admin.table("profiles").select("id").limit(1).execute()
                    if user_fallback.data and len(user_fallback.data) > 0:
                        new_blog["author_id"] = user_fallback.data[0]["id"]
                        logger.info(f"Using fallback user: {new_blog['author_id']}")
                        response = supabase_admin.table("blog_posts").insert(new_blog).execute()
                        if response.data:
                            logger.info(f"Blog created with fallback user: {new_blog['id']}")
                            return {"message": "Blog created successfully", "blog": response.data[0]}
                except Exception as fallback_error:
                    logger.error(f"Fallback user approach also failed: {fallback_error}")
            
            # Re-raise the original error if we couldn't fix it
            raise HTTPException(status_code=500, detail=f"Failed to create blog: {str(insert_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create blog: {str(e)}")

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
        
        if result.get("success"):
            logger.info(f"Blog generation successful: {result.get('total_blogs', 0)} blogs created")
            return result
        else:
            logger.error(f"Blog generation failed: {result.get('error', 'Unknown error')}")
            raise HTTPException(status_code=500, detail=f"Failed to generate blogs: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"Error generating blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate blogs: {str(e)}")

@router.post("/public/{blog_id}/generate-image")
async def generate_blog_image(blog_id: str):
    """Generate an image for a blog post using Gemini 2.5 Preview Flash"""
    logger.info(f"Route hit: /api/blogs/public/{blog_id}/generate-image")
    try:
        import google.generativeai as genai
        import base64
        import uuid
        from datetime import datetime
        
        logger.info(f"Generating image for blog {blog_id}")
        
        # Get blog data
        blog_response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Get Gemini API key
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Image generation service not configured")
        
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        gemini_image_model = 'gemini-2.5-flash-image-preview'
        
        # Create image prompt from blog content
        title = blog.get('title', 'Blog Post')
        excerpt = blog.get('excerpt', '')
        content = blog.get('content', '')
        
        # Extract text from HTML content
        import re
        text_content = re.sub(r'<[^>]+>', '', content) if content else ''
        content_summary = text_content[:500] if text_content else excerpt[:500]
        
        # Create prompt for image generation
        image_prompt = f"""Create a professional, high-quality blog post featured image for the following blog:

Title: {title}

Content Summary: {content_summary}

Requirements:
- Professional and visually appealing
- Suitable for blog post header/featured image
- High resolution (1024x1024 or landscape format)
- Modern design with good composition
- Engaging and eye-catching
- Relevant to the blog topic
- Clean and professional aesthetic
- No text overlays (image only)
"""
        
        logger.info(f"Generating image with prompt: {image_prompt[:200]}...")
        
        # Generate image using Gemini
        model = genai.GenerativeModel(gemini_image_model)
        response = model.generate_content(image_prompt)
        
        # Extract image data
        image_data = None
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.data:
                        image_data = part.inline_data.data
                        break
        
        if not image_data:
            raise HTTPException(status_code=500, detail="Failed to generate image - no image data returned")
        
        # Convert to bytes if needed
        if isinstance(image_data, str):
            image_bytes = base64.b64decode(image_data)
        else:
            image_bytes = image_data
        
        # Upload to Supabase Storage - using "blog image" bucket
        file_name = f"{blog_id}/{uuid.uuid4()}.png"
        bucket_name = "blog image"
        
        # Upload image
        upload_response = supabase_admin.storage.from_(bucket_name).upload(
            file_name,
            image_bytes,
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        
        # Get public URL
        image_url_response = supabase_admin.storage.from_(bucket_name).get_public_url(file_name)
        image_url = image_url_response
        
        # Update blog with featured image
        metadata = blog.get('metadata', {})
        if not isinstance(metadata, dict):
            metadata = {}
        metadata['featured_image'] = image_url
        metadata['image_generated_at'] = datetime.now().isoformat()
        
        update_response = supabase_admin.table("blog_posts").update({
            "metadata": metadata,
            "updated_at": datetime.now().isoformat()
        }).eq("id", blog_id).execute()
        
        logger.info(f"Image generated and saved for blog {blog_id}: {image_url}")
        
        return {
            "success": True,
            "image_url": image_url,
            "message": "Image generated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating blog image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

@router.put("/public/{blog_id}")
async def update_blog_public(
    blog_id: str,
    blog_data: dict
):
    """Update a blog post - public endpoint for admin page"""
    try:
        logger.info(f"Updating blog {blog_id} (public endpoint)")
        
        # Check if blog exists
        existing_response = supabase_admin.table("blog_posts").select("id").eq("id", blog_id).execute()
        
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        # Prepare update data
        update_data = {}
        
        # Handle slug generation if title changed
        if 'title' in blog_data:
            title = blog_data.get('title', 'Untitled')
            if not blog_data.get('slug'):
                slug = re.sub(r'[^\w\s-]', '', title.lower())
                slug = re.sub(r'[-\s]+', '-', slug)
                slug = slug.strip('-')[:200]
                update_data['slug'] = slug
        
        # Handle featured_image in metadata
        if 'featured_image' in blog_data:
            metadata = blog_data.get('metadata', {})
            if not isinstance(metadata, dict):
                metadata = {}
            metadata['featured_image'] = blog_data.get('featured_image')
            update_data['metadata'] = metadata
            # Remove featured_image from update_data if it was there
            if 'featured_image' in blog_data:
                del blog_data['featured_image']
        
        # Normalize status to lowercase
        if 'status' in blog_data:
            blog_data['status'] = (blog_data.get('status') or 'draft').lower()
        
        # Merge all update data
        update_data.update(blog_data)
        update_data["updated_at"] = datetime.now().isoformat()
        
        # Update blog
        response = supabase_admin.table("blog_posts").update(update_data).eq("id", blog_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update blog")
        
        logger.info(f"Blog updated: {blog_id}")
        return {"message": "Blog updated successfully", "blog": response.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update blog: {str(e)}")

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

@router.delete("/public/{blog_id}")
async def delete_blog_public(
    blog_id: str
):
    """Delete a blog post - public endpoint for admin page"""
    try:
        logger.info(f"Deleting blog {blog_id} (public endpoint)")
        
        # Get blog details
        blog_response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Delete from Supabase
        delete_response = supabase_admin.table("blog_posts").delete().eq("id", blog_id).execute()
        
        logger.info(f"Blog deleted: {blog_id}")
        return {"message": "Blog deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete blog: {str(e)}")

@router.delete("/{blog_id}")
async def delete_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a blog post from both WordPress and Supabase"""
    try:
        logger.info(f"Deleting blog {blog_id} for user: {current_user.id}")
        
        # Get blog details including WordPress info
        blog_response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # If blog was published to WordPress, delete it from there too
        if blog.get('wordpress_post_id') and blog.get('wordpress_site_id'):
            try:
                # Get WordPress connection details
                wordpress_response = supabase_admin.table("platform_connections").select("*").eq("id", blog['wordpress_site_id']).eq("platform", "wordpress").execute()
                
                if wordpress_response.data:
                    wordpress_site = wordpress_response.data[0]
                    
                    # Decrypt WordPress app password
                    try:
                        app_password = decrypt_token(wordpress_site['wordpress_app_password_encrypted'])
                    except Exception as e:
                        logger.error(f"Error decrypting WordPress app password: {e}")
                        # Continue with Supabase deletion even if WordPress deletion fails
                    else:
                        # Delete from WordPress using REST API
                        import requests
                        from requests.auth import HTTPBasicAuth
                        
                        delete_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{blog['wordpress_post_id']}"
                        
                        logger.info(f"Deleting from WordPress: {delete_url}")
                        
                        response = requests.delete(
                            delete_url,
                            auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                            headers={
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'User-Agent': 'Agent-Emily/1.0'
                            },
                            timeout=30
                        )
                        
                        if response.status_code == 200:
                            logger.info(f"Blog deleted from WordPress: Post ID {blog['wordpress_post_id']}")
                        else:
                            logger.warning(f"Failed to delete from WordPress (status {response.status_code}): {response.text}")
                            
            except Exception as e:
                logger.error(f"Error deleting from WordPress: {e}")
                # Continue with Supabase deletion even if WordPress deletion fails
        
        # Delete from Supabase
        supabase_admin.table("blog_posts").delete().eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        logger.info(f"Blog deleted from Supabase: {blog_id}")
        return {"message": "Blog deleted successfully from both WordPress and Supabase"}
        
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
        blog_response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Check if blog has WordPress connection
        if not blog.get('wordpress_site_id'):
            raise HTTPException(status_code=400, detail="This blog is in standalone mode and cannot be published to WordPress. Please connect WordPress in settings to enable publishing.")
        
        # Get the WordPress connection from platform_connections
        wordpress_response = supabase_admin.table("platform_connections").select("*").eq("id", blog['wordpress_site_id']).eq("platform", "wordpress").execute()
        
        if not wordpress_response.data:
            raise HTTPException(status_code=400, detail="WordPress site not found")
        
        wordpress_site = wordpress_response.data[0]
        
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
            # Add categories and tags to the content for visibility
            content_with_meta = wordpress_data['content']
            if wordpress_data['categories'] or wordpress_data['tags']:
                content_with_meta += "\n\n<!-- Blog Metadata -->\n"
                if wordpress_data['categories']:
                    content_with_meta += f"<p><strong>Categories:</strong> {', '.join(wordpress_data['categories'])}</p>\n"
                if wordpress_data['tags']:
                    content_with_meta += f"<p><strong>Tags:</strong> {', '.join(wordpress_data['tags'])}</p>\n"
            
            post_data = {
                'title': wordpress_data['title'],
                'content': content_with_meta,
                'excerpt': wordpress_data['excerpt'],
                'status': 'publish',
                'format': wordpress_data['format'],
                'meta': {
                    '_yoast_wpseo_metadesc': wordpress_data['meta']['description'],
                    '_yoast_wpseo_focuskw': ', '.join(wordpress_data['meta']['keywords'])
                }
            }
            
            # Handle categories and tags - WordPress REST API expects integer IDs
            # For now, we'll skip categories and tags to avoid the type error
            # In a production system, you'd want to:
            # 1. Create categories/tags in WordPress first
            # 2. Get their IDs
            # 3. Use those IDs here
            # 
            # For now, we'll include them in the content or meta instead
            if wordpress_data['categories']:
                # Add categories as meta data instead of direct categories
                post_data['meta']['_blog_categories'] = ', '.join(wordpress_data['categories'])
            if wordpress_data['tags']:
                # Add tags as meta data instead of direct tags
                post_data['meta']['_blog_tags'] = ', '.join(wordpress_data['tags'])
            
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
        
        # Get the published post details to get the proper permalink
        try:
            # Try to get the post details to extract the permalink
            post_response = requests.get(
                f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{wordpress_post_id}",
                auth=(wordpress_site['wordpress_username'], app_password),
                timeout=30
            )
            
            if post_response.status_code == 200:
                post_data = post_response.json()
                blog_url = post_data.get('link', f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}")
            else:
                # Fallback to post ID format
                blog_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}"
        except Exception as e:
            logger.warning(f"Could not fetch post permalink, using fallback: {e}")
            # Fallback to post ID format
            blog_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}"
        
        # Update blog with WordPress post ID and blog URL
        update_data = {
            "status": "published",
            "published_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "wordpress_post_id": wordpress_post_id,
            "blog_url": blog_url
        }
        
        supabase_admin.table("blog_posts").update(update_data).eq("id", blog_id).execute()
        
        logger.info(f"Blog published to WordPress: {blog_id} -> Post ID: {wordpress_post_id}")
        return {
            "message": "Blog published successfully", 
            "blog_id": blog_id,
            "wordpress_post_id": str(wordpress_post_id),
            "wordpress_url": f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error publishing blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish blog: {str(e)}")


