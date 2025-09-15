# Google OAuth Setup Guide

## Issue: "App is being tested" Error

When you see the "App is being tested" message during Google OAuth, it means your Google OAuth application is in testing mode and needs to be configured properly.

## Solutions:

### Option 1: Add Test Users (Recommended for Development)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "OAuth consent screen"
4. Scroll down to "Test users" section
5. Click "Add users"
6. Add the email addresses that should be able to test the app
7. Save the changes

### Option 2: Publish the App (For Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "OAuth consent screen"
4. Click "Publish App"
5. Confirm the publication

## Required Environment Variables

Make sure these are set in your backend environment:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/google/callback
FRONTEND_URL=https://emily.atsnai.com
```

## OAuth Consent Screen Configuration

1. **App Information:**
   - App name: "Emily Digital Marketing Agent"
   - User support email: Your email
   - App logo: Upload a logo (optional)

2. **Scopes:**
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/calendar.readonly`

3. **Test Users:**
   - Add your email and any other test users
   - Or publish the app for public use

## Troubleshooting

### Common Issues:

1. **"Invalid or expired OAuth state"**
   - Fixed: Now properly validates OAuth state in database
   - State is stored for 10 minutes and cleaned up after use

2. **"App is being tested"**
   - Add test users or publish the app
   - Make sure the user's email is in the test users list

3. **"Redirect URI mismatch"**
   - Ensure `GOOGLE_REDIRECT_URI` matches exactly what's configured in Google Console
   - Check for trailing slashes and HTTP vs HTTPS

4. **"Access blocked"**
   - The app might be in restricted mode
   - Check OAuth consent screen configuration
   - Ensure all required scopes are added

## Testing the Integration

1. Make sure all environment variables are set
2. Restart the backend server
3. Try connecting to Google from the frontend
4. Check backend logs for any errors
5. Verify the OAuth state is being stored and validated

## Security Notes

- OAuth states are stored in the database and expire after 10 minutes
- Used states are automatically cleaned up
- All tokens are encrypted before storage
- The app uses secure state generation with proper validation
