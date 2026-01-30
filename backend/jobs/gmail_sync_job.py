#!/usr/bin/env python3
"""
Gmail Sync Job
Scheduled job to automatically sync Gmail inboxes for all users
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import os
import json

from supabase import create_client, Client
from cryptography.fernet import Fernet

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GmailSyncJob:
    """
    Job to automatically sync Gmail inboxes for all users
    """

    def __init__(self):
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

        self.supabase = create_client(supabase_url, supabase_service_key)

        # Get encryption key for tokens
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY must be set")
        self.cipher = Fernet(encryption_key.encode())

    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt an encrypted token"""
        try:
            return self.cipher.decrypt(encrypted_token.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt token: {e}")
            raise

    async def sync_all_users_gmail(self) -> Dict[str, Any]:
        """
        Sync Gmail for all users who have Gmail sync enabled
        """
        try:
            logger.info("🚀 Starting Gmail sync job for all users")

            # Get all users with active Google connections
            # Note: metadata column may not exist yet - will be added by migration
            try:
                users_result = self.supabase.table("platform_connections").select("""
                    user_id,
                    metadata,
                    access_token_encrypted,
                    refresh_token_encrypted
                """).eq("platform", "google").eq("is_active", True).execute()
            except Exception as e:
                if "does not exist" in str(e):
                    # Fallback: get connections without metadata column
                    logger.warning("📧 metadata column not found, using fallback query without Gmail sync settings")
                    users_result = self.supabase.table("platform_connections").select("""
                        user_id,
                        access_token_encrypted,
                        refresh_token_encrypted
                    """).eq("platform", "google").eq("is_active", True).execute()

                    # Add empty metadata for all results
                    for user in users_result.data or []:
                        user['metadata'] = {}
                else:
                    raise e

            if not users_result.data:
                logger.info("📧 No users found with active Google connections")
                return {
                    "success": True,
                    "message": "No users with active Google connections",
                    "users_processed": 0,
                    "emails_synced": 0
                }

            logger.info(f"📧 Found {len(users_result.data)} users with active Google connections")

            total_emails_synced = 0
            users_processed = 0
            users_with_sync_enabled = 0

            for connection in users_result.data:
                try:
                    user_id = connection["user_id"]
                    metadata = connection.get("metadata") or {}

                    # Check if Gmail sync is enabled for this user
                    gmail_sync_enabled = metadata.get("gmail_sync_enabled", False) if metadata else False
                    if not gmail_sync_enabled:
                        logger.info(f"📧 Gmail sync not enabled for user {user_id}")
                        continue

                    users_with_sync_enabled += 1

                    # Check last sync time to avoid too frequent syncing (15-minute intervals)
                    last_sync = metadata.get("gmail_last_sync")
                    if last_sync:
                        last_sync_datetime = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
                        # Don't sync more than once per 10 minutes (allows for scheduler variations)
                        if datetime.now(last_sync_datetime.tzinfo) - last_sync_datetime < timedelta(minutes=10):
                            logger.debug(f"📧 Skipping user {user_id} - last sync too recent")
                            continue

                    # Perform Gmail sync for this user
                    sync_result = await self.sync_user_gmail(user_id, connection)

                    if sync_result["success"]:
                        total_emails_synced += sync_result["emails_stored"]
                        users_processed += 1

                        # Update last sync time
                        updated_metadata = {
                            **metadata,
                            "gmail_last_sync": datetime.now().isoformat(),
                            "gmail_sync_status": "completed"
                        }

                        self.supabase.table("platform_connections").update({
                            "metadata": updated_metadata
                        }).eq("user_id", user_id).eq("platform", "google").execute()

                        logger.info(f"✅ Synced {sync_result['emails_stored']} emails for user {user_id}")
                    else:
                        error_msg = sync_result.get('error', 'Unknown error')
                        logger.warning(f"❌ Failed to sync Gmail for user {user_id}: {error_msg}")

                        # Update sync status with error
                        updated_metadata = {
                            **metadata,
                            "gmail_last_sync": datetime.now().isoformat(),
                            "gmail_sync_status": "failed",
                            "gmail_sync_error": error_msg
                        }

                        self.supabase.table("platform_connections").update({
                            "metadata": updated_metadata
                        }).eq("user_id", user_id).eq("platform", "google").execute()

                except Exception as user_error:
                    logger.error(f"❌ Error processing user {connection['user_id']}: {user_error}")
                    continue

            logger.info(f"🎉 Gmail sync job completed: {users_processed}/{users_with_sync_enabled} users processed, {total_emails_synced} emails synced")

            return {
                "success": True,
                "message": f"Successfully synced Gmail for {users_processed} users",
                "users_processed": users_processed,
                "users_with_sync_enabled": users_with_sync_enabled,
                "emails_synced": total_emails_synced
            }

        except Exception as e:
            logger.error(f"❌ Error in Gmail sync job: {e}")
            return {
                "success": False,
                "error": str(e),
                "users_processed": 0,
                "emails_synced": 0
            }

    async def sync_user_gmail(self, user_id: str, connection: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync Gmail for a specific user
        """
        try:
            # Import the Gmail sync helper function
            from routers.google_connections import sync_gmail_inbox_for_user

            # Get user's email from Supabase auth system
            try:
                auth_user = self.supabase.auth.admin.get_user_by_id(user_id)
                user_email = auth_user.user.email if auth_user.user else None
                if not user_email:
                    logger.warning(f"❌ Could not get email for user {user_id} from auth system")
                    return {
                        "success": False,
                        "error": "Could not determine user email",
                        "emails_stored": 0
                    }
            except Exception as email_error:
                logger.warning(f"❌ Error getting email for user {user_id}: {email_error}")
                return {
                    "success": False,
                    "error": f"Email retrieval error: {str(email_error)}",
                    "emails_stored": 0
                }

            # Call the sync function directly
            result = await sync_gmail_inbox_for_user(
                user_id=user_id,
                user_email=user_email,
                days_back=2,  # Sync last 2 days (API-efficient)
                max_emails=50  # Max 50 emails per sync (API-efficient)
            )

            return result

        except Exception as e:
            logger.error(f"❌ Error syncing Gmail for user {user_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "emails_stored": 0
            }

async def run_gmail_sync_job():
    """
    Main function to run the Gmail sync job
    """
    try:
        job = GmailSyncJob()
        result = await job.sync_all_users_gmail()

        if result["success"]:
            logger.info(f"✅ Gmail sync job completed successfully: {result}")
        else:
            logger.error(f"❌ Gmail sync job failed: {result}")

        return result

    except Exception as e:
        logger.error(f"❌ Fatal error in Gmail sync job: {e}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # Run the job directly for testing
    asyncio.run(run_gmail_sync_job())
