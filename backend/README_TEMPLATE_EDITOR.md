# Template Editor Designer Agent

A sophisticated AI-powered template editor that transforms content and images into beautiful graphic templates using LangGraph workflow management.

## Overview

The Template Editor Designer Agent is a comprehensive system that uses LangGraph to orchestrate a multi-step process for creating professional-looking graphic templates from user content and images. It leverages OpenAI's vision capabilities and advanced image processing to analyze templates, adapt content, and generate stunning visual outputs.

## Architecture

The system is built using LangGraph, which provides a robust workflow management framework with the following nodes:

### Workflow Nodes

1. **Template Uploader** - Handles template selection and upload
2. **Template Analyzer** - Uses OpenAI vision to analyze template structure
3. **Content Modifier** - Adapts content to fit template requirements
4. **Image Modifier** - Analyzes and modifies images for template compatibility
5. **Content Output Generator** - Creates the final template with content and images
6. **Flow Router** - Manages workflow routing based on user decisions
7. **Custom Edit Node** - Handles user custom instructions
8. **Save Image** - Saves final template to Supabase storage

## Features

### Core Capabilities

- **Template Analysis**: AI-powered analysis of template structure and content areas
- **Content Adaptation**: Intelligent content modification to fit template requirements
- **Image Processing**: Advanced image analysis and modification for template compatibility
- **Workflow Management**: Robust LangGraph-based workflow orchestration
- **Custom Editing**: Support for user custom instructions and iterative editing
- **Template Library**: Pre-made templates and custom template upload
- **Real-time Processing**: Asynchronous processing with progress tracking

### Template Types

- **Social Media Templates**: Instagram, Facebook, Twitter, LinkedIn posts
- **Marketing Templates**: Promotional materials, advertisements
- **Event Templates**: Invitations, announcements, flyers
- **Business Templates**: Professional presentations, reports
- **Creative Templates**: Artistic designs, illustrations
- **Newsletter Templates**: Email templates, newsletters

## API Endpoints

### Template Management

- `POST /api/template-editor/start-editing` - Start template editing process
- `GET /api/template-editor/premade-templates` - Get available templates
- `POST /api/template-editor/upload-template` - Upload custom template
- `DELETE /api/template-editor/template/{template_id}` - Delete template
- `GET /api/template-editor/categories` - Get template categories

### Workflow Management

- `POST /api/template-editor/continue-workflow` - Continue workflow with user input
- `GET /api/template-editor/workflow-status/{workflow_id}` - Get workflow status

## Database Schema

The system uses several database tables:

- `premade_templates` - Stores template data and metadata
- `template_workflows` - Tracks active editing workflows
- `template_sessions` - Stores workflow session data
- `template_categories` - Template categorization
- `template_analytics` - Usage analytics and metrics
- `template_favorites` - User favorite templates

## Installation

1. Install additional dependencies:
```bash
pip install -r requirements_template_editor.txt
```

2. Run database migrations:
```sql
-- Execute template_editor_schema.sql
```

3. Set up environment variables:
```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

### Basic Usage

```python
from agents.template_editor_agent import template_editor_agent

# Start template editing process
result = await template_editor_agent.process_template_edit(
    current_content="Your content here",
    current_image_url="https://example.com/image.jpg",
    user_id="user_id",
    content_id="content_id",
    template_id="template_id"  # Optional for premade templates
)
```

### Frontend Integration

```jsx
import TemplateEditor from './components/TemplateEditor'

// Use in your component
<TemplateEditor 
  content={content}
  onClose={() => setShowEditor(false)}
  onSave={(newImageUrl) => updateContentImage(newImageUrl)}
/>
```

## Workflow Process

### 1. Template Selection
- User selects from premade templates or uploads custom template
- System validates template format and structure

### 2. Template Analysis
- OpenAI vision analyzes template structure
- Identifies content areas, image placeholders, and design elements
- Extracts styling information (colors, fonts, layout)

### 3. Content Modification
- AI adapts user content to fit template structure
- Generates appropriate text for different content areas
- Maintains brand voice and messaging consistency

### 4. Image Processing
- Analyzes current image for template compatibility
- Suggests modifications (cropping, resizing, color adjustments)
- Ensures optimal image placement and quality

### 5. Template Generation
- Combines modified content and images with template
- Applies styling and layout adjustments
- Generates high-quality final output

### 6. User Interaction
- Presents final template for review
- Allows custom editing instructions
- Supports iterative refinement process

### 7. Save and Export
- Saves final template to Supabase storage
- Updates content with new image URL
- Provides download and sharing options

## Configuration

### Template Categories

The system supports configurable template categories:

- Social Media
- Marketing
- Events
- Business
- Creative
- Newsletter

### Image Processing Settings

- Supported formats: JPEG, PNG, WebP
- Maximum file size: 10MB
- Output quality: 95% JPEG compression
- Resolution: Up to 4K

### AI Model Configuration

- Template Analysis: GPT-4 Vision
- Content Generation: GPT-4
- Image Analysis: GPT-4 Vision
- Workflow Management: LangGraph

## Error Handling

The system includes comprehensive error handling:

- Template validation errors
- Image processing failures
- AI service timeouts
- Database connection issues
- User input validation

## Performance Optimization

- Asynchronous processing for all operations
- Image caching and optimization
- Database query optimization
- Workflow state management
- Progress tracking and user feedback

## Security

- User authentication and authorization
- Row-level security (RLS) policies
- Input validation and sanitization
- Secure file upload handling
- API rate limiting

## Monitoring and Analytics

- Workflow execution tracking
- Template usage analytics
- Performance metrics
- Error logging and monitoring
- User interaction tracking

## Future Enhancements

- Advanced AI image generation
- Template marketplace
- Collaborative editing
- Version control
- Advanced customization options
- Mobile app integration

## Troubleshooting

### Common Issues

1. **Template Upload Fails**
   - Check file format and size
   - Verify Supabase storage permissions
   - Ensure proper authentication

2. **AI Analysis Errors**
   - Verify OpenAI API key
   - Check image quality and format
   - Monitor API rate limits

3. **Workflow Stuck**
   - Check workflow status endpoint
   - Verify database connectivity
   - Review error logs

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=DEBUG
```

## Contributing

1. Follow the existing code structure
2. Add comprehensive tests
3. Update documentation
4. Follow security best practices
5. Test with various template types

## License

This template editor is part of the Emily 3.0 project and follows the same licensing terms.
