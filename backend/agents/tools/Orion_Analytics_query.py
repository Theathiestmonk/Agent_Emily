"""
Orion Analytics Query Tool - FULL ANALYTICS ENGINE

This module contains ALL analytics business logic and execution.

Architecture:
- Emily (emily.py): Collects fields, normalizes payload, asks clarifying questions
- Orion (this file): Executes all analytics logic, applies defaults, formats responses

Orion Responsibilities:
1. Default metric assignment (insight mode)
2. Default platform inference (connected platforms, last post platform)
3. Multi-platform processing
4. Improvement generation
5. Insight computation
6. Watch time special handling
7. Blog analytics processing
8. Date range integration
9. Response formatting
10. Graceful error handling

Emily passes a clean AnalyticsPayload to Orion.
Orion returns formatted responses ready for display.

This module reuses functions from morning_scheduled_message.py to avoid code duplication.
"""

import os
import logging
import requests
from typing import Dict, Any, List, Optional, Tuple
from agents.emily import AnalyticsPayload
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Initialize Supabase client (reuse existing pattern)
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

# Import reusable functions from morning_scheduled_message.py
try:
    from agents.morning_scheduled_message import (
        decrypt_token,
        fetch_latest_post_metrics,
        fetch_platform_follower_count
    )
    logger.info("✅ Successfully imported functions from morning_scheduled_message.py")
except ImportError as e:
    logger.error(f"❌ Failed to import from morning_scheduled_message.py: {e}")
    # Fallback decrypt_token if import fails
    def decrypt_token(encrypted_token: str) -> str:
        """Fallback decrypt token - should not be used if import succeeds"""
        from cryptography.fernet import Fernet
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if not encryption_key or not encrypted_token:
            return encrypted_token or ""
        try:
            cipher_suite = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
            return cipher_suite.decrypt(encrypted_token.encode()).decode()
        except Exception:
            return encrypted_token


def execute_analytics_query(payload: AnalyticsPayload, user_id: str) -> Dict[str, Any]:
    """
    Execute analytics query - FULL ANALYTICS ENGINE.
    
    Handles all analytics business logic:
    - Default metric assignment
    - Platform fallback logic
    - Multi-platform processing
    - Watch time special handling
    - Date range integration
    - Response formatting
        
    Returns:
        Dict with consistent structure:
        - success: bool
        - data: Dict (on success)
        - clarifying_question: str (if needs clarification)
        - options: List[str] (if clarification needed)
        - message: str (if error or info)
        - error: str (if exception)
    """
    try:
        # Apply default metrics for insight mode if not provided
        if payload.insight_type == "insight":
            if payload.source == "social_media":
                if not payload.metrics or len(payload.metrics) == 0:
                    logger.info("Applying default metrics for insight mode: ['comments', 'likes']")
                    payload = AnalyticsPayload(
                        insight_type=payload.insight_type,
                        source=payload.source,
                        platform=payload.platform,
                        metrics=["comments", "likes"],
                        blog_metrics=payload.blog_metrics,
                        date_range=payload.date_range
                    )
            elif payload.source == "blog":
                if not payload.blog_metrics or len(payload.blog_metrics) == 0:
                    logger.info("Applying default blog metrics for insight mode: ['views', 'read_time', 'top_articles']")
                    payload = AnalyticsPayload(
                        insight_type=payload.insight_type,
                        source=payload.source,
                        platform=payload.platform,
                        metrics=payload.metrics,
                        blog_metrics=["views", "read_time", "top_articles"],
                        date_range=payload.date_range
                    )

        # Route to appropriate handler
        if payload.source == "social_media":
            return _handle_social_media_analytics(payload, user_id)
        elif payload.source == "blog":
            return _handle_blog_analytics(payload, user_id)
        else:
            return {
                "success": False,
                "clarifying_question": "Please specify whether you want social media or blog analytics.",
                "options": ["social_media", "blog"]
            }

    except Exception as e:
        logger.error("Error in execute_analytics_query", exc_info=True)
        return {
            "success": False,
            "error": f"An error occurred while processing your analytics request: {str(e)}"
        }


# -------------------------------------------------------------
# HELPER FUNCTIONS
# -------------------------------------------------------------

