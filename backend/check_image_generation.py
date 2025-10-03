#!/usr/bin/env python3
"""
Diagnostic script to check image generation configuration
"""

import os
import sys
import logging
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if all required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY", 
        "GEMINI_API_KEY"
    ]
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
            print(f"❌ {var}: Not set")
        else:
            # Mask the key for security
            masked_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
            print(f"✅ {var}: {masked_value}")
    
    if missing_vars:
        print(f"\n❌ Missing environment variables: {', '.join(missing_vars)}")
        return False
    
    print("✅ All required environment variables are set")
    return True

def check_supabase_connection():
    """Check Supabase connection and storage bucket"""
    print("\n🔍 Checking Supabase connection...")
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("❌ Supabase credentials not available")
            return False
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Test connection by listing storage buckets
        buckets = supabase.storage.list_buckets()
        print(f"✅ Supabase connected successfully")
        print(f"📦 Available buckets: {[bucket.name for bucket in buckets]}")
        
        # Check if ai-generated-images bucket exists
        bucket_names = [bucket.name for bucket in buckets]
        if "ai-generated-images" in bucket_names:
            print("✅ ai-generated-images bucket exists")
        else:
            print("❌ ai-generated-images bucket not found")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Supabase connection failed: {str(e)}")
        return False

def check_gemini_api():
    """Check Gemini API configuration"""
    print("\n🔍 Checking Gemini API configuration...")
    
    try:
        import google.generativeai as genai
        
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            print("❌ GEMINI_API_KEY not set")
            return False
        
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        
        # Test API by listing models
        models = genai.list_models()
        image_models = [model for model in models if 'image' in model.name.lower()]
        
        print(f"✅ Gemini API connected successfully")
        print(f"🎨 Available image models: {[model.name for model in image_models]}")
        
        # Check for the specific model we use
        target_model = 'gemini-2.5-flash-image-preview'
        model_names = [model.name for model in models]
        if target_model in model_names:
            print(f"✅ Target model {target_model} is available")
        else:
            print(f"⚠️  Target model {target_model} not found, but other image models available")
        
        return True
        
    except Exception as e:
        print(f"❌ Gemini API check failed: {str(e)}")
        return False

def test_image_generation():
    """Test actual image generation"""
    print("\n🔍 Testing image generation...")
    
    try:
        from agents.media_agent import create_media_agent
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        # Create media agent
        media_agent = create_media_agent(supabase_url, supabase_key, gemini_api_key)
        print("✅ Media agent created successfully")
        
        # Test with a dummy post ID
        test_post_id = "test_image_generation"
        result = await media_agent.generate_media_for_post(test_post_id)
        
        if result["success"]:
            print(f"✅ Image generation test successful")
            print(f"🖼️  Generated image URL: {result.get('image_url', 'N/A')}")
            print(f"⏱️  Generation time: {result.get('generation_time', 'N/A')}s")
            print(f"💰 Cost: {result.get('cost', 'N/A')}")
        else:
            print(f"❌ Image generation test failed: {result.get('error', 'Unknown error')}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Image generation test failed: {str(e)}")
        return False

async def main():
    """Main diagnostic function"""
    print("🚀 Image Generation Diagnostic Tool")
    print("=" * 50)
    
    # Check environment
    env_ok = check_environment()
    if not env_ok:
        print("\n❌ Environment check failed. Please set missing variables.")
        return
    
    # Check Supabase
    supabase_ok = check_supabase_connection()
    if not supabase_ok:
        print("\n❌ Supabase check failed. Please check your configuration.")
        return
    
    # Check Gemini API
    gemini_ok = check_gemini_api()
    if not gemini_ok:
        print("\n❌ Gemini API check failed. Please check your API key.")
        return
    
    # Test image generation
    generation_ok = await test_image_generation()
    if not generation_ok:
        print("\n❌ Image generation test failed.")
        return
    
    print("\n🎉 All checks passed! Image generation should work correctly.")
    print("\nIf you're still seeing placeholder images, check the application logs for specific error messages.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
