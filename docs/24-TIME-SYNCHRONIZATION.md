# ⏰ 24 — Time Synchronization Across All Services

**Problem addressed:** Ensuring clocks are synchronized across Vercel, MongoDB Atlas, Upstash Redis, Hetzner VPS, BullMQ workers, and Clerk — so timestamps, TTLs, cron jobs, and JWT expiry all agree.

**TL;DR:** You don't sync clocks across services — you standardize on UTC everywhere and trust NTP. Managed services (Vercel/Atlas/Upstash/Clerk) already handle NTP. Your only action: configure `chrony` on Hetzner and follow 6 code rules.

---

## 1. Why Clock Sync Matters for CIP-2026

| If clocks drift... | What breaks |
|---|---|
| Hetzner worker is 30s ahead | Candle timestamps appear "in the future" → broken charts |
| Vercel is 30s behind | Clerk JWT/MFA tokens appear expired before they should be |
| MongoDB and worker disagree by 5 min | Wrong minute gets OHLC upsert → data corruption |
| BullMQ scheduler is skewed | Cron jobs run at wrong time → ingestion misses |
| Redis TTLs calculated with wrong clock | Cache expires too early or too late |
| MetalpriceAPI returns timestamp but worker uses own | Displayed "last updated" is misleading |

**For a commodity trading platform, clock drift is a data integrity issue.** A 1-minute candle must span exactly 60 seconds — not 45 or 75.

---

## 2. Clock Responsibility Matrix

```
┌──────────────────────────────────────────────────────────────┐
│  Service         │  Clock source        │  Your action       │
├──────────────────────────────────────────────────────────────┤
│  Vercel          │  AWS NTP (managed)   │  ✅ Do nothing     │
│  MongoDB Atlas   │  AWS NTP (managed)   │  ✅ Do nothing     │
│  Upstash Redis   │  AWS NTP (managed)   │  ✅ Do nothing     │
│  Clerk           │  AWS NTP (managed)   │  ✅ Do nothing     │
│  Resend          │  AWS NTP (managed)   │  ✅ Do nothing     │
│  GitHub Actions  │  AWS NTP (managed)   │  ✅ Do nothing     │
│  Hetzner VPS     │  You install chrony  │  ⚠️  Configure it  │
│  User's browser  │  Their OS            │  ❌ Never trust it │
└──────────────────────────────────────────────────────────────┘
```

**Hetzner is the only server you administer — the only one you actively configure.** Managed services use AWS-grade NTP (sub-millisecond accuracy).

---

## 3. Configure chrony on Hetzner (One-Time, 5 Minutes)

SSH into your Hetzner server and run this once:

```bash
# On Hetzner as root (or with sudo)
apt install -y chrony

# Configure NTP pools for redundancy
cat > /etc/chrony/chrony.conf << 'EOF'
# Multiple NTP pools for redundancy
pool 0.pool.ntp.org iburst maxsources 4
pool 1.pool.ntp.org iburst maxsources 4
pool time.cloudflare.com iburst
pool time.google.com iburst

# Log drift for diagnostics
driftfile /var/lib/chrony/chrony.drift
logdir /var/log/chrony

# Allow system clock to step if off by more than 1 second (first boot)
makestep 1.0 3

# Enable hardware clock sync
rtcsync

# Security: serve time only to localhost
allow 127.0.0.1
EOF

# Restart chrony
systemctl restart chrony
systemctl enable chrony

# Critical: set timezone to UTC (NEVER use local timezone on servers)
timedatectl set-timezone UTC

# Verify
sleep 30
chronyc tracking
timedatectl
```

**Expected `chronyc tracking` output:**

```
Reference ID    : A8282FB8 (time.cloudflare.com)
Stratum         : 3
System time     : 0.000002451 seconds fast of NTP time  ← < 1ms drift = perfect
Last offset     : +0.000045123 seconds
RMS offset      : 0.000089234 seconds
```

**Expected `timedatectl` output:**

```
Time zone: UTC (UTC, +0000)   ← MUST show UTC
System clock synchronized: yes
NTP service: active
```

If "System time" shows more than 100ms drift, run `systemctl restart chrony` and wait 5 minutes. If still bad, check firewall — port 123/UDP must be outbound-open.

---

## 4. The 6 Code Rules (Follow Always)

### Rule 1 — Store UTC Always, Display in User Timezone

```typescript
// ❌ WRONG — uses server's local timezone implicitly (fragile)
await db.collection('candles_1m').insertOne({
  timestamp: new Date().toLocaleString(),
});

// ❌ WRONG — storing string loses millisecond precision
await db.collection('candles_1m').insertOne({
  timestamp: new Date().toISOString(),
});

// ✅ CORRECT — native Date object; MongoDB stores as UTC BSON
await db.collection('candles_1m').insertOne({
  timestamp: new Date(),
});
```

MongoDB BSON Date is **always UTC internally**. When you pass a JavaScript `Date`, MongoDB stores UTC epoch milliseconds. No ambiguity.

