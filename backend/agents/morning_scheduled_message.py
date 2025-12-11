"""
Morning Scheduled Message Generator
Generates daily morning messages with social media performance insights
"""

import os
import json
import logging
import random
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, time as dt_time
import pytz
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
from cryptography.fernet import Fernet

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize logger
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
        logger.error(f"Error decrypting token: {e}")
        return encrypted_token


def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile information"""
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


def fetch_platform_follower_count(connection: dict, platform: str) -> int:
    """Fetch real-time follower/fan count from platform API"""
    try:
        # Get access token
        encrypted_token = connection.get('access_token_encrypted') or connection.get('access_token', '')
        if not encrypted_token:
            logger.warning(f"No access token found for {platform}")
            return 0
        
        access_token = decrypt_token(encrypted_token)
        account_id = connection.get('account_id') or connection.get('page_id') or connection.get('instagram_id') or connection.get('linkedin_id')
        
        if not account_id:
            logger.warning(f"No account_id found for {platform}")
            return 0
        
        platform_lower = platform.lower()
        
        # Skip Google and WordPress
        if platform_lower in ["google", "wordpress"]:
            return 0
        
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
                            return 0
                    else:
                        logger.warning(f"Error fetching Instagram account: {page_response.status_code}")
                        return 0
                except Exception as e:
                    logger.error(f"Error getting Instagram account ID: {e}")
                    return 0
            
            # Fetch Instagram follower count
            try:
                response = requests.get(
                    f"https://graph.facebook.com/v18.0/{instagram_account_id}",
                    params={
                        "access_token": access_token,
                        "fields": "followers_count"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get('followers_count', 0) or 0
                else:
                    logger.warning(f"Instagram API error: {response.status_code} - {response.text}")
            except Exception as e:
                logger.error(f"Error fetching Instagram follower count: {e}")
        
        elif platform_lower == "facebook":
            # Fetch Facebook page fan count
            try:
                response = requests.get(
                    f"https://graph.facebook.com/v18.0/{account_id}",
                    params={
                        "access_token": access_token,
                        "fields": "fan_count"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get('fan_count', 0) or 0
                else:
                    logger.warning(f"Facebook API error: {response.status_code} - {response.text}")
            except Exception as e:
                logger.error(f"Error fetching Facebook fan count: {e}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Error fetching follower count for {platform}: {e}")
        return 0


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


def fetch_old_social_insights(user_id: str, insight_date: datetime.date) -> Dict[str, Any]:
    """Fetch old social insights from the social_insights table for a specific date"""
    try:
        # Try to fetch insights for the specified date
        response = supabase.table("social_insights").select("*").eq("user_id", user_id).eq("insight_date", insight_date.isoformat()).execute()
        
        if not response.data:
            # If no data for that date, try to get the most recent data before that date
            response = supabase.table("social_insights").select("*").eq("user_id", user_id).lt("insight_date", insight_date.isoformat()).order("insight_date", desc=True).execute()
        
        if not response.data:
            return {
                "total_likes": 0,
                "total_subscribers": 0,
                "total_comments": 0,
                "platform_insights": []
            }
        
        # Aggregate all insights for that date (in case there are multiple platforms)
        total_likes = 0
        total_subscribers = 0
        total_comments = 0
        platform_insights = []
        
        for insight in response.data:
            total_likes += insight.get("likes_count", 0) or 0
            total_subscribers += insight.get("followers_count", 0) or 0
            total_subscribers += insight.get("subscribers_count", 0) or 0  # Add subscribers too
            total_comments += insight.get("comments_count", 0) or 0
            
            # Store platform-specific old insights
            platform_insights.append({
                "platform": insight.get("platform", "").lower(),
                "connection_id": insight.get("connection_id"),
                "likes_count": insight.get("likes_count", 0) or 0,
                "comments_count": insight.get("comments_count", 0) or 0,
                "followers_count": insight.get("followers_count", 0) or 0,
                "subscribers_count": insight.get("subscribers_count", 0) or 0,
                "shares_count": insight.get("shares_count", 0) or 0
            })
        
        return {
            "total_likes": total_likes,
            "total_subscribers": total_subscribers,
            "total_comments": total_comments,
            "platform_insights": platform_insights
        }
    except Exception as e:
        logger.error(f"Error fetching old social insights: {e}")
        return {
            "total_likes": 0,
            "total_subscribers": 0,
            "total_comments": 0,
            "platform_insights": []
        }


def calculate_today_social_metrics(user_id: str) -> Dict[str, Any]:
    """Calculate today's social media metrics from posts and connections"""
    try:
        # Get user's active connections
        connections = supabase.table("platform_connections").select("*").eq("user_id", user_id).eq("is_active", True).execute()
        
        if not connections.data:
            return {
                "platform_insights": [],
                "total_likes": 0,
                "total_subscribers": 0,
                "total_comments": 0
            }
        
        # Calculate date ranges for today
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Fetch today's posts
        today_posts = []
        try:
            # Try social_media_posts first
            posts_response = supabase.table("social_media_posts").select("*").eq("user_id", user_id).gte("created_at", today_start.isoformat()).lte("created_at", today_end.isoformat()).execute()
            today_posts = posts_response.data or []
        except:
            # Fallback to content_posts
            campaigns = supabase.table("content_campaigns").select("id").eq("user_id", user_id).execute()
            campaign_ids = [c["id"] for c in campaigns.data] if campaigns.data else []
            
            if campaign_ids:
                posts_response = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).gte("created_at", today_start.isoformat()).lte("created_at", today_end.isoformat()).execute()
                today_posts = posts_response.data or []
        
        # Calculate metrics per platform
        platform_insights = []
        total_likes = 0
        total_subscribers = 0
        total_comments = 0
        
        for connection in connections.data:
            platform = connection.get("platform", "").lower()
            connection_id = connection.get("id")
            account_name = connection.get("page_name") or connection.get("page_username") or connection.get("account_name") or ""
            
            # Fetch follower count from API (platform-specific)
            follower_count = fetch_platform_follower_count(connection, platform)
            
            # If API fetch fails, fallback to stored follower_count
            if follower_count == 0:
                follower_count = connection.get("follower_count", 0) or 0
            
            # Fetch latest post metrics from API
            latest_post_metrics = fetch_latest_post_metrics(connection, platform)
            platform_likes = latest_post_metrics.get("likes_count", 0) or 0
            platform_comments = latest_post_metrics.get("comments_count", 0) or 0
            platform_shares = latest_post_metrics.get("shares_count", 0) or 0
            
            # Also add metrics from today's posts in database (as backup/additional data)
            for post in today_posts:
                post_platform = post.get("platform", "").lower()
                if post_platform == platform:
                    # Use API data if available, otherwise use database data
                    if platform_likes == 0:
                        platform_likes += post.get("likes_count", 0) or 0
                    if platform_comments == 0:
                        platform_comments += post.get("comments_count", 0) or 0
                    if platform_shares == 0:
                        platform_shares += post.get("shares_count", 0) or 0
            
            # Build platform-specific metrics
            platform_metrics = {}
            if platform == "instagram":
                platform_metrics = {
                    "media_count": connection.get("media_count", 0) or 0
                }
            elif platform == "facebook":
                platform_metrics = {
                    "page_likes": follower_count
                }
            elif platform == "youtube":
                platform_metrics = {
                    "videos_count": connection.get("media_count", 0) or 0
                }
            
            # Skip Google and WordPress from insights
            if platform not in ["google", "wordpress"]:
                platform_insights.append({
                    "platform": platform,
                    "connection_id": connection_id,
                    "account_name": account_name,
                    "followers_count": follower_count if platform in ["facebook", "instagram", "linkedin", "twitter"] else 0,
                    "subscribers_count": follower_count if platform in ["youtube"] else 0,
                    "likes_count": platform_likes,
                    "comments_count": platform_comments,
                    "shares_count": platform_shares,
                    "platform_metrics": platform_metrics
                })
                
                # Add to totals
                total_likes += platform_likes
                total_comments += platform_comments
                if platform in ["facebook", "instagram", "linkedin", "twitter"]:
                    total_subscribers += follower_count
                elif platform == "youtube":
                    total_subscribers += follower_count
        
        return {
            "platform_insights": platform_insights,
            "total_likes": total_likes,
            "total_subscribers": total_subscribers,
            "total_comments": total_comments
        }
    except Exception as e:
        logger.error(f"Error calculating today's social metrics: {e}")
        return {
            "platform_insights": [],
            "total_likes": 0,
            "total_subscribers": 0,
            "total_comments": 0
        }


