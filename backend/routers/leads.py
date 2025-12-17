"""
Leads Router - Handle lead management, webhooks, and conversations
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request, Header, status, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import os
import hmac
import hashlib
import json
import csv
import io
import time
from functools import wraps

from agents.lead_management_agent import LeadManagementAgent
from services.whatsapp_service import WhatsAppService
from supabase import create_client, Client
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# Initialize Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

# Create client with anon key for user authentication
supabase: Client = create_client(supabase_url, supabase_anon_key)

# Create admin client for database operations
if supabase_service_key:
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)
else:
    supabase_admin = supabase  # Fallback to anon client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/leads", tags=["leads"])
security = HTTPBearer()

# Retry decorator for database operations
def retry_db_operation(max_retries=3, delay=0.5):
    """Retry decorator for database operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    error_str = str(e).lower()
                    # Only retry on connection/timeout errors
                    if any(keyword in error_str for keyword in ['timeout', 'connection', 'network', 'pool', 'temporarily']):
                        logger.warning(f"Database operation failed (attempt {attempt + 1}/{max_retries}): {e}")
                        time.sleep(delay * (attempt + 1))
                    else:
                        raise
            return None
        return wrapper
    return decorator

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials"
            )
        
        return {
            "id": response.user.id,
            "email": response.user.email,
            "name": response.user.user_metadata.get("name", response.user.email),
            "created_at": response.user.created_at
        }
        
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )

# Request/Response Models
class LeadResponse(BaseModel):
    id: str
    user_id: str
    name: Optional[str]
    email: Optional[str]
    phone_number: Optional[str]
    status: str
    source_platform: str
    created_at: str
    updated_at: str
    follow_up_at: Optional[str] = None
    last_remark: Optional[str] = None

class ConversationResponse(BaseModel):
    id: str
    lead_id: str
    message_type: str
    content: str
    sender: str
    direction: str
    status: str
    created_at: str

class UpdateLeadStatusRequest(BaseModel):
    status: str
    remarks: Optional[str] = None

class AddRemarkRequest(BaseModel):
    """Request model for adding remarks to a lead"""
    remarks: str

class SendMessageRequest(BaseModel):
    message: str
    message_type: str = "whatsapp"  # whatsapp or email

class GenerateEmailRequest(BaseModel):
    template: Optional[str] = "welcome"  # welcome, follow-up, inquiry, custom
    category: Optional[str] = "general"  # general, welcome, follow-up, product-inquiry, pricing, demo, support, newsletter, promotional
    custom_template: Optional[str] = None  # Custom template text when template is "custom"
    custom_prompt: Optional[str] = None  # Custom prompt instructions for email generation

class BulkDeleteRequest(BaseModel):
    lead_ids: List[str]

class CreateLeadRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    source_platform: str = "manual"  # manual, facebook, instagram
    status: str = "new"
    form_data: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    follow_up_at: Optional[str] = None  # ISO format datetime string

# Email scheduling helper functions
def parse_follow_up_at(follow_up_at: Optional[str]) -> Optional[datetime]:
    """Parse follow_up_at string to datetime object with UTC timezone"""
    if not follow_up_at:
        return None
    
    try:
        # Try dateutil parser first (handles many formats)
        try:
            from dateutil import parser
            parsed_date = parser.parse(follow_up_at)
            if parsed_date.tzinfo is None:
                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
            return parsed_date.astimezone(timezone.utc)
        except ImportError:
            pass
        except Exception:
            pass
        
        # Fallback to ISO format parsing
        if 'Z' in follow_up_at:
            parsed_date = datetime.fromisoformat(follow_up_at.replace('Z', '+00:00'))
        elif '+' in follow_up_at or follow_up_at.count('-') > 2:
            parsed_date = datetime.fromisoformat(follow_up_at)
        else:
            # Try parsing as date only or date+time without timezone
            parsed_date = datetime.fromisoformat(follow_up_at)
            if parsed_date.tzinfo is None:
                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
        
        if parsed_date.tzinfo is None:
            parsed_date = parsed_date.replace(tzinfo=timezone.utc)
        
        return parsed_date.astimezone(timezone.utc)
    except Exception as e:
        logger.warning(f"Failed to parse follow_up_at '{follow_up_at}': {e}")
        return None

def has_time_component(dt: datetime) -> bool:
    """Check if datetime has meaningful time (not just midnight)"""
    if dt is None:
        return False
    return dt.hour != 0 or dt.minute != 0 or dt.second != 0 or dt.microsecond != 0

