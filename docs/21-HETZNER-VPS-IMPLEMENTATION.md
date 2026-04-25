# 🖥️ 21 — Hetzner VPS Implementation Guide

**Purpose:** Complete step-by-step guide to provision, configure, and deploy the CIP-2026 worker on Hetzner Cloud.
**Who this is for:** Beginner. Every command is explained. Nothing assumed.
**What you'll have at the end:** A running VPS that ingests gold/silver/copper prices every 60 seconds and crypto prices in real-time via WebSocket.

---

## 1. What Runs on Hetzner (vs Vercel)

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│         VERCEL (Frontend)       │    │      HETZNER VPS (Worker)       │
├─────────────────────────────────┤    ├─────────────────────────────────┤
│  Next.js 16.2 App               │    │  Node.js 22 LTS                 │
│  API routes                     │    │  BullMQ queue processor         │
│  Server components              │◄───│  Jobs:                          │
│  ISR page regeneration          │    │    - ingest-metals (60s cron)   │
│  Admin panel                    │    │    - ingest-crypto-ws (live WS) │
│                                 │    │    - aggregate-hourly (1h cron) │
│  Cost: Free → $20/mo            │    │    - aggregate-daily (1d cron)  │
└─────────────────────────────────┘    │    - check-alerts               │
                                       │    - broadcast-emails           │
         Both connect to:              │                                 │
  MongoDB Atlas + Upstash Redis        │  Cost: ~$4.51/mo (CX22)        │
                                       └─────────────────────────────────┘
```

**Why not run the worker on Vercel?**
Vercel serverless functions time out after 10 seconds. A WebSocket connection to Binance must stay alive for hours. BullMQ needs a persistent process. Hetzner gives you a real Linux server that never sleeps.

---

## 2. Server Provisioning (Step-by-Step)

### Step 1 — Create Hetzner Account

Go to https://hetzner.com/cloud → Sign up → Verify email → Add payment method.

New accounts get €20 free credit — enough for ~4 months of your worker server.

---

### Step 2 — Create SSH Key (Your Computer)

An SSH key lets you log into the server securely without a password. Do this **once**.

**On Mac/Linux** — open Terminal:
```bash
# Generate the key
ssh-keygen -t ed25519 -C "cip2026-hetzner"

# When it asks for file location, press Enter (accept default)
# When it asks for passphrase, press Enter twice (no passphrase for automation)

# Show your public key — copy this entire output
cat ~/.ssh/id_ed25519.pub
```

**On Windows** — open PowerShell:
```powershell
# Generate the key
ssh-keygen -t ed25519 -C "cip2026-hetzner"

# Show your public key — copy this entire output
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

The output looks like: `ssh-ed25519 AAAAC3Nz... cip2026-hetzner`
**Copy the entire line** — you'll paste it into Hetzner next.

---

### Step 3 — Create Server in Hetzner Console

1. Log in to https://console.hetzner.cloud
2. Click **"+ New Project"** → Name it `cip-2026` → Create
3. Click into the project → **"+ Add Server"**

Fill in the form:

| Field | Value | Why |
|---|---|---|
| Location | **Singapore (AP-Southeast)** | Closest to your target market |
| Image | **Ubuntu 24.04** | LTS, best support |
| Type | **Shared vCPU** → **CX22** | 2 vCPU, 4GB RAM, $4.51/mo — plenty for worker |
| Networking | Keep defaults (Public IPv4 + IPv6) | |
| SSH Keys | **Paste your public key** | Click "Add SSH Key" button |
| Name | `cip-worker-01` | |

Click **"Create & Buy Now"**.

Wait ~30 seconds. You'll see your server's IP address (e.g. `65.108.XXX.XXX`). **Copy this IP**.

---

### Step 4 — Connect to Your Server

```bash
# Replace with your actual server IP
ssh root@65.108.XXX.XXX

# First time: it asks "Are you sure you want to connect?" → type yes → Enter
```

You're now inside your server. The prompt changes to `root@cip-worker-01:~#`

---

## 3. Server Setup (Run These Commands Once)

Run everything in order. Each section is explained.

### 3.1 — System Update

