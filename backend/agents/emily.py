"""
Intent-Based Chatbot Agent using LangGraph and Pydantic
Handles user queries by classifying intent and routing to appropriate tools
"""

import os
import json
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Literal, TypedDict
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv
from services.token_usage_service import TokenUsageService
from utils.profile_embedding_helper import get_embedding_service
from utils.embedding_context import get_profile_context_with_embedding

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.3,
    openai_api_key=openai_api_key
)

# Embedding service will be loaded via get_embedding_service() when needed
# This matches the pattern used in profile_embedding_helper.py

logger = logging.getLogger(__name__)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

# -----------------------------------------------------------------------------
# SOCIAL MEDIA
# -----------------------------------------------------------------------------

class SocialMediaPayload(BaseModel):
    platform: Optional[List[Literal[
        "facebook",
        "instagram",
        "youtube",
        "linkedin",
        "twitter",
        "pinterest"
    ]]] = None

    content_type: Optional[Literal["post", "reel", "video", "story", "carousel"]] = None
    idea: Optional[str] = None

    media: Optional[Literal["upload", "generate"]] = None
    media_file: Optional[str] = None

    date: Optional[datetime] = None
    task: Optional[Literal["draft", "schedule", "edit", "delete"]] = None
    content: Optional[str] = None  # Content ID from created_content table after generation

# -----------------------------------------------------------------------------
# BLOG
# -----------------------------------------------------------------------------

class BlogPayload(BaseModel):
    platform: Optional[Literal["wordpress", "shopify", "wix", "html"]] = None
    topic: Optional[str] = None
    length: Optional[Literal["short", "medium", "long"]] = None

    media: Optional[Literal["generate", "upload"]] = None
    media_file: Optional[str] = None

    date: Optional[datetime] = None
    task: Optional[Literal["draft", "schedule", "save"]] = None

# -----------------------------------------------------------------------------
# EMAIL
# -----------------------------------------------------------------------------

class EmailPayload(BaseModel):
    email_address: Optional[EmailStr] = None
    content: Optional[str] = None

    attachments: Optional[List[str]] = None

    task: Optional[Literal["send", "save", "schedule"]] = None
    date: Optional[datetime] = None

# -----------------------------------------------------------------------------
# WHATSAPP MESSAGE
# -----------------------------------------------------------------------------

class WhatsAppPayload(BaseModel):
    phone_number: Optional[str] = Field(
        default=None,
        description="Phone number with country code, e.g. +919876543210"
    )

    text: Optional[str] = None
    attachment: Optional[str] = None

    task: Optional[Literal["send", "schedule", "save"]] = None
    date: Optional[datetime] = None

# -----------------------------------------------------------------------------
# ADS
# -----------------------------------------------------------------------------

class AdsPayload(BaseModel):
    platform: Optional[Literal["meta", "google", "linkedin", "youtube"]] = None
    objective: Optional[str] = None
    audience: Optional[str] = None
    budget: Optional[str] = None
    creative: Optional[str] = None

    date: Optional[datetime] = None
    task: Optional[Literal["draft", "schedule", "launch"]] = None

# -----------------------------------------------------------------------------
# CONTENT GENERATION
# -----------------------------------------------------------------------------

class ContentGenerationPayload(BaseModel):
    type: Literal["social_media", "blog", "email", "whatsapp", "ads"]

    social_media: Optional[SocialMediaPayload] = None
    blog: Optional[BlogPayload] = None
    email: Optional[EmailPayload] = None
    whatsapp: Optional[WhatsAppPayload] = None
    ads: Optional[AdsPayload] = None

# =============================================================================
# ANALYTICS
# =============================================================================

class AnalyticsPayload(BaseModel):
    query: Optional[str] = None
    platform: Optional[str] = None
    date_range: Optional[str] = None

# =============================================================================
# LEADS MANAGEMENT
# =============================================================================

class LeadsManagementPayload(BaseModel):
    action: Optional[
        Literal[
            "add_lead",
            "update_lead",
            "search_lead",
            "export_leads",
            "inquire_status",
            "inquire_status_summary"
        ]
    ] = None

    # For individual lead operations
    lead_name: Optional[str] = None
    lead_email: Optional[EmailStr] = None
    lead_phone: Optional[str] = None
    notes: Optional[str] = None
    lead_id: Optional[str] = None

    # For individual lead status questions
    status_query: Optional[str] = Field(
        default=None,
        description="User asking about a specific lead's status"
    )

    # For summary inquiries
    status_type: Optional[
        Literal[
            "new",
            "contacted",
            "responded",
            "qualified",
            "invalid",
            "lost",
            "converted",
            "followup"
        ]
    ] = Field(
        default=None,
        description="Lead pipeline stage for summary inquiry"
    )

    # Optional time filter
    date_range: Optional[str] = Field(
        default=None,
        description="Example: today, yesterday, last 7 days, this week, last month"
    )

# =============================================================================
# POSTING MANAGER
# =============================================================================

class PostingManagerPayload(BaseModel):
    platform: Optional[str] = None
    action: Optional[Literal["view_queue", "update_post", "delete_post"]] = None
    post_id: Optional[str] = None

# =============================================================================
# GENERAL TALK
# =============================================================================

class GeneralTalkPayload(BaseModel):
    message: Optional[str] = None

# =============================================================================
# FAQ
# =============================================================================

class FAQPayload(BaseModel):
    query: Optional[str] = None

# =============================================================================
# TOP-LEVEL INTENT PAYLOAD
# =============================================================================

class IntentPayload(BaseModel):
    intent: Literal[
        "content_generation",
        "analytics",
        "leads_management",
        "posting_manager",
        "general_talks",
        "faq"
    ]

    content: Optional[ContentGenerationPayload] = None
    analytics: Optional[AnalyticsPayload] = None
    leads: Optional[LeadsManagementPayload] = None
    posting: Optional[PostingManagerPayload] = None
    general: Optional[GeneralTalkPayload] = None
    faq: Optional[FAQPayload] = None

# Rebuild forward references
IntentPayload.model_rebuild()
ContentGenerationPayload.model_rebuild()
FAQPayload.model_rebuild()

# =============================================================================
# LANGGRAPH STATE
# =============================================================================

class IntentBasedChatbotState(TypedDict):
    """State for the intent-based chatbot conversation"""
    user_id: str
    current_query: str
    conversation_history: Optional[List[Dict[str, str]]]
    intent_payload: Optional[IntentPayload]  # The classified payload
    partial_payload: Optional[Dict[str, Any]]  # Accumulated partial payload data
    response: Optional[str]
    context: Dict[str, Any]
    needs_clarification: Optional[bool]  # Whether we're waiting for user input
    options: Optional[List[str]]  # Clickable options for user selection
    content_data: Optional[Dict[str, Any]]  # Structured content data (title, content, hashtags, images)

# =============================================================================
# INTENT-BASED CHATBOT CLASS
# =============================================================================

