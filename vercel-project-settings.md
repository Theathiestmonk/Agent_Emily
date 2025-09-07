# Vercel Project Settings for Monorepo

## Manual Configuration Required

Since the CLI is having issues with the monorepo structure, you need to configure this manually in the Vercel dashboard:

### 1. Go to Vercel Dashboard
- Navigate to your project settings
- Go to "Settings" → "General"

### 2. Configure Build Settings
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Alternative: Use Vercel CLI with Project Settings
```bash
vercel --prod
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No
- **What's your project's name?** → emily-frontend (or any name)
- **In which directory is your code located?** → `./frontend`

### 4. Environment Variables
Make sure these are set in Vercel dashboard:
- `VITE_API_URL` = `https://your-backend-url.onrender.com`
- `VITE_SUPABASE_URL` = `https://yibrsxythicjzshqhqxf.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `your_supabase_anon_key`