def _get_platforms_with_fallback(payload: AnalyticsPayload, user_id: str, allow_empty: bool = False) -> Tuple[List[str], Optional[Dict[str, Any]]]:
    """
    Get platforms with fallback logic:
    1. Use payload.platform
    2. Else fetch_connected_platforms(user_id)
    3. Else fetch_last_post_platform(user_id)
    4. Else return clarifying question if not allow_empty
    
    Returns:
        (platforms_list, clarifying_question_dict_or_none)
    """
    platforms = payload.platform if payload.platform else fetch_connected_platforms(user_id)
    
    # Normalize to list
    if platforms and not isinstance(platforms, list):
        platforms = [platforms]
    
    if not platforms or len(platforms) == 0:
        # Try last post platform as fallback
        last_platform = fetch_last_post_platform(user_id)
        if last_platform:
            platforms = [last_platform]
            logger.info(f"Using last post platform as fallback: {last_platform}")
        elif not allow_empty:
            # No platform available - ask user
            return None, {
                "success": False,
                "clarifying_question": "Which platform should I analyze? Please specify a platform.",
                "options": ["instagram", "facebook", "youtube", "linkedin", "twitter", "pinterest"]
            }
    
    return platforms or [], None


def _is_post_level_metrics(metrics: List[str]) -> bool:
    """Check if metrics are post-level (likes, comments, shares)."""
    post_level_metrics = ["likes", "comments", "shares", "like", "comment", "share"]
    return any(m.lower() in post_level_metrics for m in metrics)


def _transform_post_metrics(post_metrics: Dict[str, Any], requested_metrics: List[str]) -> Dict[str, Any]:
    """Transform post metrics from API format (likes_count) to user format (likes)."""
    result = {}
    
    if "likes" in requested_metrics or "like" in [m.lower() for m in requested_metrics]:
        result["likes"] = post_metrics.get("likes_count", 0) or 0
    
    if "comments" in requested_metrics or "comment" in [m.lower() for m in requested_metrics]:
        result["comments"] = post_metrics.get("comments_count", 0) or 0
    
    if "shares" in requested_metrics or "share" in [m.lower() for m in requested_metrics]:
        result["shares"] = post_metrics.get("shares_count", 0) or 0
    
    return result


def _calculate_period(date_range: Optional[str]) -> str:
    """Calculate API period from date_range string."""
    if not date_range:
        return "day"
    
    date_lower = date_range.lower()
    if "month" in date_lower or "30" in date_range:
        return "days_28"
    elif "week" in date_lower or "7" in date_range:
        return "week"
    else:
        return "day"


