# Fix Google OAuth "redirect_uri_mismatch" Error

## 🔴 Error You're Seeing

```
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid
```

This happens when the redirect URI sent to Google doesn't match what's configured in Google Cloud Console.

## 🔍 Understanding the Flow

When you log in with Google via Supabase Auth:

1. **Your App** → Calls Supabase Auth: `signInWithOAuth({ provider: 'google' })`
2. **Supabase** → Redirects to Google: `accounts.google.com/o/oauth2/auth?redirect_uri=https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback`
3. **Google** → Checks if redirect URI matches → **ERROR if not found**
4. **Google** → Redirects back to Supabase: `https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback`
5. **Supabase** → Processes auth → Redirects to your app: `https://your-domain.com/auth/callback`

## ✅ Solution: Add Supabase Callback URL to Google Cloud Console

### Step 1: Go to Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (the one used in Supabase Dashboard)
5. Click **Edit** (pencil icon)

### Step 2: Add Supabase Callback URL

In **Authorized redirect URIs**, add:

```
https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback
```

**Important:** 
- This is Supabase's callback URL, NOT your app's URL
- The format is: `https://[your-project-id].supabase.co/auth/v1/callback`
- Replace `yibrsxythicjzshqhqxf` with your actual Supabase project ID if different

### Step 3: Also Add Your App's Redirect URLs (if needed)

If you're using a custom OAuth flow (not Supabase Auth), also add:

```
https://your-production-domain.com/auth/callback
http://localhost:3000/auth/callback
```

### Step 4: Save and Wait

1. Click **Save**
2. Wait 1-2 minutes for changes to propagate
3. Try logging in again

## 🔧 Configure Supabase Dashboard

### Step 1: Add Your Domain to Supabase Redirect URLs

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. In **Redirect URLs**, add:

```
https://your-production-domain.com/auth/callback
http://localhost:3000/auth/callback
```

**Note:** Replace `your-production-domain.com` with your actual domain (e.g., `emily.atsnai.com`)

### Step 2: Set Site URL

In the same page, set **Site URL** to:

```
https://your-production-domain.com
```

## 📋 Complete Checklist

### Google Cloud Console
- [ ] OAuth 2.0 Client ID created
- [ ] **Supabase callback URL added**: `https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback`
- [ ] Your app callback URL added (if using custom flow): `https://your-domain.com/auth/callback`
- [ ] Changes saved

### Supabase Dashboard
- [ ] Google provider enabled in **Authentication** → **Providers** → **Google**
- [ ] Client ID and Secret entered correctly
- [ ] **Redirect URLs** configured in **Authentication** → **URL Configuration**:
  - [ ] `https://your-production-domain.com/auth/callback`
  - [ ] `http://localhost:3000/auth/callback`
- [ ] **Site URL** set to your production domain

## 🧪 Testing

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Try logging in** with Google
3. **Check browser console** for any errors
4. **Check network tab** to see the redirect flow

## 🚨 Common Mistakes

### ❌ Wrong: Adding your app's URL to Google Cloud Console
```
https://your-domain.com/auth/callback  ← This is NOT what Google needs
```

### ✅ Correct: Adding Supabase's callback URL to Google Cloud Console
```
https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback  ← This is what Google needs
```

### Why?

- **Google Cloud Console** needs Supabase's callback URL (where Google sends the auth code)
- **Supabase Dashboard** needs your app's callback URL (where Supabase redirects after processing)

## 🔍 Debugging

If still not working:

1. **Check the exact redirect URI in the error**:
   - Look at the Google error page URL
   - It will show the redirect_uri parameter
   - Make sure this EXACT URL is in Google Cloud Console

2. **Check Supabase Logs**:
   - Dashboard → Logs → API Logs
   - Look for authentication errors

3. **Check Browser Network Tab**:
   - Open DevTools → Network
   - Try logging in
   - Look at the OAuth request to Google
   - Check the `redirect_uri` parameter

4. **Verify Project ID**:
   - Make sure `yibrsxythicjzshqhqxf` is your correct Supabase project ID
   - Check in Supabase Dashboard → Settings → General → Reference ID

## 📝 Quick Reference

**Your Code Uses:**
```javascript
redirectTo: `${window.location.origin}/auth/callback`
```

**This Means:**
- Local: `http://localhost:3000/auth/callback` → Add to **Supabase Dashboard**
- Production: `https://your-domain.com/auth/callback` → Add to **Supabase Dashboard**

**But Google Needs:**
- `https://yibrsxythicjzshqhqxf.supabase.co/auth/v1/callback` → Add to **Google Cloud Console**