```bash
# Update the package list and upgrade all software
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git unzip build-essential ufw fail2ban
```

---

### 3.2 — Install Node.js 22 LTS

```bash
# Add NodeSource repository (official Node.js source)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node --version    # Should show v22.x.x
npm --version     # Should show 10.x.x

# Install pnpm (your project uses pnpm)
npm install -g pnpm

# Verify
pnpm --version    # Should show 9.x.x or similar
```

---

### 3.3 — Install PM2 (Process Manager)

PM2 keeps your worker running 24/7. If it crashes, PM2 auto-restarts it. If the server reboots, PM2 starts it automatically.

```bash
npm install -g pm2

# Verify
pm2 --version
```

---

### 3.4 — Create a Non-Root User (Security Best Practice)

Running apps as `root` is dangerous. Create a dedicated user.

```bash
# Create user
adduser --disabled-password --gecos "" deploy

# Give deploy user permission to use PM2 and the app files
usermod -aG sudo deploy

# Copy SSH key to deploy user (so you can log in as them too)
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

---

### 3.5 — Configure Firewall (UFW)

```bash
# Allow SSH (so you can still connect)
ufw allow 22/tcp

# Allow nothing else — worker doesn't need inbound connections
# It only makes OUTBOUND calls to MongoDB, Redis, MetalpriceAPI, Binance

# Enable firewall
ufw --force enable

# Check status
ufw status
```

Expected output:
```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
```

---

### 3.6 — Configure Fail2ban (Brute-Force Protection)

```bash
# Fail2ban automatically blocks IPs that try to break in via SSH
systemctl enable fail2ban
systemctl start fail2ban

# Verify it's running
systemctl status fail2ban
```

---

## 4. Application Deployment

### 4.1 — Create Application Directory

```bash
# Switch to deploy user
su - deploy

# Create app directory
mkdir -p /home/deploy/apps/cip-worker
cd /home/deploy/apps/cip-worker
```

---

### 4.2 — Create the Environment File

This file holds all your secrets. It NEVER goes in Git.

```bash
nano /home/deploy/apps/cip-worker/.env
```

Paste this template and fill in your real values:

```bash
# === CIP Worker Environment Variables ===

NODE_ENV=production

# MongoDB (from MongoDB Atlas → Connect → Connection String)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=cip_production

# Redis (from Upstash → REST API)
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# Metals price API (from metalpriceapi.com → Dashboard)
METALPRICEAPI_KEY=your_key_here
METALSAPI_KEY=your_fallback_key_here

# Binance WebSocket (no key needed — public endpoint)
BINANCE_WS_URL=wss://stream.binance.com:9443/stream

# Vercel revalidation (a random secret you create)
# Must match REVALIDATE_SECRET in your Vercel project settings
REVALIDATE_SECRET=generate_32_random_chars_here
NEXT_PUBLIC_SITE_URL=https://yoursite.com

# Email alerts (for worker to send alerts)
RESEND_API_KEY=re_xxxx
EMAIL_FROM=alerts@yoursite.com

# Worker identity (for logging)
WORKER_ID=cip-worker-01
LOG_LEVEL=info
```

Save file: `Ctrl+O` → Enter → `Ctrl+X`

**How to generate REVALIDATE_SECRET:**
```bash
# Run this locally on your own computer
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 4.3 — Deploy the Worker Code

**Option A: Deploy from GitHub (Recommended)**

```bash
# Still as deploy user on Hetzner
cd /home/deploy/apps

# Clone your repo (replace with your actual repo URL)
git clone https://github.com/yourusername/cip-2026.git

# Go into the worker directory
cd cip-2026/apps/worker

# Install dependencies
pnpm install --frozen-lockfile

# Build TypeScript
pnpm build
```