def should_send_email_immediately(follow_up_at: Optional[datetime], created_at: Optional[datetime] = None) -> bool:
    """
    Determine if email should be sent immediately based on follow_up_at date/time.
    
    Returns True if:
    - follow_up_at is None (no follow_up_at provided)
    - follow_up_at date matches today
    - follow_up_at date+time matches current time (within 1 hour tolerance if in past)
    
    Returns False if follow_up_at is in the future (needs scheduling).
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # No follow_up_at: send immediately
    if follow_up_at is None:
        logger.info("No follow_up_at provided, sending email immediately")
        return True
    
    # Ensure timezone-aware
    if follow_up_at.tzinfo is None:
        follow_up_at = follow_up_at.replace(tzinfo=timezone.utc)
    follow_up_utc = follow_up_at.astimezone(timezone.utc)
    follow_up_date = follow_up_utc.date()
    
    # Date matches today: send immediately
    if follow_up_date == today:
        # If has time component, check if time matches (within 1 hour if past)
        if has_time_component(follow_up_utc):
            time_diff = (follow_up_utc - now).total_seconds()
            # Send if time matches or is in past (within 1 hour tolerance)
            should_send = time_diff <= 3600  # 1 hour tolerance
            logger.info(f"follow_up_at date matches today with time component. Time diff: {time_diff}s, sending: {should_send}")
            return should_send
        else:
            # Only date, no time: send immediately
            logger.info("follow_up_at date matches today (no time component), sending email immediately")
            return True
    
    # Future date: schedule (return False)
    if follow_up_date > today:
        logger.info(f"follow_up_at is in the future ({follow_up_date}), will schedule email")
        return False
    
    # Past date: send immediately (might be old data or timezone issue)
    logger.info(f"follow_up_at is in the past ({follow_up_date}), sending email immediately")
    return True

def get_email_send_time(follow_up_at: Optional[datetime], created_at: Optional[datetime] = None) -> datetime:
    """
    Returns the exact datetime when email should be sent.
    - If follow_up_at is None: return current time
    - If follow_up_at has only date: return today with current time
    - If follow_up_at has date+time: return that exact time (or current time if in past)
    """
    now = datetime.now(timezone.utc)
    
    if follow_up_at is None:
        return now
    
    # Ensure timezone-aware
    if follow_up_at.tzinfo is None:
        follow_up_at = follow_up_at.replace(tzinfo=timezone.utc)
    follow_up_utc = follow_up_at.astimezone(timezone.utc)
    
    # If has time component, use that time (or current time if in past)
    if has_time_component(follow_up_utc):
        # If the time is in the past, use current time
        if follow_up_utc < now:
            return now
        return follow_up_utc
    else:
        # Only date, no time: use current time
        return now

# Initialize agent
def get_lead_agent():
    """Get initialized lead management agent"""
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")
    
    return LeadManagementAgent(
        supabase_url=supabase_url,
        supabase_key=supabase_service_key,
        openai_api_key=openai_api_key
    )

# Meta Webhook Endpoints
@router.get("/meta/webhook")
async def meta_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """Meta webhook verification (GET request)"""
    verify_token = os.getenv("META_WEBHOOK_VERIFY_TOKEN")
    
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("Meta webhook verified successfully")
        return int(hub_challenge)
    else:
        logger.warning(f"Meta webhook verification failed: mode={hub_mode}, token_match={hub_verify_token == verify_token}")
        raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/meta/webhook")
async def meta_webhook(request: Request):
    """Handle Meta Lead Ads webhook (POST request)"""
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify signature
        signature = request.headers.get("X-Hub-Signature-256", "")
        if signature:
            app_secret = os.getenv("META_APP_SECRET")
            if app_secret:
                expected_signature = "sha256=" + hmac.new(
                    app_secret.encode(),
                    body,
                    hashlib.sha256
                ).hexdigest()
                
                if not hmac.compare_digest(signature, expected_signature):
                    logger.warning("Meta webhook signature verification failed")
                    raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse webhook data
        webhook_data = await request.json()
        logger.info(f"Meta webhook received: {json.dumps(webhook_data, indent=2)}")
        
        # Process webhook entries
        entries = webhook_data.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                
                # Check if this is a leadgen event
                if "leadgen_id" in value:
                    await _process_meta_lead(value)
        
        return JSONResponse(content={"success": True})
        
    except Exception as e:
        logger.error(f"Error processing Meta webhook: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

async def _process_meta_lead(lead_data: Dict[str, Any]):
    """Process a Meta lead from webhook"""
    try:
        leadgen_id = lead_data.get("leadgen_id")
        form_id = lead_data.get("form_id")
        ad_id = lead_data.get("ad_id")
        adgroup_id = lead_data.get("adgroup_id")
        created_time = lead_data.get("created_time")
        
        # Extract field data
        field_data = lead_data.get("field_data", [])
        lead_info = {}
        for field in field_data:
            field_name = field.get("name", "")
            field_values = field.get("values", [])
            if field_values:
                lead_info[field_name] = field_values[0]
        
        # Map common field names
        name = lead_info.get("full_name") or lead_info.get("first_name", "") + " " + lead_info.get("last_name", "")
        email = lead_info.get("email", "")
        phone = lead_info.get("phone_number", "") or lead_info.get("phone", "")
        
        # Determine user_id from ad_id or form_id
        # For now, we'll need to store ad_id to user_id mapping
        # This is a simplified version - you may need to enhance this
        user_id = _get_user_id_from_ad(ad_id, form_id)
        
        if not user_id:
            logger.warning(f"Could not determine user_id for lead {leadgen_id}")
            return
        
        # Prepare lead data for agent
        lead_payload = {
            "name": name.strip(),
            "email": email,
            "phone_number": phone,
            "ad_id": ad_id,
            "campaign_id": lead_data.get("campaign_id"),
            "adgroup_id": adgroup_id,
            "form_id": form_id,
            "leadgen_id": leadgen_id,
            "source_platform": "facebook",  # Meta leads are typically from Facebook
            "form_data": lead_info,
            "created_time": created_time
        }
        
        # Process lead through agent
        agent = get_lead_agent()
        result = await agent.process_lead(user_id, lead_payload)
        
        logger.info(f"Processed Meta lead {leadgen_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error processing Meta lead: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

def _get_user_id_from_ad(ad_id: Optional[str], form_id: Optional[str]) -> Optional[str]:
    """Get user_id from ad_id or form_id"""
    # This is a placeholder - you'll need to implement proper mapping
    # Options:
    # 1. Store ad_id -> user_id mapping in database
    # 2. Query Meta API to get page_id, then map page_id to user_id
    # 3. Store form_id -> user_id mapping
    
    # For now, return None and log warning
    # In production, implement proper mapping
    logger.warning(f"User ID mapping not implemented for ad_id={ad_id}, form_id={form_id}")
    return None

# WhatsApp Webhook Endpoints
@router.get("/whatsapp/webhook")
async def whatsapp_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """WhatsApp webhook verification (GET request)"""
    verify_token = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", os.getenv("META_WEBHOOK_VERIFY_TOKEN"))
    
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp webhook verified successfully")
        return int(hub_challenge)
    else:
        logger.warning(f"WhatsApp webhook verification failed")
        raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    """Handle WhatsApp Business API webhook"""
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify signature
        signature = request.headers.get("X-Hub-Signature-256", "")
        whatsapp_service = WhatsAppService()
        
        if signature and not whatsapp_service.verify_webhook_signature(body, signature):
            logger.warning("WhatsApp webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse webhook data
        webhook_data = await request.json()
        logger.info(f"WhatsApp webhook received: {json.dumps(webhook_data, indent=2)}")
        
        # Parse payload
        parsed = whatsapp_service.parse_webhook_payload(webhook_data)
        
        if parsed["type"] == "message":
            await _process_whatsapp_message(parsed)
        elif parsed["type"] == "status":
            await _process_whatsapp_status(parsed)
        
        return JSONResponse(content={"success": True})
        
    except Exception as e:
        logger.error(f"Error processing WhatsApp webhook: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

async def _process_whatsapp_message(message_data: Dict[str, Any]):
    """Process incoming WhatsApp message"""
    try:
        phone_number = message_data.get("from", "")
        message_text = message_data.get("text", "")
        message_id = message_data.get("message_id")
        
        # Find lead by phone number
        result = supabase_admin.table("leads").select("*").eq("phone_number", phone_number).order("created_at", desc=True).limit(1).execute()
        
        if not result.data:
            logger.warning(f"No lead found for phone number: {phone_number}")
            return
        
        lead = result.data[0]
        lead_id = lead["id"]
        user_id = lead["user_id"]
        
        # Store incoming message
        supabase_admin.table("lead_conversations").insert({
            "lead_id": lead_id,
            "message_type": "whatsapp",
            "content": message_text,
            "sender": "lead",
            "direction": "inbound",
            "message_id": message_id,
            "status": "received",
            "metadata": {
                "whatsapp_message_id": message_id
            }
        }).execute()
        
        # Update lead status
        supabase_admin.table("leads").update({
            "status": "responded",
            "updated_at": datetime.now().isoformat()
        }).eq("id", lead_id).execute()
        
        # Generate AI response
        agent = get_lead_agent()
        ai_response = await agent.generate_ai_response(lead_id, message_text, user_id)
        
        if ai_response.get("success"):
            # Send response via WhatsApp
            whatsapp_service = WhatsAppService()
            send_result = await whatsapp_service.send_message(
                user_id=user_id,
                phone_number=phone_number,
                message=ai_response["response"]
            )
            
            # Store outgoing message
            if send_result.get("success"):
                supabase_admin.table("lead_conversations").insert({
                    "lead_id": lead_id,
                    "message_type": "whatsapp",
                    "content": ai_response["response"],
                    "sender": "agent",
                    "direction": "outbound",
                    "message_id": send_result.get("message_id"),
                    "status": "sent",
                    "metadata": {
                        "whatsapp_message_id": send_result.get("message_id"),
                        "ai_generated": True
                    }
                }).execute()
        
        logger.info(f"Processed WhatsApp message from {phone_number}")
        
    except Exception as e:
        logger.error(f"Error processing WhatsApp message: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

async def _process_whatsapp_status(status_data: Dict[str, Any]):
    """Process WhatsApp message status update"""
    try:
        message_id = status_data.get("message_id")
        status = status_data.get("status")
        
        # Update conversation status
        supabase_admin.table("lead_conversations").update({
            "status": status,
            "updated_at": datetime.now().isoformat()
        }).eq("message_id", message_id).execute()
        
        logger.info(f"Updated WhatsApp message status: {message_id} -> {status}")
        
    except Exception as e:
        logger.error(f"Error processing WhatsApp status: {e}")

# Helper function to normalize email and phone for duplicate checking
def normalize_email(email: Optional[str]) -> Optional[str]:
    """Normalize email for duplicate checking (lowercase, strip)"""
    if not email:
        return None
    return email.strip().lower() if email.strip() else None

def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """Normalize phone number for duplicate checking (remove spaces, dashes, parentheses)"""
    if not phone:
        return None
    # Remove common formatting characters
    normalized = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")
    return normalized if normalized else None

# Helper function to check for duplicate leads
def check_duplicate_lead(user_id: str, email: Optional[str] = None, phone_number: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Check if a lead with the same email or phone number already exists for the user"""
    try:
        # Normalize inputs
        normalized_email = normalize_email(email)
        normalized_phone = normalize_phone(phone_number)
        
        if not normalized_email and not normalized_phone:
            return None
        
        # Use targeted database queries instead of fetching all leads
        # Check email first (case-insensitive)
        if normalized_email:
            # Use ILIKE for case-insensitive matching
            result = supabase_admin.table("leads").select("*").eq("user_id", user_id).ilike("email", normalized_email).limit(1).execute()
            if result.data:
                # Verify exact match after normalization
                for lead in result.data:
                    lead_email = normalize_email(lead.get("email"))
                    if lead_email == normalized_email:
                        return lead
        
        # Check phone number (exact match, already normalized)
        if normalized_phone:
            result = supabase_admin.table("leads").select("*").eq("user_id", user_id).eq("phone_number", normalized_phone).limit(1).execute()
            if result.data:
                return result.data[0]
        
        return None
    except Exception as e:
        logger.error(f"Error checking for duplicate lead: {e}")
        return None

