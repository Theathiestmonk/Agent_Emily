"""
Daily Messages Scheduler
Sends scheduled WhatsApp-style messages to users at specific times throughout the day
"""

import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Optional, List
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from agents.scheduled_messages import (
    generate_morning_message,
    generate_mid_morning_message,
    generate_afternoon_message,
    generate_evening_message,
    generate_night_message,
    get_user_timezone
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler: Optional[AsyncIOScheduler] = None


async def check_and_send_all_messages():
    """Check all message types and send to users where it's the right time"""
    message_types = ["morning", "mid_morning", "afternoon", "evening", "night"]
    for msg_type in message_types:
        await send_scheduled_messages(msg_type)

async def send_scheduled_messages(message_type: str):
    """Send scheduled messages to all active users"""
    try:
        from supabase import create_client
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        supabase = create_client(supabase_url, supabase_key)
        
        # Get all users with completed onboarding
        profiles = supabase.table("profiles").select("id, timezone").eq("onboarding_completed", True).execute()
        
        if not profiles.data:
            logger.info(f"No active users found for {message_type} message")
            return
        
        logger.info(f"Checking {message_type} messages for {len(profiles.data)} users")
        
        # Define target times for each message type
        target_times = {
            "morning": (9, 0),
            "mid_morning": (11, 30),
            "afternoon": (14, 0),
            "evening": (18, 0),
            "night": (21, 30)
        }
        
        target_hour, target_minute = target_times.get(message_type, (9, 0))
        
        success_count = 0
        error_count = 0
        
        for profile in profiles.data:
            user_id = profile["id"]
            user_tz = profile.get("timezone") or "UTC"
            
            try:
                # Get current time in user's timezone
                try:
                    user_timezone = pytz.timezone(user_tz)
                except:
                    # Invalid timezone, use UTC
                    user_timezone = pytz.UTC
                    user_tz = "UTC"
                
                now = datetime.now(user_timezone)
                
                # Check if it's the right time for this user (within 1 hour window)
                # This allows for some flexibility in when the cron job runs
                if now.hour == target_hour and abs(now.minute - target_minute) <= 30:
                    # It's the right time for this user
                    logger.info(f"Generating {message_type} message for user {user_id}")
                    
                    result = None
                    if message_type == "morning":
                        result = generate_morning_message(user_id, user_tz)
                    elif message_type == "mid_morning":
                        result = generate_mid_morning_message(user_id, user_tz)
                    elif message_type == "afternoon":
                        result = generate_afternoon_message(user_id, user_tz)
                    elif message_type == "evening":
                        result = generate_evening_message(user_id, user_tz)
                    elif message_type == "night":
                        result = generate_night_message(user_id, user_tz)
                    
                    if result and result.get("success"):
                        # Store message in database
                        scheduled_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
                        
                        # Convert to UTC for storage
                        scheduled_time_utc = scheduled_time.astimezone(pytz.UTC)
                        
                        message_data = {
                            "user_id": user_id,
                            "message_type": message_type,
                            "content": result["content"],
                            "scheduled_time": scheduled_time_utc.isoformat(),
                            "metadata": result.get("metadata", {}),
                            "is_delivered": False
                        }
                        
                        insert_result = supabase.table("chatbot_scheduled_messages").insert(message_data).execute()
                        
                        if insert_result.data:
                            success_count += 1
                            logger.info(f"Successfully created {message_type} message for user {user_id}")
                        else:
                            error_count += 1
                            logger.error(f"Failed to store {message_type} message for user {user_id}")
                    else:
                        error_count += 1
                        logger.error(f"Failed to generate {message_type} message for user {user_id}: {result.get('error', 'Unknown error') if result else 'No result'}")
                else:
                    # Not the right time for this user, skip
                    continue
                    
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing {message_type} message for user {user_id}: {e}")
        
        logger.info(f"Completed {message_type} message sending: {success_count} success, {error_count} errors")
        
    except Exception as e:
        logger.error(f"Error in send_scheduled_messages for {message_type}: {e}")


async def start_daily_messages_scheduler():
    """Start the daily messages scheduler"""
    global scheduler
    
    if scheduler and scheduler.running:
        logger.warning("Daily messages scheduler is already running")
        return
    
    scheduler = AsyncIOScheduler()
    
    # Run every hour to check all message types for all users
    # This ensures messages are sent at the right time for each user's timezone
    scheduler.add_job(
        check_and_send_all_messages,
        CronTrigger(minute=0),  # Run at the top of every hour
        id="hourly_message_check",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Daily messages scheduler started")
    logger.info("Checking for scheduled messages every hour (9:00 AM, 11:30 AM, 2:00 PM, 6:00 PM, 9:30 PM in user's local timezone)")


async def stop_daily_messages_scheduler():
    """Stop the daily messages scheduler"""
    global scheduler
    
    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("Daily messages scheduler stopped")
    else:
        logger.warning("Daily messages scheduler is not running")


async def trigger_message_manually(message_type: str, user_id: Optional[str] = None):
    """Manually trigger a message for testing"""
    try:
        if user_id:
            # Send to specific user
            user_tz = get_user_timezone(user_id)
            if message_type == "morning":
                result = generate_morning_message(user_id, user_tz)
            elif message_type == "mid_morning":
                result = generate_mid_morning_message(user_id, user_tz)
            elif message_type == "afternoon":
                result = generate_afternoon_message(user_id, user_tz)
            elif message_type == "evening":
                result = generate_evening_message(user_id, user_tz)
            elif message_type == "night":
                result = generate_night_message(user_id, user_tz)
            else:
                return {"success": False, "error": "Invalid message type"}
            
            return result
        else:
            # Send to all users
            await send_scheduled_messages(message_type)
            return {"success": True, "message": f"Triggered {message_type} message for all users"}
    except Exception as e:
        logger.error(f"Error triggering message manually: {e}")
        return {"success": False, "error": str(e)}

