# Custom Prompt System for Template Editor Agent

## Overview

The Custom Prompt System allows the team to create and manage template-specific prompts that automatically generate content for specific templates, bypassing the template analyzer when curated prompts are available. This significantly improves performance and ensures consistent, high-quality content generation.

## Features

- ✅ **Template-specific prompts**: Create custom prompts for individual templates
- ✅ **Automatic workflow optimization**: Skip template analyzer when custom prompts exist
- ✅ **Content substitution**: Dynamic content replacement in prompts
- ✅ **Team management**: Add, update, and delete prompts via API
- ✅ **Fallback support**: Graceful fallback to template analyzer when needed
- ✅ **Version control**: Track prompt versions and updates

## Architecture

### Components

1. **Custom Prompts Configuration** (`backend/config/custom_prompts.json`)
   - JSON file containing all template-specific prompts
   - Includes metadata, guidelines, and routing decisions

2. **Prompt Manager** (`backend/utils/prompt_manager.py`)
   - Core utility for managing custom prompts
   - Handles CRUD operations and configuration management

3. **Template Editor Agent** (`backend/agents/template_editor_agent.py`)
   - Updated workflow with custom prompt processing
   - Conditional routing based on prompt availability

4. **API Endpoints** (`backend/routers/template_editor.py`)
   - RESTful API for prompt management
   - Team-friendly interface for prompt operations

## Workflow

### Normal Flow (No Custom Prompt)
```
Template Uploader → Template Analyzer → Logo Fetcher → Content Modifier → Image Modifier → Output Generator
```

### Optimized Flow (With Custom Prompt)
```
Template Uploader → Custom Prompt Processor → Logo Fetcher → Content Modifier → Image Modifier → Output Generator
```

## Configuration

### Custom Prompts JSON Structure

```json
{
  "templates": {
    "did_you_know": {
      "name": "Did You Know",
      "description": "Educational and engaging fact-based template",
      "prompt": "You are a social media content transformer...",
      "skip_template_analyzer": true,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "created_by": "team"
    }
  },
  "settings": {
    "default_skip_analyzer": true,
    "fallback_to_analyzer": true,
    "prompt_version": "1.0.0"
  }
}
```

### Template Name Mapping

The system automatically maps template IDs to prompt names:

| Template ID Pattern | Prompt Name |
|-------------------|-------------|
| `social-media-Did_you_know-*` | `did_you_know` |
| `social-media-Motivational_Quote-*` | `motivational_quote` |
| `social-media-Tips_and_Tricks-*` | `tips_and_tricks` |
| `social-media-Behind_the_Scenes-*` | `behind_the_scenes` |

## API Endpoints

### Get All Custom Prompts
```http
GET /api/template-editor/custom-prompts
```

### Get Specific Custom Prompt
```http
GET /api/template-editor/custom-prompts/{template_name}
```

### Create/Update Custom Prompt
```http
POST /api/template-editor/custom-prompts
Content-Type: application/x-www-form-urlencoded

template_name=did_you_know
name=Did You Know
description=Educational and engaging fact-based template
prompt=You are a social media content transformer...
skip_template_analyzer=true
```

### Update Custom Prompt
```http
PUT /api/template-editor/custom-prompts/{template_name}
Content-Type: application/x-www-form-urlencoded

name=Updated Name
description=Updated description
prompt=Updated prompt...
skip_template_analyzer=true
```

### Delete Custom Prompt
```http
DELETE /api/template-editor/custom-prompts/{template_name}
```

### Reload Configuration
```http
POST /api/template-editor/custom-prompts/reload
```

## Usage Examples

### Adding a New Custom Prompt

1. **Via API**:
```bash
curl -X POST "http://localhost:8000/api/template-editor/custom-prompts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "template_name=my_template" \
  -F "name=My Template" \
  -F "description=Description of my template" \
  -F "prompt=You are a content creator..." \
  -F "skip_template_analyzer=true"
```

2. **Via JSON File**:
Edit `backend/config/custom_prompts.json` and add your template:
```json
{
  "templates": {
    "my_template": {
      "name": "My Template",
      "description": "Description of my template",
      "prompt": "You are a content creator...",
      "skip_template_analyzer": true,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "created_by": "team"
    }
  }
}
```

### Testing Custom Prompts

Run the test script to verify everything works:
```bash
cd backend
python test_custom_prompts.py
```

## Prompt Guidelines

### Best Practices

1. **Clear Instructions**: Provide specific, actionable instructions
2. **Output Format**: Define exact output format expected
3. **Content Guidelines**: Include style, tone, and length guidelines
4. **Placeholder Usage**: Use `{post_content}` for content substitution
5. **Avoid Technical Jargon**: Keep prompts accessible to all team members

### Example Prompt Structure

```
You are a [ROLE]. Your task is to [TASK].

Output format:
[EXACT FORMAT]

Guidelines:
- [GUIDELINE 1]
- [GUIDELINE 2]
- [GUIDELINE 3]

Do not include [RESTRICTIONS].
```

## Performance Benefits

- **Faster Processing**: Skip template analyzer when custom prompts exist
- **Consistent Quality**: Curated prompts ensure consistent output
- **Reduced API Calls**: Fewer OpenAI API calls for template analysis
- **Better User Experience**: Faster content generation

## Monitoring and Debugging

### Log Messages

The system provides detailed logging:

```
🎯 Custom Prompt Processor: Checking for custom prompts...
✅ Found custom prompt for template: did_you_know
✅ Custom prompt processed. Skip analyzer: True
🎯 Routing: Skip template analyzer (custom prompt available)
```

### Debugging Tips

1. **Check Template Name Extraction**: Verify template ID mapping
2. **Validate Prompt Format**: Ensure proper JSON structure
3. **Test Content Substitution**: Verify `{post_content}` replacement
4. **Monitor API Responses**: Check OpenAI API calls and responses

## Troubleshooting

### Common Issues

1. **Template Not Found**
   - Check template name mapping in `_extract_template_name()`
   - Verify template ID format matches expected patterns

2. **Prompt Not Loading**
   - Check JSON syntax in `custom_prompts.json`
   - Verify file permissions and path

3. **Content Not Generated**
   - Check OpenAI API key and quota
   - Verify prompt format and content substitution

4. **Workflow Not Skipping**
   - Check `skip_template_analyzer` setting
   - Verify conditional routing logic

### Support

For issues or questions:
1. Check the logs for error messages
2. Run the test script to verify configuration
3. Review the API responses for detailed error information
4. Contact the development team for assistance

## Future Enhancements

- [ ] **Prompt Versioning**: Track and manage prompt versions
- [ ] **A/B Testing**: Test different prompts for the same template
- [ ] **Analytics**: Track prompt performance and usage
- [ ] **Template Validation**: Validate prompts against template structure
- [ ] **Bulk Operations**: Import/export multiple prompts
- [ ] **Role-based Access**: Different permissions for prompt management
