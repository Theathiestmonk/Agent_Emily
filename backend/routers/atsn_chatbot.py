"""
ATSN Chatbot Router
Handles chat interactions with the ATSN agent (Content & Lead Management)
"""

import os
import sys
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import logging

# Add agents directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.atsn import ATSNAgent
from supabase import create_client, Client
from auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/atsn", tags=["atsn"])


# Pydantic models for request/response
class ChatMessage(BaseModel):
    message: str
    conversation_history: Optional[List[str]] = None
    media_file: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    intent: Optional[str] = None
    payload: Optional[dict] = None
    payload_complete: bool = False
    waiting_for_user: bool = False
    clarification_question: Optional[str] = None
    clarification_options: Optional[List[dict]] = None  # Clickable options for clarification
    result: Optional[str] = None
    error: Optional[str] = None
    current_step: str
    content_id: Optional[str] = None  # Single content ID (UUID) for operations on specific content
    content_ids: Optional[List[str]] = None  # List of content IDs for selection
    lead_id: Optional[str] = None  # Single lead ID (UUID) for operations on specific lead
    content_items: Optional[List[dict]] = None  # Structured content data for frontend card rendering
    lead_items: Optional[List[dict]] = None  # Structured lead data for frontend card rendering
    needs_connection: Optional[bool] = None  # Whether user needs to connect account
    connection_platform: Optional[str] = None  # Platform to connect
    agent_name: Optional[str] = None  # Agent name for displaying appropriate icon


# Store agent instances per user session
user_agents = {}


def get_user_agent(user_id: str) -> ATSNAgent:
    """Get or create ATSN agent for user"""
    if user_id not in user_agents:
        user_agents[user_id] = ATSNAgent(user_id=user_id)
        logger.info(f"Created new ATSN agent for user {user_id}")
    return user_agents[user_id]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    chat_message: ChatMessage,
    current_user=Depends(get_current_user)
):
    """
    Handle chat messages with ATSN agent
    """
    try:
        user_id = current_user.id
        logger.info(f"ATSN chat request from user {user_id}: {chat_message.message}")

        # Save user message to conversation history
        try:
            user_message_data = {
                "user_id": user_id,
                "message_type": "user",
                "content": chat_message.message,
                "metadata": {"agent": "atsn"}
            }
            supabase_client.table("chatbot_conversations").insert(user_message_data).execute()
        except Exception as e:
            logger.error(f"Error saving ATSN user message to conversation history: {e}")

        # Get user's agent instance
        agent = get_user_agent(user_id)
        
        # Process the query
        response = agent.process_query(
            user_query=chat_message.message,
            conversation_history=chat_message.conversation_history,
            user_id=user_id,
            media_file=chat_message.media_file
        )
        
        # Format response - ensure we always have a valid response string
        response_text = (
            response.get('clarification_question') or 
            response.get('result') or 
            response.get('error') or 
            'I received your message. How can I help you?'
        )
        
        # Determine agent name based on intent
        agent_name = 'emily'  # default
        intent = response.get('intent')
        if intent:
            if 'lead' in intent.lower():
                agent_name = 'chase'
            elif intent.lower() in ['view_content', 'publish_content', 'delete_content']:
                agent_name = 'emily'
            elif intent.lower() in ['create_content', 'edit_content', 'schedule_content']:
                agent_name = 'leo'
            elif 'orio' in intent.lower() or 'analytics' in intent.lower():
                agent_name = 'orio'

        chat_response = ChatResponse(
            response=response_text,
            intent=response.get('intent'),
            payload=response.get('payload'),
            payload_complete=response.get('payload_complete', False),
            waiting_for_user=response.get('waiting_for_user', False),
            clarification_question=response.get('clarification_question'),
            clarification_options=response.get('clarification_options', []),
            result=response.get('result'),
            error=response.get('error'),
            current_step=response.get('current_step', 'unknown'),
            content_id=response.get('content_id'),  # Single content ID (UUID)
            content_ids=response.get('content_ids'),  # List of content IDs for selection
            lead_id=response.get('lead_id'),  # Single lead ID (UUID)
            content_items=response.get('content_items'),  # Structured content data for frontend cards
            lead_items=response.get('lead_items'),  # Structured lead data for frontend cards
            needs_connection=response.get('needs_connection'),  # Whether user needs to connect account
            connection_platform=response.get('connection_platform'),  # Platform to connect
            agent_name=agent_name
        )

        # Save bot response to conversation history
        try:
            bot_message_data = {
                "user_id": user_id,
                "message_type": "bot",
                "content": response_text,
                "intent": response.get('intent'),
                "metadata": {
                    "agent": "atsn",
                    "agent_name": agent_name,
                    "step": response.get('current_step', 'unknown'),
                    "payload_complete": response.get('payload_complete', False),
                    "waiting_for_user": response.get('waiting_for_user', False)
                }
            }
            supabase_client.table("chatbot_conversations").insert(bot_message_data).execute()

            # Note: Task count increment moved to frontend after task completion display
            # Note: Image count increment moved to after successful image generation in atsn.py

        except Exception as e:
            logger.error(f"Error saving ATSN bot response to conversation history: {e}")
        
        logger.info(f"ATSN response - Intent: {chat_response.intent}, Step: {chat_response.current_step}, Waiting: {chat_response.waiting_for_user}")
        
        return chat_response
        
    except Exception as e:
        logger.error(f"Error in ATSN chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@router.post("/reset")
async def reset_agent(current_user=Depends(get_current_user)):
    """
    Reset the agent for the current user
    """
    try:
        user_id = current_user.id
        
        if user_id in user_agents:
            user_agents[user_id].reset()
            logger.info(f"Reset ATSN agent for user {user_id}")
            return {"message": "Agent reset successfully"}
        else:
            return {"message": "No active agent to reset"}
            
    except Exception as e:
        logger.error(f"Error resetting ATSN agent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@router.get("/status")
async def get_status(current_user=Depends(get_current_user)):
    """
    Get current agent status
    """
    try:
        user_id = current_user.id
        
        if user_id in user_agents:
            agent = user_agents[user_id]
            state = agent.state
            
            if state:
                return {
                    "active": True,
                    "intent": state.intent,
                    "current_step": state.current_step,
                    "waiting_for_user": state.waiting_for_user,
                    "payload_complete": state.payload_complete
                }
        
        return {
            "active": False,
            "message": "No active agent session"
        }
        
    except Exception as e:
        logger.error(f"Error getting ATSN status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    from agents.atsn import supabase
    
    return {
        "status": "healthy",
        "service": "atsn_chatbot",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "supabase_configured": bool(supabase)
    }