**Option B: Manual upload via SCP (if you don't have GitHub yet)**

From your local machine (not the server):
```bash
# Upload the worker folder from your computer to the server
scp -r ./apps/worker deploy@65.108.XXX.XXX:/home/deploy/apps/

# Then SSH in and install dependencies
ssh deploy@65.108.XXX.XXX
cd /home/deploy/apps/worker
pnpm install --frozen-lockfile
pnpm build
```

---

## 5. Worker Code (Complete Implementation)

### 5.1 — Worker Entry Point

Create `apps/worker/src/index.ts`:

```typescript
// apps/worker/src/index.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';
import { createClient } from '@upstash/redis';
import { logger } from './lib/logger';
import { ingestMetals } from './jobs/ingest-metals';
import { startCryptoWebSocket } from './jobs/ingest-crypto-ws';
import { aggregateHourly } from './jobs/aggregate-hourly';
import { aggregateDaily } from './jobs/aggregate-daily';
import { checkAlerts } from './jobs/check-alerts';
import { broadcastEmails } from './jobs/broadcast-emails';
import { getWorkerEnv } from './lib/env';

const env = getWorkerEnv();

// Redis connection for BullMQ
// NOTE: BullMQ needs a raw Redis TCP connection, not Upstash HTTP
// Use a separate Redis for BullMQ if you want (or use ioredis with Upstash TLS)
const connection = {
  host: env.BULLMQ_REDIS_HOST,  // See Section 5.2 for Redis options
  port: env.BULLMQ_REDIS_PORT,
  password: env.BULLMQ_REDIS_PASSWORD,
  tls: env.BULLMQ_REDIS_TLS === 'true' ? {} : undefined,
};

// ─── Define Queues ────────────────────────────────────────────────
export const queues = {
  metals:    new Queue('metals-ingestion',    { connection }),
  crypto:    new Queue('crypto-ingestion',    { connection }),
  aggregate: new Queue('aggregation',         { connection }),
  alerts:    new Queue('alert-checks',        { connection }),
  broadcast: new Queue('broadcast',           { connection }),
};

// ─── Schedule Recurring Jobs ──────────────────────────────────────
async function scheduleJobs() {
  // Metals: every 60 seconds
  await queues.metals.upsertJobScheduler('ingest-metals-60s', {
    every: 60_000,
  }, {
    name: 'ingest-metals',
    data: {},
    opts: { removeOnComplete: 10, removeOnFail: 100 },
  });

  // Hourly aggregation: top of every hour
  await queues.aggregate.upsertJobScheduler('aggregate-hourly', {
    pattern: '0 * * * *',
  }, {
    name: 'aggregate-hourly',
    data: {},
    opts: { removeOnComplete: 5, removeOnFail: 50 },
  });

  // Daily aggregation: midnight UTC
  await queues.aggregate.upsertJobScheduler('aggregate-daily', {
    pattern: '0 0 * * *',
  }, {
    name: 'aggregate-daily',
    data: {},
    opts: { removeOnComplete: 5, removeOnFail: 50 },
  });

  logger.info('All job schedules registered');
}

// ─── Start Workers ────────────────────────────────────────────────
function startWorkers() {
  // Metals ingestion worker
  new Worker('metals-ingestion', ingestMetals, {
    connection,
    concurrency: 1,  // Run one at a time — rate limit safe
  });

  // Aggregation worker
  new Worker('aggregation', async (job) => {
    if (job.name === 'aggregate-hourly') return aggregateHourly(job);
    if (job.name === 'aggregate-daily')  return aggregateDaily(job);
  }, { connection, concurrency: 1 });

  // Alert check worker
  new Worker('alert-checks', checkAlerts, {
    connection,
    concurrency: 5,  // Check multiple alerts in parallel
  });

  // Broadcast worker
  new Worker('broadcast', broadcastEmails, {
    connection,
    concurrency: 2,  // 2 concurrent email batches
  });

  logger.info('All BullMQ workers started');
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  logger.info({ workerId: env.WORKER_ID }, 'CIP Worker starting...');

  try {
    await scheduleJobs();
    startWorkers();

    // Start WebSocket listener for crypto (runs independently)
    startCryptoWebSocket();

    logger.info('CIP Worker fully operational');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received — shutting down gracefully');
      for (const [name, queue] of Object.entries(queues)) {
        await queue.close();
        logger.info({ queue: name }, 'Queue closed');
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error({ error }, 'Worker startup failed');
    process.exit(1);
  }
}

main();
```

---

### 5.2 — Redis Options for BullMQ

BullMQ needs a standard TCP Redis connection (not HTTP). You have two options:

**Option A — Upstash Redis with TLS (Recommended — no extra cost)**

Upstash supports TCP connections too. Get the TLS credentials from Upstash console → "Connect" → "ioredis".

Add to your `.env`:
```bash
BULLMQ_REDIS_HOST=xxxx.upstash.io
BULLMQ_REDIS_PORT=6380
BULLMQ_REDIS_PASSWORD=your_upstash_password
BULLMQ_REDIS_TLS=true
```

**Option B — Local Redis on Hetzner (Cheapest, zero extra cost)**

Install Redis directly on your Hetzner server — it's free and fast since everything is local.

```bash
# On the Hetzner server
apt install -y redis-server

# Configure Redis (secure it)
nano /etc/redis/redis.conf
```

Find and change these lines in the config:
```
# Bind only to localhost (not public internet)
bind 127.0.0.1

# Set a password
requirepass YourStrongRedisPassword123

# Persist data to disk
appendonly yes
```

```bash
# Restart Redis
systemctl restart redis-server
systemctl enable redis-server

# Test it works
redis-cli -a YourStrongRedisPassword123 ping
# Should print: PONG
```

Add to your `.env`:
```bash
BULLMQ_REDIS_HOST=127.0.0.1
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=YourStrongRedisPassword123
BULLMQ_REDIS_TLS=false
```

> **Recommendation:** Option B (local Redis) is simpler and free. Use Option A only if you want a fully managed Redis.

---

### 5.3 — Metals Ingestion Job

Create `apps/worker/src/jobs/ingest-metals.ts`:

```typescript
// apps/worker/src/jobs/ingest-metals.ts
import { Job } from 'bullmq';
import { getMongo } from '../lib/mongo';
import { getRedis } from '../lib/redis';
import { logger } from '../lib/logger';
import { queues } from '../index';

const SYMBOLS = ['XAU', 'XAG', 'XCU'] as const; // Gold, Silver, Copper
const BASE_CURRENCY = 'USD';

type Symbol = typeof SYMBOLS[number];

interface MetalsTick {
  symbol:    Symbol;
  price:     number;
  timestamp: Date;
  source:    'metalpriceapi' | 'metalsapi';
}

export async function ingestMetals(job: Job): Promise<void> {
  const traceId = `ingest-${Date.now()}`;
  const log = logger.child({ traceId, job: 'ingest-metals' });

  log.info('Starting metals ingestion');
  const startedAt = Date.now();

  try {
    // 1. Fetch from primary API
    const ticks = await fetchFromMetalpriceAPI(log);

    // 2. Write to MongoDB
    const db = await getMongo();
    const redis = getRedis();
    const now = new Date();

    for (const tick of ticks) {
      // 2a. Upsert live_prices (latest snapshot)
      await db.collection('live_prices').updateOne(
        { symbol: tick.symbol },
        {
          $set: {
            price:     tick.price,
            symbol:    tick.symbol,
            currency:  BASE_CURRENCY,
            timestamp: tick.timestamp,
            source:    tick.source,
          },
        },
        { upsert: true }
      );

      // 2b. Insert into candles_1m (OHLCV — open/high/low/close)
      const minuteFloor = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
      await db.collection('candles_1m').updateOne(
        { symbol: tick.symbol, timestamp: minuteFloor },
        {
          $setOnInsert: { open: tick.price },
          $max:         { high: tick.price },
          $min:         { low: tick.price },
          $set:         { close: tick.price, symbol: tick.symbol, timestamp: minuteFloor },
          $inc:         { volume: 1 },
        },
        { upsert: true }
      );

      // 2c. Update Redis cache (30s TTL for price display)
      await redis.set(
        `price:${tick.symbol.toLowerCase()}`,
        JSON.stringify({ price: tick.price, timestamp: tick.timestamp }),
        { ex: 30 }
      );

      log.info({ symbol: tick.symbol, price: tick.price }, 'Price updated');
    }

    // 3. Trigger ISR revalidation on Vercel
    await triggerRevalidation(ticks, log);

    // 4. Queue alert checks for each symbol
    for (const tick of ticks) {
      await queues.alerts.add('check-alerts', {
        symbol: tick.symbol,
        price:  tick.price,
      }, {
        removeOnComplete: true,
        removeOnFail: 10,
      });
    }

    log.info({ duration: Date.now() - startedAt }, 'Metals ingestion complete');

  } catch (error) {
    log.error({ error }, 'Metals ingestion failed');
    throw error; // BullMQ will retry
  }
}

async function fetchFromMetalpriceAPI(log: ReturnType<typeof logger.child>): Promise<MetalsTick[]> {
  const apiKey = process.env.METALPRICEAPI_KEY!;
  const symbols = SYMBOLS.join(',');
  const url = `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=${BASE_CURRENCY}&currencies=${symbols}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`MetalpriceAPI error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`MetalpriceAPI returned error: ${JSON.stringify(data)}`);
    }

    const now = new Date();
    return SYMBOLS.map(symbol => ({
      symbol,
      price:     1 / data.rates[symbol], // API returns USD/metal, we want metal/USD
      timestamp: now,
      source:    'metalpriceapi' as const,
    }));

  } catch (error) {
    // Fallback to MetalsAPI
    log.warn({ error }, 'MetalpriceAPI failed — falling back to MetalsAPI');
    return fetchFromMetalsAPIFallback(log);
  }
}

async function fetchFromMetalsAPIFallback(log: ReturnType<typeof logger.child>): Promise<MetalsTick[]> {
  const apiKey = process.env.METALSAPI_KEY!;
  const url = `https://metals-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=${SYMBOLS.join(',')}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`MetalsAPI fallback also failed: ${response.status}`);
  }

  const data = await response.json();
  const now = new Date();

  return SYMBOLS.map(symbol => ({
    symbol,
    price:     1 / data.rates[symbol],
    timestamp: now,
    source:    'metalsapi' as const,
  }));
}

