# 🚨 26 — Disaster Recovery Plan + Cloudflare Workers Decision

**Purpose:** Define what happens when each component of the CIP-2026 stack fails, and decide whether Cloudflare Workers can replace Hetzner.

**Last reviewed:** April 23, 2026

---

## Part A — Cloudflare Workers vs Hetzner Decision

### A.1 The Verdict

**Stay with Hetzner. Use Cloudflare free tier for specific edge features only.**

Hetzner CX22 at $4.51/mo is cheaper, architecturally simpler, and uniquely suited for your workload (persistent WebSocket + BullMQ + local Redis). Cloudflare Workers cannot match this for a price comparable to Hetzner.

### A.2 Why Cloudflare Free Plan Fails for the Worker

The Cloudflare Workers free plan blocks the three things you need most:

| Free Plan Limit | Why It Fails Your Stack |
|---|---|
| **No Cron Triggers** | 60-second metals ingestion is impossible |
| **10ms CPU per invocation** | Aggregation jobs (1m → 1h → 1d) can't run |
| **100K requests/day** | Burns out by 11 AM at moderate usage |
| **No Durable Objects** | Cannot maintain Binance WebSocket connection |

### A.3 Why Even Paid Plan Is the Wrong Choice

Workers Paid ($5/mo) unlocks cron triggers and 30s CPU, but architectural problems remain:

| Architectural Issue | Workers Behavior | Your Hetzner Behavior |
|---|---|---|
| Binance WebSocket | ❌ Workers are stateless — cannot keep WS open | ✅ Persistent connection forever |
| BullMQ job queue | ❌ Doesn't run on Workers (needs Redis TCP) | ✅ Works with Local Redis |
| Long backfill (3-5 min) | ⚠️ Hits 5-min CPU limit | ✅ Unlimited runtime |
| Cost at 50K users | ~$15-50/mo (CPU+KV+DO+R2 stack) | $4.51/mo flat |
| Operational visibility | Workers Analytics only | Full PM2 monitor + logs |
| Lock-in risk | High (KV/DO/D1 ecosystem) | None (just a Linux box) |

### A.4 Where Cloudflare Free Tier IS Useful (Additive)

Use Cloudflare Workers free tier for these specific edge features alongside Hetzner:

| Use Case | Cloudflare Worker | Why It Helps |
|---|---|---|
| **Geo-IP detection** | `request.cf.country` | Free, fast, runs at edge before Vercel |
| **DDoS / bot blocking** | Rate limit before Vercel | Saves Vercel function invocations |
| **Edge cache for static `/api/price/gold`** | Cache 30s at edge | Cuts MongoDB load 80%+ |
| **Locale banner logic** | Show `/pk/` banner if `cf.country === 'PK'` | Sub-50ms response globally |
| **Cloudflare DNS + free SSL** | Already in your stack via Cloudflare proxy | $0, mandatory anyway |

These are 100K-requests/day-friendly tasks. They don't need cron triggers.

### A.5 Final Architecture Recommendation

