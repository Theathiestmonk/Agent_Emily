# Google OAuth "unauthorized_client" Error - Troubleshooting Guide

## Problem
Getting `(unauthorized_client) Unauthorized` error for both personal and work email accounts when trying to connect Google.

## Root Cause
The redirect URI being sent to Google **does not exactly match** what's configured in Google Cloud Console.

## Critical Check: Redirect URI Must Match Exactly

### What's in Your Google Cloud Console:
Based on your screenshot, you have:
```
https://agent-emily.onrender.com/connections/auth/google/callback
```

### What Your Code Must Send:
The `GOOGLE_REDIRECT_URI` environment variable **MUST** be set to exactly:
```
https://agent-emily.onrender.com/connections/auth/google/callback
```

**Important:** 
- Must include `https://`
- Must include `/auth/` in the path
- No trailing slash
- Exact domain match

## Step-by-Step Fix

### 1. Set Environment Variable

Set this in your backend environment (`.env` file or hosting platform):

```bash
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
```

### 2. Verify in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services → Credentials**
3. Click on your OAuth 2.0 Client ID
4. Check **Authorized redirect URIs**
5. Ensure this exact URI is listed:
   ```
   https://agent-emily.onrender.com/connections/auth/google/callback
   ```

### 3. Check Backend Logs

After setting the environment variable, check your backend logs when initiating OAuth. You should see:

```
🔍 OAuth Configuration Check:
   Client ID: [your-client-id]...
   Client Secret: SET
   Redirect URI: https://agent-emily.onrender.com/connections/auth/google/callback
   ⚠️  IMPORTANT: This redirect URI MUST exactly match what's in Google Cloud Console!
```

### 4. Verify the Auth URL

The logs will also show the redirect URI in the actual OAuth URL. Check that it matches:

```
🔍 Redirect URI in auth URL: https://agent-emily.onrender.com/connections/auth/google/callback
```

If there's a mismatch, you'll see:
```
⚠️  WARNING: Redirect URI mismatch!
   Flow has: [one URI]
   URL has:  [different URI]
❌ This mismatch will cause 'unauthorized_client' error!
```

## Common Mistakes

### ❌ Wrong: Missing /auth/ in path
```
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/google/callback
```
Should be:
```
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
```

### ❌ Wrong: Missing https://
```
GOOGLE_REDIRECT_URI=agent-emily.onrender.com/connections/auth/google/callback
```
Should be:
```
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
```

### ❌ Wrong: Trailing slash
```
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback/
```
Should be:
```
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
```

### ❌ Wrong: Wrong domain
```
GOOGLE_REDIRECT_URI=https://atsnai.com/connections/auth/google/callback
```
Should match your backend domain:
```
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
```

## Auto-Construction Fallback

If `GOOGLE_REDIRECT_URI` is not set, the code will try to construct it from `API_BASE_URL`:

```python
api_base_url = os.getenv('API_BASE_URL', 'https://agent-emily.onrender.com')
redirect_uri = f"{api_base_url}/connections/auth/google/callback"
```

**But it's better to set it explicitly** to avoid any issues.

## Testing

1. Set the environment variable
2. Restart your backend server
3. Try connecting Google again
4. Check backend logs for the redirect URI being used
5. Verify it matches Google Cloud Console exactly

## Still Not Working?

1. **Double-check Google Cloud Console:**
   - Go to OAuth 2.0 Client ID settings
   - Verify the redirect URI is exactly: `https://agent-emily.onrender.com/connections/auth/google/callback`
   - Make sure there are no extra spaces or characters

2. **Check Backend Logs:**
   - Look for the "CRITICAL - Redirect URI being sent to Google" message
   - Compare it character-by-character with Google Cloud Console

3. **Verify Client ID/Secret:**
   - Make sure `GOOGLE_CLIENT_ID` matches the Client ID in Google Cloud Console
   - Make sure `GOOGLE_CLIENT_SECRET` matches the Client Secret

4. **Check for Multiple OAuth Clients:**
   - Make sure you're using the correct OAuth client
   - Don't mix up different OAuth clients

## Summary

The fix is simple but critical:
1. Set `GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback`
2. Verify it matches Google Cloud Console exactly
3. Restart backend
4. Try again

The enhanced logging will now show you exactly what redirect URI is being sent, so you can verify it matches.

