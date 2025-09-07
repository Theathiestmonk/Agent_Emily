#!/bin/bash

echo "🚀 Deploying Frontend to Root for Vercel..."

# Create backup of current structure
echo "📦 Creating backup..."
cp -r frontend frontend-backup

# Move frontend files to root
echo "📁 Moving frontend files to root..."
cp -r frontend/* .
cp frontend/package.json .
cp frontend/package-lock.json .

# Create simple vercel.json for root deployment
echo "⚙️ Creating vercel.json for root deployment..."
cat > vercel.json << 'EOF'
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
EOF

# Create .vercelignore for root
echo "🚫 Creating .vercelignore..."
cat > .vercelignore << 'EOF'
backend/
database/
*.md
.env*
node_modules/
venv/
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
pip-log.txt
pip-delete-this-directory.txt
*.log
*.pid
*.seed
*.pid.lock
coverage/
.nyc_output
.npm
.node_repl_history
*.tgz
.yarn-integrity
.cache
.parcel-cache
.next
.nuxt
.vuepress/dist
.serverless
.fusebox/
.dynamodb/
.tern-port
.vscode-test
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
*.tmp
*.temp
temp/
tmp/
*.db
*.sqlite
*.sqlite3
*.bak
*.backup
frontend-backup/
EOF

echo "✅ Frontend moved to root directory!"
echo "📝 Now you can deploy to Vercel normally"
echo "🔄 To restore original structure: ./restore-frontend.sh"
