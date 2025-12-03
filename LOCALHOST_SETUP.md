# Localhost Development Setup Guide

## 🔧 Setting Up Google OAuth for Localhost

When developing on localhost, you need to configure environment variables and Google Cloud Console to use localhost URLs.

## 📋 Step 1: Backend Environment Variables

Create a `.env` file in the `backend/` directory with these variables:

```env
# Environment
ENVIRONMENT=development

# API Base URL (for localhost)
API_BASE_URL=http://localhost:8000

# Frontend URL (for localhost)
FRONTEND_URL=http://localhost:3000

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/connections/auth/google/callback

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Other required variables...
OPENAI_API_KEY=your_openai_api_key_here
ENCRYPTION_KEY=your_encryption_key_here
```

## 📋 Step 2: Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 🔐 Step 3: Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:8000/connections/auth/google/callback
   ```
6. Click **Save**

## ⚠️ Important Notes

1. **Redirect URI Must Match Exactly**: The redirect URI in your `.env` file must exactly match what's in Google Cloud Console (including `http://` vs `https://`)

2. **Port Numbers**: 
   - Backend default: `8000`
   - Frontend default: `3000` (or `5173` for Vite)
   - Adjust these if you're using different ports

3. **Testing Mode**: If your Google OAuth app is in "Testing" mode, you need to add your email as a test user in Google Cloud Console

## 🚀 Running the Application

1. **Start Backend**:
   ```bash
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Google OAuth**:
   - Navigate to `http://localhost:3000`
   - Try connecting Google account
   - The redirect should work correctly

## 🔍 Troubleshooting

### Error: "redirect_uri_mismatch"
- Check that `GOOGLE_REDIRECT_URI` in `.env` exactly matches Google Cloud Console
- Make sure you're using `http://` (not `https://`) for localhost
- Verify the port number matches (usually `8000` for backend)

### Error: "Internal Server Error"
- Check backend logs for detailed error messages
- Verify all environment variables are set correctly
- Make sure the backend is running on the correct port

### Error: "Access Denied" or "Testing Mode"
- Add your email as a test user in Google Cloud Console
- Or publish your OAuth app (requires verification for production)

## 📝 Environment Detection

The code automatically detects localhost development mode when:
- `ENVIRONMENT=development` is set, OR
- `API_BASE_URL` contains "localhost"

This allows the same code to work in both development and production without changes.

