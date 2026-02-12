-- Migration: Update user-uploads bucket file size limit to 300MB
-- This allows uploading large video files (up to 300MB) as per application requirements
-- Run this in your Supabase SQL editor

-- Update the file_size_limit for user-uploads bucket to 300MB (314572800 bytes)
UPDATE storage.buckets
SET file_size_limit = 314572800  -- 300MB in bytes
WHERE id = 'user-uploads';

-- Also update allowed_mime_types to include all video formats supported by the application
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/webp', 
    'image/gif', 
    'video/mp4', 
    'video/webm',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/mkv'
]
WHERE id = 'user-uploads';

-- Verify the update
SELECT id, name, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'user-uploads';






