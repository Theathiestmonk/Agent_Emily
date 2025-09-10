#!/usr/bin/env python3
"""
Migration script to move existing DALL-E images to Supabase storage
This script will:
1. Find all content_images with external URLs
2. Download each image from the external URL
3. Upload to Supabase storage bucket
4. Update the database with the new Supabase URL
"""

import asyncio
import logging
import os
import uuid
from typing import List, Dict, Any
import httpx
from supabase import create_client, Client
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImageMigration:
    def __init__(self):
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.bucket_name = "ai-generated-images"
        
    async def is_external_url(self, url: str) -> bool:
        """Check if URL is external (not Supabase storage)"""
        if not url:
            return False
        
        # Check if it's a Supabase storage URL
        if "supabase" in url and "storage" in url:
            return False
        
        # Check if it's a DALL-E URL
        if "oaidalleapiprodscus.blob.core.windows.net" in url:
            return True
        
        # Check if it's any other external URL
        parsed = urlparse(url)
        return parsed.scheme in ['http', 'https'] and parsed.netloc != ''
    
    async def download_image(self, url: str) -> bytes:
        """Download image from external URL"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.error(f"Failed to download image from {url}: {str(e)}")
            raise
    
    async def upload_to_storage(self, image_data: bytes, post_id: str, original_url: str) -> str:
        """Upload image to Supabase storage"""
        try:
            # Generate unique filename
            file_extension = "png"  # Default to PNG
            if "." in original_url:
                ext = original_url.split(".")[-1].split("?")[0]
                if ext.lower() in ['jpg', 'jpeg', 'png', 'webp']:
                    file_extension = ext.lower()
            
            filename = f"{post_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
            file_path = f"migrated/{filename}"
            
            # Upload to Supabase storage
            storage_response = self.supabase.storage.from_(self.bucket_name).upload(
                file_path,
                image_data,
                file_options={"content-type": f"image/{file_extension}"}
            )
            
            # Check for upload errors
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Storage upload failed: {storage_response.error}")
            elif isinstance(storage_response, dict) and storage_response.get('error'):
                raise Exception(f"Storage upload failed: {storage_response['error']}")
            
            # Get public URL
            public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
            
            logger.info(f"Successfully uploaded to storage: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload to storage: {str(e)}")
            raise
    
    async def migrate_image(self, image_record: Dict[str, Any]) -> bool:
        """Migrate a single image record"""
        try:
            image_id = image_record["id"]
            post_id = image_record["post_id"]
            original_url = image_record["image_url"]
            
            logger.info(f"Migrating image {image_id} for post {post_id}")
            logger.info(f"Original URL: {original_url}")
            
            # Download image
            image_data = await self.download_image(original_url)
            logger.info(f"Downloaded {len(image_data)} bytes")
            
            # Upload to storage
            new_url = await self.upload_to_storage(image_data, post_id, original_url)
            
            # Update database record
            update_response = self.supabase.table("content_images").update({
                "image_url": new_url
            }).eq("id", image_id).execute()
            
            if update_response.data:
                logger.info(f"✅ Successfully migrated image {image_id}")
                logger.info(f"New URL: {new_url}")
                return True
            else:
                logger.error(f"❌ Failed to update database for image {image_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to migrate image {image_record.get('id', 'unknown')}: {str(e)}")
            return False
    
    async def get_images_to_migrate(self) -> List[Dict[str, Any]]:
        """Get all images that need migration"""
        try:
            # Get all content_images records
            response = self.supabase.table("content_images").select("*").execute()
            
            if not response.data:
                logger.info("No images found in database")
                return []
            
            # Filter for external URLs
            images_to_migrate = []
            for image in response.data:
                if await self.is_external_url(image.get("image_url")):
                    images_to_migrate.append(image)
            
            logger.info(f"Found {len(images_to_migrate)} images to migrate")
            return images_to_migrate
            
        except Exception as e:
            logger.error(f"Failed to get images to migrate: {str(e)}")
            raise
    
    async def run_migration(self):
        """Run the complete migration process"""
        try:
            logger.info("🚀 Starting image migration to Supabase storage...")
            
            # Get images to migrate
            images_to_migrate = await self.get_images_to_migrate()
            
            if not images_to_migrate:
                logger.info("✅ No images need migration. All images are already using Supabase storage.")
                return
            
            # Migrate images one by one
            successful = 0
            failed = 0
            
            for i, image_record in enumerate(images_to_migrate, 1):
                logger.info(f"\n📸 Processing image {i}/{len(images_to_migrate)}")
                
                if await self.migrate_image(image_record):
                    successful += 1
                else:
                    failed += 1
            
            # Summary
            logger.info(f"\n🎉 Migration completed!")
            logger.info(f"✅ Successfully migrated: {successful} images")
            logger.info(f"❌ Failed to migrate: {failed} images")
            
            if failed > 0:
                logger.warning(f"⚠️  {failed} images failed to migrate. Check logs for details.")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            raise

async def main():
    """Main function"""
    try:
        migration = ImageMigration()
        await migration.run_migration()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())
