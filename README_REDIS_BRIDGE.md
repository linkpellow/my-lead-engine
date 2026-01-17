# Redis Bridge Architecture

## Overview

The Redis Bridge implements a professional producer-consumer pattern between **BrainScraper** (Step 1) and **Scrapegoat** (Step 2), enabling high-speed lead fetching while processing intensive AI-driven enrichment at its own pace.

## Architecture

```
BrainScraper (Producer) → Redis Queue → Scrapegoat Worker (Consumer)
                              ↓
                        Dead Letter Queue (DLQ)
```

### Components

1. **BrainScraper (Producer)**
   - Scrapes leads from LinkedIn and other sources
   - Pushes raw lead data to Redis queue `leads_to_enrich`
   - Located in: `brainscraper/lib/redis.ts`

2. **Redis Queue**
   - Named queue: `leads_to_enrich`
   - FIFO (First In, First Out) processing
   - Persistent storage with AOF (Append Only File)

3. **Scrapegoat Worker (Consumer)**
   - Continuously polls Redis queue
   - Processes leads through enrichment pipeline
   - Implements retry logic with exponential backoff
   - Located in: `scrapegoat/app/workers/redis_queue_worker.py`

4. **Dead Letter Queue (DLQ)**
   - Queue: `failed_leads`
   - Stores leads that failed after max retries
   - Can be inspected and manually retried via API

## Usage

### Starting the System

```bash
# Start all services including worker
docker-compose up --build

# Scale worker for parallel processing (5 workers)
docker-compose up --scale scrapegoat-worker=5 -d
```

### Monitoring

#### Check Queue Status
```bash
# Connect to Redis
docker exec -it scrapegoat-redis redis-cli

# Check queue length
LLEN leads_to_enrich

# Check DLQ length
LLEN failed_leads
```

#### DLQ API Endpoints

- `GET /dlq/items?limit=50` - List failed leads
- `GET /dlq/count` - Get count of failed leads
- `POST /dlq/retry/{item_index}` - Retry a specific failed lead
- `DELETE /dlq/clear` - Clear all failed leads (WARNING: permanent)

### Configuration

#### Environment Variables

**BrainScraper:**
- `REDIS_URL` - Redis connection URL (default: `redis://redis:6379` in Docker)

**Scrapegoat:**
- `REDIS_URL` - Redis connection URL (default: `redis://redis:6379/0` in Docker)
- `APP_REDIS_URL` - Alternative Redis URL setting

#### Retry Configuration

Located in `scrapegoat/app/workers/redis_queue_worker.py`:
- `MAX_RETRIES = 3` - Maximum retry attempts
- `RETRY_DELAY_BASE = 5` - Base delay in seconds (exponential backoff)

## Reliability Features

### 2026 Standards Implementation

1. **Dead Letter Queues (DLQ)**
   - Automatic push to DLQ after max retries
   - Manual inspection and retry via API
   - Exponential backoff for retries

2. **Healthchecks**
   - All services have healthchecks in docker-compose
   - Services wait for dependencies to be healthy before starting
   - Redis healthcheck ensures bridge is ready

3. **Independent Scaling**
   - Worker can be scaled independently
   - Multiple workers process queue in parallel
   - Example: `docker-compose up --scale scrapegoat-worker=5`

4. **Connection Resilience**
   - Automatic reconnection on Redis errors
   - Connection pooling
   - Graceful error handling

## Performance

### Target: 10k Leads Per Week

With the current setup:
- **BrainScraper**: Can scrape at maximum speed (no blocking)
- **Scrapegoat Workers**: Process at their own pace (CPU/Token limited)
- **Queue**: Buffers leads for processing
- **Scaling**: Add more workers as needed

### Scaling Example

```bash
# 1 BrainScraper + 5 Workers = 5x enrichment throughput
docker-compose up --scale scrapegoat-worker=5 -d
```

## Troubleshooting

### Queue Not Processing

1. Check worker is running:
   ```bash
   docker logs scrapegoat-worker
   ```

2. Check Redis connection:
   ```bash
   docker exec -it scrapegoat-redis redis-cli ping
   ```

3. Check queue has items:
   ```bash
   docker exec -it scrapegoat-redis redis-cli LLEN leads_to_enrich
   ```

### Leads Stuck in DLQ

1. Inspect failed leads:
   ```bash
   curl http://localhost:8000/dlq/items?limit=10
   ```

2. Retry specific lead:
   ```bash
   curl -X POST http://localhost:8000/dlq/retry/0
   ```

## Code Locations

- **Producer**: `brainscraper/lib/redis.ts`
- **Queue Integration**: `brainscraper/utils/inngest/scraping.ts` (line ~160)
- **Consumer**: `scrapegoat/app/workers/redis_queue_worker.py`
- **DLQ API**: `scrapegoat/app/api/dlq.py`
- **Worker Startup**: `scrapegoat/start_redis_worker.py`
- **Docker Compose**: `docker-compose.yml`
