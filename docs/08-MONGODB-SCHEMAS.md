# 🗄️ 08 — MongoDB Schemas (Complete Reference)

**Purpose:** Single source of truth for every MongoDB collection. Hand this to Claude Code whenever you need to work with data.

**Database name:** `cip_production` (or `cip_dev` for local)
**Driver:** Native `mongodb` (NOT Mongoose)
**Validation:** Zod at application layer + MongoDB JSON Schema validators at DB layer

---

## 1. Collection Map

| Collection | Type | Purpose | Approx. Size |
|------------|------|---------|--------------|
| `live_prices` | Regular | Current price snapshot per asset | 5-10 docs |
| `candles_1m` | Time-Series | 1-minute OHLC candles | ~10M rows/yr |
| `candles_1h` | Time-Series | 1-hour OHLC candles | ~200K rows/yr |
| `candles_1d` | Time-Series | 1-day OHLC candles | ~2K rows/yr |
| `disclaimers` | Regular | Legal disclaimer library | ~15-30 docs |
| `subscribers` | Regular | Email/WhatsApp subscribers | Growth |
| `broadcast_log` | Regular | Email/WhatsApp broadcast history | Growth |
| `subscriber_events` | Regular | Engagement timeline | High volume |
| `alerts` | Regular | Price alerts (Phase 3) | Growth |
| `blogs` | Regular | Blog post metadata | ~200 docs |
| `audit_log` | Regular | Admin action audit trail | Growth |
| `rate_limit_overrides` | Regular | Manual rate limit exceptions | <100 docs |

---

## 2. `live_prices` — Current Price Snapshots

One document per asset. Updated on every tick.

```ts
interface LivePrice {
  _id: ObjectId;
  symbol: 'gold' | 'silver' | 'copper' | 'bitcoin' | 'ethereum';
  price: number;              // in USD
  currency: 'USD';
  bid?: number;               // if source provides
  ask?: number;
  change24h: number;          // absolute change
  changePercent24h: number;   // percentage change
  high24h: number;
  low24h: number;
  volume24h?: number;
  source: 'metalpriceapi' | 'metals-api' | 'binance-ws' | 'coingecko' | 'stale';
  sourceTimestamp: Date;      // When the source produced this data
  ingestedAt: Date;           // When we wrote it
  isStale: boolean;           // True if all sources failed and we're serving old data
  staleSince?: Date;
}
```

### Sample document

```json
{
  "_id": ObjectId("..."),
  "symbol": "gold",
  "price": 2350.21,
  "currency": "USD",
  "change24h": 12.40,
  "changePercent24h": 0.53,
  "high24h": 2358.40,
  "low24h": 2337.80,
  "source": "metalpriceapi",
  "sourceTimestamp": ISODate("2026-04-22T08:23:12Z"),
  "ingestedAt": ISODate("2026-04-22T08:23:14Z"),
  "isStale": false
}
```

### Indexes

```js
db.live_prices.createIndex({ symbol: 1 }, { unique: true });
db.live_prices.createIndex({ ingestedAt: -1 });
db.live_prices.createIndex({ isStale: 1, source: 1 });  // For monitoring
```

### Update pattern (from worker)

```ts
await db.collection<LivePrice>('live_prices').updateOne(
  { symbol: 'gold' },
  {
    $set: {
      price, change24h, changePercent24h, high24h, low24h,
      source, sourceTimestamp, ingestedAt: new Date(),
      isStale: false,
    },
    $unset: { staleSince: "" },
  },
  { upsert: true }
);
```

---

## 3. `candles_1m` — 1-Minute OHLC Time-Series

Created as a MongoDB Time-Series collection.

### Creation command

```js
db.createCollection('candles_1m', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'symbol',
    granularity: 'minutes'
  },
  expireAfterSeconds: 60 * 60 * 24 * 60  // 60 days retention
});
```

### Document shape

```ts
interface Candle1m {
  _id: ObjectId;
  symbol: 'gold' | 'silver' | 'copper' | 'bitcoin' | 'ethereum';
  timestamp: Date;  // Truncated to minute: :00 seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;  // Only for crypto
  tickCount: number; // How many ticks we saw this minute
}
```

