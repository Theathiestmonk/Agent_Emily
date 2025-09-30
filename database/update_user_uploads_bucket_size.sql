-- Update user-uploads bucket to support larger files (100MB for videos)
UPDATE storage.buckets 
SET file_size_limit = 104857600  -- 100MB in bytes
WHERE id = 'user-uploads';

-- Also update allowed_mime_types to include more video formats
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
    'video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/wmv'
]
WHERE id = 'user-uploads';