class IntentBasedChatbot:
    def __init__(self):
        self.llm = llm
        # Initialize token tracker for usage tracking
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if supabase_url and supabase_service_key:
            self.token_tracker = TokenUsageService(supabase_url, supabase_service_key)
        else:
            self.token_tracker = None
        self.setup_graph()
    
    def setup_graph(self):
        """Setup the LangGraph workflow"""
        workflow = StateGraph(IntentBasedChatbotState)
        
        # Add nodes
        workflow.add_node("classify_intent", self.classify_intent)
        workflow.add_node("handle_content_generation", self.handle_content_generation)
        workflow.add_node("handle_analytics", self.handle_analytics)
        workflow.add_node("handle_leads_management", self.handle_leads_management)
        workflow.add_node("handle_posting_manager", self.handle_posting_manager)
        workflow.add_node("handle_general_talks", self.handle_general_talks)
        workflow.add_node("handle_faq", self.handle_faq)
        workflow.add_node("generate_final_response", self.generate_final_response)
        
        # Set entry point
        workflow.set_entry_point("classify_intent")
        
        # Conditional routing based on intent
        workflow.add_conditional_edges(
            "classify_intent",
            self.route_by_intent,
            {
                "content_generation": "handle_content_generation",
                "analytics": "handle_analytics",
                "leads_management": "handle_leads_management",
                "posting_manager": "handle_posting_manager",
                "general_talks": "handle_general_talks",
                "faq": "handle_faq"
            }
        )
        
        # All handlers go to generate_final_response
        workflow.add_edge("handle_content_generation", "generate_final_response")
        workflow.add_edge("handle_analytics", "generate_final_response")
        workflow.add_edge("handle_leads_management", "generate_final_response")
        workflow.add_edge("handle_posting_manager", "generate_final_response")
        workflow.add_edge("handle_general_talks", "generate_final_response")
        workflow.add_edge("handle_faq", "generate_final_response")
        workflow.add_edge("generate_final_response", END)
        
        # Compile the graph
        self.graph = workflow.compile()
    
    def route_by_intent(self, state: IntentBasedChatbotState) -> str:
        """Route to appropriate handler based on intent"""
        if not state.get("intent_payload"):
            return "general_talks"
        return state["intent_payload"].intent
    
    def _normalize_payload(self, payload_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize and fix payload structure before validation"""
        # Fix content_generation payload if type is missing or null
        if payload_dict.get("intent") == "content_generation" and payload_dict.get("content"):
            content = payload_dict["content"]
            
            if isinstance(content, dict):
                # Check if type is missing, None, or null
                content_type = content.get("type")
                
                # Handle None/null values
                if content_type is None or content_type == "null" or content_type == "":
                    content_type = None
                
                # If type is missing or null, try to infer it
                if not content_type:
                    # Try to infer type from existing nested objects
                    if content.get("social_media"):
                        content["type"] = "social_media"
                        content_type = "social_media"
                    elif content.get("blog"):
                        content["type"] = "blog"
                        content_type = "blog"
                    elif content.get("email"):
                        content["type"] = "email"
                        content_type = "email"
                    elif content.get("whatsapp"):
                        content["type"] = "whatsapp"
                        content_type = "whatsapp"
                    elif content.get("ads"):
                        content["type"] = "ads"
                        content_type = "ads"
                    else:
                        # Check for blog-like fields (topic, length, style) - these suggest blog type
                        if any(key in content for key in ["topic", "length", "style"]):
                            # These fields suggest it might be a blog, but we need to restructure
                            # For now, default to social_media as it's most common
                            content["type"] = "social_media"
                            content_type = "social_media"
                            logger.warning("Content type missing, detected blog-like fields but defaulting to social_media")
                        else:
                            # Default to social_media if we can't infer (most common use case)
                            # This handles the case where user says "create content" without specifying type
                            content["type"] = "social_media"
                            content_type = "social_media"
                            logger.warning("Content type missing or null, defaulting to social_media")
                
                # If we have social_media type, ensure social_media nested object exists
                if content_type == "social_media":
                    if "social_media" not in content:
                        content["social_media"] = {}
                    
                    social_media = content["social_media"]
                    if not isinstance(social_media, dict):
                        social_media = {}
                        content["social_media"] = social_media
                    
                    # Check if platform or content_type are at the wrong level (directly under content)
                    # Move them to social_media if found
                    if "platform" in content and "platform" not in social_media:
                        social_media["platform"] = content.pop("platform")
                        logger.info(f"Moved platform from content to social_media: {social_media.get('platform')}")
                    
                    if "content_type" in content and "content_type" not in social_media:
                        social_media["content_type"] = content.pop("content_type")
                        logger.info(f"Moved content_type from content to social_media: {social_media.get('content_type')}")
                    
                    if "idea" in content and "idea" not in social_media:
                        social_media["idea"] = content.pop("idea")
                        logger.info(f"Moved idea from content to social_media: {social_media.get('idea')}")
                    
                    # Move media and media_file fields if they're at the wrong level
                    if "media" in content and "media" not in social_media:
                        social_media["media"] = content.pop("media")
                        logger.info(f"Moved media from content to social_media: {social_media.get('media')}")
                    
                    if "media_file" in content and "media_file" not in social_media:
                        social_media["media_file"] = content.pop("media_file")
                        logger.info(f"Moved media_file from content to social_media: {social_media.get('media_file')}")
                    
                    # Move date and task fields if they're at the wrong level
                    if "date" in content and "date" not in social_media:
                        social_media["date"] = content.pop("date")
                        logger.info(f"Moved date from content to social_media: {social_media.get('date')}")
                    
                    if "task" in content and "task" not in social_media:
                        social_media["task"] = content.pop("task")
                        logger.info(f"Moved task from content to social_media: {social_media.get('task')}")
                    
                    # Move content field (for saved_content_id) if it's at the wrong level
                    if "content" in content and "content" not in social_media:
                        social_media["content"] = content.pop("content")
                        logger.info(f"Moved content (saved_content_id) from content to social_media: {social_media.get('content')}")
                
                # If we have email type, ensure email nested object exists and normalize field names
                elif content_type == "email":
                    if "email" not in content:
                        content["email"] = {}
                    
                    email = content["email"]
                    if not isinstance(email, dict):
                        email = {}
                        content["email"] = email
                    
                    # Map common field name variations to the correct field name
                    # LLM might use "recipient" but EmailPayload uses "email_address"
                    if "recipient" in email and "email_address" not in email:
                        email["email_address"] = email.pop("recipient")
                        logger.info(f"Mapped recipient to email_address: {email.get('email_address')}")
                    
                    # Also check if recipient is at the wrong level (directly under content)
                    if "recipient" in content and "email_address" not in email:
                        email["email_address"] = content.pop("recipient")
                        logger.info(f"Moved recipient from content to email.email_address: {email.get('email_address')}")
                    
                    # Map common email content field name variations
                    # LLM might use "body", "message", "text", "subject" but EmailPayload uses "content"
                    content_field_aliases = ["body", "message", "text", "subject", "topic", "about"]
                    for alias in content_field_aliases:
                        if alias in email and "content" not in email:
                            email["content"] = email.pop(alias)
                            logger.info(f"Mapped {alias} to content: {email.get('content')[:50] if email.get('content') else None}")
                            break
                        elif alias in content and "content" not in email:
                            email["content"] = content.pop(alias)
                            logger.info(f"Moved {alias} from content to email.content: {email.get('content')[:50] if email.get('content') else None}")
                            break
                    
                    # Handle attachment/attachments fields
                    # EmailPayload uses "attachments" (plural, List[str])
                    # LLM might use "attachment" (singular) - convert to list if needed
                    if "attachment" in email and "attachments" not in email:
                        attachment_value = email.pop("attachment")
                        # Convert to list if it's a string
                        if isinstance(attachment_value, str):
                            email["attachments"] = [attachment_value]
                        elif isinstance(attachment_value, list):
                            email["attachments"] = attachment_value
                        else:
                            email["attachments"] = [str(attachment_value)] if attachment_value else []
                        logger.info(f"Mapped attachment to attachments: {email.get('attachments')}")
                    
                    # Also check if attachment/attachments is at the wrong level (directly under content)
                    if "attachment" in content and "attachments" not in email:
                        attachment_value = content.pop("attachment")
                        if isinstance(attachment_value, str):
                            email["attachments"] = [attachment_value]
                        elif isinstance(attachment_value, list):
                            email["attachments"] = attachment_value
                        else:
                            email["attachments"] = [str(attachment_value)] if attachment_value else []
                        logger.info(f"Moved attachment from content to email.attachments: {email.get('attachments')}")
                    
                    if "attachments" in content and "attachments" not in email:
                        email["attachments"] = content.pop("attachments")
                        logger.info(f"Moved attachments from content to email.attachments: {email.get('attachments')}")
                
                # If we have blog type, ensure blog nested object exists and normalize field names
                elif content_type == "blog":
                    if "blog" not in content:
                        content["blog"] = {}
                    
                    blog = content["blog"]
                    if not isinstance(blog, dict):
                        blog = {}
                        content["blog"] = blog
                    
                    # Check if blog fields are at the wrong level (directly under content)
                    # Move them to blog if found
                    blog_field_mappings = {
                        "topic": "topic",
                        "platform": "platform",
                        "length": "length",
                        "media": "media",
                        "media_file": "media_file",
                        "task": "task"
                    }
                    for field_name, target_field in blog_field_mappings.items():
                        if field_name in content and target_field not in blog:
                            blog[target_field] = content.pop(field_name)
                            logger.info(f"Moved {field_name} from content to blog.{target_field}: {blog.get(target_field)}")
                
                # If we have whatsapp type, ensure whatsapp nested object exists and normalize field names
                elif content_type == "whatsapp":
                    if "whatsapp" not in content:
                        content["whatsapp"] = {}
                    
                    whatsapp = content["whatsapp"]
                    if not isinstance(whatsapp, dict):
                        whatsapp = {}
                        content["whatsapp"] = whatsapp
                    
                    # Map common field name variations
                    # LLM might use "phone" or "number" but WhatsAppPayload uses "phone_number"
                    if "phone" in whatsapp and "phone_number" not in whatsapp:
                        whatsapp["phone_number"] = whatsapp.pop("phone")
                        logger.info(f"Mapped phone to phone_number: {whatsapp.get('phone_number')}")
                    
                    if "number" in whatsapp and "phone_number" not in whatsapp:
                        whatsapp["phone_number"] = whatsapp.pop("number")
                        logger.info(f"Mapped number to phone_number: {whatsapp.get('phone_number')}")
                    
                    # Also check if phone/number is at the wrong level (directly under content)
                    if "phone" in content and "phone_number" not in whatsapp:
                        whatsapp["phone_number"] = content.pop("phone")
                        logger.info(f"Moved phone from content to whatsapp.phone_number: {whatsapp.get('phone_number')}")
                    
                    if "number" in content and "phone_number" not in whatsapp:
                        whatsapp["phone_number"] = content.pop("number")
                        logger.info(f"Moved number from content to whatsapp.phone_number: {whatsapp.get('phone_number')}")
                    
                    # Map common message field name variations
                    # LLM might use "message", "text", "content" but WhatsAppPayload uses "text"
                    message_field_aliases = ["message", "content", "body"]
                    for alias in message_field_aliases:
                        if alias in whatsapp and "text" not in whatsapp:
                            whatsapp["text"] = whatsapp.pop(alias)
                            logger.info(f"Mapped {alias} to text: {whatsapp.get('text')[:50] if whatsapp.get('text') else None}")
                            break
                        elif alias in content and "text" not in whatsapp:
                            whatsapp["text"] = content.pop(alias)
                            logger.info(f"Moved {alias} from content to whatsapp.text: {whatsapp.get('text')[:50] if whatsapp.get('text') else None}")
                            break
                    
                    # Handle attachment field
                    # WhatsAppPayload uses "attachment" (singular, str)
                    if "attachment" in content and "attachment" not in whatsapp:
                        whatsapp["attachment"] = content.pop("attachment")
                        logger.info(f"Moved attachment from content to whatsapp.attachment: {whatsapp.get('attachment')}")
                
                # Re-check content_type after inference (it should be set by now)
                content_type = content.get("type")
                logger.info(f"Content type after inference: {content_type}")
                
                # Ensure type is valid (handle case where type was set but invalid)
                if content_type and content_type not in [None, "null", ""]:
                    valid_types = ["social_media", "blog", "email", "whatsapp", "ads"]
                    if content_type not in valid_types:
                        logger.warning(f"Invalid content type '{content_type}', defaulting to social_media")
                        content["type"] = "social_media"
                        content_type = "social_media"
                    
                    # If type is set but the corresponding nested object doesn't exist, create an empty one
                    # This ensures the payload structure is valid for validation
                    if content_type == "social_media" and "social_media" not in content:
                        content["social_media"] = {}
                    elif content_type == "blog" and "blog" not in content:
                        content["blog"] = {}
                    elif content_type == "email" and "email" not in content:
                        content["email"] = {}
                    elif content_type == "whatsapp" and "whatsapp" not in content:
                        content["whatsapp"] = {}
                    elif content_type == "ads" and "ads" not in content:
                        content["ads"] = {}
                else:
                    # If type is still None/empty after all attempts, remove the content object entirely
                    # We'll ask the user for the type in the handler
                    logger.warning(f"Content type could not be determined (type={content_type}), removing content from payload")
                    payload_dict["content"] = None
                    # Return early since we've removed content
                    return payload_dict
                
                # Remove invalid fields that don't belong in ContentGenerationPayload
                # ContentGenerationPayload should only have: type, social_media, blog, email, whatsapp, ads
                # Only do this if content still exists and has a valid type
                if content and isinstance(content, dict) and content.get("type"):
                    valid_content_keys = ["type", "social_media", "blog", "email", "whatsapp", "ads"]
                    invalid_keys = [key for key in content.keys() if key not in valid_content_keys]
                    if invalid_keys:
                        logger.warning(f"Removing invalid fields from content payload: {invalid_keys}")
                        for key in invalid_keys:
                            content.pop(key, None)
                elif content and isinstance(content, dict) and not content.get("type"):
                    # If content exists but type is still None, remove it
                    logger.warning("Content object exists but type is None, removing content from payload")
                    payload_dict["content"] = None
        
        return payload_dict
    
    def _merge_payloads(self, existing: Optional[Dict[str, Any]], new: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge new payload data into existing partial payload"""
        if not existing:
            return new.copy()
        
        merged = existing.copy()
        
        # Recursively merge nested dictionaries
        for key, value in new.items():
            if value is not None:  # Only merge non-null values
                if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                    merged[key] = self._merge_payloads(merged[key], value)
                else:
                    merged[key] = value
        
        return merged
    
    def _get_missing_fields_for_social_media(self, payload: Any) -> List[Dict[str, Any]]:
        """Get list of missing required fields for social media payload"""
        missing = []
        
        if not payload:
            return [{
                "field": "platform", 
                "question": "Which platform(s) would you like to create content for?", 
                "options": ["facebook", "instagram", "youtube", "linkedin", "twitter", "pinterest"],
                "priority": 1
            }]
        
        # Required fields in priority order
        if not payload.platform:
            missing.append({
                "field": "platform",
                "question": "Which platform(s) would you like to create content for?",
                "options": ["facebook", "instagram", "youtube", "linkedin", "twitter", "pinterest"],
                "priority": 1
            })
        
        if not payload.content_type:
            missing.append({
                "field": "content_type",
                "question": "What type of content would you like to create?",
                "options": ["post", "reel", "video", "story", "carousel"],
                "priority": 2
            })
        
        if not payload.idea:
            missing.append({
                "field": "idea",
                "question": "What would you like to share in this social media post?",
                "options": None,
                "priority": 3
            })
        
        # Sort by priority
        missing.sort(key=lambda x: x.get("priority", 999))
        return missing
    
    def _generate_clarifying_question(self, missing_fields: List[Dict[str, Any]], intent_type: str) -> str:
        """Generate a clarifying question with options for missing fields"""
        if not missing_fields:
            return ""
        
        # Take the first missing field (highest priority)
        field_info = missing_fields[0]
        question = field_info["question"]
        
        # Add options if available
        if field_info.get("options"):
            options_text = ", ".join([f"**{opt}**" for opt in field_info["options"]])
            question += f"\n\nYou can pick from: {options_text} - or just tell me what you prefer!"
        
        return question
    
    def classify_intent(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Classify user query into intent and populate Pydantic payload"""
        query = state["current_query"]
        partial_payload = state.get("partial_payload")
        conversation_history = state.get("conversation_history", [])
        
        # Log the user query
        logger.info(f"Classifying intent for query: {query}")
        if partial_payload:
            logger.info(f"Merging with existing partial payload: {json.dumps(partial_payload, indent=2)}")
        
        # Build context from conversation history
        history_context = ""
        if conversation_history:
            recent_history = conversation_history[-5:]  # Last 5 messages
            history_context = "\n\nRecent conversation:\n"
            for msg in recent_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_context += f"{role}: {content}\n"
        
        # Include partial payload context if exists
        partial_context = ""
        if partial_payload:
            partial_context = f"\n\nPreviously collected information:\n{json.dumps(partial_payload, indent=2)}\n\nExtract any new information from the user's query and merge it with the existing data. Keep all previously collected non-null values."
        
        # Create the classification prompt
        classification_prompt = f"""You are an intent classifier for a business assistant chatbot.

Your job:
1. Read the user's natural language query
2. Classify it into the correct intent (one of: content_generation, analytics, leads_management, posting_manager, general_talks, faq)
3. Extract ALL entities and information from the user's query - be thorough and extract everything mentioned
4. Produce a Pydantic-validated payload according to the provided schema
5. If the user query does not contain enough information, populate whatever fields you can and leave the rest as null
6. DO NOT hallucinate missing information
7. If information is missing and required later, mark the missing fields as null - the graph nodes will ask clarifying questions
8. Always output JSON only, following the exact structure of the Pydantic models
9. If there's existing partial payload data, merge the new information with it (keep existing non-null values, only update with new information from the current query)

Your output MUST strictly follow this root structure:
{{
  "intent": "...",
  "content": {{"type": "social_media" | "blog" | "email" | "whatsapp" | "ads", "social_media": {{"platform": "...", "content_type": "...", "idea": "..."}}, ...}} | null,
  "analytics": {{...}} | null,
  "leads": {{...}} | null,
  "posting": {{...}} | null,
  "general": {{...}} | null,
  "faq": {{"query": "..."}} | null
}}

CRITICAL: ENTITY EXTRACTION FOR CONTENT GENERATION
When the user mentions content creation, you MUST extract ALL entities from their query:

1. PLATFORM EXTRACTION - Extract platform names from the query:
   - "instagram" → platform: ["instagram"]
   - "facebook" → platform: ["facebook"]
   - "youtube" → platform: ["youtube"]
   - "linkedin" → platform: ["linkedin"]
   - "twitter" → platform: ["twitter"]
   - "pinterest" → platform: ["pinterest"]
   - If multiple platforms mentioned, extract all: ["instagram", "facebook"]
   - If user says "instagram reel", extract platform: ["instagram"]

2. CONTENT_TYPE EXTRACTION - Extract content type from the query:
   - "reel" or "reels" → content_type: "reel"
   - "post" or "posts" → content_type: "post"
   - "video" or "videos" → content_type: "video"
   - "story" or "stories" → content_type: "story"
   - "carousel" or "carousels" → content_type: "carousel"
   - If user says "instagram reel", extract content_type: "reel"

3. IDEA/TOPIC EXTRACTION - Extract any topic, idea, or subject mentioned:
   - "product launch" → idea: "product launch"
   - "company update" → idea: "company update"
   - "tip about marketing" → idea: "tip about marketing"
   - Any descriptive text about what the content should be about

EXAMPLES OF CORRECT EXTRACTION:
- User: "i want to create an instagram reel"
  Output: {{
    "intent": "content_generation",
    "content": {{
      "type": "social_media",
      "social_media": {{
        "platform": ["instagram"],
        "content_type": "reel",
        "idea": null
      }}
    }},
    ...
  }}

- User: "create a facebook post about our new product"
  Output: {{
    "intent": "content_generation",
    "content": {{
      "type": "social_media",
      "social_media": {{
        "platform": ["facebook"],
        "content_type": "post",
        "idea": "our new product"
      }}
    }},
    ...
  }}

- User: "make a youtube video"
  Output: {{
    "intent": "content_generation",
    "content": {{
      "type": "social_media",
      "social_media": {{
        "platform": ["youtube"],
        "content_type": "video",
        "idea": null
      }}
    }},
    ...
  }}

IMPORTANT RULES FOR CONTENT GENERATION:
- If intent is "content_generation", the "content" object MUST include a "type" field
- The "type" field MUST be one of: "social_media", "blog", "email", "whatsapp", "ads"
- If the user says "post", "reel", "video", "story", "carousel" → infer type as "social_media"
- If the user says "blog" or "article", infer type as "blog"
- If the user says "email", infer type as "email"
- If the user says "whatsapp" or "message", infer type as "whatsapp"
- If the user says "ad" or "advertisement", infer type as "ads"
- ALWAYS extract platform and content_type when mentioned in the query
- NEVER create a "content" object without a "type" field
- For social_media type, ALWAYS create the "social_media" nested object with extracted fields

EMAIL-SPECIFIC RULES:
- For email type, use these EXACT field names in the "email" nested object:
  - "email_address" (NOT "recipient", "to", "email", etc.) - the recipient's email address
  - "content" (NOT "body", "message", "text", "subject", etc.) - what the email should be about
  - "attachments" (array of strings) - file paths or URLs for email attachments (extract if user mentions "attach", "attachment", "file", "document", etc.)
  - "task" (one of: "send", "save", "schedule") - what to do with the email
- If user mentions an email address, extract it as "email_address" in the "email" object
- If user describes what the email should be about (e.g., "product launch", "meeting invitation"), extract it as "content" in the "email" object
- If user mentions attachments (e.g., "attach the PDF", "with the document"), extract file references as "attachments" array
- Example: User says "send email to john@example.com about product launch"
  Output: {{"intent": "content_generation", "content": {{"type": "email", "email": {{"email_address": "john@example.com", "content": "product launch", "task": "send"}}}}}}
- Example: User says "email to jane@example.com with the invoice attached"
  Output: {{"intent": "content_generation", "content": {{"type": "email", "email": {{"email_address": "jane@example.com", "attachments": ["invoice"], "task": "send"}}}}}}

WHATSAPP-SPECIFIC RULES:
- For whatsapp type, use these EXACT field names in the "whatsapp" nested object:
  - "phone_number" (NOT "phone", "number", etc.) - recipient's phone number with country code
  - "text" (NOT "message", "content", "body", etc.) - the message text
  - "attachment" (string) - file path or URL for WhatsApp attachment (extract if user mentions "attach", "attachment", "file", "image", "video", etc.)
  - "task" (one of: "send", "schedule", "save") - what to do with the message
- If user mentions a phone number, extract it as "phone_number" in the "whatsapp" object
- If user mentions attachments (e.g., "send image", "with a video"), extract file reference as "attachment" string
- Example: User says "send WhatsApp to +919876543210 with the image"
  Output: {{"intent": "content_generation", "content": {{"type": "whatsapp", "whatsapp": {{"phone_number": "+919876543210", "attachment": "image", "task": "send"}}}}}}

BLOG-SPECIFIC RULES:
- For blog type, use these EXACT field names in the "blog" nested object:
  - "topic" - what the blog post should be about (e.g., "marketing tips", "product review")
  - "platform" (one of: "wordpress", "shopify", "wix", "html") - where to publish the blog
  - "length" (one of: "short", "medium", "long") - how long the blog post should be
  - "media" (one of: "generate", "upload") - whether to generate new media or upload existing media
  - "media_file" (string) - file path or URL if user mentions uploading a specific file
  - "task" (one of: "draft", "schedule", "save") - what to do with the blog post
- If user mentions a blog topic, extract it as "topic" in the "blog" object
- If user mentions a platform (wordpress, shopify, wix, html), extract it as "platform" in the "blog" object
- If user mentions length (short, medium, long), extract it as "length" in the "blog" object
- If user says "upload image", "use this photo", "attach file" → set media: "upload" and extract file reference as "media_file"
- If user says "generate image", "create visual", "make graphic" → set media: "generate"
- Example: User says "create a blog post about digital marketing for wordpress"
  Output: {{"intent": "content_generation", "content": {{"type": "blog", "blog": {{"topic": "digital marketing", "platform": "wordpress", "length": null, "task": null}}}}}}
- Example: User says "blog post with this image: /path/to/image.jpg"
  Output: {{"intent": "content_generation", "content": {{"type": "blog", "blog": {{"media": "upload", "media_file": "/path/to/image.jpg"}}}}}}
- When merging with existing partial payload, preserve all non-null blog fields and only update with new information

SOCIAL MEDIA MEDIA RULES:
- For social_media type, also extract media information if mentioned:
  - "media" (one of: "upload", "generate") - whether to upload existing media or generate new media
  - "media_file" (string) - file path or URL if user mentions uploading a specific file
- If user says "upload image", "use this photo", "attach file", OR JUST "upload" → set media: "upload" and extract file reference as "media_file" if provided
- If user says "generate image", "create visual", "make graphic", OR JUST "generate" → set media: "generate"
- CRITICAL: If the user responds with ONLY "generate" or ONLY "upload" (without other context), this is a direct answer to the media question - extract it as media: "generate" or media: "upload" respectively

SOCIAL MEDIA TASK AND DATE RULES:
- For social_media type, also extract task and date information if mentioned:
  - "task" (one of: "draft", "schedule", "edit", "delete") - what to do with the post after generation
  - "date" (ISO datetime string) - when to schedule the post (only needed if task is "schedule")
- If user says "draft", "save as draft", "save it" → set task: "draft"
- If user says "schedule", "schedule it", "schedule for later" → set task: "schedule"
- If user says "edit", "modify", "change" → set task: "edit"
- If user says "delete", "remove", "remove it" → set task: "delete"
- If user mentions a date/time for scheduling (e.g., "December 25, 2024 at 2:00 PM", "tomorrow at 10am"), extract it as "date" in ISO format
- CRITICAL: If the user responds with ONLY "draft", "schedule", "edit", or "delete" (without other context), this is a direct answer to the task question - extract it accordingly
- Example: User says "create an instagram post with this image: /path/to/image.jpg"
  Output: {{"intent": "content_generation", "content": {{"type": "social_media", "social_media": {{"platform": ["instagram"], "content_type": "post", "media": "upload", "media_file": "/path/to/image.jpg"}}}}}}
- Example: User says "generate" (as a response to media question)
  Output: {{"intent": "content_generation", "content": {{"type": "social_media", "social_media": {{"media": "generate"}}}}}}
- Example: User says "schedule it for tomorrow at 10am"
  Output: {{"intent": "content_generation", "content": {{"type": "social_media", "social_media": {{"task": "schedule", "date": "2024-12-26T10:00:00Z"}}}}}}
- Example: User says "edit" (as a response to task question)
  Output: {{"intent": "content_generation", "content": {{"type": "social_media", "social_media": {{"task": "edit"}}}}}}
- Example: User says "delete" (as a response to task question)
  Output: {{"intent": "content_generation", "content": {{"type": "social_media", "social_media": {{"task": "delete"}}}}}}
- When merging with existing partial payload, preserve all non-null social_media fields and only update with new information

FAQ INTENT DETECTION:
- Classify as "faq" when the user asks informational questions about:
  • Pricing, plans, costs, subscriptions
  • How Emily works, features, capabilities
  • Onboarding, getting started, usage instructions
  • Support, help, documentation
  • Limits, restrictions, what's included
- Examples of FAQ queries:
  - "what is the basic plan price?"
  - "how does emily help my business?"
  - "what can emily do?"
  - "how do I get started?"
  - "what features are included?"
  - "what are the pricing plans?"
  - "how much does it cost?"
- If the query is informational and NOT a task (not asking to create, update, or manage something), classify as "faq"
- If the query is conversational but not informational, classify as "general_talks"
- For FAQ intent, set faq: {{"query": "<user's question>"}}

General Rules:
- EXACT intent labels must be used: content_generation, analytics, leads_management, posting_manager, general_talks, faq
- EXACT enum values must be used (e.g., "facebook", "instagram" for platforms; "post", "reel", "video", "story", "carousel" for content_type)
- Never output fields that are not in the Pydantic schema
- Never assume unknown fields
- If a query is conversational or does not match any domain, classify it under "general_talks"
- You must always return every top-level key, even if null
- If merging with existing data, preserve all non-null existing values and only add/update with new information from the current query
- BE THOROUGH: Extract every piece of information the user mentions - don't leave fields as null if they're clearly stated in the query

{partial_context}
{history_context}

User query: "{query}"

Return ONLY valid JSON matching the IntentPayload structure. No explanations, no markdown, no comments."""

        try:
            # Use structured output to get JSON
            response = self.llm.invoke([HumanMessage(content=classification_prompt)])
            
            # Log the raw LLM response
            logger.info(f"LLM raw response: {response.content}")
            
            # Parse the JSON response
            try:
                content = response.content.strip()
                
                # Remove markdown code blocks if present
                if content.startswith("```json"):
                    content = content[7:]  # Remove ```json
                elif content.startswith("```"):
                    content = content[3:]  # Remove ```
                
                if content.endswith("```"):
                    content = content[:-3]  # Remove closing ```
                
                content = content.strip()
                
                # Log the cleaned content before parsing
                logger.debug(f"LLM cleaned response: {content}")
                
                payload_dict = json.loads(content)
                
                # Merge with existing partial payload if it exists
                if partial_payload:
                    payload_dict = self._merge_payloads(partial_payload, payload_dict)
                    logger.info(f"Merged payload dict: {json.dumps(payload_dict, indent=2)}")
                
                # Log the parsed payload
                logger.info(f"Parsed payload dict: {json.dumps(payload_dict, indent=2)}")
                
                # Normalize and fix payload structure (but don't validate yet)
                payload_dict = self._normalize_payload(payload_dict)
                logger.info(f"Payload dict after normalization: {json.dumps(payload_dict, indent=2)}")
                
                # IMPORTANT: Ensure content is None if it's invalid (has type=None or missing type)
                # This prevents validation errors when creating minimal IntentPayload
                if payload_dict.get("content") and isinstance(payload_dict["content"], dict):
                    content_obj = payload_dict["content"]
                    content_type = content_obj.get("type")
                    if not content_type or content_type is None or content_type == "null" or content_type == "":
                        logger.warning(f"Content object has invalid type (type={content_type}), removing it from payload")
                        payload_dict["content"] = None
                
                # Store the merged payload as partial_payload for next iteration
                state["partial_payload"] = payload_dict
                
                # Create a minimal IntentPayload with just the intent for routing
                # We'll validate the full payload later when all required fields are collected
                intent_value = payload_dict.get("intent", "general_talks")
                
                # Create minimal payload for routing - only validate the intent
                # IMPORTANT: Set all payload fields to None to avoid validation
                # We only need the intent for routing
                try:
                    # Create IntentPayload with minimal data for routing
                    # Always set content to None to avoid validation
                    minimal_payload = {
                        "intent": intent_value,
                        "content": None,  # Always None - we'll validate later
                        "analytics": None,
                        "leads": None,
                        "posting": None,
                        "general": None,
                        "faq": None
                    }
                    intent_payload = IntentPayload(**minimal_payload)
                    state["intent_payload"] = intent_payload
                    logger.info(f"Intent classified as: {intent_value} (payload stored in partial_payload, validation deferred)")
                except Exception as e:
                    logger.error(f"Failed to create minimal IntentPayload: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    # Fallback to general_talks
                    state["intent_payload"] = IntentPayload(
                        intent="general_talks",
                        general=GeneralTalkPayload(message=query)
                    )
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from LLM response: {e}")
                logger.error(f"Response content: {response.content}")
                # Fallback to general_talks
                state["intent_payload"] = IntentPayload(
                    intent="general_talks",
                    general=GeneralTalkPayload(message=query)
                )
            except Exception as e:
                logger.error(f"Error processing payload: {e}")
                logger.error(f"Payload dict: {json.dumps(payload_dict, indent=2) if 'payload_dict' in locals() else 'N/A'}")
                
                # Try to fix common issues and store as partial payload
                if 'payload_dict' in locals():
                    try:
                        # Try normalization again
                        fixed_payload = self._normalize_payload(payload_dict.copy())
                        state["partial_payload"] = fixed_payload
                        
                        # Create minimal IntentPayload for routing
                        intent_value = fixed_payload.get("intent", "general_talks")
                        minimal_payload = {
                            "intent": intent_value,
                            "content": None,
                            "analytics": None,
                            "leads": None,
                            "posting": None,
                            "general": None,
                            "faq": None
                        }
                        intent_payload = IntentPayload(**minimal_payload)
                        state["intent_payload"] = intent_payload
                        logger.info(f"Fixed payload structure, intent: {intent_value} (validation deferred)")
                    except Exception as retry_error:
                        logger.error(f"Retry after normalization also failed: {retry_error}")
                        # Fallback to general_talks
                        state["intent_payload"] = IntentPayload(
                            intent="general_talks",
                            general=GeneralTalkPayload(message=query)
                        )
                else:
                    # Fallback to general_talks
                    state["intent_payload"] = IntentPayload(
                        intent="general_talks",
                        general=GeneralTalkPayload(message=query)
                    )
                
        except Exception as e:
            logger.error(f"Error in classify_intent: {e}")
            # Fallback to general_talks
            state["intent_payload"] = IntentPayload(
                intent="general_talks",
                general=GeneralTalkPayload(message=query)
            )
        
        return state
    
    def handle_content_generation(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Handle content generation intent"""
        try:
            from agents.tools.Leo_Content_Generation import execute_content_generation
            
            # Get the partial payload dictionary (not validated yet)
            partial_payload = state.get("partial_payload", {})
            content_dict = partial_payload.get("content")
            
            # Quick check: if user just said "generate" or "upload" and we're waiting for media, set it directly
            # Also check for "draft" or "schedule" for task field
            user_query = state.get("current_query", "").strip()
            user_query_lower = user_query.lower()
            if content_dict and content_dict.get("type") == "social_media":
                social_media_dict = content_dict.get("social_media", {})
                
                # Check if user sent "upload {url}" format (from file upload)
                if user_query_lower.startswith("upload ") and len(user_query) > 7:
                    # Extract URL from "upload {url}"
                    file_url = user_query[7:].strip()  # Remove "upload " prefix
                    if file_url and (file_url.startswith("http://") or file_url.startswith("https://")):
                        if "social_media" not in content_dict:
                            content_dict["social_media"] = {}
                        content_dict["social_media"]["media"] = "upload"
                        content_dict["social_media"]["media_file"] = file_url
                        partial_payload["content"] = content_dict
                        state["partial_payload"] = partial_payload
                        logger.info(f"Directly set media to 'upload' with file URL: {file_url}")
                elif not social_media_dict.get("media"):
                    if user_query_lower == "generate":
                        if "social_media" not in content_dict:
                            content_dict["social_media"] = {}
                        content_dict["social_media"]["media"] = "generate"
                        partial_payload["content"] = content_dict
                        state["partial_payload"] = partial_payload
                        logger.info("Directly set media to 'generate' from user query")
                    elif user_query_lower == "upload":
                        if "social_media" not in content_dict:
                            content_dict["social_media"] = {}
                        content_dict["social_media"]["media"] = "upload"
                        partial_payload["content"] = content_dict
                        state["partial_payload"] = partial_payload
                        logger.info("Directly set media to 'upload' from user query")
            
            # Re-get content_dict after potential update
            content_dict = partial_payload.get("content")
            
            if not content_dict:
                state["response"] = "I'd love to help you create some content! What are you thinking - are you looking to create something for social media, write a blog post, send an email, create a WhatsApp message, or maybe work on some ads?"
                state["needs_clarification"] = True
                return state
            
            # Check if type is set
            content_type = content_dict.get("type")
            if not content_type:
                state["response"] = "Sounds good! Just to make sure I create exactly what you need - are you thinking social media content, a blog post, an email, a WhatsApp message, or maybe some ads?"
                state["needs_clarification"] = True
                return state
            
            # Check for missing required fields based on content type
            # Handle social_media type
            if content_type == "social_media":
                social_media_dict = content_dict.get("social_media", {})
                
                # Check for missing fields using dictionary
                missing_fields = []
                if not social_media_dict.get("platform"):
                    missing_fields.append({
                        "field": "platform",
                        "question": "Great! Which social media platform are you thinking of? Are you looking to post on Facebook, Instagram, YouTube, LinkedIn, Twitter, or Pinterest?",
                        "options": ["facebook", "instagram", "youtube", "linkedin", "twitter", "pinterest"],
                        "priority": 1
                    })
                
                if not social_media_dict.get("content_type"):
                    missing_fields.append({
                        "field": "content_type",
                        "question": "What kind of content are you planning? Are you thinking of a regular post, a reel, a video, a story, or maybe a carousel?",
                        "options": ["post", "reel", "video", "story", "carousel"],
                        "priority": 2
                    })
                
                if not social_media_dict.get("idea"):
                    missing_fields.append({
                        "field": "idea",
                        "question": "What would you like to share in this social media post?",
                        "options": None,
                        "priority": 3
                    })
                
                # Check for media field (lower priority - ask after core fields are filled)
                if not social_media_dict.get("media"):
                    missing_fields.append({
                        "field": "media",
                        "question": "Great! For the visuals, would you like me to generate an image for this post, or do you have a file you'd like to upload?",
                        "options": ["generate", "upload"],
                        "priority": 4
                    })
                # If media is "upload" but media_file is missing, ask for the file
                elif social_media_dict.get("media") == "upload" and not social_media_dict.get("media_file"):
                    missing_fields.append({
                        "field": "media_file",
                        "question": "Perfect! You mentioned uploading a file. Could you share the file path or URL for the image/video you'd like to use?",
                        "options": None,
                        "priority": 4
                    })
                
                # Sort by priority
                missing_fields.sort(key=lambda x: x.get("priority", 999))
                
                logger.info(f"Missing fields for social_media: {missing_fields}")
                if missing_fields:
                    question = self._generate_clarifying_question(missing_fields, "social_media")
                    state["response"] = question
                    state["needs_clarification"] = True
                    # Store options for frontend rendering
                    field_info = missing_fields[0]
                    state["options"] = field_info.get("options")
                    logger.info(f"Generated clarifying question: {question}")
                    logger.info(f"Options for frontend: {state['options']}")
                    return state
            
            # Handle email type
            elif content_type == "email":
                email_dict = content_dict.get("email", {})
                
                # Check for missing fields using dictionary
                # Also check for "recipient" as an alias for "email_address"
                missing_fields = []
                email_address = email_dict.get("email_address") or email_dict.get("recipient")
                if not email_address:
                    missing_fields.append({
                        "field": "email_address",
                        "question": "Sure! Who should I send this email to? What's their email address?",
                        "options": None,
                        "priority": 1
                    })
                
                # Check for content field, also check common aliases
                email_content = email_dict.get("content") or email_dict.get("body") or email_dict.get("message") or email_dict.get("text") or email_dict.get("subject") or email_dict.get("topic") or email_dict.get("about")
                if not email_content:
                    missing_fields.append({
                        "field": "content",
                        "question": "What's this email going to be about? Are you announcing a product, inviting them to a meeting, sending a newsletter, or something else?",
                        "options": None,
                        "priority": 2
                    })
                
                if not email_dict.get("task"):
                    missing_fields.append({
                        "field": "task",
                        "question": "Got it! What would you like me to do with this email? Should I send it right away, save it as a draft, or schedule it for later?",
                        "options": ["send", "save", "schedule"],
                        "priority": 3
                    })
                
                # Sort by priority
                missing_fields.sort(key=lambda x: x.get("priority", 999))
                
                logger.info(f"Missing fields for email: {missing_fields}")
                if missing_fields:
                    question = self._generate_clarifying_question(missing_fields, "email")
                    state["response"] = question
                    state["needs_clarification"] = True
                    # Store options for frontend rendering
                    field_info = missing_fields[0]
                    state["options"] = field_info.get("options")
                    logger.info(f"Generated clarifying question: {question}")
                    logger.info(f"Options for frontend: {state['options']}")
                    return state
            
            # Handle blog type
            elif content_type == "blog":
                blog_dict = content_dict.get("blog", {})
                
                # Check for missing fields using dictionary
                missing_fields = []
                if not blog_dict.get("topic"):
                    missing_fields.append({
                        "field": "topic",
                        "question": "Awesome! What topic are you thinking of writing about? For example, are you sharing marketing tips, doing a product review, covering industry news, or something else?",
                        "options": None,
                        "priority": 1
                    })
                
                if not blog_dict.get("platform"):
                    missing_fields.append({
                        "field": "platform",
                        "question": "Perfect! Where are you planning to publish this? Are you using WordPress, Shopify, Wix, or maybe a custom HTML site?",
                        "options": ["wordpress", "shopify", "wix", "html"],
                        "priority": 2
                    })
                
                if not blog_dict.get("length"):
                    missing_fields.append({
                        "field": "length",
                        "question": "How long are you thinking? Are you going for a quick short read, a medium-length article, or a longer deep dive?",
                        "options": ["short", "medium", "long"],
                        "priority": 3
                    })
                
                if not blog_dict.get("task"):
                    missing_fields.append({
                        "field": "task",
                        "question": "Great! What would you like me to do with this blog post? Should I create it as a draft for you to review, schedule it to publish later, or just save it for now?",
                        "options": ["draft", "schedule", "save"],
                        "priority": 4
                    })
                
                # Sort by priority
                missing_fields.sort(key=lambda x: x.get("priority", 999))
                
                logger.info(f"Missing fields for blog: {missing_fields}")
                if missing_fields:
                    question = self._generate_clarifying_question(missing_fields, "blog")
                    state["response"] = question
                    state["needs_clarification"] = True
                    # Store options for frontend rendering
                    field_info = missing_fields[0]
                    state["options"] = field_info.get("options")
                    logger.info(f"Generated clarifying question: {question}")
                    logger.info(f"Options for frontend: {state['options']}")
                    return state
            
            # If all required fields are present, validate and execute
            # Now we validate the complete payload
            try:
                # Normalize one more time to ensure structure is correct
                normalized_payload = self._normalize_payload(partial_payload.copy())
                logger.info(f"Normalized payload before validation: {json.dumps(normalized_payload, indent=2, default=str)}")
                
                intent_payload = IntentPayload(**normalized_payload)
                payload = intent_payload.content
                
                if not payload:
                    logger.error("Payload is None after validation")
                    state["response"] = "I encountered an error: Content payload is missing. Please try again."
                    state["needs_clarification"] = True
                    return state
                
                logger.info("All required fields present, validating and executing payload")
                result = execute_content_generation(payload, state["user_id"])
            except Exception as validation_error:
                import traceback
                error_trace = traceback.format_exc()
                logger.error(f"Validation error when all fields should be present: {validation_error}")
                logger.error(f"Error traceback: {error_trace}")
                logger.error(f"Partial payload that failed: {json.dumps(partial_payload, indent=2, default=str)}")
                state["response"] = f"I encountered an error validating your request: {str(validation_error)}. Please try again or provide the information in a different way."
                state["needs_clarification"] = True  # Keep asking for clarification
                return state
            
            if result.get("clarifying_question"):
                state["response"] = result["clarifying_question"]
                state["needs_clarification"] = True
            elif result.get("success") and result.get("data"):
                # Store the structured content data in state for frontend
                data = result["data"]
                
                # Ensure images is always a list
                if "images" in data:
                    if not isinstance(data["images"], list):
                        data["images"] = [data["images"]] if data["images"] else []
                    # Filter out any None or empty values
                    data["images"] = [img for img in data["images"] if img and isinstance(img, str) and len(img) > 0]
                
                logger.info(f"📥 Received content generation result from Leo:")
                logger.info(f"  - Data keys: {list(data.keys())}")
                logger.info(f"  - Images: {data.get('images')}")
                logger.info(f"  - Images type: {type(data.get('images'))}")
                logger.info(f"  - Images length: {len(data.get('images', []))}")
                if data.get('images'):
                    for idx, img_url in enumerate(data['images']):
                        logger.info(f"    Image {idx + 1}: {img_url}")
                
                # Get saved_content_id and updated payload from the result
                saved_content_id = data.get("saved_content_id")
                updated_payload = result.get("payload")  # Full payload with content field set
                
                # Store in state
                state["content_data"] = data
                state["response"] = self._format_content_response(data)
                
                # Update partial payload with the full payload returned from Leo (includes content field)
                partial_payload = state.get("partial_payload", {})
                if updated_payload:
                    # Merge the updated payload from Leo into partial_payload
                    # The updated_payload should have the content field set to saved_content_id
                    if "content" not in partial_payload:
                        partial_payload["content"] = {}
                    if "social_media" not in partial_payload.get("content", {}):
                        partial_payload["content"]["social_media"] = {}
                    
                    # Merge the updated payload fields into partial_payload
                    for key, value in updated_payload.items():
                        if value is not None:  # Only update with non-null values
                            partial_payload["content"]["social_media"][key] = value
                    
                    logger.info(f"📝 Merged updated payload from Leo into partial_payload")
                    logger.info(f"   Payload content field: {partial_payload.get('content', {}).get('social_media', {}).get('content')}")
                elif saved_content_id:
                    # Fallback: if payload not returned, manually set content field
                    if "content" not in partial_payload:
                        partial_payload["content"] = {}
                    if "social_media" not in partial_payload.get("content", {}):
                        partial_payload["content"]["social_media"] = {}
                    partial_payload["content"]["social_media"]["content"] = saved_content_id
                    logger.info(f"📝 Fallback: Stored saved_content_id in payload.content.social_media.content: {saved_content_id}")
                
                # Content generation complete - task/date will be handled by posting manager
                # All fields complete, clear partial payload
                state["needs_clarification"] = False
                state["partial_payload"] = None
                
                logger.info(f"✅ Content data stored in state with {len(data.get('images', []))} image(s)")
            elif result.get("error"):
                state["response"] = f"I encountered an error: {result['error']}"
                state["needs_clarification"] = False
            else:
                state["response"] = "I've processed your content generation request."
                state["needs_clarification"] = False
                state["partial_payload"] = None
                
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"Error in handle_content_generation: {e}")
            logger.error(f"Error traceback: {error_trace}")
            state["response"] = f"I encountered an error while processing your content generation request: {str(e)}. Please try again."
            state["needs_clarification"] = True  # Keep asking for clarification instead of giving up
        
        return state
    
    def handle_analytics(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Handle analytics intent"""
        try:
            from agents.tools.Orion_Analytics_query import execute_analytics_query
            
            payload = state["intent_payload"].analytics
            if not payload:
                state["response"] = "I need more information about what analytics you'd like to see. Please specify your query."
                return state
            
            result = execute_analytics_query(payload, state["user_id"])
            
            if result.get("clarifying_question"):
                state["response"] = result["clarifying_question"]
            elif result.get("success") and result.get("data"):
                state["response"] = self._format_analytics_response(result["data"])
            elif result.get("error"):
                state["response"] = f"I encountered an error: {result['error']}"
            else:
                state["response"] = "I've processed your analytics query."
                
        except Exception as e:
            logger.error(f"Error in handle_analytics: {e}")
            state["response"] = "I encountered an error while processing your analytics query. Please try again."
        
        return state
    
    def handle_leads_management(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Handle leads management intent"""
        try:
            from agents.tools.Chase_Leads_manager import execute_leads_operation
            
            payload = state["intent_payload"].leads
            if not payload:
                state["response"] = "I need more information about what you'd like to do with leads. Please specify the action."
                return state
            
            result = execute_leads_operation(payload, state["user_id"])
            
            if result.get("clarifying_question"):
                state["response"] = result["clarifying_question"]
            elif result.get("success") and result.get("data"):
                state["response"] = self._format_leads_response(result["data"])
            elif result.get("error"):
                state["response"] = f"I encountered an error: {result['error']}"
            else:
                state["response"] = "I've processed your leads management request."
                
        except Exception as e:
            logger.error(f"Error in handle_leads_management: {e}")
            state["response"] = "I encountered an error while processing your leads request. Please try again."
        
        return state
    
    def handle_posting_manager(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Handle posting manager intent"""
        try:
            from agents.tools.Emily_post_manager import execute_posting_operation
            
            payload = state["intent_payload"].posting
            if not payload:
                state["response"] = "I need more information about what you'd like to do with your posts. Please specify the action."
                return state
            
            result = execute_posting_operation(payload, state["user_id"])
            
            if result.get("clarifying_question"):
                state["response"] = result["clarifying_question"]
            elif result.get("success") and result.get("data"):
                state["response"] = self._format_posting_response(result["data"])
            elif result.get("error"):
                state["response"] = f"I encountered an error: {result['error']}"
            else:
                state["response"] = "I've processed your posting request."
                
        except Exception as e:
            logger.error(f"Error in handle_posting_manager: {e}")
            state["response"] = "I encountered an error while processing your posting request. Please try again."
        
        return state
    
    def handle_general_talks(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Handle general conversational intent"""
        try:
            from agents.tools.general_chat_tool import execute_general_chat
            
            payload = state["intent_payload"].general
            if not payload:
                payload = GeneralTalkPayload(message=state["current_query"])
            
            result = execute_general_chat(payload, state["user_id"])
            
            if result.get("success") and result.get("data"):
                state["response"] = result["data"]
            elif result.get("error"):
                state["response"] = f"I encountered an error: {result['error']}"
            else:
                state["response"] = "I'm here to help! How can I assist you today?"
                
        except Exception as e:
            logger.error(f"Error in handle_general_talks: {e}")
            state["response"] = "I'm here to help! How can I assist you today?"
        
        return state
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            v1 = np.array(vec1)
            v2 = np.array(vec2)
            dot_product = np.dot(v1, v2)
            norm1 = np.linalg.norm(v1)
            norm2 = np.linalg.norm(v2)
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return float(dot_product / (norm1 * norm2))
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0
    
    def handle_faq(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Handle FAQ intent with RAG retrieval from Supabase using semantic similarity
        
        Uses sentence-transformers embeddings for semantic search instead of keyword matching.
        """
        try:
            user_query = state.get("current_query", "").strip()
            logger.info(f"Handling FAQ query: {user_query}")
            
            # Load user profile with embedding for business context
            user_id = state.get("user_id")
            business_context = None
            try:
                logger.info(f"🔍 Loading business context for user: {user_id}")
                profile_response = supabase.table("profiles").select("*, profile_embedding").eq("id", user_id).execute()
                
                if profile_response.data and len(profile_response.data) > 0:
                    profile_data = profile_response.data[0]
                    business_context = get_profile_context_with_embedding(profile_data)
                    logger.info(f"✅ Loaded business context (has embedding: {business_context.get('use_embedding', False)})")
                else:
                    logger.warning(f"⚠️ No profile found for user {user_id}")
            except Exception as profile_error:
                logger.error(f"❌ Error loading profile: {profile_error}")
                # Continue without business context
            
            # Retrieve FAQ records from Supabase
            faq_list = []
            try:
                # Get embedding service (same pattern as profile_embedding_helper.py)
                embedding_service = get_embedding_service()
                
                # Fetch all FAQs from Supabase
                # Schema: id, faq_key, response, category
                logger.info("🔍 Fetching all FAQs from Supabase...")
                all_faqs = supabase.table("faq_responses").select("id, faq_key, response, category").execute()
                
                if not all_faqs.data or len(all_faqs.data) == 0:
                    logger.warning("⚠️ No FAQs found in database")
                    state["response"] = "I don't have an exact answer for that yet, but I can help you with features, pricing, or usage. How can I assist you?"
                    return state
                
                logger.info(f"✅ Retrieved {len(all_faqs.data)} FAQs from database")
                
                # Generate embedding for user query
                logger.info("🔍 Generating embedding for user query...")
                query_embedding = embedding_service.generate_embedding_from_text(user_query)
                logger.info(f"✅ Generated query embedding (dimension: {len(query_embedding)})")
                
                # Get profile embedding if available for business-context-aware matching
                profile_embedding = None
                if business_context and business_context.get("use_embedding"):
                    profile_embedding = business_context.get("profile_embedding")
                    if profile_embedding:
                        logger.info(f"✅ Using profile embedding for business-context-aware matching")
                
                # Generate embeddings for all FAQs and calculate similarity
                logger.info("🔍 Computing semantic similarity for all FAQs...")
                faq_similarities = []
                
                for faq in all_faqs.data:
                    faq_id = faq.get("id")
                    faq_key = faq.get("faq_key", "")
                    response = faq.get("response", "")
                    category = faq.get("category", "")
                    
                    # Combine faq_key, response, and category for better semantic matching
                    # This helps match queries like "pricing" to "pricing_basic" or "pricing_pro"
                    faq_text = f"{faq_key} {response}"
                    if category:
                        faq_text = f"{category} {faq_text}"
                    
                    # Generate embedding for this FAQ
                    faq_embedding = embedding_service.generate_embedding_from_text(faq_text)
                    
                    # Calculate cosine similarity with query
                    query_similarity = self._cosine_similarity(query_embedding, faq_embedding)
                    
                    # If profile embedding is available, also calculate business context similarity
                    business_similarity = 0.0
                    if profile_embedding:
                        business_similarity = self._cosine_similarity(profile_embedding, faq_embedding)
                        logger.debug(f"FAQ {faq_key}: query_sim={query_similarity:.4f}, business_sim={business_similarity:.4f}")
                    
                    # Combined similarity: 70% query relevance, 30% business context relevance
                    # This ensures FAQs relevant to both the query AND the business get higher scores
                    if profile_embedding:
                        combined_similarity = (0.7 * query_similarity) + (0.3 * business_similarity)
                    else:
                        combined_similarity = query_similarity
                    
                    faq_similarities.append({
                        "faq": faq,
                        "similarity": combined_similarity,
                        "query_similarity": query_similarity,
                        "business_similarity": business_similarity,
                        "faq_key": faq_key,
                        "response": response,
                        "category": category
                    })
                
                # Sort by similarity (highest first) and get top 5
                faq_similarities.sort(key=lambda x: x["similarity"], reverse=True)
                top_faqs = faq_similarities[:5]
                
                logger.info(f"✅ Top FAQ similarities:")
                for idx, item in enumerate(top_faqs, 1):
                    if profile_embedding:
                        logger.info(f"   {idx}. {item['faq_key']}: combined={item['similarity']:.4f} (query={item['query_similarity']:.4f}, business={item['business_similarity']:.4f})")
                    else:
                        logger.info(f"   {idx}. {item['faq_key']}: {item['similarity']:.4f}")
                
                # Filter by similarity threshold (only include FAQs with similarity > 0.3)
                # This prevents returning irrelevant results
                threshold = 0.3
                filtered_faqs = [item for item in top_faqs if item["similarity"] >= threshold]
                
                if not filtered_faqs:
                    logger.info(f"⚠️ No FAQs met similarity threshold ({threshold})")
                    state["response"] = "I don't have an exact answer for that yet, but I can help you with features, pricing, or usage. How can I assist you?"
                    return state
                
                faq_list = [item["faq"] for item in filtered_faqs]
                logger.info(f"✅ Selected {len(faq_list)} FAQs above similarity threshold")
                
            except Exception as db_error:
                logger.error(f"❌ Error retrieving FAQs from Supabase: {db_error}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                faq_list = []
            
            # If no FAQs found, return helpful fallback message
            if not faq_list:
                logger.info("No FAQ matches found, returning fallback message")
                state["response"] = "I don't have an exact answer for that yet, but I can help you with features, pricing, or usage. How can I assist you?"
                return state
            
            # Build context from retrieved FAQs
            # Schema: id, faq_key, response, category
            faq_context = ""
            for idx, faq in enumerate(faq_list, 1):
                faq_key = faq.get("faq_key", "")
                response = faq.get("response", "")
                category = faq.get("category", "")
                
                faq_context += f"\n\nFAQ {idx}:\n"
                faq_context += f"Topic: {faq_key}\n"
                if category:
                    faq_context += f"Category: {category}\n"
                faq_context += f"Response: {response}\n"
            
            # Generate response using LLM with FAQ context only (no business context)
            
            system_prompt = """You are Emily, an AI assistant designed to help users understand and use
the product or service you are assisting with.

You are NOT the company and must never speak as the company.

IDENTITY & VOICE
----------------
• Emily is always the doer of the response.
• Any action, offering, pricing, or plan described is done by the US.
• Use first-person plural language such as "we", "our", or "us".
• Speak as a neutral assistant explaining the business's offerings.

GROUNDING & ACCURACY
--------------------
• Use ONLY the information explicitly provided in the context.
• Do NOT rely on general knowledge or assumptions.
• Do NOT invent pricing, plans, features, or capabilities.
• If information is missing or unclear, say so clearly.


RAG USAGE
---------
• Treat retrieved context as the single source of truth.
• Rephrase or summarize the context without changing its meaning.
• Do NOT mention internal systems, databases, or retrieval mechanisms.

PRICING & PLANS
---------------
• Pricing details must come directly from retrieved context.
• If pricing is not provided, state that the exact pricing is not available.
• Never estimate, infer, or imply pricing.

TONE & STYLE
------------
• Clear, professional, and concise
• Helpful but not sales-driven
• No emojis unless explicitly requested

FALLBACK
--------
If the answer is not available in the provided context, respond honestly and
offer help with related, supported information.

."""

            user_prompt = f"""Based on the following FAQ data, answer the user's question.

FAQ Data:
{faq_context}

User Question: {user_query}

Provide a helpful and accurate answer based on the FAQ data above."""

            # Generate response
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]
            
            response = self.llm.invoke(messages)
            answer = response.content.strip()
            
            logger.info(f"Generated FAQ response: {answer[:100]}...")
            state["response"] = answer
            
        except Exception as e:
            logger.error(f"Error in handle_faq: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Fallback response
            state["response"] = "I don't have an exact answer for that yet, but I can help you with features, pricing, or usage. How can I assist you?"
        
        return state
    
    def generate_final_response(self, state: IntentBasedChatbotState) -> IntentBasedChatbotState:
        """Final response formatting node"""
        # Response is already set in handler nodes
        # This node can be used for additional formatting if needed
        return state
    
    def _format_content_response(self, data: Any) -> str:
        """Format content generation response with structured content"""
        if isinstance(data, dict):
            # Check if this is structured content (title, content, hashtags, images)
            # If it has structured content data, return a simple message (card will be displayed separately)
            if "title" in data and "content" in data:
                # Return simple message - the card will be displayed from content_data
                return "Here is the post you requested"
            elif "message" in data:
                return data["message"]
            elif "content" in data:
                return data["content"]
        return str(data)
    
    def _format_analytics_response(self, data: Any) -> str:
        """Format analytics response"""
        if isinstance(data, dict):
            if "message" in data:
                return data["message"]
            elif "summary" in data:
                return data["summary"]
        return str(data)
    
    def _format_leads_response(self, data: Any) -> str:
        """Format leads management response"""
        if isinstance(data, dict):
            if "message" in data:
                return data["message"]
            elif "summary" in data:
                return data["summary"]
        return str(data)
    
    def _format_posting_response(self, data: Any) -> str:
        """Format posting manager response"""
        if isinstance(data, dict):
            if "message" in data:
                return data["message"]
            elif "summary" in data:
                return data["summary"]
        return str(data)
    
    def chat(self, user_id: str, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
        """Main chat interface (deprecated - use get_intent_based_response instead)"""
        try:
            # This method is kept for backward compatibility
            # The actual implementation is now in get_intent_based_response
            initial_state: IntentBasedChatbotState = {
                "user_id": user_id,
                "current_query": query,
                "conversation_history": conversation_history or [],
                "intent_payload": None,
                "partial_payload": None,
                "response": None,
                "context": {},
                "needs_clarification": False,
                "options": None,
                "content_data": None
            }
            
            # Run the graph
            result = self.graph.invoke(initial_state)
            
            return result.get("response", "I apologize, but I couldn't process your request.")
            
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            return "I apologize, but I encountered an error while processing your request."

# Global instance
_intent_based_chatbot = None

# In-memory cache for partial payloads (keyed by user_id)
# In production, this could be stored in Redis or database
_partial_payload_cache: Dict[str, Dict[str, Any]] = {}

def clear_partial_payload_cache(user_id: str) -> None:
    """Clear the partial payload cache for a specific user"""
    _partial_payload_cache.pop(user_id, None)
    logger.info(f"Cleared partial payload cache for user {user_id}")

def get_intent_based_chatbot() -> IntentBasedChatbot:
    """Get or create the intent-based chatbot instance"""
    global _intent_based_chatbot
    if _intent_based_chatbot is None:
        _intent_based_chatbot = IntentBasedChatbot()
    return _intent_based_chatbot

def get_intent_based_response(user_id: str, message: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """Get response from intent-based chatbot"""
    chatbot = get_intent_based_chatbot()
    
    # Retrieve partial payload from cache if exists
    partial_payload = _partial_payload_cache.get(user_id)
    
    # Create state with partial payload
    initial_state: IntentBasedChatbotState = {
        "user_id": user_id,
        "current_query": message,
        "conversation_history": conversation_history or [],
        "intent_payload": None,
        "partial_payload": partial_payload,
        "response": None,
        "context": {},
        "needs_clarification": False,
        "options": None,
        "content_data": None
    }
    
    # Run the graph
    result = chatbot.graph.invoke(initial_state)
    
    # Update cache with new partial payload if clarification is needed
    if result.get("needs_clarification") and result.get("partial_payload"):
        _partial_payload_cache[user_id] = result["partial_payload"]
    elif not result.get("needs_clarification"):
        # Clear cache when request is complete
        _partial_payload_cache.pop(user_id, None)
    
    return {
        "response": result.get("response", "I apologize, but I couldn't process your request."),
        "options": result.get("options"),
        "content_data": result.get("content_data")  # Include structured content data (title, content, hashtags, images)
    }

def get_intent_based_response_stream(user_id: str, message: str, conversation_history: Optional[List[Dict[str, str]]] = None):
    """Stream response from intent-based chatbot"""
    chatbot = get_intent_based_chatbot()
    
    # Retrieve partial payload from cache if exists
    partial_payload = _partial_payload_cache.get(user_id)
    
    # Create state with partial payload
    initial_state: IntentBasedChatbotState = {
        "user_id": user_id,
        "current_query": message,
        "conversation_history": conversation_history or [],
        "intent_payload": None,
        "partial_payload": partial_payload,
        "response": None,
        "context": {},
        "needs_clarification": False,
        "options": None,
        "content_data": None
    }
    
    # Run the graph
    result = chatbot.graph.invoke(initial_state)
    
    # Update cache with new partial payload if clarification is needed
    if result.get("needs_clarification") and result.get("partial_payload"):
        _partial_payload_cache[user_id] = result["partial_payload"]
    elif not result.get("needs_clarification"):
        # Clear cache when request is complete
        _partial_payload_cache.pop(user_id, None)
    
    response = result.get("response", "I apologize, but I couldn't process your request.")
    options = result.get("options")
    content_data = result.get("content_data")
    
    # Debug: Log what's in the result
    logger.info(f"🔍 Stream function - Result keys: {list(result.keys())}")
    logger.info(f"   Result has 'content_data' key: {'content_data' in result}")
    logger.info(f"   content_data value: {content_data}")
    logger.info(f"   content_data type: {type(content_data)}")
    if content_data:
        logger.info(f"   content_data keys: {list(content_data.keys()) if isinstance(content_data, dict) else 'N/A'}")
        logger.info(f"   content_data images: {content_data.get('images') if isinstance(content_data, dict) else 'N/A'}")
    
    # For now, yield the full response in chunks
    # Can be enhanced later for true streaming
    chunk_size = 10
    for i in range(0, len(response), chunk_size):
        yield response[i:i + chunk_size]
    
    # Yield options at the end if they exist
    if options:
        yield f"\n\nOPTIONS:{json.dumps(options)}"
    
    # Yield content_data at the end if it exists
    if content_data:
        logger.info(f"📤 Yielding CONTENT_DATA in stream: {json.dumps(content_data, default=str)[:200]}...")
        logger.info(f"   Images in content_data: {content_data.get('images')}")
        try:
            content_data_json = json.dumps(content_data, default=str)
            yield f"\n\nCONTENT_DATA:{content_data_json}"
            logger.info(f"✅ Successfully yielded CONTENT_DATA")
        except Exception as e:
            logger.error(f"❌ Error serializing content_data: {e}", exc_info=True)
    else:
        logger.warning(f"⚠️ content_data is None or empty - not yielding CONTENT_DATA")
        logger.warning(f"   Result keys: {list(result.keys())}")
        logger.warning(f"   Checking result directly: {result.get('content_data', 'NOT_FOUND')}")


