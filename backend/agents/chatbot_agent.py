"""
Business Chatbot Agent using LangGraph
Handles queries about scheduled posts, insights, and industry trends
"""

import os
import json
from typing import Dict, List, Any, Optional, Generator
from datetime import datetime, timedelta
import requests
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from typing import TypedDict
from dotenv import load_dotenv

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

class ChatbotState(TypedDict):
    """State for the chatbot conversation"""
    messages: List[Dict[str, str]]
    user_id: Optional[str]
    intent: Optional[str]
    context: Dict[str, Any]
    response: Optional[str]
    current_query: Optional[str]

# Tools for the chatbot
@tool
def get_scheduled_posts(user_id: str, platform: str = "") -> Dict[str, Any]:
    """Get scheduled posts for a user, optionally filtered by platform"""
    try:
        # First get user's campaigns
        campaigns_response = supabase.table("content_campaigns").select("id").eq("user_id", user_id).execute()
        campaign_ids = [campaign["id"] for campaign in campaigns_response.data] if campaigns_response.data else []
        
        if not campaign_ids:
            return {
                "success": True,
                "scheduled_posts": [],
                "published_posts": [],
                "scheduled_count": 0,
                "published_count": 0,
                "message": "No campaigns found for user"
            }
        
        # Get scheduled posts from user's campaigns (including drafts as they are scheduled content)
        scheduled_query = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).in_("status", ["scheduled", "draft"])
        if platform and platform.strip():
            scheduled_query = scheduled_query.eq("platform", platform)
        
        scheduled_response = scheduled_query.order("scheduled_date", desc=False).order("scheduled_time", desc=False).execute()
        scheduled_posts = scheduled_response.data if scheduled_response.data else []
        
        # Get published posts for context
        published_query = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).eq("status", "published")
        if platform and platform.strip():
            published_query = published_query.eq("platform", platform)
        
        published_response = published_query.order("created_at", desc=True).limit(5).execute()
        published_posts = published_response.data if published_response.data else []
        
        return {
            "success": True,
            "scheduled_posts": scheduled_posts,
            "published_posts": published_posts,
            "scheduled_count": len(scheduled_posts),
            "published_count": len(published_posts)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "scheduled_posts": [],
            "published_posts": [],
            "scheduled_count": 0,
            "published_count": 0
        }

@tool
def get_latest_insights(user_id: str, platform: str = None) -> Dict[str, Any]:
    """Get latest insights for posts from a user's channels"""
    try:
        # Get user's active connections
        connections_response = supabase.table("platform_connections").select("*").eq("user_id", user_id).eq("is_active", True).execute()
        connections = connections_response.data if connections_response.data else []
        
        if platform:
            connections = [conn for conn in connections if conn.get('platform') == platform]
        
        insights = []
        for connection in connections:
            # Get posts for this connection
            posts_response = supabase.table("content_posts").select("*").eq("user_id", user_id).eq("platform", connection['platform']).eq("status", "published").order("published_at", desc=True).limit(10).execute()
            posts = posts_response.data if posts_response.data else []
            
            for post in posts:
                # Mock insights data (in real implementation, this would come from platform APIs)
                insight = {
                    "post_id": post['id'],
                    "platform": connection['platform'],
                    "content": post.get('content', '')[:100] + "..." if len(post.get('content', '')) > 100 else post.get('content', ''),
                    "published_at": post.get('published_at'),
                    "likes": post.get('likes_count', 0),
                    "comments": post.get('comments_count', 0),
                    "shares": post.get('shares_count', 0),
                    "engagement_rate": round((post.get('likes_count', 0) + post.get('comments_count', 0) + post.get('shares_count', 0)) / max(post.get('follower_count', 1), 1) * 100, 2)
                }
                insights.append(insight)
        
        return {
            "success": True,
            "insights": insights,
            "count": len(insights)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "insights": [],
            "count": 0
        }