async function triggerRevalidation(ticks: MetalsTick[], log: ReturnType<typeof logger.child>) {
  const secret = process.env.REVALIDATE_SECRET!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const tags = ticks.map(t => `price-${t.symbol.toLowerCase()}`);

  try {
    await Promise.all(tags.map(tag =>
      fetch(`${siteUrl}/api/revalidate?tag=${tag}&secret=${secret}`, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
      })
    ));
    log.info({ tags }, 'ISR revalidation triggered');
  } catch (error) {
    // Non-fatal — next tick will sync
    log.warn({ error }, 'Revalidation failed (non-fatal, will retry next tick)');
  }
}
```

---

### 5.4 — Crypto WebSocket Job

Create `apps/worker/src/jobs/ingest-crypto-ws.ts`:

```typescript
// apps/worker/src/jobs/ingest-crypto-ws.ts
import WebSocket from 'ws';
import { getMongo } from '../lib/mongo';
import { getRedis } from '../lib/redis';
import { logger } from '../lib/logger';

const SYMBOLS = ['btcusdt', 'ethusdt'] as const;
const WS_URL = `wss://stream.binance.com:9443/stream?streams=${SYMBOLS.map(s => `${s}@miniTicker`).join('/')}`;

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30_000; // 30 seconds max

export function startCryptoWebSocket() {
  logger.info('Starting Binance WebSocket connection');
  connect();
}

