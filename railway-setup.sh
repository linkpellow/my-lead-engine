#!/bin/bash
# Railway Deployment Setup Script
# Run this script to set up your Railway project

set -e

echo "🚂 Railway Deployment Setup"
echo "=============================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    brew install railway || npm i -g @railway/cli
fi

echo "✅ Railway CLI found: $(railway --version)"
echo ""

# Step 1: Login
echo "Step 1: Authenticating with Railway..."
echo "This will open your browser for authentication."
read -p "Press Enter to continue..."
railway login

# Step 2: Create or link project
echo ""
echo "Step 2: Setting up project..."
echo "Choose an option:"
echo "  1) Create new project"
echo "  2) Link to existing project"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" == "1" ]; then
    echo "Creating new project..."
    railway init
else
    echo "Linking to existing project..."
    railway link
fi

# Step 3: Add Redis
echo ""
echo "Step 3: Adding Redis service..."
railway add redis
echo "✅ Redis service added"

# Step 4: Add PostgreSQL
echo ""
echo "Step 4: Adding PostgreSQL service..."
railway add postgresql
echo "✅ PostgreSQL service added"

# Step 5: Show current status
echo ""
echo "Step 5: Current project status..."
railway status

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure environment variables (see RAILWAY_DEPLOYMENT.md)"
echo "2. Deploy services: railway up"
echo "3. Add custom domain in Railway dashboard"
echo ""
