import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from supabase import create_client
import openai
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BlogPost(BaseModel):
    id: str
    title: str
    content: str
    excerpt: str
    slug: str
    status: str = "draft"  # draft, published, scheduled
    post_type: str = "post"  # post, page
    format: str = "standard"  # standard, aside, chat, gallery, link, image, quote, status, video, audio
    categories: List[str] = []
    tags: List[str] = []
    author_id: str
    wordpress_site_id: str
    scheduled_at: str
    published_at: Optional[str] = None
    wordpress_post_id: Optional[str] = None
    meta_description: str = ""
    meta_keywords: List[str] = []
    reading_time: int = 0  # in minutes
    word_count: int = 0
    seo_score: int = 0
    created_at: str
    updated_at: str
    metadata: Dict[str, Any] = {}

class BlogCampaign(BaseModel):
    id: str
    user_id: str
    campaign_name: str
    campaign_description: str
    target_audience: str
    content_themes: List[str] = []
    posting_frequency: str = "weekly"  # daily, weekly, bi-weekly, monthly
    wordpress_sites: List[str] = []  # List of WordPress site IDs
    start_date: str
    end_date: str
    total_posts: int = 0
    published_posts: int = 0
    status: str = "active"  # active, paused, completed
    created_at: str
    updated_at: str
    metadata: Dict[str, Any] = {}

class BlogWritingState(BaseModel):
    user_id: str
    profile: Optional[Dict[str, Any]] = None
    wordpress_sites: Optional[List[str]] = None
    current_site: Optional[str] = None
    blogs: List[BlogPost] = []
    current_blog: Optional[BlogPost] = None
    campaign: Optional[BlogCampaign] = None
    error: Optional[str] = None
    progress: int = 0
    total_sites: int = 0
    completed_sites: int = 0

