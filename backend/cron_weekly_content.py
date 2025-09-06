#!/usr/bin/env python3
"""
Cron job script for weekly content generation
Runs every Sunday at 3:30 AM IST
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from scheduler.content_scheduler import run_weekly_content_generation

async def main():
    """Main function for cron job"""
    try:
        print(f"Starting weekly content generation at {asyncio.get_event_loop().time()}")
        result = await run_weekly_content_generation()
        print(f"Weekly content generation completed: {result}")
        return result
    except Exception as e:
        print(f"Error in weekly content generation: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    asyncio.run(main())