### Sample document

```json
{
  "_id": ObjectId("..."),
  "symbol": "gold",
  "timestamp": ISODate("2026-04-22T08:23:00Z"),
  "open": 2349.80,
  "high": 2350.45,
  "low": 2349.72,
  "close": 2350.21,
  "tickCount": 12
}
```

### Upsert pattern (from worker)

```ts
const minuteBucket = new Date(Math.floor(Date.now() / 60000) * 60000);

await db.collection<Candle1m>('candles_1m').updateOne(
  { symbol: 'gold', timestamp: minuteBucket },
  {
    $setOnInsert: {
      symbol: 'gold',
      timestamp: minuteBucket,
      open: price,
    },
    $max: { high: price },
    $min: { low: price },
    $set: { close: price },
    $inc: { tickCount: 1 },
  },
  { upsert: true }
);
```

### Common queries

```ts
// Last 24 hours for 1D chart
db.collection('candles_1m').find({
  symbol: 'gold',
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
}).sort({ timestamp: 1 }).toArray();

// Downsample to 300 points using $bucketAuto
db.collection('candles_1m').aggregate([
  { $match: { symbol: 'gold', timestamp: { $gte: startDate } } },
  { $sort: { timestamp: 1 } },
  { $bucketAuto: {
      groupBy: '$timestamp',
      buckets: 300,
      output: {
        open: { $first: '$open' },
        high: { $max: '$high' },
        low: { $min: '$low' },
        close: { $last: '$close' },
        timestamp: { $first: '$timestamp' },
      }
    }}
]).toArray();
```

---

## 4. `candles_1h` — Hourly OHLC

### Creation

```js
db.createCollection('candles_1h', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'symbol',
    granularity: 'hours'
  },
  expireAfterSeconds: 60 * 60 * 24 * 365  // 365 days retention
});
```

### Aggregation from candles_1m (hourly job)

```ts
const hourStart = new Date();
hourStart.setUTCMinutes(0, 0, 0);
hourStart.setUTCHours(hourStart.getUTCHours() - 1);
const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

const results = await db.collection('candles_1m').aggregate([
  { $match: { timestamp: { $gte: hourStart, $lt: hourEnd } } },
  { $sort: { timestamp: 1 } },
  { $group: {
      _id: '$symbol',
      open: { $first: '$open' },
      close: { $last: '$close' },
      high: { $max: '$high' },
      low: { $min: '$low' },
      volume: { $sum: '$volume' },
      tickCount: { $sum: '$tickCount' },
    }},
]).toArray();

// Upsert each symbol
for (const r of results) {
  await db.collection('candles_1h').updateOne(
    { symbol: r._id, timestamp: hourStart },
    { $set: { ...r, symbol: r._id, timestamp: hourStart } },
    { upsert: true }
  );
}
```

---

## 5. `candles_1d` — Daily OHLC (no expiry)

### Creation

```js
db.createCollection('candles_1d', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'symbol',
    granularity: 'hours'  // 'hours' is fine for daily (granularity ≤ interval)
  }
  // NO expireAfterSeconds — keep forever
});
```

Aggregation pattern is identical to hourly, but window is 24h.

---

## 6. `disclaimers` — Legal Disclaimer Library

### Schema (Zod → Mongo)