class BlogWritingAgent:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase = create_client(supabase_url, supabase_key)
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.graph = self._build_graph()

    def get_supabase_admin(self):
        """Get Supabase admin client for database operations"""
        return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow for blog writing"""
        workflow = StateGraph(BlogWritingState)
        
        # Add nodes
        workflow.add_node("fetch_profile", self._fetch_profile)
        workflow.add_node("fetch_wordpress_sites", self._fetch_wordpress_sites)
        workflow.add_node("create_campaign", self._create_campaign)
        workflow.add_node("generate_blog", self._generate_blog)
        workflow.add_node("save_blog", self._save_blog)
        workflow.add_node("update_progress", self._update_progress)
        
        # Add edges
        workflow.set_entry_point("fetch_profile")
        workflow.add_edge("fetch_profile", "fetch_wordpress_sites")
        workflow.add_edge("fetch_wordpress_sites", "create_campaign")
        workflow.add_edge("create_campaign", "generate_blog")
        workflow.add_edge("generate_blog", "save_blog")
        workflow.add_edge("save_blog", "update_progress")
        workflow.add_edge("update_progress", END)
        
        return workflow.compile()

    async def _fetch_profile(self, state: BlogWritingState) -> BlogWritingState:
        """Fetch user profile information"""
        try:
            logger.info(f"Fetching profile for user: {state.user_id}")
            
            supabase_admin = self.get_supabase_admin()
            response = supabase_admin.table("profiles").select("*").eq("id", state.user_id).execute()
            
            if response.data:
                state.profile = response.data[0]
                logger.info(f"Profile fetched: {state.profile.get('name', 'Unknown')}")
            else:
                logger.warning(f"No profile found for user: {state.user_id}")
                state.profile = {"name": "Unknown User", "bio": ""}
            
            return state
        except Exception as e:
            logger.error(f"Error fetching profile: {e}")
            state.error = str(e)
            return state

    async def _fetch_wordpress_sites(self, state: BlogWritingState) -> BlogWritingState:
        """Fetch user's WordPress sites"""
        try:
            logger.info(f"Fetching WordPress sites for user: {state.user_id}")
            
            supabase_admin = self.get_supabase_admin()
            response = supabase_admin.table("platform_connections").select("*").eq("user_id", state.user_id).eq("platform", "wordpress").eq("is_active", True).execute()
            
            if response.data:
                state.wordpress_sites = [site["id"] for site in response.data]
                state.total_sites = len(state.wordpress_sites)
                logger.info(f"Found {len(state.wordpress_sites)} WordPress sites")
            else:
                logger.warning("No WordPress sites found")
                state.wordpress_sites = []
                state.total_sites = 0
            
            return state
        except Exception as e:
            logger.error(f"Error fetching WordPress sites: {e}")
            state.error = str(e)
            return state

    async def _create_campaign(self, state: BlogWritingState) -> BlogWritingState:
        """Create a blog campaign"""
        try:
            logger.info("Creating blog campaign")
            
            campaign_id = str(uuid.uuid4())
            now = datetime.now()
            
            # Generate campaign name based on date
            campaign_name = f"Blog Campaign - {now.strftime('%B %Y')}"
            
            # Calculate end date (30 days from now)
            end_date = now + timedelta(days=30)
            
            campaign = BlogCampaign(
                id=campaign_id,
                user_id=state.user_id,
                campaign_name=campaign_name,
                campaign_description=f"Automated blog campaign for {state.profile.get('name', 'User')}",
                target_audience=state.profile.get('target_audience', 'General audience'),
                content_themes=state.profile.get('content_themes', ['Technology', 'Business', 'Lifestyle']),
                posting_frequency="weekly",
                wordpress_sites=state.wordpress_sites or [],
                start_date=now.isoformat(),
                end_date=end_date.isoformat(),
                total_posts=len(state.wordpress_sites or []) * 4,  # 4 posts per site
                published_posts=0,
                status="active",
                created_at=now.isoformat(),
                updated_at=now.isoformat(),
                metadata={
                    "generated_by": "blog_writing_agent",
                    "profile_name": state.profile.get('name', 'Unknown'),
                    "sites_count": len(state.wordpress_sites or [])
                }
            )
            
            state.campaign = campaign
            
            # Save campaign to database
            supabase_admin = self.get_supabase_admin()
            campaign_data = {
                "id": campaign.id,
                "user_id": campaign.user_id,
                "campaign_name": campaign.campaign_name,
                "campaign_description": campaign.campaign_description,
                "target_audience": campaign.target_audience,
                "content_themes": campaign.content_themes,
                "posting_frequency": campaign.posting_frequency,
                "wordpress_sites": campaign.wordpress_sites,
                "start_date": campaign.start_date,
                "end_date": campaign.end_date,
                "total_posts": campaign.total_posts,
                "published_posts": campaign.published_posts,
                "status": campaign.status,
                "created_at": campaign.created_at,
                "updated_at": campaign.updated_at,
                "metadata": campaign.metadata
            }
            
            supabase_admin.table("blog_campaigns").insert(campaign_data).execute()
            logger.info(f"Campaign created: {campaign.id}")
            
            return state
        except Exception as e:
            logger.error(f"Error creating campaign: {e}")
            state.error = str(e)
            return state

    async def _generate_blog(self, state: BlogWritingState) -> BlogWritingState:
        """Generate blog content for each WordPress site"""
        try:
            logger.info("Generating blog content")
            
            if not state.wordpress_sites:
                logger.warning("No WordPress sites available")
                return state
            
            # Generate blogs for each site
            for site_id in state.wordpress_sites:
                try:
                    logger.info(f"Generating blog for site: {site_id}")
                    
                    # Get site information
                    supabase_admin = self.get_supabase_admin()
                    site_response = supabase_admin.table("platform_connections").select("*").eq("id", site_id).eq("platform", "wordpress").execute()
                    
                    if not site_response.data:
                        logger.warning(f"Site not found: {site_id}")
                        continue
                    
                    site_info = site_response.data[0]
                    site_name = site_info.get("wordpress_site_name", site_info.get("page_name", "Unknown Site"))
                    
                    # Generate blog content
                    blog = await self._generate_blog_content(state, site_id, site_name)
                    if blog:
                        state.blogs.append(blog)
                        logger.info(f"Blog generated: {blog.title}")
                    
                except Exception as e:
                    logger.error(f"Error generating blog for site {site_id}: {e}")
                    continue
            
            return state
        except Exception as e:
            logger.error(f"Error in generate_blog: {e}")
            state.error = str(e)
            return state

    async def _generate_blog_content(self, state: BlogWritingState, site_id: str, site_name: str) -> Optional[BlogPost]:
        """Generate individual blog content"""
        try:
            # Prepare context for blog generation
            profile_name = state.profile.get('name', 'Unknown User')
            target_audience = state.campaign.target_audience if state.campaign else 'General audience'
            content_themes = state.campaign.content_themes if state.campaign else ['Technology', 'Business']
            
            # Create blog generation prompt
            prompt = f"""
            You are an expert blog writer creating content for WordPress. Generate a comprehensive blog post with the following requirements:

            CONTEXT:
            - Author: {profile_name}
            - Site: {site_name}
            - Target Audience: {target_audience}
            - Content Themes: {', '.join(content_themes)}
            
            REQUIREMENTS:
            1. Create an engaging, SEO-optimized blog title
            2. Write comprehensive blog content (1000-2000 words)
            3. Create a compelling excerpt (150-160 characters)
            4. Generate a URL-friendly slug
            5. Suggest relevant categories (2-3)
            6. Suggest relevant tags (5-8)
            7. Create meta description (150-160 characters)
            8. Suggest meta keywords (5-10)
            9. Calculate reading time and word count
            10. Provide SEO score (1-100)
            
            OUTPUT FORMAT (JSON):
            {{
                "title": "Blog Title Here",
                "content": "Full blog content with proper HTML formatting...",
                "excerpt": "Brief description of the blog post...",
                "slug": "blog-title-here",
                "categories": ["Category1", "Category2"],
                "tags": ["tag1", "tag2", "tag3"],
                "meta_description": "SEO meta description...",
                "meta_keywords": ["keyword1", "keyword2", "keyword3"],
                "reading_time": 8,
                "word_count": 1200,
                "seo_score": 85
            }}
            
            Make the content engaging, informative, and valuable for the target audience. Use proper HTML formatting for the content.
            """
            
            # Generate content using OpenAI
            response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert blog writer and SEO specialist."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=3000
            )
            
            # Parse response
            content = response.choices[0].message.content.strip()
            
            # Try to extract JSON from response
            try:
                import json
                # Find JSON in the response
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx != 0:
                    json_content = content[start_idx:end_idx]
                    blog_data = json.loads(json_content)
                else:
                    raise ValueError("No JSON found in response")
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to parse JSON response: {e}")
                # Fallback: create basic blog structure
                blog_data = {
                    "title": f"Blog Post for {site_name}",
                    "content": content,
                    "excerpt": content[:150] + "..." if len(content) > 150 else content,
                    "slug": f"blog-post-{datetime.now().strftime('%Y-%m-%d')}",
                    "categories": ["General"],
                    "tags": ["blog", "content"],
                    "meta_description": content[:150] + "..." if len(content) > 150 else content,
                    "meta_keywords": ["blog", "content", "wordpress"],
                    "reading_time": max(1, len(content.split()) // 200),
                    "word_count": len(content.split()),
                    "seo_score": 70
                }
            
            # Create blog post
            blog_id = str(uuid.uuid4())
            now = datetime.now()
            scheduled_time = now + timedelta(hours=1)  # Schedule 1 hour from now
            
            blog = BlogPost(
                id=blog_id,
                title=blog_data.get("title", f"Blog Post for {site_name}"),
                content=blog_data.get("content", content),
                excerpt=blog_data.get("excerpt", ""),
                slug=blog_data.get("slug", f"blog-{blog_id[:8]}"),
                status="draft",
                post_type="post",
                format="standard",
                categories=blog_data.get("categories", ["General"]),
                tags=blog_data.get("tags", ["blog"]),
                author_id=state.user_id,
                wordpress_site_id=site_id,
                scheduled_at=scheduled_time.isoformat(),
                meta_description=blog_data.get("meta_description", ""),
                meta_keywords=blog_data.get("meta_keywords", []),
                reading_time=blog_data.get("reading_time", 5),
                word_count=blog_data.get("word_count", 0),
                seo_score=blog_data.get("seo_score", 70),
                created_at=now.isoformat(),
                updated_at=now.isoformat(),
                metadata={
                    "generated_by": "blog_writing_agent",
                    "site_name": site_name,
                    "campaign_id": state.campaign.id if state.campaign else None,
                    "ai_model": "gpt-4",
                    "generation_time": datetime.now().isoformat()
                }
            )
            
            return blog
            
        except Exception as e:
            logger.error(f"Error generating blog content: {e}")
            return None

    async def _save_blog(self, state: BlogWritingState) -> BlogWritingState:
        """Save blog posts to database"""
        try:
            logger.info(f"Saving {len(state.blogs)} blog posts")
            
            if not state.blogs:
                return state
            
            supabase_admin = self.get_supabase_admin()
            
            for blog in state.blogs:
                try:
                    # Get site name from platform_connections
                    site_name = "Unknown Site"
                    if blog.wordpress_site_id:
                        site_response = supabase_admin.table("platform_connections").select("wordpress_site_name").eq("id", blog.wordpress_site_id).eq("platform", "wordpress").execute()
                        if site_response.data:
                            site_name = site_response.data[0].get("wordpress_site_name", "Unknown Site")
                    
                    # Prepare blog data for database
                    blog_data = {
                        "id": blog.id,
                        "title": blog.title,
                        "content": blog.content,
                        "excerpt": blog.excerpt,
                        "slug": blog.slug,
                        "status": blog.status,
                        "post_type": blog.post_type,
                        "format": blog.format,
                        "categories": blog.categories,
                        "tags": blog.tags,
                        "author_id": blog.author_id,
                        "wordpress_site_id": blog.wordpress_site_id,
                        "site_name": site_name,  # Add site name for frontend display
                        "scheduled_at": blog.scheduled_at,
                        "published_at": blog.published_at,
                        "wordpress_post_id": blog.wordpress_post_id,
                        "meta_description": blog.meta_description,
                        "meta_keywords": blog.meta_keywords,
                        "reading_time": blog.reading_time,
                        "word_count": blog.word_count,
                        "seo_score": blog.seo_score,
                        "created_at": blog.created_at,
                        "updated_at": blog.updated_at,
                        "metadata": blog.metadata
                    }
                    
                    # Save blog to database
                    supabase_admin.table("blog_posts").insert(blog_data).execute()
                    logger.info(f"Blog saved: {blog.title}")
                    
                except Exception as e:
                    logger.error(f"Error saving blog {blog.id}: {e}")
                    continue
            
            return state
        except Exception as e:
            logger.error(f"Error in save_blog: {e}")
            state.error = str(e)
            return state

    async def _update_progress(self, state: BlogWritingState) -> BlogWritingState:
        """Update progress and complete the workflow"""
        try:
            logger.info("Updating progress")
            
            state.completed_sites = len(state.blogs)
            state.progress = 100
            
            # Update campaign with published posts count
            if state.campaign:
                supabase_admin = self.get_supabase_admin()
                supabase_admin.table("blog_campaigns").update({
                    "published_posts": len(state.blogs),
                    "updated_at": datetime.now().isoformat()
                }).eq("id", state.campaign.id).execute()
            
            logger.info(f"Blog generation completed: {len(state.blogs)} blogs created")
            return state
            
        except Exception as e:
            logger.error(f"Error updating progress: {e}")
            state.error = str(e)
            return state

    async def generate_blogs_for_user(self, user_id: str) -> Dict[str, Any]:
        """Main entry point for generating blogs for a user"""
        try:
            logger.info(f"Starting blog generation for user: {user_id}")
            
            # Initialize state
            state = BlogWritingState(
                user_id=user_id,
                blogs=[],
                progress=0,
                total_sites=0,
                completed_sites=0
            )
            
            # Run the workflow
            result = await self.graph.ainvoke(state)
            
            # Debug: Log the result structure
            logger.info(f"Blog generation result type: {type(result)}")
            logger.info(f"Blog generation result: {result}")
            
            # The result is a BlogWritingState object, not a dict
            if hasattr(result, 'error') and result.error:
                logger.error(f"Blog generation failed: {result.error}")
                return {
                    "success": False,
                    "error": result.error,
                    "blogs": [],
                    "campaign": None
                }
            
            # Extract data from BlogWritingState object
            blogs_list = result.blogs if hasattr(result, 'blogs') else []
            campaign_obj = result.campaign if hasattr(result, 'campaign') else None
            
            # Ensure blogs_list is a list and handle conversion
            try:
                if blogs_list and len(blogs_list) > 0:
                    # Convert to dict if needed
                    if hasattr(blogs_list[0], 'dict'):
                        blogs_dict = [blog.dict() for blog in blogs_list]
                    else:
                        blogs_dict = blogs_list
                else:
                    blogs_dict = []
                
                # Handle campaign conversion
                campaign_dict = None
                if campaign_obj:
                    if hasattr(campaign_obj, 'dict'):
                        campaign_dict = campaign_obj.dict()
                    else:
                        campaign_dict = campaign_obj
                
                logger.info(f"✅ Blog generation successful: {len(blogs_dict)} blogs created")
                
                return {
                    "success": True,
                    "blogs": blogs_dict,
                    "campaign": campaign_dict,
                    "total_blogs": len(blogs_dict),
                    "message": f"Successfully generated {len(blogs_dict)} blog posts"
                }
            except Exception as e:
                logger.error(f"Error processing blog results: {e}")
                return {
                    "success": False,
                    "error": f"Error processing results: {str(e)}",
                    "blogs": [],
                    "campaign": None
                }
            
        except Exception as e:
            logger.error(f"Error in generate_blogs_for_user: {e}")
            return {
                "success": False,
                "error": str(e),
                "blogs": [],
                "campaign": None
            }
