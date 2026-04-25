# 📈 23 — Historical Data Backfill (Missing Piece)

**Problem identified:** The architecture only ingests data going forward (every 60s). Users requesting "1 Year" charts on Day 1 would see an empty chart because no historical data exists yet.

**Solution:** One-time backfill script that fetches historical data from MetalpriceAPI's `/timeframe` endpoint before launch. After launch, the live ingestion worker + aggregation jobs maintain continuity.

**When to run:** ONCE, after MongoDB is provisioned, BEFORE Day 1 of the worker starting.

---

## 1. MetalpriceAPI Endpoints Used for Backfill

| Endpoint | Purpose | Limit |
|---|---|---|
| `/timeframe?start_date=X&end_date=Y` | Daily rates between two dates | Max 365 days per call |
| `/hourly?start_date=X&end_date=Y&currency=XAU` | Hourly rates for one symbol | Max 7 days per call (paid tier) |

So for 5 years of daily data: **5 API calls** (one per year). For 90 days of hourly data across 3 metals: **3 symbols × 13 calls = 39 API calls**. Total: **~44 API calls** — well within your Basic Plus monthly quota.

---

## 2. Backfill Coverage Strategy

| Timeframe | Resolution | Source | Why |
|---|---|---|---|
| Last **5 years** | 1 day (candles_1d) | `/timeframe` × 5 calls | 1Y, 5Y chart ranges |
| Last **90 days** | 1 hour (candles_1h) | `/hourly` × many calls | 1M, 3M ranges |
| Last **24 hours** | 1 minute (candles_1m) | Live ingestion from Day 1 | 1D range |

**Storage impact:**
- `candles_1d`: 5 years × 365 days × 3 metals = 5,475 docs → negligible
- `candles_1h`: 90 days × 24h × 3 metals = 6,480 docs → negligible
- All within MongoDB M0 free tier (512MB) — you'll use <1MB

---

## 3. The Backfill Script

Create this file at `apps/worker/scripts/backfill-historical.ts`:

