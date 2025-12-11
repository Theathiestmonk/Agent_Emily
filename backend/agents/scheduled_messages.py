"""
Scheduled Daily Messages Generator
Generates WhatsApp-style messages for users at specific times throughout the day
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, time as dt_time
import pytz
import requests
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
from cryptography.fernet import Fernet

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7,
    openai_api_key=openai_api_key
)

# Initialize token tracker for usage tracking
token_tracker = None
if supabase_url and supabase_key:
    try:
        from services.token_usage_service import TokenUsageService
        token_tracker = TokenUsageService(supabase_url, supabase_key)
    except Exception as e:
        logger.warning(f"Could not initialize token tracker: {e}")

def track_langchain_usage_async(user_id: str, response, messages: List, feature_type: str = "content_generation", metadata: Dict = None):
    """Helper function to track LangChain usage asynchronously"""
    if token_tracker and user_id:
        try:
            import asyncio
            import threading
            def track_in_thread():
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(
                        token_tracker.track_langchain_usage(
                            user_id=user_id,
                            feature_type=feature_type,
                            model_name="gpt-4o-mini",
                            response=response,
                            messages=messages,
                            request_metadata=metadata or {}
                        )
                    )
                    loop.close()
                except Exception as e:
                    logger.error(f"Error tracking scheduled messages token usage: {str(e)}")
            thread = threading.Thread(target=track_in_thread, daemon=True)
            thread.start()
        except Exception as e:
            logger.error(f"Error setting up scheduled messages token tracking: {str(e)}")

logger = logging.getLogger(__name__)

# Initialize encryption for token decryption
encryption_key = os.getenv("ENCRYPTION_KEY")
cipher_suite = None
if encryption_key:
    try:
        cipher_suite = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
    except Exception as e:
        logging.warning(f"Could not initialize encryption: {e}")


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt access token for use"""
    try:
        if not encrypted_token:
            return ""
        
        # If no encryption key, assume token is already decrypted
        if not cipher_suite:
            return encrypted_token
        
        # Try to decrypt
        try:
            return cipher_suite.decrypt(encrypted_token.encode()).decode()
        except Exception:
            # If decryption fails, token might already be decrypted
            return encrypted_token
    except Exception as e:
        logger.warning(f"Error decrypting token, using as-is: {e}")
        return encrypted_token


# Morning message functions moved to morning_scheduled_message.py


