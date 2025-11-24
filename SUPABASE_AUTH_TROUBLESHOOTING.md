# Supabase Auth Google OAuth - Advanced Troubleshooting

## Problem
Even after configuring Google OAuth in Supabase Dashboard, you're still getting "Internal server error" (HTTP 556).

## Additional Checks Beyond Basic Setup

### 1. Verify Supabase Project Status
- Go to Supabase Dashboard → Project Settings
- Check if project is paused or has quota issues
- Verify project is active and not in maintenance

### 2. Check Supabase Auth Logs
1. Go to Supabase Dashboard → Authentication → Logs
2. Look for errors related to Google OAuth
3. Check for specific error messages that might indicate the issue

### 3. Database Triggers and Constraints
The error might be caused by database triggers or constraints interfering with user creation.

**Check for:**
- `handle_new_user()` trigger function
- Foreign key constraints on `profiles` table
- RLS (Row Level Security) policies blocking inserts

**Fix:**
```sql
-- Check if trigger exists and is working
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check if handle_new_user function exists
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';

-- Verify the function works
SELECT handle_new_user();
```

### 4. Explicit Email Scope
For Google Workspace accounts, you need to explicitly request the email scope. The code has been updated to include this.

### 5. Redirect URL Format
Make sure the redirect URL in your code matches exactly what's in Supabase Dashboard:
- Code uses: `${window.location.origin}/auth/callback`
- For localhost: `http://localhost:3000/auth/callback`
- Must be added to Supabase Dashboard → Authentication → URL Configuration

### 6. Google Cloud Console - Multiple Redirect URIs
Ensure BOTH redirect URIs are in Google Cloud Console:
1. `https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback` (Supabase's callback)
2. Your app's callback URL (if using custom flow)

### 7. Supabase Project URL Mismatch
Verify the Supabase URL in your frontend matches your actual project:
- Check `VITE_SUPABASE_URL` environment variable
- Should be: `https://yibrsxythicjzshqhqxf.supabase.co`
- Must match exactly (no trailing slash)

### 8. Test with Different Browser/Incognito
- Clear browser cache and cookies
- Try in incognito/private mode
- Try different browser

### 9. Check Supabase Status Page
- Visit https://status.supabase.com
- Check if there are any ongoing issues with Supabase Auth

### 10. Verify OAuth Credentials Format
- Client ID should start with something like: `123456789-abc...`
- Client Secret should be a long string
- Make sure there are no extra spaces when copying/pasting

### 11. Check for Rate Limiting
- Too many OAuth attempts might trigger rate limiting
- Wait a few minutes and try again
- Check Supabase Dashboard for rate limit warnings

### 12. Database Connection Issues
The HTTP 556 error might indicate Supabase database connection issues:
- Check Supabase Dashboard → Database → Connection Pooling
- Verify database is not paused
- Check for any database maintenance

## Debugging Steps

### Step 1: Check Browser Console
Open browser DevTools → Console and look for:
- Any JavaScript errors
- Network request failures
- Supabase client errors

### Step 2: Check Network Tab
Open browser DevTools → Network:
- Look for the OAuth request to Supabase
- Check the response status and body
- Look for any CORS errors

### Step 3: Check Supabase Logs
1. Go to Supabase Dashboard → Logs → API Logs
2. Filter for "auth" or "google"
3. Look for error messages

### Step 4: Test OAuth Flow Manually
Try accessing the OAuth URL directly:
```
https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback
```

This will show you the exact error from Supabase.

## Common Solutions

### Solution 1: Re-enable Google Provider
1. Go to Supabase Dashboard → Authentication → Providers
2. Disable Google provider
3. Wait 30 seconds
4. Re-enable Google provider
5. Re-enter Client ID and Secret
6. Save

### Solution 2: Create New OAuth Credentials
If using the same credentials for both Supabase Auth and custom connection:
1. Create a separate OAuth Client ID in Google Cloud Console
2. Use this new Client ID/Secret for Supabase Auth
3. Keep the old ones for custom Google connection

### Solution 3: Check Database Schema
Run this SQL in Supabase SQL Editor:
```sql
-- Check if profiles table has the correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- Check if handle_new_user function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Check if trigger exists
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

### Solution 4: Temporarily Disable RLS
**Warning: Only for testing!**
```sql
-- Temporarily disable RLS on profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Test OAuth login

-- Re-enable RLS after testing
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

## Still Not Working?

If none of the above works:

1. **Contact Supabase Support**: The HTTP 556 error might be a Supabase service issue
2. **Check Supabase Community**: Search for similar issues on Supabase Discord/Forum
3. **Try Alternative Auth Method**: Temporarily use email/password auth to verify the app works
4. **Check Project Quota**: Free tier projects have limits that might cause issues

## Code Updates Made

The code has been updated to:
- ✅ Explicitly request `email profile` scopes
- ✅ Better error logging and messages
- ✅ More detailed console output for debugging

Try the login again and check the browser console for detailed error messages.