```
┌──────────────────────────────────────────────────────────────┐
│  CLOUDFLARE FREE TIER (Edge Layer)                          │
│  • DNS + SSL (always)                                        │
│  • DDoS protection (always)                                  │
│  • Geo-IP detection worker (optional)                        │
│  • Edge rate-limit worker (optional)                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  VERCEL HOBBY (Application Layer) — $0                       │
│  • Next.js 16 frontend + API routes                          │
│  • ISR pages                                                 │
│  • Reads from MongoDB + Upstash Redis                        │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  HETZNER CX22 (Worker Layer) — $4.51/mo  ← KEEP THIS         │
│  • BullMQ scheduler + workers                                │
│  • Binance WebSocket persistent connection                   │
│  • MetalpriceAPI 60s ingestion                               │
│  • Aggregation jobs (1m → 1h → 1d)                           │
│  • Local Redis for BullMQ                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Part B — Disaster Recovery Plan

### B.1 Service Risk Matrix

| Service | Probability of Failure | Blast Radius | RTO Target | RPO Target |
|---|---|---|---|---|
| **MongoDB Atlas** | Low (99.995% SLA) | Total — site dies | 15 min | 0 (continuous backup) |
| **Hetzner VPS** | Medium (single host) | Worker stops, prices freeze | 30 min | 60 sec |
| **Upstash Redis** | Low (managed) | Slower API responses | 5 min | N/A (cache only) |
| **Local Redis (Hetzner)** | Tied to VPS | BullMQ stops | Tied to VPS | Active jobs lost |
| **MetalpriceAPI** | Medium (3rd party) | No new metals prices | Manual fallback | Up to 60 min stale |
| **Binance WebSocket** | Medium (3rd party) | No new crypto prices | Auto-reconnect | <30 sec |
| **Vercel** | Very low (99.99% SLA) | Site offline | Auto (CDN serves cache) | N/A |
| **Clerk** | Very low (99.99% SLA) | Login broken | Auto failover | 0 |
| **Cloudflare** | Very low (99.99%+ SLA) | DNS/CDN issue | Auto failover | 0 |

**RTO** = Recovery Time Objective (how long until service is restored)
**RPO** = Recovery Point Objective (how much data can be lost)

---

### B.2 Failure Scenarios — Step-by-Step Playbooks

#### 🔴 Scenario 1: MongoDB Atlas Complete Outage

**Symptoms:**
- Vercel API routes return 503
- `/admin/logs` shows "MongoNetworkError"
- Worker logs show "MongoServerSelectionError"

**Immediate Impact:**
- Site cannot serve price data
- Users see error page
- Worker cannot ingest new prices

**Mitigation (built-in):**

1. **Atlas auto-failover.** Atlas runs 3-node replica sets — if primary fails, secondary becomes primary in <30s automatically. You don't do anything.

2. **Upstash Redis cache provides 30-second buffer.** If MongoDB is unreachable, last cached prices keep serving.

3. **Stale-while-revalidate at CDN.** Cloudflare cache holds the last good HTML for up to 60 seconds.

**Recovery Steps:**

```bash
# Step 1: Check Atlas status (1 min)
# Visit: status.mongodb.com
# If Atlas-wide outage → wait, it's their problem to fix

# Step 2: Verify it's not your IP whitelist (2 min)
# Atlas → Network Access → ensure 0.0.0.0/0 or your IPs are allowed

# Step 3: Check connection string didn't expire
# .env.local on Vercel → MONGODB_URI is current

# Step 4: If Atlas is up but you can't connect — restart Vercel + worker
# Vercel: redeploy from dashboard
# Hetzner: pm2 restart cip-worker
```

**Backup Strategy (continuous):**
- Atlas M0 free tier includes **continuous backups**
- For M10+ (paid), backups are point-in-time restorable to any second within 7 days
- You can also schedule daily exports to AWS S3 / Cloudflare R2 (script below)

```typescript
// scripts/backup-mongodb.ts (run as a Hetzner cron, daily at 2 AM)
import { exec } from 'child_process';
import { promisify } from 'util';
const run = promisify(exec);

async function backup() {
  const date = new Date().toISOString().split('T')[0];
  const filename = `cip-backup-${date}.archive`;

  // Export to compressed archive
  await run(`mongodump --uri="${process.env.MONGODB_URI}" --archive=${filename} --gzip`);

  // Upload to Cloudflare R2 (zero egress cost)
  await run(`aws s3 cp ${filename} s3://cip-backups/${filename} --endpoint-url=${process.env.R2_ENDPOINT}`);

  // Delete local file
  await run(`rm ${filename}`);

  // Keep last 30 days, delete older
  // (R2 lifecycle policy handles this automatically)
}