def save_social_insights(user_id: str, insight_date: datetime.date, platform_insights: List[Dict[str, Any]]) -> bool:
    """Save today's social insights to the social_insights table"""
    try:
        today_str = insight_date.isoformat()
        
        # Save insights for each platform
        for insight in platform_insights:
            try:
                # Check if insight already exists for this date and connection
                existing = supabase.table("social_insights").select("id").eq("user_id", user_id).eq("platform", insight["platform"]).eq("insight_date", today_str).eq("connection_id", insight.get("connection_id")).execute()
                
                insight_data = {
                    "user_id": user_id,
                    "platform": insight["platform"],
                    "insight_date": today_str,
                    "connection_id": insight.get("connection_id"),
                    "account_name": insight.get("account_name", ""),
                    "followers_count": insight.get("followers_count", 0),
                    "subscribers_count": insight.get("subscribers_count", 0),
                    "likes_count": insight.get("likes_count", 0),
                    "comments_count": insight.get("comments_count", 0),
                    "shares_count": insight.get("shares_count", 0),
                    "platform_metrics": insight.get("platform_metrics", {})
                }
                
                if existing.data and len(existing.data) > 0:
                    # Update existing insight
                    supabase.table("social_insights").update(insight_data).eq("id", existing.data[0]["id"]).execute()
                    logger.info(f"Updated social insight for {insight['platform']} on {today_str}")
                else:
                    # Insert new insight
                    supabase.table("social_insights").insert(insight_data).execute()
                    logger.info(f"Saved new social insight for {insight['platform']} on {today_str}")
            except Exception as e:
                logger.error(f"Error saving insight for platform {insight.get('platform')}: {e}")
                continue
        
        return True
    except Exception as e:
        logger.error(f"Error saving social insights: {e}")
        return False