function connect() {
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    reconnectAttempts = 0;
    logger.info({ url: WS_URL }, 'Binance WebSocket connected');
  });

  ws.on('message', async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.stream && msg.data) {
        await handleTick(msg.stream, msg.data);
      }
    } catch (error) {
      logger.error({ error }, 'WebSocket message parse error');
    }
  });

  ws.on('error', (error) => {
    logger.error({ error }, 'Binance WebSocket error');
  });

  ws.on('close', (code, reason) => {
    logger.warn({ code, reason: reason.toString() }, 'Binance WebSocket disconnected — will reconnect');
    scheduleReconnect();
  });

  // Ping every 30s to keep connection alive (Binance drops idle connections)
  const pingInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30_000);
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);

  // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s
  const delay = Math.min(1_000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;

  logger.info({ delay, attempt: reconnectAttempts }, 'Scheduling WebSocket reconnect');
  reconnectTimeout = setTimeout(connect, delay);
}

async function handleTick(stream: string, data: {
  s: string;  // symbol e.g. BTCUSDT
  c: string;  // close price
  o: string;  // open price
  h: string;  // high
  l: string;  // low
  v: string;  // volume
}) {
  const symbol = data.s; // e.g. BTCUSDT
  const price  = parseFloat(data.c);
  const now    = new Date();

  const db    = await getMongo();
  const redis = getRedis();

  // Update live_prices
  await db.collection('live_prices').updateOne(
    { symbol },
    {
      $set: {
        price,
        symbol,
        currency:  'USDT',
        timestamp: now,
        source:    'binance',
      },
    },
    { upsert: true }
  );

  // Update Redis cache (15s TTL — crypto is more volatile)
  await redis.set(
    `price:${symbol.toLowerCase()}`,
    JSON.stringify({ price, timestamp: now }),
    { ex: 15 }
  );

  // Update candle_1m
  const minuteFloor = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  await db.collection('candles_1m').updateOne(
    { symbol, timestamp: minuteFloor },
    {
      $setOnInsert: { open: parseFloat(data.o) },
      $max:         { high: parseFloat(data.h) },
      $min:         { low: parseFloat(data.l) },
      $set:         { close: price, symbol, timestamp: minuteFloor },
      $inc:         { volume: parseFloat(data.v) },
    },
    { upsert: true }
  );
}
```

---

### 5.5 — Shared Libraries

**`apps/worker/src/lib/env.ts`** — Typed environment variables:

```typescript
import { z } from 'zod/v4';

