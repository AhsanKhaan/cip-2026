# 🖥️ 30 — Local Development VPS Setup (Mirrors Hetzner Production)

**Purpose:** Run the entire CIP-2026 worker stack on your local machine — exactly as it runs on Hetzner — without spending $4.51/mo or risking production data during development.

**What this gives you:**
- Local Redis (TCP) for BullMQ exactly as on Hetzner
- BullMQ workers running locally with PM2
- Full ingestion pipeline using mock data (zero API calls)
- WebSocket simulator for crypto prices
- MongoDB pointed to a local instance OR a separate Atlas dev cluster
- Hot-reload for worker code via `tsx watch`

**Total local cost:** $0
**Time to set up:** 30–45 minutes

**Last reviewed:** April 23, 2026

---

## 1. Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRODUCTION (Hetzner CX22 — $4.51/mo)                               │
├─────────────────────────────────────────────────────────────────────┤
│  Ubuntu 24.04 LTS                                                    │
│  Node.js 22 LTS via apt + nodesource                                 │
│  pnpm 9 + PM2                                                        │
│  Local Redis on 127.0.0.1:6379 (apt install redis-server)           │
│  chrony NTP + UTC timezone                                           │
│  UFW firewall + fail2ban                                             │
│  PRICE_DATA_MODE=live                                                │
│  Real MongoDB Atlas + Upstash + MetalpriceAPI + Binance              │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ MIRROR ↕
┌─────────────────────────────────────────────────────────────────────┐
│  LOCAL DEV (Your laptop)                                             │
├─────────────────────────────────────────────────────────────────────┤
│  macOS / Linux / Windows WSL                                         │
│  Node.js 22 LTS via volta or nvm                                     │
│  pnpm 9 + PM2 (or tsx watch for hot reload)                          │
│  Local Redis on 127.0.0.1:6379 (Docker OR native install)            │
│  System NTP (already running on every modern OS)                     │
│  No firewall needed (no inbound traffic)                             │
│  PRICE_DATA_MODE=mock                                                │
│  MongoDB Atlas dev cluster + Upstash dev DB + MOCK API + MOCK WS    │
└─────────────────────────────────────────────────────────────────────┘
```

The same `apps/worker/src/` code runs on both environments. Only env vars + Redis location differ.

---

## 2. Two Approaches — Pick One

| Approach | Best For | Setup Time |
|---|---|---|
| **A. Docker Compose** | Anyone, any OS, fully isolated, mirrors prod precisely | 15 min |
| **B. Native Install** | macOS / Linux power users who don't want Docker | 25 min |

> **Recommendation:** Start with **Docker Compose** unless you're already a brew/apt power user. It's faster to set up and tear down.

---

## 3. Approach A — Docker Compose (Recommended)

### 3.1 Install Docker

| OS | Steps |
|---|---|
| macOS | Download [Docker Desktop](https://docker.com/products/docker-desktop) → install → run |
| Windows | Install [WSL 2](https://learn.microsoft.com/windows/wsl/install) first, then Docker Desktop |
| Linux | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker $USER` (logout/login) |

Verify:

```bash
docker --version             # Docker version 27+
docker compose version       # Docker Compose v2+
```

### 3.2 Create docker-compose.dev.yml

In your project root, create:

