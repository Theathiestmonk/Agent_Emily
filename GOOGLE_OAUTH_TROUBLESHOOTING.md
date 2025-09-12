# Google OAuth Troubleshooting Guide

## Current Issue: "Missing code or state parameter"

Based on the error at https://agent-emily.onrender.com/connections/auth/google/callback, the OAuth callback is receiving the request but the `code` and `state` parameters are missing.

## 🔍 **Debugging Steps**

### 1. **Check Google Cloud Console Configuration**

**Redirect URI must match exactly:**
- ✅ Correct: `https://agent-emily.onrender.com/connections/auth/google/callback`
- ❌ Wrong: `https://agent-emily.onrender.com/connections/auth/google/callback/`
- ❌ Wrong: `http://agent-emily.onrender.com/connections/auth/google/callback`

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Click on your OAuth 2.0 Client ID
4. Check "Authorized redirect URIs" section
5. Ensure the URI matches exactly: `https://agent-emily.onrender.com/connections/auth/google/callback`

### 2. **Check Environment Variables**

Make sure these are set in your backend environment:
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
FRONTEND_URL=https://emily.atsnai.com
```

### 3. **Test the OAuth Flow**

1. **Start the OAuth flow:**
   - Go to your frontend
   - Click "Connect Google"
   - Check the browser network tab for the auth URL

2. **Check the generated URL:**
   - The URL should contain `state=` and `redirect_uri=` parameters
   - Example: `https://accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=https://agent-emily.onrender.com/connections/auth/google/callback&state=...`

3. **Complete the OAuth:**
   - Authorize the app in Google
   - Google should redirect to your callback URL with `code` and `state` parameters

### 4. **Common Issues & Solutions**

#### **Issue: Parameters are missing from callback URL**
**Cause:** Google OAuth configuration mismatch
**Solution:** 
- Double-check redirect URI in Google Console
- Ensure no trailing slashes
- Verify HTTPS (not HTTP)

#### **Issue: "App is being tested" error**
**Solution:**
- Add your email as a test user in Google Console
- Or publish the app

#### **Issue: "Invalid client" error**
**Solution:**
- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Ensure they match what's in Google Console

#### **Issue: "Redirect URI mismatch" error**
**Solution:**
- The redirect URI in your code must exactly match what's in Google Console
- Check for typos, trailing slashes, HTTP vs HTTPS

### 5. **Debugging the Callback**

The updated callback now includes debugging information:
- Check the backend logs for: `Google OAuth callback - Missing parameters: code=..., state=...`
- The error page will show the actual values received

### 6. **Testing the Complete Flow**

1. **Clear browser cache and cookies**
2. **Start fresh OAuth flow:**
   ```
   GET /connections/google/auth
   ```
3. **Check the response:**
   - Should contain `auth_url` and `state`
   - The `auth_url` should include the correct `redirect_uri`

4. **Complete OAuth in browser:**
   - Click the auth URL
   - Authorize the app
   - Should redirect to callback with parameters

5. **Check callback:**
   - Should receive `code` and `state` parameters
   - If missing, check Google Console configuration

## 🚀 **Quick Fix Checklist**

- [ ] Redirect URI in Google Console matches exactly
- [ ] Environment variables are set correctly
- [ ] App is published or test users are added
- [ ] Using HTTPS (not HTTP)
- [ ] No trailing slashes in redirect URI
- [ ] Client ID and Secret are correct

## 📞 **Next Steps**

If the issue persists after checking the above:
1. Check backend logs for the debug output
2. Verify the exact redirect URI being used
3. Test with a simple OAuth flow first
4. Consider using Google's OAuth 2.0 Playground for testing