def fetch_latest_post_metrics(connection: dict, platform: str) -> Dict[str, Any]:
    """Fetch the latest post from platform API and return its metrics"""
    try:
        # Get access token
        encrypted_token = connection.get('access_token_encrypted') or connection.get('access_token', '')
        if not encrypted_token:
            logger.warning(f"No access token found for {platform}")
            return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
        
        access_token = decrypt_token(encrypted_token)
        account_id = connection.get('account_id') or connection.get('page_id') or connection.get('instagram_id') or connection.get('linkedin_id')
        
        if not account_id:
            logger.warning(f"No account_id found for {platform}")
            return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
        
        platform_lower = platform.lower()
        
        if platform_lower == "instagram":
            # For Instagram, we need to get the Instagram Business account ID first if we have a Facebook Page ID
            instagram_account_id = account_id
            
            # Check if this is a Facebook Page ID (shorter) or Instagram account ID (longer)
            if account_id.isdigit() and len(account_id) <= 15:
                # This is a Facebook Page ID, need to get Instagram Business account
                try:
                    page_response = requests.get(
                        f"https://graph.facebook.com/v18.0/{account_id}",
                        params={
                            "access_token": access_token,
                            "fields": "instagram_business_account"
                        },
                        timeout=10
                    )
                    if page_response.status_code == 200:
                        account_data = page_response.json()
                        instagram_business_account = account_data.get('instagram_business_account')
                        if instagram_business_account:
                            instagram_account_id = instagram_business_account.get('id')
                        else:
                            logger.warning(f"No Instagram Business account found for Facebook Page {account_id}")
                            return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
                    else:
                        logger.warning(f"Error fetching Instagram account: {page_response.status_code}")
                        return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
                except Exception as e:
                    logger.error(f"Error getting Instagram account ID: {e}")
                    return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
            
            # Fetch latest Instagram post
            try:
                response = requests.get(
                    f"https://graph.facebook.com/v18.0/{instagram_account_id}/media",
                    params={
                        "access_token": access_token,
                        "fields": "id,like_count,comments_count",
                        "limit": 1
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('data') and len(data['data']) > 0:
                        latest_post = data['data'][0]
                        return {
                            "likes_count": latest_post.get('like_count', 0) or 0,
                            "comments_count": latest_post.get('comments_count', 0) or 0,
                            "shares_count": 0  # Instagram doesn't have shares
                        }
                else:
                    logger.warning(f"Instagram API error: {response.status_code} - {response.text}")
            except Exception as e:
                logger.error(f"Error fetching Instagram latest post: {e}")
        
        elif platform_lower == "facebook":
            # Fetch latest Facebook post
            try:
                response = requests.get(
                    f"https://graph.facebook.com/v18.0/{account_id}/posts",
                    params={
                        "access_token": access_token,
                        "fields": "id,likes.summary(true),comments.summary(true),shares",
                        "limit": 1
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('data') and len(data['data']) > 0:
                        latest_post = data['data'][0]
                        return {
                            "likes_count": latest_post.get('likes', {}).get('summary', {}).get('total_count', 0) or 0,
                            "comments_count": latest_post.get('comments', {}).get('summary', {}).get('total_count', 0) or 0,
                            "shares_count": latest_post.get('shares', {}).get('count', 0) or 0
                        }
                else:
                    logger.warning(f"Facebook API error: {response.status_code} - {response.text}")
            except Exception as e:
                logger.error(f"Error fetching Facebook latest post: {e}")
        
        elif platform_lower == "linkedin":
            # LinkedIn API requires different approach
            # For now, return 0s as LinkedIn API access is more complex
            logger.info("LinkedIn API metrics fetching not yet implemented")
            return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
        
        elif platform_lower == "twitter":
            # Twitter/X API requires different approach
            # For now, return 0s as Twitter API access is more complex
            logger.info("Twitter API metrics fetching not yet implemented")
            return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
        
        elif platform_lower == "youtube":
            # YouTube API requires different approach
            # For now, return 0s as YouTube API access is more complex
            logger.info("YouTube API metrics fetching not yet implemented")
            return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
        
        return {"likes_count": 0, "comments_count": 0, "shares_count": 0}
        
    except Exception as e:
        logger.error(f"Error fetching latest post metrics for {platform}: {e}")
        return {"likes_count": 0, "comments_count": 0, "shares_count": 0}


def get_user_timezone(user_id: str) -> str:
    """Get user's timezone from profile or default to UTC"""
    try:
        response = supabase.table("profiles").select("timezone").eq("id", user_id).execute()
        if response.data and response.data[0].get("timezone"):
            return response.data[0]["timezone"]
        return "UTC"
    except Exception as e:
        logger.error(f"Error getting timezone for user {user_id}: {e}")
        return "UTC"


# Morning message functions moved to morning_scheduled_message.py
# Import them when needed:
# from agents.morning_scheduled_message import check_morning_message_exists, ensure_morning_message_on_login, generate_morning_message

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile information (used by multiple message types)"""
    try:
        response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if response.data:
            profile = response.data[0]
            logger.info(f"Fetched profile for user {user_id}: business_name={profile.get('business_name')}, industry={profile.get('industry')}")
            return profile
        logger.warning(f"No profile found for user {user_id}")
        return None
    except Exception as e:
        logger.error(f"Error getting profile for user {user_id}: {e}")
        return None


def format_whatsapp_message(message_type: str, data: Dict[str, Any]) -> str:
    """Format message in WhatsApp style with emojis"""
    if message_type == "morning":
        from agents.morning_scheduled_message import format_morning_message
        return format_morning_message(data)
    elif message_type == "leads_reminder":
        return format_leads_reminder_message(data)
    elif message_type == "night":
        return format_night_message(data)
    return ""


# format_morning_message moved to morning_scheduled_message.py


def format_leads_reminder_message(data: Dict[str, Any]) -> str:
    """Format leads reminder message with clickable lead cards"""
    business_name = data.get("business_name", "there")
    total_new_leads = data.get("total_new_leads", 0)
    leads_today = data.get("leads_today", [])
    
    message = f"Dear {business_name}, reminder to check leads for today:\n\n"
    message += f"Total New leads: {total_new_leads}\n\n"
    
    if leads_today and len(leads_today) > 0:
        message += "Reminding you to follow up with the following leads today:\n\n"
        # Format leads as clickable cards
        for lead in leads_today:
            lead_name = lead.get("name", "Unknown Lead")
            lead_email = lead.get("email", "")
            lead_phone = lead.get("phone_number", "")
            lead_id = lead.get("id", "")
            lead_status = lead.get("status", "new")
            
            # Create clickable card format
            message += f"📋 {lead_name}\n"
            if lead_email:
                message += f"   📧 {lead_email}\n"
            if lead_phone:
                message += f"   📞 {lead_phone}\n"
            message += f"   Status: {lead_status}\n"
            message += f"   [View Lead](leads/{lead_id})\n\n"
    else:
        message += "No leads scheduled for follow-up today.\n"
    
    return message


def format_night_message(data: Dict[str, Any]) -> str:
    """Format night daily review message"""
    message = "Daily Summary 🌙\n\n"
    
    if data.get("what_worked"):
        message += f"✔️ What Worked:\n\n{data['what_worked']}\n\n"
    
    if data.get("what_didnt_work"):
        message += f"⚠️ What Didn't Work:\n\n{data['what_didnt_work']}\n\n"
    
    if data.get("follower_insights"):
        message += f"👥 Follower Insights:\n\n{data['follower_insights']}\n\n"
    
    if data.get("experiment"):
        message += f"🧪 Suggested Experiment for Tomorrow:\n\n{data['experiment']}\n\n"
    
    if data.get("content_topics"):
        message += "📝 Content Topics to Prepare:\n\n"
        for topic in data["content_topics"][:2]:
            message += f"• {topic}\n"
    
    return message


# Social insights functions moved to morning_scheduled_message.py


def fetch_recent_posts(user_id: str) -> Optional[List[Dict[str, Any]]]:
    """Fetch recent posts for analytics"""
    try:
        # Get user's campaigns
        campaigns = supabase.table("content_campaigns").select("id").eq("user_id", user_id).execute()
        campaign_ids = [c["id"] for c in campaigns.data] if campaigns.data else []
        
        if not campaign_ids:
            return None
        
        # Get posts from last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        posts = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).gte("created_at", yesterday.isoformat()).execute()
        
        return posts.data if posts.data else None
    except Exception as e:
        logger.error(f"Error fetching posts: {e}")
        return None


# generate_morning_message moved to morning_scheduled_message.py


def fetch_leads_for_today(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Fetch new leads and leads with follow-up date for today"""
    try:
        user_tz = pytz.timezone(timezone)
        now = datetime.now(user_tz)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert to UTC for database query
        today_start_utc = today_start.astimezone(pytz.UTC)
        today_end_utc = today_end.astimezone(pytz.UTC)
        
        # Get new leads created today
        new_leads_response = supabase.table("leads").select("*").eq(
            "user_id", user_id
        ).gte("created_at", today_start_utc.isoformat()).lt(
            "created_at", today_end_utc.isoformat()
        ).execute()
        
        new_leads = new_leads_response.data if new_leads_response.data else []
        
        # Get leads with follow-up date for today
        follow_up_leads_response = supabase.table("leads").select("*").eq(
            "user_id", user_id
        ).gte("follow_up_at", today_start_utc.isoformat()).lt(
            "follow_up_at", today_end_utc.isoformat()
        ).execute()
        
        follow_up_leads = follow_up_leads_response.data if follow_up_leads_response.data else []
        
        # Combine and deduplicate (a lead might be both new and have follow-up today)
        all_lead_ids = set()
        unique_leads = []
        for lead in new_leads + follow_up_leads:
            if lead.get("id") not in all_lead_ids:
                all_lead_ids.add(lead.get("id"))
                unique_leads.append(lead)
        
        return {
            "total_new_leads": len(new_leads),
            "leads_today": unique_leads
        }
    except Exception as e:
        logger.error(f"Error fetching leads for user {user_id}: {e}")
        return {
            "total_new_leads": 0,
            "leads_today": []
        }


def generate_leads_reminder_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate leads reminder message at 10 AM"""
    try:
        logger.info(f"Generating leads reminder message for user {user_id}")
        profile = get_user_profile(user_id)
        if not profile:
            logger.error(f"Profile not found for user {user_id}")
            return {"success": False, "error": "Profile not found"}
        
        business_name = profile.get("business_name", "there")
        
        # Fetch leads data
        leads_data = fetch_leads_for_today(user_id, timezone)
        
        data = {
            "business_name": business_name,
            "total_new_leads": leads_data["total_new_leads"],
            "leads_today": leads_data["leads_today"]
        }
        
        message = format_leads_reminder_message(data)
        
        return {
            "success": True,
            "content": message,
            "metadata": {
                **data,
                "sender": "chase"
            }
        }
    except Exception as e:
        logger.error(f"Error generating leads reminder message: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


def generate_night_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate night daily review message"""
    try:
        profile = get_user_profile(user_id)
        if not profile:
            return {"success": False, "error": "Profile not found"}
        
        # Get today's posts
        posts = fetch_recent_posts(user_id)
        
        # Analyze what worked and what didn't
        what_worked = analyze_what_worked(posts) if posts else None
        what_didnt_work = analyze_what_didnt_work(posts) if posts else None
        
        # Get follower insights
        follower_insights = get_follower_insights(user_id)
        
        # Generate experiment suggestion
        experiment = generate_experiment_suggestion(user_id, profile, posts)
        
        # Generate content topics
        content_topics = generate_content_topics(user_id, profile, 2)
        
        data = {
            "what_worked": what_worked,
            "what_didnt_work": what_didnt_work,
            "follower_insights": follower_insights,
            "experiment": experiment,
            "content_topics": content_topics
        }
        
        message = format_night_message(data)
        
        return {
            "success": True,
            "content": message,
            "metadata": data
        }
    except Exception as e:
        logger.error(f"Error generating night message for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


def generate_mid_morning_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate mid-morning message at 11:30 AM"""
    try:
        logger.info(f"Generating mid-morning message for user {user_id}")
        profile = get_user_profile(user_id)
        if not profile:
            logger.error(f"Profile not found for user {user_id}")
            return {"success": False, "error": "Profile not found"}
        
        business_name = profile.get("business_name", "there")
        
        data = {
            "business_name": business_name,
            "message_type": "mid_morning"
        }
        
        message = f"Hey {business_name}! 👋\n\nJust checking in - how's your day going? Ready to tackle some great content? 💪"
        
        return {
            "success": True,
            "content": message,
            "metadata": {
                **data,
                "sender": "chase"
            }
        }
    except Exception as e:
        logger.error(f"Error generating mid-morning message: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


def generate_afternoon_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate afternoon message at 2:00 PM"""
    try:
        logger.info(f"Generating afternoon message for user {user_id}")
        profile = get_user_profile(user_id)
        if not profile:
            logger.error(f"Profile not found for user {user_id}")
            return {"success": False, "error": "Profile not found"}
        
        business_name = profile.get("business_name", "there")
        
        data = {
            "business_name": business_name,
            "message_type": "afternoon"
        }
        
        message = f"Afternoon {business_name}! ☀️\n\nHope you're having a productive day! Time to create some amazing content? 🚀"
        
        return {
            "success": True,
            "content": message,
            "metadata": {
                **data,
                "sender": "chase"
            }
        }
    except Exception as e:
        logger.error(f"Error generating afternoon message: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


def generate_evening_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate evening message at 6:00 PM"""
    try:
        logger.info(f"Generating evening message for user {user_id}")
        profile = get_user_profile(user_id)
        if not profile:
            logger.error(f"Profile not found for user {user_id}")
            return {"success": False, "error": "Profile not found"}
        
        business_name = profile.get("business_name", "there")
        
        data = {
            "business_name": business_name,
            "message_type": "evening"
        }
        
        message = f"Evening {business_name}! 🌆\n\nHow did your day go? Ready to plan tomorrow's content? Let's make it great! ✨"
        
        return {
            "success": True,
            "content": message,
            "metadata": {
                **data,
                "sender": "chase"
            }
        }
    except Exception as e:
        logger.error(f"Error generating evening message: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# Helper functions for generating content

def get_industry_trends(industry: str, business_description: str = "") -> Dict[str, Any]:
    """Get industry trends using LLM"""
    try:
        context = f"for the {industry} industry"
        if business_description:
            context += f" and specifically for a business that: {business_description[:200]}"
        
        prompt = f"""
        Generate 3 current marketing and social media trends {context}.
        Focus on trends that are relevant to social media marketing and content creation.
        Make the trends specific and actionable for this type of business.
        
        For each trend, provide:
        - A clear, concise title (max 50 characters)
        - A brief description (1-2 sentences) that explains how this trend applies to this business
        
        Format as JSON with this structure:
        {{
            "trends": [
                {{
                    "trend": "Trend Title",
                    "description": "Brief description"
                }}
            ]
        }}
        """
        
        response = llm.invoke([HumanMessage(content=prompt)])
        
        try:
            trends_data = json.loads(response.content)
            return {"success": True, "trends": trends_data}
        except json.JSONDecodeError:
            # Fallback trends
            return {
                "success": True,
                "trends": {
                    "trends": [
                        {"trend": f"AI-Powered Marketing in {industry}", "description": "Leveraging AI for personalized content and automation."},
                        {"trend": "Video-First Content", "description": "Short-form video content is dominating engagement."},
                        {"trend": "Authentic Storytelling", "description": "Consumers seek genuine, behind-the-scenes content."}
                    ]
                }
            }
    except Exception as e:
        logger.error(f"Error getting trends: {e}")
        return {"success": False, "trends": {"trends": []}}


def generate_content_ideas(user_id: str, profile: Dict[str, Any], count: int = 3) -> List[str]:
    """Generate content ideas using LLM"""
    try:
        business_name = profile.get("business_name", "your business")
        industry = profile.get("industry", "technology")
        if isinstance(industry, list):
            industry = industry[0] if industry else "technology"
        
        business_description = profile.get("business_description", "")
        target_audience = profile.get("target_audience", [])
        content_themes = profile.get("content_themes", [])
        brand_voice = profile.get("brand_voice", "friendly")
        brand_tone = profile.get("brand_tone", "casual")
        
        # Build context string
        context_parts = [f"for {business_name} in the {industry} industry"]
        if business_description:
            context_parts.append(f"Business: {business_description[:150]}")
        if target_audience and isinstance(target_audience, list) and len(target_audience) > 0:
            context_parts.append(f"Target audience: {', '.join(target_audience[:3])}")
        if content_themes and isinstance(content_themes, list) and len(content_themes) > 0:
            context_parts.append(f"Content themes: {', '.join(content_themes[:3])}")
        context_parts.append(f"Brand voice: {brand_voice}, Tone: {brand_tone}")
        
        context = "\n".join(context_parts)
        
        prompt = f"""
        Generate {count} creative, specific content ideas {context}.
        Make each idea unique, actionable, and tailored to this specific business.
        Consider their target audience and brand voice when creating ideas.
        Return only the ideas, one per line, without numbering.
        Each idea should be specific to this business, not generic.
        """
        
        response = llm.invoke([HumanMessage(content=prompt)])
        ideas = [line.strip() for line in response.content.split("\n") if line.strip()][:count]
        
        if len(ideas) < count:
            # Add fallback ideas
            fallback = [
                f"Share a behind-the-scenes look at {business_name}",
                f"Create a tutorial related to {industry}",
                f"Post a customer success story"
            ]
            ideas.extend(fallback[:count - len(ideas)])
        
        return ideas[:count]
    except Exception as e:
        logger.error(f"Error generating content ideas: {e}")
        return [
            "Share a behind-the-scenes look at your business",
            "Create an educational post about your industry",
            "Post a customer testimonial"
        ]


def get_awareness_day() -> str:
    """Get today's awareness day or special observance"""
    try:
        today = datetime.now()
        # This would ideally use a calendar API
        # For now, return a generic message
        return f"Today is a great day to share your story and connect with your audience!"
    except:
        return "Today is a great day to engage with your audience!"


def get_best_posting_times(user_id: str) -> str:
    """Get best posting times based on analytics or defaults"""
    try:
        # This would analyze user's analytics to determine best times
        # For now, return default times
        return "9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM"
    except:
        return "9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM"


    """Generate call-to-action using LLM"""
    try:
        business_name = profile.get('business_name', 'business')
        industry = profile.get('industry', 'technology')
        if isinstance(industry, list):
            industry = industry[0] if industry else "technology"
        unique_value = profile.get('unique_value_proposition', '')
        primary_goals = profile.get('primary_goals', [])
        
        context = f"for {business_name} in the {industry} industry"
        if unique_value:
            context += f". Unique value: {unique_value[:100]}"
        if primary_goals and isinstance(primary_goals, list) and len(primary_goals) > 0:
            context += f". Goals: {', '.join(primary_goals[:2])}"
        
        prompt = f"""
        Create a compelling, specific call-to-action (CTA) {context} for a social media post.
        Make it action-oriented, aligned with their business goals, and tailored to this business.
        Keep it brief (1 sentence).
        """
        
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
    except Exception as e:
        logger.error(f"Error generating CTA: {e}")
        return "Visit our website to learn more!"


def analyze_what_worked(posts: List[Dict[str, Any]]) -> str:
    """Analyze what worked from today's posts"""
    try:
        if not posts:
            return "No posts to analyze today."
        
        # Find top performing posts
        scored_posts = []
        for post in posts:
            engagement = (post.get("likes_count", 0) + 
                         post.get("comments_count", 0) * 2 + 
                         post.get("shares_count", 0) * 3)
            scored_posts.append((engagement, post))
        
        scored_posts.sort(reverse=True)
        top_posts = scored_posts[:2] if len(scored_posts) >= 2 else scored_posts
        
        if top_posts:
            insights = []
            for _, post in top_posts:
                platform = post.get("platform", "social media")
                content_type = post.get("content_type", "post")
                insights.append(f"{platform} {content_type} posts performed well")
            
            return " • ".join(insights) if insights else "Your content is resonating with your audience!"
        
        return "Your content is resonating with your audience!"
    except Exception as e:
        logger.error(f"Error analyzing what worked: {e}")
        return "Your content is resonating with your audience!"


def analyze_what_didnt_work(posts: List[Dict[str, Any]]) -> str:
    """Analyze what didn't work from today's posts"""
    try:
        if not posts:
            return "No posts to analyze today."
        
        # Find low performing posts
        scored_posts = []
        for post in posts:
            engagement = (post.get("likes_count", 0) + 
                         post.get("comments_count", 0) * 2 + 
                         post.get("shares_count", 0) * 3)
            scored_posts.append((engagement, post))
        
        scored_posts.sort()
        low_posts = scored_posts[:1] if scored_posts else []
        
        if low_posts:
            _, post = low_posts[0]
            platform = post.get("platform", "social media")
            return f"{platform} posts had lower engagement - try different content types or posting times."
        
        return "All posts performed well today!"
    except Exception as e:
        logger.error(f"Error analyzing what didn't work: {e}")
        return "Continue experimenting with different content formats."


def get_follower_insights(user_id: str) -> Optional[str]:
    """Get follower insights from analytics"""
    try:
        # This would fetch actual follower insights from APIs
        # For now, return None to skip this section
        return None
    except Exception as e:
        logger.error(f"Error getting follower insights: {e}")
        return None


def generate_experiment_suggestion(user_id: str, profile: Dict[str, Any], posts: Optional[List[Dict[str, Any]]]) -> str:
    """Generate experiment suggestion using LLM"""
    try:
        business_name = profile.get('business_name', 'business')
        industry = profile.get('industry', 'technology')
        if isinstance(industry, list):
            industry = industry[0] if industry else "technology"
        business_description = profile.get('business_description', '')
        
        context = f"for {business_name} in the {industry} industry"
        if business_description:
            context += f". Business focus: {business_description[:150]}"
        
        prompt = f"""
        Suggest one specific A/B test or experiment {context} to try tomorrow.
        Make it actionable, relevant to social media marketing, and tailored to this business.
        Keep it brief (1-2 sentences).
        """
        
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
    except Exception as e:
        logger.error(f"Error generating experiment: {e}")
        return "Try posting at different times to see when your audience is most active."


def generate_content_topics(user_id: str, profile: Dict[str, Any], count: int = 2) -> List[str]:
    """Generate content topics for tomorrow using LLM"""
    try:
        business_name = profile.get('business_name', 'business')
        industry = profile.get('industry', 'technology')
        if isinstance(industry, list):
            industry = industry[0] if industry else "technology"
        business_description = profile.get('business_description', '')
        content_themes = profile.get('content_themes', [])
        
        context = f"for {business_name} in the {industry} industry"
        if business_description:
            context += f". Business: {business_description[:150]}"
        if content_themes and isinstance(content_themes, list) and len(content_themes) > 0:
            context += f". Preferred themes: {', '.join(content_themes[:3])}"
        
        prompt = f"""
        Suggest {count} specific, tailored content topics {context} to prepare for tomorrow.
        Make each topic unique and relevant to this specific business.
        Return only the topics, one per line.
        """
        
        response = llm.invoke([HumanMessage(content=prompt)])
        topics = [line.strip() for line in response.content.split("\n") if line.strip()][:count]
        
        if len(topics) < count:
            topics.extend([
                "Share industry insights and trends",
                "Create educational content about your services"
            ][:count - len(topics)])
        
        return topics[:count]
    except Exception as e:
        logger.error(f"Error generating content topics: {e}")
        return [
            "Share industry insights and trends",
            "Create educational content about your services"
        ][:count]


def fetch_today_posts(user_id: str) -> List[Dict[str, Any]]:
    """Fetch posts scheduled for today from content_posts table"""
    try:
        from datetime import date
        
        today = date.today()
        
        # Get user's campaigns
        campaigns_response = supabase.table("content_campaigns").select("id").eq("user_id", user_id).execute()
        campaign_ids = [campaign["id"] for campaign in campaigns_response.data] if campaigns_response.data else []
        
        if not campaign_ids:
            return []
        
        # Get posts scheduled for today
        response = supabase.table("content_posts").select(
            "*, content_campaigns!inner(*)"
        ).in_("campaign_id", campaign_ids).eq(
            "scheduled_date", today.isoformat()
        ).order("scheduled_time").execute()
        
        posts = response.data if response.data else []
        
        # Format posts
        formatted_posts = []
        for post in posts:
            formatted_post = {
                "id": post["id"],
                "title": post.get("title", "Untitled"),
                "content": post.get("content", ""),
                "platform": post.get("platform", "unknown"),
                "scheduled_at": f"{post.get('scheduled_date')}T{post.get('scheduled_time', '12:00:00')}",
                "status": post.get("status", "draft"),
                "created_at": post.get("created_at"),
                "media_url": post.get("primary_image_url"),
                "hashtags": post.get("hashtags", []),
                "post_type": post.get("post_type", "text"),
                "campaign_id": post.get("campaign_id"),
                "metadata": post.get("metadata", {}),
                "carousel_images": post.get("carousel_images", [])
            }
            formatted_posts.append(formatted_post)
        
        return formatted_posts
    except Exception as e:
        logger.error(f"Error fetching today's posts for user {user_id}: {e}")
        return []


def generate_post_reminder_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate post reminder message at 8 AM"""
    try:
        logger.info(f"Generating post reminder message for user {user_id}")
        profile = get_user_profile(user_id)
        if not profile:
            logger.error(f"Profile not found for user {user_id}")
            return {"success": False, "error": "Profile not found"}
        
        # Fetch today's posts
        posts = fetch_today_posts(user_id)
        
        return {
            "success": True,
            "content": "Reminder for your posts for today:",
            "posts": posts,
            "has_posts": len(posts) > 0,
            "post_count": len(posts)
        }
    except Exception as e:
        logger.error(f"Error generating post reminder message: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

