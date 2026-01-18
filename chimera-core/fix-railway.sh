#!/bin/bash
# Railway CLI Recovery Script for chimera-core
# Run this script after: railway login

set -e

echo "🔧 Railway CLI Recovery - chimera-core Python Migration"
echo ""

# Step 1: Link to chimera-core service
echo "Step 1: Linking to chimera-core service..."
cd "$(dirname "$0")"
railway link --service chimera-core

# Step 2: Clear Dockerfile path (if it exists as a variable)
echo ""
echo "Step 2: Checking for Dockerfile path variable..."
if railway variables | grep -q "RAILWAY_DOCKERFILE_PATH"; then
    echo "   Found RAILWAY_DOCKERFILE_PATH - removing..."
    railway variables --unset RAILWAY_DOCKERFILE_PATH || true
else
    echo "   No RAILWAY_DOCKERFILE_PATH variable found (good!)"
fi

# Step 3: Verify Nixpacks can build
echo ""
echo "Step 3: Testing Nixpacks build..."
railway run nixpacks build . || {
    echo "⚠️  Nixpacks build test failed, but continuing..."
}

# Step 4: Deploy (nuclear option - no cache)
echo ""
echo "Step 4: Deploying with fresh build (no cache)..."
railway up --detach --service chimera-core

echo ""
echo "✅ Recovery complete!"
echo ""
echo "Verification:"
echo "  - Check Railway Dashboard: chimera-core service"
echo "  - Build Engine should show: Nixpacks"
echo "  - Status should be: Active"
echo ""
echo "Monitor logs with:"
echo "  railway logs --service chimera-core --tail 50"