```yaml
# docker-compose.dev.yml
# Local development infrastructure that mirrors Hetzner production

name: cip-2026-dev

services:
  # ─── Local Redis (mirrors Hetzner Local Redis) ──────────────
  # Used by BullMQ exactly as production
  redis:
    image: redis:7-alpine
    container_name: cip-redis-dev
    restart: unless-stopped
    ports:
      - "6379:6379"           # Same port as Hetzner
    volumes:
      - cip-redis-data:/data
    command: >
      redis-server
      --requirepass devpassword123
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --bind 0.0.0.0
      --protected-mode yes
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "devpassword123", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  # ─── Optional: MongoDB Local (only if NOT using Atlas dev) ──
  # Uncomment if you prefer offline development.
  # Otherwise, point MONGODB_URI to a separate Atlas M0 dev cluster.
  #
  # mongo:
  #   image: mongo:7
  #   container_name: cip-mongo-dev
  #   restart: unless-stopped
  #   ports:
  #     - "27017:27017"
  #   environment:
  #     MONGO_INITDB_ROOT_USERNAME: dev
  #     MONGO_INITDB_ROOT_PASSWORD: devpassword
  #     MONGO_INITDB_DATABASE: cip_dev
  #   volumes:
  #     - cip-mongo-data:/data/db
  #   command: --bind_ip_all --wiredTigerCacheSizeGB 0.5

  # ─── Mongo Express (optional GUI for local Mongo) ───────────
  # Browser-based MongoDB explorer at http://localhost:8081
  #
  # mongo-express:
  #   image: mongo-express:1
  #   container_name: cip-mongo-express
  #   restart: unless-stopped
  #   ports:
  #     - "8081:8081"
  #   environment:
  #     ME_CONFIG_MONGODB_URL: mongodb://dev:devpassword@mongo:27017/
  #     ME_CONFIG_BASICAUTH_USERNAME: admin
  #     ME_CONFIG_BASICAUTH_PASSWORD: admin
  #   depends_on:
  #     - mongo

  # ─── Redis Commander (optional GUI for Redis) ───────────────
  # Browser-based Redis explorer at http://localhost:8082
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: cip-redis-commander
    restart: unless-stopped
    ports:
      - "8082:8081"
    environment:
      REDIS_HOSTS: local:redis:6379:0:devpassword123
    depends_on:
      redis:
        condition: service_healthy

volumes:
  cip-redis-data:
  cip-mongo-data:
```

### 3.3 Start the Stack

```bash
# Start in background
docker compose -f docker-compose.dev.yml up -d

# Verify everything is running
docker compose -f docker-compose.dev.yml ps
```

Expected output:

```
NAME                   STATUS    PORTS
cip-redis-dev          healthy   0.0.0.0:6379->6379/tcp
cip-redis-commander    running   0.0.0.0:8082->8081/tcp
```

### 3.4 Test Local Redis

```bash
# Quick test from host machine (you'll need redis-cli installed locally)
# OR enter the container:
docker exec -it cip-redis-dev redis-cli -a devpassword123 ping
# Should print: PONG

# Visit http://localhost:8082 to see Redis Commander GUI
```

### 3.5 Stop the Stack

```bash
docker compose -f docker-compose.dev.yml down

# Wipe all data (start fresh):
docker compose -f docker-compose.dev.yml down -v
```

---

## 4. Approach B — Native Install (No Docker)

Skip if you used Approach A.

### 4.1 macOS (Homebrew)

```bash
# Install Redis
brew install redis

# Configure with password (matches production pattern)
echo 'requirepass devpassword123' >> /opt/homebrew/etc/redis.conf
echo 'appendonly yes' >> /opt/homebrew/etc/redis.conf

# Start as background service
brew services start redis

# Verify
redis-cli -a devpassword123 ping
# PONG
```

### 4.2 Linux (Ubuntu/Debian)

```bash
sudo apt install -y redis-server

# Configure
sudo nano /etc/redis/redis.conf
# Set: requirepass devpassword123
# Set: appendonly yes
# Set: bind 127.0.0.1

sudo systemctl restart redis-server
sudo systemctl enable redis-server

redis-cli -a devpassword123 ping
# PONG
```

### 4.3 Windows (WSL 2 — Strongly Recommended)

Don't run Redis on raw Windows. Use WSL 2 Ubuntu, then follow the Linux steps above. Redis on Windows native is not officially supported.

```powershell
# In PowerShell (admin)
wsl --install Ubuntu-22.04
# Restart, then in Ubuntu shell:
sudo apt update && sudo apt install -y redis-server
# ... same as Linux instructions above
```

---

## 5. Local .env Configuration

### 5.1 Web App: `apps/web/.env.local`