### Rule 2 — Convert to User Timezone at Render Time Only

```tsx
// components/PriceTimestamp.tsx
import { formatInTimeZone } from 'date-fns-tz';

export function PriceTimestamp({ utcDate }: { utcDate: Date }) {
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <time dateTime={utcDate.toISOString()}>
      {formatInTimeZone(utcDate, userTz, 'MMM d, yyyy HH:mm:ss zzz')}
    </time>
  );
}

// Pakistan user sees:   "Apr 23, 2026 17:34:12 PKT"
// India user sees:      "Apr 23, 2026 18:04:12 IST"
// UK user sees:         "Apr 23, 2026 13:34:12 BST"
// MongoDB always stores: 2026-04-23T12:34:12.000Z  (UTC)
```

### Rule 3 — Server Timestamps Only, Never Client

```typescript
// ❌ WRONG — client clock can be wrong by hours, deliberately faked
export async function POST(req: Request) {
  const { text, timestamp } = await req.json();  // Don't trust
  await db.collection('comments').insertOne({ text, timestamp });
}

// ✅ CORRECT — server decides timestamp
export async function POST(req: Request) {
  const { text } = await req.json();
  await db.collection('comments').insertOne({
    text,
    timestamp: new Date(),  // Vercel's clock, NTP-synced
  });
}
```

### Rule 4 — Store Both API Timestamp + Your Server Timestamp

MetalpriceAPI returns a `timestamp` field (Unix seconds, UTC). Store both:

```typescript
// Worker — when ingesting from MetalpriceAPI
const data = await response.json();
// data.timestamp = 1714123212  (Unix seconds, UTC)

const priceTimestamp = new Date(data.timestamp * 1000);
const storedAt       = new Date();

await db.collection('live_prices').updateOne(
  { symbol: 'gold' },
  {
    $set: {
      price:           priceUSDperOz,
      priceTimestamp,                          // When API quoted the price
      storedAt,                                // When worker saved it
      latencyMs:       storedAt.getTime() - priceTimestamp.getTime(),
    },
  },
);
```

**`latencyMs` is a monitoring metric.** If it exceeds 5000ms, your network or MetalpriceAPI is slow — alert.

### Rule 5 — Use BullMQ Cron Expressions, Not `setInterval`

```typescript
// ❌ WRONG — drifts over time, depends on event loop
setInterval(async () => {
  await ingestMetals();
}, 60_000);

// ✅ CORRECT — BullMQ handles drift; uses Redis clock for scheduling
queues.metals.upsertJobScheduler('ingest-metals-60s', {
  every: 60_000,
}, {
  name: 'ingest-metals',
  data: {},
});
```

### Rule 6 — Never Use Server's Local Timezone

```typescript
// ❌ WRONG
const now = new Date();
const hour = now.getHours();  // Returns in SERVER's local TZ

// ✅ CORRECT — explicit UTC
const now = new Date();
const hour = now.getUTCHours();  // Always UTC

// ✅ BETTER — use date-fns-tz for anything timezone-aware
import { utcToZonedTime } from 'date-fns-tz';
const singaporeTime = utcToZonedTime(now, 'Asia/Singapore');
```

---

## 5. Health Check Endpoint (Drift Monitor)

Add this endpoint to detect clock drift across your stack:

```typescript
// apps/web/app/api/health/time/route.ts
import { NextResponse } from 'next/server';
import { getMongo } from '@/lib/mongo';

export async function GET() {
  const vercelNow = Date.now();

  // Ask MongoDB what time it thinks it is
  const db = await getMongo();
  const serverStatus = await db.admin().serverStatus();
  const mongoNow = new Date(serverStatus.localTime).getTime();

  // Check worker's last write — tells us Hetzner's clock
  const lastPrice = await db.collection('live_prices')
    .findOne({}, { sort: { storedAt: -1 } });
  const workerNow = lastPrice ? new Date(lastPrice.storedAt).getTime() : null;

  const drifts = {
    vercel_vs_mongo_ms:  mongoNow - vercelNow,
    vercel_vs_worker_ms: workerNow ? vercelNow - workerNow : null,
    worker_last_write:   lastPrice?.storedAt,
  };

  // Thresholds
  // - Vercel ↔ Mongo should be within 5 seconds
  // - Vercel ↔ Worker can be up to 120s (worker writes every 60s)
  const ok = Math.abs(drifts.vercel_vs_mongo_ms) < 5000
          && (!workerNow || Math.abs(drifts.vercel_vs_worker_ms!) < 120_000);

  return NextResponse.json({
    ok,
    drifts,
    message: ok ? 'All clocks synchronized' : '⚠️ Clock drift detected',
  }, { status: ok ? 200 : 503 });
}
```

Display this as a status badge on `/admin/logs`. Optionally, have UptimeRobot or Better Stack ping it every 5 minutes.

---

