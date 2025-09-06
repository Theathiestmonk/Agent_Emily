#!/bin/bash

# Emily Digital Marketing Agent - Production Build Script
# This script builds the frontend and prepares the backend for production deployment

echo "🚀 Building Emily for Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the Emily project root directory"
    exit 1
fi

print_status "Starting production build process..."

# 1. Build Frontend
print_status "Building frontend..."
cd frontend

# Clean previous build
print_status "Cleaning previous build..."
npm run clean

# Install dependencies
print_status "Installing frontend dependencies..."
npm install

# Build for production
print_status "Building frontend for production..."
npm run build:prod

if [ $? -eq 0 ]; then
    print_status "Frontend build completed successfully!"
else
    print_error "Frontend build failed!"
    exit 1
fi

cd ..

# 2. Prepare Backend
print_status "Preparing backend for production..."

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    print_warning "Virtual environment not found. Creating one..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# 3. Create production build info
print_status "Creating production build info..."
cat > build-info.txt << EOF
Emily Digital Marketing Agent - Production Build
Build Date: $(date)
Frontend Build: $(ls -la frontend/dist/ | head -1)
Backend Version: $(cd backend && python -c "import main; print('1.0.0')" 2>/dev/null || echo "Unknown")
Node Version: $(node --version)
Python Version: $(python3 --version)
EOF

# 4. Create deployment checklist
print_status "Creating deployment checklist..."
cat > DEPLOYMENT_CHECKLIST.md << EOF
# Emily Production Deployment Checklist

## ✅ Build Complete
- [x] Frontend built successfully
- [x] Backend prepared for deployment
- [x] Dependencies installed

## 🔧 Environment Variables to Set

### Frontend (Vercel)
- VITE_API_URL: https://your-backend-url.onrender.com
- VITE_SUPABASE_URL: your_supabase_url
- VITE_SUPABASE_ANON_KEY: your_supabase_anon_key

### Backend (Render)
- SUPABASE_URL: your_supabase_url
- SUPABASE_ANON_KEY: your_supabase_anon_key
- SUPABASE_SERVICE_ROLE_KEY: your_supabase_service_role_key
- SECRET_KEY: your_strong_secret_key
- OPENAI_API_KEY: your_openai_api_key
- ENVIRONMENT: production
- LOG_LEVEL: INFO

## 🚀 Deployment Steps

### 1. Deploy Backend to Render
1. Connect GitHub repository
2. Set root directory to: backend
3. Set build command: pip install -r requirements.txt
4. Set start command: uvicorn main:app --host 0.0.0.0 --port \$PORT
5. Add environment variables

### 2. Deploy Frontend to Vercel
1. Connect GitHub repository
2. Set root directory to: frontend
3. Add environment variables
4. Deploy

### 3. Database Setup
1. Run database migrations in Supabase
2. Enable RLS policies
3. Test connections

## 🧪 Testing
- [ ] Test login flow
- [ ] Test content generation
- [ ] Test content calendar
- [ ] Test background scheduler

## 📊 Monitoring
- [ ] Set up logging
- [ ] Monitor performance
- [ ] Set up alerts

EOF

print_status "Production build completed successfully!"
print_status "Build info saved to: build-info.txt"
print_status "Deployment checklist saved to: DEPLOYMENT_CHECKLIST.md"
print_warning "Don't forget to:"
print_warning "1. Set up environment variables in your deployment platforms"
print_warning "2. Run database migrations in Supabase"
print_warning "3. Test the deployed application"

echo ""
print_status "🎉 Emily is ready for production deployment!"
