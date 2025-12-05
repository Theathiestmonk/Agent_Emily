"""
Optional Helper Utilities for Agents to Use Embeddings
Agents can optionally import and use these functions to reduce token costs
"""

import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


def get_profile_context_with_embedding(profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get profile context, preferring embedding if available, falling back to full context
    
    Args:
        profile_data: User profile dictionary from database
        
    Returns:
        Dictionary with either embedding-based or full context
    """
    # Check if embedding exists
    if profile_data.get("profile_embedding"):
        # Use embedding-based context (much smaller)
        return {
            "use_embedding": True,
            "profile_embedding": profile_data.get("profile_embedding"),
            # Keep minimal essential fields for reference
            "business_name": profile_data.get("business_name", ""),
            "brand_voice": profile_data.get("brand_voice", ""),
            "brand_tone": profile_data.get("brand_tone", ""),
            "social_media_platforms": profile_data.get("social_media_platforms", [])
        }
    else:
        # Fallback to full context if embedding not available
        logger.debug("No embedding found, using full profile context")
        return {
            "use_embedding": False,
            "business_name": profile_data.get("business_name", ""),
            "business_type": profile_data.get("business_type", []),
            "industry": profile_data.get("industry", []),
            "business_description": profile_data.get("business_description", ""),
            "target_audience": profile_data.get("target_audience", []),
            "unique_value_proposition": profile_data.get("unique_value_proposition", ""),
            "brand_voice": profile_data.get("brand_voice", ""),
            "brand_tone": profile_data.get("brand_tone", ""),
            "social_media_platforms": profile_data.get("social_media_platforms", []),
            "primary_goals": profile_data.get("primary_goals", []),
            "content_themes": profile_data.get("content_themes", []),
            "monthly_budget_range": profile_data.get("monthly_budget_range", ""),
            "automation_level": profile_data.get("automation_level", ""),
            "posting_frequency": profile_data.get("posting_frequency", "daily"),
            "products_or_services": profile_data.get("products_or_services", ""),
            "customer_pain_points": profile_data.get("customer_pain_points", ""),
            "typical_customer_journey": profile_data.get("typical_customer_journey", "")
        }


def build_embedding_prompt(
    context: Dict[str, Any],
    task_description: str,
    additional_requirements: Optional[str] = None
) -> str:
    """
    Build a prompt for content generation using embedding if available
    
    Args:
        context: Context dictionary from get_profile_context_with_embedding()
        task_description: Description of the generation task
        additional_requirements: Optional additional requirements for the task
        
    Returns:
        Formatted prompt string
    """
    if context.get("use_embedding"):
        # Use embedding-based prompt (much shorter, reduces tokens)
        prompt = f"""Generate content based on the user's profile embedding.

Profile Embedding: {context.get('profile_embedding')}
Business Name: {context.get('business_name', '')}
Brand Voice: {context.get('brand_voice', '')}
Brand Tone: {context.get('brand_tone', '')}
Platforms: {', '.join(context.get('social_media_platforms', []))}

Task: {task_description}
"""
        if additional_requirements:
            prompt += f"\nAdditional Requirements: {additional_requirements}\n"
        
        prompt += """
Use the embedding to understand the user's business context, target audience, 
industry, goals, and content preferences. The embedding contains semantic 
information about their business profile. Generate content that aligns with 
their brand voice and tone.
"""
    else:
        # Fallback to full context prompt
        prompt = f"""Generate content with the following business context:

Business Name: {context.get('business_name', '')}
Business Type: {', '.join(context.get('business_type', [])) if isinstance(context.get('business_type'), list) else context.get('business_type', '')}
Industry: {', '.join(context.get('industry', [])) if isinstance(context.get('industry'), list) else context.get('industry', '')}
Business Description: {context.get('business_description', '')}
Target Audience: {', '.join(context.get('target_audience', [])) if isinstance(context.get('target_audience'), list) else context.get('target_audience', '')}
Unique Value Proposition: {context.get('unique_value_proposition', '')}
Brand Voice: {context.get('brand_voice', '')}
Brand Tone: {context.get('brand_tone', '')}
Social Media Platforms: {', '.join(context.get('social_media_platforms', []))}
Primary Goals: {', '.join(context.get('primary_goals', [])) if isinstance(context.get('primary_goals'), list) else context.get('primary_goals', '')}
Content Themes: {', '.join(context.get('content_themes', [])) if isinstance(context.get('content_themes'), list) else context.get('content_themes', '')}
Posting Frequency: {context.get('posting_frequency', 'daily')}
Products/Services: {context.get('products_or_services', '')}
Customer Pain Points: {context.get('customer_pain_points', '')}
Typical Customer Journey: {context.get('typical_customer_journey', '')}

Task: {task_description}
"""
        if additional_requirements:
            prompt += f"\nAdditional Requirements: {additional_requirements}\n"
    
    return prompt


def format_embedding_for_prompt(embedding: List[float], max_length: int = 100) -> str:
    """
    Format embedding vector for inclusion in prompt (truncated for readability)
    
    Args:
        embedding: List of float values representing the embedding
        max_length: Maximum number of values to show in the string representation
        
    Returns:
        String representation of the embedding
    """
    if not embedding:
        return "[]"
    
    if len(embedding) <= max_length:
        return str(embedding)
    else:
        # Show first and last few values
        preview = embedding[:max_length//2] + ["..."] + embedding[-max_length//2:]
        return f"[{', '.join(map(str, preview))}] (total: {len(embedding)} dimensions)"




