# Google OAuth for Work/Enterprise Email Accounts

## Issue
Google OAuth works for personal Gmail accounts but fails for work/enterprise email accounts (Google Workspace).

## Common Causes

### 1. App Verification Required
Google Workspace accounts require **app verification** for sensitive scopes like:
- Gmail (readonly, send)
- Drive (readonly, file)
- Calendar (readonly)
- Documents

**Solution:** Complete Google's app verification process in Google Cloud Console.

### 2. Admin Consent Required
Enterprise accounts may require **Google Workspace admin approval** before users can authorize the app.

**Solution:** 
- Ask your Google Workspace admin to approve the app
- Admin can approve in Google Admin Console → Security → API Controls → Domain-wide Delegation

### 3. Organization Policies
Your organization may have policies that:
- Block unverified apps
- Restrict OAuth apps to specific domains
- Require admin approval for all OAuth apps

**Solution:** Contact your Google Workspace admin to:
- Approve the app for your organization
- Add the app to the allowed list
- Adjust organization policies if needed

### 4. Domain Restrictions
The OAuth app might be restricted to specific domains in Google Cloud Console.

**Solution:** In Google Cloud Console → OAuth consent screen:
- Check "User Type" - should be "External" for work emails
- Remove any domain restrictions
- Add your organization's domain to allowed domains if needed

## Steps to Fix

### For App Developers:

1. **Complete App Verification:**
   - Go to Google Cloud Console → OAuth consent screen
   - Complete the verification process
   - Submit for verification if using sensitive scopes

2. **Update OAuth Consent Screen:**
   - Set User Type to "External" (allows any Google account)
   - Add your app's privacy policy and terms of service
   - Add support email

3. **Check App Status:**
   - Go to APIs & Services → OAuth consent screen
   - Verify app is published (not just in testing mode)
   - Check if verification is pending or completed

### For End Users (Work Email):

1. **Contact Your Admin:**
   - Ask your Google Workspace admin to approve the app
   - Provide them with:
     - App name: "Agent Emily" or your app name
     - OAuth Client ID: (from Google Cloud Console)
     - Scopes requested: Gmail, Drive, Calendar, etc.

2. **Use Personal Account (if allowed):**
   - Some organizations allow using personal Gmail for testing
   - Check with your IT department first

3. **Wait for App Verification:**
   - If the app is pending verification, wait for Google to complete it
   - This can take several days to weeks

## Current Implementation

The code has been updated to:
- ✅ Better error messages for enterprise account issues
- ✅ Support for enterprise account OAuth flow
- ✅ Detailed logging for debugging
- ✅ Helpful error pages explaining the issue

## Testing

To test if the issue is resolved:
1. Try connecting with a work email
2. Check the error message - it will now explain if it's an enterprise account issue
3. Check backend logs for detailed error information

## Additional Resources

- [Google OAuth for Workspace](https://developers.google.com/identity/protocols/oauth2)
- [App Verification Process](https://support.google.com/cloud/answer/9110914)
- [Admin Consent Flow](https://developers.google.com/identity/protocols/oauth2/web-server#offline)

