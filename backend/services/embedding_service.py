"""
Embedding Service for User Profile Data
Generates embeddings using sentence-transformers to reduce token costs in generation
"""

import logging
from typing import Dict, Any, List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings from user profile data"""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        """
        Initialize the embedding service with the specified model
        
        Args:
            model_name: Hugging Face model name for embeddings
        """
        try:
            logger.info(f"Loading embedding model: {model_name}")
            self.model = SentenceTransformer(model_name)
            self.model_name = model_name
            self.embedding_dim = 384  # Dimension for all-MiniLM-L6-v2
            logger.info(f"Successfully loaded embedding model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def _profile_to_text(self, profile_data: Dict[str, Any]) -> str:
        """
        Convert profile data dictionary to a single text string for embedding
        
        Args:
            profile_data: User profile dictionary
            
        Returns:
            Combined text string of all relevant profile fields
        """
        text_parts = []
        
        # Business Information
        if profile_data.get('business_name'):
            text_parts.append(f"Business name: {profile_data['business_name']}")
        
        if profile_data.get('business_description'):
            text_parts.append(f"Business description: {profile_data['business_description']}")
        
        if profile_data.get('business_type'):
            business_types = profile_data['business_type']
            if isinstance(business_types, list):
                text_parts.append(f"Business type: {', '.join(business_types)}")
            else:
                text_parts.append(f"Business type: {business_types}")
        
        if profile_data.get('business_type_other'):
            text_parts.append(f"Business type other: {profile_data['business_type_other']}")
        
        if profile_data.get('industry'):
            industries = profile_data['industry']
            if isinstance(industries, list):
                text_parts.append(f"Industry: {', '.join(industries)}")
            else:
                text_parts.append(f"Industry: {industries}")
        
        if profile_data.get('industry_other'):
            text_parts.append(f"Industry other: {profile_data['industry_other']}")
        
        if profile_data.get('unique_value_proposition'):
            text_parts.append(f"Unique value proposition: {profile_data['unique_value_proposition']}")
        
        # Target Audience
        if profile_data.get('target_audience'):
            audiences = profile_data['target_audience']
            if isinstance(audiences, list):
                text_parts.append(f"Target audience: {', '.join(audiences)}")
            else:
                text_parts.append(f"Target audience: {audiences}")
        
        if profile_data.get('target_audience_age_groups'):
            age_groups = profile_data['target_audience_age_groups']
            if isinstance(age_groups, list):
                text_parts.append(f"Target audience age groups: {', '.join(age_groups)}")
        
        if profile_data.get('target_audience_life_stages'):
            life_stages = profile_data['target_audience_life_stages']
            if isinstance(life_stages, list):
                text_parts.append(f"Target audience life stages: {', '.join(life_stages)}")
        
        if profile_data.get('target_audience_professional_types'):
            professional_types = profile_data['target_audience_professional_types']
            if isinstance(professional_types, list):
                text_parts.append(f"Target audience professional types: {', '.join(professional_types)}")
        
        if profile_data.get('target_audience_lifestyle_interests'):
            lifestyle_interests = profile_data['target_audience_lifestyle_interests']
            if isinstance(lifestyle_interests, list):
                text_parts.append(f"Target audience lifestyle interests: {', '.join(lifestyle_interests)}")
        
        if profile_data.get('target_audience_buyer_behavior'):
            buyer_behavior = profile_data['target_audience_buyer_behavior']
            if isinstance(buyer_behavior, list):
                text_parts.append(f"Target audience buyer behavior: {', '.join(buyer_behavior)}")
        
        # Brand Information
        if profile_data.get('brand_voice'):
            text_parts.append(f"Brand voice: {profile_data['brand_voice']}")
        
        if profile_data.get('brand_tone'):
            text_parts.append(f"Brand tone: {profile_data['brand_tone']}")
        
        # Platform-specific tones
        if profile_data.get('platform_tone_instagram'):
            tones = profile_data['platform_tone_instagram']
            if isinstance(tones, list):
                text_parts.append(f"Instagram tone: {', '.join(tones)}")
        
        if profile_data.get('platform_tone_facebook'):
            tones = profile_data['platform_tone_facebook']
            if isinstance(tones, list):
                text_parts.append(f"Facebook tone: {', '.join(tones)}")
        
        if profile_data.get('platform_tone_linkedin'):
            tones = profile_data['platform_tone_linkedin']
            if isinstance(tones, list):
                text_parts.append(f"LinkedIn tone: {', '.join(tones)}")
        
        if profile_data.get('platform_tone_youtube'):
            tones = profile_data['platform_tone_youtube']
            if isinstance(tones, list):
                text_parts.append(f"YouTube tone: {', '.join(tones)}")
        
        if profile_data.get('platform_tone_x'):
            tones = profile_data['platform_tone_x']
            if isinstance(tones, list):
                text_parts.append(f"X/Twitter tone: {', '.join(tones)}")
        
        # Goals and Strategy
        if profile_data.get('primary_goals'):
            goals = profile_data['primary_goals']
            if isinstance(goals, list):
                text_parts.append(f"Primary goals: {', '.join(goals)}")
            else:
                text_parts.append(f"Primary goals: {goals}")
        
        if profile_data.get('goal_other'):
            text_parts.append(f"Goal other: {profile_data['goal_other']}")
        
        if profile_data.get('content_themes'):
            themes = profile_data['content_themes']
            if isinstance(themes, list):
                text_parts.append(f"Content themes: {', '.join(themes)}")
            else:
                text_parts.append(f"Content themes: {themes}")
        
        if profile_data.get('content_theme_other'):
            text_parts.append(f"Content theme other: {profile_data['content_theme_other']}")
        
        if profile_data.get('preferred_content_types'):
            content_types = profile_data['preferred_content_types']
            if isinstance(content_types, list):
                text_parts.append(f"Preferred content types: {', '.join(content_types)}")
            else:
                text_parts.append(f"Preferred content types: {content_types}")
        
        if profile_data.get('content_type_other'):
            text_parts.append(f"Content type other: {profile_data['content_type_other']}")
        
        # Products/Services
        if profile_data.get('products_or_services'):
            text_parts.append(f"Products or services: {profile_data['products_or_services']}")
        
        # Market Information
        if profile_data.get('market_position'):
            text_parts.append(f"Market position: {profile_data['market_position']}")
        
        if profile_data.get('main_competitors'):
            text_parts.append(f"Main competitors: {profile_data['main_competitors']}")
        
        # Customer Information
        if profile_data.get('customer_pain_points'):
            text_parts.append(f"Customer pain points: {profile_data['customer_pain_points']}")
        
        if profile_data.get('typical_customer_journey'):
            text_parts.append(f"Typical customer journey: {profile_data['typical_customer_journey']}")
        
        # Performance
        if profile_data.get('successful_campaigns'):
            text_parts.append(f"Successful campaigns: {profile_data['successful_campaigns']}")
        
        if profile_data.get('successful_content_url'):
            text_parts.append(f"Successful content URL: {profile_data['successful_content_url']}")
        
        if profile_data.get('hashtags_that_work_well'):
            text_parts.append(f"Hashtags that work well: {profile_data['hashtags_that_work_well']}")
        
        if profile_data.get('top_performing_content_types'):
            top_types = profile_data['top_performing_content_types']
            if isinstance(top_types, list):
                text_parts.append(f"Top performing content types: {', '.join(top_types)}")
        
        if profile_data.get('top_performing_content_type_other'):
            text_parts.append(f"Top performing content type other: {profile_data['top_performing_content_type_other']}")
        
        # Social Media Platforms
        if profile_data.get('social_media_platforms'):
            platforms = profile_data['social_media_platforms']
            if isinstance(platforms, list):
                text_parts.append(f"Social media platforms: {', '.join(platforms)}")
        
        if profile_data.get('social_platform_other'):
            text_parts.append(f"Social platform other: {profile_data['social_platform_other']}")
        
        # Posting and Automation
        if profile_data.get('posting_frequency'):
            text_parts.append(f"Posting frequency: {profile_data['posting_frequency']}")
        
        if profile_data.get('best_time_to_post'):
            times = profile_data['best_time_to_post']
            if isinstance(times, list):
                text_parts.append(f"Best time to post: {', '.join(times)}")
        
        if profile_data.get('posting_time_other'):
            text_parts.append(f"Posting time other: {profile_data['posting_time_other']}")
        
        if profile_data.get('automation_level'):
            text_parts.append(f"Automation level: {profile_data['automation_level']}")
        
        # Current Presence
        if profile_data.get('current_presence'):
            presence = profile_data['current_presence']
            if isinstance(presence, list):
                text_parts.append(f"Current presence: {', '.join(presence)}")
        
        if profile_data.get('current_presence_other'):
            text_parts.append(f"Current presence other: {profile_data['current_presence_other']}")
        
        # Metrics
        if profile_data.get('key_metrics_to_track'):
            metrics = profile_data['key_metrics_to_track']
            if isinstance(metrics, list):
                text_parts.append(f"Key metrics to track: {', '.join(metrics)}")
        
        if profile_data.get('metric_other'):
            text_parts.append(f"Metric other: {profile_data['metric_other']}")
        
        # Combine all parts
        combined_text = " ".join(text_parts)
        return combined_text
    
    def generate_embedding(self, profile_data: Dict[str, Any]) -> List[float]:
        """
        Generate embedding vector from profile data
        
        Args:
            profile_data: User profile dictionary
            
        Returns:
            List of floats representing the embedding vector (384 dimensions)
        """
        try:
            # Convert profile to text
            profile_text = self._profile_to_text(profile_data)
            
            if not profile_text.strip():
                logger.warning("Empty profile text, returning zero vector")
                # Return zero vector with model's embedding dimension
                return [0.0] * self.embedding_dim
            
            # Generate embedding
            embedding = self.model.encode(profile_text, normalize_embeddings=True)
            
            # Convert numpy array to list
            embedding_list = embedding.tolist()
            
            logger.info(f"Generated embedding of dimension {len(embedding_list)} for profile")
            return embedding_list
            
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            # Return zero vector as fallback
            return [0.0] * self.embedding_dim
    
    def generate_embedding_from_text(self, text: str) -> List[float]:
        """
        Generate embedding directly from text string
        
        Args:
            text: Input text string
            
        Returns:
            List of floats representing the embedding vector (384 dimensions)
        """
        try:
            if not text.strip():
                return [0.0] * self.embedding_dim
            
            embedding = self.model.encode(text, normalize_embeddings=True)
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating embedding from text: {e}")
            return [0.0] * self.embedding_dim