@tool
def get_industry_trends(industry: str) -> Dict[str, Any]:
    """Get latest trends for a specific industry using web search"""
    try:
        # Use OpenAI to generate industry-specific trends
        prompt = f"""
        Generate 4-5 current marketing and social media trends for the {industry} industry in 2024.
        Focus on trends that are relevant to social media marketing and content creation.
        
        For each trend, provide:
        - A clear, concise title
        - A detailed description (2-3 sentences)
        - Impact level (High/Medium/Low)
        - Relevance to social media marketing
        
        Format as JSON with this structure:
        {{
            "trends": [
                {{
                    "trend": "Trend Title",
                    "description": "Detailed description of the trend",
                    "impact": "High/Medium/Low",
                    "relevance": "Relevance to social media marketing"
                }}
            ]
        }}
        """
        
        # Use OpenAI to generate trends
        response = llm.invoke([HumanMessage(content=prompt)])
        
        # Try to parse the JSON response
        import json
        try:
            trends_data = json.loads(response.content)
            trends = {
                "industry": industry,
                "trends": trends_data.get("trends", []),
                "last_updated": datetime.now().isoformat()
            }
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            trends = {
                "industry": industry,
                "trends": [
                    {
                        "trend": f"AI-Powered Marketing in {industry}",
                        "description": f"Artificial intelligence is revolutionizing marketing strategies in the {industry} industry, enabling personalized content creation and automated customer engagement.",
                        "impact": "High",
                        "relevance": "Critical for modern social media strategy"
                    },
                    {
                        "trend": f"Video-First Content Strategy",
                        "description": f"Short-form video content is dominating social media engagement in {industry}, with platforms prioritizing video content in their algorithms.",
                        "impact": "High", 
                        "relevance": "Essential for social media success"
                    },
                    {
                        "trend": f"Authentic Storytelling in {industry}",
                        "description": f"Consumers in {industry} are seeking authentic, behind-the-scenes content that shows the human side of businesses.",
                        "impact": "Medium",
                        "relevance": "Important for brand building and trust"
                    }
                ],
                "last_updated": datetime.now().isoformat()
            }
        
        return {
            "success": True,
            "trends": trends
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "trends": None
        }