const WorkerEnvSchema = z.object({
  NODE_ENV:              z.enum(['development', 'production', 'test']),
  MONGODB_URI:           z.string().min(1),
  MONGODB_DB_NAME:       z.string().default('cip_production'),
  UPSTASH_REDIS_REST_URL:   z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  BULLMQ_REDIS_HOST:     z.string().min(1),
  BULLMQ_REDIS_PORT:     z.coerce.number().default(6379),
  BULLMQ_REDIS_PASSWORD: z.string().min(1),
  BULLMQ_REDIS_TLS:      z.string().default('false'),
  METALPRICEAPI_KEY:     z.string().min(1),
  METALSAPI_KEY:         z.string().min(1),
  REVALIDATE_SECRET:     z.string().min(1),
  NEXT_PUBLIC_SITE_URL:  z.string().url(),
  RESEND_API_KEY:        z.string().min(1),
  EMAIL_FROM:            z.string().email(),
  WORKER_ID:             z.string().default('worker-01'),
  LOG_LEVEL:             z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

let _env: z.infer<typeof WorkerEnvSchema> | null = null;

export function getWorkerEnv() {
  if (_env) return _env;

  const result = WorkerEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  _env = result.data;
  return _env;
}
```

**`apps/worker/src/lib/mongo.ts`** — MongoDB connection (module-level cached):

```typescript
import { MongoClient, Db } from 'mongodb';
import { getWorkerEnv } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongo(): Promise<Db> {
  if (db) return db;

  const env = getWorkerEnv();
  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 5,    // Worker doesn't need many connections
    serverSelectionTimeoutMS: 5_000,
  });

  await client.connect();
  db = client.db(env.MONGODB_DB_NAME);

  return db;
}
```

**`apps/worker/src/lib/redis.ts`** — Upstash Redis (for cache writes):

```typescript
import { Redis } from '@upstash/redis';
import { getWorkerEnv } from './env';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const env = getWorkerEnv();
  _redis = new Redis({
    url:   env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}
```

**`apps/worker/src/lib/logger.ts`** — Pino logger:

```typescript
import pino from 'pino';
import { getWorkerEnv } from './env';

const env = getWorkerEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  base:  { workerId: env.WORKER_ID, service: 'cip-worker' },
  redact: {
    paths: ['password', 'token', 'secret', 'apiKey', 'authorization'],
    censor: '[REDACTED]',
  },
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,  // In production: plain JSON (captured by PM2)
});
```

---

## 6. PM2 Configuration

### 6.1 — Create PM2 Config File

```bash
# On the Hetzner server, as deploy user
nano /home/deploy/apps/cip-2026/apps/worker/ecosystem.config.js
```

Paste:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name:         'cip-worker',
      script:       'dist/index.js',     // Compiled TypeScript output
      cwd:          '/home/deploy/apps/cip-2026/apps/worker',
      instances:    1,                   // Single instance (don't run parallel — BullMQ handles concurrency)
      autorestart:  true,
      watch:        false,               // Don't auto-restart on file change in production
      max_memory_restart: '400M',        // Restart if memory exceeds 400MB
      env: {
        NODE_ENV: 'production',
      },
      env_file:     '/home/deploy/apps/cip-worker/.env',

      // Logging
      out_file:     '/home/deploy/logs/cip-worker-out.log',
      error_file:   '/home/deploy/logs/cip-worker-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:   true,
      log_type:     'json',

      // Graceful restart
      kill_timeout: 10000,              // Give 10s for graceful shutdown
      wait_ready:   true,
      listen_timeout: 15000,
    },
  ],
};
```

