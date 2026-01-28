# AI Prompt: Replicate Content Modal Changes

Apply the following changes to replicate the functionality from commit `4af8f32`:

## Backend Changes (`backend/agents/new_content_modal.py`)

**Goal**: Remove script generation for uploaded videos since users already have the video.

1. **Update video upload prompt** (line ~526): Change from "Create a short video script and caption" to "Create a social media caption and hashtags" only.

2. **Remove script formatting instructions**: Delete all instructions about timestamp formatting (MM:SS), Visual/Voiceover formatting. Add note that script generation is NOT needed for uploaded videos.

3. **Update JSON response structure**: Remove `script`, `hook`, `key_points`, `cta` fields. Keep only `title`, `caption`, `hashtags`.

4. **Update content_data**: Remove `'short_video_script'` field. Add comment explaining no script for uploaded videos.

## Frontend Changes (`frontend/src/components/ReelModal.jsx`)

**Goal**: Improve UX with notifications, conditional layout, copy functionality, and better script rendering.

1. **Add imports**: `useRef` from React, `RefreshCw` from lucide-react, `useNotifications` from NotificationContext.

2. **Add state**: `fileInputRef = useRef(null)`, `const { showSuccess, showError } = useNotifications()`.

3. **Replace alerts**: Replace all `alert()` calls with `showError('Title', 'Message')` or `showSuccess('Title', 'Message')`.

4. **Add file input reset**: After upload (success or error), reset file input: `fileInputRef.current.value = ''`.

5. **Restructure layout conditionally**:
   - **If video exists** (`displayContent.media_url`):
     - Left: Video player with "Replace Video" button overlay
     - Right: Title, Caption (with copy button), Hashtags
     - Script: Hidden
   - **If no video**:
     - Left: Title, Caption (with copy button), "No media" upload box, Hashtags
     - Right: Script display (if exists)

6. **Add hidden file input**: Single `<input ref={fileInputRef} type="file" accept="video/*" className="hidden" />` at top of content grid.

7. **Add copy button**: Absolute positioned copy button (top-right) on caption div. Use Copy/Check icons, implement clipboard copy with visual feedback.

8. **Improve script rendering**: Parse lines for timestamp pattern `MM:SS - [Visual:]` or `MM:SS - [Voiceover:]`. Highlight timestamps (blue, bold), types (purple), content (regular). Only show when no video exists.

9. **Add "Replace Video" button**: Overlay button on video player (RefreshCw icon, shows "Uploading..." state).

10. **Update scrollbars**: Add `dark-scrollbar` for dark mode, `scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100` for light mode.

## Frontend Changes (`frontend/src/components/ATSNContentModal.jsx`)

**Goal**: Improve script rendering and add media placeholder.

1. **Update script rendering**: Same timestamp parsing and highlighting as ReelModal (timestamps blue/bold, types purple).

2. **Add "No media available" box**: Show between caption and hashtags when `!isEditing && !content.media_url && (!content.images || content.images.length === 0) && (content.content_type === 'short_video or reel' || content.content_type === 'reel')`. Display centered message "No media available" with "Upload a video to display here".

3. **Update scrollbars**: Same styling as ReelModal.

## Requirements

- Ensure `NotificationContext` exists with `useNotifications()` hook providing `showSuccess()` and `showError()`.
- Ensure `lucide-react` has `RefreshCw`, `Copy`, `Check` icons.
- Ensure Tailwind scrollbar classes are available.

## Expected Result

- Backend: No script generation for uploaded videos, only captions/hashtags.
- Frontend: Better UX with notifications, conditional layouts, copy functionality, syntax-highlighted scripts.
- Users can upload videos, see them prominently displayed, copy captions easily, and replace videos seamlessly.
