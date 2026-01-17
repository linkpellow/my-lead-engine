#!/usr/bin/env python3
"""
Spider Worker Entry Point
Starts the spider execution worker that listens to spider_jobs queue.

Usage:
    python start_spider_worker.py

Environment Variables:
    REDIS_URL: Redis connection URL
    SPIDER_FORWARD_TO_ENRICHMENT: Set to "true" to auto-forward results to leads queue
"""
import os
import sys
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set default environment
os.environ.setdefault("PYTHONUNBUFFERED", "1")

if __name__ == "__main__":
    from app.workers.spider_worker import start_worker
    start_worker()