def _route_to_platform_fetcher(platform: str, connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Route to platform-specific fetcher based on platform name."""
    platform_lower = platform.lower()
    
    if platform_lower == "instagram":
        return fetch_instagram_insights(connection, metrics, date_range)
    elif platform_lower == "facebook":
        return fetch_facebook_insights(connection, metrics, date_range)
    elif platform_lower == "youtube":
        return fetch_youtube_insights(connection, metrics, date_range)
    elif platform_lower == "linkedin":
        return fetch_linkedin_insights(connection, metrics, date_range)
    elif platform_lower in ["twitter", "x"]:
        return fetch_twitter_insights(connection, metrics, date_range)
    else:
        logger.warning(f"Unsupported platform: {platform}")
        return None


def _format_platform_insights_message(insights_by_platform: Dict[str, Dict[str, Any]], platforms: List[str], metrics: List[str], platforms_without_data: List[str] = None) -> str:
    """Format user-friendly message from platform insights."""
    platforms_without_data = platforms_without_data or []
    
    if len(platforms) == 1:
        # Single platform format
        platform = platforms[0]
        platform_insights = insights_by_platform[platform]
        
        message = f"Here's what I found for **{platform.title()}**:\n\n"
        
        if isinstance(platform_insights, dict):
            for metric, value in platform_insights.items():
                formatted_metric = metric.replace("_", " ").title()
                message += f"• **{formatted_metric}**: {value}\n"
        else:
            message += f"{platform_insights}\n"
        
        message += f"\n*Analyzed metrics: {', '.join(metrics)}*"
    else:
        # Multi-platform format
        platform_list = ", ".join([p.title() for p in platforms])
        message = f"Here are your analytics insights for {platform_list}:\n\n"
        
        for platform, platform_insights in insights_by_platform.items():
            message += f"**{platform.title()}:**\n"
            if isinstance(platform_insights, dict):
                for metric, value in platform_insights.items():
                    formatted_metric = metric.replace("_", " ").title()
                    message += f"• {formatted_metric}: {value}\n"
            else:
                message += f"{platform_insights}\n"
            message += "\n"
        
        message += f"*Analyzed metrics: {', '.join(metrics)}*"
        
        if platforms_without_data:
            message += f"\n\n*Note: No data available for {', '.join(platforms_without_data)}*"
    
    return message


def _handle_social_media_analytics(payload: AnalyticsPayload, user_id: str) -> Dict[str, Any]:
    """Handle social media analytics (both insight and improvement modes)"""
    
    if payload.insight_type == "improvement":
        return _handle_improvement_mode(payload, user_id)
    else:
        return _handle_insight_mode(payload, user_id)


def _handle_improvement_mode(payload: AnalyticsPayload, user_id: str) -> Dict[str, Any]:
    """Handle improvement mode - requires metrics."""
    
    # Metrics are REQUIRED for improvement mode
    if not payload.metrics or len(payload.metrics) == 0:
        return {
            "success": False,
            "clarifying_question": "What would you like to improve? Choose one or more metrics:",
            "options": [
                "reach", "impressions", "engagement", "likes", "comments", "shares",
                "saves", "views", "profile_visits", "followers", "growth", "top_posts",
                "all_posts", "average_watch_time", "avg_view_time", "watch_time"
            ]
        }
    
    # Get platforms with fallback
    platforms, clarifying_q = _get_platforms_with_fallback(payload, user_id)
    if clarifying_q:
        return clarifying_q
    
    # Process each platform (multi-platform support)
    improvements_by_platform = {}
    platforms_with_data = []
    platforms_without_data = []
    
    for platform in platforms:
        platform_str = str(platform).strip().lower()
        if not platform_str:
            continue
        
        # Fetch platform data
        platform_data = fetch_platform_insights(platform_str, user_id, payload.date_range)
        
        if platform_data is None:
            platforms_without_data.append(platform_str)
            continue
        
        # Generate improvements
        platform_improvements = generate_improvements(platform_data, payload.metrics)
        
        if platform_improvements is None:
            platforms_without_data.append(platform_str)
            continue
        
        improvements_by_platform[platform_str] = platform_improvements
        platforms_with_data.append(platform_str)
    
    # Handle results
    if not improvements_by_platform:
        return {
            "success": False,
            "error": f"No analytics data found for the specified platforms ({', '.join(platforms)}) and metrics. Please ensure your platforms are connected and have data."
        }
    
    # Build response with formatted message
    response_data = {
        "type": "improvement",
        "improvements": improvements_by_platform,
        "metrics": payload.metrics,
        "platforms": platforms_with_data
    }
    
    # Add date_range if present
    if payload.date_range:
        response_data["date_range"] = payload.date_range
    
    # Add info about platforms without data
    if platforms_without_data:
        response_data["platforms_without_data"] = platforms_without_data
    
    # Format user-friendly message
    platform_list = ", ".join([p.title() for p in platforms_with_data])
    metrics_list = ", ".join(payload.metrics)
    response_data["message"] = (
        f"Here are some suggestions to improve your **{metrics_list}** performance "
        f"for {platform_list}:\n\n"
    )
    
    # Add improvement details per platform
    for platform, improvement_data in improvements_by_platform.items():
        response_data["message"] += f"**{platform.title()}:**\n"
        if isinstance(improvement_data, dict) and "suggestion" in improvement_data:
            response_data["message"] += f"{improvement_data['suggestion']}\n\n"
        elif isinstance(improvement_data, dict):
            # Format dict improvements
            for key, value in improvement_data.items():
                formatted_key = key.replace("_", " ").title()
                response_data["message"] += f"• {formatted_key}: {value}\n"
            response_data["message"] += "\n"
        else:
            response_data["message"] += f"{improvement_data}\n\n"
    
    if platforms_without_data:
        response_data["message"] += f"\n*Note: No data available for {', '.join(platforms_without_data)}*"
        
        return {
            "success": True,
        "data": response_data
    }


def _handle_insight_mode(payload: AnalyticsPayload, user_id: str) -> Dict[str, Any]:
    """Handle insight mode - metrics optional, supports multi-platform."""
    
    metrics = payload.metrics or ["comments", "likes"]
    
    # Get platforms with fallback
    platforms, clarifying_q = _get_platforms_with_fallback(payload, user_id)
    if clarifying_q:
        return clarifying_q
    
    # Special handling for watch time metrics - ONLY for YouTube
    watch_time_metrics = ["avg_view_time", "average_watch_time", "watch_time"]
    has_watch_time_metrics = any(m in metrics for m in watch_time_metrics)
    
    # Check if we have ONLY YouTube platform
    if has_watch_time_metrics and len(platforms) == 1 and platforms[0].lower() == "youtube":
        logger.info("Watch-time metrics requested for YouTube platform only, using watch-time handler")
        return _handle_watch_time_insight(user_id, metrics)
    
    # Process ALL platforms (multi-platform support)
    insights_by_platform = {}
    platforms_with_data = []
    platforms_without_data = []
    
    for platform in platforms:
        platform_str = str(platform).strip().lower()
        if not platform_str:
            continue
        
        if has_watch_time_metrics and platform_str != "youtube":
            logger.info(f"Watch-time metric requested but platform is {platform_str} (not YouTube), processing as normal insights")
        
        platform_insights = fetch_insights_for_metrics(platform_str, user_id, metrics, payload.date_range)
        
        if platform_insights is None:
            platforms_without_data.append(platform_str)
            continue
        
        insights_by_platform[platform_str] = platform_insights
        platforms_with_data.append(platform_str)
    
    # Handle results
    if not insights_by_platform:
        return {
            "success": False,
            "error": f"No analytics data found for the specified platforms ({', '.join(platforms)}). Please ensure your platforms are connected and have data."
        }
    
    # Build response
    response_data = {
        "type": "insight",
        "insights": insights_by_platform,
        "metrics": metrics,
        "platforms": platforms_with_data
    }
    
    if payload.date_range:
        response_data["date_range"] = payload.date_range
    
    if platforms_without_data:
        response_data["platforms_without_data"] = platforms_without_data
    
    # Format message using helper
    if len(platforms_with_data) == 1:
        response_data["platform"] = platforms_with_data[0]
    
    response_data["message"] = _format_platform_insights_message(
        insights_by_platform, platforms_with_data, metrics, platforms_without_data
    )
    
    return {
        "success": True,
        "data": response_data
    }


def _handle_watch_time_insight(user_id: str, metrics: List[str]) -> Dict[str, Any]:
    """Handle special watch time insight request for YouTube videos."""
    
    video_post = fetch_latest_video_post(user_id)
    if not video_post:
        return {
            "success": False,
            "error": "No video post found to calculate average view time."
        }
    
    avg_time = compute_avg_watch_time(video_post)
    quality_assessment = "great" if avg_time > 30 else "good" if avg_time >= 15 else "something to work on"
    
    return {
        "success": True,
        "data": {
            "type": "insight",
            "message": f"Your last video's average watch time is **{avg_time:.2f} seconds**. That's {quality_assessment}!",
            "avg_view_time": avg_time,
            "metrics": metrics
        }
    }


def _handle_blog_analytics(payload: AnalyticsPayload, user_id: str) -> Dict[str, Any]:
    """Handle blog analytics (both insight and improvement modes)."""
    
    blog_metrics = payload.blog_metrics or ["views", "read_time", "top_articles"]
    
    # For improvement mode, blog_metrics are required
    if payload.insight_type == "improvement" and (not blog_metrics or len(blog_metrics) == 0):
        return {
            "success": False,
            "clarifying_question": "Which blog metrics would you like to improve?",
            "options": [
                "views", "read_time", "bounce_rate", "engagement",
                "traffic_sources", "top_articles", "all_articles"
            ]
        }
    
    blog_data = fetch_blog_insights(user_id, blog_metrics, payload.date_range)
    
    if blog_data is None:
        return {
            "success": False,
            "error": "No blog analytics data found. Please ensure your blog is connected and has data."
        }
    
    # Build response with formatted message
    response_data = {
        "type": payload.insight_type,
        "metrics": blog_metrics,
        "insights": blog_data
    }
    
    # Add date_range if present
    if payload.date_range:
        response_data["date_range"] = payload.date_range
    
    # Format user-friendly message
    if payload.insight_type == "improvement":
        response_data["message"] = (
            f"Here are some suggestions to improve your blog performance "
            f"for metrics: {', '.join(blog_metrics)}.\n\n"
        )
        if isinstance(blog_data, dict):
            for metric, value in blog_data.items():
                formatted_metric = metric.replace("_", " ").title()
                response_data["message"] += f"• **{formatted_metric}**: {value}\n"
        else:
            response_data["message"] += f"{blog_data}"
    else:
        response_data["message"] = f"Here are your blog analytics insights:\n\n"
        if isinstance(blog_data, dict):
            for metric, value in blog_data.items():
                formatted_metric = metric.replace("_", " ").title()
                response_data["message"] += f"• **{formatted_metric}**: {value}\n"
        else:
            response_data["message"] += f"{blog_data}\n"
        response_data["message"] += f"\n*Analyzed metrics: {', '.join(blog_metrics)}*"
    
    return {
        "success": True,
        "data": response_data
    }



# -------------------------------------------------------------
# DATABASE/API FUNCTIONS (reusing morning_scheduled_message.py patterns)
# -------------------------------------------------------------

def fetch_connected_platforms(user_id: str) -> List[str]:
    """Fetch all connected social media platforms."""
    try:
        if not supabase:
            logger.error("Supabase client not initialized")
            return []
        
        platforms = []
        
        # Check platform_connections table (OAuth connections)
        try:
            oauth_result = supabase.table("platform_connections").select("platform").eq(
                "user_id", user_id
            ).eq("is_active", True).execute()
            
            if oauth_result.data:
                for conn in oauth_result.data:
                    platform = conn.get("platform", "").lower()
                    if platform and platform not in platforms:
                        platforms.append(platform)
        except Exception as e:
            logger.warning(f"Error fetching OAuth connections: {e}")
        
        # Check social_media_connections table (token connections)
        try:
            token_result = supabase.table("social_media_connections").select("platform").eq(
                "user_id", user_id
            ).eq("is_active", True).execute()
            
            if token_result.data:
                for conn in token_result.data:
                    platform = conn.get("platform", "").lower()
                    if platform and platform not in platforms:
                        platforms.append(platform)
        except Exception as e:
            logger.warning(f"Error fetching token connections: {e}")
        
        logger.info(f"Found connected platforms for user {user_id}: {platforms}")
        return platforms
        
    except Exception as e:
        logger.error(f"Error fetching connected platforms: {e}")
        return []


def get_platform_connection(user_id: str, platform: str) -> Optional[Dict[str, Any]]:
    """Get platform connection details (OAuth or token-based)."""
    try:
        if not supabase:
            logger.warning("Supabase client not initialized")
            return None
        
        platform_lower = platform.lower()
        logger.info(f"🔍 Fetching connection for platform: {platform_lower}, user_id: {user_id}")
        
        # Try OAuth connections first (platform_connections table)
        try:
            oauth_result = supabase.table("platform_connections").select("*").eq(
                "user_id", user_id
            ).eq("platform", platform_lower).eq("is_active", True).execute()
            
            if oauth_result.data and len(oauth_result.data) > 0:
                connection = oauth_result.data[0]
                # Normalize connection data
                connection = {
                    **connection,
                    'access_token': connection.get('access_token_encrypted') or connection.get('access_token', ''),
                    'account_id': connection.get('page_id') or connection.get('account_id', ''),
                    'account_name': connection.get('page_name') or connection.get('account_name', ''),
                    'connection_type': 'oauth'
                }
                logger.info(f"✅ Found OAuth connection for {platform_lower}: account_id={connection.get('account_id')}")
                return connection
        except Exception as e:
            logger.error(f"Error fetching OAuth connection: {e}", exc_info=True)
        
        # Try token connections (social_media_connections table)
        try:
            token_result = supabase.table("social_media_connections").select("*").eq(
                "user_id", user_id
            ).eq("platform", platform_lower).eq("is_active", True).execute()
            
            if token_result.data and len(token_result.data) > 0:
                connection = token_result.data[0]
                connection['connection_type'] = 'token'
                logger.info(f"✅ Found token connection for {platform_lower}: account_id={connection.get('account_id')}")
                return connection
        except Exception as e:
            logger.error(f"Error fetching token connection: {e}", exc_info=True)
        
        logger.warning(f"❌ No connection found for platform {platform_lower}")
        return None
        
    except Exception as e:
        logger.error(f"Error getting platform connection: {e}", exc_info=True)
        return None


def fetch_instagram_post_metrics(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch Instagram POST-LEVEL metrics (likes, comments, shares) from latest post."""
    try:
        post_metrics = fetch_latest_post_metrics(connection, "instagram")
        if not post_metrics:
            return None
        
        result = _transform_post_metrics(post_metrics, metrics)
        logger.info(f"✅ Fetched Instagram post metrics: {result}")
        return result if result else None
        
    except Exception as e:
        logger.error(f"Error fetching Instagram post metrics: {e}", exc_info=True)
        return None


def fetch_instagram_insights(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch Instagram ACCOUNT-LEVEL insights - reuses existing API pattern"""
    try:
        # Check if user is asking for post-level metrics
        if _is_post_level_metrics(metrics):
            logger.info(f"📸 Detected post-level metrics request: {metrics}, fetching post metrics instead")
            return fetch_instagram_post_metrics(connection, metrics, date_range)
        
        access_token = decrypt_token(connection.get('access_token', ''))
        account_id = connection.get('account_id', '') or connection.get('page_id', '')
        
        if not access_token or not account_id:
            logger.warning(f"Missing access_token or account_id for Instagram. account_id={account_id}, has_token={bool(access_token)}")
            return None
        
        logger.info(f"🔍 Instagram account_id: {account_id} (length: {len(str(account_id))})")
        
        # Get Instagram Business account ID
        instagram_account_id = account_id
        if str(account_id).isdigit() and len(str(account_id)) <= 15:
            logger.info(f"🔍 account_id looks like Facebook Page ID, fetching Instagram Business account...")
            page_resp = requests.get(
                f"https://graph.facebook.com/v18.0/{account_id}",
                params={"access_token": access_token, "fields": "instagram_business_account"},
                timeout=10
            )
            if page_resp.status_code == 200:
                page_data = page_resp.json()
                instagram_business_account = page_data.get('instagram_business_account')
                if instagram_business_account:
                    instagram_account_id = instagram_business_account.get('id')
                    logger.info(f"✅ Found Instagram Business account ID: {instagram_account_id}")
                else:
                    logger.warning(f"❌ No Instagram Business account found for Facebook Page {account_id}")
                    return None
            else:
                logger.error(f"❌ Error fetching Instagram account: {page_resp.status_code} - {page_resp.text}")
                return None
        else:
            logger.info(f"✅ Using account_id as Instagram account ID: {instagram_account_id}")
        
        # Map metrics to Instagram API metrics (using valid Instagram insights metrics)
        metric_map = {
            "reach": "reach",
            "impressions": "impressions", 
            "engagement": "profile_views",
            "profile_visits": "profile_views",
            "website_clicks": "website_clicks",
            "email_contacts": "email_contacts",
            "phone_call_clicks": "phone_call_clicks",
            "text_message_clicks": "text_message_clicks",
            "get_directions_clicks": "get_directions_clicks"
        }
        
        # Build API metrics list
        api_metrics = []
        for m in metrics:
            if m in metric_map:
                api_metrics.append(metric_map[m])
        
        # Default metrics if none specified
        if not api_metrics:
            api_metrics = ["profile_views", "website_clicks"]
        
        # Determine period
        period = _calculate_period(date_range)
        
        # Fetch insights
        insights_url = f"https://graph.facebook.com/v18.0/{instagram_account_id}/insights"
        params = {"access_token": access_token, "metric": ",".join(api_metrics), "period": period}
        logger.info(f"🌐 Fetching Instagram insights from: {insights_url}")
        logger.info(f"   Metrics: {api_metrics}, Period: {period}")
        
        resp = requests.get(insights_url, params=params, timeout=15)
        if resp.status_code != 200:
            logger.error(f"❌ Instagram API error: {resp.status_code} - {resp.text}")
            return None
        
        insights = resp.json()
        result = {}
        
        # Transform response
        if insights.get('data'):
            for metric_data in insights.get('data', []):
                name = metric_data.get('name', '')
                values = metric_data.get('values', [])
                if values:
                    latest_value = values[-1].get('value', 0)
                    for our_metric, api_metric in metric_map.items():
                        if api_metric == name:
                            result[our_metric] = latest_value
        
        # Fetch followers count separately (reuse fetch_platform_follower_count)
        if "followers" in metrics or "follower_count" in metrics:
            logger.info(f"🔍 Fetching followers count...")
            try:
                followers_count = fetch_platform_follower_count(connection, "instagram")
                if followers_count > 0:
                    result["followers"] = followers_count
                    logger.info(f"✅ Fetched followers count: {followers_count}")
            except Exception as e:
                logger.warning(f"⚠️ Could not fetch followers count: {e}")
        
        if result:
            logger.info(f"✅ Successfully fetched Instagram insights: {list(result.keys())} = {result}")
            return result
        else:
            logger.warning(f"⚠️ No insights data extracted from Instagram API response")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching Instagram insights: {e}")
        return None


def fetch_facebook_post_metrics(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch Facebook POST-LEVEL metrics (likes, comments, shares) from latest post"""
    try:
        post_metrics = fetch_latest_post_metrics(connection, "facebook")
        if not post_metrics:
            return None
        
        result = _transform_post_metrics(post_metrics, metrics)
        logger.info(f"✅ Fetched Facebook post metrics: {result}")
        return result if result else None
        
    except Exception as e:
        logger.error(f"Error fetching Facebook post metrics: {e}", exc_info=True)
        return None


def fetch_facebook_insights(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch Facebook ACCOUNT-LEVEL insights"""
    try:
        # Check if user is asking for post-level metrics
        if _is_post_level_metrics(metrics):
            logger.info(f"📘 Detected post-level metrics request: {metrics}, fetching post metrics instead")
            return fetch_facebook_post_metrics(connection, metrics, date_range)
        
        access_token = decrypt_token(connection.get('access_token', ''))
        account_id = connection.get('account_id', '') or connection.get('page_id', '')
        
        if not access_token or not account_id:
            return None
        
        # Map metrics to Facebook API metrics
        metric_map = {
            "reach": "page_impressions_unique", "impressions": "page_impressions",
            "engagement": "page_engaged_users", "views": "page_video_views",
            "followers": "page_fans", "profile_visits": "page_profile_views"
        }
        api_metrics = [metric_map.get(m, m) for m in metrics if m in metric_map] or \
                      ["page_impressions_unique", "page_impressions", "page_engaged_users"]
        
        period = _calculate_period(date_range)
        
        # Fetch insights
        resp = requests.get(
            f"https://graph.facebook.com/v18.0/{account_id}/insights",
            params={"access_token": access_token, "metric": ",".join(api_metrics), "period": period},
            timeout=15
        )
        if resp.status_code != 200:
            return None
        
        insights = resp.json()
        result = {}
        for metric_data in insights.get('data', []):
            name = metric_data.get('name', '')
            values = metric_data.get('values', [])
            if values:
                value = values[-1].get('value', 0)
                for our_metric, api_metric in metric_map.items():
                    if api_metric == name:
                        result[our_metric] = value
        
        return result if result else None
            
    except Exception as e:
        logger.error(f"Error fetching Facebook insights: {e}")
        return None


def fetch_platform_insights(platform: str, user_id: str, date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Fetch platform analytics from API with default metrics.
    
    Args:
        platform: Platform name (instagram, facebook, etc.)
        user_id: User ID
        date_range: Optional date range filter (e.g., "last 7 days", "last month")
    
    Returns:
        Dict with platform insights or None if no data
    """
    try:
        connection = get_platform_connection(user_id, platform)
        if not connection:
            logger.warning(f"❌ No active connection found for {platform}")
            return None
        
        platform_lower = platform.lower()
        
        # Default metrics per platform
        default_metrics = {
            "instagram": ["comments", "likes"],
            "facebook": ["reach", "impressions", "engagement"],
            "youtube": ["views", "likes", "comments"],
            "linkedin": ["impressions", "clicks", "engagement"],
            "twitter": ["impressions", "likes", "retweets"],
            "x": ["impressions", "likes", "retweets"]
        }
        
        metrics = default_metrics.get(platform_lower, [])
        return _route_to_platform_fetcher(platform_lower, connection, metrics, date_range)
            
    except Exception as e:
        logger.error(f"Error fetching platform insights: {e}")
        return None


def fetch_youtube_insights(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch YouTube channel analytics (placeholder - requires YouTube Data API v3)"""
    logger.info("YouTube insights fetching - requires YouTube Data API v3 implementation")
    return None


def fetch_linkedin_insights(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch LinkedIn page analytics (placeholder - requires LinkedIn API)"""
    logger.info("LinkedIn insights fetching - requires LinkedIn API implementation")
    return None


def fetch_twitter_insights(connection: Dict[str, Any], metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch Twitter/X analytics (placeholder - requires Twitter API v2)"""
    logger.info("Twitter insights fetching - requires Twitter API v2 implementation")
    return None


def generate_improvements(data: Dict[str, Any], metrics: List[str]) -> Optional[Dict[str, Any]]:
    """Generate personalized improvement suggestions based on analytics data."""
    # TODO: Import or implement generate_improvements_from_data function
    # Example: from your_ai_module import generate_improvements_from_data
    # This could use AI/ML to generate suggestions or query a recommendations DB
    try:
        # Try to import and use real AI function if available
        from services.improvement_service import generate_improvements_from_data
        improvements = generate_improvements_from_data(data, metrics)
    except ImportError:
        # Fallback: Return None if improvement service not implemented yet
        logger.warning("generate_improvements_from_data not implemented, returning None")
        return None
    
    if not improvements:
        return None  # important: return None when NO DATA
    
    return improvements  # return dict when VALID data


def fetch_latest_video_post(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the latest video post from database."""
    try:
        if not supabase:
            return None
        
        # Try to get latest video post
        try:
            posts_result = supabase.table("content_posts").select("*").eq(
                "user_id", user_id
            ).eq("content_type", "video").eq("status", "published").order(
                "published_at", desc=True
            ).limit(1).execute()
            
            if posts_result.data and len(posts_result.data) > 0:
                post = posts_result.data[0]
                return {
                    "views": post.get("views_count", 0) or 0,
                    "total_watch_time": post.get("total_watch_time", 0) or 0
                }
        except Exception as e:
            logger.warning(f"Error fetching video post: {e}")
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting latest video post: {e}")
        return None


def compute_avg_watch_time(post: Dict[str, Any]) -> float:
    """Compute average watch time from total_watch_time and views."""
    views = post.get("views", 0)
    total = post.get("total_watch_time", 0)
    if views == 0:
        return 0.0
    return total / views


def fetch_last_post_platform(user_id: str) -> Optional[str]:
    """Fetch the platform of the last published post."""
    try:
        if not supabase:
            return None
        
        # Try to get latest post from content_posts or social_media_posts
        try:
            posts_result = supabase.table("content_posts").select("platform").eq(
                "user_id", user_id
            ).eq("status", "published").order("published_at", desc=True).limit(1).execute()
            
            if posts_result.data and len(posts_result.data) > 0:
                return posts_result.data[0].get("platform", "").lower()
        except Exception as e:
            logger.warning(f"Error fetching from content_posts: {e}")
        
        try:
            posts_result = supabase.table("social_media_posts").select("platform").eq(
                "user_id", user_id
            ).order("created_at", desc=True).limit(1).execute()
            
            if posts_result.data and len(posts_result.data) > 0:
                return posts_result.data[0].get("platform", "").lower()
        except Exception as e:
            logger.warning(f"Error fetching from social_media_posts: {e}")
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting last post platform: {e}")
        return None


def fetch_insights_for_metrics(platform: str, user_id: str, metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Fetch insights for specified metrics from platform API.
    
    Args:
        platform: Platform name (instagram, facebook, etc.)
        user_id: User ID
        metrics: List of metrics to fetch
        date_range: Optional date range filter (e.g., "last 7 days", "last month")
    
    Returns:
        Dict with insights or None if no data
    """
    try:
        connection = get_platform_connection(user_id, platform)
        if not connection:
            logger.warning(f"No active connection found for {platform}")
            return None
        
        return _route_to_platform_fetcher(platform.lower(), connection, metrics, date_range)
            
    except Exception as e:
        logger.error(f"Error fetching data from API: {e}")
        return None


def fetch_blog_insights(user_id: str, metrics: List[str], date_range: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Fetch blog insights based on metrics (placeholder - requires blog analytics API).
    
    Args:
        user_id: User ID
        metrics: List of blog metrics to fetch
        date_range: Optional date range filter (e.g., "last 7 days", "last month")
    
    Returns:
        Dict with blog insights or None if no data
    """
    logger.info("Blog insights fetching - requires blog analytics API implementation")
    return None
