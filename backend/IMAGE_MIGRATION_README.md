# Image Migration to Supabase Storage

This migration moves all existing DALL-E images from external URLs to Supabase storage for faster loading.

## What This Does

1. **Finds all images** with external URLs (DALL-E URLs)
2. **Downloads each image** from the external URL
3. **Uploads to Supabase storage** in the `ai-generated-images` bucket
4. **Updates the database** with the new Supabase storage URL
5. **Verifies the migration** was successful

## Benefits

- **Faster loading** - Images served from Supabase CDN
- **Better reliability** - No dependency on external DALL-E URLs
- **Consistent performance** - All images load from the same source
- **No expiration** - Supabase storage URLs don't expire like DALL-E URLs

## Prerequisites

Make sure you have these environment variables set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Running the Migration

### 1. Run the Migration
```bash
cd backend
python run_migration.py
```

### 2. Verify the Results
```bash
python verify_migration.py
```

## What to Expect

The migration will:
- Show progress for each image being migrated
- Display success/failure counts
- Log detailed information about each step
- Handle errors gracefully and continue with other images

## Example Output

```
🔄 Starting image migration to Supabase storage...
This will migrate all external DALL-E URLs to Supabase storage for faster loading.

📸 Processing image 1/5
Migrating image abc123 for post def456
Original URL: https://oaidalleapiprodscus.blob.core.windows.net/...
Downloaded 245760 bytes
Successfully uploaded to storage: https://your-project.supabase.co/storage/v1/object/public/ai-generated-images/migrated/def456_a1b2c3d4.png
✅ Successfully migrated image abc123

🎉 Migration completed!
✅ Successfully migrated: 5 images
❌ Failed to migrate: 0 images
```

## Troubleshooting

### Common Issues

1. **Missing environment variables**
   - Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

2. **Network timeouts**
   - The script will retry failed downloads
   - Check your internet connection

3. **Storage permissions**
   - Ensure the service role key has storage permissions
   - Check that the `ai-generated-images` bucket exists

4. **Image download failures**
   - Some DALL-E URLs may have expired
   - The script will log these and continue with other images

### Manual Verification

You can also check the migration results by:
1. Looking at the `content_images` table in your database
2. Checking that `image_url` fields now contain Supabase storage URLs
3. Testing image loading in the frontend

## After Migration

Once migration is complete:
- All images will load faster from Supabase storage
- No more dependency on external DALL-E URLs
- New images will automatically use Supabase storage
- You can safely delete the migration scripts if desired