def fetch_yesterday_social_metrics(user_id: str) -> Dict[str, Any]:
    """Fetch yesterday's social media performance metrics from all connected platforms"""
    try:
        # Calculate date ranges
        now = datetime.now()
        yesterday = (now - timedelta(days=1)).date()
        today = now.date()
        
        # Fetch old data (yesterday's insights from social_insights table)
        old_insights = fetch_old_social_insights(user_id, yesterday)
        
        # Calculate today's metrics
        today_metrics = calculate_today_social_metrics(user_id)
        
        # Calculate differences per platform
        platform_insights_with_diff = []
        for today_insight in today_metrics["platform_insights"]:
            platform = today_insight.get("platform", "").lower()
            connection_id = today_insight.get("connection_id")
            
            # Find matching old insight
            old_insight = None
            for old in old_insights.get("platform_insights", []):
                if old.get("platform", "").lower() == platform and old.get("connection_id") == connection_id:
                    old_insight = old
                    break
            
            # Calculate differences
            old_likes = old_insight.get("likes_count", 0) or 0 if old_insight else 0
            old_comments = old_insight.get("comments_count", 0) or 0 if old_insight else 0
            old_followers = old_insight.get("followers_count", 0) or 0 if old_insight else 0
            old_subscribers = old_insight.get("subscribers_count", 0) or 0 if old_insight else 0
            old_shares = old_insight.get("shares_count", 0) or 0 if old_insight else 0
            
            today_likes = today_insight.get("likes_count", 0) or 0
            today_comments = today_insight.get("comments_count", 0) or 0
            today_followers = today_insight.get("followers_count", 0) or 0
            today_subscribers = today_insight.get("subscribers_count", 0) or 0
            today_shares = today_insight.get("shares_count", 0) or 0
            
            # Calculate differences
            likes_diff = today_likes - old_likes
            comments_diff = today_comments - old_comments
            subscribers_diff = (today_followers + today_subscribers) - (old_followers + old_subscribers)
            shares_diff = today_shares - old_shares
            
            platform_insights_with_diff.append({
                **today_insight,
                "previous_likes": old_likes,
                "previous_comments": old_comments,
                "previous_followers": old_followers,
                "previous_subscribers": old_subscribers,
                "previous_shares": old_shares,
                "likes_diff": likes_diff,
                "comments_diff": comments_diff,
                "subscribers_diff": subscribers_diff,
                "shares_diff": shares_diff
            })
        
        # Calculate total differences
        likes_diff = today_metrics["total_likes"] - old_insights["total_likes"]
        subscribers_diff = today_metrics["total_subscribers"] - old_insights["total_subscribers"]
        comments_diff = today_metrics["total_comments"] - old_insights["total_comments"]
        
        # Save today's data to social_insights table (actual counts, not differences)
        save_social_insights(user_id, today, today_metrics["platform_insights"])
        
        return {
            "total_likes": today_metrics["total_likes"],
            "total_subscribers": today_metrics["total_subscribers"],
            "total_comments": today_metrics["total_comments"],
            "previous_likes": old_insights["total_likes"],
            "previous_subscribers": old_insights["total_subscribers"],
            "previous_comments": old_insights["total_comments"],
            "likes_diff": likes_diff,
            "subscribers_diff": subscribers_diff,
            "comments_diff": comments_diff,
            "platform_insights": platform_insights_with_diff
        }
    except Exception as e:
        logger.error(f"Error fetching yesterday's social metrics: {e}")
        return {
            "total_likes": 0,
            "total_subscribers": 0,
            "total_comments": 0,
            "previous_likes": 0,
            "previous_subscribers": 0,
            "previous_comments": 0,
            "likes_diff": 0,
            "subscribers_diff": 0,
            "comments_diff": 0,
            "platform_insights": []
        }