```bash
# ─── Mode: ALWAYS mock in dev to preserve API quota ──
PRICE_DATA_MODE=mock
NODE_ENV=development

# ─── Database ──
# Option A: Use Atlas dev cluster (separate from production)
MONGODB_URI=mongodb+srv://dev_user:PASSWORD@cluster0-dev.xxxxx.mongodb.net/
MONGODB_DB_NAME=cip_dev

# Option B: Use local MongoDB (uncomment Mongo service in docker-compose)
# MONGODB_URI=mongodb://dev:devpassword@localhost:27017/
# MONGODB_DB_NAME=cip_dev

# ─── Cache: Use a separate dev Upstash database ──
# Create a SEPARATE Upstash DB for dev (don't share with prod)
UPSTASH_REDIS_REST_URL=https://your-dev-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx_dev_token

# ─── Auth: Use Clerk DEVELOPMENT instance (different from prod) ──
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
CLERK_SECRET_KEY=sk_test_xxxx

# ─── No real API key needed in mock mode ──
# METALPRICEAPI_KEY=  # Leave blank or set when occasionally testing live

# ─── Site URL ──
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=dev_revalidate_secret_random_chars

# ─── Email: Use Resend test domain ──
RESEND_API_KEY=re_test_xxxx
EMAIL_FROM=onboarding@resend.dev
```

### 5.2 Worker: `apps/worker/.env.local`

```bash
# ─── Mode ──
PRICE_DATA_MODE=mock
NODE_ENV=development

# ─── Database (same as web) ──
MONGODB_URI=mongodb+srv://dev_user:PASSWORD@cluster0-dev.xxxxx.mongodb.net/
MONGODB_DB_NAME=cip_dev

# ─── Upstash (for cache writes — same as web) ──
UPSTASH_REDIS_REST_URL=https://your-dev-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx_dev_token

# ─── LOCAL Redis for BullMQ (mirrors Hetzner setup) ──
BULLMQ_REDIS_HOST=127.0.0.1
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=devpassword123
BULLMQ_REDIS_TLS=false

# ─── Worker identity ──
WORKER_ID=cip-worker-local
LOG_LEVEL=debug

# ─── Vercel revalidation (will fail silently in dev — fine) ──
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=dev_revalidate_secret_random_chars

# ─── Email (test mode) ──
RESEND_API_KEY=re_test_xxxx
EMAIL_FROM=onboarding@resend.dev

# ─── No API keys needed (mock mode) ──
# METALPRICEAPI_KEY=
```

> **CRITICAL:** Both `.env.local` files are gitignored. Never commit them.

---

## 6. Local Worker Run Modes

### 6.1 Mode A — Hot Reload (Most Common)

For active development with auto-restart on file change:

```bash
cd apps/worker
pnpm dev
```

This runs:
```bash
tsx watch src/index.ts
```

Output:
```
🎭 MOCK mode active for MetalpriceAPI

   No real API calls will be made.

[INFO] CIP Worker starting (workerId=cip-worker-local)
[INFO] Connected to MongoDB
[INFO] Connected to Local Redis (BullMQ)
[INFO] Connected to Upstash Redis (cache)
[INFO] All job schedules registered
[INFO] All BullMQ workers started
🎭 Using MOCK Binance WebSocket
[INFO] CIP Worker fully operational

[INFO] Generated mock price tick: gold=$2351.23, silver=$28.46, copper=$4.83
[INFO] Mock crypto tick: BTCUSDT=$67483.21, ETHUSDT=$3247.55
```

Modify any worker file → tsx auto-restarts in <1 second.

### 6.2 Mode B — PM2 (Mirrors Production Exactly)

For testing the production deploy flow locally:

```bash
cd apps/worker

# Build TypeScript
pnpm build

# Start with PM2 using the same ecosystem.config.js as prod
pm2 start ecosystem.config.js

# Watch logs (same command as production Hetzner)
pm2 logs cip-worker

# Status check
pm2 status

# Stop
pm2 stop cip-worker
pm2 delete cip-worker
```

Use this to verify deployment configs work before pushing to Hetzner.

### 6.3 Mode C — Test Run (One-shot)

Run the worker once, capture logs, exit:

```bash
cd apps/worker
pnpm start    # No watch, no PM2 — just runs
# Ctrl+C to stop
```

---

## 7. Running the Frontend Locally

In a SEPARATE terminal (worker keeps running in its own):

```bash
cd apps/web
pnpm dev
```

Output:
```
   ▲ Next.js 16.2.4
   - Local:        http://localhost:3000
   - Environments: .env.local

 ✓ Ready in 1.2s
```

Open http://localhost:3000.

---

## 8. Verify the Whole Stack Works Locally

