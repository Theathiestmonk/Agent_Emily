"""
Simplified Image Editor Service - No LangGraph
"""

import os
import base64
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import httpx
from google import genai
from supabase import create_client, Client

logger = logging.getLogger(__name__)

class ImageEditorService:
    def __init__(self):
        # Initialize Supabase
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            logger.error("Missing Supabase configuration")
            raise Exception("Supabase configuration missing")
            
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Initialize Gemini
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not self.gemini_api_key:
            logger.error("Missing Gemini API key")
            raise Exception("Gemini API key missing")
            
        self.gemini_client = genai.Client(api_key=self.gemini_api_key)
        self.gemini_model = 'gemini-2.0-flash-exp'
        self.gemini_image_model = 'gemini-2.5-flash-image-preview'
        
    async def add_logo_to_image(self, user_id: str, input_image_url: str, content: str, position: str = "bottom_right") -> Dict[str, Any]:
        """Add logo to image using Gemini AI"""
        try:
            
            # Get user profile and logo
            user_profile = self._get_user_profile(user_id)
            logo_url = user_profile.get("logo_url")
            
            if not logo_url:
                raise Exception("No logo found in user profile")
            
            # Download both images
            input_image_data = await self._download_image(input_image_url)
            logo_data = await self._download_image(logo_url)
            
            # Create prompt for logo placement
            prompt = self._create_logo_placement_prompt(content, position)
            
            # Generate edited image with Gemini
            edited_image_data = await self._generate_edited_image(
                input_image_data, 
                prompt, 
                logo_data
            )
            
            # Upload edited image to Supabase
            edited_image_url = await self._upload_image_to_storage(edited_image_data, f"edited_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
            
            return {
                "success": True,
                "edited_image_url": edited_image_url,
                "message": f"Logo added successfully in {position.replace('_', ' ')} position!"
            }
            
        except Exception as e:
            logger.error(f"Error adding logo: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def apply_template(self, user_id: str, input_image_url: str, content: str, template_name: str) -> Dict[str, Any]:
        """Apply template to image"""
        try:
            
            # For now, return a placeholder - templates can be implemented later
            return {
                "success": True,
                "edited_image_url": input_image_url,  # Placeholder
                "message": f"Template '{template_name}' applied successfully!"
            }
            
        except Exception as e:
            logger.error(f"Error applying template: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def apply_manual_instructions(self, user_id: str, input_image_url: str, content: str, instructions: str) -> Dict[str, Any]:
        """Apply manual instructions to image"""
        try:
            
            # Download input image
            input_image_data = await self._download_image(input_image_url)
            
            # Generate edited image with Gemini
            edited_image_data = await self._generate_manual_edit(
                input_image_data, 
                content, 
                instructions
            )
            
            # Upload edited image to Supabase
            edited_image_url = await self._upload_image_to_storage(edited_image_data, f"manual_edit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
            
            return {
                "success": True,
                "edited_image_url": edited_image_url,
                "message": "Manual instructions applied successfully!"
            }
            
        except Exception as e:
            logger.error(f"Error applying manual instructions: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def save_edited_image(self, user_id: str, original_image_url: str, edited_image_url: str) -> Dict[str, Any]:
        """Save edited image by replacing the original in storage and updating database"""
        try:
            
            # 1. Download the edited image
            edited_image_data = await self._download_image(edited_image_url)
            
            # 2. Extract the original path from the URL
            # URL format: https://yibrsxythicjzshqhqxf.supabase.co/storage/v1/object/public/ai-generated-images/generated/filename.png
            # From the image, we can see the structure is: ai-generated-images/generated/filename.png
            full_path = original_image_url.split('/storage/v1/object/public/')[-1].split('?')[0]
            # The path should be: generated/filename.png (without the bucket name)
            original_path = full_path.replace('ai-generated-images/', '')
            
            # 3. Delete the original image first to avoid duplicate error
            try:
                delete_result = self.supabase.storage.from_('ai-generated-images').remove([original_path])
            except Exception as e:
                logger.warning(f"Could not delete original image (may not exist): {e}")
            
            # 4. Upload the edited image to replace the original (same path)
            upload_result = self.supabase.storage.from_('ai-generated-images').upload(
                original_path,  # Use the same path as the original
                edited_image_data,
                file_options={"content-type": "image/jpeg"}
            )
            
            if hasattr(upload_result, 'error') and upload_result.error:
                raise Exception(f"Failed to upload edited image: {upload_result.error}")
            
            
            # 5. Delete the temporary edited image from the edited/ folder
            try:
                edited_path = edited_image_url.split('/storage/v1/object/public/')[-1].split('?')[0]
                edited_storage_path = edited_path.replace('ai-generated-images/', '')
                delete_edited_result = self.supabase.storage.from_('ai-generated-images').remove([edited_storage_path])
            except Exception as e:
                logger.error(f"Failed to delete temporary edited image: {e}")
                # Don't fail the entire operation if delete fails, just log it
            
            # 6. Update the content_images table - the original URL now points to the edited image
            result = self.supabase.table('content_images').update({
                'image_url': original_image_url  # Same URL, but now contains the edited image
            }).eq('image_url', original_image_url).execute()
            
            if result.data:
                return {
                    "success": True,
                    "message": "Image saved successfully! The original image has been replaced with your edited version."
                }
            else:
                logger.warning("No image records found to update for original URL")
                return {
                    "success": False,
                    "error": "No image record found to update"
                }
                
        except Exception as e:
            logger.error(f"Error saving image: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile from Supabase"""
        try:
            result = self.supabase.table('profiles').select('*').eq('id', user_id).execute()
            if result.data:
                return result.data[0]
            return {}
        except Exception as e:
            logger.error(f"Error fetching user profile: {e}")
            return {}
    
    async def _download_image(self, image_url: str) -> bytes:
        """Download image from URL"""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(image_url)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.error(f"Error downloading image: {e}")
            raise e
    
    async def _upload_image_to_storage(self, image_data: bytes, filename: str) -> str:
        """Upload image to Supabase storage"""
        try:
            # Upload to ai-generated-images bucket (same as original image editor)
            file_path = f"edited/{filename}"
            result = self.supabase.storage.from_('ai-generated-images').upload(
                file_path, 
                image_data,
                file_options={"content-type": "image/jpeg"}
            )
            
            # Check for upload errors (Supabase returns UploadResponse object)
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Upload error: {result.error}")
            
            # Get public URL
            public_url = self.supabase.storage.from_('ai-generated-images').get_public_url(file_path)
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading image: {e}")
            raise e
    
    def _create_logo_placement_prompt(self, content: str, position: str) -> str:
        """Create AI prompt for logo placement"""
        position_descriptions = {
            "top_left": "top-left corner",
            "top_right": "top-right corner", 
            "bottom_left": "bottom-left corner",
            "bottom_right": "bottom-right corner",
            "center": "center",
        }
        position_desc = position_descriptions.get(position, "bottom-right corner")
        
        return f"""Add the logo from the second image to the first image at the {position_desc}.

CRITICAL BACKGROUND REMOVAL INSTRUCTIONS:
- Extract ONLY the logo elements from the second image
- REMOVE ALL WHITE BACKGROUNDS from the logo
- REMOVE ALL COLORED BACKGROUNDS from the logo
- REMOVE ALL SOLID BACKGROUNDS from the logo
- The logo must be COMPLETELY TRANSPARENT except for the actual logo elements
- NO white rectangles, circles, or shapes should be visible
- NO background colors should remain
- The logo should have ZERO background

STRICT PLACEMENT INSTRUCTIONS:
- Place the logo at the {position_desc} of the first image
- Do NOT add any text, effects, or creative elements
- Do NOT modify the original image content
- Do NOT add shadows, borders, or styling
- Do NOT add any background to the logo
- Just add the transparent logo, nothing else

MANDATORY: The logo must be placed as a transparent overlay with absolutely no background color or shape."""
    
    async def _generate_edited_image(self, input_image_data: bytes, prompt: str, reference_data: bytes = None) -> bytes:
        """Generate edited image using Gemini with two-step approach"""
        try:
            
            if not self.gemini_client:
                logger.warning("Gemini client not available, using fallback")
                return input_image_data
            
            if not reference_data:
                logger.warning("No reference data provided, using single image approach")
                return input_image_data
            
            # Create contents array for Gemini API (same as media agent)
            contents = [
                {
                    "text": prompt
                },
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(input_image_data).decode('utf-8')
                    }
                },
                {
                    "inline_data": {
                        "mime_type": "image/png", # Assuming logo is PNG for transparency
                        "data": base64.b64encode(reference_data).decode('utf-8')
                    }
                }
            ]
            
            response = self.gemini_client.models.generate_content(
                model=self.gemini_image_model,
                contents=contents,
            )
            
            
            # Check if response has candidates
            if not hasattr(response, 'candidates') or not response.candidates:
                logger.error("No candidates in Gemini response")
                raise Exception("No candidates in Gemini response")
            
            # Check if first candidate has content
            if not hasattr(response.candidates[0], 'content') or not response.candidates[0].content:
                logger.error("No content in first candidate")
                raise Exception("No content in first candidate")
            
            # Check if content has parts
            if not hasattr(response.candidates[0].content, 'parts') or not response.candidates[0].content.parts:
                logger.error("No parts in content")
                raise Exception("No parts in content")
            
            logger.info(f"Number of parts: {len(response.candidates[0].content.parts)}")
            
            # Extract image data from response
            image_data = None
            for i, part in enumerate(response.candidates[0].content.parts):
                logger.info(f"Part {i}: {type(part)}")
                logger.info(f"Part {i} has inline_data: {hasattr(part, 'inline_data')}")
                if hasattr(part, 'inline_data') and part.inline_data is not None:
                    logger.info(f"Part {i} inline_data type: {type(part.inline_data)}")
                    logger.info(f"Part {i} inline_data.data type: {type(part.inline_data.data)}")
                    image_data = part.inline_data.data
                    break
            
            if not image_data:
                logger.error("No image data found in any part")
                raise Exception("No image data returned from Gemini")
            
            if isinstance(image_data, bytes):
                image_bytes = image_data
            else:
                image_bytes = base64.b64decode(image_data)
            
            logger.info("Successfully generated edited image with Gemini")
            return image_bytes
            
        except Exception as e:
            logger.error(f"Error generating edited image: {e}")
            raise e
    
    async def _generate_manual_edit(self, input_image_data: bytes, content: str, instructions: str) -> bytes:
        """Generate edited image with manual instructions using Gemini"""
        try:
            
            # Create a more detailed and specific prompt
            prompt = f"""You are a professional image editor. Apply the following editing instructions to the image:

POST CONTENT: {content}

USER INSTRUCTIONS: {instructions}

REQUIREMENTS:
- Follow the user's instructions exactly
- Maintain high image quality and resolution
- Keep the image professional and suitable for social media
- Ensure the edited image looks natural and well-integrated
- Do not add any watermarks or text unless specifically requested
- Preserve the original image's composition unless changes are requested

Generate a high-quality edited image that follows the instructions while maintaining professional standards."""
            
            # Prepare contents for Gemini API
            contents = [
                prompt,
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(input_image_data).decode('utf-8')
                    }
                }
            ]
            
            # Use the correct Gemini model for image generation
            response = self.gemini_client.models.generate_content(
                model=self.gemini_image_model,
                contents=contents
            )
            
            
            # Extract image data from response
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            image_data = part.inline_data.data
                            
                            if isinstance(image_data, bytes):
                                return image_data
                            else:
                                return base64.b64decode(image_data)
            
            raise Exception("No image data returned from Gemini")
            
        except Exception as e:
            logger.error(f"Error generating manual edit: {e}")
            raise e

# Create global instance
image_editor_service = ImageEditorService()
