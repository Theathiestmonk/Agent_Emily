"""
WhatsApp Business API Service
Handles sending messages, webhook verification, and connection management
"""

import os
import requests
import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from supabase import create_client
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase credentials not configured")
        
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        self.webhook_secret = os.getenv("WHATSAPP_WEBHOOK_SECRET", "")
        self.api_version = os.getenv("WHATSAPP_API_VERSION", "v21.0")
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt token for storage"""
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY not found")
        
        f = Fernet(key.encode())
        return f.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt token for use"""
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY not found")
        
        f = Fernet(key.encode())
        return f.decrypt(encrypted_token.encode()).decode()
    
    def get_whatsapp_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get active WhatsApp connection for user"""
        try:
            result = self.supabase.table("whatsapp_connections").select("*").eq("user_id", user_id).eq("is_active", True).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting WhatsApp connection: {e}")
            return None
    
    def create_or_update_whatsapp_connection(
        self,
        user_id: str,
        phone_number_id: str,
        access_token: str,
        business_account_id: Optional[str] = None,
        whatsapp_business_account_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update WhatsApp connection for user"""
        try:
            encrypted_token = self.encrypt_token(access_token)
            
            # Check if connection exists
            existing = self.supabase.table("whatsapp_connections").select("*").eq("user_id", user_id).eq("phone_number_id", phone_number_id).execute()
            
            connection_data = {
                "user_id": user_id,
                "phone_number_id": phone_number_id,
                "access_token_encrypted": encrypted_token,
                "business_account_id": business_account_id,
                "whatsapp_business_account_id": whatsapp_business_account_id,
                "is_active": True,
                "verified_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            if existing.data and len(existing.data) > 0:
                # Update existing connection
                result = self.supabase.table("whatsapp_connections").update(connection_data).eq("id", existing.data[0]["id"]).execute()
                logger.info(f"Updated WhatsApp connection for user {user_id}")
            else:
                # Create new connection
                connection_data["id"] = None  # Let database generate UUID
                result = self.supabase.table("whatsapp_connections").insert(connection_data).execute()
                logger.info(f"Created WhatsApp connection for user {user_id}")
            
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating/updating WhatsApp connection: {e}")
            raise
    
    async def send_message(
        self,
        user_id: str,
        phone_number: str,
        message: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message via Business API
        
        Args:
            user_id: User ID who owns the WhatsApp connection
            phone_number: Recipient phone number (E.164 format, e.g., +1234567890)
            message: Message content
            message_type: Type of message (text, template)
        
        Returns:
            Dict with message_id and status
        """
        try:
            # Get WhatsApp connection
            connection = self.get_whatsapp_connection(user_id)
            if not connection:
                raise ValueError(f"No active WhatsApp connection found for user {user_id}")
            
            # Decrypt access token
            access_token = self.decrypt_token(connection["access_token_encrypted"])
            phone_number_id = connection["phone_number_id"]
            
            # Format phone number (ensure it starts with +)
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number.lstrip("+")
            
            # Prepare API request
            url = f"https://graph.facebook.com/{self.api_version}/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Build message payload based on type
            if message_type == "template":
                # For template messages, you need template name and parameters
                payload = {
                    "messaging_product": "whatsapp",
                    "to": phone_number,
                    "type": "template",
                    "template": {
                        "name": message.get("template_name", ""),
                        "language": {"code": message.get("language_code", "en")},
                        "components": message.get("components", [])
                    }
                }
            else:
                # Text message
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": phone_number,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": message
                    }
                }
            
            # Send message
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            message_id = result.get("messages", [{}])[0].get("id", "")
            
            logger.info(f"Sent WhatsApp message to {phone_number}, message_id: {message_id}")
            
            return {
                "success": True,
                "message_id": message_id,
                "status": "sent",
                "whatsapp_id": message_id
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending WhatsApp message: {e}")
            raise
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify WhatsApp webhook signature
        
        Args:
            payload: Raw request body
            signature: X-Hub-Signature-256 header value
        
        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            logger.warning("WhatsApp webhook secret not configured, skipping verification")
            return True  # Allow in development if secret not set
        
        try:
            # WhatsApp uses HMAC SHA256
            expected_signature = hmac.new(
                self.webhook_secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            # Signature comes as "sha256=<hash>"
            if signature.startswith("sha256="):
                received_signature = signature[7:]
            else:
                received_signature = signature
            
            # Compare signatures
            is_valid = hmac.compare_digest(expected_signature, received_signature)
            
            if not is_valid:
                logger.warning("WhatsApp webhook signature verification failed")
            
            return is_valid
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False
    
    def parse_webhook_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse WhatsApp webhook payload
        
        Returns:
            Parsed payload with message data
        """
        try:
            entry = payload.get("entry", [])
            if not entry:
                return {"type": "unknown", "data": payload}
            
            changes = entry[0].get("changes", [])
            if not changes:
                return {"type": "unknown", "data": payload}
            
            value = changes[0].get("value", {})
            
            # Check for messages
            if "messages" in value:
                messages = value["messages"]
                if messages:
                    message = messages[0]
                    return {
                        "type": "message",
                        "message_id": message.get("id"),
                        "from": value.get("metadata", {}).get("phone_number_id"),
                        "to": value.get("metadata", {}).get("display_phone_number"),
                        "timestamp": message.get("timestamp"),
                        "message_type": message.get("type"),
                        "text": message.get("text", {}).get("body") if message.get("type") == "text" else None,
                        "data": message
                    }
            
            # Check for status updates
            if "statuses" in value:
                statuses = value["statuses"]
                if statuses:
                    status = statuses[0]
                    return {
                        "type": "status",
                        "message_id": status.get("id"),
                        "status": status.get("status"),  # sent, delivered, read, failed
                        "timestamp": status.get("timestamp"),
                        "recipient_id": status.get("recipient_id"),
                        "data": status
                    }
            
            return {"type": "unknown", "data": payload}
            
        except Exception as e:
            logger.error(f"Error parsing webhook payload: {e}")
            return {"type": "error", "error": str(e), "data": payload}
    
    async def get_message_status(self, user_id: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a sent message (if stored in database)"""
        try:
            # This would query the lead_conversations table
            # For now, return None as status is updated via webhooks
            return None
        except Exception as e:
            logger.error(f"Error getting message status: {e}")
            return None



