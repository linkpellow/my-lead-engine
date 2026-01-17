#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Adding essential configuration files..."
git add brainscraper/railway.toml || true
git add brainscraper/nixpacks.toml || true  
git add brainscraper/Dockerfile || true
git add brainscraper/server.js || true
git add brainscraper/tsconfig.json || true
git add brainscraper/tailwind.config.ts || true
git add brainscraper/postcss.config.mjs || true
git add brainscraper/middleware.ts || true
git add brainscraper/.eslintrc.json || true
git add brainscraper/.gitignore || true

echo "Adding app directory (excluding CSV files)..."
find brainscraper/app -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) ! -name "*.csv" -exec git add {} \; 2>/dev/null || true

echo "Adding lib, utils, types directories..."
find brainscraper/lib -type f -name "*.ts" -exec git add {} \; 2>/dev/null || true
find brainscraper/utils -type f -name "*.ts" -exec git add {} \; 2>/dev/null || true
find brainscraper/types -type f -name "*.ts" -exec git add {} \; 2>/dev/null || true

echo "Adding public directory..."
find brainscraper/public -type f -exec git add {} \; 2>/dev/null || true

echo "Done. Run 'git status' to see what was added."
