"""
Template Editor Agent Usage Example
This example demonstrates how to use the template editor designer agent
"""

import asyncio
import os
from agents.template_editor_agent import template_editor_agent

async def example_template_editing():
    """Example of using the template editor agent"""
    
    # Example content and image
    current_content = """
    🎉 Exciting News! 
    
    We're thrilled to announce the launch of our new AI-powered content creation platform! 
    This revolutionary tool will help you create stunning social media posts, engaging blog content, 
    and professional marketing materials in minutes, not hours.
    
    Key features:
    ✨ AI-powered content generation
    🎨 Beautiful template designs
    📱 Multi-platform posting
    📊 Performance analytics
    
    Join thousands of creators who are already using our platform to transform their content strategy!
    """
    
    current_image_url = "https://example.com/your-image.jpg"
    user_id = "user_123"
    content_id = "content_456"
    
    # Example 1: Using a premade template
    print("🎨 Example 1: Using premade template")
    result1 = await template_editor_agent.process_template_edit(
        current_content=current_content,
        current_image_url=current_image_url,
        user_id=user_id,
        content_id=content_id,
        template_id="template_123"  # Premade template ID
    )
    
    print(f"Result: {result1}")
    
    # Example 2: Using custom uploaded template
    print("\n🎨 Example 2: Using custom template")
    custom_template_image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."  # Base64 encoded image
    
    result2 = await template_editor_agent.process_template_edit(
        current_content=current_content,
        current_image_url=current_image_url,
        user_id=user_id,
        content_id=content_id,
        template_image=custom_template_image
    )
    
    print(f"Result: {result2}")

async def example_workflow_continuation():
    """Example of continuing a workflow with user input"""
    
    # Simulate workflow continuation
    from agents.template_editor_agent import TemplateEditorState
    
    # Create state for custom editing
    state = TemplateEditorState(
        current_content="Your content here",
        current_image_url="https://example.com/image.jpg",
        user_id="user_123",
        content_id="content_456",
        template_id="template_123",
        template_image=None,
        template_type="premade",
        template_analysis={
            "content_areas": [
                {
                    "type": "text",
                    "label": "title",
                    "position": {"x": 100, "y": 50, "width": 300, "height": 60},
                    "style": {"font_size": 24, "color": "#000000", "font_family": "Arial"},
                    "required": True
                }
            ],
            "image_areas": [],
            "design_info": {
                "primary_colors": ["#FF0000", "#00FF00"],
                "font_families": ["Arial"],
                "overall_style": "modern"
            }
        },
        content_pieces={"title": "AI-Powered Content Creation"},
        image_modifications={"aspect_ratio": "16:9"},
        modified_content=None,
        modified_image=None,
        final_template="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
        user_satisfied=False,
        custom_instructions="Make the title more bold and change the background color to blue",
        needs_restart=False,
        current_node="custom_edit_node",
        error_message=None
    )
    
    # Process custom edit
    result = await template_editor_agent.custom_edit_node(state)
    print(f"Custom edit result: {result}")

def example_api_usage():
    """Example of API usage"""
    
    import requests
    import json
    
    # Example API calls
    base_url = "http://localhost:8000/api/template-editor"
    headers = {"Authorization": "Bearer your_token_here"}
    
    # Get premade templates
    response = requests.get(f"{base_url}/premade-templates", headers=headers)
    templates = response.json()
    print("Available templates:", templates)
    
    # Start template editing
    data = {
        "content_id": "content_123",
        "template_id": "template_456"
    }
    
    response = requests.post(f"{base_url}/start-editing", data=data, headers=headers)
    result = response.json()
    print("Template editing started:", result)
    
    # Continue workflow
    workflow_data = {
        "workflow_id": result["workflow_id"],
        "user_satisfied": True,
        "custom_instructions": "",
        "needs_restart": False
    }
    
    response = requests.post(f"{base_url}/continue-workflow", data=workflow_data, headers=headers)
    workflow_result = response.json()
    print("Workflow continued:", workflow_result)

if __name__ == "__main__":
    # Run examples
    print("🚀 Template Editor Agent Examples")
    print("=" * 50)
    
    # Run async examples
    asyncio.run(example_template_editing())
    asyncio.run(example_workflow_continuation())
    
    # Run API example
    print("\n🌐 API Usage Example")
    print("=" * 50)
    example_api_usage()
    
    print("\n✅ Examples completed!")