```ts
interface Disclaimer {
  _id: ObjectId;
  key: string;              // Unique: 'disc-gold-v1'
  version: number;
  category: 'general' | 'gold' | 'silver' | 'copper' | 'crypto' | 'bitcoin'
          | 'ethereum' | 'stocks' | 'educational' | 'affiliate'
          | 'data-accuracy' | 'calculator-accuracy' | 'no-advice';
  locale: string;           // 'en-US' for now
  title: string;
  bodyMarkdown: string;
  severity: 'info' | 'warning' | 'critical';
  displayStyle: 'banner' | 'box' | 'footer-text' | 'inline';
  isActive: boolean;
  effectiveFrom: Date;
  lastReviewedBy?: string;
  lastReviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

```js
db.disclaimers.createIndex({ key: 1 }, { unique: true });
db.disclaimers.createIndex({ category: 1, locale: 1, isActive: 1 });
db.disclaimers.createIndex({ isActive: 1, effectiveFrom: 1 });
```

### JSON Schema validator (optional but recommended)

```js
db.runCommand({
  collMod: 'disclaimers',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['key', 'category', 'title', 'bodyMarkdown', 'severity', 'displayStyle', 'isActive'],
      properties: {
        key: { bsonType: 'string', pattern: '^disc-[a-z0-9-]+-v\\d+$' },
        severity: { enum: ['info', 'warning', 'critical'] },
        displayStyle: { enum: ['banner', 'box', 'footer-text', 'inline'] },
      }
    }
  },
  validationLevel: 'moderate',  // Applies to new/updated docs
});
```

Full seed data in `02-DISCLAIMER-SYSTEM.md` section 4.

---

## 7. `subscribers` — Subscriber List

### Schema

```ts
interface Subscriber {
  _id: ObjectId;

  // Identity
  email: string;              // Stored lowercase, trimmed
  phone: {
    number: string;           // E.164: '+923001234567'
    country: string;          // ISO alpha-2: 'PK'
    verified: boolean;
    verifiedAt?: Date;
  } | null;

  // Preferences
  categories: string[];       // ['gold', 'crypto', ...]

  // Channels (what they've opted into)
  channels: {
    email: boolean;           // Default true
    whatsapp: boolean;        // Default false; auto-true when phone verified
    webPush: boolean;         // Default false
  };

  // Verification state
  emailVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpiresAt: Date | null;

  // Consent & compliance
  consentedAt: Date;
  consentIpAddress?: string;
  consentSource: string;      // Page URL
  consentMethod: 'form' | 'import' | 'api';
  unsubscribedAt: Date | null;
  unsubscribeReason: string | null;

  // Engagement stats (denormalized for fast queries)
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  whatsappsSent: number;
  lastEngagedAt: Date | null;

  // Metadata
  source?: string;
  userAgent?: string;
  geoCountry?: string;
  tags: string[];             // Admin-added

  createdAt: Date;
  updatedAt: Date;
}
```

### Sample document

```json
{
  "_id": ObjectId("..."),
  "email": "user@example.com",
  "phone": {
    "number": "+923001234567",
    "country": "PK",
    "verified": false
  },
  "categories": ["gold", "silver", "crypto"],
  "channels": {
    "email": true,
    "whatsapp": true,
    "webPush": false
  },
  "emailVerified": true,
  "verificationToken": null,
  "verificationTokenExpiresAt": null,
  "consentedAt": ISODate("2026-04-22T08:00:00Z"),
  "consentIpAddress": "203.0.113.42",
  "consentSource": "/gold-price-today",
  "consentMethod": "form",
  "unsubscribedAt": null,
  "unsubscribeReason": null,
  "emailsSent": 12,
  "emailsOpened": 8,
  "emailsClicked": 3,
  "whatsappsSent": 0,
  "lastEngagedAt": ISODate("2026-04-20T14:22:11Z"),
  "source": "/gold-price-today",
  "geoCountry": "PK",
  "tags": ["early-user"],
  "createdAt": ISODate("2026-03-15T10:20:00Z"),
  "updatedAt": ISODate("2026-04-22T08:00:00Z")
}
```

### Indexes

```js
db.subscribers.createIndex({ email: 1 }, { unique: true });
db.subscribers.createIndex({ "phone.number": 1 }, { sparse: true });
db.subscribers.createIndex({ categories: 1, emailVerified: 1, unsubscribedAt: 1 });
db.subscribers.createIndex({ "channels.whatsapp": 1, "phone.verified": 1 });
db.subscribers.createIndex({ unsubscribedAt: 1 });
db.subscribers.createIndex({ createdAt: -1 });
db.subscribers.createIndex({ verificationToken: 1 }, { sparse: true });
db.subscribers.createIndex({ lastEngagedAt: -1 });
```

### Common queries

```ts
// Get gold subscribers for email broadcast
db.subscribers.find({
  categories: 'gold',
  emailVerified: true,
  unsubscribedAt: null,
  'channels.email': true,
});

