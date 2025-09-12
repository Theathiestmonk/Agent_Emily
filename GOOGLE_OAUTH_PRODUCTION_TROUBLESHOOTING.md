# Google OAuth Production Troubleshooting Guide

## Common Production Issues

### 1. Redirect URI Mismatch

**Problem**: Google OAuth works in localhost but fails in production.

**Solution**: Ensure your Google Cloud Console has the correct redirect URIs:

#### Local Development:
```
http://localhost:8000/connections/google/callback
```

#### Production:
```
https://agent-emily.onrender.com/connections/google/callback
```

**Steps to fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Click on your OAuth 2.0 Client ID
4. Add both URIs to "Authorized redirect URIs":
   - `http://localhost:8000/connections/google/callback` (for development)
   - `https://agent-emily.onrender.com/connections/google/callback` (for production)

### 2. Environment Variables Missing in Production

**Problem**: Backend can't find Google OAuth configuration.

**Required Environment Variables for Production:**
```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/google/callback

# Frontend URL for redirects
FRONTEND_URL=https://emily.atsnai.com

# Encryption key for token storage
ENCRYPTION_KEY=your_encryption_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Steps to fix:**
1. Check your production environment (Render, Heroku, etc.)
2. Add all required environment variables
3. Restart your backend service
4. Verify variables are loaded by checking logs

### 3. OAuth Consent Screen Issues

**Problem**: "App is being tested" or "Access blocked" errors.

**Solutions:**

#### Option A: Add Test Users (Quick Fix)
1. Go to Google Cloud Console > "APIs & Services" > "OAuth consent screen"
2. Scroll to "Test users" section
3. Add your production email addresses
4. Save changes

#### Option B: Publish the App (Recommended for Production)
1. Go to Google Cloud Console > "APIs & Services" > "OAuth consent screen"
2. Click "Publish App"
3. Confirm publication
4. Wait 5-10 minutes for changes to propagate

### 4. CORS Issues

**Problem**: Frontend can't communicate with backend due to CORS.

**Solution**: Ensure CORS is properly configured in your backend:

```python
# In your main.py or app configuration
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://emily.atsnai.com",  # Your frontend URL
        "http://localhost:3000",     # Local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5. HTTPS vs HTTP Issues

**Problem**: Mixed content or security issues.

**Solution**: Ensure all URLs use HTTPS in production:
- Frontend: `https://emily.atsnai.com`
- Backend: `https://agent-emily.onrender.com`
- Redirect URI: `https://agent-emily.onrender.com/connections/google/callback`

## Debugging Steps

### 1. Check Backend Logs
Look for these error messages in your production logs:
- "Google OAuth not configured"
- "Invalid or expired OAuth state"
- "Redirect URI mismatch"
- "Access denied"

### 2. Test Environment Variables
Add this debug endpoint to check if variables are loaded:

```python
@router.get("/debug/config")
async def debug_config():
    return {
        "client_id": "SET" if os.getenv('GOOGLE_CLIENT_ID') else "MISSING",
        "client_secret": "SET" if os.getenv('GOOGLE_CLIENT_SECRET') else "MISSING",
        "redirect_uri": os.getenv('GOOGLE_REDIRECT_URI'),
        "frontend_url": os.getenv('FRONTEND_URL'),
        "encryption_key": "SET" if os.getenv('ENCRYPTION_KEY') else "MISSING"
    }
```

### 3. Test OAuth Flow Manually
1. Visit: `https://agent-emily.onrender.com/connections/google/auth/initiate`
2. Check if you get a proper Google OAuth URL
3. Try the OAuth flow and check for errors

### 4. Check Database Connection
Ensure your production database can store OAuth states:
- Check if `oauth_states` table exists
- Verify Supabase connection is working
- Check if states are being stored and retrieved

## Quick Fix Checklist

- [ ] Added production redirect URI to Google Console
- [ ] Set all required environment variables in production
- [ ] Published OAuth consent screen or added test users
- [ ] Verified CORS configuration
- [ ] Checked that all URLs use HTTPS
- [ ] Restarted backend service after changes
- [ ] Checked backend logs for errors
- [ ] Tested OAuth flow manually

## Common Error Messages and Solutions

| Error Message | Solution |
|---------------|----------|
| "Invalid redirect URI" | Add production URI to Google Console |
| "App is being tested" | Add test users or publish app |
| "Access blocked" | Check OAuth consent screen configuration |
| "Invalid or expired OAuth state" | Check database connection and state storage |
| "Google OAuth not configured" | Set environment variables in production |
| "CORS error" | Update CORS configuration for production domain |

## Testing the Fix

1. Clear browser cache and cookies
2. Try the Google OAuth flow in production
3. Check browser developer tools for network errors
4. Check backend logs for any remaining issues
5. Verify the OAuth state is being stored in the database

## Still Having Issues?

If you're still experiencing problems:

1. Check the exact error message in browser console
2. Check backend logs for detailed error information
3. Verify all environment variables are set correctly
4. Test with a fresh browser session (incognito mode)
5. Ensure your Google Cloud Console project is active and properly configured