---

### 6.2 — Create Log Directory

```bash
mkdir -p /home/deploy/logs
```

---

## 7. Starting the Worker

### 7.1 — First Start

```bash
# Go to the worker directory
cd /home/deploy/apps/cip-2026/apps/worker

# Load env and start with PM2
pm2 start ecosystem.config.js

# Check it's running
pm2 status
```

Expected output:
```
┌─────┬─────────────┬─────────┬─────────┬──────────┬────────┐
│ id  │ name        │ mode    │ status  │ cpu      │ memory │
├─────┼─────────────┼─────────┼─────────┼──────────┼────────┤
│ 0   │ cip-worker  │ fork    │ online  │ 0%       │ 45mb   │
└─────┴─────────────┴─────────┴─────────┴──────────┴────────┘
```

---

### 7.2 — Enable Auto-Start on Server Reboot

```bash
# Save current PM2 process list
pm2 save

# Generate and install startup script
pm2 startup systemd -u deploy --hp /home/deploy

# PM2 will print a command to run — copy and run it with sudo
# It looks like: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

---

## 8. Deployment Workflow (How to Update the Worker)

Every time you change worker code and want to deploy to Hetzner:

```bash
# === On your local machine ===
git add -A
git commit -m "your change description"
git push origin main

# === SSH into Hetzner ===
ssh deploy@65.108.XXX.XXX

# === On Hetzner ===
cd /home/deploy/apps/cip-2026

# Pull latest code
git pull origin main

# Install any new dependencies
cd apps/worker
pnpm install --frozen-lockfile

# Rebuild TypeScript
pnpm build

# Restart worker (zero-downtime reload)
pm2 reload cip-worker --update-env

# Verify it restarted OK
pm2 status
pm2 logs cip-worker --lines 20
```

---

## 9. Monitoring & Troubleshooting

### Useful PM2 Commands

```bash
# See all running processes
pm2 status

# Live logs (stream in real-time)
pm2 logs cip-worker

# Last 50 lines of logs
pm2 logs cip-worker --lines 50

# Full dashboard (CPU, memory, logs)
pm2 monit

# Restart the worker
pm2 restart cip-worker

# Stop the worker
pm2 stop cip-worker

# Delete from PM2 (then re-add with start)
pm2 delete cip-worker
```

---

### Check if Prices Are Being Written

```bash
# On your local machine (or in MongoDB Atlas web UI)
# Connect to MongoDB and run:

db.live_prices.find().sort({ timestamp: -1 }).limit(5).pretty()

# Expected output: 4 documents (XAU, XAG, XCU, BTCUSDT) with recent timestamps
```

---

### Check Redis Cache

```bash
# On Hetzner server (if using local Redis)
redis-cli -a YourStrongRedisPassword123

# Check gold price in cache
GET price:xau

# Check BTC price
GET price:btcusdt

