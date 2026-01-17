# Railway Deployment Guide - Unified BrainScraper + Scrapegoat

This guide covers deploying the unified codebase with Redis Bridge to Railway and pointing `brainscraper.io` to the production environment.

## Architecture Overview

```
brainscraper.io (Domain)
    ↓
Railway Project
    ├── BrainScraper Service (Next.js) - Port 3000
    ├── Scrapegoat Service (FastAPI) - Port 8000
    ├── Redis Service (Queue Bridge)
    ├── PostgreSQL Service (Database)
    └── Scrapegoat Worker Service (Queue Consumer) - Multiple Replicas
```

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository connected (https://github.com/linkpellow/scrapeshifter)
3. Domain access to `brainscraper.io` DNS settings
4. Environment variables ready (see below)

## Step 1: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `linkpellow/scrapeshifter`
5. Railway will automatically detect services in `brainscraper/` and `scrapegoat/` directories

## Step 2: Add Required Services

Railway will auto-detect services, but you need to add:

### A. Redis Service
1. In Railway project, click **"New"** → **"Database"** → **"Add Redis"**
2. Name it: `redis-bridge`
3. Railway will provide connection URL automatically

### B. PostgreSQL Service
1. In Railway project, click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Name it: `scrapegoat-db`
3. Railway will provide connection URL automatically

## Step 3: Configure BrainScraper Service

1. Railway should auto-detect `brainscraper/` directory
2. If not, click **"New"** → **"GitHub Repo"** → Select `brainscraper` folder
3. Go to service **Settings** → **Variables**

### Environment Variables for BrainScraper:
```bash
NODE_ENV=production
PORT=3000
REDIS_URL=${{redis-bridge.REDIS_URL}}
NEXT_PUBLIC_BASE_URL=https://brainscraper.io
DATA_DIR=/data
```

### Add Persistent Volume:
1. Go to **Settings** → **Volumes**
2. Click **"Add Volume"**
3. Mount path: `/data`
4. Name: `brainscraper-data`

## Step 4: Configure Scrapegoat Service

1. Railway should auto-detect `scrapegoat/` directory
2. Go to service **Settings** → **Variables**

### Environment Variables for Scrapegoat:
```bash
PYTHONUNBUFFERED=1
APP_DATABASE_URL=${{scrapegoat-db.DATABASE_URL}}
APP_REDIS_URL=${{redis-bridge.REDIS_URL}}
REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}
```

**Note**: Railway automatically converts `DATABASE_URL` format, but we handle it in the start command.

## Step 5: Create Scrapegoat Worker Service

1. Click **"New"** → **"GitHub Repo"**
2. Select the same repository
3. In **Settings** → **Root Directory**, set to: `scrapegoat`
4. Go to **Settings** → **Variables** and add the same variables as Scrapegoat service
5. In **Settings** → **Deploy**, set **Start Command** to:
   ```bash
   python start_redis_worker.py
   ```

### Scale Worker Service:
1. Go to **Settings** → **Scaling**
2. Set **Replicas** to **5** (for 10k leads/week target)
3. Railway will automatically distribute load

## Step 6: Point Domain to Railway

### A. Get Railway Domain
1. Go to **BrainScraper** service
2. Click **"Settings"** → **"Domains"**
3. Railway provides: `brainscraper-production.up.railway.app`
4. Copy this CNAME value

### B. Update DNS
1. Go to your domain provider (where `brainscraper.io` is registered)
2. Access DNS settings
3. Add/Update CNAME record:
   - **Type**: CNAME
   - **Name**: `@` (or `www` for www.brainscraper.io)
   - **Value**: `brainscraper-production.up.railway.app`
   - **TTL**: 3600 (or default)

### C. Add Custom Domain in Railway
1. In **BrainScraper** service → **Settings** → **"Domains"**
2. Click **"Custom Domain"**
3. Enter: `brainscraper.io`
4. Railway will automatically provision SSL certificate (may take 5-10 minutes)

## Step 7: Verify Redis Bridge Connection

### Check Queue Status:
1. Go to **Redis** service in Railway
2. Click **"Connect"** → **"Redis CLI"**
3. Run:
   ```bash
   LLEN leads_to_enrich
   ```
4. Should return `0` initially (empty queue)

### Monitor Queue Growth:
After deployment, monitor with:
```bash
# Check queue length
LLEN leads_to_enrich

# Check failed leads (DLQ)
LLEN failed_leads

# View recent queue activity
LRANGE leads_to_enrich 0 10
```

## Step 8: Verify Deployment

### A. Check Service Health
1. **BrainScraper**: https://brainscraper.io (or Railway domain)
2. **Scrapegoat API**: https://your-scrapegoat-service.railway.app/health
3. **DLQ API**: https://your-scrapegoat-service.railway.app/dlq/count

### B. Test Lead Flow
1. Trigger a scrape job from BrainScraper UI
2. Check Redis queue: `LLEN leads_to_enrich` should increase
3. Check worker logs in Railway for processing activity
4. Verify enriched leads appear in BrainScraper

## Step 9: Monitor Production

### Key Metrics to Watch:

1. **Queue Length** (Redis):
   ```bash
   LLEN leads_to_enrich
   ```
   - Should stay low (< 100) if workers are keeping up
   - If growing, scale workers

2. **Failed Leads** (DLQ):
   ```bash
   LLEN failed_leads
   ```
   - Check via API: `/dlq/items?limit=10`
   - Retry failed leads: `/dlq/retry/{index}`

3. **Worker Health**:
   - Check Railway logs for worker service
   - Look for: `✅ Enriched lead` messages
   - Watch for: `❌ Failed to enrich` errors

4. **Service Uptime**:
   - Railway dashboard shows service status
   - Set up alerts for service failures

## Troubleshooting

### Issue: Domain Not Resolving
- **Check**: DNS propagation (can take up to 48 hours)
- **Verify**: CNAME record is correct
- **Test**: `dig brainscraper.io` or `nslookup brainscraper.io`

### Issue: Queue Not Processing
- **Check**: Worker service is running (Railway dashboard)
- **Verify**: Redis connection in worker logs
- **Scale**: Increase worker replicas if queue is backing up

### Issue: SSL Certificate Not Provisioned
- **Wait**: Can take 5-10 minutes after DNS propagates
- **Check**: Railway domain settings show "Provisioning"
- **Verify**: DNS is correctly pointing to Railway

### Issue: Leads Not Enriching
- **Check**: Worker logs for errors
- **Verify**: Redis URL is correct in all services
- **Monitor**: DLQ for failed leads
- **Test**: Manual enrichment via API

## Environment Variables Reference

### BrainScraper Service
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `PORT` | Yes | Server port | `3000` |
| `REDIS_URL` | Yes | Redis connection (use Railway variable) | `${{redis-bridge.REDIS_URL}}` |
| `NEXT_PUBLIC_BASE_URL` | Yes | Public URL for API calls | `https://brainscraper.io` |
| `DATA_DIR` | Yes | Persistent data directory | `/data` |

### Scrapegoat Service
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `APP_DATABASE_URL` | Yes | PostgreSQL connection | `${{scrapegoat-db.DATABASE_URL}}` |
| `APP_REDIS_URL` | Yes | Redis connection | `${{redis-bridge.REDIS_URL}}` |
| `REDIS_URL` | Yes | Redis connection (alias) | `${{redis-bridge.REDIS_URL}}` |
| `PYTHONUNBUFFERED` | Yes | Python output buffering | `1` |

### Scrapegoat Worker Service
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| Same as Scrapegoat service | Yes | All Scrapegoat variables | See above |

## Scaling for Production

### Target: 10k Leads/Week

**Recommended Configuration:**
- **BrainScraper**: 1 instance (handles scraping)
- **Scrapegoat API**: 1 instance (handles API requests)
- **Scrapegoat Workers**: 5 instances (process enrichment queue)
- **Redis**: 1 instance (queue bridge)
- **PostgreSQL**: 1 instance (database)

### Auto-Scaling Workers:
1. Monitor queue length: `LLEN leads_to_enrich`
2. If consistently > 100, increase worker replicas
3. Railway allows easy scaling via dashboard

## Security Checklist

- [ ] All API keys stored in Railway environment variables (not in code)
- [ ] Redis password protected (Railway handles this)
- [ ] PostgreSQL access restricted to services only
- [ ] SSL certificate provisioned for custom domain
- [ ] CORS configured correctly in Scrapegoat
- [ ] Rate limiting enabled in BrainScraper

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Point domain
3. ✅ Verify SSL
4. ✅ Test lead flow
5. ✅ Monitor queue
6. ✅ Scale workers as needed
7. ✅ Set up alerts

## Support

- Railway Docs: https://docs.railway.app
- Railway Status: https://status.railway.app
- Redis Bridge Docs: See `README_REDIS_BRIDGE.md`
