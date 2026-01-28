# Detailed Prompt: Replicate Changes from Last Commit

## Overview
This prompt describes all changes made in commit `4af8f32` ("Update content modal components") that modified 3 files with 331 insertions and 140 deletions. Apply these changes to replicate the functionality in another repository.

---

## File 1: `backend/agents/new_content_modal.py`

### Changes Summary
Modified the video upload handling logic to remove script generation when a user uploads their own video, since they already have the video content.

### Specific Changes:

1. **Update the prompt for uploaded videos** (around line 526):
   - **OLD**: Prompt asked to "Create a short video script and caption"
   - **NEW**: Prompt asks to "Create a social media caption and hashtags" only
   - **Reason**: When users upload their own video, they don't need a script since the video already exists

2. **Remove script-related instructions** (around line 533-545):
   - **REMOVE**: All instructions about script formatting with timestamps (MM:SS format)
   - **REMOVE**: Instructions about Visual/Voiceover formatting
   - **ADD**: Note that script generation is NOT needed for uploaded videos
   - **ADD**: Focus on platform-optimized caption and hashtags only

3. **Update JSON response structure** (around line 547-555):
   - **REMOVE** from JSON structure:
     - `"script"` field
     - `"hook"` field  
     - `"key_points"` field
     - `"cta"` field
   - **KEEP** in JSON structure:
     - `"title"`
     - `"caption"`
     - `"hashtags"` (array)

4. **Update content_data dictionary** (around line 568-575):
   - **REMOVE**: `'short_video_script': content_json.get('script', '')`
   - **ADD**: Comment explaining that no script is stored for uploaded videos
   - **KEEP**: All other fields (title, content, hashtags, images, media_url)

### Code Pattern to Find:
Look for the function that handles video uploads and generates content. It should have a prompt that mentions "Create a short video script" and modify it to only generate captions and hashtags.

---

## File 2: `frontend/src/components/ReelModal.jsx`

### Changes Summary
Major UI/UX improvements: Added notification system, improved video upload handling, restructured layout to conditionally show video/content based on availability, added copy functionality for captions, and improved script rendering with syntax highlighting.

### Specific Changes:

#### 1. **Add New Imports** (top of file):
```javascript
import { useRef } from 'react'  // Add to existing React import
import { RefreshCw } from 'lucide-react'  // Add to existing lucide-react imports
import { useNotifications } from '../contexts/NotificationContext'  // NEW import
```

#### 2. **Add New State Variables** (inside component):
```javascript
const fileInputRef = useRef(null)
const { showSuccess, showError } = useNotifications()
```

#### 3. **Replace All `alert()` Calls with Notification System**:
   - Find all instances of `alert('message')`
   - Replace with:
     - `showError('Title', 'Message')` for errors
     - `showSuccess('Title', 'Message')` for success messages
   - **Locations to update**:
     - File validation errors
     - File size validation errors
     - Authentication errors
     - Upload errors
     - Update errors
     - Success messages

#### 4. **Add File Input Reset Logic**:
   - After successful upload: `if (fileInputRef.current) { fileInputRef.current.value = '' }`
   - After error: Same reset logic
   - This allows users to upload again without page refresh

#### 5. **Restructure Layout - Conditional Rendering**:
   The layout now changes based on whether a video exists:

   **When video EXISTS (`displayContent.media_url` is truthy):**
   - **Left Column**: Video player with "Replace Video" button overlay
   - **Right Column**: Title, Caption (with copy button), Hashtags
   - **Script**: NOT shown (since video already exists)

   **When video DOES NOT exist:**
   - **Left Column**: Title, Caption (with copy button), "No media available" box with upload button, Hashtags
   - **Right Column**: Script display (only if `short_video_script` exists)

#### 6. **Add Hidden File Input**:
   - Add a single hidden file input at the top of the content grid
   - Use `ref={fileInputRef}` to control it programmatically
   - All upload buttons trigger this input via `fileInputRef.current?.click()`

#### 7. **Add Copy Button to Caption**:
   - Add a copy button (absolute positioned, top-right) to the caption div
   - Use `Copy` and `Check` icons from lucide-react
   - Implement clipboard copy functionality
   - Show visual feedback when copied (green background)

#### 8. **Improve Script Rendering** (only shown when no video):
   - Parse script lines to detect timestamp patterns: `MM:SS - [Visual:]` or `MM:SS - [Voiceover:]`
   - Apply syntax highlighting:
     - Timestamps: Blue color, bold
     - Type ([Visual:] or [Voiceover:]): Purple color
     - Content: Regular text
   - Each line rendered separately with proper spacing

#### 9. **Add "Replace Video" Button**:
   - When video exists, show a button overlay on the video player
   - Button uses `RefreshCw` icon
   - Shows "Uploading..." state during upload
   - Positioned absolute top-right of video container