Run all of these to confirm correct setup:

### 8.1 Local Redis Health

```bash
# If using Docker
docker exec cip-redis-dev redis-cli -a devpassword123 ping

# If native
redis-cli -a devpassword123 ping

# Expected: PONG
```

### 8.2 BullMQ Job Scheduling

```bash
# Connect to local Redis and inspect BullMQ keys
redis-cli -a devpassword123

# Inside redis-cli:
KEYS bull:*
# Should show: bull:metals-ingestion:*, bull:crypto-ingestion:*, etc.

# See scheduled jobs
ZRANGE bull:metals-ingestion:delayed 0 -1 WITHSCORES
# Should show next scheduled run timestamps
```

### 8.3 Mock Data Flowing

In MongoDB Compass (or `mongosh`), query:

```javascript
// Connect to dev cluster
use cip_dev

// See latest prices
db.live_prices.find().pretty()
// Should show: gold, silver, copper, BTCUSDT, ETHUSDT
// Each updated within last 60-120 seconds

// See candles being created
db.candles_1m.find().sort({timestamp: -1}).limit(5).pretty()
// Should show recent candles populated from mocks
```

### 8.4 Frontend Reads Data

```bash
# Test API endpoint (from another terminal)
curl http://localhost:3000/api/price/gold
```

Expected:
```json
{
  "success": true,
  "data": {
    "symbol": "gold",
    "price": 2351.23,
    "currency": "USD",
    "timestamp": "2026-04-23T15:34:12.123Z",
    "source": "metalpriceapi-mock"
  }
}
```

### 8.5 Health Check Endpoint

```bash
curl http://localhost:3000/api/health/time
```

Expected:
```json
{
  "ok": true,
  "drifts": {
    "vercel_vs_mongo_ms": -23,
    "vercel_vs_worker_ms": 12000,
    "worker_last_write": "2026-04-23T15:33:55.000Z"
  },
  "message": "All clocks synchronized"
}
```

---

## 9. Local Backups Testing

You can test the backup scripts locally without affecting production:

### 9.1 Configure for Local Test

Create `scripts/.env.local` (NEVER commit):

```bash
# Use your dev Atlas cluster
MONGODB_URI=mongodb+srv://dev_user:PASSWORD@cluster0-dev.xxxxx.mongodb.net/
MONGODB_DB_NAME=cip_dev

# Use a TEST R2 bucket (separate from production)
CF_ACCOUNT_ID=your_cf_account_id

# Use a fake/test webhook
ALERT_WEBHOOK_URL=http://localhost:3000/api/admin/alert
```

### 9.2 Run Backup Locally

```bash
cd /path/to/cip-2026
bash apps/worker/scripts/mongodb-backup.sh
```

Verify:
```bash
ls -lh backups/mongodb/
# Should show: cip-mongodb-cip_dev-YYYYMMDD-HHMMSS.gz
```

You can NOT run snapshot.sh locally (Hetzner-specific). Test it only on the actual server.

---

## 10. Switching to Live API for Manual Testing

When you genuinely need to test against the real MetalpriceAPI:

```bash
# Option A: One-shot
PRICE_DATA_MODE=live METALPRICEAPI_KEY=your_real_key pnpm dev

# Option B: Set in current shell
export PRICE_DATA_MODE=live
export METALPRICEAPI_KEY=your_real_key
pnpm dev
# When done:
unset PRICE_DATA_MODE METALPRICEAPI_KEY
```

The worker logs will print:
```
🔴 LIVE API mode active for MetalpriceAPI
⚠️  This will consume your MetalpriceAPI quota.
```

Use sparingly.

---

## 11. Resetting Local Environment

When you want a fresh start:

### 11.1 Reset Redis Only

```bash
# Docker
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d

# Native
redis-cli -a devpassword123 FLUSHALL
```

### 11.2 Reset MongoDB Dev Data

```bash
# In mongosh or Compass:
use cip_dev
db.dropDatabase()

# Then re-init
pnpm tsx apps/worker/scripts/init-db.ts
pnpm tsx apps/worker/scripts/seed-currencies.ts
```

### 11.3 Reset Everything (Nuclear Option)

