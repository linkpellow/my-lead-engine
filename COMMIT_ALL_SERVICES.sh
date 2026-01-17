#!/bin/bash
# Script to commit essential files for Railway deployment
# Run this from the repository root

set -e

echo "=========================================="
echo "Committing Essential Files for Railway"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -d "brainscraper" ] || [ ! -d "scrapegoat" ]; then
    echo "Error: Must run from repository root"
    exit 1
fi

echo "Step 1: Adding brainscraper essential files..."
echo "-------------------------------------------"

# Configuration files
git add brainscraper/railway.toml 2>/dev/null && echo "✓ railway.toml" || echo "✗ railway.toml (failed)"
git add brainscraper/nixpacks.toml 2>/dev/null && echo "✓ nixpacks.toml" || echo "✗ nixpacks.toml (failed)"
git add brainscraper/Dockerfile 2>/dev/null && echo "✓ Dockerfile" || echo "✗ Dockerfile (failed)"
git add brainscraper/server.js 2>/dev/null && echo "✓ server.js" || echo "✗ server.js (failed)"
git add brainscraper/tsconfig.json 2>/dev/null && echo "✓ tsconfig.json" || echo "✗ tsconfig.json (failed)"
git add brainscraper/tailwind.config.ts 2>/dev/null && echo "✓ tailwind.config.ts" || echo "✗ tailwind.config.ts (failed)"
git add brainscraper/postcss.config.mjs 2>/dev/null && echo "✓ postcss.config.mjs" || echo "✗ postcss.config.mjs (failed)"
git add brainscraper/middleware.ts 2>/dev/null && echo "✓ middleware.ts" || echo "✗ middleware.ts (failed)"
git add brainscraper/.eslintrc.json 2>/dev/null && echo "✓ .eslintrc.json" || echo "✗ .eslintrc.json (failed)"
git add brainscraper/.gitignore 2>/dev/null && echo "✓ .gitignore" || echo "✗ .gitignore (failed)"

# Application directories (using find to avoid timeouts)
echo ""
echo "Adding application directories..."
find brainscraper/app -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) ! -name "*.csv" -exec git add {} \; 2>/dev/null
echo "✓ app/ directory files"

find brainscraper/lib -type f -name "*.ts" -exec git add {} \; 2>/dev/null
echo "✓ lib/ directory files"

find brainscraper/utils -type f -name "*.ts" -exec git add {} \; 2>/dev/null
echo "✓ utils/ directory files"

find brainscraper/types -type f -name "*.ts" -exec git add {} \; 2>/dev/null
echo "✓ types/ directory files"

find brainscraper/public -type f -exec git add {} \; 2>/dev/null
echo "✓ public/ directory files"

echo ""
echo "Step 2: Adding scrapegoat essential files..."
echo "-------------------------------------------"

# Check what scrapegoat needs
if [ -f "scrapegoat/requirements.txt" ]; then
    git add scrapegoat/requirements.txt 2>/dev/null && echo "✓ requirements.txt" || echo "✗ requirements.txt (failed)"
fi

if [ -f "scrapegoat/railway.toml" ]; then
    git add scrapegoat/railway.toml 2>/dev/null && echo "✓ railway.toml" || echo "✗ railway.toml (failed)"
fi

if [ -f "scrapegoat/nixpacks.toml" ]; then
    git add scrapegoat/nixpacks.toml 2>/dev/null && echo "✓ nixpacks.toml" || echo "✗ nixpacks.toml (failed)"
fi

if [ -f "scrapegoat/Dockerfile" ]; then
    git add scrapegoat/Dockerfile 2>/dev/null && echo "✓ Dockerfile" || echo "✗ Dockerfile (failed)"
fi

# Add Python source files (adjust patterns as needed)
find scrapegoat -type f -name "*.py" ! -path "*/venv/*" ! -path "*/__pycache__/*" -exec git add {} \; 2>/dev/null
echo "✓ Python source files"

echo ""
echo "=========================================="
echo "Files staged. Checking status..."
echo "=========================================="
echo ""

git status --short | head -30

echo ""
echo "=========================================="
echo "Next steps:"
echo "1. Review the staged files above"
echo "2. Commit: git commit -m 'Add essential files for Railway deployment'"
echo "3. Push: git push origin main"
echo "4. Railway will automatically trigger new deployments"
echo "=========================================="