backup().catch(console.error);
```

**Worst Case Recovery:**
If Atlas data is corrupted/deleted, restore from R2 backup:
```bash
aws s3 cp s3://cip-backups/cip-backup-2026-04-22.archive ./
mongorestore --uri="$MONGODB_URI" --archive=cip-backup-2026-04-22.archive --gzip --drop
```

---

#### 🔴 Scenario 2: Hetzner VPS Total Failure (Hardware Death, Region Outage)

**Symptoms:**
- `pm2 status` unreachable via SSH
- No new prices in `live_prices` for >2 minutes
- `/api/health/time` shows worker_last_write >5 minutes old

**Immediate Impact:**
- Prices freeze at last value
- Crypto WebSocket disconnects (no reconnect happening)
- BullMQ jobs paused
- **Frontend keeps working** because Vercel reads MongoDB directly

**The Critical Insight:**
Your frontend doesn't depend on Hetzner being alive. It depends on MongoDB having recent data. So Hetzner downtime ≠ site outage. It just means stale prices.

**Mitigation Strategy:**

**Tier 1: Quick recovery (<15 min) — Restore on a new Hetzner server**

1. Provision new Hetzner CX22 in Singapore (5 min)
2. Re-run setup script (10 min)
3. Pull worker code from GitHub (2 min)
4. Copy `.env` from password manager (1 min)
5. `pm2 start ecosystem.config.js`
6. Worker resumes 60-second ingestion

**Tier 2: Multi-region failover (advanced — for future scale)**

Set up a **passive standby** in a different region (e.g., Hetzner Helsinki):

```bash
# On standby server, install everything but DON'T start worker
# A simple cron checks primary every 60s:

#!/bin/bash
# /home/deploy/check-primary.sh
PRIMARY_IP="65.108.X.X"  # Singapore primary

if ! ping -c 1 -W 5 $PRIMARY_IP > /dev/null; then
  echo "$(date): Primary unreachable, promoting standby"
  pm2 start /home/deploy/apps/cip-2026/apps/worker/ecosystem.config.js
  # Send alert
  curl -X POST https://yoursite.com/api/admin/alert \
    -H "Authorization: Bearer $ALERT_SECRET" \
    -d '{"type":"failover","message":"Primary worker failed, standby active"}'
fi
```

This costs an extra $4.51/mo but gives you sub-2-minute failover. **Skip until 50K MAU.**

**Tier 3: Image snapshots (cheap insurance — $0.0119/GB/mo)**

Hetzner Cloud lets you snapshot your VPS:
- Cost: ~$0.50/mo for the disk snapshot
- Restore time: 5 minutes to spin up new server from snapshot
- Schedule: weekly automatic snapshot

```bash
# Via Hetzner Cloud CLI
hcloud server create-image cip-worker-01 --type snapshot --description "Weekly $(date +%Y-%m-%d)"
```

---

#### 🟡 Scenario 3: Upstash Redis Outage

**Symptoms:**
- API responses slow down (50ms → 200ms)
- Logs show "UpstashError" or timeouts
- Rate limiting may temporarily fail open

**Immediate Impact:**
- **Site stays up.** Cache misses fall through to MongoDB.
- Slightly more MongoDB load (~5x normal)
- Rate limiting can't enforce — risk of abuse

**Built-in Resilience:**

```typescript
// apps/web/lib/cache.ts — graceful degradation
export async function getCachedPrice(symbol: string): Promise<Price | null> {
  try {
    const cached = await redis.get(`price:${symbol}`);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable, falling through to MongoDB');
    // Don't throw — just return null and let caller hit MongoDB
  }

  // Fall through to MongoDB
  const db = await getMongo();
  return db.collection('live_prices').findOne({ symbol });
}
```

**Recovery:**
1. Check status.upstash.com
2. If Upstash issue: wait — they typically resolve in <10 minutes
3. If your account: check Upstash dashboard, confirm credentials, verify free tier hasn't been exceeded
4. Restart Vercel deployment to clear connection pool: redeploy from dashboard

**Backup Plan: Use MongoDB as cache**

If Upstash has multi-day outage, temporarily disable Upstash and let everything hit MongoDB. Site still works, just slower:

```typescript
// Set environment variable: DISABLE_REDIS=true
const REDIS_DISABLED = process.env.DISABLE_REDIS === 'true';