```bash
# Stop everything
docker compose -f docker-compose.dev.yml down -v
pm2 delete all

# Clear node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# Drop dev DB (mongosh)
mongosh "$MONGODB_URI" --eval 'db.getSiblingDB("cip_dev").dropDatabase()'

# Restart
docker compose -f docker-compose.dev.yml up -d
pnpm dev
```

---

## 12. VS Code Integration

### 12.1 Recommended Workspace Tasks

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Dev Stack",
      "type": "shell",
      "command": "docker compose -f docker-compose.dev.yml up -d",
      "presentation": { "reveal": "always", "panel": "new" }
    },
    {
      "label": "Stop Dev Stack",
      "type": "shell",
      "command": "docker compose -f docker-compose.dev.yml down"
    },
    {
      "label": "Reset Dev Stack",
      "type": "shell",
      "command": "docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d"
    },
    {
      "label": "Run Worker (hot reload)",
      "type": "shell",
      "command": "pnpm dev",
      "options": { "cwd": "${workspaceFolder}/apps/worker" }
    },
    {
      "label": "Run Web (hot reload)",
      "type": "shell",
      "command": "pnpm dev",
      "options": { "cwd": "${workspaceFolder}/apps/web" }
    },
    {
      "label": "Open Redis Commander",
      "type": "shell",
      "command": "open http://localhost:8082 || xdg-open http://localhost:8082 || start http://localhost:8082"
    }
  ]
}
```

Now in VS Code: `Cmd/Ctrl+Shift+P` → "Run Task" → pick any.

### 12.2 Launch Configuration (Debugging)

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Worker",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["tsx", "src/index.ts"],
      "cwd": "${workspaceFolder}/apps/worker",
      "env": {
        "PRICE_DATA_MODE": "mock",
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Web (Next.js)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev",
      "cwd": "${workspaceFolder}/apps/web"
    }
  ]
}
```

Set breakpoints, hit F5, debug worker code with full inspection.

---

## 13. Common Local Dev Issues

| Issue | Cause | Fix |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:6379` | Redis not running | `docker compose ... up -d` or `brew services start redis` |
| `MongoNetworkError` | Atlas IP whitelist excludes your IP | Atlas → Network Access → Add your home IP |
| `Cannot find module '@/lib/...'` | TS path aliases not loaded | Restart VS Code TS server: `Cmd+Shift+P` → "TypeScript: Restart" |
| Worker doesn't restart on save | `tsx watch` not used | Use `pnpm dev` (which uses tsx watch), not `pnpm start` |
| BullMQ jobs not running | Wrong Redis | Check `BULLMQ_REDIS_HOST=127.0.0.1` (NOT Upstash) |
| Mock data not generating | `PRICE_DATA_MODE` not set | Add `PRICE_DATA_MODE=mock` to `.env.local` |
| Port 6379 already in use | Another Redis already running | `lsof -i :6379` to find it, or change port in compose |
| Docker uses too much RAM | Default container limits high | Add `mem_limit: 256m` to redis service |

---

## 14. Feature Parity Checklist

Confirm your local dev mirrors production for everything that matters:

| Feature | Production (Hetzner) | Local Dev |
|---|---|---|
| Local Redis on 127.0.0.1:6379 | ✅ apt | ✅ Docker / brew |
| BullMQ TCP connection | ✅ | ✅ |
| Redis password auth | ✅ | ✅ devpassword123 |
| Redis AOF persistence | ✅ appendonly yes | ✅ appendonly yes |
| chrony NTP sync | ✅ | ✅ (OS handles automatically) |
| UTC timezone | ✅ timedatectl | ⚠️ Set process.env.TZ=UTC in `.env` |
| Node 22 LTS | ✅ | ✅ via volta/nvm |
| pnpm 9 | ✅ | ✅ |
| PM2 process manager | ✅ | ✅ optional |
| MongoDB native driver | ✅ Atlas M0 | ✅ Atlas dev cluster |
| Upstash Redis (cache) | ✅ prod DB | ✅ separate dev DB |
| Pino structured logs | ✅ → MongoDB | ✅ → MongoDB |
| Mock data layer | ❌ live | ✅ PRICE_DATA_MODE=mock |
| Real APIs hit | ✅ | ❌ (zero quota use) |
| WebSocket connection | ✅ Binance | ✅ MockBinanceWebSocket |
| Cron job scheduling | ✅ BullMQ | ✅ BullMQ identical |

---

## 15. Useful Commands Reference

```bash
# ─── Stack management ────────────────────────────
docker compose -f docker-compose.dev.yml up -d         # Start
docker compose -f docker-compose.dev.yml down          # Stop
docker compose -f docker-compose.dev.yml ps            # Status
docker compose -f docker-compose.dev.yml logs -f redis # Tail Redis logs