def format_morning_message(data: Dict[str, Any]) -> str:
    """Format morning message with social media performance (platform-wise)"""
    # 7 variations of opening messages
    opening_variations = [
        "Good morning, Just a quick update on your social media performance yesterday",
        "Good morning, Here's a quick snapshot of your social media performance yesterday",
        "Good morning, Let me share your social media performance update from yesterday",
        "Good morning, Quick update on how your social media performed yesterday",
        "Good morning, Here's your social media performance summary from yesterday",
        "Good morning, Just a brief update on your social media performance yesterday",
        "Good morning, Quick recap of your social media performance yesterday"
    ]
    
    # Select random opening
    opening = random.choice(opening_variations)
    
    message = f"{opening}:\n\n"
    
    # Get platform insights
    platform_insights = data.get("platform_insights", [])
    
    # Get metrics for overall comparison
    total_likes = data.get("total_likes", 0)
    total_subscribers = data.get("total_subscribers", 0)
    total_comments = data.get("total_comments", 0)
    previous_likes = data.get("previous_likes", 0)
    previous_subscribers = data.get("previous_subscribers", 0)
    previous_comments = data.get("previous_comments", 0)
    
    # Format platform-wise metrics with differences as a table
    # Table structure: Insights as rows, Platforms as columns
    if platform_insights and len(platform_insights) > 0:
        # Collect all platforms and their data
        platforms_data = []
        for insight in platform_insights:
            platform = insight.get("platform", "").capitalize()
            account_name = insight.get("account_name", "")
            
            # Format platform name with account name if available
            platform_display = platform
            if account_name:
                platform_display = f"{platform} ({account_name})"
            
            platforms_data.append({
                "name": platform_display,
                "likes_diff": insight.get("likes_diff", 0) or 0,
                "comments_diff": insight.get("comments_diff", 0) or 0,
                "subscribers_diff": insight.get("subscribers_diff", 0) or 0,
                "shares_diff": insight.get("shares_diff", 0) or 0
            })
        
        # Create table header
        header = "| Insights |"
        separator = "|---------|"
        for platform in platforms_data:
            header += f" {platform['name']} |"
            separator += " " + "-" * max(len(platform['name']), 10) + " |"
        
        message += header + "\n"
        message += separator + "\n"
        
        # Format each insight as a row
        # Likes row
        likes_row = "| Likes |"
        for platform in platforms_data:
            likes_diff = platform['likes_diff']
            likes_display = f"+{likes_diff}" if likes_diff > 0 else str(likes_diff)
            likes_row += f" {likes_display} |"
        message += likes_row + "\n"
        
        # Subscribers row
        subscribers_row = "| Subscribers |"
        for platform in platforms_data:
            subscribers_diff = platform['subscribers_diff']
            if subscribers_diff > 0:
                subscribers_display = f"+{subscribers_diff}"
            elif subscribers_diff < 0:
                subscribers_display = str(subscribers_diff)
            else:
                subscribers_display = "0"
            subscribers_row += f" {subscribers_display} |"
        message += subscribers_row + "\n"
        
        # Comments row
        comments_row = "| Comments |"
        for platform in platforms_data:
            comments_diff = platform['comments_diff']
            comments_display = f"+{comments_diff}" if comments_diff > 0 else str(comments_diff)
            comments_row += f" {comments_display} |"
        message += comments_row + "\n"
        
        # Shares row
        shares_row = "| Shares |"
        for platform in platforms_data:
            shares_diff = platform['shares_diff']
            shares_display = f"+{shares_diff}" if shares_diff > 0 else str(shares_diff)
            shares_row += f" {shares_display} |"
        message += shares_row + "\n"
        
        message += "\n"
    else:
        # Fallback to aggregated metrics if no platform insights
        message += f"Likes: {total_likes}\n"
        message += f"Subscribers: {total_subscribers}\n"
        message += f"Comments: {total_comments}\n\n"
    
    # Calculate changes
    likes_change = total_likes - previous_likes
    subscribers_change = total_subscribers - previous_subscribers
    comments_change = total_comments - previous_comments
    
    # Calculate total shares change from platform insights
    total_shares_change = 0
    if platform_insights and len(platform_insights) > 0:
        for insight in platform_insights:
            total_shares_change += insight.get("shares_diff", 0) or 0
    
    # Calculate weighted score: 4*shares + 3*comments + 2*subscribers + 1*likes
    weighted_score = (4 * total_shares_change) + (3 * comments_change) + (2 * subscribers_change) + (1 * likes_change)
    
    # 7 variations of average messages (score < 10)
    average_messages = [
        "Our engagement is steady. There's room for growth - let's try some new strategies!",
        "Our performance is average. Small changes can make a big difference!",
        "We're maintaining our position. Time to experiment with fresh content ideas!",
        "Our metrics are holding steady. Let's push for better engagement!",
        "We're doing okay, but we can do better. Consistency and creativity will help!",
        "Our engagement is stable. Try mixing up content types to boost performance!",
        "We're on a steady path. A few tweaks could accelerate our growth!"
    ]
    
    # 7 variations of good messages (score 10-50)
    good_messages = [
        "Great work! Our engagement is growing. Keep up the momentum!",
        "Excellent progress! We're on the right track!",
        "Amazing! Our numbers are climbing. Keep doing what we're doing!",
        "Fantastic! Our audience is responding well. Stay consistent!",
        "Well done! Our social media is gaining traction. Keep up the great work!",
        "Impressive! Our performance is improving. We're building something great!",
        "Outstanding! Our engagement is on the rise. Keep the right track!"
    ]
    
    # 7 variations of excellent messages (score > 50)
    excellent_messages = [
        "Exceptional performance! Our engagement is skyrocketing. This is outstanding work!",
        "Incredible results! Our social media is performing exceptionally well. Keep this momentum going!",
        "Outstanding achievement! Our numbers are soaring. You're doing amazing work!",
        "Phenomenal growth! Our audience engagement is at an all-time high. Celebrate this success!",
        "Remarkable results! Our social media strategy is working brilliantly. Keep up the excellent work!",
        "Extraordinary performance! Our engagement metrics are through the roof. This is truly impressive!",
        "Spectacular results! Our social media is thriving. You're setting new benchmarks!"
    ]
    
    # 7 variations of engagement reducing acknowledgments (for negative scores)
    engagement_reducing_messages = [
        "Our engagement is reducing.",
        "Our numbers are declining.",
        "We're seeing a dip in engagement.",
        "Our engagement has decreased.",
        "Our performance is down.",
        "We're experiencing lower engagement.",
        "Our metrics are dropping."
    ]
    
    # 7 variations of pro tip messages (without "Pro tip:" prefix)
    pro_tip_messages = [
        "Try posting at different times to reach more of our audience. Consistency is key!",
        "Engage with our audience by responding to comments and asking questions. Interaction drives growth!",
        "Use relevant hashtags and post when our audience is most active. Timing matters!",
        "Share behind-the-scenes content and stories. Authenticity builds connection!",
        "Create content that encourages engagement - ask questions, run polls, share valuable insights!",
        "Analyze what content performs best and create more of that. Data-driven decisions lead to growth!",
        "Collaborate with others in our niche and cross-promote. Community support amplifies reach!"
    ]
    
    # Add message based on weighted score
    if weighted_score < 0:
        # Negative score - show engagement reducing message with pro tip
        engagement_msg = random.choice(engagement_reducing_messages)
        tip_msg = random.choice(pro_tip_messages)
        message += f"{engagement_msg} {tip_msg}"
    elif weighted_score < 10:
        # Average performance (0 to 9)
        message += random.choice(average_messages)
    elif weighted_score >= 10 and weighted_score <= 50:
        # Good performance (10 to 50)
        message += random.choice(good_messages)
    else:
        # Excellent performance (> 50)
        message += random.choice(excellent_messages)
    
    return message