#### 10. **Update Scrollbar Styling**:
   - Add proper scrollbar classes to scrollable containers
   - Dark mode: `dark-scrollbar`
   - Light mode: `scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400`

### Code Pattern to Find:
Look for the ReelModal component that displays video content. It should have a two-column layout and handle video uploads. Restructure it according to the conditional layout pattern described above.

---

## File 3: `frontend/src/components/ATSNContentModal.jsx`

### Changes Summary
Improved script rendering with syntax highlighting and added "No media available" placeholder for reel/short_video content types.

### Specific Changes:

#### 1. **Improve Script Rendering** (around line 1195-1230):
   - **OLD**: Simple `whitespace-pre-wrap` div showing raw script text
   - **NEW**: Parse script line-by-line to detect timestamp patterns
   - **Add**: Syntax highlighting similar to ReelModal:
     - Timestamps (`MM:SS`): Blue color, bold
     - Type tags (`[Visual:]` or `[Voiceover:]`): Purple color  
     - Content: Regular text
   - **Update**: Scrollbar styling classes (same as ReelModal)

#### 2. **Add "No Media Available" Placeholder** (around line 1422-1435):
   - **Condition**: Show only when:
     - Not in editing mode (`!isEditing`)
     - No media URL (`!content.media_url`)
     - No images (`!content.images || content.images.length === 0`)
     - Content type is reel or short_video (`content.content_type === 'short_video or reel' || content.content_type === 'reel'`)
   - **Display**: Centered box with message "No media available" and "Upload a video to display here"
   - **Styling**: Matches dark/light mode theme

### Code Pattern to Find:
Look for the script display section in ATSNContentModal. It should be rendering `content.short_video_script` in a simple div. Update it to parse and highlight timestamps. Also find the hashtags section and add the "No media available" box before it (but only for reel/short_video types).

---

## Implementation Checklist

### Backend (`new_content_modal.py`):
- [ ] Find video upload handling function
- [ ] Update prompt to remove script generation instructions
- [ ] Remove script formatting instructions (timestamp format)
- [ ] Update JSON response structure (remove script, hook, key_points, cta fields)
- [ ] Remove `short_video_script` from content_data dictionary
- [ ] Add comment explaining why no script for uploaded videos

### Frontend (`ReelModal.jsx`):
- [ ] Add `useRef` and `RefreshCw` import
- [ ] Add `useNotifications` import and hook
- [ ] Replace all `alert()` calls with `showError()` or `showSuccess()`
- [ ] Add `fileInputRef` and reset logic after upload
- [ ] Add hidden file input element
- [ ] Restructure layout with conditional rendering (video exists vs doesn't exist)
- [ ] Add copy button to caption div
- [ ] Update script rendering with timestamp parsing and highlighting
- [ ] Add "Replace Video" button overlay
- [ ] Update scrollbar styling classes

### Frontend (`ATSNContentModal.jsx`):
- [ ] Update script rendering with timestamp parsing and highlighting
- [ ] Update scrollbar styling classes
- [ ] Add "No media available" placeholder box (conditional rendering)

---

## Key Dependencies to Verify

1. **Notification Context**: Ensure `NotificationContext` exists at `../contexts/NotificationContext`
   - Should export `useNotifications()` hook
   - Should provide `showSuccess(title, message)` and `showError(title, message)` functions

2. **Icons**: Ensure `lucide-react` package includes:
   - `RefreshCw` icon
   - `Copy` icon (already used)
   - `Check` icon (already used)

3. **Styling**: Ensure Tailwind CSS classes are available:
   - `dark-scrollbar` (custom class, may need to be defined)
   - `scrollbar-thin`, `scrollbar-thumb-*`, `scrollbar-track-*` (from tailwind-scrollbar plugin)

---

## Testing Checklist

After implementing:
- [ ] Upload video works and shows success notification
- [ ] Upload errors show error notifications (not alerts)
- [ ] Video display switches layout correctly (video on left when exists)
- [ ] Script only shows when no video exists
- [ ] Copy button works for captions
- [ ] "Replace Video" button works
- [ ] Script syntax highlighting works (timestamps in blue, types in purple)
- [ ] "No media available" box shows for reel/short_video without media
- [ ] File input resets after upload (can upload again)
- [ ] Dark mode styling works correctly

---

## Notes

- The main philosophy: **When users upload their own video, they don't need AI-generated scripts**. The backend should only generate captions and hashtags.
- The UI adapts: **Layout changes based on whether video exists** - if video exists, show it prominently; if not, show script and upload option.
- **User experience**: Replaced browser alerts with a proper notification system for better UX.
- **Accessibility**: Copy functionality makes it easier for users to copy captions to clipboard.
