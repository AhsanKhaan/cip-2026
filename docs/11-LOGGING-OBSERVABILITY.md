# 📊 11 — Logging & Observability System

**Stack:** Pino (structured logger) → MongoDB `logs` collection → Admin dashboard viewer
**Philosophy:** Every request, job, and admin action is traceable by correlation ID.
**Scale path:** Start on Mongo. At 100K+ MAU or 10M+ logs/month, migrate to Axiom (free 500GB/mo) via `pino-axiom` transport.

---

## 1. Why This Design

**Structured logging beats console.log for three reasons:**

1. **Searchable fields.** `{ level: 'error', route: '/api/subscribe', userId: 'x' }` → query "all errors on subscribe in last 24h" in one MongoDB command.
2. **Correlation IDs.** One browser request → Vercel edge → API route → MongoDB → worker job → all tagged with the same `traceId`. You can follow a user's exact path through your system.
3. **Zero leaked PII.** Automatic redaction rules strip emails/phones/tokens before write. No accidents.

**Why Pino:** Fastest JSON logger in Node (6× faster than Winston), type-safe, minimal runtime cost, native support for child loggers, production-proven at scale.

**Why MongoDB (for now):** You already have it. One collection, one admin UI, no extra service. When logs hit ~5GB/day, you'll want Axiom — but that's a migration, not a rewrite (just swap the pino transport).

---

## 2. Log Levels & When to Use Each

| Level | Number | Use case | Example |
|-------|--------|----------|---------|
| `trace` | 10 | Dev-only, very verbose | Function entry/exit during debugging |
| `debug` | 20 | Development details | "Query returned 42 rows" |
| `info` | 30 | Normal operations | "User subscribed", "Broadcast sent" |
| `warn` | 40 | Recoverable issues | "Primary API timeout, using fallback" |
| `error` | 50 | Failed operations | "Failed to send email after 3 retries" |
| `fatal` | 60 | System unusable | "MongoDB connection lost" |

**Production config:** Log `info` and above to MongoDB. Log `debug`+ to stdout only (for Vercel/Hetzner console during incident response).

---

## 3. MongoDB Schema: `logs` Collection

Created as **capped time-series** for efficient writes + automatic deletion.

### Creation

```js
db.createCollection('logs', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'meta',
    granularity: 'seconds'
  },
  expireAfterSeconds: 60 * 60 * 24 * 30   // 30 days retention
});
```

### Document shape

```ts
interface LogEntry {
  _id: ObjectId;
  timestamp: Date;

  // Meta fields (indexed via metaField)
  meta: {
    service: 'web' | 'worker';            // Which process wrote it
    environment: 'production' | 'staging' | 'development';
    level: 'trace'|'debug'|'info'|'warn'|'error'|'fatal';
    route?: string;                        // API route or page path
    jobName?: string;                      // BullMQ job name
    component?: string;                    // e.g., 'disclaimer-engine', 'subscribe-api'
  };

  // Body (searchable, full-text indexed selectively)
  msg: string;                             // Human-readable message
  traceId?: string;                        // Correlation ID (UUID v4)
  userId?: string;                         // Clerk user ID (not PII)
  subscriberId?: string;                   // Mongo ObjectId as string
  ipHash?: string;                         // Hashed IP (not raw)
  userAgent?: string;

  // Context data (flexible, queryable)
  context?: Record<string, any>;           // e.g., { symbol: 'gold', price: 2350 }

  // Error info (when level >= error)
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // Performance
  durationMs?: number;                     // Request or operation duration
  statusCode?: number;                     // HTTP status
}
```

### Indexes

```js
db.logs.createIndex({ 'meta.level': 1, timestamp: -1 });
db.logs.createIndex({ 'meta.service': 1, 'meta.level': 1, timestamp: -1 });
db.logs.createIndex({ traceId: 1 });
db.logs.createIndex({ userId: 1, timestamp: -1 });
db.logs.createIndex({ 'meta.route': 1, timestamp: -1 });
db.logs.createIndex({ statusCode: 1, timestamp: -1 });
db.logs.createIndex({ msg: 'text' });  // Full-text search on message
```

---

## 4. Pino Configuration

### `apps/web/lib/logger.ts`

