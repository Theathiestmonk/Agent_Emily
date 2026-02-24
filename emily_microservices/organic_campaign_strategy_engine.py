"""
Organic Campaign Strategy Engine
AI-powered organic campaign planning based on audience maturity and campaign phases.
"""

import os
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, date
from supabase import create_client, Client
import openai

logger = logging.getLogger(__name__)


class OrganicCampaignStrategyEngine:
    """
    Engine for organic campaign planning.
    Focuses on weekly themes, campaign phases (Discovery, Clarity, Proof, Conversion),
    and audience state (Unaware, Curious, Trusting).
    """

    def __init__(
        self,
        supabase: Client,
        openai_client: Optional[openai.OpenAI],
        business_context: Dict[str, Any]
    ):
        """
        Initialize Organic Campaign Strategy Engine
        
        Args:
            supabase: Supabase client
            openai_client: OpenAI client for AI operations
            business_context: Business context from user profile
        """
        self.supabase = supabase
        self.openai_client = openai_client
        self.business_context = business_context

    async def generate_strategy(
        self,
        user_id: str,
        campaign_context: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive organic content strategy.
        
        Args:
            user_id: User ID
            campaign_context: Context including start_date, end_date, goal
            options: Optional generation options
        
        Returns:
            Content strategy dictionary with calendar and logic explanation
        """
        try:
            # 1. Infer Campaign Phase
            phase, days_remaining = self._infer_campaign_phase(campaign_context)
            
            # 2. Infer Audience State
            audience_state = self._infer_audience_state(phase)
            
            # 3. Plan Weekly Intents
            weekly_intents = self._plan_weekly_intents(phase)
            
            # 4. Build Weekly Story (Theme)
            weekly_theme = await self._build_weekly_story(
                phase, audience_state, campaign_context.get("goal", "Brand Awareness")
            )
            
            # 5. Determine Platforms & Frequency
            platforms = self._determine_platforms(user_id, options)
            frequency_data = self._determine_posting_frequency(user_id, options)
            
            # 6. Generate Calendar
            calendar = await self._generate_calendar(
                user_id,
                platforms,
                frequency_data,
                weekly_theme,
                weekly_intents,
                campaign_context.get("start_date")
            )
            
            strategy = {
                "campaign_name": f"Organic Campaign - {phase}",
                "phase": phase,
                "days_remaining": days_remaining,
                "audience_state": audience_state,
                "weekly_theme": weekly_theme,
                "weekly_intents": weekly_intents,
                "platforms": platforms,
                "posting_frequency": frequency_data,
                "calendar": calendar,
                "generated_at": datetime.now().isoformat()
            }
            
            return strategy

        except Exception as e:
            logger.error(f"Error generating organic strategy: {e}")
            import traceback
            traceback.print_exc()
            # Return safe default
            return self._get_default_strategy(user_id, options)

    def _infer_campaign_phase(self, campaign_context: Dict[str, Any]) -> Tuple[str, int]:
        """
        Determine campaign phase based on time until deadline.
        
        Returns:
            Tuple of (Phase Name, Days Remaining)
        """
        try:
            end_date_str = campaign_context.get("end_date")
            if not end_date_str:
                # Default to Discovery if no end date provided
                return "DISCOVERY", 999
            
            # Parse dates
            if isinstance(end_date_str, (date, datetime)):
                 end_date = end_date_str
            else:
                 try:
                     end_date = datetime.fromisoformat(str(end_date_str).replace("Z", "+00:00"))
                 except ValueError:
                     # Try simple format if iso fails
                     end_date = datetime.strptime(str(end_date_str).split("T")[0], "%Y-%m-%d")
            
            # Ensure end_date is datetime for comparison
            if isinstance(end_date, date) and not isinstance(end_date, datetime):
                end_date = datetime.combine(end_date, datetime.min.time())

            today = datetime.now()
            delta = end_date - today
            days_remaining = delta.days
            
            if days_remaining <= 14:
                return "CONVERSION", days_remaining
            elif days_remaining <= 30:
                return "PROOF", days_remaining
            elif days_remaining <= 60:
                return "CLARITY", days_remaining
            else:
                return "DISCOVERY", days_remaining
                
        except Exception as e:
            logger.error(f"Error inferring campaign phase: {e}")
            return "DISCOVERY", 30

    def _infer_audience_state(self, phase: str) -> str:
        """
        Infer audience state based on campaign phase (v1 heuristic).
        """
        mapping = {
            "DISCOVERY": "UNAWARE",
            "CLARITY": "CURIOUS",
            "PROOF": "TRUSTING",
            "CONVERSION": "TRUSTING" # Or "READY" but adhering to spec types
        }
        return mapping.get(phase, "UNAWARE")

    def _plan_weekly_intents(self, phase: str) -> List[str]:
        """
        Determine the mix of intents for the week based on phase.
        
        DISCOVERY -> mostly RELATE + EDUCATE
        CLARITY   -> EDUCATE + TRUST
        PROOF     -> TRUST + DIRECT
        CONVERSION -> DIRECT dominant
        """
        if phase == "DISCOVERY":
            return ["RELATE", "RELATE", "EDUCATE", "RELATE", "EDUCATE", "RELATE", "EDUCATE"]
        elif phase == "CLARITY":
            return ["EDUCATE", "EDUCATE", "TRUST", "EDUCATE", "TRUST", "EDUCATE", "TRUST"]
        elif phase == "PROOF":
            return ["TRUST", "TRUST", "DIRECT", "TRUST", "DIRECT", "TRUST", "DIRECT"]
        elif phase == "CONVERSION":
            return ["DIRECT", "DIRECT", "TRUST", "DIRECT", "DIRECT", "TRUST", "DIRECT"]
        else:
            # Fallback balanced
            return ["RELATE", "EDUCATE", "TRUST", "DIRECT", "RELATE", "EDUCATE", "TRUST"]

    async def _build_weekly_story(self, phase: str, audience_state: str, goal: str) -> str:
        """
        Generate a single weekly theme/belief using AI or fallback logic.
        """
        if self.openai_client:
            try:
                industry = self.business_context.get("industry", "Business")
                if isinstance(industry, list):
                    industry = industry[0]
                
                business_name = self.business_context.get("business_name", "Our Brand")
                
                prompt = (
                    f"Generate a SINGLE, specific weekly content theme (one short sentence) for {business_name} ({industry}).\n"
                    f"Campaign Goal: {goal}\n"
                    f"Current Phase: {phase}\n"
                    f"Audience State: {audience_state}\n\n"
                    f"The theme should be a core belief or perspective that aligns with this phase. "
                    f"Example for Discovery: 'Why [Problem] is misunderstood.'\n"
                    f"Example for Conversion: 'The cost of inaction is higher than you think.'\n\n"
                    f"Return ONLY the theme text."
                )
                
                response = self.openai_client.chat.completions.create(
                    model="gpt-4", # Using robust model for strategy
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=50,
                    temperature=0.7
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"Error generating weekly story: {e}")
        
        # Deterministic fallbacks
        fallbacks = {
            "DISCOVERY": f"Uncovering the hidden truths about {goal}",
            "CLARITY": f"Understanding how our approach to {goal} is different",
            "PROOF": f"Real results: How others achieved {goal}",
            "CONVERSION": f"Start your journey to {goal} today"
        }
        return fallbacks.get(phase, f"Focusing on {goal}")

    def _determine_platforms(
        self,
        user_id: str,
        options: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Determine which platforms to generate content for (Same as ContentStrategyEngine)"""
        if options and options.get("platforms"):
            return options["platforms"]
        
        try:
            response = self.supabase.table("profiles").select(
                "social_media_platforms"
            ).eq("id", user_id).execute()
            
            if response.data and response.data[0].get("social_media_platforms"):
                platforms = response.data[0]["social_media_platforms"]
                if isinstance(platforms, list) and platforms:
                    return platforms
        except Exception as e:
            logger.error(f"Error getting platforms: {e}")
        
        return ["Instagram", "LinkedIn"]

    def _determine_posting_frequency(
        self,
        user_id: str,
        options: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Determine posting frequency (Same as ContentStrategyEngine)"""
        if options and options.get("posts_per_platform"):
            return {
                "posts_per_platform": options["posts_per_platform"],
                "frequency": "custom"
            }
        
        try:
            response = self.supabase.table("profiles").select(
                "posting_frequency"
            ).eq("id", user_id).execute()
            
            if response.data and response.data[0].get("posting_frequency"):
                frequency = response.data[0]["posting_frequency"]
                frequency_map = {
                    "daily": 7,
                    "5-6 times per week": 6,
                    "3-4 times per week": 4,
                    "1-2 times per week": 2,
                    "few times per month": 1
                }
                posts = frequency_map.get(frequency, 5) # Default to 5 for organic
                return {
                    "posts_per_platform": posts,
                    "frequency": frequency
                }
        except Exception as e:
            logger.error(f"Error getting frequency: {e}")
        
        return {
            "posts_per_platform": 5,
            "frequency": "5-6 times per week"
        }

    def _get_optimal_posting_times(self, user_id: str, weekday: int) -> List[str]:
        """Get optimal posting times (Same as ContentStrategyEngine)"""
        default_times = ["09:00:00", "12:00:00", "17:00:00", "20:00:00"]
        if weekday >= 5:
            return ["10:00:00", "13:00:00", "18:00:00"]
        return default_times

    async def _generate_calendar(
        self,
        user_id: str,
        platforms: List[str],
        frequency_data: Dict[str, Any],
        weekly_theme: str,
        weekly_intents: List[str],
        start_date: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate the actual calendar items aligning intents to days.
        """
        calendar = []
        
        # Determine start date
        if start_date:
             if isinstance(start_date, str):
                 try:
                     current_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                 except:
                     current_date = datetime.now()
             else:
                 current_date = start_date
        else:
            current_date = datetime.now()

        posts_per_platform = frequency_data.get("posts_per_platform", 5)
        
        # If we have 5 posts but 7 intents, trim intents. If 7 posts but 5 intents, loop.
        # Ideally, we map 1 post per day for the number of posts_per_platform
        
        # Filter intents to match post count length
        active_intents = weekly_intents[:posts_per_platform]
        if len(active_intents) < posts_per_platform:
            # Extend if needed
             while len(active_intents) < posts_per_platform:
                 active_intents.append(active_intents[-1])

        for i in range(posts_per_platform):
            day_offset = i  # Simple 1 post per day logic for v1
            post_date = current_date + timedelta(days=day_offset)
            
            intent = active_intents[i]
            
            # Get times
            times = self._get_optimal_posting_times(user_id, post_date.weekday())
            post_time = times[0] # Pick first optimal time
            
            # Generate guidance text
            guidance = self._get_intent_guidance(intent, weekly_theme)
            
            for platform in platforms:
                calendar.append({
                    "date": post_date.date().isoformat(),
                    "time": post_time,
                    "platform": platform,
                    "intent": intent,
                    "weekly_theme": weekly_theme,
                    "guidance": guidance,
                    "content_type": "post" # Default
                })
        
        return calendar

    def _get_intent_guidance(self, intent: str, theme: str) -> str:
        """Human-readable guidance for the intent."""
        if intent == "RELATE":
            return f"Share a story or observation about '{theme}' that shows you understand the audience's situation. No selling."
        elif intent == "EDUCATE":
            return f"Teach something valuable related to '{theme}'. Give a 'aha' moment."
        elif intent == "TRUST":
            return f"Show proof (review, case study, or expertise display) that validates your authority on '{theme}'."
        elif intent == "DIRECT":
            return f"Make a clear offer or call-to-action related to '{theme}'."
        return f"Post about {theme}"

    def _get_default_strategy(self, user_id: str, options: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Return safe default strategy on error."""
        return {
            "campaign_name": "Default Organic Plan",
            "phase": "DISCOVERY",
            "days_remaining": 30,
            "audience_state": "UNAWARE",
            "weekly_theme": "Building Consistency",
            "weekly_intents": ["RELATE", "EDUCATE", "RELATE", "EDUCATE", "RELATE"],
            "platforms": ["Instagram"],
            "posting_frequency": {"posts_per_platform": 5, "frequency": "daily"},
            "calendar": [],
            "error": "Strategy generation failed, returned default."
        }