# Batch insert helper function
@retry_db_operation(max_retries=3, delay=0.5)
def batch_insert_leads(leads_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Insert multiple leads in a single batch operation"""
    if not leads_data:
        return []
    
    try:
        result = supabase_admin.table("leads").insert(leads_data).execute()
        return result.data if result.data else []
    except Exception as e:
        error_str = str(e).lower()
        # Handle unique constraint violations gracefully
        if "duplicate" in error_str or "unique" in error_str or "violates" in error_str:
            # Try inserting one by one to identify which ones are duplicates
            successful = []
            for lead_data in leads_data:
                try:
                    single_result = supabase_admin.table("leads").insert(lead_data).execute()
                    if single_result.data:
                        successful.append(single_result.data[0])
                except Exception:
                    # Skip duplicates or other errors for individual inserts
                    continue
            return successful
        raise

# Lead CRUD Endpoints
@router.post("", response_model=LeadResponse)
async def create_lead(
    request: CreateLeadRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new lead manually"""
    try:
        # Check for duplicate lead
        duplicate = check_duplicate_lead(
            user_id=current_user["id"],
            email=request.email,
            phone_number=request.phone_number
        )
        
        if duplicate:
            duplicate_info = []
            if request.email and duplicate.get("email") == request.email:
                duplicate_info.append("email")
            if request.phone_number and duplicate.get("phone_number") == request.phone_number:
                duplicate_info.append("phone number")
            
            raise HTTPException(
                status_code=409,
                detail=f"Lead already exists with the same {', '.join(duplicate_info)}. Duplicate leads are not allowed."
            )
        
        # Parse follow_up_at if provided
        follow_up_at_dt = None
        if request.follow_up_at:
            follow_up_at_dt = parse_follow_up_at(request.follow_up_at)
            if follow_up_at_dt:
                logger.info(f"Parsed follow_up_at: {follow_up_at_dt.isoformat()}")
            else:
                logger.warning(f"Failed to parse follow_up_at: {request.follow_up_at}, continuing without it")
        
        lead_data = {
            "user_id": current_user["id"],
            "name": request.name,
            "email": request.email,
            "phone_number": request.phone_number,
            "source_platform": request.source_platform,
            "status": request.status,
            "form_data": request.form_data or {},
            "metadata": {
                **(request.metadata or {}),
                "created_manually": True,
                "created_at": datetime.now().isoformat()
            }
        }
        
        # Add follow_up_at to lead_data if parsed successfully
        if follow_up_at_dt:
            lead_data["follow_up_at"] = follow_up_at_dt.isoformat()
        
        result = supabase_admin.table("leads").insert(lead_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create lead")
        
        created_lead = result.data[0]
        lead_id = created_lead["id"]
        
        # Automatically send welcome email if lead has email address
        # Check if email should be sent immediately based on follow_up_at
        should_send_email = False
        if request.email and request.status == "new":
            # Determine if email should be sent immediately
            should_send_email = should_send_email_immediately(follow_up_at_dt)
            
            if should_send_email:
                logger.info(f"Email will be sent immediately for lead {lead_id} (follow_up_at: {follow_up_at_dt.isoformat() if follow_up_at_dt else 'None'})")
            else:
                logger.info(f"Email will be scheduled for future for lead {lead_id} (follow_up_at: {follow_up_at_dt.isoformat() if follow_up_at_dt else 'None'})")
        
        if should_send_email:
            try:
                # Get user profile for business context
                profile = supabase_admin.table("profiles").select("*").eq("id", current_user["id"]).execute()
                profile_data = profile.data[0] if profile.data else {}
                
                business_name = profile_data.get("business_name") or "our business"
                business_description = profile_data.get("business_description") or ""
                brand_voice = profile_data.get("brand_voice") or "professional"
                brand_tone = profile_data.get("brand_tone") or "friendly"
                
                # Generate welcome email using LLM
                openai_api_key = os.getenv("OPENAI_API_KEY")
                if openai_api_key:
                    openai_client = openai.OpenAI(api_key=openai_api_key)
                    
                    prompt = f"""
You are an expert email marketer writing a personalized thanking email to a new lead.

Business Information:
- Business Name: {business_name}
- Business Description: {business_description}
- Brand Voice: {brand_voice}
- Brand Tone: {brand_tone}

Lead Information:
- Name: {request.name}
- Email: {request.email}

Create a personalized, warm, and engaging thanking email that:
1. Thanks them for contacting {business_name}
2. Shows understanding of the business context: {business_description if business_description else 'their interest in our services'}
3. Provides an introductory message for further contact and engagement
4. Matches the brand voice ({brand_voice}) and tone ({brand_tone})
5. Is concise (under 200 words)
6. Uses HTML format with proper paragraph tags (<p>), line breaks (<br>), and formatting
7. Does NOT include links unless absolutely necessary
8. Is professional yet friendly and inviting

Return a JSON object with:
- "subject": Email subject line (engaging and personalized, no HTML)
- "body": Email body in HTML format with proper tags (<p>, <br>, etc.)
"""
                    
                    response = openai_client.chat.completions.create(
                        model="gpt-4",
                        messages=[
                            {"role": "system", "content": "You are an expert email marketer. Always respond with valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.7,
                        max_tokens=600
                    )
                    
                    # Track token usage
                    from services.token_usage_service import TokenUsageService
                    if supabase_url and supabase_service_key:
                        token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                        await token_tracker.track_chat_completion_usage(
                            user_id=current_user["id"],
                            feature_type="lead_email",
                            model_name="gpt-4",
                            response=response,
                            request_metadata={"lead_id": str(lead_id)}
                        )
                    
                    # Ensure lead_name is never None
                    lead_name = request.name or "there"
                    if business_name is None:
                        business_name = "our business"
                    
                    try:
                        email_data = json.loads(response.choices[0].message.content)
                        email_subject = email_data.get("subject", f"Thank you for contacting {business_name}")
                        email_body = email_data.get("body", f"Thank you {lead_name} for contacting {business_name}!")
                    except json.JSONDecodeError:
                        content = response.choices[0].message.content
                        email_subject = f"Thank you for contacting {business_name}"
                        email_body = content
                        # Replace any placeholders that might exist
                        email_body = email_body.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                        email_subject = email_subject.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                    
                    # Final safety check: ensure values are never None before any string operations
                    if lead_name is None:
                        lead_name = "there"
                    if business_name is None:
                        business_name = "our business"
                    
                    # Replace any remaining placeholders
                    email_subject = email_subject.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                    email_body = email_body.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                    email_subject = email_subject.replace("{business_name}", business_name)
                    email_body = email_body.replace("{business_name}", business_name)
                    
                    # Check for Google connection and send email
                    connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user["id"]).execute()
                    
                    if connection.data:
                        logger.info(f"Manual Lead Creation: Google connection found for user {current_user['id']} ({current_user['email']}). Sending welcome email.")
                        try:
                            from routers.google_connections import send_gmail_message, User as GoogleUser
                            
                            # Create User object for send_gmail_message
                            created_at_value = current_user.get("created_at", "")
                            if created_at_value and hasattr(created_at_value, 'isoformat'):
                                created_at_str = created_at_value.isoformat()
                            elif created_at_value:
                                created_at_str = str(created_at_value)
                            else:
                                created_at_str = ""
                            
                            google_user = GoogleUser(
                                id=current_user["id"],
                                email=current_user["email"],
                                name=current_user["name"],
                                created_at=created_at_str
                            )
                            
                            # Send email
                            email_result = await send_gmail_message(
                                to=request.email,
                                subject=email_subject,
                                body=email_body,
                                current_user=google_user
                            )
                            
                            if email_result.get("success"):
                                # Store conversation
                                supabase_admin.table("lead_conversations").insert({
                                    "lead_id": lead_id,
                                    "message_type": "email",
                                    "content": email_body,
                                    "sender": "agent",
                                    "direction": "outbound",
                                    "message_id": email_result.get("message_id"),
                                    "status": "sent"
                                }).execute()
                                
                                # Update status to "contacted"
                                supabase_admin.table("leads").update({
                                    "status": "contacted",
                                    "updated_at": datetime.now().isoformat()
                                }).eq("id", lead_id).execute()
                                
                                # Create status history entry
                                supabase_admin.table("lead_status_history").insert({
                                    "lead_id": lead_id,
                                    "old_status": "new",
                                    "new_status": "contacted",
                                    "changed_by": "system",
                                    "reason": "Automatic welcome email sent"
                                }).execute()
                                
                                logger.info(f"Welcome email sent to lead {lead_id} and status updated to contacted")
                                
                                # Create chatbot message from Chase
                                try:
                                    # Get business name from profile
                                    business_name = profile_data.get("business_name", "your business")
                                    
                                    # Get user's timezone from profile, default to UTC
                                    user_timezone_str = profile_data.get("timezone", "UTC")
                                    
                                    # Format date and time in user's timezone
                                    now_utc = datetime.now(timezone.utc)
                                    
                                    # Convert to user's timezone for display
                                    try:
                                        import pytz
                                        user_tz = pytz.timezone(user_timezone_str)
                                        now_user_tz = now_utc.astimezone(user_tz)
                                        date_time_str = now_user_tz.strftime("%B %d, %Y at %I:%M %p")
                                    except Exception:
                                        # If timezone conversion fails, use UTC
                                        date_time_str = now_utc.strftime("%B %d, %Y at %I:%M %p")
                                    
                                    # Create message content
                                    message_content = f"Dear {business_name}, you just received a new lead: **{request.name}** on {date_time_str}.\n\nI have contacted the lead and sent an Email for now."
                                    
                                    # Create chatbot conversation message
                                    # Use UTC timezone to match database storage
                                    chatbot_message_data = {
                                        "user_id": current_user["id"],
                                        "message_type": "bot",
                                        "content": message_content,
                                        "intent": "lead_notification",
                                        "created_at": now_utc.isoformat(),
                                        "metadata": {
                                            "sender": "chase",
                                            "lead_id": lead_id,
                                            "lead_name": request.name,
                                            "email_content": email_body,
                                            "email_subject": email_subject,
                                            "notification_type": "new_lead_email_sent"
                                        }
                                    }
                                    
                                    supabase_admin.table("chatbot_conversations").insert(chatbot_message_data).execute()
                                    logger.info(f"Created Chase notification message for lead {lead_id}")
                                except Exception as chatbot_msg_error:
                                    logger.error(f"Error creating chatbot message: {chatbot_msg_error}")
                                    # Don't fail lead creation if chatbot message fails
                                
                        except Exception as email_error:
                            logger.error(f"Error sending welcome email to lead {lead_id} ({request.email}): {str(email_error)}")
                            logger.error(f"Error type: {type(email_error).__name__}")
                            import traceback
                            logger.error(f"Traceback: {traceback.format_exc()}")
                            logger.error(f"Error sending welcome email: {email_error}")
                            # Don't fail lead creation if email fails
                    else:
                        logger.warning(f"No active Google connection found for user {current_user['id']} ({current_user['email']}). Skipping automatic welcome email for lead {lead_id}. Please connect your Google account to enable email sending.")
            except Exception as auto_email_error:
                logger.error(f"Error in automatic email sending: {auto_email_error}")
                # Don't fail lead creation if auto-email fails
        else:
            # Email not sent immediately - could be scheduled for future
            if request.email and request.status == "new" and follow_up_at_dt:
                logger.info(f"Email for lead {lead_id} will be scheduled for follow_up_at: {follow_up_at_dt.isoformat()}")
                # TODO: Implement email scheduling for future dates
                # For now, we log it but don't schedule (can be added in Phase 2)
        
        return created_lead
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import-csv")
async def import_leads_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import leads from CSV file"""
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV file")
        
        # Read file content with encoding detection
        contents = await file.read()
        # Try to detect encoding
        encodings_to_try = ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']
        file_content = None
        for encoding in encodings_to_try:
            try:
                file_content = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue

        if file_content is None:
            raise HTTPException(status_code=400, detail="Unable to decode CSV file. Please ensure it's UTF-8 encoded.")
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(file_content))
        rows = list(csv_reader)
        
        if not rows:
            raise HTTPException(status_code=400, detail="CSV file is empty or has no data rows")
        
        # Validate required columns
        required_columns = ['name']
        first_row = rows[0]
        missing_columns = [col for col in required_columns if col not in first_row]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"CSV file is missing required columns: {', '.join(missing_columns)}"
            )
        
        # Process rows and create leads
        created_leads = []
        errors = []
        duplicates = []
        valid_leads_batch = []  # Collect valid leads for batch processing
        batch_size = 50
        checked_duplicates = set()  # Cache for duplicate checks within this upload session
        
        for idx, row in enumerate(rows, start=2):  # Start at 2 because row 1 is header
            try:
                # Extract data from CSV row
                name = row.get('name', '').strip()
                if not name:
                    errors.append(f"Row {idx}: Name is required")
                    continue
                
                email = row.get('email', '').strip() or None
                phone_number = row.get('phone_number', '').strip() or row.get('phone', '').strip() or None
                source_platform = row.get('source_platform', 'manual').strip() or 'manual'
                status = row.get('status', 'new').strip() or 'new'
                follow_up_at = row.get('follow_up_at', '').strip() or None
                
                # Validate and parse follow_up_at - MANDATORY field
                if not follow_up_at:
                    errors.append(f"Row {idx}: follow_up_at is required and cannot be empty")
                    continue
                
                original_follow_up_at = follow_up_at
                parsed = False
                parsed_date = None
                date_invalid_reason = None
                
                try:
                    # Try to parse various date formats
                    try:
                        from dateutil import parser
                        parsed_date = parser.parse(follow_up_at)
                        # Validate the parsed date is actually valid
                        # dateutil.parser can sometimes parse invalid dates, so we validate
                        if parsed_date:
                            # Check if the date components are valid
                            import calendar
                            year, month, day = parsed_date.year, parsed_date.month, parsed_date.day
                            days_in_month = calendar.monthrange(year, month)[1]
                            if day > days_in_month:
                                date_invalid_reason = f"Invalid date: day {day} exceeds days in month {month} (month {month} only has {days_in_month} days)"
                                parsed_date = None
                                parsed = False
                            else:
                                parsed = True
                                logger.info(f"Row {idx}: Successfully parsed follow_up_at using dateutil: {parsed_date}")
                        else:
                            parsed = False
                            date_invalid_reason = "Failed to parse date"
                    except ImportError:
                        logger.warning("dateutil not available, using fallback parsing")
                    except Exception as e:
                        logger.warning(f"dateutil parsing failed: {e}, trying fallback")
                        parsed = False
                    
                    if not parsed:
                        # Fallback to datetime if dateutil not available or failed
                        try:
                            # Try ISO format first (handle both with and without timezone)
                            if 'Z' in follow_up_at:
                                parsed_date = datetime.fromisoformat(follow_up_at.replace('Z', '+00:00'))
                            elif '+' in follow_up_at or follow_up_at.count('-') > 2:  # Has timezone info
                                parsed_date = datetime.fromisoformat(follow_up_at)
                            else:
                                # No timezone, try parsing as naive datetime
                                parsed_date = datetime.fromisoformat(follow_up_at)
                            
                            # Validate date components for ISO format
                            import calendar
                            year, month, day = parsed_date.year, parsed_date.month, parsed_date.day
                            days_in_month = calendar.monthrange(year, month)[1]
                            if day > days_in_month:
                                date_invalid_reason = f"Invalid date: day {day} exceeds days in month {month} (month {month} only has {days_in_month} days)"
                                parsed_date = None
                                parsed = False
                            else:
                                parsed = True
                                logger.info(f"Row {idx}: Successfully parsed follow_up_at using ISO format")
                        except Exception as e:
                            logger.warning(f"ISO format parsing failed: {e}, trying other formats")
                            # Try common formats
                            date_formats = [
                                '%Y-%m-%d %H:%M:%S',
                                '%Y-%m-%dT%H:%M:%S',
                                '%Y-%m-%d %H:%M',
                                '%Y-%m-%dT%H:%M',
                                '%Y-%m-%d',
                                '%m/%d/%Y %H:%M:%S',
                                '%m/%d/%Y %H:%M',
                                '%m/%d/%Y',
                                '%d/%m/%Y %H:%M:%S',
                                '%d/%m/%Y %H:%M',
                                '%d/%m/%Y'
                            ]
                            for fmt in date_formats:
                                try:
                                    parsed_date = datetime.strptime(follow_up_at, fmt)
                                    # Validate the date is actually valid (e.g., not Nov 31)
                                    import calendar
                                    year, month, day = parsed_date.year, parsed_date.month, parsed_date.day
                                    days_in_month = calendar.monthrange(year, month)[1]
                                    if day > days_in_month:
                                        date_invalid_reason = f"Invalid date: day {day} exceeds days in month {month} (month {month} only has {days_in_month} days)"
                                        parsed_date = None
                                        continue
                                    parsed = True
                                    logger.info(f"Row {idx}: Successfully parsed follow_up_at using format {fmt}")
                                    break
                                except ValueError as ve:
                                    logger.debug(f"Row {idx}: Format {fmt} failed: {ve}")
                                    continue
                                except Exception as e:
                                    logger.debug(f"Row {idx}: Format {fmt} failed with error: {e}")
                                    continue
                            
                            if not parsed:
                                date_invalid_reason = f"Date format not recognized. Accepted formats: YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, YYYY-MM-DD HH:MM:SS, MM/DD/YYYY, DD/MM/YYYY"
                    
                    # If date is invalid, skip this lead and add error
                    if not parsed or not parsed_date:
                        error_msg = f"Row {idx}: Invalid follow_up_at date '{original_follow_up_at}'. {date_invalid_reason or 'Please use a valid date format (e.g., 2024-12-31T10:00:00 or 2024-12-31)'}. Lead not imported."
                        logger.error(error_msg)
                        errors.append(error_msg)
                        continue  # Skip this lead entirely
                    
                    # Ensure timezone-aware datetime for Supabase timestamptz
                    # If no timezone info, assume UTC
                    if parsed_date.tzinfo is None:
                        parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                        logger.info(f"Row {idx}: Added UTC timezone to naive datetime")
                    
                    # Convert to UTC and format as ISO string with timezone
                    parsed_date_utc = parsed_date.astimezone(timezone.utc)
                    follow_up_at = parsed_date_utc.isoformat()
                    logger.info(f"Row {idx}: Final follow_up_at value: {follow_up_at}")
                        
                except Exception as e:
                    error_msg = f"Row {idx}: Unexpected error parsing follow_up_at '{original_follow_up_at}': {str(e)}. Lead not imported."
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue  # Skip this lead entirely
                
                # Extract additional form data (any columns not in standard fields)
                standard_fields = {'name', 'email', 'phone_number', 'phone', 'source_platform', 'status', 'follow_up_at'}
                form_data = {k: v for k, v in row.items() if k not in standard_fields and v.strip()}
                
                # Validate that at least email or phone is provided
                if not email and not phone_number:
                    errors.append(f"Row {idx}: Either email or phone_number is required")
                    continue
                
                # Create unique key for duplicate check caching
                duplicate_key = f"{normalize_email(email) or ''}:{normalize_phone(phone_number) or ''}"
                
                # Check cache first to avoid redundant database queries
                if duplicate_key in checked_duplicates:
                    duplicates.append(f"Row {idx}: Lead already processed in this upload (Name: {name})")
                    continue
                
                # Check for duplicate lead in database
                duplicate = check_duplicate_lead(
                    user_id=current_user["id"],
                    email=email,
                    phone_number=phone_number
                )
                
                if duplicate:
                    duplicate_info = []
                    if email and duplicate.get("email") == email:
                        duplicate_info.append("email")
                    if phone_number and duplicate.get("phone_number") == phone_number:
                        duplicate_info.append("phone number")
                    
                    duplicates.append(f"Row {idx}: Lead already exists with the same {', '.join(duplicate_info)} (Name: {name})")
                    checked_duplicates.add(duplicate_key)
                    continue  # Skip this duplicate lead
                
                # Create lead data
                lead_data = {
                    "user_id": current_user["id"],
                    "name": name,
                    "email": email,
                    "phone_number": phone_number,
                    "source_platform": source_platform,
                    "status": status,
                    "form_data": form_data,
                    "metadata": {
                        "created_manually": True,
                        "imported_from_csv": True,
                        "csv_filename": file.filename,
                        "created_at": datetime.now().isoformat()
                    }
                }
                
                # Add follow_up_at if it was successfully parsed (it's already in ISO format with timezone)
                if follow_up_at:
                    lead_data["follow_up_at"] = follow_up_at
                    logger.info(f"Row {idx}: Adding follow_up_at to lead_data: {follow_up_at}")
                
                # Add to batch for batch processing
                lead_data["_row_idx"] = idx  # Store row index for error reporting
                valid_leads_batch.append(lead_data)
                checked_duplicates.add(duplicate_key)  # Mark as processed
                
                # Process batch when it reaches batch_size
                if len(valid_leads_batch) >= batch_size:
                    try:
                        # Remove row index before inserting
                        batch_data = [{k: v for k, v in lead.items() if k != "_row_idx"} for lead in valid_leads_batch]
                        batch_result = batch_insert_leads(batch_data)
                        created_leads.extend(batch_result)
                        logger.info(f"Batch inserted {len(batch_result)} leads")
                    except Exception as batch_error:
                        error_str = str(batch_error).lower()
                        # Handle batch errors - try individual inserts
                        for lead_data_item in valid_leads_batch:
                            row_idx = lead_data_item.pop("_row_idx", "unknown")
                            try:
                                single_result = supabase_admin.table("leads").insert(lead_data_item).execute()
                                if single_result.data:
                                    created_leads.append(single_result.data[0])
                            except Exception as single_error:
                                single_error_str = str(single_error).lower()
                                if "duplicate" in single_error_str or "unique" in single_error_str or "violates" in single_error_str:
                                    duplicates.append(f"Row {row_idx}: Lead already exists (database constraint) - {lead_data_item.get('name', 'Unknown')}")
                                else:
                                    errors.append(f"Row {row_idx}: Database error - {str(single_error)}")
                        logger.error(f"Batch insert failed, processed individually: {batch_error}")
                    # Clear batch after processing
                    valid_leads_batch = []
                    
            except Exception as e:
                logger.error(f"Error processing row {idx}: {e}")
                errors.append(f"Row {idx}: {str(e)}")
        
        # Process remaining batch if any
        if valid_leads_batch:
            try:
                # Remove row index before inserting
                batch_data = [{k: v for k, v in lead.items() if k != "_row_idx"} for lead in valid_leads_batch]
                batch_result = batch_insert_leads(batch_data)
                created_leads.extend(batch_result)
                logger.info(f"Final batch inserted {len(batch_result)} leads")
            except Exception as batch_error:
                error_str = str(batch_error).lower()
                # Handle batch errors - try individual inserts
                for lead_data_item in valid_leads_batch:
                    row_idx = lead_data_item.pop("_row_idx", "unknown")
                    try:
                        single_result = supabase_admin.table("leads").insert(lead_data_item).execute()
                        if single_result.data:
                            created_leads.append(single_result.data[0])
                    except Exception as single_error:
                        single_error_str = str(single_error).lower()
                        if "duplicate" in single_error_str or "unique" in single_error_str or "violates" in single_error_str:
                            duplicates.append(f"Row {row_idx}: Lead already exists (database constraint) - {lead_data_item.get('name', 'Unknown')}")
                        else:
                            errors.append(f"Row {row_idx}: Database error - {str(single_error)}")
                logger.error(f"Final batch insert failed, processed individually: {batch_error}")
        
        # Send welcome emails to imported leads if Google connection exists
        emails_sent = 0
        if created_leads:
            try:
                # Check for Google connection
                connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user["id"]).execute()
                
                if connection.data:
                    conn_data = connection.data[0]
                    account_email = conn_data.get('account_email') or conn_data.get('email') or 'unknown'
                    logger.info(f"CSV Import: Found Google connection for account: {account_email}")
                    # Get user profile for business context (once for all leads)
                    profile = supabase_admin.table("profiles").select("*").eq("id", current_user["id"]).execute()
                    profile_data = profile.data[0] if profile.data else {}
                    
                    business_name = profile_data.get("business_name") or "our business"
                    business_description = profile_data.get("business_description") or ""
                    brand_voice = profile_data.get("brand_voice") or "professional"
                    brand_tone = profile_data.get("brand_tone") or "friendly"
                    
                    # Import Google connection functions
                    from routers.google_connections import send_gmail_message, User as GoogleUser
                    
                    # Create User object for send_gmail_message
                    created_at_value = current_user.get("created_at", "")
                    if created_at_value and hasattr(created_at_value, 'isoformat'):
                        created_at_str = created_at_value.isoformat()
                    elif created_at_value:
                        created_at_str = str(created_at_value)
                    else:
                        created_at_str = ""
                    
                    google_user = GoogleUser(
                        id=current_user["id"],
                        email=current_user["email"],
                        name=current_user["name"],
                        created_at=created_at_str
                    )
                    
                    logger.info(f"CSV Import: Google connection found for user {current_user['id']} ({current_user['email']}). Proceeding with email sending.")
                    
                    # Send emails to each lead - generate personalized email for each
                    openai_api_key = os.getenv("OPENAI_API_KEY")
                    
                    for lead in created_leads:
                        lead_id = lead.get("id")
                        lead_email = lead.get("email")
                        lead_name = lead.get("name") or "there"
                        lead_status = lead.get("status", "new")
                        lead_follow_up_at = lead.get("follow_up_at")
                        
                        # Parse follow_up_at if present
                        follow_up_at_dt = None
                        if lead_follow_up_at:
                            follow_up_at_dt = parse_follow_up_at(lead_follow_up_at)
                        
                        # Get created_at for date comparison
                        created_at_dt = None
                        lead_created_at = lead.get("created_at")
                        if lead_created_at:
                            try:
                                created_at_dt = datetime.fromisoformat(lead_created_at.replace('Z', '+00:00'))
                                if created_at_dt.tzinfo is None:
                                    created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
                            except Exception:
                                pass
                        
                        # Determine if email should be sent immediately
                        should_send_email = False
                        if lead_email and lead_status == "new":
                            should_send_email = should_send_email_immediately(follow_up_at_dt, created_at_dt)
                            
                            if should_send_email:
                                logger.info(f"CSV Import: Email will be sent immediately for lead {lead_id} (follow_up_at: {lead_follow_up_at})")
                            else:
                                logger.info(f"CSV Import: Email will be scheduled for future for lead {lead_id} (follow_up_at: {lead_follow_up_at})")
                        else:
                            if not lead_email:
                                logger.warning(f"CSV Import: Skipping email for lead {lead_id} - no email address")
                            if lead_status != "new":
                                logger.info(f"CSV Import: Skipping email for lead {lead_id} - status is '{lead_status}' (not 'new')")
                        
                        # Only send to leads with email and status "new" and should_send_email is True
                        if lead_email and lead_status == "new" and should_send_email:
                            logger.info(f"CSV Import: Attempting to send email to lead {lead_id} ({lead_email})")
                            try:
                                # Generate personalized email for this specific lead
                                email_subject = None
                                email_body = None
                                
                                if openai_api_key:
                                    try:
                                        openai_client = openai.OpenAI(api_key=openai_api_key)
                                        
                                        # Generate personalized email for this specific lead
                                        prompt = f"""
You are an expert email marketer writing a personalized thanking email to a new lead.

Business Information:
- Business Name: {business_name}
- Business Description: {business_description}
- Brand Voice: {brand_voice}
- Brand Tone: {brand_tone}

Lead Information:
- Name: {lead_name}
- Email: {lead_email}

Create a personalized, warm, and engaging thanking email that:
1. Thanks {lead_name} for contacting {business_name} (use the actual name: {lead_name})
2. Shows understanding of the business context: {business_description if business_description else 'their interest in our services'}
3. Provides an introductory message for further contact and engagement
4. Matches the brand voice ({brand_voice}) and tone ({brand_tone})
5. Is concise (under 200 words)
6. Uses HTML format with proper paragraph tags (<p>), line breaks (<br>), and formatting
7. Does NOT include links unless absolutely necessary
8. Is professional yet friendly and inviting
9. IMPORTANT: Use the actual lead name "{lead_name}" directly in the email, NOT a placeholder

Return a JSON object with:
- "subject": Email subject line (engaging and personalized, use the actual name {lead_name}, no HTML)
- "body": Email body in HTML format with proper tags (<p>, <br>, etc.), use the actual name {lead_name} directly in the text
"""
                                        
                                        response = openai_client.chat.completions.create(
                                            model="gpt-4",
                                            messages=[
                                                {"role": "system", "content": "You are an expert email marketer. Always respond with valid JSON. Always use the actual lead name provided, never use placeholders."},
                                                {"role": "user", "content": prompt}
                                            ],
                                            temperature=0.7,
                                            max_tokens=600
                                        )
                                        
                                        # Track token usage
                                        from services.token_usage_service import TokenUsageService
                                        if supabase_url and supabase_service_key:
                                            token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                                            await token_tracker.track_chat_completion_usage(
                                                user_id=current_user["id"],
                                                feature_type="lead_email",
                                                model_name="gpt-4",
                                                response=response,
                                                request_metadata={"lead_id": str(lead_id), "source": "csv_import"}
                                            )
                                        
                                        try:
                                            email_data = json.loads(response.choices[0].message.content)
                                            email_subject = email_data.get("subject", f"Thank you for contacting {business_name}")
                                            email_body = email_data.get("body", f"<p>Thank you {lead_name} for contacting {business_name}!</p><p>We appreciate your interest and look forward to connecting with you.</p>")
                                        except json.JSONDecodeError:
                                            content = response.choices[0].message.content
                                            email_subject = f"Thank you for contacting {business_name}"
                                            email_body = content
                                            # Fallback: replace any placeholders that might exist
                                            email_body = email_body.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                                            email_subject = email_subject.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                                    except Exception as email_gen_error:
                                        logger.error(f"Error generating email for lead {lead_id}: {email_gen_error}")
                                        # Fallback email
                                        email_subject = f"Thank you for contacting {business_name}"
                                        email_body = f"<p>Dear {lead_name},</p><p>Thank you for contacting {business_name}!</p><p>We appreciate your interest and look forward to connecting with you.</p>"
                                else:
                                    # Fallback if OpenAI is not available
                                    email_subject = f"Thank you for contacting {business_name}"
                                    email_body = f"<p>Dear {lead_name},</p><p>Thank you for contacting {business_name}!</p><p>We appreciate your interest and look forward to connecting with you.</p>"
                                
                                # Final safety check: ensure values are never None before replace()
                                if lead_name is None:
                                    lead_name = "there"
                                if business_name is None:
                                    business_name = "our business"
                                
                                # Replace any remaining placeholders
                                email_subject = email_subject.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                                email_body = email_body.replace("{lead_name}", lead_name).replace("{{lead_name}}", lead_name)
                                email_subject = email_subject.replace("{business_name}", business_name)
                                email_body = email_body.replace("{business_name}", business_name)
                                
                                logger.info(f"Sending personalized email to lead {lead_id}: {lead_name} ({lead_email})")
                                
                                # Send email
                                email_result = await send_gmail_message(
                                    to=lead_email,
                                    subject=email_subject,
                                    body=email_body,
                                    current_user=google_user
                                )
                                
                                if email_result.get("success"):
                                    # Store conversation
                                    supabase_admin.table("lead_conversations").insert({
                                        "lead_id": lead_id,
                                        "message_type": "email",
                                        "content": email_body,
                                        "sender": "agent",
                                        "direction": "outbound",
                                        "message_id": email_result.get("message_id"),
                                        "status": "sent"
                                    }).execute()
                                    
                                    # Update status to "contacted"
                                    supabase_admin.table("leads").update({
                                        "status": "contacted",
                                        "updated_at": datetime.now().isoformat()
                                    }).eq("id", lead_id).execute()
                                    
                                    # Create status history entry
                                    supabase_admin.table("lead_status_history").insert({
                                        "lead_id": lead_id,
                                        "old_status": "new",
                                        "new_status": "contacted",
                                        "changed_by": "system",
                                        "reason": "Automatic welcome email sent from CSV import"
                                    }).execute()
                                    
                                    emails_sent += 1
                                    logger.info(f"Welcome email sent to lead {lead_id} ({lead_email}) from CSV import")
                                    
                            except Exception as email_send_error:
                                error_str = str(email_send_error).lower()
                                
                                # Check if this is an authentication/connection error
                                if "unauthorized" in error_str or "connection has expired" in error_str or "reconnect" in error_str:
                                    logger.error(f"Google account connection expired for user {current_user['id']}. Email not sent to lead {lead_id} ({lead_email}). User needs to reconnect Google account.")
                                    # Don't continue trying to send more emails - connection is invalid
                                    break
                                else:
                                    logger.error(f"Error sending welcome email to lead {lead_id} ({lead_email}): {str(email_send_error)}")
                                    logger.error(f"Error type: {type(email_send_error).__name__}")
                                    import traceback
                                    logger.error(f"Traceback: {traceback.format_exc()}")
                                    # Continue with other leads even if one fails
                                    continue
                        else:
                            # Email not sent immediately - could be scheduled for future
                            if lead_email and lead_status == "new" and follow_up_at_dt:
                                logger.info(f"CSV Import: Email for lead {lead_id} will be scheduled for follow_up_at: {follow_up_at_dt.isoformat()}")
                                # TODO: Implement email scheduling for future dates
                                # For now, we log it but don't schedule (can be added in Phase 2)
                    
                    if emails_sent > 0:
                        logger.info(f"Sent {emails_sent} welcome emails to imported leads")
                    else:
                        logger.warning(f"CSV Import: No emails were sent. Check logs above for reasons (connection status, follow_up_at dates, lead status, etc.)")
                else:
                    logger.warning(f"No active Google connection found for user {current_user['id']} ({current_user['email']}). Skipping automatic welcome emails for CSV imported leads. Please connect your Google account to enable email sending.")
            except Exception as auto_email_error:
                logger.error(f"Error in automatic email sending for CSV import: {auto_email_error}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Don't fail the import if email sending fails
        
        # Build detailed message
        message_parts = [f"Successfully imported {len(created_leads)} out of {len(rows)} leads"]
        if len(duplicates) > 0:
            message_parts.append(f"{len(duplicates)} duplicate(s) skipped")
        if emails_sent > 0:
            message_parts.append(f"{emails_sent} welcome email(s) sent")
        elif len(created_leads) > 0:
            message_parts.append("No emails sent - check connection status and follow_up_at dates")
        
        return {
            "success": True,
            "total_rows": len(rows),
            "created": len(created_leads),
            "duplicates": len(duplicates),
            "errors": len(errors),
            "emails_sent": emails_sent,
            "error_details": errors[:10],  # Limit error details to first 10
            "duplicate_details": duplicates[:10],  # Limit duplicate details to first 10
            "message": ". ".join(message_parts) + "."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import CSV: {str(e)}")

@router.get("", response_model=List[LeadResponse])
async def get_leads(
    status: Optional[str] = Query(None),
    source_platform: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=1000),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get all leads for current user"""
    try:
        query = supabase_admin.table("leads").select("*").eq("user_id", current_user["id"])
        
        if status:
            query = query.eq("status", status)
        if source_platform:
            query = query.eq("source_platform", source_platform)
        
        # Add search functionality - search across name, email, and phone_number
        # This works for all leads regardless of source_platform
        use_python_filter = False
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            try:
                # Try using Supabase OR filter for server-side search
                query = query.or_(f"name.ilike.{search_term},email.ilike.{search_term},phone_number.ilike.{search_term}")
            except Exception as search_error:
                # Fallback: filter in Python if Supabase query fails
                logger.warning(f"Supabase OR query failed, will filter in Python: {search_error}")
                use_python_filter = True
        
        # If using Python filter, fetch more leads first for filtering
        if use_python_filter:
            query = query.order("created_at", desc=True).limit(1000).offset(0)
        else:
            query = query.order("created_at", desc=True).limit(limit).offset(offset)
        
        result = query.execute()
        leads = result.data if result.data else []
        
        # Apply Python-side filtering if Supabase query didn't work
        if use_python_filter and search and search.strip():
            search_lower = search.strip().lower()
            leads = [
                lead for lead in leads
                if (lead.get("name", "") and lead.get("name", "").lower().find(search_lower) >= 0) or
                   (lead.get("email", "") and lead.get("email", "").lower().find(search_lower) >= 0) or
                   (lead.get("phone_number", "") and lead.get("phone_number", "").lower().find(search_lower) >= 0)
            ]
            # Apply pagination after filtering
            leads = leads[offset:offset + limit]
        
        # Get last remarks for all leads
        if leads:
            lead_ids = [lead["id"] for lead in leads]
            
            # Get all status histories for these leads, ordered by created_at desc
            # We'll filter for the most recent one with a remark per lead
            status_history_result = supabase_admin.table("lead_status_history").select("lead_id, reason, created_at").in_("lead_id", lead_ids).order("created_at", desc=True).execute()
            
            # Create a map of lead_id to last remark
            last_remarks = {}
            seen_leads = set()
            
            if status_history_result.data:
                for history in status_history_result.data:
                    lead_id = history["lead_id"]
                    # Only take the first (most recent) entry with a remark for each lead
                    if lead_id not in seen_leads and history.get("reason"):
                        last_remarks[lead_id] = history["reason"]
                        seen_leads.add(lead_id)
            
            # Add last_remark to each lead
            for lead in leads:
                lead["last_remark"] = last_remarks.get(lead["id"])
        
        return leads
        
    except Exception as e:
        logger.error(f"Error getting leads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/email-templates")
async def get_email_templates(current_user: dict = Depends(get_current_user)):
    """Get available email templates"""
    templates = [
        {
            "id": "welcome",
            "name": "Welcome Email",
            "description": "A warm welcome email for new leads",
            "category": "welcome"
        },
        {
            "id": "follow-up",
            "name": "Follow-up Email",
            "description": "A follow-up email to re-engage leads",
            "category": "follow-up"
        },
        {
            "id": "inquiry",
            "name": "Product/Service Inquiry",
            "description": "An email responding to product or service inquiries",
            "category": "product-inquiry"
        },
        {
            "id": "pricing",
            "name": "Pricing Information",
            "description": "An email providing pricing details and value proposition",
            "category": "pricing"
        },
        {
            "id": "demo",
            "name": "Demo Request",
            "description": "An email for scheduling or confirming demo requests",
            "category": "demo"
        },
        {
            "id": "support",
            "name": "Support Response",
            "description": "A helpful support email addressing customer questions",
            "category": "support"
        },
        {
            "id": "custom",
            "name": "Custom Template",
            "description": "Create your own custom email template",
            "category": "general"
        }
    ]
    return {"templates": templates}

@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get lead by ID"""
    try:
        result = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{lead_id}/status")
async def update_lead_status(
    lead_id: str,
    request: UpdateLeadStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update lead status"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Update status
        supabase_admin.table("leads").update({
            "status": request.status,
            "updated_at": datetime.now().isoformat()
        }).eq("id", lead_id).execute()
        
        # Create status history entry
        supabase_admin.table("lead_status_history").insert({
            "lead_id": lead_id,
            "old_status": lead.data[0]["status"],
            "new_status": request.status,
            "changed_by": "user",
            "reason": request.remarks  # Store remarks as reason in history
        }).execute()
        
        return {"success": True, "status": request.status}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lead status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lead_id}/status-history")
async def get_status_history(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status history for a lead"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get status history
        result = supabase_admin.table("lead_status_history").select("*").eq("lead_id", lead_id).order("created_at", desc=True).execute()
        
        return result.data if result.data else []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting status history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{lead_id}/remarks")
async def add_remark(
    lead_id: str,
    request: AddRemarkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a remark to a lead without changing status"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        current_status = lead.data[0]["status"]
        
        # Create status history entry with same status (no change) but with remark
        supabase_admin.table("lead_status_history").insert({
            "lead_id": lead_id,
            "old_status": current_status,
            "new_status": current_status,  # Same status, no change
            "changed_by": "user",
            "reason": request.remarks  # Store remarks as reason in history
        }).execute()
        
        # Update lead's updated_at timestamp
        supabase_admin.table("leads").update({
            "updated_at": datetime.now().isoformat()
        }).eq("id", lead_id).execute()
        
        return {"success": True, "message": "Remark added successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding remark: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class UpdateFollowUpRequest(BaseModel):
    follow_up_at: Optional[str] = None  # ISO format datetime string

@router.put("/{lead_id}/follow-up")
async def update_follow_up(
    lead_id: str,
    request: UpdateFollowUpRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update follow-up date and time for a lead"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Update follow-up date
        update_data = {
            "updated_at": datetime.now().isoformat()
        }
        
        if request.follow_up_at:
            update_data["follow_up_at"] = request.follow_up_at
        else:
            update_data["follow_up_at"] = None
        
        result = supabase_admin.table("leads").update(update_data).eq("id", lead_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update follow-up")
        
        return {"success": True, "follow_up_at": result.data[0].get("follow_up_at")}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating follow-up: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a lead"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Delete related data first (status history, conversations)
        supabase_admin.table("lead_status_history").delete().eq("lead_id", lead_id).execute()
        supabase_admin.table("lead_conversations").delete().eq("lead_id", lead_id).execute()
        
        # Delete the lead
        result = supabase_admin.table("leads").delete().eq("id", lead_id).execute()
        
        if result.data:
            return {"success": True, "message": "Lead deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete lead")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Conversation Endpoints
@router.get("/{lead_id}/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    lead_id: str,
    message_type: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get conversation history for a lead"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        query = supabase_admin.table("lead_conversations").select("*").eq("lead_id", lead_id)
        
        if message_type:
            query = query.eq("message_type", message_type)
        
        query = query.order("created_at", desc=False).limit(limit)
        
        result = query.execute()
        return result.data if result.data else []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{lead_id}/message")
async def send_message_to_lead(
    lead_id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Manually send message to lead"""
    try:
        # Verify lead belongs to user
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        lead_data = lead.data[0]
        
        if request.message_type == "whatsapp":
            if not lead_data.get("phone_number"):
                raise HTTPException(status_code=400, detail="Lead has no phone number")
            
            whatsapp_service = WhatsAppService()
            result = await whatsapp_service.send_message(
                user_id=current_user["id"],
                phone_number=lead_data["phone_number"],
                message=request.message
            )
            
            if result.get("success"):
                supabase_admin.table("lead_conversations").insert({
                    "lead_id": lead_id,
                    "message_type": "whatsapp",
                    "content": request.message,
                    "sender": "agent",
                    "direction": "outbound",
                    "message_id": result.get("message_id"),
                    "status": "sent"
                }).execute()
            
            return result
            
        elif request.message_type == "email":
            if not lead_data.get("email"):
                raise HTTPException(status_code=400, detail="Lead has no email address")
            
            # Check for Google connection
            connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user["id"]).execute()
            
            if not connection.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No active Google connection found. Please connect your Google account to send emails."
                )
            
            # Use Gmail API to send email
            # Import here to avoid circular dependency
            from routers.google_connections import send_gmail_message, User as GoogleUser
            
            try:
                # Create User object for send_gmail_message
                # Convert created_at to string if it's a datetime object
                created_at_value = current_user.get("created_at", "")
                if created_at_value and hasattr(created_at_value, 'isoformat'):
                    created_at_str = created_at_value.isoformat()
                elif created_at_value:
                    created_at_str = str(created_at_value)
                else:
                    created_at_str = ""
                
                google_user = GoogleUser(
                    id=current_user["id"],
                    email=current_user["email"],
                    name=current_user["name"],
                    created_at=created_at_str
                )
                
                result = await send_gmail_message(
                    to=lead_data["email"],
                    subject=f"Message from {current_user.get('name', 'Your Business')}",
                    body=request.message,
                    current_user=google_user
                )
                
                if result.get("success"):
                    # Store conversation
                    supabase_admin.table("lead_conversations").insert({
                        "lead_id": lead_id,
                        "message_type": "email",
                        "content": request.message,
                        "sender": "agent",
                        "direction": "outbound",
                        "message_id": result.get("message_id"),
                        "status": "sent"
                    }).execute()
                
                return result
            except Exception as e:
                logger.error(f"Error sending email via Gmail: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
        
        else:
            raise HTTPException(status_code=400, detail="Invalid message_type")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WhatsApp Connection Request Model
class WhatsAppConnectionRequest(BaseModel):
    phone_number_id: str
    access_token: str
    business_account_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None

# WhatsApp Connection Endpoints
@router.post("/whatsapp/connect")
async def connect_whatsapp(
    request: WhatsAppConnectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Connect WhatsApp Business API account"""
    try:
        whatsapp_service = WhatsAppService()
        result = whatsapp_service.create_or_update_whatsapp_connection(
            user_id=current_user["id"],
            phone_number_id=request.phone_number_id,
            access_token=request.access_token,
            business_account_id=request.business_account_id,
            whatsapp_business_account_id=request.whatsapp_business_account_id
        )
        
        return {"success": True, "connection": result}
        
    except Exception as e:
        logger.error(f"Error connecting WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whatsapp/connection")
async def get_whatsapp_connection(current_user: dict = Depends(get_current_user)):
    """Get WhatsApp connection for current user"""
    try:
        whatsapp_service = WhatsAppService()
        connection = whatsapp_service.get_whatsapp_connection(current_user["id"])
        
        if not connection:
            raise HTTPException(status_code=404, detail="No WhatsApp connection found")
        
        # Don't return encrypted token
        connection.pop("access_token_encrypted", None)
        return connection
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting WhatsApp connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/google/connection")
async def get_google_connection(current_user: dict = Depends(get_current_user)):
    """Get Google connection status for current user"""
    try:
        # Check for Google connection
        connection = supabase_admin.table('platform_connections').select('*').eq('platform', 'google').eq('is_active', True).eq('user_id', current_user["id"]).execute()
        
        if not connection.data:
            return {
                "connected": False,
                "message": "No active Google connection found",
                "user_id": current_user["id"]
            }
        
        conn = connection.data[0]
        # Don't return encrypted tokens
        return {
            "connected": True,
            "user_id": current_user["id"],
            "connection_id": conn.get('id'),
            "page_name": conn.get('page_name'),
            "email": conn.get('page_name'),  # Usually email for Google
            "connected_at": conn.get('connected_at'),
            "connection_status": conn.get('connection_status')
        }
        
    except Exception as e:
        logger.error(f"Error getting Google connection: {e}")
        return {
            "connected": False,
            "error": f"Error checking connection: {str(e)}",
            "user_id": current_user["id"]
        }

@router.post("/{lead_id}/generate-email")
async def generate_email(
    lead_id: str,
    request: GenerateEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate personalized email for a lead"""
    try:
        # Verify lead belongs to user and fetch lead data
        lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        lead_data = lead.data[0]
        
        if not lead_data.get("email"):
            raise HTTPException(status_code=400, detail="Lead has no email address")
        
        # Get user profile for business context
        profile = supabase_admin.table("profiles").select("*").eq("id", current_user["id"]).execute()
        profile_data = profile.data[0] if profile.data else {}
        
        # Prepare business context
        business_name = profile_data.get("business_name", "our business")
        business_description = profile_data.get("business_description", "")
        brand_voice = profile_data.get("brand_voice", "professional")
        brand_tone = profile_data.get("brand_tone", "friendly")
        
        # Prepare lead context
        lead_name = lead_data.get("name", "there")
        lead_email = lead_data.get("email", "")
        form_data = lead_data.get("form_data", {})
        form_context = "\n".join([f"- {k}: {v}" for k, v in form_data.items()]) if form_data else ""
        
        # Use custom prompt if provided, otherwise use category/template-based prompts
        if request.custom_prompt:
            email_instructions = request.custom_prompt
        else:
            # Category-based prompts
            category_prompts = {
                "general": """Create a personalized email that:
1. Is professional and engaging
2. Matches the brand voice and tone
3. Is concise and clear
4. Does NOT require links unless specifically needed""",
                "welcome": """Create a personalized welcome email that:
1. Thanks them for their interest
2. Introduces the business briefly
3. Highlights key value propositions
4. Is warm and inviting
5. Matches the brand voice and tone
6. Does NOT require links unless specifically needed
7. Is concise (under 200 words)""",
                "follow-up": """Create a personalized follow-up email that:
1. References their previous interest
2. Provides additional value or information
3. Addresses potential concerns
4. Is helpful and non-pushy
5. Matches the brand voice and tone
6. Does NOT require links unless specifically needed
7. Is concise (under 200 words)""",
                "product-inquiry": """Create a personalized response email that:
1. Acknowledges their inquiry
2. Provides detailed information about the product/service
3. Answers any specific questions from their form responses
4. Is informative and helpful
5. Matches the brand voice and tone
6. Does NOT require links unless specifically needed
7. Is concise (under 300 words)""",
                "pricing": """Create a personalized pricing information email that:
1. Acknowledges their interest in pricing
2. Provides clear pricing information
3. Explains value proposition
4. Is transparent and helpful
5. Matches the brand voice and tone
6. Does NOT require links unless specifically needed
7. Is concise (under 250 words)""",
                "demo": """Create a personalized demo request email that:
1. Acknowledges their demo request
2. Provides next steps
3. Sets expectations
4. Is professional and helpful
5. Matches the brand voice and tone
6. Does NOT require links unless specifically needed
7. Is concise (under 200 words)""",
                "support": """Create a personalized support email that:
1. Acknowledges their support request
2. Provides helpful information
3. Offers solutions
4. Is empathetic and professional
5. Matches the brand voice and tone
6. Does NOT require links unless specifically needed
7. Is concise (under 250 words)""",
                "newsletter": """Create a personalized newsletter email that:
1. Provides valuable content
2. Is engaging and informative
3. Matches the brand voice and tone
4. Does NOT require links unless specifically needed
5. Is concise (under 300 words)""",
                "promotional": """Create a personalized promotional email that:
1. Highlights special offers or features
2. Creates urgency if appropriate
3. Is exciting but not pushy
4. Matches the brand voice and tone
5. Does NOT require links unless specifically needed
6. Is concise (under 250 words)"""
            }
            
            # Template-based prompts (fallback)
            template_prompts = {
                "welcome": category_prompts["welcome"],
                "follow-up": category_prompts["follow-up"],
                "inquiry": category_prompts["product-inquiry"],
                "custom": request.custom_template or "Create a personalized email based on the custom template provided. Do NOT require links unless specifically needed."
            }
            
            # Use category if available, otherwise use template
            if request.category and request.category in category_prompts:
                email_instructions = category_prompts[request.category]
            else:
                email_instructions = template_prompts.get(request.template, category_prompts["general"])
        
        # Build OpenAI prompt
        prompt = f"""
You are an expert email marketer writing a personalized email to a lead.

Business Information:
- Business Name: {business_name}
- Business Description: {business_description}
- Brand Voice: {brand_voice}
- Brand Tone: {brand_tone}

Lead Information:
- Name: {lead_name}
- Email: {lead_email}
- Form Responses: {form_context if form_context else "None provided"}

Email Requirements:
{email_instructions}

IMPORTANT:
- Use HTML format for the email body with proper paragraph tags (<p>), line breaks (<br>), and formatting
- Do NOT include links unless they are absolutely necessary for the email purpose
- If you must include a link, use a placeholder like "your website" or "contact us" instead of actual URLs
- Format the email body as clean HTML with proper structure
- Keep paragraphs concise and well-formatted

Return a JSON object with:
- "subject": Email subject line (engaging and personalized, no HTML)
- "body": Email body in HTML format with proper tags (<p>, <br>, etc.) but NO links unless absolutely necessary
"""
        
        # Initialize OpenAI client
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        openai_client = openai.OpenAI(api_key=openai_api_key)
        
        # Generate email
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert email marketer. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        
        # Track token usage
        from services.token_usage_service import TokenUsageService
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if supabase_url and supabase_service_key:
            token_tracker = TokenUsageService(supabase_url, supabase_service_key)
            await token_tracker.track_chat_completion_usage(
                user_id=current_user["id"],
                feature_type="lead_email",
                model_name="gpt-4",
                response=response,
                request_metadata={"lead_id": lead_id}
            )
        
        try:
            email_data = json.loads(response.choices[0].message.content)
            subject = email_data.get("subject", f"Thank you for your interest in {business_name}")
            body = email_data.get("body", f"Thank you {lead_name} for your interest!")
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            content = response.choices[0].message.content
            subject = f"Thank you for your interest in {business_name}"
            body = content
        
        return {
            "success": True,
            "subject": subject,
            "body": body,
            "lead_name": lead_name,
            "lead_email": lead_email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-delete")
async def bulk_delete_leads(
    request: BulkDeleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple leads"""
    try:
        if not request.lead_ids or len(request.lead_ids) == 0:
            raise HTTPException(status_code=400, detail="No lead IDs provided")
        
        success_count = 0
        failed_count = 0
        failed_ids = []
        
        for lead_id in request.lead_ids:
            try:
                # Verify lead belongs to user
                lead = supabase_admin.table("leads").select("*").eq("id", lead_id).eq("user_id", current_user["id"]).execute()
                if not lead.data:
                    failed_count += 1
                    failed_ids.append(lead_id)
                    continue
                
                # Delete associated data
                supabase_admin.table("lead_status_history").delete().eq("lead_id", lead_id).execute()
                supabase_admin.table("lead_conversations").delete().eq("lead_id", lead_id).execute()
                
                # Delete the lead
                result = supabase_admin.table("leads").delete().eq("id", lead_id).execute()
                
                if result.data:
                    success_count += 1
                else:
                    failed_count += 1
                    failed_ids.append(lead_id)
                    
            except Exception as e:
                logger.error(f"Error deleting lead {lead_id}: {e}")
                failed_count += 1
                failed_ids.append(lead_id)
        
        return {
            "success": True,
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_ids": failed_ids,
            "message": f"Deleted {success_count} lead(s), {failed_count} failed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk delete: {e}")
        raise HTTPException(status_code=500, detail=str(e))

