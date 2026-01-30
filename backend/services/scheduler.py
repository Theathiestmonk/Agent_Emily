"""
ANALYTICS SCHEDULER SERVICE

APScheduler configuration for daily analytics collection.
Runs at 2:00 AM UTC daily to collect account-level metrics from all platforms.

Functions:
- start_analytics_scheduler(): Initialize and start the scheduler
- stop_analytics_scheduler(): Stop the scheduler gracefully
- get_scheduler_status(): Get current scheduler status and jobs
- trigger_analytics_collection_now(): Manual trigger for testing
"""

import os
import logging
from datetime import datetime
from typing import Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

import asyncio
from .analytics_collector import collect_daily_analytics

# Configure logging
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None

async def run_analytics_collection_job():
    """
    Async wrapper for the daily analytics collection job.
    Runs the synchronous collect_daily_analytics() in a thread pool.
    """
    try:
        logger.info("🔄 Starting analytics collection job")

        # Run the synchronous function in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, collect_daily_analytics)

        logger.info("✅ Analytics collection job completed")
        return result

    except Exception as e:
        logger.error(f"❌ Error in analytics collection job: {e}")
        raise

def start_analytics_scheduler():
    """
    Initialize and start the analytics collection scheduler.
    Runs daily at 2:00 AM UTC.
    """
    global scheduler

    if scheduler is not None:
        logger.warning("Analytics scheduler is already running")
        return

    try:
        # Create scheduler with memory job store
        scheduler = AsyncIOScheduler(
            jobstores={
                'default': MemoryJobStore()
            },
            executors={
                'default': AsyncIOExecutor()
            },
            job_defaults={
                'coalesce': True,  # Combine multiple runs if missed
                'max_instances': 1,  # Only one instance at a time
                'misfire_grace_time': 3600  # 1 hour grace period for missed runs
            },
            timezone='UTC'
        )

        # Add the daily analytics collection job
        scheduler.add_job(
            func=run_analytics_collection_job,
            trigger=CronTrigger(hour=2, minute=0),  # 2:00 AM UTC daily
            id='daily_analytics_collection',
            name='Daily Analytics Collection',
            replace_existing=True
        )

        # Start the scheduler
        scheduler.start()
        logger.info("✅ Analytics scheduler started successfully - runs daily at 2:00 AM UTC")

    except Exception as e:
        logger.error(f"❌ Failed to start analytics scheduler: {e}")
        raise

def stop_analytics_scheduler():
    """
    Stop the analytics scheduler gracefully.
    """
    global scheduler

    if scheduler is None:
        logger.warning("Analytics scheduler is not running")
        return

    try:
        scheduler.shutdown(wait=True)
        scheduler = None
        logger.info("✅ Analytics scheduler stopped successfully")

    except Exception as e:
        logger.error(f"❌ Error stopping analytics scheduler: {e}")
        raise

def get_scheduler_status() -> Dict[str, Any]:
    """
    Get the current status of the analytics scheduler.

    Returns:
        Dict containing scheduler status and job information
    """
    global scheduler

    if scheduler is None:
        return {
            "status": "stopped",
            "jobs": [],
            "message": "Scheduler is not initialized"
        }

    try:
        jobs = []
        for job in scheduler.get_jobs():
            job_info = {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            }
            jobs.append(job_info)

        return {
            "status": "running",
            "jobs": jobs,
            "scheduler_info": {
                "running": scheduler.running,
                "timezone": str(scheduler.timezone)
            }
        }

    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}")
        return {
            "status": "error",
            "jobs": [],
            "error": str(e)
        }

async def trigger_analytics_collection_now() -> Dict[str, Any]:
    """
    Manually trigger analytics collection for testing/debugging.

    Returns:
        Dict with trigger result information
    """
    try:
        logger.info("🔄 Manual analytics collection triggered")

        # Run the collection job
        stats = await run_analytics_collection_job()

        return {
            "success": True,
            "message": "Analytics collection job completed",
            "stats": stats,
            "triggered_at": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Error in manual analytics collection trigger: {e}")
        return {
            "success": False,
            "error": str(e),
            "triggered_at": datetime.now().isoformat()
        }
