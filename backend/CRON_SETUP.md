# Weekly Content Generation Cron Job Setup

## Overview
This document describes the cron job setup for automatic weekly content generation every Sunday at 3:40 AM IST.

## Files Created
- `cron_weekly_content.py` - Python script that runs the content generation
- `run_weekly_content.sh` - Shell script wrapper that sets up the environment
- `cron.log` - Log file for cron job execution

## Cron Job Details
- **Schedule**: Every Sunday at 3:40 AM IST
- **Cron Expression**: `40 3 * * 0`
- **Command**: `/Users/macbookpro/Desktop/Emily1.0/backend/run_weekly_content.sh`
- **Log File**: `/Users/macbookpro/Desktop/Emily1.0/backend/cron.log`

## What It Does
1. Activates the Python virtual environment
2. Sets up the Python path
3. Runs the weekly content generation for all users with completed onboarding
4. Generates content for all configured social media platforms
5. Stores the generated content in Supabase
6. Logs the execution results

## Monitoring
- Check the log file: `tail -f /Users/macbookpro/Desktop/Emily1.0/backend/cron.log`
- View cron job status: `crontab -l`
- Check cron service: `sudo launchctl list | grep cron`

## Manual Testing
To test the cron job manually:
```bash
cd /Users/macbookpro/Desktop/Emily1.0/backend
./run_weekly_content.sh
```

## Troubleshooting
- Ensure the virtual environment exists and has all dependencies
- Check that environment variables are set in `.env` file
- Verify Supabase connection and API keys
- Check file permissions on the shell script

## Expected Output
The cron job will generate:
- 7 posts per platform per user
- Content for Facebook, Instagram, LinkedIn, YouTube, and Twitter/X
- Total of 35 posts per user per week
- All content stored in Supabase database
