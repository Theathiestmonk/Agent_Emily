# Video/Media Upload Flow - Complete Documentation

## Overview
This document explains the complete end-to-end flow when a user uploads a video or image file through the "Design a New Post" modal on the workplace page.

---

## 🎯 User Journey

### Step 1: User Initiates Upload
**Location:** `frontend/src/components/NewPostModal.jsx`

1. User clicks "Design a new post" button on workplace page
2. Modal opens with multi-step form
3. User navigates to "Upload Files" step
4. User clicks upload area or selects files via file picker

**Code Flow:**
```javascript
// User selects files
handleFileSelect(event) {
  // Files are validated immediately
  // Valid files are added to uploadedFiles state
  // uploadFileImmediately() is called for each file
}
```

---

## 📤 Frontend Upload Process

### Step 2: File Validation (Client-Side)
**Location:** `frontend/src/components/NewPostModal.jsx` (lines 260-312)

**Validations:**
- ✅ File size: Max 300MB per file
- ✅ File types allowed:
  - Images: `jpeg, jpg, png, gif, webp, svg`
  - Videos: `mp4, avi, mov, wmv, flv, webm, mkv`
- ✅ Creates preview URL using `URL.createObjectURL()`

**What Happens:**
1. Files are validated one by one
2. Invalid files show error messages
3. Valid files are added to `uploadedFiles` state array with:
   ```javascript
   {
     file: File object,
     id: unique timestamp,
     name: filename,
     size: file size,
     type: MIME type,
     url: local preview URL,
     uploading: true,
     error: false
   }
   ```

### Step 3: Immediate Upload to Backend
**Location:** `frontend/src/components/NewPostModal.jsx` (lines 224-258)

**Process:**
```javascript
uploadFileImmediately(fileObj) {
  1. Creates FormData with file
  2. Sends POST request to /upload-file endpoint
  3. Shows progress message for large files/videos
  4. Updates state on success/error
}
```

**API Call:**
- **Endpoint:** `POST /upload-file`
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `FormData` with file

**UI Feedback:**
- Small files: "Uploading..."
- Large files (>10MB): "Uploading large file..."
- Videos: "Uploading video..."

---

## 🔧 Backend Upload Processing

### Step 4: Backend Receives Request
**Location:** `backend/routers/new_content_modal_router.py` (lines 157-286)

**Initial Validations:**
1. ✅ Checks filename exists
2. ✅ Checks file size > 0
3. ✅ Validates file size < 300MB (before reading)
4. ✅ Validates file type against allowed list

### Step 5: File Reading Strategy
**Location:** `backend/routers/new_content_modal_router.py` (lines 179-210)

**Two Approaches Based on File Size:**

#### A. Small Files (< 10MB)
- Direct read: `file_content = await file.read()`
- Fast and simple

#### B. Large Files (> 10MB) or Videos
- **Chunked Reading** to prevent memory issues:
  ```python
  # Read in 10MB chunks
  chunks = []
  while True:
      chunk = await file.read(10MB)
      if not chunk: break
      chunks.append(chunk)
  file_content = b''.join(chunks)
  ```
- **Why?** Prevents memory overflow and timeout issues
- **Logs:** Progress of each chunk read

### Step 6: File Path Generation
**Location:** `backend/routers/new_content_modal_router.py` (lines 218-229)

**Path Structure:**
- **Videos:** `{user_id}/reels/{uuid}.{ext}`
  - Example: `user123/reels/8be8038f-ce66-415d-adf6-d2f9a3b7f9ab.mp4`
- **Images:** `user_uploads/{user_id}/{uuid}.{ext}`
  - Example: `user_uploads/user123/8be8038f-ce66-415d-adf6-d2f9a3b7f9ab.jpg`

**Bucket Selection:**
- Videos → `user-uploads` bucket
- Images → `ai-generated-images` bucket