# ─── Redis interaction ──────────────────────────
redis-cli -a devpassword123                            # Open CLI
redis-cli -a devpassword123 ping                       # Health check
redis-cli -a devpassword123 INFO                       # All stats
redis-cli -a devpassword123 KEYS 'bull:*'              # List BullMQ keys
redis-cli -a devpassword123 FLUSHALL                   # Wipe everything

# ─── Worker dev ─────────────────────────────────
cd apps/worker
pnpm dev                                                # Hot reload via tsx
pnpm build && pnpm start                                # Compiled run
pm2 start ecosystem.config.js                           # Production-style
pm2 logs cip-worker                                     # Watch logs

# ─── Frontend dev ───────────────────────────────
cd apps/web
pnpm dev                                                # Next.js dev server

# ─── Switch to live API once ────────────────────
PRICE_DATA_MODE=live METALPRICEAPI_KEY=xxx pnpm dev

# ─── Cleanup ────────────────────────────────────
docker compose -f docker-compose.dev.yml down -v        # Stop + delete data
pm2 delete all                                          # Remove PM2 processes
```

---

## 16. CLAUDE.md Additions

```markdown
### Local Development Rules

ALWAYS:
- Run docker-compose.dev.yml for Redis (mirrors Hetzner Local Redis)
- Use PRICE_DATA_MODE=mock by default in dev
- Use a SEPARATE Atlas dev cluster (NEVER share with production)
- Use a SEPARATE Upstash dev database
- Use Clerk DEVELOPMENT instance keys (pk_test_*, sk_test_*)
- Worker should hot-reload via tsx watch in dev

NEVER:
- Connect to production MongoDB Atlas from local dev
- Use production Upstash Redis token in local dev
- Use Clerk production keys in local development
- Run live mode (PRICE_DATA_MODE=live) for routine dev work
- Commit .env.local files to Git
```

---

## 17. Cost & Quota Comparison

| Resource | Production (Hetzner) | Local Dev |
|---|---|---|
| VPS | $4.51/mo | $0 |
| Local Redis | included | $0 |
| MetalpriceAPI calls | ~43,500/mo | 0 (mock) |
| Time to start fresh | 5 min (snapshot restore) | 30 sec (`docker compose up -d`) |
| Time to nuke and restart | n/a | 1 min (`down -v && up -d`) |

---

## 18. Updates Needed in Other Docs

| Doc | Change |
|---|---|
| `21-HETZNER-VPS-IMPLEMENTATION.md` | Reference this doc for local dev setup |
| `28-BEGINNER-DAY-ZERO-COMPLETE.md` | Add local dev as step before Hetzner |
| `00-START-HERE.md` | Add doc 30 to index |
| `17-CLAUDE-AGENT-FILES.md` | Add local dev rules to CLAUDE.md |
| `29-MOCK-DATA-SYSTEM.md` | Reference here for "where to test mocks" |

---

## 19. Workflow Summary

Your daily dev cycle becomes:

```bash
# Morning: spin up
docker compose -f docker-compose.dev.yml up -d
cd apps/worker && pnpm dev    # Terminal 1
cd apps/web && pnpm dev       # Terminal 2

# Code, save, save, save (hot reload)

# Evening: spin down
# Ctrl+C in both terminals
docker compose -f docker-compose.dev.yml down
```

That's it. Identical worker behavior to Hetzner, $0 cost, zero API quota burned.

---

*Document 30 of the CIP-2026 Package — Local Development VPS Setup*
*Mirrors:* `21-HETZNER-VPS-IMPLEMENTATION.md` for development without spending production resources.
*Cross-references:* See doc 29 for mock data, doc 24 for time sync, doc 27 for backups.
*Last reviewed: April 23, 2026*
