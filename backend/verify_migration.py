#!/usr/bin/env python3
"""
Verification script to check image migration results
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client, Client

def is_supabase_url(url: str) -> bool:
    """Check if URL is a Supabase storage URL"""
    if not url:
        return False
    return "supabase" in url and "storage" in url

def is_external_url(url: str) -> bool:
    """Check if URL is external (not Supabase storage)"""
    if not url:
        return False
    
    # Check if it's a Supabase storage URL
    if is_supabase_url(url):
        return False
    
    # Check if it's a DALL-E URL
    if "oaidalleapiprodscus.blob.core.windows.net" in url:
        return True
    
    # Check if it's any other external URL
    parsed = urlparse(url)
    return parsed.scheme in ['http', 'https'] and parsed.netloc != ''

def verify_migration():
    """Verify the migration results"""
    try:
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
            return False
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Get all content_images records
        response = supabase.table("content_images").select("id, post_id, image_url").execute()
        
        if not response.data:
            print("ℹ️  No images found in database")
            return True
        
        total_images = len(response.data)
        supabase_images = 0
        external_images = 0
        invalid_images = 0
        
        print(f"📊 Analyzing {total_images} images...")
        print()
        
        for image in response.data:
            image_url = image.get("image_url")
            
            if not image_url:
                invalid_images += 1
                print(f"⚠️  Image {image['id']} has no URL")
            elif is_supabase_url(image_url):
                supabase_images += 1
            elif is_external_url(image_url):
                external_images += 1
                print(f"🔄 Image {image['id']} still has external URL: {image_url[:100]}...")
            else:
                invalid_images += 1
                print(f"❓ Image {image['id']} has unknown URL format: {image_url[:100]}...")
        
        print()
        print("📈 Migration Results:")
        print(f"✅ Supabase storage URLs: {supabase_images}")
        print(f"🔄 External URLs: {external_images}")
        print(f"❓ Invalid/Empty URLs: {invalid_images}")
        print(f"📊 Total images: {total_images}")
        
        if external_images == 0:
            print("\n🎉 Migration successful! All images are now using Supabase storage.")
            return True
        else:
            print(f"\n⚠️  {external_images} images still have external URLs and need migration.")
            return False
            
    except Exception as e:
        print(f"❌ Verification failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔍 Verifying image migration to Supabase storage...")
    print()
    
    success = verify_migration()
    
    if success:
        print("\n✅ Verification completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Verification found issues that need attention.")
        sys.exit(1)
