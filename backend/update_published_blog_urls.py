#!/usr/bin/env python3
"""
Migration script to update published blog URLs with proper permalinks
"""

import os
import sys
import requests
from supabase import create_client
from cryptography.fernet import Fernet
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv('.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_service_key:
    print("ERROR: Missing Supabase environment variables")
    print(f"SUPABASE_URL: {supabase_url}")
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'SET' if supabase_service_key else 'NOT SET'}")
    sys.exit(1)

print(f"Using Supabase URL: {supabase_url}")
print(f"Service key length: {len(supabase_service_key) if supabase_service_key else 0}")

supabase_admin = create_client(supabase_url, supabase_service_key)

def decrypt_token(encrypted_token):
    """Decrypt an encrypted token"""
    try:
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            raise ValueError("ENCRYPTION_KEY not found")
        
        f = Fernet(key.encode())
        return f.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        logger.error(f"Error decrypting token: {e}")
        raise

def update_published_blog_urls():
    """Update published blog URLs with proper permalinks"""
    try:
        logger.info("Fetching published blogs without blog_url...")
        
        # Get published blogs that don't have blog_url or have generic URLs
        response = supabase_admin.table("blog_posts").select("*").eq("status", "published").is_("blog_url", "null").execute()
        
        if not response.data:
            logger.info("No published blogs found without blog_url")
            return
        
        logger.info(f"Found {len(response.data)} published blogs to update")
        
        for blog in response.data:
            try:
                logger.info(f"Processing blog: {blog['id']} - {blog['title']}")
                
                # Get WordPress connection details
                if not blog.get('wordpress_site_id'):
                    logger.warning(f"No WordPress site ID for blog {blog['id']}")
                    continue
                
                wordpress_response = supabase_admin.table("platform_connections").select("*").eq("id", blog['wordpress_site_id']).eq("platform", "wordpress").execute()
                
                if not wordpress_response.data:
                    logger.warning(f"WordPress connection not found for blog {blog['id']}")
                    continue
                
                wordpress_site = wordpress_response.data[0]
                
                # Decrypt WordPress app password
                try:
                    app_password = decrypt_token(wordpress_site['wordpress_app_password_encrypted'])
                except Exception as e:
                    logger.error(f"Error decrypting WordPress app password for blog {blog['id']}: {e}")
                    continue
                
                # Get the published post details to get the proper permalink
                try:
                    post_response = requests.get(
                        f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{blog['wordpress_post_id']}",
                        auth=(wordpress_site['wordpress_username'], app_password),
                        timeout=30
                    )
                    
                    if post_response.status_code == 200:
                        post_data = post_response.json()
                        blog_url = post_data.get('link', f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={blog['wordpress_post_id']}")
                        
                        # Update the blog with the proper URL
                        update_response = supabase_admin.table("blog_posts").update({
                            "blog_url": blog_url
                        }).eq("id", blog['id']).execute()
                        
                        if update_response.data:
                            logger.info(f"Updated blog {blog['id']} with URL: {blog_url}")
                        else:
                            logger.error(f"Failed to update blog {blog['id']}")
                    else:
                        logger.warning(f"Could not fetch post details for blog {blog['id']}, status: {post_response.status_code}")
                        
                except Exception as e:
                    logger.error(f"Error fetching post details for blog {blog['id']}: {e}")
                    continue
                    
            except Exception as e:
                logger.error(f"Error processing blog {blog['id']}: {e}")
                continue
        
        logger.info("Migration completed!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    print("Starting published blog URL migration...")
    update_published_blog_urls()
    print("Migration completed!")
