"""
Template Editor Designer Agent using LangGraph
This agent transforms content and images into beautiful graphic templates.
"""

import os
import base64
import json
from typing import Dict, List, Any, Optional, TypedDict
from datetime import datetime
import asyncio
from io import BytesIO

import openai
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from PIL import Image, ImageDraw, ImageFont
import requests
from supabase import create_client, Client

# Import template manager
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from utils.template_manager import template_manager
except ImportError:
    # Fallback for when running from different directory
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from utils.template_manager import template_manager

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Supabase client (optional for static templates)
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase: Optional[Client] = None

if supabase_url and supabase_key:
    try:
        supabase = create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"Warning: Could not initialize Supabase client: {e}")
        supabase = None

class TemplateEditorState(TypedDict):
    """State for the template editor workflow"""
    # Input data
    current_content: str
    current_image_url: str
    user_id: str
    content_id: str
    
    # Template data
    template_image: Optional[str]  # Base64 encoded template image
    template_type: str  # 'user_upload' or 'premade'
    template_id: Optional[str]  # For premade templates
    
    # Analysis results
    template_analysis: Optional[Dict[str, Any]]
    content_pieces: Optional[Dict[str, str]]
    image_modifications: Optional[Dict[str, Any]]
    
    # Generated content
    modified_content: Optional[str]
    modified_image: Optional[str]  # Base64 encoded
    final_template: Optional[str]  # Base64 encoded final image
    
    # User interaction
    user_satisfied: bool
    custom_instructions: Optional[str]
    needs_restart: bool
    
    # Workflow control
    current_node: str
    error_message: Optional[str]

