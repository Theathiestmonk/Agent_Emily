from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional, Dict, Any
import os
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from cryptography.fernet import Fernet
import json

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

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        print(f"Authorization header: {authorization}")
        
        if not authorization or not authorization.startswith("Bearer "):
            print("No valid authorization header, using mock user")
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
        
        # Extract token
        token = authorization.split(" ")[1]
        print(f"Token received: {token[:20]}...")
        
        # Try to get user info from Supabase using the token
        try:
            print(f"Attempting to authenticate with Supabase...")
            user_response = supabase.auth.get_user(token)
            print(f"Supabase user response: {user_response}")
            
            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_data = user_response.user
                print(f"✅ Authenticated user: {user_data.id} - {user_data.email}")
                return User(
                    id=user_data.id,
                    email=user_data.email or "unknown@example.com",
                    name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                    created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
                )
            else:
                print("❌ No user found in response, using mock user")
                return User(
                    id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                    email="test@example.com", 
                    name="Test User",
                    created_at="2025-01-01T00:00:00Z"
                )
                
        except Exception as e:
            print(f"❌ Supabase auth error: {e}")
            print(f"Error type: {type(e).__name__}")
            # Fallback to mock for now
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
            
    except Exception as e:
        print(f"Authentication error: {e}")
        # Fallback to mock for now
        return User(
            id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
            email="test@example.com", 
            name="Test User",
            created_at="2025-01-01T00:00:00Z"
        )

router = APIRouter(prefix="/social-media", tags=["social-media"])

