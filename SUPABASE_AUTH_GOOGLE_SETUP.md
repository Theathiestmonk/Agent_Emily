# Supabase Auth Google OAuth Setup - Fixing "Internal server error"

## Problem
When trying to login with Google using Supabase Auth, you're getting "Internal server error" from Supabase.

## Root Cause
This error occurs when Supabase's Google OAuth provider is not properly configured in your Supabase Dashboard.

## Solution: Configure Google OAuth in Supabase Dashboard

### Step 1: Get Google OAuth Credentials

You need to use the **same Google OAuth credentials** that you're using for the custom Google connection, OR create separate ones for Supabase Auth.

**Option A: Use Same Credentials (Recommended)**
- Use your existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**Option B: Create Separate Credentials**
- Create a new OAuth 2.0 Client ID in Google Cloud Console specifically for Supabase Auth

### Step 2: Add Redirect URI to Google Cloud Console

Add this redirect URI to your Google Cloud Console **Authorized redirect URIs**:

```
https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback
```

**Important:** This is Supabase's callback URL, not your app's callback URL.

### Step 3: Configure in Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list
5. Click **Enable** or **Configure**
6. Enter:
   - **Client ID (for OAuth)**: Your Google OAuth Client ID
   - **Client Secret (for OAuth)**: Your Google OAuth Client Secret
7. Click **Save**

### Step 4: Configure Redirect URLs in Supabase

1. Still in **Authentication** → **URL Configuration**
2. Add your site URLs to **Redirect URLs**:
   - `http://localhost:3000` (for local development)
   - `https://your-production-domain.com` (for production)
   - `http://localhost:3000/auth/callback` (specific callback path)

### Step 5: Verify Configuration

The redirect URL in your code is:
```javascript
redirectTo: `${window.location.origin}/auth/callback`
```

This means:
- Local: `http://localhost:3000/auth/callback`
- Production: `https://your-domain.com/auth/callback`

Make sure these are added to Supabase's **Redirect URLs** list.

## Common Issues

### Issue 1: Redirect URL Not Authorized
**Error:** "redirect_uri_mismatch" or "unauthorized_client"

**Fix:** 
- Add the exact redirect URL to Supabase's Redirect URLs
- Add Supabase's callback URL to Google Cloud Console

### Issue 2: Google OAuth Not Enabled in Supabase
**Error:** "Internal server error" or "Provider not configured"

**Fix:**
- Enable Google provider in Supabase Dashboard
- Enter correct Client ID and Secret

### Issue 3: Wrong OAuth Credentials
**Error:** "Invalid client" or authentication fails

**Fix:**
- Verify Client ID and Secret are correct
- Make sure they're from the same Google Cloud project
- Check that the redirect URI is added to Google Cloud Console

## Testing

1. After configuring, try logging in with Google again
2. You should be redirected to Google's consent screen
3. After consent, you should be redirected back to your app
4. Check browser console and network tab for any errors

## Difference Between Supabase Auth and Custom Google Connection

- **Supabase Auth OAuth**: Used for user authentication/login
  - URL: `supabase.co/auth/v1/authorize?provider=google`
  - Configured in Supabase Dashboard
  - Used for: User sign-in/sign-up

- **Custom Google Connection**: Used for Google services (Gmail, Drive, etc.)
  - URL: `accounts.google.com/o/oauth2/auth`
  - Configured in your backend code
  - Used for: Accessing Google APIs (Gmail, Drive, Calendar, etc.)

Both can use the same Google OAuth credentials, but they have different redirect URIs.

## Quick Checklist

- [ ] Google OAuth Client ID and Secret created in Google Cloud Console
- [ ] Supabase callback URL added to Google Cloud Console: `https://[your-project].supabase.co/auth/v1/callback`
- [ ] Google provider enabled in Supabase Dashboard
- [ ] Client ID and Secret entered in Supabase Dashboard
- [ ] App redirect URLs added to Supabase (localhost and production)
- [ ] Test login with Google

## If Still Getting "Internal server error" (HTTP 556)

This error usually indicates a **database issue** rather than OAuth configuration. Check:

1. **Run Diagnostic SQL**: Use `database/check_supabase_auth_setup.sql` in Supabase SQL Editor
2. **Check Database Triggers**: Verify `handle_new_user()` function and `on_auth_user_created` trigger exist
3. **Check RLS Policies**: Ensure profiles table RLS allows inserts
4. **Check Supabase Logs**: Go to Dashboard → Logs → API Logs for detailed errors
5. **Verify Project Status**: Check if Supabase project is active and not paused

See `SUPABASE_AUTH_TROUBLESHOOTING.md` for advanced troubleshooting steps.