```ts
import pino from 'pino';
import { MongoClient } from 'mongodb';
import { getWebEnv } from '@shared/env';

const env = getWebEnv();

// PII redaction rules — applied before write
const REDACT_PATHS = [
  '*.email',
  '*.phone',
  '*.phone.number',
  '*.password',
  '*.token',
  '*.verificationToken',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

// Custom MongoDB transport
function mongoTransport() {
  return pino.transport({
    target: './mongo-transport.js',
    options: {
      uri: env.MONGODB_URI,
      database: env.MONGODB_DB_NAME,
      collection: 'logs',
      batchSize: 100,
      flushIntervalMs: 2000,
    }
  });
}

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]'
  },
  base: {
    service: 'web',
    environment: env.NODE_ENV,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      route: req.route?.path,
      // NO headers, NO body — avoid PII
    }),
  },
}, mongoTransport());

// Child logger helper — adds component context
export function getLogger(component: string) {
  return logger.child({ component });
}
```

### `apps/web/lib/mongo-transport.js` (Pino transport)

```js
import { MongoClient } from 'mongodb';
import build from 'pino-abstract-transport';

export default async function (opts) {
  const client = new MongoClient(opts.uri, { maxPoolSize: 2 });
  await client.connect();
  const db = client.db(opts.database);
  const collection = db.collection(opts.collection);

  let buffer = [];
  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      await collection.insertMany(batch, { ordered: false });
    } catch (err) {
      // Don't throw — losing a log entry is better than crashing the app
      console.error('Log flush failed:', err.message);
    }
  };

  const interval = setInterval(flush, opts.flushIntervalMs || 2000);

  return build(async function (source) {
    for await (const obj of source) {
      buffer.push({
        timestamp: new Date(obj.time),
        meta: {
          service: obj.service,
          environment: obj.environment,
          level: obj.level,
          route: obj.route,
          jobName: obj.jobName,
          component: obj.component,
        },
        msg: obj.msg,
        traceId: obj.traceId,
        userId: obj.userId,
        subscriberId: obj.subscriberId,
        ipHash: obj.ipHash,
        userAgent: obj.userAgent,
        context: obj.context,
        error: obj.err,
        durationMs: obj.durationMs,
        statusCode: obj.statusCode,
      });

      if (buffer.length >= (opts.batchSize || 100)) {
        await flush();
      }
    }
  }, {
    async close() {
      clearInterval(interval);
      await flush();
      await client.close();
    }
  });
}
```

---

## 5. Correlation ID Middleware

Every request gets a `traceId` that follows it through the stack.

### `apps/web/middleware.ts`

```ts
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export function middleware(request) {
  const traceId = request.headers.get('x-trace-id') || randomUUID();

  const response = NextResponse.next();
  response.headers.set('x-trace-id', traceId);

  // Pass to server components via request header
  request.headers.set('x-trace-id', traceId);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Using it in API routes

```ts
// apps/web/app/api/subscribe/route.ts
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const traceId = req.headers.get('x-trace-id');
  const log = logger.child({ traceId, route: '/api/subscribe' });

  log.info({ context: { method: 'POST' } }, 'Subscribe request received');

  try {
    // ... business logic
    log.info({ subscriberId: subscriber._id.toString() }, 'Subscriber created');
  } catch (err) {
    log.error({ err }, 'Subscribe failed');
    throw err;
  }
}
```

---

## 6. Logging Patterns (Copy-Paste Ready)

### 6.1 API route wrapper

```ts
// apps/web/lib/with-logging.ts
import { logger } from './logger';

export function withLogging(handler, routeName) {
  return async function (req, ctx) {
    const start = Date.now();
    const traceId = req.headers.get('x-trace-id');
    const log = logger.child({ traceId, route: routeName });

    try {
      const res = await handler(req, ctx);
      log.info({
        statusCode: res.status,
        durationMs: Date.now() - start,
      }, 'Request completed');
      return res;
    } catch (err) {
      log.error({
        err,
        durationMs: Date.now() - start,
      }, 'Request failed');
      throw err;
    }
  };
}