### Step 7: Supabase Storage Upload
**Location:** `backend/routers/new_content_modal_router.py` (lines 231-270)

**Upload Process:**
```python
# Timeout configuration
- Videos: 120 seconds timeout
- Images: 30 seconds timeout

# Upload with timeout protection
storage_response = await asyncio.wait_for(
    asyncio.to_thread(
        supabase.storage.from_(bucket).upload,
        file_path,
        file_content,
        {"content-type": mime_type, "upsert": "true"}
    ),
    timeout=upload_timeout
)
```

**Error Handling:**
- ✅ Timeout errors → 504 status with helpful message
- ✅ Storage errors → 500 status with error details
- ✅ All errors logged with traceback

### Step 8: Public URL Generation
**Location:** `backend/routers/new_content_modal_router.py` (lines 252-258)

**Process:**
```python
public_url = supabase.storage.from_(bucket).get_public_url(file_path)
```

**Response Format:**
```json
{
  "success": true,
  "url": "https://yibrsxythicjzshqhqxf.supabase.co/storage/v1/object/public/user-uploads/user123/reels/video.mp4",
  "filename": "original-name.mp4",
  "file_path": "user123/reels/uuid.mp4",
  "bucket": "user-uploads",
  "size": 12345678,
  "content_type": "video/mp4"
}
```

---

## ✅ Frontend Receives Response

### Step 9: Update UI State
**Location:** `frontend/src/components/NewPostModal.jsx` (lines 246-248)

**State Update:**
```javascript
setUploadedFiles(prev => prev.map(f =>
  f.id === fileObj.id ? { 
    ...f, 
    url: result.url,        // Replace preview URL with Supabase URL
    uploading: false,       // Mark as complete
    progress: null,         // Clear progress message
    error: false 
  } : f
))
```

**UI Changes:**
- ✅ Upload spinner disappears
- ✅ Green checkmark appears: "✓ Uploaded"
- ✅ File shows with Supabase URL (not local preview)

---

## 📝 Form Submission

### Step 10: User Submits Form
**Location:** `frontend/src/components/NewPostModal.jsx` (lines 423-471)

**Payload Preparation:**
```javascript
const uploadedFileUrls = uploadedFiles
  .filter(file => file.url && !file.error)  // Only successful uploads
  .map(file => ({
    url: file.url,           // Supabase public URL
    name: file.name,
    type: file.type,
    size: file.size
  }))

const payload = {
  channel: "Social Media",
  platform: "Instagram",
  content_type: "short_video or reel",
  media: "Upload",
  content_idea: "...",
  Post_type: "...",
  uploaded_files: uploadedFileUrls  // Array of file objects with URLs
}
```

### Step 11: Content Creation Request
**Location:** `frontend/src/components/EmilyDashboard.jsx` (lines 837-844)

**API Call:**
- **Endpoint:** `POST /create-content`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Body:** Complete form payload with `uploaded_files` array

---

## 🤖 Backend Content Generation

### Step 12: Agent Processes Uploaded Files
**Location:** `backend/agents/new_content_modal.py`

#### For Videos (`short_video or reel`):
**Location:** `backend/agents/new_content_modal.py` (lines 510-569)