export async function getCachedPrice(symbol: string) {
  if (REDIS_DISABLED) {
    return getMongo().then(db => db.collection('live_prices').findOne({ symbol }));
  }
  // ... normal Redis flow
}
```

---

#### 🟡 Scenario 4: Local Redis Failure (BullMQ Stops)

**Symptoms:**
- Hetzner is up, but BullMQ workers logging "Connection refused 127.0.0.1:6379"
- No new prices being written
- `pm2 status` shows worker as online but stuck

**Immediate Impact:**
- 60-second cron not firing
- All queued jobs paused (in-flight jobs lost)
- Live ingestion stops

**Recovery:**

```bash
# SSH into Hetzner
ssh deploy@YOUR_SERVER_IP

# Check Redis status
sudo systemctl status redis-server

# If down, start it
sudo systemctl start redis-server

# Verify
redis-cli -a YourStrongRedisPassword123 ping
# Should print: PONG

# Restart BullMQ worker to reconnect
pm2 restart cip-worker

# Verify recovery
pm2 logs cip-worker --lines 20
```

**Persistent Failure (disk corruption):**

```bash
# Reinstall Redis
sudo apt purge -y redis-server
sudo apt install -y redis-server

# Restore your config
sudo nano /etc/redis/redis.conf
# (set bind 127.0.0.1, requirepass, appendonly yes)

sudo systemctl enable redis-server
sudo systemctl start redis-server

# BullMQ will recreate its job queues automatically (no data loss for cron schedules — those live in Redis but recreate on next worker tick)
```

**Lost Jobs:**
- Cron schedules: re-register on next worker startup (no loss)
- Active price ingestion: skip 60s, next tick covers it
- Active alert checks: re-trigger from next price tick
- Net effect: you might lose 1-2 minutes of alert evaluations in worst case

---

#### 🟡 Scenario 5: MetalpriceAPI Outage or Quota Exhausted

**Symptoms:**
- Worker logs: "MetalpriceAPI 503" or "rate limit exceeded"
- Latency spikes
- No new metals prices (crypto still works via Binance)

**Immediate Impact:**
- Metals prices freeze
- Last cached price serves users
- After 30 minutes: stale data warnings show

**Built-in Mitigation (already in your code):**

Your current ingestion code (doc 22) already has fallback:

```typescript
// Fallback chain in ingest-metals.ts
try {
  prices = await fetchFromMetalpriceAPI();
} catch (err) {
  log.warn('MetalpriceAPI failed, trying MetalsAPI');
  prices = await fetchFromMetalsAPIFallback();  // Different provider
}
```

**Sign up for both:**
- Primary: MetalpriceAPI Basic Plus ($16.99/mo)
- Backup: MetalsAPI free tier (limited to 100/day — use only on primary failure)

**Quota Exhaustion Recovery:**

Set up alerts at 80% and 95% quota:

```typescript
// Already in your worker code:
const quotaUsed = response.headers.get('X-API-CURRENT');
const quotaTotal = response.headers.get('X-API-QUOTA');
const usage = parseInt(quotaUsed) / parseInt(quotaTotal);

if (usage > 0.95) {
  // Emergency: throttle to 5-min ingestion instead of 60-sec
  log.error({ usage }, 'CRITICAL: API quota >95%, throttling');
  await sendAdminAlert('Quota near exhausted - throttling ingestion');
  // Pause cron, restart with longer interval
}
```

**Stale Data UX:**

Always show users when data is stale:

```tsx
// components/PriceDisplay.tsx
const ageSec = (Date.now() - new Date(price.timestamp).getTime()) / 1000;

