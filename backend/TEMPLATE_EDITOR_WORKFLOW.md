# Template Editor Agent Workflow

## Current Workflow Flow

```
┌─────────────────────┐
│   Template Uploader │
│   (Node 1)          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Custom Prompt       │
│ Processor           │
│ (Node 1.5)          │
│                     │
│ • Extract template  │
│   name from ID      │
│ • Check for custom  │
│   prompts           │
│ • Generate content  │
│   if prompt exists  │
└─────────┬───────────┘
          │
          │ Decision Point
          │ ┌─────────────────┐
          │ │ Has Custom      │
          │ │ Prompt?         │
          │ └─────────────────┘
          │
          ├─ YES ──────────────────┐
          │                        │
          ▼                        │
┌─────────────────────┐            │
│ Skip Template       │            │
│ Analyzer            │            │
│ (Direct to Logo     │            │
│  Fetcher)           │            │
└─────────┬───────────┘            │
          │                        │
          │                        │
          ▼                        │
┌─────────────────────┐            │
│   Logo Fetcher      │◄───────────┘
│   (Node 3)          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Content Modifier    │
│ (Node 4)            │
│                     │
│ • Skip if content   │
│   already generated │
│   from custom prompt│
│ • Adapt content for │
│   template structure│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Image Modifier      │
│ (Node 5)            │
│                     │
│ • Analyze image     │
│   requirements      │
│ • Prepare for       │
│   final generation  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Content Output      │
│ Generator           │
│ (Node 6)            │
│                     │
│ • Use Gemini API    │
│   to generate final │
│   template image    │
│ • Combine template  │
│   + content + logo  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Flow Router         │
│ (Node 7)            │
│                     │
│ • Determine next    │
│   step based on     │
│   user satisfaction │
│ • Route to custom   │
│   edit or save      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Custom Edit Node    │
│ OR Save Image       │
│ (Final Actions)     │
└─────────────────────┘
```

## Custom Prompt System Integration

### Template Name Mapping
```
Template ID Pattern          →  Prompt Name
─────────────────────────────────────────────
social-media-Did_you_know-*  →  did_you_know
social-media-Motivational_*  →  motivational_quote
social-media-Tips_and_*      →  tips_and_tricks
social-media-Behind_the_*    →  behind_the_scenes
```

### Custom Prompt Flow
```
1. Template Uploader extracts template_id
2. Custom Prompt Processor:
   ├─ Extract template name from ID
   ├─ Check if custom prompt exists
   ├─ If exists:
   │   ├─ Format prompt with content
   │   ├─ Generate content via OpenAI
   │   ├─ Create content_pieces structure
   │   └─ Set skip_template_analyzer = true
   └─ If not exists:
       └─ Set skip_template_analyzer = false
3. Route based on skip_template_analyzer flag
```

## Content Generation Paths

### Corrected Flow (All Templates)
```
Template Uploader
       ↓
Custom Prompt Processor
       ↓ (stores custom prompt if available)
Template Analyzer
       ↓
Logo Fetcher
       ↓
Content Modifier
       ├─ Has Custom Prompt? → Use custom prompt to generate content
       └─ No Custom Prompt? → Use template analysis to generate content
       ↓
Image Modifier
       ↓
Content Output Generator
       ↓
Flow Router
```

## Key Components

### 1. Custom Prompt Processor
- **Purpose**: Check for curated prompts and generate content
- **Input**: template_id, current_content
- **Output**: content_pieces (if custom prompt exists)
- **Decision**: skip_template_analyzer flag

### 2. Template Analyzer
- **Purpose**: Analyze template structure using OpenAI Vision
- **Skipped**: When custom prompt exists
- **Output**: template_analysis

### 3. Content Modifier
- **Purpose**: Adapt content for template structure
- **Skipped**: When content_pieces already exist from custom prompt
- **Output**: content_pieces

### 4. Content Output Generator
- **Purpose**: Generate final template image using Gemini API
- **Input**: template_image, content_pieces, template_analysis
- **Output**: final_template (base64 image)

## Current Issues & Fixes

### Issue 1: Gemini API Not Generating Images
- **Problem**: Gemini returns text instead of image
- **Fix**: Updated prompt to explicitly request image generation
- **Status**: ✅ Fixed

### Issue 2: Custom Prompts Not Triggering
- **Problem**: Template name extraction failing
- **Fix**: Added debugging and improved template ID matching
- **Status**: 🔍 Debugging in progress

### Issue 3: Content Format Mismatch
- **Problem**: Generated content doesn't match expected format
- **Fix**: Template-specific content piece structure
- **Status**: ✅ Fixed

## API Endpoints

### Custom Prompt Management
```
GET    /api/template-editor/custom-prompts
GET    /api/template-editor/custom-prompts/{template_name}
POST   /api/template-editor/custom-prompts
PUT    /api/template-editor/custom-prompts/{template_name}
DELETE /api/template-editor/custom-prompts/{template_name}
POST   /api/template-editor/custom-prompts/reload
```

### Template Editor
```
POST   /api/template-editor/start-editing
POST   /api/template-editor/apply-template
POST   /api/template-editor/save-image
```

## Configuration Files

### Custom Prompts
- **File**: `backend/config/custom_prompts.json`
- **Purpose**: Store template-specific prompts
- **Format**: JSON with template metadata and prompts

### Environment Variables
- **GEMINI_API_KEY**: Required for image generation
- **OPENAI_API_KEY**: Required for content generation
- **SUPABASE_***: Database and storage configuration