**Process:**
1. Extracts video URL from `uploaded_files[0].url`
2. Generates caption and hashtags using GPT-4o-mini
3. Stores video URL in `media_url` field
4. **Note:** No video analysis (OpenAI Vision doesn't support videos)

**Content Data:**
```python
{
  'title': "Video title",
  'content': "Social media caption",
  'hashtags': ["hashtag1", "hashtag2"],
  'media_url': "https://supabase.../video.mp4",
  'images': []
}
```

#### For Static Posts:
**Location:** `backend/agents/new_content_modal.py` (lines 217-292)

**Process:**
1. Extracts image URL from `uploaded_files[0].url`
2. **Downloads image** and converts to base64
3. Sends to GPT-4o Vision API for image analysis
4. Generates caption based on image content
5. Stores image URL in `images` array

**Important:** Uses base64 conversion to avoid timeout issues with Supabase URLs.

#### For Carousel Posts:
**Location:** `backend/agents/new_content_modal.py` (lines 356-439)

**Process:**
1. Extracts all image URLs from `uploaded_files`
2. Downloads up to 4 images and converts to base64
3. Sends to GPT-4o Vision API for analysis
4. Generates caption based on all images
5. Stores all URLs in `carousel_images` array

### Step 13: Save to Database
**Location:** `backend/agents/new_content_modal.py` (lines 93-95)

**Database Save:**
- Content saved to `created_content` table
- `media_url` or `carousel_images` stored with Supabase URLs
- Returns `content_id` to frontend

---

## 🎉 Completion

### Step 14: Frontend Displays Content
**Location:** `frontend/src/components/EmilyDashboard.jsx` (lines 856-890)

**Process:**
1. Receives `content_id` from backend
2. Fetches complete content from database
3. Displays in content card
4. Shows success indicator

---

## 🔄 Key Improvements Made

### 1. **Chunked Reading for Large Files**
- Prevents memory overflow
- Handles files up to 300MB efficiently
- Logs progress for debugging

### 2. **Timeout Protection**
- Videos: 120 seconds timeout
- Images: 30 seconds timeout
- Clear error messages on timeout

### 3. **Better Error Handling**
- Specific error messages for different failure types
- Detailed logging with tracebacks
- User-friendly error messages in UI

### 4. **Progress Feedback**
- Shows "Uploading video..." for videos
- Shows "Uploading large file..." for files > 10MB
- Clear success/error indicators

### 5. **Base64 Conversion for Images**
- Downloads images before sending to OpenAI Vision API
- Prevents timeout issues with Supabase URLs
- More reliable image analysis

---

## 📊 Flow Diagram

```
User Selects File
    ↓
Frontend Validation (size, type)
    ↓
Create Preview URL (local)
    ↓
POST /upload-file (with file in FormData)
    ↓
Backend Validation
    ↓
Chunked Reading (if large/video)
    ↓
Generate File Path (user_id/reels/uuid.ext)
    ↓
Upload to Supabase Storage (with timeout)
    ↓
Get Public URL
    ↓
Return URL to Frontend
    ↓
Update UI State (replace preview with Supabase URL)
    ↓
User Submits Form
    ↓
POST /create-content (with uploaded_files array)
    ↓
Agent Processes Files
    ↓
Generate Content (with AI if needed)
    ↓
Save to Database
    ↓
Display in Content Card
```

---

## 🐛 Troubleshooting

### Issue: Upload Timeout
**Solution:** 
- Check file size (should be < 300MB)
- Check network connection
- Timeout is 120s for videos, 30s for images

### Issue: Memory Error
**Solution:**
- Chunked reading handles this automatically
- Files > 10MB are read in chunks

### Issue: Invalid File Type
**Solution:**
- Check allowed types in validation
- Ensure file has correct MIME type

### Issue: Supabase Upload Fails
**Solution:**
- Check bucket permissions
- Verify Supabase credentials
- Check file path format

---

## 📝 Notes

1. **Files upload immediately** when selected, not on form submit
2. **Videos are stored** in `user-uploads` bucket at `{user_id}/reels/`
3. **Images are stored** in `ai-generated-images` bucket at `user_uploads/{user_id}/`
4. **Base64 conversion** is used for images sent to OpenAI Vision API
5. **Videos are not analyzed** by AI (OpenAI Vision doesn't support video)

---

## 🔐 Security

- ✅ File size limits enforced (300MB max)
- ✅ File type validation
- ✅ User authentication required
- ✅ Files stored in user-specific paths
- ✅ Public URLs generated securely

---

**Last Updated:** 2024
**Version:** 2.0 (with chunked upload and timeout handling)