// Usage:
export const POST = withLogging(async (req) => { /* ... */ }, '/api/subscribe');
```

### 6.2 Worker job wrapper

```ts
// apps/worker/src/lib/with-job-logging.ts
import { logger } from './logger';

export function withJobLogging(handler, jobName) {
  return async function (job) {
    const start = Date.now();
    const log = logger.child({
      jobName,
      jobId: job.id,
      traceId: job.data?.traceId,
    });

    log.info({ context: { attempts: job.attemptsMade } }, 'Job started');

    try {
      const result = await handler(job, log);
      log.info({ durationMs: Date.now() - start }, 'Job completed');
      return result;
    } catch (err) {
      log.error({ err, durationMs: Date.now() - start }, 'Job failed');
      throw err;
    }
  };
}
```

### 6.3 Database operation logging

```ts
const log = getLogger('db');

log.debug({ context: { collection: 'subscribers', op: 'findOne' } }, 'Query start');
const result = await db.collection('subscribers').findOne({ email });
log.debug({ context: { found: !!result } }, 'Query complete');
```

### 6.4 Admin action audit logging

Distinct from operational logs — these go to **both** `logs` AND `audit_log` collection (from doc 08).

```ts
// apps/web/lib/audit.ts
import { logger } from './logger';
import { getMongo } from './mongo';

export async function audit(action, resource, actor, changes) {
  const db = await getMongo();

  // 1. Audit log (permanent, 7-year retention)
  await db.collection('audit_log').insertOne({
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    resourceType: resource.type,
    resourceId: resource.id,
    before: changes.before,
    after: changes.after,
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    timestamp: new Date(),
  });

  // 2. Operational log (30-day retention, visible in dashboard)
  logger.info({
    userId: actor.id,
    context: {
      action,
      resourceType: resource.type,
      resourceId: resource.id,
    }
  }, `Admin action: ${action}`);
}

// Usage:
await audit(
  'disclaimer.update',
  { type: 'disclaimer', id: discId },
  { id: user.id, email: user.email, ip, userAgent },
  { before: oldDoc, after: newDoc }
);
```

---

## 7. Admin Log Dashboard (UI Spec)

Route: `/admin/logs`
Auth: MFA-verified admin session

### 7.1 Page layout

```
┌────────────────────────────────────────────────────────────────┐
│  Logs                                         [Export CSV]    │
├────────────────────────────────────────────────────────────────┤
│  🔍 [Search messages...]                                      │
│                                                                │
│  Level:  [all ▾] [error ▾] [warn ▾] [info ▾]                  │
│  Service: [all] [web] [worker]                                 │
│  Route:  [/api/subscribe ▾]                                   │
│  Time:   [Last 1h] [Last 24h] [Last 7d] [Custom]              │
│  UserId: [                    ]                                │
│  TraceId: [                    ]                               │
│                                                                │
│  [Apply Filters]  [Clear]                                      │
├────────────────────────────────────────────────────────────────┤
│  Live tail: [●] (auto-refresh every 5s)                       │
├────────────────────────────────────────────────────────────────┤
│  TIME       LEVEL  ROUTE              MESSAGE                  │
│  08:23:14   ERROR  /api/subscribe     Failed to send email  ▾ │
│    └─ expanded:                                                │
│       traceId: abc-123-def                                     │
│       statusCode: 500                                          │
│       durationMs: 1250                                         │
│       error: {                                                 │
│         name: 'ResendAPIError',                                │
│         message: 'Rate limit exceeded',                        │
│         stack: '...'                                           │
│       }                                                        │
│       [View full trace →]                                      │
│                                                                │
│  08:23:12   INFO   /api/subscribe     Subscriber created       │
│  08:23:11   INFO   worker             Price ingested          │
│  ...                                                           │
├────────────────────────────────────────────────────────────────┤
│  [< Prev]   Page 1 of 84   [Next >]                           │
└────────────────────────────────────────────────────────────────┘
```

### 7.2 Statistics cards (top of page)

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Errors (24h) │ Warnings 24h │ Avg Latency  │ Requests 24h │
│ 12 ↑ +3      │ 47 → 0       │ 142ms ↓ -8%  │ 48,234 ↑ 12% │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### 7.3 Trace view (click any log entry)

Shows all logs sharing the same `traceId`, ordered by time:

```
Trace: abc-123-def (duration: 1,284ms)

