# Triple-Vessel Deployment Guide

## 🎯 Pre-Deployment Checklist

### The Brain (Python)

```bash
cd chimera_brain

# Verify requirements.txt exists
cat requirements.txt

# Generate Cargo.lock equivalent (freeze current deps)
# Only if you want exact versions:
# pip freeze > requirements.txt

# Generate proto files if needed
./generate_proto.sh
```

**Files Ready:**
- ✅ `requirements.txt` - Python dependencies
- ✅ `Dockerfile` - Container build
- ✅ `railway.toml` - Railway config
- ✅ `server.py` - gRPC server

### The Body (Rust)

```bash
cd chimera-core

# Generate Cargo.lock (REQUIRED for reproducible builds)
cargo build

# Verify Cargo.lock was created
ls -la Cargo.lock
```

**Files Ready:**
- ✅ `Cargo.toml` - Rust dependencies
- ⚠️ `Cargo.lock` - **Run `cargo build` to generate**
- ✅ `Dockerfile` - Container build
- ✅ `railway.toml` - Railway config
- ✅ `src/` - Source code

---

## 🚀 Deployment Sequence

### Step 1: Push The Brain

```bash
cd chimera_brain
git add .
git commit -m "feat: brain live with gRPC server on port 50051"
git push
```

**Railway will:**
1. Build the Docker image
2. Install Python dependencies
3. Start the gRPC server on port 50051
4. Expose internal DNS: `chimera-brain.railway.internal:50051`

### Step 2: Push The Body

```bash
cd chimera-core
git add .
git commit -m "feat: rust body with stealth modules"
git push
```

**Railway will:**
1. Build the Rust binary
2. Deploy worker instances
3. Connect to Brain via internal DNS

---

## 🔧 Railway Configuration

### Service: Redis Stack (CRITICAL for Hive Mind)

⚠️ **Standard Redis does NOT support `FT.CREATE` (vector indexing).** You must use Redis Stack.

| Setting | Value |
|---------|-------|
| Image | `redis/redis-stack-server:latest` |
| Start Command | **LEAVE EMPTY** (delete any existing value) |
| Port | `6379` (default) |

**Why this matters:**
- `FT.CREATE` requires the RediSearch module (only in Redis Stack)
- Enables the Brain's vector memory for experience recall
- ⚠️ Do NOT use `redis/redis-stack` (includes GUI, causes port conflicts)

**How to fix ignition failure:**
1. Go to Redis service → **Settings → Deploy**
2. **Clear the Start Command** (delete everything, leave field empty)
3. Set image to `redis/redis-stack-server:latest`
4. Verify `REDIS_URL=redis://:${{REDISPASSWORD}}@${{REDISHOST}}:${{REDISPORT}}`

---

### Service: chimera-brain

| Setting | Value |
|---------|-------|
| Root Directory | `chimera_brain` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python server.py` |
| Port | `50051` |

**Environment Variables:**
```bash
PORT=50051
PYTHONUNBUFFERED=1
REDIS_URL=${{redis-stack.REDIS_URL}}  # For Hive Mind (must be Redis Stack)
```

### Service: chimera-core

| Setting | Value |
|---------|-------|
| Root Directory | `chimera-core` |
| Build Command | `cargo build --release` |
| Start Command | `./target/release/chimera-worker` |

**Environment Variables:**
```bash
RUST_LOG=info
RAILWAY_ENVIRONMENT=production
CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051
```

---

## 🔗 Internal Networking

Railway uses service names as internal hostnames:

| Service | Internal Address |
|---------|------------------|
| Brain | `chimera-brain.railway.internal:50051` |
| Body | (Worker - no exposed port) |

The Body automatically connects to the Brain using:
```rust
CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051
```

---

## ✅ Verification

### Brain Health Check

```bash
# In Railway logs, you should see:
🧠 Starting The Brain gRPC server on [::]:50051
   - Vision Service: Full VLM
   - Hive Mind: Enabled
```

### Body Connection Check

```bash
# In Railway logs, you should see:
🦾 Chimera Core - The Body - Starting...
✅ Connected to The Brain at: http://chimera-brain.railway.internal:50051
🎯 The Body is ready for missions!
```

---

## 🧪 CreepJS Stealth Test

Once deployed, run the stealth validation:

```bash
# Local test (Brain must be running)
cd chimera-core
cargo run -- --test-stealth
```

**Target:** 100% Human Trust Score on CreepJS

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY PLATFORM                          │
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  The General     │         │   The Brain      │          │
│  │  (BrainScraper)  │         │   (chimera_brain)│          │
│  │  Port: 3000      │         │   Port: 50051    │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                             │                    │
│           │  gRPC                       │ gRPC               │
│           └─────────────────────────────┤                    │
│                                         │                    │
│                         ┌───────────────┴───────────────┐    │
│                         │       The Body                │    │
│                         │       (chimera-core)          │    │
│                         │       5x Worker Swarm         │    │
│                         │       Stealth Automation      │    │
│                         └───────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎉 Singularity Achieved

With all three vessels deployed:

- **The General** orchestrates missions (When)
- **The Brain** provides AI reasoning (Why/Where)
- **The Body** executes with stealth (How)

**Result:** A Chimera Autonomous Agent that is mathematically and behaviorally indistinguishable from a human user.
