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

from agents.lead_management_agent import LeadManagementAgent
from services.whatsapp_service import WhatsAppService
from supabase import create_client, Client
from dotenv import load_dotenv

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

class SendMessageRequest(BaseModel):
    message: str
    message_type: str = "whatsapp"  # whatsapp or email

class CreateLeadRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    source_platform: str = "manual"  # manual, facebook, instagram
    status: str = "new"
    form_data: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

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

# Lead CRUD Endpoints
@router.post("", response_model=LeadResponse)
async def create_lead(
    request: CreateLeadRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new lead manually"""
    try:
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
        
        result = supabase_admin.table("leads").insert(lead_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create lead")
        
        return result.data[0]
        
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
        
        # Read file content
        contents = await file.read()
        file_content = contents.decode('utf-8')
        
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
                else:
                    logger.info(f"Row {idx}: No follow_up_at to add (value was None or parsing failed)")
                
                # Insert lead
                logger.info(f"Row {idx}: Inserting lead with data keys: {list(lead_data.keys())}")
                if 'follow_up_at' in lead_data:
                    logger.info(f"Row {idx}: follow_up_at value before insert: {lead_data.get('follow_up_at')}")
                
                result = supabase_admin.table("leads").insert(lead_data).execute()
                
                if result.data:
                    inserted_lead = result.data[0]
                    logger.info(f"Row {idx}: Lead inserted successfully. follow_up_at in response: {inserted_lead.get('follow_up_at')}")
                    created_leads.append(inserted_lead)
                else:
                    logger.error(f"Row {idx}: Insert returned no data. Response: {result}")
                    errors.append(f"Row {idx}: Failed to create lead")
                    
            except Exception as e:
                logger.error(f"Error processing row {idx}: {e}")
                errors.append(f"Row {idx}: {str(e)}")
        
        return {
            "success": True,
            "total_rows": len(rows),
            "created": len(created_leads),
            "errors": len(errors),
            "error_details": errors[:10],  # Limit error details to first 10
            "message": f"Successfully imported {len(created_leads)} out of {len(rows)} leads"
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
    limit: int = Query(50, le=100),
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
        
        query = query.order("created_at", desc=True).limit(limit).offset(offset)
        
        result = query.execute()
        return result.data if result.data else []
        
    except Exception as e:
        logger.error(f"Error getting leads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
            
            # Use Gmail API to send email
            from routers.google_connections import send_gmail_message
            # This would need to be adapted to work here
            raise HTTPException(status_code=501, detail="Email sending via this endpoint not yet implemented")
        
        else:
            raise HTTPException(status_code=400, detail="Invalid message_type")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WhatsApp Connection Endpoints
@router.post("/whatsapp/connect")
async def connect_whatsapp(
    phone_number_id: str,
    access_token: str,
    business_account_id: Optional[str] = None,
    whatsapp_business_account_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Connect WhatsApp Business API account"""
    try:
        whatsapp_service = WhatsAppService()
        result = whatsapp_service.create_or_update_whatsapp_connection(
            user_id=current_user["id"],
            phone_number_id=phone_number_id,
            access_token=access_token,
            business_account_id=business_account_id,
            whatsapp_business_account_id=whatsapp_business_account_id
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