## 6. Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │   Atomic Clocks (NIST,      │
                    │   USNO, cesium standards)   │
                    └──────────┬──────────────────┘
                               │ NTP
                    ┌──────────▼──────────────────┐
                    │  Stratum 1/2 NTP Pools      │
                    │  (pool.ntp.org, Cloudflare, │
                    │   Google, AWS TimeSync)     │
                    └──┬──────┬──────┬──────┬─────┘
                       │      │      │      │
                       ▼      ▼      ▼      ▼
              ┌─────┐ ┌──────┐ ┌─────┐ ┌────────┐
              │Vercel│ │Atlas │ │Redis│ │Hetzner │
              │(AWS) │ │(AWS) │ │(AWS)│ │(chrony)│
              └──┬──┘ └──┬───┘ └──┬──┘ └───┬────┘
                 │       │        │        │
                 └───────┴────┬───┴────────┘
                              ▼
                  All components within
                  ± 50 milliseconds of UTC

           Code: store UTC, display in user TZ
```

---

## 7. Setup Checklist (Add to Day 0)

- [ ] `apt install chrony` on Hetzner
- [ ] Configure `/etc/chrony/chrony.conf` with 4 NTP pools
- [ ] `timedatectl set-timezone UTC` on Hetzner
- [ ] `systemctl enable chrony` (persists after reboot)
- [ ] Verify `chronyc tracking` shows drift < 100ms
- [ ] Verify `timedatectl` shows "Time zone: UTC"
- [ ] Confirm port 123/UDP outbound open on Hetzner firewall
- [ ] Add `/api/health/time` endpoint to Next.js app
- [ ] Wire status badge into `/admin/logs` dashboard
- [ ] Configure UptimeRobot to ping `/api/health/time` every 5 min
- [ ] Add alert when response returns 503 for 2+ consecutive checks

---

## 8. CLAUDE.md Additions

Add to your CLAUDE.md ALWAYS/NEVER rules:

```markdown
### Time/Timezone Rules (CRITICAL)

ALWAYS:
- Store timestamps as native Date objects (MongoDB converts to UTC BSON)
- Use `new Date()` on the server — never trust client timestamps
- Set server timezone to UTC on Hetzner
- Convert to user's timezone only at render time in React (use date-fns-tz)
- Store both `priceTimestamp` (from API) and `storedAt` (server) on price ingestion
- Use `getUTCHours()` not `getHours()` when extracting time parts in code
- Use BullMQ cron schedulers — never `setInterval` for recurring jobs

NEVER:
- Store timestamps as strings — always Date objects
- Use server's local timezone — always UTC
- Trust `timestamp` fields sent from client browsers
- Calculate TTLs based on client-provided timestamps
- Rely on `setInterval` for anything time-sensitive (drifts over hours/days)
```

---

## 9. Verification Test (Run After Deploy)

From your laptop:

```bash
# Vercel clock check
curl -s https://yoursite.com/api/health/time | jq

# Expected healthy output:
# {
#   "ok": true,
#   "drifts": {
#     "vercel_vs_mongo_ms":  -23,       ← within ±5000ms ✅
#     "vercel_vs_worker_ms": 45238,     ← within ±120000ms ✅
#     "worker_last_write":   "2026-04-23T12:33:27.000Z"
#   },
#   "message": "All clocks synchronized"
# }
```

If all values are within thresholds → your entire stack is time-synchronized. You rarely need to touch this again; `chrony` maintains drift automatically.

---

## 10. Edge Cases & What You Don't Need to Worry About

These are handled automatically — do nothing:

| Concern | Handled by |
|---|---|
| Daylight saving time transitions | UTC doesn't have DST |
| Leap seconds | AWS/Google smear them over 24h |
| Clock jumping backward | BSON Date ordering is monotonic |
| Request latency vs timestamps | Always use server-side `new Date()` |
| Redis TTL calculations | Upstash uses its own NTP-synced clock |
| JWT issued vs expired window | Clerk handles ±5s tolerance internally |

---

## 11. What Updates Are Needed in Other Docs

### Doc 21 — Hetzner Implementation
Add new section 3.7 "Configure chrony + UTC" using Section 3 above.

### Doc 09 — API Contracts
Add `GET /api/health/time` to Public endpoint list.

### Doc 11 — Logging Observability
Add clock-drift status badge to admin logs dashboard spec.

### Doc 18 — Sprint Plan
Add to Sprint 1 checklist:
- [ ] Install chrony on Hetzner
- [ ] Deploy /api/health/time endpoint
- [ ] Verify drift monitoring working

### Doc 17 — CLAUDE.md
Add time/timezone rules from Section 8 above.

---

## 12. Monthly Cost Impact

**Zero.** `chrony` is free and consumes negligible bandwidth (a few hundred bytes per minute).

---

*Document 24 of the CIP-2026 Package — Time Synchronization*
*Cross-references: 09, 11, 17, 18, 21 need small updates per section 11 above.*
*Last reviewed: April 23, 2026*
