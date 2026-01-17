#!/bin/bash
# Railway Environment Variables Setup Script
# Run this AFTER all services (Redis, PostgreSQL, Scrapegoat, Worker) are created

set -e

echo "🚂 Setting Railway Environment Variables"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -d "brainscraper" ] || [ ! -d "scrapegoat" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# BrainScraper Service Variables
echo "📦 Setting BrainScraper service variables..."
cd brainscraper

railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "NODE_ENV=production"
railway variables --set "PORT=3000"
railway variables --set "NEXT_PUBLIC_BASE_URL=https://brainscraper.io"
railway variables --set "DATA_DIR=/data"

echo "✅ BrainScraper variables set"
echo "⚠️  Remember to set RAPIDAPI_KEY manually:"
echo "   railway variables --set 'RAPIDAPI_KEY=your-key'"
echo ""

# Scrapegoat Service Variables
echo "📦 Setting Scrapegoat service variables..."
cd ../scrapegoat

railway variables --set "DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "APP_DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_CELERY_BROKER_URL=\${{redis-bridge.REDIS_URL}}/1"
railway variables --set "APP_CELERY_RESULT_BACKEND=\${{redis-bridge.REDIS_URL}}/2"
railway variables --set "PYTHONUNBUFFERED=1"

echo "✅ Scrapegoat variables set"
echo "⚠️  Remember to set API keys manually:"
echo "   railway variables --set 'OPENAI_API_KEY=sk-proj-k8Co9...'"
echo "   railway variables --set 'CENSUS_API_KEY=b4f15ee777...'"
echo ""

# Scrapegoat Worker Service Variables
echo "📦 Setting Scrapegoat Worker service variables..."
echo "⚠️  Note: Worker service must be linked first"
echo "   cd scrapegoat"
echo "   railway service  # Select scrapegoat-worker"
echo "   Then run the same variables as Scrapegoat"
echo ""

cd ..

echo "✅ Environment variables setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Add Redis service (name: redis-bridge) in Railway dashboard"
echo "2. Add PostgreSQL service in Railway dashboard"
echo "3. Set API keys manually (RAPIDAPI_KEY, OPENAI_API_KEY, CENSUS_API_KEY)"
echo "4. Verify variables: railway variables"
echo ""