// Get WhatsApp-eligible gold subscribers
db.subscribers.find({
  categories: 'gold',
  'channels.whatsapp': true,
  'phone.verified': true,
  unsubscribedAt: null,
});

// Find existing subscriber by email
db.subscribers.findOne({ email: 'user@example.com' });

// Stats
db.subscribers.aggregate([
  { $match: { unsubscribedAt: null } },
  { $group: {
      _id: null,
      total: { $sum: 1 },
      verified: { $sum: { $cond: ['$emailVerified', 1, 0] } },
      withPhone: { $sum: { $cond: [{ $ne: ['$phone', null] }, 1, 0] } },
      whatsappReady: { $sum: { $cond: [
        { $and: [{ $ne: ['$phone', null] }, '$phone.verified'] }, 1, 0
      ]}},
  }}
]);
```

---

## 8. `broadcast_log` — Broadcast History

```ts
interface BroadcastLog {
  _id: ObjectId;
  broadcastId: string;        // UUID, groups related sends
  channel: 'email' | 'whatsapp' | 'web-push';
  targetCategories: string[];
  subject?: string;           // Email only
  body: string;
  bodyHtml?: string;

  targetCount: number;        // Snapshot at send time
  deliveryStats: {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
    bounced: number;
  };

  createdBy: string;          // Admin user ID
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

```js
db.broadcast_log.createIndex({ broadcastId: 1 }, { unique: true });
db.broadcast_log.createIndex({ status: 1, scheduledFor: 1 });
db.broadcast_log.createIndex({ createdAt: -1 });
db.broadcast_log.createIndex({ channel: 1, createdAt: -1 });
```

---

## 9. `subscriber_events` — Engagement Timeline

High-volume collection — consider TTL if size becomes issue.

```ts
interface SubscriberEvent {
  _id: ObjectId;
  subscriberId: ObjectId;
  broadcastId?: string;
  event: 'subscribed' | 'verified' | 'unsubscribed'
       | 'email_sent' | 'email_delivered' | 'email_opened' | 'email_clicked' | 'email_bounced'
       | 'whatsapp_sent' | 'whatsapp_delivered' | 'whatsapp_read'
       | 'preferences_updated' | 'phone_verified';
  metadata?: Record<string, any>;
  timestamp: Date;
}
```

### Indexes

```js
db.subscriber_events.createIndex({ subscriberId: 1, timestamp: -1 });
db.subscriber_events.createIndex({ broadcastId: 1, event: 1 });
db.subscriber_events.createIndex({ event: 1, timestamp: -1 });
db.subscriber_events.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }  // 1 year retention
);
```

---

## 10. `alerts` — Price Alerts (Phase 3)

```ts
interface Alert {
  _id: ObjectId;
  userId: string;             // Clerk user ID (Phase 3)
  symbol: string;
  direction: 'above' | 'below' | 'change-percent';
  threshold: number;          // Price or percentage
  active: boolean;
  triggered: boolean;
  triggeredAt?: Date;
  lastCheckedAt: Date;
  channels: ('email' | 'whatsapp' | 'web-push')[];
  repeatable: boolean;        // Re-fire if condition met again
  cooldownSeconds?: number;   // Min time between re-fires
  createdAt: Date;
}
```

### Indexes

```js
db.alerts.createIndex({ userId: 1, active: 1 });
db.alerts.createIndex({ symbol: 1, active: 1 });       // For check-alerts worker
db.alerts.createIndex({ triggered: 1, active: 1 });
```

---

## 11. `blogs` — Blog Post Metadata

Full content lives in MDX files; this collection indexes metadata for queries.

```ts
interface Blog {
  _id: ObjectId;
  slug: string;
  title: string;
  description: string;
  coverImage?: string;
  author: string;
  authorCredentials?: string;
  category: string;           // Primary category
  tags: string[];
  publishedAt: Date;
  updatedAt: Date;
  readTimeMinutes: number;
  wordCount: number;
  hasAffiliateLinks: boolean;  // For disclaimer engine
  viewCount: number;
  featured: boolean;
  status: 'draft' | 'published' | 'archived';
}
```

### Indexes

```js
db.blogs.createIndex({ slug: 1 }, { unique: true });
db.blogs.createIndex({ category: 1, publishedAt: -1 });
db.blogs.createIndex({ tags: 1, publishedAt: -1 });
db.blogs.createIndex({ status: 1, publishedAt: -1 });
db.blogs.createIndex({ featured: 1, publishedAt: -1 });
```

---

## 12. `audit_log` — Admin Action Trail

Critical for security + compliance.

```ts
interface AuditLog {
  _id: ObjectId;
  actorId: string;            // Clerk user ID or 'system'
  actorEmail?: string;
  action: string;              // 'disclaimer.update', 'broadcast.send', 'subscriber.delete'
  resourceType: string;        // 'disclaimer', 'broadcast', 'subscriber'
  resourceId: string;
  before?: any;                // Snapshot before change (redacted of PII)
  after?: any;                 // Snapshot after change
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
```

### Indexes

```js
db.audit_log.createIndex({ actorId: 1, timestamp: -1 });
db.audit_log.createIndex({ resourceType: 1, resourceId: 1, timestamp: -1 });
db.audit_log.createIndex({ action: 1, timestamp: -1 });
db.audit_log.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 * 7 }  // 7 year retention (regulatory)
);
```

---

## 13. `rate_limit_overrides` — Manual Exceptions

```ts
interface RateLimitOverride {
  _id: ObjectId;
  identifier: string;          // IP or user ID
  scope: string;               // 'api:subscribe', 'api:price', etc.
  multiplier: number;          // e.g., 10 = 10× normal limit
  reason: string;              // Why was this granted
  grantedBy: string;
  expiresAt: Date;
  createdAt: Date;
}
```

### Indexes

```js
db.rate_limit_overrides.createIndex({ identifier: 1, scope: 1 });
db.rate_limit_overrides.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });  // TTL
```

---

## 14. Connection Pool Pattern

```ts
// apps/web/lib/mongo.ts
import { MongoClient, Db } from 'mongodb';
import { getWebEnv } from '@shared/env';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getMongo(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const env = getWebEnv();
  if (!cachedClient) {
    cachedClient = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(env.MONGODB_DB_NAME);
  return cachedDb;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await cachedClient?.close();
});
```

---

## 15. Initial Setup Script

Create `scripts/init-db.ts` that runs once:

```ts
import { getMongo } from '../apps/web/lib/mongo';

async function init() {
  const db = await getMongo();

  // 1. Create time-series collections
  const collections = await db.listCollections().toArray();
  const existing = new Set(collections.map(c => c.name));

  if (!existing.has('candles_1m')) {
    await db.createCollection('candles_1m', {
      timeseries: { timeField: 'timestamp', metaField: 'symbol', granularity: 'minutes' },
      expireAfterSeconds: 60 * 60 * 24 * 60,
    });
  }

  if (!existing.has('candles_1h')) {
    await db.createCollection('candles_1h', {
      timeseries: { timeField: 'timestamp', metaField: 'symbol', granularity: 'hours' },
      expireAfterSeconds: 60 * 60 * 24 * 365,
    });
  }

  if (!existing.has('candles_1d')) {
    await db.createCollection('candles_1d', {
      timeseries: { timeField: 'timestamp', metaField: 'symbol', granularity: 'hours' },
    });
  }

  // 2. Create all indexes (idempotent)
  await db.collection('live_prices').createIndex({ symbol: 1 }, { unique: true });
  // ... (all indexes from each section)

  console.log('✅ DB initialized');
}

init().catch(console.error).finally(() => process.exit(0));
```

Run with: `pnpm tsx scripts/init-db.ts`

---

**End of `08-MONGODB-SCHEMAS.md`. Proceed to `09-API-CONTRACTS.md`.**
