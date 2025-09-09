"""
Chatbot API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the chatbot agent
from agents.chatbot_agent import get_chatbot_response

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    user_id: str
    timestamp: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            # For testing, return a mock user
            return User(
                id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
                email="test@example.com", 
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
        
        # Extract token
        token = authorization.split(" ")[1]
        
        # In a real implementation, you would validate the JWT token here
        # For now, return a mock user
        return User(
            id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
            email="test@example.com", 
            name="Test User",
            created_at="2025-01-01T00:00:00Z"
        )
        
    except Exception as e:
        # Fallback to mock user
        return User(
            id="d523ec90-d5ee-4393-90b7-8f117782fcf5",
            email="test@example.com", 
            name="Test User",
            created_at="2025-01-01T00:00:00Z"
        )

@router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat with the business assistant bot"""
    try:
        # Use the user_id from the request or fall back to current user
        user_id = request.user_id or current_user.id
        
        # Get response from chatbot
        response = get_chatbot_response(user_id, request.message)
        
        return ChatResponse(
            response=response,
            user_id=user_id,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat request: {str(e)}"
        )

@router.get("/health")
async def chatbot_health():
    """Health check for chatbot service"""
    return {
        "status": "healthy",
        "service": "business_chatbot",
        "capabilities": [
            "scheduled_posts",
            "performance_insights", 
            "industry_trends"
        ]
    }

@router.get("/capabilities")
async def get_capabilities():
    """Get chatbot capabilities"""
    return {
        "capabilities": {
            "scheduled_posts": {
                "description": "Tell you about your next scheduled posts",
                "example_queries": [
                    "What's my next scheduled post?",
                    "When is my next Facebook post?",
                    "Show me my upcoming content"
                ]
            },
            "performance_insights": {
                "description": "Analyze your social media performance",
                "example_queries": [
                    "How are my posts performing?",
                    "Show me my latest Instagram insights",
                    "What's my engagement rate?"
                ]
            },
            "industry_trends": {
                "description": "Get latest trends in your industry",
                "example_queries": [
                    "What are the latest trends in my industry?",
                    "Tell me about current marketing trends",
                    "What's new in social media?"
                ]
            }
        }
    }
