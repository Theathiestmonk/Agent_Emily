"""
Business Chatbot Agent using LangGraph
Handles queries about scheduled posts, insights, and industry trends
"""

import os
import json
from typing import Dict, List, Any, Optional
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
def get_scheduled_posts(user_id: str, platform: str = None) -> Dict[str, Any]:
    """Get scheduled posts for a user, optionally filtered by platform"""
    try:
        query = supabase.table("content_posts").select("*").eq("user_id", user_id).eq("status", "scheduled").order("scheduled_at", desc=False)
        
        if platform:
            query = query.eq("platform", platform)
        
        response = query.execute()
        posts = response.data if response.data else []
        
        return {
            "success": True,
            "posts": posts,
            "count": len(posts)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "posts": [],
            "count": 0
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
        # This would typically use a web search API or news API
        # For now, we'll return a structured response that the LLM can work with
        trends = {
            "industry": industry,
            "trends": [
                {
                    "trend": "AI-powered content creation",
                    "description": "Businesses are increasingly using AI tools to generate content, automate social media posts, and create personalized marketing materials.",
                    "impact": "High",
                    "relevance": "Very relevant to social media management"
                },
                {
                    "trend": "Video content dominance",
                    "description": "Short-form video content continues to dominate social media platforms, with TikTok, Instagram Reels, and YouTube Shorts leading engagement.",
                    "impact": "High",
                    "relevance": "Critical for social media strategy"
                },
                {
                    "trend": "Authentic storytelling",
                    "description": "Consumers are gravitating towards authentic, behind-the-scenes content over polished corporate messaging.",
                    "impact": "Medium",
                    "relevance": "Important for brand building"
                },
                {
                    "trend": "Social commerce integration",
                    "description": "Social media platforms are becoming shopping destinations with integrated e-commerce features.",
                    "impact": "High",
                    "relevance": "Direct revenue impact"
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
        if any(keyword in query for keyword in ['scheduled', 'next post', 'upcoming', 'when is', 'what is scheduled']):
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
            # Get scheduled posts
            result = get_scheduled_posts.invoke({"user_id": state["user_id"]})
            
            if result["success"] and result["posts"]:
                # Find next scheduled post
                next_post = result["posts"][0]  # Already ordered by scheduled_at asc
                
                state["context"]["scheduled_posts"] = {
                    "next_post": next_post,
                    "total_scheduled": result["count"],
                    "platform": next_post.get("platform"),
                    "scheduled_at": next_post.get("scheduled_at"),
                    "content_preview": next_post.get("content", "")[:200] + "..." if len(next_post.get("content", "")) > 200 else next_post.get("content", "")
                }
            else:
                state["context"]["scheduled_posts"] = {
                    "message": "No scheduled posts found",
                    "total_scheduled": 0
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
            # Get user profile to determine industry
            profile_result = get_user_profile.invoke({"user_id": state["user_id"]})
            
            if profile_result["success"] and profile_result["profile"]:
                industry = profile_result["profile"].get("industry", "technology")
            else:
                industry = "technology"  # Default industry
            
            # Get trends
            trends_result = get_industry_trends.invoke({"industry": industry})
            
            if trends_result["success"] and trends_result["trends"]:
                state["context"]["trends"] = {
                    "industry": industry,
                    "trends": trends_result["trends"]["trends"],
                    "last_updated": trends_result["trends"]["last_updated"]
                }
            else:
                state["context"]["trends"] = {
                    "message": "Unable to fetch industry trends",
                    "industry": industry
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
        
        If you have data available, present it in a clear, easy-to-understand format.
        If there's no data available, explain what might be needed to get that information.
        """
        
        if "scheduled_posts" in context:
            prompt += "\n\nYou have access to scheduled posts data. Help the user understand their upcoming content schedule."
        
        if "insights" in context:
            prompt += "\n\nYou have access to performance insights data. Help the user understand their social media performance."
        
        if "trends" in context:
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

# Initialize the chatbot
chatbot = BusinessChatbot()

def get_chatbot_response(user_id: str, query: str) -> str:
    """Get response from the business chatbot"""
    return chatbot.chat(user_id, query)
