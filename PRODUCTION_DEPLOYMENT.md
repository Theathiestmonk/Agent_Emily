# Emily Digital Marketing Agent - Production Deployment Guide

## 🚀 Production Deployment Overview

This guide covers deploying Emily to production with:
- **Frontend**: Vercel (React + Vite)
- **Backend**: Render (Python + FastAPI)
- **Database**: Supabase (PostgreSQL)

## 📋 Prerequisites

1. **Vercel Account** (for frontend)
2. **Render Account** (for backend)
3. **Supabase Project** (for database)
4. **GitHub Repository** (for deployment)

## 🎯 Frontend Deployment (Vercel)

### 1. Build Configuration
The frontend is already configured with `vercel.json`:
```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "frontend/dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "VITE_API_URL": "@vite_api_url"
  }
}
```

### 2. Environment Variables (Vercel)
Set these in Vercel dashboard:
- `VITE_API_URL`: Your Render backend URL (e.g., `https://emily-backend.onrender.com`)
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

### 3. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod
```

## 🔧 Backend Deployment (Render)

### 1. Render Configuration
The backend is configured with `Procfile`:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 2. Environment Variables (Render)
Set these in Render dashboard:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `SECRET_KEY`: A strong secret key for JWT
- `OPENAI_API_KEY`: Your OpenAI API key

### 3. Deploy to Render
1. Connect your GitHub repository
2. Select the backend folder as root directory
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## 🗄️ Database Setup (Supabase)

### 1. Run Database Migrations
Execute these SQL files in Supabase SQL Editor:
1. `database/schema.sql` - User profiles and onboarding
2. `database/content_creation_schema.sql` - Content campaigns and posts

### 2. Enable Row Level Security (RLS)
Ensure RLS policies are enabled for all tables.

### 3. Configure Storage Buckets
Create storage buckets for content images if needed.

## 🔐 Security Checklist

### Frontend Security
- ✅ Environment variables properly configured
- ✅ API calls use HTTPS in production
- ✅ Supabase client properly configured
- ✅ Error boundaries implemented

### Backend Security
- ✅ CORS configured for production domain
- ✅ JWT token validation
- ✅ Service role key for admin operations
- ✅ Input validation with Pydantic
- ✅ Error handling and logging

### Database Security
- ✅ RLS policies enabled
- ✅ Service role key for backend operations
- ✅ Proper user authentication flow

## 📊 Production Monitoring

### 1. Backend Logs
Monitor Render logs for:
- Content generation errors
- Database connection issues
- API rate limiting
- Background scheduler status

### 2. Frontend Monitoring
Monitor Vercel analytics for:
- Page load times
- Error rates
- User engagement

### 3. Database Monitoring
Monitor Supabase for:
- Query performance
- Storage usage
- API rate limits

## 🔄 Background Scheduler

The content generation runs automatically every Sunday at 4:00 AM IST using `apscheduler`. This works in cloud deployments because:
- Runs within the FastAPI application
- No external cron jobs needed
- Automatically starts with the server
- Uses marker files to prevent duplicate runs

## 🧪 Testing Production

### 1. Test Content Generation
```bash
# Test manual content generation
curl -X POST https://your-backend-url.onrender.com/content/trigger-weekly
```

### 2. Test Authentication
- Test login flow
- Test onboarding completion
- Test protected routes

### 3. Test Content Calendar
- Verify content displays correctly
- Test date filtering
- Test hover interactions

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check CORS configuration in `main.py`
   - Verify frontend URL in allowed origins

2. **Database Connection Issues**
   - Verify Supabase credentials
   - Check service role key permissions

3. **Content Generation Fails**
   - Check OpenAI API key
   - Verify user profiles exist
   - Check background scheduler logs

4. **Frontend Build Issues**
   - Check environment variables
   - Verify API URL configuration

## 📈 Performance Optimization

### Frontend
- ✅ Code splitting with Vite
- ✅ CSS optimization
- ✅ Image optimization
- ✅ Bundle size optimization

### Backend
- ✅ Async/await patterns
- ✅ Database connection pooling
- ✅ Efficient content generation
- ✅ Background task processing

## 🔄 Continuous Deployment

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml` for automated deployment:

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./frontend
```

## 📞 Support

For production issues:
1. Check Render logs
2. Check Vercel logs
3. Check Supabase logs
4. Review this troubleshooting guide

---

**Status**: ✅ Production Ready
**Last Updated**: September 2025
**Version**: 1.0.0