class TemplateEditorAgent:
    """Template Editor Designer Agent using LangGraph"""
    
    def __init__(self):
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        workflow = StateGraph(TemplateEditorState)
        
        # Add nodes
        workflow.add_node("template_uploader", self.template_uploader)
        workflow.add_node("template_analyzer", self.template_analyzer)
        workflow.add_node("content_modifier", self.content_modifier)
        workflow.add_node("image_modifier", self.image_modifier)
        workflow.add_node("content_output_generator", self.content_output_generator)
        workflow.add_node("flow_router", self.flow_router)
        workflow.add_node("custom_edit_node", self.custom_edit_node)
        workflow.add_node("save_image", self.save_image)
        
        # Set entry point
        workflow.set_entry_point("template_uploader")
        
        # Add edges
        workflow.add_edge("template_uploader", "template_analyzer")
        workflow.add_edge("template_analyzer", "content_modifier")
        workflow.add_edge("content_modifier", "image_modifier")
        workflow.add_edge("image_modifier", "content_output_generator")
        workflow.add_edge("content_output_generator", "flow_router")
        
        # Conditional edges from flow_router
        workflow.add_conditional_edges(
            "flow_router",
            self._route_decision,
            {
                "custom_edit": "custom_edit_node",
                "save": "save_image",
                "restart": "template_uploader",
                "error": END
            }
        )
        
        # Edges from custom_edit_node
        workflow.add_conditional_edges(
            "custom_edit_node",
            self._custom_edit_decision,
            {
                "continue_edit": "custom_edit_node",
                "save": "save_image",
                "restart": "template_uploader",
                "error": END
            }
        )
        
        # End after save_image
        workflow.add_edge("save_image", END)
        
        return workflow.compile()
    
    async def template_uploader(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 1: Template uploader - handles template selection/upload"""
        print("🚀 TEMPLATE UPLOADER NODE CALLED!")
        try:
            print("🎨 Template Uploader: Processing template selection...")
            print(f"🔍 Template Uploader - State keys: {list(state.keys())}")
            print(f"🔍 Template Uploader - Template ID: {state.get('template_id')}")
            print(f"🔍 Template Uploader - Template image present: {bool(state.get('template_image'))}")
            
            # If template_id is provided, load static template
            if state.get("template_id"):
                # Template image is already loaded in the router
                # Just set the template type and create basic analysis
                state["template_type"] = "premade"
                
                # Create enhanced template analysis for static templates based on template_id
                template_id = state['template_id']
                
                # Analyze template based on its ID and category
                if 'social-media' in template_id:
                    if 'Did_you_know' in template_id:
                        state["template_analysis"] = {
                            "content_areas": [
                                {
                                    "type": "text",
                                    "label": "title",
                                    "purpose": "main headline",
                                    "position": {"x": 50, "y": 50, "width": 400, "height": 80},
                                    "style": {
                                        "font_size": 28,
                                        "color": "#FFFFFF",
                                        "font_family": "Arial",
                                        "font_weight": "bold",
                                        "text_align": "center"
                                    },
                                    "content_guidelines": "Should be an attention-grabbing question or statement",
                                    "max_length": 60,
                                    "required": True
                                },
                                {
                                    "type": "text",
                                    "label": "subtitle",
                                    "purpose": "supporting information",
                                    "position": {"x": 50, "y": 150, "width": 400, "height": 60},
                                    "style": {
                                        "font_size": 18,
                                        "color": "#FFFFFF",
                                        "font_family": "Arial",
                                        "font_weight": "normal",
                                        "text_align": "center"
                                    },
                                    "content_guidelines": "Provide additional context or explanation",
                                    "max_length": 100,
                                    "required": False
                                },
                                {
                                    "type": "text",
                                    "label": "hashtags",
                                    "purpose": "social media tags",
                                    "position": {"x": 50, "y": 400, "width": 400, "height": 30},
                                    "style": {
                                        "font_size": 14,
                                        "color": "#CCCCCC",
                                        "font_family": "Arial",
                                        "font_weight": "normal",
                                        "text_align": "center"
                                    },
                                    "content_guidelines": "Relevant hashtags for social media engagement",
                                    "max_length": 50,
                                    "required": False
                                }
                            ],
                            "image_areas": [
                                {
                                    "label": "background_image",
                                    "purpose": "visual backdrop",
                                    "position": {"x": 0, "y": 0, "width": 500, "height": 500},
                                    "aspect_ratio": "1:1",
                                    "content_guidelines": "Should complement the educational/informational content"
                                }
                            ],
                            "design_info": {
                                "primary_colors": ["#4A90E2", "#FFFFFF"],
                                "secondary_colors": ["#CCCCCC", "#333333"],
                                "font_families": ["Arial", "Helvetica"],
                                "overall_style": "modern",
                                "layout_type": "centered",
                                "visual_hierarchy": ["title", "subtitle", "hashtags"],
                                "template_purpose": "educational social media post",
                                "target_audience": "general",
                                "tone": "informative"
                            },
                            "content_strategy": {
                                "main_goal": "educate and inform",
                                "key_message": "share interesting facts or knowledge",
                                "call_to_action": "encourage learning and sharing",
                                "content_flow": "title -> subtitle -> hashtags"
                            }
                        }
                    else:
                        # Generic social media template
                        state["template_analysis"] = {
                            "content_areas": [
                                {
                                    "type": "text",
                                    "label": "title",
                                    "purpose": "main headline",
                                    "position": {"x": 50, "y": 50, "width": 400, "height": 80},
                                    "style": {
                                        "font_size": 24,
                                        "color": "#000000",
                                        "font_family": "Arial",
                                        "font_weight": "bold",
                                        "text_align": "center"
                                    },
                                    "content_guidelines": "Should be engaging and relevant to the content",
                                    "max_length": 80,
                                    "required": True
                                },
                                {
                                    "type": "text",
                                    "label": "body",
                                    "purpose": "main content",
                                    "position": {"x": 50, "y": 150, "width": 400, "height": 120},
                                    "style": {
                                        "font_size": 16,
                                        "color": "#333333",
                                        "font_family": "Arial",
                                        "font_weight": "normal",
                                        "text_align": "center"
                                    },
                                    "content_guidelines": "Expand on the main message with relevant details",
                                    "max_length": 200,
                                    "required": True
                                }
                            ],
                            "image_areas": [
                                {
                                    "label": "main_image",
                                    "purpose": "primary visual content",
                                    "position": {"x": 50, "y": 300, "width": 400, "height": 200},
                                    "aspect_ratio": "2:1",
                                    "content_guidelines": "Should be high-quality and relevant to the main message"
                                }
                            ],
                            "design_info": {
                                "primary_colors": ["#000000", "#FFFFFF"],
                                "secondary_colors": ["#333333", "#CCCCCC"],
                                "font_families": ["Arial", "Helvetica"],
                                "overall_style": "modern",
                                "layout_type": "centered",
                                "visual_hierarchy": ["title", "body"],
                                "template_purpose": "social media post",
                                "target_audience": "general",
                                "tone": "professional"
                            },
                            "content_strategy": {
                                "main_goal": "inform and engage",
                                "key_message": "highlight important information",
                                "call_to_action": "encourage engagement",
                                "content_flow": "title -> body"
                            }
                        }
                else:
                    # Default template analysis for other categories
                    state["template_analysis"] = {
                        "content_areas": [
                            {
                                "type": "text",
                                "label": "title",
                                "purpose": "main headline",
                                "position": {"x": 100, "y": 50, "width": 300, "height": 60},
                                "style": {
                                    "font_size": 24,
                                    "color": "#000000",
                                    "font_family": "Arial",
                                    "font_weight": "bold",
                                    "text_align": "center"
                                },
                                "content_guidelines": "Should be attention-grabbing and concise",
                                "max_length": 50,
                                "required": True
                            }
                        ],
                        "image_areas": [],
                        "design_info": {
                            "primary_colors": ["#000000"],
                            "secondary_colors": ["#FFFFFF"],
                            "font_families": ["Arial"],
                            "overall_style": "modern",
                            "layout_type": "centered",
                            "visual_hierarchy": ["title"],
                            "template_purpose": "general content",
                            "target_audience": "general",
                            "tone": "professional"
                        },
                        "content_strategy": {
                            "main_goal": "inform and engage",
                            "key_message": "highlight important information",
                            "call_to_action": "encourage engagement",
                            "content_flow": "title"
                        }
                    }
                
                print(f"✅ Loaded static template: {state['template_id']}")
            else:
                # Handle user uploaded template
                # This would typically come from a file upload
                # For now, we'll assume it's already base64 encoded
                state["template_type"] = "user_upload"
                print("✅ Using user uploaded template")
            
            state["current_node"] = "template_uploader"
            print("✅ Template uploaded successfully")
            print(f"🔍 Template Uploader - Setting current_node to: {state.get('current_node')}")
            
        except Exception as e:
            state["error_message"] = f"Template upload failed: {str(e)}"
            print(f"❌ Template upload error: {e}")
        
        return state
    
    async def template_analyzer(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 2: Template analyzer - uses OpenAI vision to analyze template"""
        print("🚀 TEMPLATE ANALYZER NODE CALLED!")
        try:
            print("🔍 Template Analyzer: Analyzing template structure...")
            print(f"🔍 Template Analyzer - State keys: {list(state.keys())}")
            print(f"🔍 Template Analyzer - Template image present: {bool(state.get('template_image'))}")
            
            # If we already have template analysis from static template, use it
            if state.get("template_analysis"):
                print("✅ Using pre-loaded template analysis")
                state["current_node"] = "template_analyzer"
                return state
            
            # For static templates without pre-loaded analysis, generate it
            print("🔍 Generating analysis for static template...")
            
            if not state.get("template_image"):
                raise ValueError("No template image provided")
            
            # For user-uploaded templates, use OpenAI vision analysis
            print("🔍 Analyzing user-uploaded template with OpenAI vision...")
            
            # Prepare the image for OpenAI vision
            image_data = state["template_image"]
            if image_data.startswith('data:image'):
                # Remove data URL prefix
                image_data = image_data.split(',')[1]
            
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            
            # Analyze template using OpenAI vision with enhanced prompting
            analysis_prompt = """
            Analyze this template image comprehensively to understand its structure and content requirements.
            
            DETAILED ANALYSIS REQUIRED:
            
            1. CONTENT AREAS - Identify ALL text areas that need content:
               - Primary headline/title (usually largest text)
               - Subtitle or tagline (secondary text)
               - Body text or description
               - Call-to-action (CTA) text
               - Date/time information
               - Location/venue details
               - Author/creator attribution
               - Hashtags or social media tags
               - Any other text elements
            
            2. VISUAL ELEMENTS - Identify image areas and design elements:
               - Main image placeholder
               - Background images
               - Logo placement areas
               - Decorative elements
               - Icons or graphics
            
            3. DESIGN ANALYSIS - Analyze the visual design:
               - Primary color scheme (hex codes)
               - Secondary/accent colors
               - Typography styles and font families
               - Overall design aesthetic (modern, vintage, minimalist, etc.)
               - Layout style (centered, left-aligned, grid-based, etc.)
               - Visual hierarchy and emphasis areas
            
            4. CONTENT STRATEGY - Understand the template's purpose:
               - What type of content is this designed for? (social media post, announcement, event, product, etc.)
               - What's the intended tone? (professional, casual, playful, serious, etc.)
               - What's the target audience?
               - What's the main message or goal?
            
            Return a comprehensive JSON structure:
            {
                "content_areas": [
                    {
                        "type": "text",
                        "label": "title",
                        "purpose": "main headline",
                        "position": {"x": 100, "y": 50, "width": 300, "height": 60},
                        "style": {
                            "font_size": 24,
                            "color": "#000000",
                            "font_family": "Arial",
                            "font_weight": "bold",
                            "text_align": "center"
                        },
                        "content_guidelines": "Should be attention-grabbing and concise",
                        "max_length": 50,
                        "required": true
                    }
                ],
                "image_areas": [
                    {
                        "label": "main_image",
                        "purpose": "primary visual content",
                        "position": {"x": 50, "y": 100, "width": 400, "height": 300},
                        "aspect_ratio": "4:3",
                        "content_guidelines": "Should be high-quality and relevant to the main message"
                    }
                ],
                "design_info": {
                    "primary_colors": ["#FF0000", "#00FF00"],
                    "secondary_colors": ["#FFFFFF", "#CCCCCC"],
                    "font_families": ["Arial", "Helvetica"],
                    "overall_style": "modern",
                    "layout_type": "centered",
                    "visual_hierarchy": ["title", "subtitle", "body", "cta"],
                    "template_purpose": "social media post",
                    "target_audience": "general",
                    "tone": "professional"
                },
                "content_strategy": {
                    "main_goal": "inform and engage",
                    "key_message": "highlight important information",
                    "call_to_action": "encourage engagement",
                    "content_flow": "title -> subtitle -> body -> cta"
                }
            }
            """
            
            client = openai.OpenAI()
            response = client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": analysis_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000
            )
            
            # Parse the analysis result
            analysis_text = response.choices[0].message.content
            try:
                analysis_data = json.loads(analysis_text)
            except json.JSONDecodeError:
                # If JSON parsing fails, create a basic structure
                analysis_data = {
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
                        "primary_colors": ["#000000"],
                        "font_families": ["Arial"],
                        "overall_style": "modern"
                    }
                }
            
            state["template_analysis"] = analysis_data
            state["current_node"] = "template_analyzer"
            print("✅ Template analysis completed")
            print(f"🔍 Template Analyzer - Analysis set: {bool(state.get('template_analysis'))}")
            print(f"🔍 Template Analyzer - Analysis data: {state.get('template_analysis')}")
            
        except Exception as e:
            state["error_message"] = f"Template analysis failed: {str(e)}"
            print(f"❌ Template analysis error: {e}")
        
        return state
    
    async def content_modifier(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 3: Content modifier - adapts content for template structure"""
        print("🚀 CONTENT MODIFIER NODE CALLED!")
        try:
            print("✏️ Content Modifier: Adapting content for template...")
            print(f"🔍 Content Modifier - State keys: {list(state.keys())}")
            print(f"🔍 Content Modifier - Template analysis present: {bool(state.get('template_analysis'))}")
            
            if not state.get("template_analysis"):
                raise ValueError("No template analysis available")
            
            current_content = state["current_content"]
            template_analysis = state["template_analysis"]
            
            # Create content pieces based on enhanced template analysis
            content_pieces = {}
            design_info = template_analysis.get("design_info", {})
            content_strategy = template_analysis.get("content_strategy", {})
            
            # Get template context for better content generation
            template_purpose = design_info.get("template_purpose", "social media post")
            target_audience = design_info.get("target_audience", "general")
            tone = design_info.get("tone", "professional")
            overall_style = design_info.get("overall_style", "modern")
            
            for area in template_analysis.get("content_areas", []):
                area_label = area["label"]
                area_type = area["type"]
                area_purpose = area.get("purpose", area_label)
                content_guidelines = area.get("content_guidelines", "")
                max_length = area.get("max_length", 100)
                
                if area_type == "text":
                    # Generate context-aware content for this specific text area
                    content_prompt = f"""
                    You are a professional content creator specializing in {template_purpose} content.
                    
                    TEMPLATE CONTEXT:
                    - Template Purpose: {template_purpose}
                    - Target Audience: {target_audience}
                    - Tone: {tone}
                    - Design Style: {overall_style}
                    - Content Area: {area_label} ({area_purpose})
                    - Content Guidelines: {content_guidelines}
                    - Maximum Length: {max_length} characters
                    
                    ORIGINAL CONTENT TO ADAPT:
                    "{current_content}"
                    
                    CONTENT STRATEGY:
                    - Main Goal: {content_strategy.get('main_goal', 'inform and engage')}
                    - Key Message: {content_strategy.get('key_message', 'highlight important information')}
                    - Call to Action: {content_strategy.get('call_to_action', 'encourage engagement')}
                    
                    TASK:
                    Create compelling {area_label} text that:
                    1. Perfectly fits the {area_purpose} role in this template
                    2. Adapts the original content to match the {tone} tone
                    3. Appeals to the {target_audience} audience
                    4. Follows the {overall_style} design aesthetic
                    5. Stays within {max_length} characters
                    6. Follows the content guidelines: {content_guidelines}
                    7. Supports the main goal: {content_strategy.get('main_goal', 'inform and engage')}
                    
                    CRITICAL QUALITY REQUIREMENTS:
                    - ZERO spelling mistakes or typos
                    - Perfect grammar and punctuation
                    - Professional language appropriate for {tone} tone
                    - Clear, concise, and impactful messaging
                    - Proper capitalization and formatting
                    - Double-check all words for accuracy
                    
                    SPECIAL CONSIDERATIONS:
                    - If this is a title/headline: Make it attention-grabbing and concise
                    - If this is a subtitle: Provide supporting details that complement the title
                    - If this is body text: Expand on the main message with relevant details
                    - If this is a CTA: Create a clear, actionable instruction
                    - If this is a date/time: Format appropriately for the context
                    - If this is a location: Make it specific and relevant
                    - If this is a hashtag: Use relevant, trending tags
                    
                    QUALITY CONTROL:
                    Before finalizing, verify:
                    ✓ All words are spelled correctly
                    ✓ Grammar and punctuation are perfect
                    ✓ Text is appropriate for the {tone} tone
                    ✓ Message is clear and impactful
                    ✓ Length is within {max_length} characters
                    
                    Return only the optimized, perfectly spelled text content, no additional formatting or explanations.
                    """
                    
                    client = openai.OpenAI()
                    response = client.chat.completions.create(
                        model="gpt-4",
                        messages=[
                            {"role": "user", "content": content_prompt}
                        ],
                        max_tokens=300
                    )
                    
                    generated_content = response.choices[0].message.content.strip()
                    
                    # Post-process content for quality assurance
                    # Validate spelling and grammar with a follow-up check
                    validation_prompt = f"""
                    Review this text for spelling and grammar errors:
                    "{generated_content}"
                    
                    Requirements:
                    - Check for spelling mistakes
                    - Verify grammar and punctuation
                    - Ensure professional tone
                    - Maintain clarity and impact
                    
                    If there are any errors, provide the corrected version.
                    If the text is perfect, return it exactly as is.
                    
                    Return only the corrected text, no explanations.
                    """
                    
                    validation_response = client.chat.completions.create(
                        model="gpt-4",
                        messages=[
                            {"role": "user", "content": validation_prompt}
                        ],
                        max_tokens=200
                    )
                    
                    validated_content = validation_response.choices[0].message.content.strip()
                    
                    # Ensure content fits within max_length
                    if len(validated_content) > max_length:
                        # Truncate intelligently (at word boundary)
                        truncated = validated_content[:max_length]
                        last_space = truncated.rfind(' ')
                        if last_space > max_length * 0.8:  # Only truncate at word if it's not too short
                            validated_content = truncated[:last_space] + "..."
                        else:
                            validated_content = truncated + "..."
                    
                    content_pieces[area_label] = validated_content
            
            state["content_pieces"] = content_pieces
            state["current_node"] = "content_modifier"
            print("✅ Content modification completed")
            print(f"🔍 Content Modifier - Content pieces set: {bool(state.get('content_pieces'))}")
            print(f"🔍 Content Modifier - Content pieces data: {state.get('content_pieces')}")
            
        except Exception as e:
            state["error_message"] = f"Content modification failed: {str(e)}"
            print(f"❌ Content modification error: {e}")
        
        return state
    
    async def image_modifier(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 4: Image modifier - adapts current image for template"""
        try:
            print("🖼️ Image Modifier: Adapting image for template...")
            
            if not state.get("current_image_url"):
                print("⚠️ No current image provided, skipping image modification")
                state["image_modifications"] = {"skip": True}
                return state
            
            # Download current image
            response = requests.get(state["current_image_url"])
            current_image = Image.open(BytesIO(response.content))
            
            # Analyze current image using OpenAI vision
            image_analysis_prompt = """
            Analyze this image and suggest modifications needed to fit into a social media template.
            Consider:
            - Aspect ratio adjustments
            - Color scheme modifications
            - Cropping suggestions
            - Filter or style adjustments
            - Text overlay areas to avoid
            
            Return a JSON structure with modification suggestions.
            """
            
            # Convert image to base64 for analysis
            buffered = BytesIO()
            current_image.save(buffered, format="JPEG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            client = openai.OpenAI()
            analysis_response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": image_analysis_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{img_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            try:
                modifications = json.loads(analysis_response.choices[0].message.content)
            except json.JSONDecodeError:
                modifications = {
                    "aspect_ratio": "16:9",
                    "crop_suggestion": "center",
                    "color_adjustments": "enhance_contrast",
                    "text_avoid_areas": []
                }
            
            state["image_modifications"] = modifications
            state["current_node"] = "image_modifier"
            print("✅ Image modification analysis completed")
            
        except Exception as e:
            state["error_message"] = f"Image modification failed: {str(e)}"
            print(f"❌ Image modification error: {e}")
        
        return state
    
    async def content_output_generator(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 5: Content output image generator - creates final template using Gemini API"""
        try:
            print("🎨 Content Output Generator: Creating final template with Gemini...")
            
            # Debug: Check what data we have
            print(f"🔍 Debug - template_image: {bool(state.get('template_image'))}")
            print(f"🔍 Debug - content_pieces: {bool(state.get('content_pieces'))}")
            print(f"🔍 Debug - template_analysis: {bool(state.get('template_analysis'))}")
            print(f"🔍 Debug - content_pieces data: {state.get('content_pieces')}")
            print(f"🔍 Debug - template_analysis data: {state.get('template_analysis')}")
            
            if not all([state.get("template_image"), state.get("content_pieces"), state.get("template_analysis")]):
                missing = []
                if not state.get("template_image"):
                    missing.append("template_image")
                if not state.get("content_pieces"):
                    missing.append("content_pieces")
                if not state.get("template_analysis"):
                    missing.append("template_analysis")
                raise ValueError(f"Missing required data for template generation: {missing}")
            
            # Import Gemini
            import google.generativeai as genai
            
            # Configure Gemini API
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if not gemini_api_key:
                raise ValueError("GEMINI_API_KEY not found in environment variables")
            
            genai.configure(api_key=gemini_api_key)
            gemini_model = 'gemini-2.5-flash-image-preview'
            
            # Prepare the prompt for Gemini
            content_pieces = state["content_pieces"]
            template_analysis = state["template_analysis"]
            current_content = state["current_content"]
            
            # Create a comprehensive prompt for Gemini with template context
            design_info = template_analysis.get("design_info", {})
            content_strategy = template_analysis.get("content_strategy", {})
            
            # Build content text for overlay
            content_text = ""
            for label, text in content_pieces.items():
                content_text += f"{label.upper()}: {text}\n"
            
            gemini_prompt = f"""
You are a professional graphic designer creating a customized social media post.

TEMPLATE DESIGN ANALYSIS:
- Template Purpose: {design_info.get('template_purpose', 'social media post')}
- Design Style: {design_info.get('overall_style', 'modern')}
- Layout Type: {design_info.get('layout_type', 'centered')}
- Primary Colors: {design_info.get('primary_colors', ['#000000'])}
- Secondary Colors: {design_info.get('secondary_colors', ['#FFFFFF'])}
- Typography: {design_info.get('font_families', ['Arial'])}
- Target Audience: {design_info.get('target_audience', 'general')}
- Tone: {design_info.get('tone', 'professional')}

CONTENT STRATEGY:
- Main Goal: {content_strategy.get('main_goal', 'inform and engage')}
- Key Message: {content_strategy.get('key_message', 'highlight important information')}
- Call to Action: {content_strategy.get('call_to_action', 'encourage engagement')}

CUSTOMIZED CONTENT TO INTEGRATE:
{content_text}

DESIGN REQUIREMENTS:
1. Use the original image (first image) as your foundation
2. Apply the template's design aesthetic (second image) as your style guide
3. Integrate the customized content text in appropriate locations based on the template layout
4. Maintain visual hierarchy: {design_info.get('visual_hierarchy', ['title', 'subtitle', 'body', 'cta'])}
5. Use the template's color scheme and typography
6. Ensure all text is readable and properly positioned
7. Match the {design_info.get('tone', 'professional')} tone
8. Create a cohesive design that serves the {content_strategy.get('main_goal', 'inform and engage')} goal

TEXT QUALITY REQUIREMENTS (CRITICAL):
- ZERO spelling mistakes or typos in any text
- Perfect grammar and punctuation
- Professional language appropriate for the {design_info.get('tone', 'professional')} tone
- Clear, concise, and impactful messaging
- Proper capitalization and formatting
- All text must be legible and well-positioned
- Double-check all words for accuracy before finalizing

TECHNICAL SPECIFICATIONS:
- Maintain high resolution and professional quality
- Ensure text contrast is sufficient for readability
- Preserve the original image's key visual elements
- Apply the template's layout structure
- Use appropriate font sizes and weights for each content area
- Verify all text is properly spelled and grammatically correct

QUALITY CONTROL CHECKLIST:
✓ All text is spelled correctly
✓ Grammar and punctuation are perfect
✓ Text is properly positioned and readable
✓ Font sizes are appropriate for each content area
✓ Color contrast ensures readability
✓ Overall design is professional and cohesive

OUTPUT: A single, professionally designed image that seamlessly combines the original image with the template's design aesthetic and the customized content, with perfect spelling and grammar throughout.
"""
            
            # Prepare contents for Gemini API call
            contents = []
            
            # Add the prompt
            contents.append(gemini_prompt)
            
            # Add the original image as the primary image to modify
            if state.get("current_image_url"):
                try:
                    # Download the original image
                    import httpx
                    async with httpx.AsyncClient() as client:
                        response = await client.get(state["current_image_url"])
                        if response.status_code == 200:
                            original_image_data = base64.b64encode(response.content).decode()
                            contents.append({
                                "text": "BASE IMAGE: Transform this image to match the template style."
                            })
                            contents.append({
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": original_image_data
                                }
                            })
                except Exception as e:
                    print(f"⚠️ Could not include original image: {e}")
                    raise Exception("Original image is required for template modification")
            else:
                raise Exception("No original image provided for modification")
            
            # Add the template image as reference
            template_data = state["template_image"]
            if template_data.startswith('data:image'):
                template_data = template_data.split(',')[1]
            
            contents.append({
                "text": "STYLE REFERENCE: Apply this template's design aesthetic to the base image."
            })
            contents.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": template_data
                }
            })
            
            # Call Gemini API
            print("🤖 Calling Gemini API for image generation...")
            response = genai.GenerativeModel(gemini_model).generate_content(
                contents=contents,
            )
            
            # Extract the generated image from the response
            image_data = None
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                
                for part in candidate.content.parts:
                    if part.inline_data is not None:
                        image_data = part.inline_data.data
                        break
            
            if not image_data:
                raise Exception("No image data returned from Gemini")
            
            # Convert to base64
            if isinstance(image_data, bytes):
                image_bytes = image_data
            else:
                image_bytes = base64.b64decode(image_data)
            
            final_template_b64 = base64.b64encode(image_bytes).decode()
            final_template_url = f"data:image/png;base64,{final_template_b64}"
            
            # Update state
            state["final_template"] = final_template_url
            state["current_node"] = "content_output_generator"
            
            print("✅ Final template generated successfully with Gemini")
            
        except Exception as e:
            state["error_message"] = f"Content output generation failed: {str(e)}"
            print(f"❌ Content output generation error: {e}")
        
        return state
    
    async def flow_router(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 6: Flow router - determines next step based on user input"""
        try:
            print("🔄 Flow Router: Determining next step...")
            
            # This would typically get user input from the frontend
            # For now, we'll simulate the decision
            user_decision = state.get("user_satisfied", False)
            custom_instructions = state.get("custom_instructions")
            needs_restart = state.get("needs_restart", False)
            
            if needs_restart:
                state["current_node"] = "restart"
            elif user_decision and not custom_instructions:
                state["current_node"] = "save"
            elif custom_instructions:
                state["current_node"] = "custom_edit"
            else:
                # Default to waiting for user input
                state["current_node"] = "waiting"
            
            print(f"✅ Flow routed to: {state['current_node']}")
            
        except Exception as e:
            state["error_message"] = f"Flow routing failed: {str(e)}"
            print(f"❌ Flow routing error: {e}")
        
        return state
    
    async def custom_edit_node(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 7: Custom edit node - handles user custom instructions"""
        try:
            print("✏️ Custom Edit Node: Processing custom instructions...")
            
            custom_instructions = state.get("custom_instructions", "")
            if not custom_instructions:
                state["error_message"] = "No custom instructions provided"
                return state
            
            # Process custom instructions using OpenAI
            edit_prompt = f"""
            Based on the current template and these custom instructions: "{custom_instructions}"
            
            Suggest specific modifications to the template. Consider:
            - Text changes
            - Color adjustments
            - Layout modifications
            - Image positioning
            - Style changes
            
            Return a JSON structure with specific edit instructions.
            """
            
            client = openai.OpenAI()
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "user", "content": edit_prompt}
                ],
                max_tokens=1000
            )
            
            try:
                edit_instructions = json.loads(response.choices[0].message.content)
            except json.JSONDecodeError:
                edit_instructions = {"text_changes": [], "style_changes": []}
            
            # Apply the custom edits to the template
            # This would involve modifying the final_template based on edit_instructions
            # For now, we'll mark it as processed
            state["custom_instructions"] = None  # Clear after processing
            state["current_node"] = "custom_edit"
            print("✅ Custom edits processed")
            
        except Exception as e:
            state["error_message"] = f"Custom edit failed: {str(e)}"
            print(f"❌ Custom edit error: {e}")
        
        return state
    
    async def save_image(self, state: TemplateEditorState) -> TemplateEditorState:
        """Node 8: Save image - saves final template to Supabase"""
        try:
            print("💾 Save Image: Saving final template...")
            
            if not state.get("final_template"):
                raise ValueError("No final template to save")
            
            # Upload image to Supabase storage
            image_data = state["final_template"]
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"template_editor_{state['user_id']}_{timestamp}.jpg"
            
            if supabase:
                # Upload to Supabase storage in ai-generated-images bucket
                file_path = f"template-edits/{filename}"
                upload_response = supabase.storage.from_("ai-generated-images").upload(
                    file_path,
                    base64.b64decode(image_data),
                    file_options={"content-type": "image/jpeg"}
                )
                
                if hasattr(upload_response, 'error') and upload_response.error:
                    raise Exception(f"Upload failed: {upload_response.error}")
                
                # Get public URL
                public_url = supabase.storage.from_("ai-generated-images").get_public_url(file_path)
                
                # Update content in database with new image URL
                if state.get("content_id"):
                    update_response = supabase.table("content").update({
                        "image_url": public_url,
                        "updated_at": datetime.now().isoformat()
                    }).eq("id", state["content_id"]).execute()
                    
                    if update_response.data:
                        print("✅ Content updated with new image URL")
            else:
                # Fallback: return the base64 data directly
                public_url = f"data:image/jpeg;base64,{image_data}"
                print("⚠️ Supabase not available, returning base64 data")
            
            state["current_node"] = "save"
            print("✅ Final template saved successfully")
            
        except Exception as e:
            state["error_message"] = f"Save failed: {str(e)}"
            print(f"❌ Save error: {e}")
        
        return state
    
    def _route_decision(self, state: TemplateEditorState) -> str:
        """Determine routing from flow_router"""
        if state.get("error_message"):
            return "error"
        elif state.get("needs_restart"):
            return "restart"
        elif state.get("user_satisfied") and not state.get("custom_instructions"):
            return "save"
        elif state.get("custom_instructions"):
            return "custom_edit"
        else:
            return "error"  # Default to error if unclear
    
    def _custom_edit_decision(self, state: TemplateEditorState) -> str:
        """Determine routing from custom_edit_node"""
        if state.get("error_message"):
            return "error"
        elif state.get("needs_restart"):
            return "restart"
        elif state.get("user_satisfied"):
            return "save"
        elif state.get("custom_instructions"):
            return "continue_edit"
        else:
            return "save"  # Default to save if no more instructions
    
    
    async def process_template_edit(self, 
                                  current_content: str,
                                  current_image_url: str,
                                  user_id: str,
                                  content_id: str,
                                  template_id: Optional[str] = None,
                                  template_image: Optional[str] = None) -> Dict[str, Any]:
        """Main entry point for template editing process"""
        try:
            # Initialize state
            initial_state = TemplateEditorState(
                current_content=current_content,
                current_image_url=current_image_url,
                user_id=user_id,
                content_id=content_id,
                template_id=template_id,
                template_image=template_image,
                template_type="premade" if template_id else "user_upload",
                template_analysis=None,
                content_pieces=None,
                image_modifications=None,
                modified_content=None,
                modified_image=None,
                final_template=None,
                user_satisfied=False,
                custom_instructions=None,
                needs_restart=False,
                current_node="template_uploader",
                error_message=None
            )
            
            # Run the workflow
            print("🚀 Starting LangGraph workflow...")
            print(f"🔍 Initial state keys: {list(initial_state.keys())}")
            print(f"🔍 Template image present: {bool(initial_state.get('template_image'))}")
            
            # Debug: Check if the graph is properly compiled
            print(f"🔍 Graph nodes: {list(self.graph.nodes.keys())}")
            
            print("🔍 About to invoke workflow...")
            result = await self.graph.ainvoke(initial_state)
            print("🔍 Workflow invocation completed")
            
            print(f"🔍 Final result keys: {list(result.keys())}")
            print(f"🔍 Final template present: {bool(result.get('final_template'))}")
            print(f"🔍 Error message: {result.get('error_message')}")
            print(f"🔍 Current node: {result.get('current_node')}")
            
            return {
                "success": not bool(result.get("error_message")),
                "final_template": result.get("final_template"),
                "error_message": result.get("error_message"),
                "current_node": result.get("current_node")
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_message": f"Template editing process failed: {str(e)}",
                "final_template": None,
                "current_node": "error"
            }

# Create global instance
template_editor_agent = TemplateEditorAgent()
