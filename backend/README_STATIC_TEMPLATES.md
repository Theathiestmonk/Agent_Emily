# Static Template System

The Template Editor now uses static template files stored in the `backend/templates/` directory instead of storing templates in Supabase. This approach is more efficient, faster, and easier to manage.

## Directory Structure

```
backend/templates/
├── templates.json                 # Template configuration file
├── social-media/                  # Social media templates
│   ├── instagram-post-1.jpg
│   ├── instagram-post-1-preview.jpg
│   ├── facebook-cover-1.jpg
│   └── facebook-cover-1-preview.jpg
├── marketing/                     # Marketing templates
│   ├── promo-banner-1.jpg
│   └── promo-banner-1-preview.jpg
├── events/                        # Event templates
│   ├── event-invitation-1.jpg
│   └── event-invitation-1-preview.jpg
├── business/                      # Business templates
│   ├── business-presentation-1.jpg
│   └── business-presentation-1-preview.jpg
├── creative/                      # Creative templates
│   ├── artistic-quote-1.jpg
│   └── artistic-quote-1-preview.jpg
└── newsletter/                    # Newsletter templates
    └── (template files)
```

## Template Configuration

Templates are configured in `templates.json` with the following structure:

```json
{
  "templates": [
    {
      "id": "social-media-1",
      "name": "Instagram Post Template",
      "category": "social-media",
      "description": "Modern Instagram post template with clean design",
      "filename": "instagram-post-1.jpg",
      "preview_url": "/static/templates/social-media/instagram-post-1-preview.jpg",
      "content_areas": [
        {
          "type": "text",
          "label": "title",
          "position": {"x": 50, "y": 100, "width": 300, "height": 60},
          "style": {"font_size": 28, "color": "#FFFFFF", "font_family": "Arial Bold"},
          "required": true
        }
      ],
      "image_areas": [
        {
          "label": "main_image",
          "position": {"x": 400, "y": 50, "width": 200, "height": 200},
          "aspect_ratio": "1:1"
        }
      ],
      "design_info": {
        "primary_colors": ["#E91E63", "#9C27B0"],
        "font_families": ["Arial", "Helvetica"],
        "overall_style": "modern"
      }
    }
  ],
  "categories": [
    {
      "name": "social-media",
      "display_name": "Social Media",
      "description": "Templates for social media posts",
      "icon": "share-2",
      "color": "#3B82F6"
    }
  ]
}
```

## Template Manager

The `TemplateManager` class handles all template operations:

```python
from utils.template_manager import template_manager

# Get all templates
templates = template_manager.get_all_templates()

# Get templates by category
social_templates = template_manager.get_templates_by_category("social-media")

# Get specific template
template = template_manager.get_template_by_id("social-media-1")

# Get template image as base64
image_b64 = template_manager.get_template_image_base64("social-media-1")

# Get template analysis data
analysis = template_manager.get_template_analysis("social-media-1")
```

## API Endpoints

### Get Templates
```
GET /api/template-editor/premade-templates?category=social-media
```

### Get Template Image
```
GET /api/template-editor/template-image/{template_id}
```

### Get Template Preview
```
GET /api/template-editor/template-preview/{template_id}
```

### Get Categories
```
GET /api/template-editor/categories
```

### Get Template Stats
```
GET /api/template-editor/template-stats
```

## Adding New Templates

1. **Create Template Image**: Add your template image to the appropriate category folder
2. **Create Preview Image**: Add a smaller preview version (200x200px recommended)
3. **Update Configuration**: Add template details to `templates.json`
4. **Test**: Verify the template loads correctly via API

### Example Template Addition

1. Add `my-template.jpg` to `backend/templates/social-media/`
2. Add `my-template-preview.jpg` to the same folder
3. Update `templates.json`:

```json
{
  "id": "social-media-3",
  "name": "My Custom Template",
  "category": "social-media",
  "description": "A custom social media template",
  "filename": "my-template.jpg",
  "preview_url": "/static/templates/social-media/my-template-preview.jpg",
  "content_areas": [...],
  "image_areas": [...],
  "design_info": {...}
}
```

## Benefits of Static Templates

### Performance
- **Faster Loading**: No database queries for template data
- **Reduced Latency**: Direct file serving
- **Better Caching**: Static files can be cached by CDN

### Simplicity
- **Easy Management**: Just add files to folders
- **Version Control**: Templates can be versioned with Git
- **No Database Dependencies**: Templates don't require database storage

### Scalability
- **CDN Ready**: Static files can be served from CDN
- **Reduced Database Load**: No template queries on database
- **Easy Backup**: Simple file system backup

## Database Schema

The simplified database schema only includes workflow management:

- `template_workflows` - Active template editing workflows
- `template_sessions` - Workflow session data
- `template_analytics` - Usage analytics (template_id references static templates)
- `template_favorites` - User favorite templates

## Migration from Supabase Storage

If migrating from Supabase-stored templates:

1. Export existing templates from Supabase
2. Save template images to appropriate category folders
3. Create preview images
4. Update `templates.json` with template metadata
5. Remove old Supabase template tables

## Template Image Requirements

### Main Template Images
- **Format**: JPEG or PNG
- **Quality**: High resolution (minimum 600px width)
- **Size**: Optimized for web (under 2MB)

### Preview Images
- **Format**: JPEG
- **Size**: 200x200px (square)
- **Quality**: Compressed for fast loading

## Content Areas Configuration

Templates define content areas where text and images will be placed:

```json
"content_areas": [
  {
    "type": "text",
    "label": "title",
    "position": {"x": 50, "y": 100, "width": 300, "height": 60},
    "style": {
      "font_size": 28,
      "color": "#FFFFFF",
      "font_family": "Arial Bold"
    },
    "required": true
  }
]
```

## Image Areas Configuration

Templates can define areas for user images:

```json
"image_areas": [
  {
    "label": "main_image",
    "position": {"x": 400, "y": 50, "width": 200, "height": 200},
    "aspect_ratio": "1:1"
  }
]
```

## Design Information

Templates include design metadata for consistent styling:

```json
"design_info": {
  "primary_colors": ["#E91E63", "#9C27B0"],
  "font_families": ["Arial", "Helvetica"],
  "overall_style": "modern"
}
```

This static template system provides a robust, scalable, and efficient way to manage template assets while maintaining the full functionality of the Template Editor Designer Agent.