return (
  <div>
    <span className="text-3xl">{formatCurrency(price.value)}</span>
    {ageSec > 120 && (
      <span className="text-amber-500 text-xs">
        ⚠️ Last updated {Math.round(ageSec / 60)} min ago
      </span>
    )}
    {ageSec > 600 && (
      <span className="text-red-500 text-sm">
        ⚠️ Stale data — investigating
      </span>
    )}
  </div>
);
```

---

#### 🟡 Scenario 6: Binance WebSocket Permanent Disconnect

**Symptoms:**
- Crypto prices freeze
- Worker logs: repeated "WebSocket disconnected" with no successful reconnect
- BTC/ETH price unchanged for >5 minutes

**Mitigation (already in your code):**

```typescript
// apps/worker/src/jobs/ingest-crypto-ws.ts
function scheduleReconnect() {
  // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s max
  const delay = Math.min(1_000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectTimeout = setTimeout(connect, delay);
}
```

**Backup Provider:**

Add a fallback to **CoinGecko free API** (no key required, 30 calls/min):

```typescript
async function getCryptoPriceFallback(): Promise<CryptoPrice[]> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
  const data = await res.json();
  return [
    { symbol: 'BTCUSDT', price: data.bitcoin.usd, source: 'coingecko' },
    { symbol: 'ETHUSDT', price: data.ethereum.usd, source: 'coingecko' },
  ];
}

// In WebSocket disconnect handler:
ws.on('close', async () => {
  // Use polling fallback if WebSocket fails 3 times consecutively
  if (consecutiveFailures > 3) {
    await getCryptoPriceFallback();
    setTimeout(() => connect(), 60_000); // Retry WS in 1 min
  }
  scheduleReconnect();
});
```

---

#### 🟢 Scenario 7: Vercel Outage

**Symptoms:**
- Site returns 502/503
- Vercel status page shows incident

**Immediate Impact:**
- Frontend offline
- API endpoints unreachable
- **Worker keeps running** (independent of Vercel)
- Cloudflare CDN may serve cached pages for several minutes

**Mitigation:**
- Vercel SLA is 99.99% — outages are rare and short
- Your data is safe on MongoDB
- Cloudflare keeps showing cached HTML

**Recovery:**
- Wait for Vercel
- Or push a redeploy to force region failover

**No action needed** — Vercel handles its own DR.

---

#### 🟢 Scenario 8: Clerk (Auth) Outage

**Symptoms:**
- Login fails
- MFA challenges hang
- Existing logged-in users keep working (cached JWT)

**Mitigation:**
- Clerk has 99.99% SLA + multi-region failover
- Existing sessions cached for 60s minimum
- **Public site (gold/silver/copper pages) keeps working** — auth only needed for admin

**Recovery:** wait for Clerk. No data loss.

---

### B.3 Monitoring & Alerts (How You Find Out About Failures)

| Tool | Free Tier | What to Monitor |
|---|---|---|
| **UptimeRobot** | 50 monitors free | Site URL, /api/health/time every 5 min |
| **Better Stack** | 10 monitors free | Same, with better alerting |
| **MongoDB Atlas Alerts** | Free | Connection errors, slow queries |
| **Upstash Console** | Free | Command count, errors |
| **Vercel Notifications** | Free | Deployment failures, function errors |
| **Cloudflare Email Alerts** | Free | DDoS attacks, security events |

**Minimum monitoring setup (10 minutes):**

1. UptimeRobot → add `https://yoursite.com` (5-min check, email + SMS alert)
2. UptimeRobot → add `https://yoursite.com/api/health/time` (5-min check)
3. UptimeRobot → add `https://yoursite.com/api/price/gold` (5-min check, body must contain `success: true`)
4. MongoDB Atlas → Email alerts on replication lag, connection failures
5. Vercel → Slack/email integration for deployment failures