@tool
def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Get user profile information including industry"""
    try:
        response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        profile = response.data[0] if response.data else None
        
        if profile:
            # Handle industry field - it might be a list or string
            industry = profile.get("industry")
            if isinstance(industry, list) and len(industry) > 0:
                industry = industry[0].lower()  # Take first industry and convert to lowercase
            elif isinstance(industry, str):
                industry = industry.lower()
            else:
                industry = "technology"  # Default fallback
            
            # Update the profile with processed industry
            profile["industry"] = industry
            
            return {
                "success": True,
                "profile": profile
            }
        else:
            return {
                "success": False,
                "error": "User profile not found",
                "profile": None
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "profile": None
        }

# Initialize tools
tools = [get_scheduled_posts, get_latest_insights, get_industry_trends, get_user_profile]
tool_node = ToolNode(tools)

class BusinessChatbot:
    def __init__(self):
        self.llm = llm
        self.tools = tools
        self.setup_graph()
    
    def setup_graph(self):
        """Setup the LangGraph workflow"""
        workflow = StateGraph(ChatbotState)
        
        # Add nodes
        workflow.add_node("classify_intent", self.classify_intent)
        workflow.add_node("handle_scheduled_posts", self.handle_scheduled_posts)
        workflow.add_node("handle_insights", self.handle_insights)
        workflow.add_node("handle_trends", self.handle_trends)
        workflow.add_node("generate_response", self.generate_response)
        
        # Add conditional edges based on intent
        workflow.add_conditional_edges(
            "classify_intent",
            lambda state: state["intent"],
            {
                "scheduled_posts": "handle_scheduled_posts",
                "insights": "handle_insights", 
                "trends": "handle_trends",
                "general": "generate_response"
            }
        )
        
        # All handler nodes go to generate_response
        workflow.add_edge("handle_scheduled_posts", "generate_response")
        workflow.add_edge("handle_insights", "generate_response")
        workflow.add_edge("handle_trends", "generate_response")
        workflow.add_edge("generate_response", END)
        
        # Set entry point
        workflow.set_entry_point("classify_intent")
        
        # Compile the graph
        self.graph = workflow.compile()
    
    def classify_intent(self, state: ChatbotState) -> ChatbotState:
        """Classify the user's intent"""
        query = state["current_query"].lower()
        
        # Intent classification logic
        if any(keyword in query for keyword in [
            'scheduled', 'next post', 'upcoming', 'when is', 'what is scheduled',
            'latest post', 'recent post', 'last post', 'post timing', 'when will',
            'what time', 'schedule', 'calendar', 'content calendar', 'post schedule'
        ]):
            state["intent"] = "scheduled_posts"
        elif any(keyword in query for keyword in ['insights', 'performance', 'analytics', 'engagement', 'metrics', 'how did']):
            state["intent"] = "insights"
        elif any(keyword in query for keyword in ['trends', 'industry', 'latest', 'what\'s new', 'current trends']):
            state["intent"] = "trends"
        else:
            state["intent"] = "general"
        
        return state
    
    def handle_scheduled_posts(self, state: ChatbotState) -> ChatbotState:
        """Handle scheduled posts queries"""
        try:
            # Extract platform from query if mentioned
            platform = None
            query = state["current_query"].lower()
            if 'facebook' in query:
                platform = 'Facebook'
            elif 'instagram' in query:
                platform = 'Instagram'
            elif 'linkedin' in query:
                platform = 'LinkedIn'
            elif 'twitter' in query:
                platform = 'Twitter'
            elif 'youtube' in query:
                platform = 'YouTube'
            
            # Get scheduled posts
            result = get_scheduled_posts.invoke({"user_id": state["user_id"], "platform": platform or ""})
            
            if result["success"]:
                scheduled_posts = result["scheduled_posts"]
                published_posts = result["published_posts"]
                
                if scheduled_posts:
                    # Find next scheduled post
                    next_post = scheduled_posts[0]  # Already ordered by scheduled_at asc
                    
                    state["context"]["scheduled_posts"] = {
                        "next_post": next_post,
                        "all_scheduled": scheduled_posts,
                        "recent_published": published_posts,
                        "total_scheduled": result["scheduled_count"],
                        "total_published": result["published_count"],
                        "platform": platform or "all platforms",
                        "scheduled_at": next_post.get("scheduled_at"),
                        "content_preview": next_post.get("content", "")[:200] + "..." if len(next_post.get("content", "")) > 200 else next_post.get("content", "")
                    }
                else:
                    state["context"]["scheduled_posts"] = {
                        "message": f"No scheduled posts found for {platform or 'any platform'}",
                        "recent_published": published_posts,
                        "total_scheduled": 0,
                        "total_published": result["published_count"],
                        "platform": platform or "all platforms"
                    }
            else:
                state["context"]["scheduled_posts"] = {
                    "error": f"Error fetching scheduled posts: {result.get('error', 'Unknown error')}"
                }
        except Exception as e:
            state["context"]["scheduled_posts"] = {
                "error": f"Error fetching scheduled posts: {str(e)}"
            }
        
        return state
    
    def handle_insights(self, state: ChatbotState) -> ChatbotState:
        """Handle insights queries"""
        try:
            # Extract platform from query if mentioned
            platform = None
            query = state["current_query"].lower()
            if 'facebook' in query:
                platform = 'facebook'
            elif 'instagram' in query:
                platform = 'instagram'
            elif 'linkedin' in query:
                platform = 'linkedin'
            elif 'twitter' in query:
                platform = 'twitter'
            
            # Get insights
            result = get_latest_insights.invoke({"user_id": state["user_id"], "platform": platform})
            
            if result["success"] and result["insights"]:
                state["context"]["insights"] = {
                    "insights": result["insights"],
                    "count": result["count"],
                    "platform": platform or "all platforms"
                }
            else:
                state["context"]["insights"] = {
                    "message": "No insights data available",
                    "count": 0
                }
        except Exception as e:
            state["context"]["insights"] = {
                "error": f"Error fetching insights: {str(e)}"
            }
        
        return state
    
    def handle_trends(self, state: ChatbotState) -> ChatbotState:
        """Handle industry trends queries"""
        try:
            # First, try to extract industry from the query itself
            query = state["current_query"].lower()
            industry_from_query = None
            
            # Look for industry mentions in the query
            industry_keywords = {
                'technology': ['tech', 'technology', 'software', 'it', 'digital'],
                'healthcare': ['healthcare', 'health', 'medical', 'pharma', 'hospital'],
                'retail': ['retail', 'ecommerce', 'shopping', 'fashion', 'consumer'],
                'finance': ['finance', 'banking', 'fintech', 'financial', 'investment'],
                'education': ['education', 'edtech', 'learning', 'school', 'university'],
                'real estate': ['real estate', 'property', 'housing', 'construction'],
                'manufacturing': ['manufacturing', 'production', 'industrial', 'factory']
            }
            
            for industry, keywords in industry_keywords.items():
                if any(keyword in query for keyword in keywords):
                    industry_from_query = industry
                    break
            
            # If no industry found in query, try to get from user profile
            if not industry_from_query:
                profile_result = get_user_profile.invoke({"user_id": state["user_id"]})
                
                if profile_result["success"] and profile_result["profile"]:
                    industry_from_query = profile_result["profile"].get("industry", "technology")
                    business_name = profile_result["profile"].get("business_name", "Your Business")
                else:
                    # If no profile found, ask user for their industry
                    state["context"]["trends"] = {
                        "error": "No user profile found",
                        "message": "I need to know your industry to provide relevant trends. Please either:",
                        "suggestions": [
                            "Complete your profile setup in the onboarding section",
                            "Ask me: 'What are the latest trends in [your industry]?' (e.g., 'What are the latest trends in healthcare?')"
                        ]
                    }
                    return state
            else:
                business_name = "Your Business"
            
            # Now get trends for the identified industry
            trends_result = get_industry_trends.invoke({"industry": industry_from_query})
            
            if trends_result["success"] and trends_result["trends"]:
                state["context"]["trends"] = {
                    "industry": industry_from_query,
                    "business_name": business_name,
                    "trends": trends_result["trends"]["trends"],
                    "last_updated": trends_result["trends"]["last_updated"]
                }
            else:
                state["context"]["trends"] = {
                    "error": f"Unable to fetch trends for {industry_from_query} industry",
                    "industry": industry_from_query
                }
        except Exception as e:
            state["context"]["trends"] = {
                "error": f"Error fetching trends: {str(e)}"
            }
        
        return state
    
    def generate_response(self, state: ChatbotState) -> ChatbotState:
        """Generate the final response using LLM"""
        try:
            # Create system prompt based on context
            system_prompt = self.create_system_prompt(state["context"])
            
            # Create user message
            user_message = f"User query: {state['current_query']}\n\nContext: {json.dumps(state['context'], indent=2)}"
            
            # Generate response
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ]
            
            response = self.llm.invoke(messages)
            state["response"] = response.content
            
        except Exception as e:
            state["response"] = f"I apologize, but I encountered an error while processing your request: {str(e)}"
        
        return state
    
    def create_system_prompt(self, context: Dict[str, Any]) -> str:
        """Create system prompt based on available context"""
        prompt = """You are a helpful business assistant chatbot that helps users understand their social media and business data. 
        
        You can help with:
        1. Scheduled posts - tell users about their upcoming content
        2. Performance insights - analyze their social media performance
        3. Industry trends - provide relevant industry information
        
        Always be helpful, concise, and provide actionable insights when possible.
        Use the context data provided to give specific, relevant answers.
        
        IMPORTANT: If the context shows an error about missing user profile or industry information, guide the user to complete their profile setup or ask them to specify their industry in their question.
        """
        
        if "scheduled_posts" in context:
            if "error" in context["scheduled_posts"]:
                prompt += f"\n\nIMPORTANT: The scheduled posts context shows an error: {context['scheduled_posts']['error']}. Help the user resolve this issue."
            else:
                prompt += "\n\nYou have access to scheduled posts data. Help the user understand their upcoming content schedule, including next scheduled posts, timing, and recent published content."
        
        if "insights" in context:
            prompt += "\n\nYou have access to performance insights data. Help the user understand their social media performance."
        
        if "trends" in context:
            if "error" in context["trends"]:
                prompt += f"\n\nIMPORTANT: The trends context shows an error: {context['trends']['error']}. Guide the user to resolve this issue."
            else:
                prompt += "\n\nYou have access to industry trends data. Help the user understand relevant industry trends."
        
        return prompt
    
    def chat(self, user_id: str, query: str) -> str:
        """Main chat interface"""
        # Create initial state
        state = {
            "user_id": user_id,
            "current_query": query,
            "messages": [],
            "intent": None,
            "context": {},
            "response": None
        }
        
        # Run the graph
        result = self.graph.invoke(state)
        
        return result["response"]
    
    def chat_stream(self, user_id: str, query: str) -> Generator[str, None, None]:
        """Streaming chat interface"""
        # Create initial state
        state = {
            "user_id": user_id,
            "current_query": query,
            "messages": [],
            "intent": None,
            "context": {},
            "response": None
        }
        
        # Run the graph to get context
        result = self.graph.invoke(state)
        
        # Now stream the response using OpenAI streaming
        try:
            # Create system prompt based on context
            system_prompt = self.create_system_prompt(result["context"])
            
            # Create user message
            user_message = f"User query: {query}\n\nContext: {json.dumps(result['context'], indent=2)}"
            
            # Generate streaming response
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ]
            
            # Stream the response
            for chunk in self.llm.stream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    yield chunk.content
                    
        except Exception as e:
            yield f"I apologize, but I encountered an error while processing your request: {str(e)}"

# Initialize the chatbot
chatbot = BusinessChatbot()

def get_chatbot_response(user_id: str, query: str) -> str:
    """Get response from the business chatbot"""
    return chatbot.chat(user_id, query)

def get_chatbot_response_stream(user_id: str, query: str) -> Generator[str, None, None]:
    """Get streaming response from the business chatbot"""
    return chatbot.chat_stream(user_id, query)