def check_morning_message_exists(user_id: str, timezone: str = "UTC") -> bool:
    """Check if morning message already exists for today"""
    try:
        # Get current time in user's timezone
        try:
            user_timezone = pytz.timezone(timezone)
        except:
            user_timezone = pytz.UTC
        
        now_utc = datetime.now(pytz.UTC)
        now_user_tz = now_utc.astimezone(user_timezone)
        today = now_user_tz.date()
        
        # Get UTC date range for today
        today_utc = now_utc.date()
        today_start_utc = datetime.combine(today_utc, datetime.min.time()).replace(tzinfo=pytz.UTC)
        today_end_utc = datetime.combine(today_utc, datetime.max.time()).replace(tzinfo=pytz.UTC)
        
        # Check if morning message exists for today
        existing_response = supabase.table("chatbot_scheduled_messages").select("id").eq(
            "user_id", user_id
        ).eq("message_type", "morning").gte(
            "scheduled_time", today_start_utc.isoformat()
        ).lt(
            "scheduled_time", today_end_utc.isoformat()
        ).execute()
        
        return len(existing_response.data or []) > 0
    except Exception as e:
        logger.error(f"Error checking morning message existence: {e}")
        return False


def ensure_morning_message_on_login(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate morning message on login if it doesn't exist and it's before 9:00 AM"""
    try:
        # Check if message already exists
        if check_morning_message_exists(user_id, timezone):
            logger.info(f"Morning message already exists for user {user_id} today")
            return {"success": True, "message": "Morning message already exists", "generated": False}
        
        # Get current time in user's timezone
        try:
            user_timezone = pytz.timezone(timezone)
        except:
            user_timezone = pytz.UTC
        
        now_utc = datetime.now(pytz.UTC)
        now_user_tz = now_utc.astimezone(user_timezone)
        current_hour = now_user_tz.hour
        current_minute = now_user_tz.minute
        today = now_user_tz.date()
        
        # Check if it's before 9:00 AM
        current_minutes = current_hour * 60 + current_minute
        morning_time_minutes = 9 * 60  # 9:00 AM
        
        if current_minutes >= morning_time_minutes:
            # It's 9:00 AM or later - don't generate, wait for scheduler
            logger.info(f"User {user_id} logged in at {current_hour}:{current_minute:02d} (after 9:00 AM), waiting for scheduler")
            return {"success": True, "message": "After 9:00 AM, waiting for scheduled generation", "generated": False}
        
        # It's before 9:00 AM - generate now
        logger.info(f"User {user_id} logged in at {current_hour}:{current_minute:02d} (before 9:00 AM), generating morning message")
        
        # Generate morning message
        result = generate_morning_message(user_id, timezone)
        
        if result and result.get("success"):
            # Save to database with scheduled time of 9:00 AM today
            scheduled_time = user_timezone.localize(
                datetime.combine(today, dt_time(9, 0))
            )
            
            # Convert to UTC for storage
            scheduled_time_utc = scheduled_time.astimezone(pytz.UTC)
            
            message_data = {
                "user_id": user_id,
                "message_type": "morning",
                "content": result["content"],
                "scheduled_time": scheduled_time_utc.isoformat(),
                "metadata": result.get("metadata", {}),
                "is_delivered": False
            }
            
            insert_result = supabase.table("chatbot_scheduled_messages").insert(message_data).execute()
            
            if insert_result.data:
                logger.info(f"Successfully generated and saved morning message for user {user_id} on login")
                return {"success": True, "message": "Morning message generated", "generated": True}
            else:
                logger.error(f"Failed to save morning message for user {user_id}")
                return {"success": False, "error": "Failed to save message", "generated": False}
        else:
            logger.error(f"Failed to generate morning message for user {user_id}: {result.get('error', 'Unknown error') if result else 'No result'}")
            return {"success": False, "error": result.get("error", "Failed to generate message") if result else "No result", "generated": False}
            
    except Exception as e:
        logger.error(f"Error ensuring morning message on login for user {user_id}: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


def generate_morning_message(user_id: str, timezone: str = "UTC") -> Dict[str, Any]:
    """Generate morning message with social media performance metrics"""
    try:
        logger.info(f"Generating morning message for user {user_id}")
        profile = get_user_profile(user_id)
        if not profile:
            logger.error(f"Profile not found for user {user_id}")
            return {"success": False, "error": "Profile not found"}
        
        business_name = profile.get("business_name", "Unknown Business")
        logger.info(f"Generating message for business: {business_name}")
        
        # Fetch yesterday's social media metrics
        metrics = fetch_yesterday_social_metrics(user_id)
        logger.info(f"Fetched metrics for {business_name}: likes={metrics['total_likes']}, subscribers={metrics['total_subscribers']}, comments={metrics['total_comments']}")
        
        data = {
            "total_likes": metrics["total_likes"],
            "total_subscribers": metrics["total_subscribers"],
            "total_comments": metrics["total_comments"],
            "previous_likes": metrics["previous_likes"],
            "previous_subscribers": metrics["previous_subscribers"],
            "previous_comments": metrics["previous_comments"],
            "platform_insights": metrics.get("platform_insights", [])
        }
        
        message = format_morning_message(data)
        logger.info(f"Successfully generated morning message for {business_name} (user {user_id})")
        
        return {
            "success": True,
            "content": message,
            "metadata": data
        }
    except Exception as e:
        logger.error(f"Error generating morning message for user {user_id}: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