08:23:14.102  web      middleware     Request received
08:23:14.110  web      /api/subscribe Rate limit check passed
08:23:14.115  web      /api/subscribe Validation passed
08:23:14.230  web      db             Query: findOne subscribers
08:23:14.280  web      db             Query returned 0 rows
08:23:14.310  web      db             Insert: subscribers
08:23:14.420  web      email          Sending verification email
08:23:15.350  web      email          ERROR: Resend API rate limit
08:23:15.362  web      /api/subscribe Request failed (500)
```

This is invaluable during incident response.

### 7.4 Live tail mode

Auto-refresh every 5s. Pauses when user interacts. Shows newest-first.

---

## 8. Alerting (Phase 2)

### 8.1 Threshold alerts

Run as worker cron every minute:

```ts
// apps/worker/src/jobs/check-log-alerts.ts

const RULES = [
  {
    name: 'High error rate',
    query: { 'meta.level': 'error' },
    window: 5 * 60 * 1000,       // 5 minutes
    threshold: 10,
    channel: 'email',
    severity: 'high',
  },
  {
    name: 'Subscribe API failing',
    query: { 'meta.route': '/api/subscribe', 'meta.level': 'error' },
    window: 10 * 60 * 1000,
    threshold: 3,
    channel: 'email',
    severity: 'critical',
  },
  {
    name: 'Fatal errors',
    query: { 'meta.level': 'fatal' },
    window: 60 * 1000,
    threshold: 1,
    channel: 'email',
    severity: 'critical',
  },
];

for (const rule of RULES) {
  const count = await db.collection('logs').countDocuments({
    ...rule.query,
    timestamp: { $gte: new Date(Date.now() - rule.window) }
  });

  if (count >= rule.threshold) {
    await sendAlert(rule, count);
  }
}
```

### 8.2 Alert channels

- **Email:** `alerts@yoursite.com` via Resend
- **Slack webhook:** `SLACK_WEBHOOK_URL` env var (optional)
- **Dashboard banner:** Red strip at top of `/admin/*` pages when active alert

Deduplication: Don't re-alert same rule within 15 minutes (track in Redis).

---

## 9. Cost & Capacity Planning

### 9.1 Expected log volume

| Phase | MAU | Logs/day | Storage/day |
|-------|-----|----------|-------------|
| Launch (first month) | 100–5K | ~50K | ~100MB |
| Growth (months 2–6) | 5K–50K | ~500K | ~1GB |
| Scale (months 6+) | 50K+ | 5M+ | ~10GB |

MongoDB M0 = 512MB free, M10 = 10GB included. At 50K+ MAU, migrate to Axiom.

### 9.2 Migration trigger to Axiom

When any of:
- Logs collection exceeds 5GB
- MongoDB write latency > 50ms p95 due to log pressure
- Admin log dashboard queries take > 2s

### 9.3 Axiom migration (future)

Axiom has a `pino-axiom` transport. Swap 3 lines:

```ts
// Before:
export const logger = pino({ /* ... */ }, mongoTransport());

// After:
import { AxiomTransport } from 'pino-axiom';
export const logger = pino({ /* ... */ }, {
  target: 'pino-axiom',
  options: { token: env.AXIOM_TOKEN, dataset: 'cip-prod' }
});
```

Keep Mongo as fallback (dual-write for first week) for peace of mind.

---

## 10. QA Checklist for Logging

- [ ] All API routes produce info log on success, error log on failure
- [ ] Every log has `traceId` that matches request `x-trace-id` header
- [ ] No PII in logs: emails, phones, tokens redacted
- [ ] IP addresses hashed, not stored raw
- [ ] Passwords never logged (Zod redaction)
- [ ] Worker jobs log start/end with duration
- [ ] Admin dashboard `/admin/logs` loads in < 500ms with filters
- [ ] Full-text search on message works
- [ ] Trace view shows all related logs in order
- [ ] Alerts fire for error spikes (tested)
- [ ] 30-day TTL removes old logs automatically

---

**End of `11-LOGGING-OBSERVABILITY.md`. Proceed to `12-TESTING-STRATEGY.md`.**