```typescript
// apps/worker/scripts/backfill-historical.ts
import { MongoClient } from 'mongodb';
import { subDays, subYears, addDays, format, isBefore, startOfDay } from 'date-fns';

const API_KEY     = process.env.METALPRICEAPI_KEY!;
const MONGO_URI   = process.env.MONGODB_URI!;
const DB_NAME     = process.env.MONGODB_DB_NAME || 'cip_production';
const API_BASE    = 'https://api.metalpriceapi.com/v1';

const METALS = [
  { symbol: 'gold',   field: 'USDXAU', code: 'XAU' },
  { symbol: 'silver', field: 'USDXAG', code: 'XAG' },
  { symbol: 'copper', field: 'USDXCU', code: 'XCU' },
];

const CURRENCIES_TO_FETCH = 'XAU,XAG,XCU';
const YEARS_BACK = 5;
const HOURLY_DAYS_BACK = 90;

// ─────────────────────────────────────────────────────────────
// PART 1: Daily backfill (5 years)
// ─────────────────────────────────────────────────────────────
async function backfillDaily(db: any) {
  console.log('📅 Starting 5-year daily backfill...');

  const endDate   = new Date();
  const startDate = subYears(endDate, YEARS_BACK);

  // Split into yearly chunks (API max 365 days per request)
  let cursorStart = startDate;
  let totalInserted = 0;

  while (isBefore(cursorStart, endDate)) {
    const chunkEnd = new Date(Math.min(
      addDays(cursorStart, 364).getTime(),
      endDate.getTime()
    ));

    const start = format(cursorStart, 'yyyy-MM-dd');
    const end   = format(chunkEnd, 'yyyy-MM-dd');

    console.log(`  Fetching ${start} → ${end}`);

    const url = `${API_BASE}/timeframe?api_key=${API_KEY}&start_date=${start}&end_date=${end}&base=USD&currencies=${CURRENCIES_TO_FETCH}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`  ❌ Failed: ${res.status}`);
      const errBody = await res.text();
      console.error(errBody);
      cursorStart = addDays(chunkEnd, 1);
      continue;
    }

    const data = await res.json();

    if (!data.success || !data.rates) {
      console.error('  ❌ API returned error:', data.error);
      cursorStart = addDays(chunkEnd, 1);
      continue;
    }

    // data.rates = { "2021-01-01": {USDXAU: 1898.2, USDXAG: ...}, "2021-01-02": {...} }
    const bulkOps: any[] = [];

    for (const [dateStr, rates] of Object.entries(data.rates)) {
      const timestamp = startOfDay(new Date(dateStr));

      for (const metal of METALS) {
        const priceUSDperOz = (rates as any)[metal.field];
        if (!priceUSDperOz || priceUSDperOz <= 0) continue;

        // Historical backfill only has close prices, so open=high=low=close
        // This is acceptable; users who need intraday detail get candles_1h
        bulkOps.push({
          updateOne: {
            filter: { symbol: metal.symbol, timestamp },
            update: {
              $set: {
                symbol:    metal.symbol,
                timestamp,
                open:      priceUSDperOz,
                high:      priceUSDperOz,
                low:       priceUSDperOz,
                close:     priceUSDperOz,
                source:    'metalpriceapi-backfill',
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      const result = await db.collection('candles_1d').bulkWrite(bulkOps);
      totalInserted += result.upsertedCount + result.modifiedCount;
      console.log(`  ✓ Upserted ${bulkOps.length} daily candles`);
    }

    cursorStart = addDays(chunkEnd, 1);

    // Be kind to the API — 1 second delay between calls
    await sleep(1000);
  }

  console.log(`📅 Daily backfill complete. Total upserts: ${totalInserted}\n`);
}

// ─────────────────────────────────────────────────────────────
// PART 2: Hourly backfill (90 days, per symbol)
// ─────────────────────────────────────────────────────────────
async function backfillHourly(db: any) {
  console.log('⏰ Starting 90-day hourly backfill...');

  const endDate   = new Date();
  const startDate = subDays(endDate, HOURLY_DAYS_BACK);

  let totalInserted = 0;

  for (const metal of METALS) {
    console.log(`  Processing ${metal.symbol}...`);

    // Hourly API limit: 7 days per request (paid plan)
    let cursorStart = startDate;

    while (isBefore(cursorStart, endDate)) {
      const chunkEnd = new Date(Math.min(
        addDays(cursorStart, 6).getTime(),
        endDate.getTime()
      ));

      const start = format(cursorStart, 'yyyy-MM-dd');
      const end   = format(chunkEnd, 'yyyy-MM-dd');

      const url = `${API_BASE}/hourly?api_key=${API_KEY}&currency=${metal.code}&start_date=${start}&end_date=${end}&base=USD`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  ❌ ${metal.symbol} ${start}→${end} failed: ${res.status}`);
        cursorStart = addDays(chunkEnd, 1);
        continue;
      }

      const data = await res.json();

      if (!data.success || !data.rates) {
        cursorStart = addDays(chunkEnd, 1);
        continue;
      }

      // data.rates is an ARRAY for hourly: [{timestamp, rates: {USDXAU: 2020.5}}, ...]
      const bulkOps: any[] = [];

      for (const entry of data.rates) {
        const timestamp = new Date(entry.timestamp * 1000);
        const priceUSDperOz = entry.rates[metal.field];
        if (!priceUSDperOz || priceUSDperOz <= 0) continue;

        bulkOps.push({
          updateOne: {
            filter: { symbol: metal.symbol, timestamp },
            update: {
              $set: {
                symbol:    metal.symbol,
                timestamp,
                open:      priceUSDperOz,
                high:      priceUSDperOz,
                low:       priceUSDperOz,
                close:     priceUSDperOz,
                source:    'metalpriceapi-backfill',
              },
            },
            upsert: true,
          },
        });
      }

      if (bulkOps.length > 0) {
        const result = await db.collection('candles_1h').bulkWrite(bulkOps);
        totalInserted += result.upsertedCount + result.modifiedCount;
        console.log(`  ✓ ${metal.symbol} ${start}: ${bulkOps.length} hourly candles`);
      }

      cursorStart = addDays(chunkEnd, 1);
      await sleep(1000);
    }
  }

  console.log(`⏰ Hourly backfill complete. Total upserts: ${totalInserted}\n`);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 CIP-2026 Historical Backfill Starting\n');

  // Safety check — prevent accidental re-run
  if (!process.env.CONFIRM_BACKFILL) {
    console.log('⚠️  This will consume ~45 API calls from your MetalpriceAPI quota.');
    console.log('    Re-run with: CONFIRM_BACKFILL=yes pnpm tsx backfill-historical.ts\n');
    process.exit(0);
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // Ensure collections exist with proper time-series config
  const existing = await db.listCollections().toArray();
  if (!existing.find(c => c.name === 'candles_1d')) {
    console.log('Creating candles_1d time-series collection...');
    await db.createCollection('candles_1d', {
      timeseries: { timeField: 'timestamp', metaField: 'symbol', granularity: 'hours' },
    });
  }
  if (!existing.find(c => c.name === 'candles_1h')) {
    console.log('Creating candles_1h time-series collection...');
    await db.createCollection('candles_1h', {
      timeseries: { timeField: 'timestamp', metaField: 'symbol', granularity: 'hours' },
      expireAfterSeconds: 365 * 24 * 60 * 60,
    });
  }

  try {
    await backfillDaily(db);
    await backfillHourly(db);

    // Print final stats
    const dailyCount  = await db.collection('candles_1d').countDocuments();
    const hourlyCount = await db.collection('candles_1h').countDocuments();

    console.log('✅ BACKFILL COMPLETE');
    console.log(`   candles_1d: ${dailyCount} documents`);
    console.log(`   candles_1h: ${hourlyCount} documents`);
    console.log('\n📊 Your 1Y and 5Y charts are now ready for users.');
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

main();
```

---

## 4. How to Run the Backfill

```bash
# SSH into Hetzner server
ssh deploy@YOUR_SERVER_IP

# Go to worker directory
cd /home/deploy/apps/cip-2026/apps/worker

# First, do a dry run (shows warning only)
pnpm tsx scripts/backfill-historical.ts

# Confirmed? Run for real:
CONFIRM_BACKFILL=yes pnpm tsx scripts/backfill-historical.ts
```

Expected output:
```
🚀 CIP-2026 Historical Backfill Starting

📅 Starting 5-year daily backfill...
  Fetching 2021-04-23 → 2022-04-22
  ✓ Upserted 1095 daily candles  (3 metals × 365 days)
  Fetching 2022-04-23 → 2023-04-22
  ✓ Upserted 1095 daily candles
  ...
📅 Daily backfill complete. Total upserts: 5475

⏰ Starting 90-day hourly backfill...
  Processing gold...
  ✓ gold 2026-01-23: 168 hourly candles
  ...
⏰ Hourly backfill complete. Total upserts: 6480

✅ BACKFILL COMPLETE
   candles_1d: 5475 documents
   candles_1h: 6480 documents

📊 Your 1Y and 5Y charts are now ready for users.
```

Takes about **3–5 minutes** total. Uses approximately 44 MetalpriceAPI requests.

---

## 5. Updated Chart Request Flow (Complete)

```
User requests /api/candles/gold?range=1Y
            ↓
      Upstash Redis
      candles:gold:1Y  (6h TTL)
            ↓
        MISS → MongoDB candles_1d
               .find({
                 symbol: 'gold',
                 timestamp: { $gte: oneYearAgo }
               })
               .sort({ timestamp: 1 })
            ↓
      5 years of data available ✅
      (from backfill, not live)
            ↓
      Backfill Redis → Return to user
```

---

## 6. Range-to-Collection Mapping

| User selects | Collection to query | Data available from Day 1 |
|---|---|---|
| `1D` | `candles_1m` | Only today's ticks (live) |
| `7D` | `candles_1h` | Last 7 days from hourly backfill |
| `1M` | `candles_1h` | Last 30 days from hourly backfill |
| `3M` | `candles_1h` | Last 90 days from hourly backfill |
| `1Y` | `candles_1d` | Last 1 year from daily backfill |
| `5Y` | `candles_1d` | Last 5 years from daily backfill |

Updated API route pseudo-code:

```typescript
// apps/web/app/api/candles/[symbol]/route.ts

const RANGE_CONFIG = {
  '1D':  { collection: 'candles_1m', daysBack: 1 },
  '7D':  { collection: 'candles_1h', daysBack: 7 },
  '1M':  { collection: 'candles_1h', daysBack: 30 },
  '3M':  { collection: 'candles_1h', daysBack: 90 },
  '1Y':  { collection: 'candles_1d', daysBack: 365 },
  '5Y':  { collection: 'candles_1d', daysBack: 365 * 5 },
};

const { collection, daysBack } = RANGE_CONFIG[range];
const cutoff = subDays(new Date(), daysBack);

const candles = await db.collection(collection)
  .find({ symbol, timestamp: { $gte: cutoff } })
  .sort({ timestamp: 1 })
  .toArray();
```

---

## 7. Edge Case: What If User Asks for 5Y on Day 1?

After backfill runs, you have 5 years of data in `candles_1d`. The `5Y` range works immediately.

The only scenario where you'd still see a gap: user asks for `1D` (intraday minute-level) on the very first minute of launch. Even then, the worker writes the first candle within 60 seconds. Not a real problem.

---

## 8. Ongoing Maintenance

After Day 1:

1. **Live ingestion** continues every 60s → writes to `candles_1m`
2. **Hourly aggregation job** (BullMQ cron `0 * * * *`) rolls `candles_1m` → `candles_1h`
3. **Daily aggregation job** (BullMQ cron `0 0 * * *`) rolls `candles_1h` → `candles_1d`
4. **Historical data is preserved forever** — backfilled rows are not deleted

The aggregation jobs are already specified in doc 21 section 5.1 (the worker `index.ts`). They just work.

---

## 9. What Updates Are Needed in Other Docs

### Doc 01 — Architecture Spec
Add this note to section 3.1 (Ingestion flow):
> **Before Day 1:** Run `scripts/backfill-historical.ts` to populate 5 years of daily candles and 90 days of hourly candles. This ensures chart range selectors (1Y, 5Y) work immediately upon launch.

### Doc 09 — API Contracts
Update GET `/api/candles/[symbol]` response spec to include the range-to-collection map from section 6 above.

### Doc 18 — Sprint Plan
Add to Sprint 2 (Week 3-4) Day 0 tasks:
- [ ] Run historical backfill script
- [ ] Verify candles_1d has 5+ years of data
- [ ] Verify candles_1h has 90 days of data
- [ ] Test `/api/candles/gold?range=1Y` returns valid data

### Doc 22 — Forex
Same backfill pattern applies to forex pairs. Create `apps/worker/scripts/backfill-forex-historical.ts` following this template when you add forex in Phase 2.

### CLAUDE.md
Add to ALWAYS rules:
> - ALWAYS run historical backfill before first launch — see doc 23
> - ALWAYS query the correct collection per range (1D→1m, 7D-3M→1h, 1Y+→1d)

---

## 10. Monthly Cost Impact

**Zero.** The backfill consumes ~44 API requests one time only. Your Basic Plus plan has 50,000/month. It fits easily within the first day of launch and never runs again.

---

*Document 23 of the CIP-2026 Package — Historical Data Backfill*
*Cross-references: 01, 09, 18, 22 need small updates per section 9 above.*
*Last reviewed: April 23, 2026*