---

### B.4 RTO/RPO Summary

**RTO** = Recovery Time Objective (how fast you're back up)
**RPO** = Recovery Point Objective (how much data can be lost)

| Failure | Detection Time | RTO | RPO | Cost |
|---|---|---|---|---|
| MongoDB | <1 min (auto) | 30s (auto-failover) | 0 (replicas) | Free |
| Hetzner VPS | 2-5 min (UptimeRobot) | 15 min (manual) | 60-120s | Manual rebuild |
| Hetzner VPS (with snapshot) | Same | 5 min | 60-120s | $0.50/mo |
| Hetzner VPS (with standby) | Same | 2 min (auto) | <60s | $4.51/mo extra |
| Upstash Redis | <1 min (auto fallback) | N/A | 0 | Free |
| Local Redis | 2-5 min | 5 min (manual) | <60s active jobs | Free |
| MetalpriceAPI | <1 min (auto fallback) | N/A | 0 | Free fallback |
| Binance WS | <1 min (auto reconnect) | N/A | <30s | Free |
| Vercel | <1 min | N/A (auto) | 0 | Free |
| Clerk | <1 min | N/A (auto) | 0 | Free |

---

### B.5 Recommended Backup Schedule

| What | Where | Frequency | Retention | Cost |
|---|---|---|---|---|
| MongoDB | Atlas continuous | Real-time | 7 days (free tier) | $0 |
| MongoDB | Cloudflare R2 export | Daily 2 AM UTC | 30 days | ~$0.50/mo |
| Hetzner snapshot | Hetzner Cloud | Weekly | 4 weeks | ~$0.50/mo |
| Code | GitHub | On every push | Forever | $0 |
| Environment variables | 1Password / Bitwarden | Manual | Forever | $0 |
| Configuration files | GitHub (private repo) | On every change | Forever | $0 |

**Total DR cost: ~$1/mo extra.** For a SaaS, this is a no-brainer.

---

### B.6 The "Bus Factor" Problem (You're a Solo Founder)

If you're hit by a bus tomorrow, can someone else recover the system?

**Document everything in 1Password / Bitwarden vault:**
- All service login credentials
- API keys + their reset URLs
- Hetzner SSH key + server IPs
- This document index
- A 1-page "RUNBOOK.md" with step-by-step "if X happens, do Y"

Share vault access with one trusted person (co-founder, family, lawyer in escrow).

---

### B.7 Tabletop Exercise: Run This Quarterly

Once every 3 months, simulate a failure WITHOUT actual production impact:

| Quarter | Drill |
|---|---|
| Q1 | Practice MongoDB connection string rotation (without breaking anything) |
| Q2 | Simulate Hetzner failure — restore worker from GitHub on a new VPS |
| Q3 | Simulate Upstash outage — toggle DISABLE_REDIS env var |
| Q4 | Full game-day: practice all 3 scenarios in sequence |

This is the only way to know your DR plan actually works.

---

### B.8 First-Day Production Checklist

Before going live, complete:

- [ ] MongoDB Atlas backup script deployed and tested
- [ ] Hetzner weekly snapshot scheduled
- [ ] UptimeRobot monitoring active for site + 2 health endpoints
- [ ] MetalpriceAPI fallback API key (MetalsAPI) configured
- [ ] CoinGecko backup integration in worker (optional but recommended)
- [ ] Stale data UX (>2 min warning, >10 min error) implemented
- [ ] Admin alert webhook for quota exhaustion
- [ ] 1Password vault contains all credentials
- [ ] RUNBOOK.md committed to repo
- [ ] One trusted person has emergency vault access

---

### B.9 Updates Needed in Other Docs

**Doc 17 (CLAUDE.md):** Add DR rules

```markdown
### Disaster Recovery Rules

ALWAYS:
- Wrap all external service calls in try/catch — never let a failure cascade
- Use MetalpriceAPI fallback to MetalsAPI on errors
- Use CoinGecko fallback if Binance WS fails 3+ times
- Show stale data warnings if price.timestamp is >2 minutes old
- Log all external service failures with full error context
- Use UTC timestamps for all DR-related logging

NEVER:
- Throw uncaught errors from cache reads — fall through to MongoDB
- Trust a single API provider — always have a fallback
- Store backups in the same region as the primary data
- Hard-code API keys — use env vars so they can be rotated quickly
```

**Doc 18 (Sprint Plan):** Add Sprint 1 task

- [ ] Set up daily MongoDB backup script
- [ ] Schedule weekly Hetzner snapshot
- [ ] Create UptimeRobot monitors
- [ ] Implement stale data UI warnings
- [ ] Create RUNBOOK.md

**Doc 21 (Hetzner):** Add Section 14 — DR procedures

**Doc 11 (Logging):** Add admin alert for failover events

---

### B.10 Cost Summary (DR Add-Ons)

| DR Component | Cost/mo | Why |
|---|---|---|
| Cloudflare R2 backups (30 days, ~5GB) | ~$0.50 | Off-site MongoDB backup |
| Hetzner weekly snapshots | ~$0.50 | Quick VPS recovery |
| MetalsAPI free tier | $0 | Fallback price provider |
| UptimeRobot free tier | $0 | 50 monitors |
| MongoDB Atlas continuous backup | $0 (free tier) | Built-in |
| **Total DR overhead** | **~$1/mo** | |

Compared to your $22.50/mo total stack, DR adds **<5% to monthly costs** for substantial protection.

---

## Part C — Final Architecture After DR

```
                       ┌─────────────────────┐
                       │   Cloudflare DNS    │
                       │   + Free SSL        │
                       │   + DDoS protection │
                       └──────────┬──────────┘
                                  │
                                  ▼
              ┌───────────────────────────────────────┐
              │  Cloudflare Workers (FREE TIER)        │
              │  • Geo-IP detection                    │
              │  • Edge rate limit                     │
              │  • Cache /api/price/* for 30s          │
              └───────────────────┬───────────────────┘
                                  │
              ┌───────────────────┼────────────────────┐
              │                   │                    │
              ▼                   ▼                    ▼
        ┌──────────┐      ┌─────────────┐     ┌────────────┐
        │ Vercel   │      │ MongoDB     │     │ UptimeRobot│
        │ (Hobby)  │      │ Atlas M0    │     │ Monitors   │
        │          │◄─────┤ + Backups   │     │ x3 endpoints│
        │ Next.js  │      │ to R2 daily │     └────────────┘
        └────┬─────┘      └──────┬──────┘
             │                   │
             │                   │   ┌─────────────────┐
             ▼                   │   │  Hetzner CX22   │
        ┌──────────┐             │   │  (Singapore)    │
        │ Upstash  │             │   │                 │
        │ Redis    │             ◄───┤  • BullMQ       │
        │ (cache)  │                 │  • Local Redis  │
        └──────────┘                 │  • Workers      │
                                     │  • WebSocket    │
                                     │  + weekly snap  │
                                     └────────┬────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                     ┌────────────┐  ┌──────────────┐  ┌──────────┐
                     │MetalpriceAPI│  │MetalsAPI    │  │ Binance  │
                     │  (primary)  │  │ (fallback)  │  │  + CoinGecko│
                     │             │  │             │  │  fallback │
                     └────────────┘  └──────────────┘  └──────────┘
```

**Total cost: ~$23.50/mo** (your original $22.50 + $1 DR overhead)

---

*Document 26 of the CIP-2026 Package — Disaster Recovery Plan + Cloudflare Decision*
*Cross-references: Updates needed in 11, 17, 18, 21 per section B.9*
*Last reviewed: April 23, 2026*
