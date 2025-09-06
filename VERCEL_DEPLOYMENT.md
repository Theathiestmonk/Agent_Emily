# Vercel Deployment Guide for Emily

## 🚀 Quick Fix for Vercel Deployment

The error you encountered:
```
Environment Variable "VITE_API_URL" references Secret "vite_api_url", which does not exist.
```

Has been fixed! The `vercel.json` file no longer references non-existent secrets.

## 📋 Steps to Deploy to Vercel

### 1. Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `Theathiestmonk/Agent_Emily`
4. Select the repository and click "Import"

### 2. Configure Build Settings
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 3. Set Environment Variables
In the Vercel dashboard, go to your project → Settings → Environment Variables and add:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `VITE_API_URL` | `https://your-backend-url.onrender.com` | Your Render backend URL |
| `VITE_SUPABASE_URL` | `your_supabase_url` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `your_supabase_anon_key` | Your Supabase anon key |

### 4. Deploy
1. Click "Deploy" button
2. Wait for the build to complete
3. Your app will be available at `https://your-project-name.vercel.app`

## 🔧 Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check that all environment variables are set
   - Ensure the backend URL is accessible
   - Check the build logs for specific errors

2. **API Connection Issues**
   - Verify `VITE_API_URL` points to your deployed backend
   - Check CORS settings in your backend
   - Ensure backend is running and accessible

3. **Supabase Connection Issues**
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Check Supabase project settings
   - Ensure RLS policies are configured correctly

## 🌐 Production URLs

After deployment, your app will be available at:
- **Frontend**: `https://your-project-name.vercel.app`
- **Backend**: `https://your-backend-name.onrender.com` (if deployed to Render)

## 📱 Testing Your Deployment

1. **Test Login**: Try logging in with a test account
2. **Test Onboarding**: Complete the onboarding flow
3. **Test Content Generation**: Generate some test content
4. **Test Content Calendar**: View the content calendar

## 🔄 Automatic Deployments

Vercel will automatically deploy when you push to the `main` branch. To trigger a manual deployment:

1. Go to your project dashboard
2. Click "Deployments" tab
3. Click "Redeploy" on the latest deployment

## 📊 Monitoring

- **Analytics**: Available in Vercel dashboard
- **Logs**: Check function logs for debugging
- **Performance**: Monitor Core Web Vitals

---

**Status**: ✅ Ready for deployment
**Last Updated**: September 2025
