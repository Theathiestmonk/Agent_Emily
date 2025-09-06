# Background Scheduler for Weekly Content Generation

## Overview
This document describes the background scheduler system that automatically generates content every Sunday at 4:00 AM IST when the server is running. This approach works perfectly with cloud deployments like Render and Vercel.

## How It Works
- **Automatic Startup**: The scheduler starts automatically when the FastAPI server starts
- **Time-based Execution**: Runs every Sunday at 4:00 AM IST
- **Cloud-friendly**: Works on Render, Vercel, and other cloud platforms
- **Prevents Duplicates**: Uses marker files to avoid running multiple times per week
- **Background Process**: Runs in the background without blocking the API

## Files Created
- `scheduler/background_scheduler.py` - Main scheduler implementation
- `scheduler/weekly_run_YYYY_MM_DD.marker` - Marker files to prevent duplicate runs
- Manual trigger endpoint: `POST /content/trigger-weekly`

## Schedule Details
- **Time**: Every Sunday at 4:00 AM IST
- **Timezone**: Asia/Kolkata (IST)
- **Frequency**: Once per week
- **Prevention**: Marker files prevent multiple runs per week

## Features
1. **Automatic Detection**: Checks if it's Sunday at 4:00 AM IST
2. **Duplicate Prevention**: Uses marker files to avoid multiple runs
3. **Error Handling**: Robust error handling with retry logic
4. **Logging**: Comprehensive logging for monitoring
5. **Manual Trigger**: API endpoint for manual testing

## API Endpoints

### Manual Trigger
```bash
POST /content/trigger-weekly
```
Manually trigger weekly content generation (useful for testing)

**Response:**
```json
{
  "success": true,
  "message": "Weekly content generation triggered successfully",
  "result": {
    "success": true,
    "message": "Weekly content generation completed",
    "total_users": 1,
    "successful_generations": 1,
    "failed_generations": 0,
    "results": [...]
  }
}
```

## Deployment on Cloud Platforms

### Render
- The scheduler starts automatically when the server starts
- No additional configuration needed
- Works with Render's free tier

### Vercel
- Can be triggered via API calls
- Use Vercel Cron Jobs to call `/content/trigger-weekly` endpoint
- Or deploy as a serverless function with scheduled triggers

### Other Platforms
- Works on any platform that supports long-running processes
- No cron job configuration needed
- Self-contained within the application

## Monitoring
- Check server logs for scheduler activity
- Look for "Background scheduler started successfully" on startup
- Monitor weekly marker files in the scheduler directory
- Use the manual trigger endpoint for testing

## Testing
1. **Manual Trigger**: `curl -X POST http://localhost:8000/content/trigger-weekly`
2. **Check Logs**: Look for scheduler messages in server logs
3. **Verify Content**: Check Supabase for generated content

## Troubleshooting
- Ensure server is running continuously
- Check timezone settings (Asia/Kolkata)
- Verify environment variables are set
- Check marker files for duplicate run prevention
- Monitor server logs for errors

## Expected Behavior
- **Startup**: Scheduler starts when server starts
- **Sunday 4:00 AM IST**: Automatically generates content
- **Other Times**: Sleeps and checks every hour
- **Shutdown**: Gracefully stops when server stops

## Benefits over Cron Jobs
- ✅ Works on cloud platforms
- ✅ No system-level configuration needed
- ✅ Integrated with application logging
- ✅ Easy to test and debug
- ✅ Automatic startup/shutdown
- ✅ Cross-platform compatibility
