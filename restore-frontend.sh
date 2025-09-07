#!/bin/bash

echo "🔄 Restoring original frontend structure..."

# Remove root frontend files
echo "🗑️ Removing root frontend files..."
rm -rf src/
rm -rf public/
rm -rf dist/
rm -f package.json
rm -f package-lock.json
rm -f index.html
rm -f vite.config.js
rm -f tailwind.config.js
rm -f postcss.config.js
rm -f .env.local

# Restore from backup
echo "📦 Restoring from backup..."
mv frontend-backup frontend

echo "✅ Original structure restored!"