# List all price keys
KEYS price:*
```

---

### Common Problems & Fixes

| Problem | Symptom | Fix |
|---|---|---|
| Worker won't start | `pm2 status` shows `errored` | Run `pm2 logs cip-worker` to see error |
| MongoDB connection refused | Log shows `MongoNetworkError` | Check MONGODB_URI in .env, ensure Atlas IP whitelist includes `0.0.0.0/0` |
| MetalpriceAPI 401 error | Log shows `401 Unauthorized` | Check METALPRICEAPI_KEY in .env |
| WebSocket keeps reconnecting | Log shows repeated `disconnected — will reconnect` | Check internet on server: `curl https://stream.binance.com` |
| Redis connection refused | Log shows `ECONNREFUSED 127.0.0.1:6379` | Start Redis: `systemctl start redis-server` |
| Memory growing over time | PM2 auto-restarts at 400MB | Check for memory leak in WebSocket handler, ensure `db` variable is cached (not re-connecting each tick) |
| Prices stale on website | Website shows old prices | Check that REVALIDATE_SECRET matches in .env and Vercel env vars |

---

## 10. MongoDB Atlas — IP Whitelist

MongoDB Atlas blocks connections from unknown IPs. You must add your Hetzner server's IP.

1. Go to MongoDB Atlas → **Network Access** → **+ Add IP Address**
2. Add your Hetzner server IP: `65.108.XXX.XXX`
3. Click **Confirm**

Or for development convenience, allow all IPs: `0.0.0.0/0` (less secure — move to specific IP for production).

---

## 11. Cost Summary

| Resource | Spec | Monthly Cost |
|---|---|---|
| Hetzner CX22 | 2 vCPU, 4GB RAM, 40GB NVMe, Singapore | ~$4.51 |
| Local Redis | Runs on the same CX22 (no extra cost) | $0 |
| **Total** | | **~$4.51/mo** |

At 10K users you may want to upgrade to CX32 (~$8.21/mo). At 100K users, consider two workers (one for metals, one for crypto alerts).

---

## 12. File Summary (What to Create)

```
apps/worker/
├── src/
│   ├── index.ts                    ← Main entry point + BullMQ setup
│   ├── jobs/
│   │   ├── ingest-metals.ts        ← 60s metals cron job
│   │   ├── ingest-crypto-ws.ts     ← Live Binance WebSocket
│   │   ├── aggregate-hourly.ts     ← Roll up 1m candles → 1h candles
│   │   ├── aggregate-daily.ts      ← Roll up 1h candles → 1d candles
│   │   ├── check-alerts.ts         ← Check user price alerts
│   │   └── broadcast-emails.ts     ← Send bulk email jobs
│   └── lib/
│       ├── env.ts                  ← Typed env with Zod v4
│       ├── mongo.ts                ← MongoDB cached connection
│       ├── redis.ts                ← Upstash Redis client
│       └── logger.ts               ← Pino logger
├── ecosystem.config.js             ← PM2 config
├── package.json
├── tsconfig.json
└── .env                            ← Secrets (NEVER commit to Git)
```

---

## 13. package.json for Worker

```json
{
  "name": "@cip/worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev":   "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test":  "vitest"
  },
  "dependencies": {
    "bullmq":          "^5.0.0",
    "mongodb":         "^6.0.0",
    "@upstash/redis":  "^1.34.0",
    "pino":            "^9.0.0",
    "pino-pretty":     "^11.0.0",
    "ws":              "^8.18.0",
    "zod":             "^4.0.0",
    "@resend/node":    "^4.0.0",
    "date-fns":        "^4.0.0",
    "nanoid":          "^5.0.0"
  },
  "devDependencies": {
    "@types/ws":       "^8.5.0",
    "@types/node":     "^22.0.0",
    "tsx":             "^4.0.0",
    "typescript":      "^5.0.0",
    "vitest":          "^3.0.0"
  }
}
```

---

*Document 21 of the CIP-2026 Package — Hetzner VPS Implementation Guide*
*Cross-reference: 01-ARCHITECTURE-SPEC.md (architecture), 11-LOGGING-OBSERVABILITY.md (logging), 18-UPDATED-SPRINT-PLAN.md (Day 0 tasks)*