def get_encryption_key():
    """Get or generate encryption key for token decryption"""
    encryption_key = os.getenv("ENCRYPTION_KEY")
    if not encryption_key:
        print("⚠️ No ENCRYPTION_KEY found, generating new key")
        key = Fernet.generate_key()
        encryption_key = key.decode()
        print(f"🔑 Generated new encryption key: {encryption_key[:20]}...")
        print("⚠️ Please set this as ENCRYPTION_KEY in your environment variables")
    else:
        print(f"🔑 Using existing encryption key: {encryption_key[:20]}...")
    
    return encryption_key.encode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt access token"""
    try:
        encryption_key = get_encryption_key()
        fernet = Fernet(encryption_key)
        decrypted_token = fernet.decrypt(encrypted_token.encode()).decode()
        print(f"✅ Successfully decrypted token: {decrypted_token[:20]}...")
        return decrypted_token
    except Exception as e:
        print(f"❌ Error decrypting token: {e}")
        # Try to use token as-is if decryption fails (for backward compatibility)
        print("🔄 Trying to use token as-is...")
        return encrypted_token

@router.get("/latest-posts")
async def get_latest_posts(
    current_user: User = Depends(get_current_user),
    limit: int = 5
):
    """Get latest posts from all connected social media platforms"""
    try:
        print(f"📱 Fetching latest posts for user: {current_user.id}")
        
        # Get user's active connections
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()
        connections = response.data if response.data else []
        
        print(f"📊 Found {len(connections)} active connections")
        for conn in connections:
            print(f"🔗 Connection: {conn.get('platform')} - {conn.get('page_name', 'Unknown')} - Active: {conn.get('is_active')} - Page ID: {conn.get('page_id')}")
        
        # Check specifically for Instagram connections
        instagram_connections = [conn for conn in connections if conn.get('platform', '').lower() == 'instagram']
        print(f"📱 Found {len(instagram_connections)} Instagram connections")
        for insta_conn in instagram_connections:
            print(f"📱 Instagram: {insta_conn.get('page_name')} - Page ID: {insta_conn.get('page_id')} - Active: {insta_conn.get('is_active')}")
        
        # Also check for Facebook connections that might have Instagram
        facebook_connections = [conn for conn in connections if conn.get('platform', '').lower() == 'facebook']
        print(f"📘 Found {len(facebook_connections)} Facebook connections")
        for fb_conn in facebook_connections:
            print(f"📘 Facebook: {fb_conn.get('page_name')} - Page ID: {fb_conn.get('page_id')} - Active: {fb_conn.get('is_active')}")
        
        posts_by_platform = {}
        
        for connection in connections:
            platform = connection.get('platform', '').lower()
            print(f"🔍 Processing {platform} connection: {connection.get('id')}")
            
            try:
                if platform == 'facebook':
                    posts = await fetch_facebook_posts(connection, limit)
                    # If no real posts found, add some mock data for testing
                    if not posts:
                        print(f"🔄 No real posts found for {platform}, adding mock data for testing")
                        posts = [{
                            'id': f'mock_{platform}_1',
                            'message': f'This is a sample post from your {platform} page. This is mock data for testing purposes.',
                            'created_time': '2025-01-07T10:00:00+0000',
                            'permalink_url': f'https://facebook.com/mock_post_1',
                            'media_url': None,
                            'likes_count': 15,
                            'comments_count': 3,
                            'shares_count': 2
                        }]
                elif platform == 'instagram':
                    print(f"📱 Processing Instagram connection: {connection.get('id')}")
                    posts = await fetch_instagram_posts(connection, limit)
                    print(f"📱 Instagram posts fetched: {len(posts) if posts else 0}")
                    # If no real posts found, add some mock data for testing
                    if not posts:
                        print(f"🔄 No real posts found for {platform}, adding mock data for testing")
                        posts = [{
                            'id': f'mock_{platform}_1',
                            'message': f'This is a sample post from your {platform} account. This is mock data for testing purposes. #test #socialmedia',
                            'created_time': '2025-01-07T10:00:00+0000',
                            'permalink_url': f'https://instagram.com/mock_post_1',
                            'media_url': None,
                            'likes_count': 25,
                            'comments_count': 5,
                            'shares_count': 0
                        }]
                elif platform == 'twitter':
                    posts = await fetch_twitter_posts(connection, limit)
                elif platform == 'linkedin':
                    posts = await fetch_linkedin_posts(connection, limit)
                elif platform == 'youtube':
                    posts = await fetch_youtube_posts(connection, limit)
                else:
                    print(f"⚠️ Unsupported platform: {platform}")
                    continue
                
                if posts:
                    posts_by_platform[platform] = posts
                    print(f"✅ Fetched {len(posts)} posts from {platform}")
                else:
                    print(f"⚠️ No posts found for {platform}")
                    
            except Exception as e:
                print(f"❌ Error fetching posts from {platform}: {e}")
                # Continue with other platforms even if one fails
                continue
        
        return {
            "posts": posts_by_platform,
            "total_platforms": len(posts_by_platform),
            "total_posts": sum(len(posts) for posts in posts_by_platform.values()),
            "debug_info": {
                "instagram_connections_found": len([conn for conn in connections if conn.get('platform', '').lower() == 'instagram']),
                "instagram_posts_found": len(posts_by_platform.get('instagram', [])),
                "all_connections": [{"platform": conn.get('platform'), "page_id": conn.get('page_id'), "is_active": conn.get('is_active')} for conn in connections]
            }
        }
        
    except Exception as e:
        print(f"❌ Error fetching latest posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch latest posts: {str(e)}"
        )

async def fetch_facebook_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Facebook"""
    try:
        print(f"🔍 Facebook connection data: {connection}")
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        page_id = connection.get('page_id')
        
        print(f"📄 Facebook page_id: {page_id}")
        print(f"🔑 Facebook access_token: {access_token[:20]}...")
        
        if not page_id:
            print("❌ No page_id found for Facebook connection")
            return []
        
        # Fetch posts from Facebook Graph API
        url = f"https://graph.facebook.com/v18.0/{page_id}/posts"
        params = {
            'access_token': access_token,
            'fields': 'id,message,created_time,permalink_url,attachments{media},likes.summary(true),comments.summary(true),shares',
            'limit': limit
        }
        
        print(f"🌐 Facebook API URL: {url}")
        print(f"📋 Facebook API params: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        
        print(f"📊 Facebook API response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📱 Facebook API response data: {data}")
            posts = []
            
            for post in data.get('data', []):
                # Extract media URL if available
                media_url = None
                if post.get('attachments', {}).get('data'):
                    attachment = post['attachments']['data'][0]
                    if attachment.get('media', {}).get('image'):
                        media_url = attachment['media']['image'].get('src')
                
                post_data = {
                    'id': post.get('id'),
                    'message': post.get('message', ''),
                    'created_time': post.get('created_time'),
                    'permalink_url': post.get('permalink_url'),
                    'media_url': media_url,
                    'likes_count': post.get('likes', {}).get('summary', {}).get('total_count', 0),
                    'comments_count': post.get('comments', {}).get('summary', {}).get('total_count', 0),
                    'shares_count': post.get('shares', {}).get('count', 0)
                }
                posts.append(post_data)
            
            print(f"✅ Facebook posts processed: {len(posts)}")
            return posts
        else:
            print(f"❌ Facebook API error: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching Facebook posts: {e}")
        return []

async def fetch_instagram_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Instagram"""
    try:
        print(f"🔍 Instagram connection data: {connection}")
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        page_id = connection.get('page_id')
        
        print(f"📄 Instagram page_id: {page_id}")
        print(f"🔑 Instagram access_token: {access_token[:20]}...")
        
        if not page_id:
            print("❌ No page_id found for Instagram connection")
            return []
        
        # page_id already contains the Instagram Business account ID
        instagram_account_id = page_id
        print(f"📱 Using Instagram Business account ID: {instagram_account_id}")
        
        # Validate Instagram account ID format
        if not instagram_account_id or not instagram_account_id.isdigit():
            print(f"❌ Invalid Instagram account ID format: {instagram_account_id}")
            return []
        
        # Now fetch media from Instagram Graph API
        url = f"https://graph.facebook.com/v18.0/{instagram_account_id}/media"
        params = {
            'access_token': access_token,
            'fields': 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
            'limit': limit
        }
        
        print(f"🌐 Instagram API URL: {url}")
        print(f"📋 Instagram API params: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        
        print(f"📊 Instagram API response status: {response.status_code}")
        print(f"📊 Instagram API response headers: {dict(response.headers)}")
        print(f"📊 Instagram API response text: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📱 Instagram API response data: {data}")
            posts = []
            
            for media in data.get('data', []):
                post_data = {
                    'id': media.get('id'),
                    'message': media.get('caption', ''),
                    'created_time': media.get('timestamp'),
                    'permalink_url': media.get('permalink'),
                    'media_url': media.get('media_url') or media.get('thumbnail_url'),
                    'likes_count': media.get('like_count', 0),
                    'comments_count': media.get('comments_count', 0),
                    'shares_count': 0  # Instagram doesn't provide shares count
                }
                posts.append(post_data)
            
            print(f"✅ Instagram posts processed: {len(posts)}")
            return posts
        else:
            print(f"❌ Instagram API error: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching Instagram posts: {e}")
        return []

@router.get("/debug/instagram-posts")
async def debug_instagram_posts(
    current_user: User = Depends(get_current_user)
):
    """Debug endpoint to test Instagram posts fetching"""
    try:
        print(f"🔍 Debug Instagram posts for user: {current_user.id}")
        
        # Get user's Instagram connections
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "instagram").eq("is_active", True).execute()
        connections = response.data if response.data else []
        
        print(f"📱 Found {len(connections)} Instagram connections")
        
        if not connections:
            return {
                "error": "No Instagram connections found",
                "connections_count": 0
            }
        
        connection = connections[0]
        print(f"🔍 Instagram connection data: {connection}")
        
        # Test the Instagram posts fetching
        posts = await fetch_instagram_posts(connection, 5)
        
        return {
            "connection_found": True,
            "connection_data": {
                "id": connection.get('id'),
                "platform": connection.get('platform'),
                "page_id": connection.get('page_id'),
                "page_name": connection.get('page_name'),
                "is_active": connection.get('is_active')
            },
            "posts_fetched": len(posts),
            "posts": posts
        }
        
    except Exception as e:
        print(f"❌ Debug Instagram posts error: {e}")
        return {
            "error": str(e),
            "connection_found": False
        }

async def fetch_twitter_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Twitter using API v2"""
    try:
        print(f"🐦 Fetching Twitter posts for connection: {connection.get('id')}")
        
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        if not access_token:
            print("❌ No access token found for Twitter connection")
            return []
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Get user's timeline tweets
        user_id = connection.get('account_id')
        if not user_id:
            print("❌ No account ID found for Twitter connection")
            return []
        
        # Fetch user's tweets
        tweets_url = f"https://api.twitter.com/2/users/{user_id}/tweets"
        params = {
            'max_results': limit,
            'tweet.fields': 'created_at,public_metrics,text,id,attachments',
            'expansions': 'attachments.media_keys',
            'media.fields': 'url,preview_image_url,type'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(tweets_url, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"❌ Twitter API error: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            tweets = data.get('data', [])
            media_data = data.get('includes', {}).get('media', [])
            
            # Create media lookup
            media_lookup = {media['media_key']: media for media in media_data}
            
            posts = []
            for tweet in tweets:
                # Get media for this tweet
                tweet_media = []
                if 'attachments' in tweet and 'media_keys' in tweet['attachments']:
                    for media_key in tweet['attachments']['media_keys']:
                        if media_key in media_lookup:
                            media = media_lookup[media_key]
                            tweet_media.append({
                                'url': media.get('url', ''),
                                'preview_url': media.get('preview_image_url', ''),
                                'type': media.get('type', 'photo')
                            })
                
                # Format the post
                post = {
                    'id': tweet['id'],
                    'message': tweet['text'],
                    'created_time': tweet['created_at'],
                    'permalink_url': f"https://twitter.com/{connection.get('account_name', 'user')}/status/{tweet['id']}",
                    'media_url': tweet_media[0]['url'] if tweet_media else None,
                    'media_type': tweet_media[0]['type'] if tweet_media else None,
                    'likes_count': tweet['public_metrics'].get('like_count', 0),
                    'comments_count': tweet['public_metrics'].get('reply_count', 0),
                    'shares_count': tweet['public_metrics'].get('retweet_count', 0),
                    'impressions_count': tweet['public_metrics'].get('impression_count', 0)
                }
                posts.append(post)
            
            print(f"✅ Fetched {len(posts)} Twitter posts")
            return posts
            
    except Exception as e:
        print(f"❌ Error fetching Twitter posts: {e}")
        return []

async def fetch_linkedin_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from LinkedIn personal account"""
    try:
        print(f"🔍 LinkedIn connection data: {connection}")
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        linkedin_id = connection.get('linkedin_id') or connection.get('page_id')
        
        print(f"📄 LinkedIn ID: {linkedin_id}")
        print(f"🔑 LinkedIn access_token: {access_token[:20]}...")
        
        if not linkedin_id:
            print("❌ No LinkedIn ID found for LinkedIn connection")
            return []
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
        }
        
        # Try to fetch user's shares (posts they've shared)
        try:
            print("🔄 Attempting to fetch LinkedIn shares...")
            shares_url = f"https://api.linkedin.com/v2/shares?q=owners&owners={linkedin_id}&count={limit}"
            
            response = requests.get(shares_url, headers=headers, timeout=10)
            print(f"📊 LinkedIn shares API response status: {response.status_code}")
            
            if response.status_code == 200:
                shares_data = response.json()
                print(f"✅ LinkedIn shares data: {shares_data}")
                
                posts = []
                for share in shares_data.get('elements', []):
                    # Extract share information
                    share_id = share.get('id', '')
                    created_time = share.get('created', {}).get('time', '')
                    
                    # Get share content
                    specific_content = share.get('specificContent', {})
                    share_content = specific_content.get('com.linkedin.ugc.ShareContent', {})
                    share_commentary = share_content.get('shareCommentary', {})
                    text = share_commentary.get('text', '')
                    
                    # Get engagement metrics
                    social_detail = share.get('socialDetail', {})
                    total_social_counts = social_detail.get('totalSocialCounts', {})
                    
                    post = {
                        'id': share_id,
                        'message': text,
                        'created_time': created_time,
                        'permalink_url': f'https://linkedin.com/feed/update/{share_id}',
                        'media_url': None,
                        'likes_count': total_social_counts.get('numLikes', 0),
                        'comments_count': total_social_counts.get('numComments', 0),
                        'shares_count': total_social_counts.get('numShares', 0)
                    }
                    posts.append(post)
                
                if posts:
                    print(f"✅ Successfully fetched {len(posts)} LinkedIn posts")
                    return posts
                else:
                    print("⚠️ No shares found in LinkedIn API response")
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                print(f"❌ LinkedIn shares API error: {response.status_code} - {error_data}")
                
        except Exception as api_error:
            print(f"❌ LinkedIn API error: {api_error}")
        
        # If API calls fail, return empty array
        print("⚠️ Unable to fetch real LinkedIn posts - API permissions may be insufficient")
        print("💡 LinkedIn requires r_member_social permission to fetch user's own posts")
        print("💡 This permission is currently restricted by LinkedIn")
        return []
        
    except Exception as e:
        print(f"❌ Error fetching LinkedIn posts: {e}")
    return []

async def fetch_youtube_posts(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from YouTube (placeholder - requires YouTube Data API)"""
    print("⚠️ YouTube posts not implemented yet - requires YouTube Data API")
    return []

@router.get("/test")
async def test_social_media_router():
    """Test endpoint to verify social media router is working"""
    return {"message": "Social media router is working!", "status": "success"}

@router.get("/debug-connections")
async def debug_connections(
    current_user: User = Depends(get_current_user)
):
    """Debug endpoint to check connections and their data"""
    try:
        print(f"🔍 Debug connections for user: {current_user.id}")
        
        # Get all connections (active and inactive)
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).execute()
        all_connections = response.data if response.data else []
        
        # Get only active connections
        active_response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()
        active_connections = active_response.data if active_response.data else []
        
        # Process connections for debugging
        debug_data = {
            "user_id": current_user.id,
            "total_connections": len(all_connections),
            "active_connections": len(active_connections),
            "all_connections": [],
            "active_connections_data": []
        }
        
        for conn in all_connections:
            conn_data = {
                "id": conn.get("id"),
                "platform": conn.get("platform"),
                "page_id": conn.get("page_id"),
                "page_name": conn.get("page_name"),
                "is_active": conn.get("is_active"),
                "has_access_token": bool(conn.get("access_token_encrypted")),
                "connection_status": conn.get("connection_status"),
                "connected_at": conn.get("connected_at")
            }
            debug_data["all_connections"].append(conn_data)
        
        for conn in active_connections:
            conn_data = {
                "id": conn.get("id"),
                "platform": conn.get("platform"),
                "page_id": conn.get("page_id"),
                "page_name": conn.get("page_name"),
                "is_active": conn.get("is_active"),
                "has_access_token": bool(conn.get("access_token_encrypted")),
                "connection_status": conn.get("connection_status"),
                "connected_at": conn.get("connected_at")
            }
            debug_data["active_connections_data"].append(conn_data)
        
        return debug_data
        
    except Exception as e:
        print(f"❌ Error in debug connections: {e}")
        return {"error": str(e), "user_id": current_user.id}

@router.post("/twitter/post")
async def post_to_twitter(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Post content to Twitter"""
    try:
        print(f"🐦 Posting to Twitter for user: {current_user.id}")
        
        text = request.get('text', '')
        media_ids = request.get('media_ids', [])
        
        if not text:
            raise HTTPException(status_code=400, detail="Text content is required")
        
        # Get user's Twitter connection
        response = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("platform", "twitter").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="No active Twitter connection found")
        
        connection = response.data[0]
        access_token = decrypt_token(connection.get('access_token_encrypted', ''))
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Invalid Twitter access token")
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Prepare tweet data
        tweet_data = {
            'text': text
        }
        
        if media_ids:
            tweet_data['media'] = {
                'media_ids': media_ids
            }
        
        # Post to Twitter
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.twitter.com/2/tweets",
                headers=headers,
                json=tweet_data
            )
            
            if response.status_code != 201:
                print(f"❌ Twitter API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=400, detail=f"Failed to post to Twitter: {response.text}")
            
            result = response.json()
            print(f"✅ Posted to Twitter: {result}")
            
            return {
                "success": True,
                "tweet_id": result['data']['id'],
                "text": result['data']['text']
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error posting to Twitter: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to post to Twitter: {str(e)}")
