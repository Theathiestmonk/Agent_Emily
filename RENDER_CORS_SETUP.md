# Render CORS Setup Guide

## 🔧 Setting Up CORS in Render

### 1. Go to Render Dashboard
1. Navigate to your backend service: [https://agent-emily.onrender.com/](https://agent-emily.onrender.com/)
2. Click on your service name
3. Go to "Environment" tab

### 2. Add CORS Environment Variable
Add this environment variable in Render:

| Variable Name | Value |
|---------------|-------|
| `CORS_ORIGINS` | `https://agentemily.vercel.app,https://agent-emily.onrender.com` |

### 3. Add Other Required Environment Variables
Make sure you have all these environment variables set in Render:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `SUPABASE_URL` | `your_supabase_url` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `your_supabase_anon_key` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_supabase_service_role_key` | Your Supabase service role key |
| `SECRET_KEY` | `your_strong_secret_key` | JWT secret key |
| `OPENAI_API_KEY` | `your_openai_api_key` | OpenAI API key |
| `ENVIRONMENT` | `production` | Environment setting |
| `LOG_LEVEL` | `INFO` | Logging level |
| `CORS_ORIGINS` | `https://agentemily.vercel.app,https://agent-emily.onrender.com` | Allowed CORS origins |

### 4. Deploy Changes
1. After adding the environment variables, click "Save Changes"
2. Render will automatically redeploy your service
3. Wait for the deployment to complete

### 5. Test CORS
You can test if CORS is working by:

1. **Browser Test**: Open your frontend at [https://agentemily.vercel.app/login](https://agentemily.vercel.app/login) and try to log in
2. **API Test**: Check if API calls work without CORS errors
3. **Console Check**: Open browser dev tools and check for CORS errors

### 6. Troubleshooting

#### If CORS errors persist:
1. **Check Environment Variables**: Make sure `CORS_ORIGINS` is set correctly
2. **Check URL Format**: Ensure URLs don't have trailing slashes
3. **Check HTTPS**: Make sure both frontend and backend use HTTPS
4. **Check Deployment**: Ensure the backend has been redeployed after adding the environment variable

#### Common CORS Error Messages:
- `Access to fetch at 'https://agent-emily.onrender.com/auth/login' from origin 'https://agentemily.vercel.app' has been blocked by CORS policy`
- `Response to preflight request doesn't pass access control check`

#### Debug Steps:
1. Check if `CORS_ORIGINS` environment variable is set in Render
2. Verify the exact URLs match (no trailing slashes, correct protocol)
3. Check if the backend service is running
4. Test with a simple curl request

### 7. Alternative: Wildcard CORS (Not Recommended for Production)
If you need to allow all origins temporarily for testing:
```
CORS_ORIGINS=*
```

**⚠️ Warning**: Only use wildcard CORS for development/testing. Never use in production.

## ✅ Expected Result

After setting up CORS correctly:
- Frontend can make API calls to backend without CORS errors
- Login and authentication work properly
- Content generation and other features work as expected
- No CORS-related errors in browser console

---

**Status**: ✅ Ready for CORS configuration
**Last Updated**: September 2025
