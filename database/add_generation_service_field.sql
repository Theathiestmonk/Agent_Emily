-- Add generation_service field to content_images table
-- This field tracks which service was used (google_gemini, openai_dalle, internal_fallback)

-- Add generation_service column to content_images table
ALTER TABLE content_images 
ADD COLUMN IF NOT EXISTS generation_service TEXT DEFAULT 'unknown';

-- Add generation_service column to ad_images table as well
ALTER TABLE ad_images 
ADD COLUMN IF NOT EXISTS generation_service TEXT DEFAULT 'unknown';

-- Add generation_service column to image_generation_requests table
ALTER TABLE image_generation_requests 
ADD COLUMN IF NOT EXISTS generation_service TEXT DEFAULT 'unknown';

-- Update existing records to have a default value
UPDATE content_images 
SET generation_service = 'unknown' 
WHERE generation_service IS NULL;

UPDATE ad_images 
SET generation_service = 'unknown' 
WHERE generation_service IS NULL;

UPDATE image_generation_requests 
SET generation_service = 'unknown' 
WHERE generation_service IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN content_images.generation_service IS 'Service used for image generation: google_gemini, openai_dalle, internal_fallback';
COMMENT ON COLUMN ad_images.generation_service IS 'Service used for image generation: google_gemini, openai_dalle, internal_fallback';
COMMENT ON COLUMN image_generation_requests.generation_service IS 'Service used for image generation: google_gemini, openai_dalle, internal_fallback';
