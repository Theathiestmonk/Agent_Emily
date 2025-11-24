# Fix Supabase CORS Error

## 🔴 Error You're Seeing

```
Access to fetch at 'https://yibrsxythicjzshqhqxf.supabase.co/rest/v1/profiles?...' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ Solution: Configure CORS in Supabase Dashboard

Supabase needs to allow requests from your localhost development server. Here's how to fix it:

### Step 1: Go to Supabase Dashboard

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `yibrsxythicjzshqhqxf`
3. Go to **Settings** → **API** (or **Project Settings** → **API**)

### Step 2: Add Localhost to Allowed Origins

1. Scroll down to **CORS Configuration** or **Additional Allowed Origins**
2. Add your localhost URL:
   ```
   http://localhost:3000
   ```
3. If you're using a different port, add that too:
   ```
   http://localhost:5173
   http://localhost:3000
   ```

### Step 3: Add Production URLs (if needed)

Also add your production frontend URLs:
```
https://agentemily.vercel.app
https://emily.atsnai.com
http://localhost:3000
http://localhost:5173
```

### Step 4: Save and Test

1. Click **Save** or **Update**
2. Wait a few seconds for changes to propagate
3. Refresh your browser and try logging in again

## 🔍 Alternative: Check Authentication Settings

If you don't see CORS settings in API settings, check:

1. **Settings** → **Authentication** → **URL Configuration**
2. Look for **Site URL** and **Redirect URLs**
3. Add `http://localhost:3000` to **Redirect URLs**:
   ```
   http://localhost:3000/**
   https://agentemily.vercel.app/**
   https://emily.atsnai.com/**
   ```

## 🚨 Important Notes

1. **Supabase REST API CORS**: The CORS error is coming from Supabase's REST API (`/rest/v1/`), not your backend. This must be configured in Supabase Dashboard.

2. **Multiple Origins**: You can add multiple origins separated by commas or as separate entries.

3. **Wildcards**: Some Supabase versions support wildcards like `http://localhost:*` but it's safer to specify exact ports.

4. **Development vs Production**: 
   - Development: `http://localhost:3000`, `http://localhost:5173`
   - Production: Your actual domain URLs

## 🧪 Verify It's Fixed

After saving, check your browser console. The CORS error should be gone, and you should see successful API calls to Supabase.

## 📝 If Still Not Working

1. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check Supabase Logs**: Dashboard → Logs → API Logs
3. **Verify Environment Variables**: Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
4. **Check Network Tab**: In browser dev tools, look at the actual request headers

## 🔗 Related Configuration

- **Backend CORS**: Configured in `backend/main.py` (this is separate from Supabase CORS)
- **Supabase Auth**: Configured in Dashboard → Authentication → Providers
- **Supabase REST API CORS**: Configured in Dashboard → Settings → API (this is what you're fixing now)

