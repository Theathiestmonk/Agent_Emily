#!/bin/bash
# Script to move frontend files to root for Vercel deployment

echo "Moving frontend files to root directory..."

# Move frontend files to root
cp -r frontend/* .
cp frontend/package.json .
cp frontend/package-lock.json .

# Update package.json to remove the frontend/ prefix from scripts
sed -i 's|"dev": "vite"|"dev": "vite"|g' package.json
sed -i 's|"build": "vite build"|"build": "vite build"|g' package.json

# Create a simple vercel.json for root deployment
cat > vercel.json << EOF
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

echo "Frontend moved to root. You can now deploy to Vercel."
