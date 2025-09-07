# Domain Setup Guide for emily.atsnai.com

## 🔧 **Backend Configuration (Render)**

### **Environment Variables to Set in Render:**

1. **CORS_ORIGINS** (Required)
   ```
   https://emily.atsnai.com,https://agentemily.vercel.app
   ```

2. **API_BASE_URL** (Required for OAuth redirects)
   ```
   https://your-backend-url.onrender.com
   ```

3. **Other Required Variables:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `FACEBOOK_CLIENT_ID`
   - `FACEBOOK_CLIENT_SECRET`
   - `ENCRYPTION_KEY`

## 🌐 **Frontend Configuration (Vercel)**

### **Environment Variables to Set in Vercel:**

1. **VITE_API_URL**
   ```
   https://your-backend-url.onrender.com
   ```

2. **VITE_SUPABASE_URL**
   ```
   https://yibrsxythicjzshqhqxf.supabase.co
   ```

3. **VITE_SUPABASE_ANON_KEY**
   ```
   your_supabase_anon_key
   ```

## 📱 **Facebook App Configuration**

### **Valid OAuth Redirect URIs:**
Add these to your Facebook App settings:

1. **Backend Callback URL:**
   ```
   https://your-backend-url.onrender.com/connections/auth/facebook/callback
   ```

2. **Frontend URL (for testing):**
   ```
   https://emily.atsnai.com
   ```

## 🔒 **Security Benefits:**

✅ **CORS origins are now environment-controlled**  
✅ **No hardcoded domains in code**  
✅ **Easy to add/remove domains via environment variables**  
✅ **Production fails if CORS_ORIGINS is not set**  
✅ **Development still works with localhost defaults**

## 🚀 **Deployment Steps:**

1. **Set environment variables in Render**
2. **Set environment variables in Vercel**
3. **Update Facebook App redirect URIs**
4. **Deploy both frontend and backend**
5. **Test the new domain**

## 🧪 **Testing:**

1. Visit `https://emily.atsnai.com`
2. Try to connect Facebook account
3. Check that OAuth redirects work
4. Verify CORS is working (no console errors)
