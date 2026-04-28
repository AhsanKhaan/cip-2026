# 🎭 29 — Mock Data System (Preserve Paid API Quota During Development)

**Problem:** MetalpriceAPI Basic Plus has 50,000 requests/month. During development, hot-reload + retries + tests + Claude Code experiments easily burn 1000+ requests/day. Without mocking, you'll exhaust the quota in a week.

**Solution:** Three-tier mock data strategy that defaults to mocks in development, hits the real API only when explicitly requested, and uses MSW (Mock Service Worker) for tests.

**When to implement:** Day 1 of Sprint 1 — BEFORE any code that calls MetalpriceAPI.

**Last reviewed:** April 23, 2026

---

## 1. The Three-Tier Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│ ENVIRONMENT-BASED MODE SELECTION                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PRICE_DATA_MODE=mock      → 100% mock data (zero API hits)     │
│  PRICE_DATA_MODE=fixture   → Replay last real response (zero)   │
│  PRICE_DATA_MODE=live      → Hits real API (production only)    │
│                                                                  │
│  Default per environment:                                        │
│    - Local dev:    mock                                          │
│    - CI tests:     mock (via MSW)                                │
│    - Staging:      fixture (1 hit per day, replay rest)         │
│    - Production:   live                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Mock Data Structure (Realistic + Deterministic)

Create the mock fixtures based on real API responses you'll capture once:

### 2.1 File Structure

```
apps/worker/src/mocks/
├── metalpriceapi/
│   ├── fixtures/
│   │   ├── latest-success.json          # Real captured response
│   │   ├── latest-quota-exceeded.json   # Error response
│   │   ├── latest-invalid-key.json      # Error response
│   │   ├── timeframe-2024.json          # Historical (for backfill)
│   │   ├── timeframe-2025.json
│   │   └── hourly-7day.json
│   ├── generators/
│   │   ├── walk.ts                      # Random walk generator
│   │   └── seed.ts                      # Deterministic seed
│   └── handlers.ts                      # Strategy switch
│
├── binance/
│   ├── fixtures/
│   │   └── ws-stream-sample.json
│   └── ws-mock.ts                       # WebSocket simulator
│
└── shared/
    ├── price-mode.ts                    # Mode detection
    └── prices.ts                        # Realistic baseline values
```

### 2.2 Capture Real Responses Once (10 API Calls Total)

**This is the only time you spend real quota in dev.** Run this script ONCE:

```bash
# scripts/capture-fixtures.ts (run once)
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_KEY = process.env.METALPRICEAPI_KEY!;
const FIXTURES_DIR = 'apps/worker/src/mocks/metalpriceapi/fixtures';

mkdirSync(FIXTURES_DIR, { recursive: true });

async function capture(name: string, url: string) {
  console.log(`Capturing ${name}...`);
  const res = await fetch(url);
  const data = await res.json();
  const filepath = join(FIXTURES_DIR, `${name}.json`);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`  ✓ Saved to ${filepath}`);
}

async function main() {
  const symbols = 'XAU,XAG,XCU,EUR,GBP,PKR,INR,AED,JPY,CNY';

  await capture('latest-success',
    `https://api.metalpriceapi.com/v1/latest?api_key=${API_KEY}&base=USD&currencies=${symbols}`);

  // Capture timeframe data for last 5 years (5 calls)
  for (let yearOffset = 0; yearOffset < 5; yearOffset++) {
    const end = new Date();
    end.setFullYear(end.getFullYear() - yearOffset);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    await capture(`timeframe-${end.getFullYear()}`,
      `https://api.metalpriceapi.com/v1/timeframe?api_key=${API_KEY}&start_date=${startStr}&end_date=${endStr}&base=USD&currencies=XAU,XAG,XCU`);

    await new Promise(r => setTimeout(r, 1000));
  }

  // Capture hourly for one week (3 calls per metal × 3 = 9, total ~12)
  for (const metal of ['XAU', 'XAG', 'XCU']) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 7);

    await capture(`hourly-${metal.toLowerCase()}`,
      `https://api.metalpriceapi.com/v1/hourly?api_key=${API_KEY}&currency=${metal}&start_date=${start.toISOString().split('T')[0]}&end_date=${end.toISOString().split('T')[0]}&base=USD`);

    await new Promise(r => setTimeout(r, 1000));
  }

  // Capture an error response (intentionally bad key)
  await capture('latest-invalid-key',
    `https://api.metalpriceapi.com/v1/latest?api_key=invalid&base=USD&currencies=XAU`);

  console.log('\n✅ All fixtures captured. Total API calls used: ~16');
  console.log('   These fixtures will replace ALL development API calls forever.');
}

main();
```

Run it:

```bash
pnpm tsx scripts/capture-fixtures.ts
```

**Total quota used: ~16 of your 50,000 monthly requests. One time.**

### 2.3 Commit Fixtures to Git

```bash
git add apps/worker/src/mocks/metalpriceapi/fixtures/
git commit -m "Add MetalpriceAPI fixtures (captured 2026-04-23)"
```

These fixtures power **all** development from this point forward. Refresh once a quarter to keep prices roughly current.

---

## 3. Mock Mode Detection

Create `apps/worker/src/mocks/shared/price-mode.ts`:

```typescript
// apps/worker/src/mocks/shared/price-mode.ts
export type PriceDataMode = 'mock' | 'fixture' | 'live';

export function getPriceDataMode(): PriceDataMode {
  // Explicit override wins
  if (process.env.PRICE_DATA_MODE === 'mock') return 'mock';
  if (process.env.PRICE_DATA_MODE === 'fixture') return 'fixture';
  if (process.env.PRICE_DATA_MODE === 'live') return 'live';

  // Auto-detect by environment
  if (process.env.NODE_ENV === 'test') return 'mock';
  if (process.env.NODE_ENV === 'development') return 'mock';
  if (process.env.VERCEL_ENV === 'preview') return 'fixture';

  // Production: live
  return 'live';
}

export function isLiveMode(): boolean {
  return getPriceDataMode() === 'live';
}

export function logModeOnce() {
  const mode = getPriceDataMode();
  const colors = { mock: '🎭 MOCK', fixture: '📼 FIXTURE', live: '🔴 LIVE API' };
  console.log(`\n${colors[mode]} mode active for MetalpriceAPI\n`);

  if (mode === 'live') {
    console.log('⚠️  This will consume your MetalpriceAPI quota. Set PRICE_DATA_MODE=mock to disable.\n');
  }
}
```

---

## 4. Realistic Mock Generator (Random Walk)

Mocks shouldn't return the same value every time — that hides bugs in chart rendering and aggregation. Use a **deterministic random walk** that mimics real price behavior:

```typescript
// apps/worker/src/mocks/metalpriceapi/generators/walk.ts

const BASELINE_PRICES = {
  USDXAU: 2350.21,   // Gold per oz
  USDXAG: 28.45,     // Silver per oz
  USDXCU: 4.82,      // Copper per pound
  USDEUR: 0.92,      // EUR
  USDGBP: 0.79,      // GBP
  USDPKR: 278.45,    // PKR
  USDINR: 83.12,     // INR
  USDAED: 3.67,      // AED
  USDJPY: 156.34,    // JPY
  USDCNY: 7.24,      // CNY
};

// Volatility (% change per minute, realistic)
const VOLATILITY = {
  USDXAU: 0.0008,    // Gold ±0.08% per tick
  USDXAG: 0.0015,    // Silver ±0.15%
  USDXCU: 0.0010,    // Copper ±0.10%
  USDEUR: 0.0001,    // FX much less volatile
  USDGBP: 0.0001,
  USDPKR: 0.0002,
  USDINR: 0.0001,
  USDAED: 0.00001,   // Pegged to USD
  USDJPY: 0.0001,
  USDCNY: 0.0001,
};

// In-memory state — survives between ticks but resets on restart
const currentPrices: Record<string, number> = { ...BASELINE_PRICES };

/**
 * Generate next tick using random walk.
 * @param symbol - e.g. 'USDXAU'
 * @param seed - optional seed for deterministic output
 */
export function generateTick(symbol: string, seed?: number): number {
  const current = currentPrices[symbol] ?? BASELINE_PRICES[symbol as keyof typeof BASELINE_PRICES];
  const vol = VOLATILITY[symbol as keyof typeof VOLATILITY] ?? 0.001;

  // Random change (use seed if provided for tests)
  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  const change = (random - 0.5) * 2 * vol; // -vol to +vol

  // Mean reversion: pull toward baseline if drifted too far
  const baseline = BASELINE_PRICES[symbol as keyof typeof BASELINE_PRICES];
  const driftPercent = (current - baseline) / baseline;
  const reversion = -driftPercent * 0.01;

  const newPrice = current * (1 + change + reversion);
  currentPrices[symbol] = newPrice;

  return Number(newPrice.toFixed(symbol.includes('XAU') ? 2 : 4));
}

function seededRandom(seed: number): number {
  // Mulberry32 — simple deterministic RNG
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Generate a full latest response in MetalpriceAPI format
 */
export function generateLatestResponse(symbols: string[] = Object.keys(BASELINE_PRICES)) {
  const rates: Record<string, number> = {};

  for (const sym of symbols) {
    rates[sym] = generateTick(sym);
  }

  return {
    success: true,
    timestamp: Math.floor(Date.now() / 1000),
    base: 'USD',
    rates,
  };
}

/**
 * Reset state (use in tests for determinism)
 */
export function resetMockState() {
  Object.assign(currentPrices, BASELINE_PRICES);
}
```

---

## 5. Strategy Switch (Replace Real fetch)

Create `apps/worker/src/mocks/metalpriceapi/handlers.ts`:

```typescript
// apps/worker/src/mocks/metalpriceapi/handlers.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPriceDataMode } from '../shared/price-mode';
import { generateLatestResponse } from './generators/walk';

const FIXTURES_DIR = join(process.cwd(), 'apps/worker/src/mocks/metalpriceapi/fixtures');

interface MetalpriceLatestResponse {
  success: boolean;
  timestamp: number;
  base: string;
  rates: Record<string, number>;
  error?: { code: number; info: string };
}

/**
 * Drop-in replacement for direct fetch calls to MetalpriceAPI.
 * Use this everywhere instead of `fetch(metalpriceUrl)`.
 */
export async function fetchMetalpriceLatest(
  symbols: string[]
): Promise<MetalpriceLatestResponse> {
  const mode = getPriceDataMode();

  // ─── MOCK MODE ───────────────────────────────────
  if (mode === 'mock') {
    return generateLatestResponse(symbols);
  }

  // ─── FIXTURE MODE ────────────────────────────────
  if (mode === 'fixture') {
    const fixturePath = join(FIXTURES_DIR, 'latest-success.json');
    const data = JSON.parse(readFileSync(fixturePath, 'utf-8'));

    // Update timestamp to current so it doesn't look stale
    data.timestamp = Math.floor(Date.now() / 1000);

    // Filter rates to requested symbols
    const filteredRates: Record<string, number> = {};
    for (const sym of symbols) {
      if (data.rates[sym]) filteredRates[sym] = data.rates[sym];
    }

    return { ...data, rates: filteredRates };
  }

  // ─── LIVE MODE ───────────────────────────────────
  const apiKey = process.env.METALPRICEAPI_KEY;
  if (!apiKey) {
    throw new Error('METALPRICEAPI_KEY missing in live mode');
  }

  const url = `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD&currencies=${symbols.join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  // Log quota for monitoring
  const quotaUsed = res.headers.get('X-API-CURRENT');
  const quotaTotal = res.headers.get('X-API-QUOTA');
  if (quotaUsed && quotaTotal) {
    console.log(`MetalpriceAPI quota: ${quotaUsed}/${quotaTotal}`);
  }

  return res.json();
}

/**
 * Same pattern for /timeframe endpoint (used by historical backfill)
 */
export async function fetchMetalpriceTimeframe(
  startDate: string,
  endDate: string,
  currencies: string[]
): Promise<any> {
  const mode = getPriceDataMode();

  if (mode === 'mock' || mode === 'fixture') {
    // For historical, use fixtures (mock generator can't fake 5 years)
    const year = endDate.split('-')[0];
    const fixturePath = join(FIXTURES_DIR, `timeframe-${year}.json`);
    try {
      return JSON.parse(readFileSync(fixturePath, 'utf-8'));
    } catch {
      // Fallback to most recent fixture if year not captured
      return JSON.parse(readFileSync(join(FIXTURES_DIR, 'timeframe-2025.json'), 'utf-8'));
    }
  }

  // Live mode
  const apiKey = process.env.METALPRICEAPI_KEY!;
  const url = `https://api.metalpriceapi.com/v1/timeframe?api_key=${apiKey}&start_date=${startDate}&end_date=${endDate}&base=USD&currencies=${currencies.join(',')}`;
  const res = await fetch(url);
  return res.json();
}
```

---

## 6. Refactor the Worker to Use the Strategy

In `apps/worker/src/jobs/ingest-metals.ts`, replace direct fetch calls:

```typescript
// ❌ BEFORE (hits API every time)
const url = `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}...`;
const res = await fetch(url);
const data = await res.json();

// ✅ AFTER (mode-aware)
import { fetchMetalpriceLatest } from '../mocks/metalpriceapi/handlers';

const data = await fetchMetalpriceLatest(['XAU', 'XAG', 'XCU', ...FOREX_SYMBOLS]);
// In dev: returns mock data instantly, no quota used
// In prod: hits real API, logs quota
```

---

## 7. Binance WebSocket Mock

For crypto, mock the WebSocket too. Create `apps/worker/src/mocks/binance/ws-mock.ts`:

```typescript
// apps/worker/src/mocks/binance/ws-mock.ts
import { EventEmitter } from 'events';
import { generateTick } from '../metalpriceapi/generators/walk';

const CRYPTO_BASELINES = {
  BTCUSDT: 67450.50,
  ETHUSDT: 3245.80,
};

const CRYPTO_VOLATILITY = {
  BTCUSDT: 0.002,  // ±0.2% per tick
  ETHUSDT: 0.0025,
};

const cryptoState: Record<string, number> = { ...CRYPTO_BASELINES };

/**
 * Simulates Binance WebSocket — emits price ticks every 2 seconds
 * Drop-in replacement for the `ws` library client.
 */
export class MockBinanceWebSocket extends EventEmitter {
  readyState: number = 0;
  private interval: NodeJS.Timeout | null = null;

  constructor(public url: string) {
    super();

    // Simulate connection delay
    setTimeout(() => {
      this.readyState = 1;
      this.emit('open');
      this.startTicking();
    }, 100);
  }

  private startTicking() {
    this.interval = setInterval(() => {
      if (this.readyState !== 1) return;

      // Pick random crypto and emit tick
      const symbol = Math.random() > 0.5 ? 'BTCUSDT' : 'ETHUSDT';
      const baseline = CRYPTO_BASELINES[symbol as keyof typeof CRYPTO_BASELINES];
      const vol = CRYPTO_VOLATILITY[symbol as keyof typeof CRYPTO_VOLATILITY];

      const change = (Math.random() - 0.5) * 2 * vol;
      const driftPercent = (cryptoState[symbol] - baseline) / baseline;
      const reversion = -driftPercent * 0.01;

      cryptoState[symbol] = cryptoState[symbol] * (1 + change + reversion);

      // Format like Binance miniTicker
      const message = JSON.stringify({
        stream: `${symbol.toLowerCase()}@miniTicker`,
        data: {
          e: '24hrMiniTicker',
          E: Date.now(),
          s: symbol,
          c: cryptoState[symbol].toFixed(2),
          o: (cryptoState[symbol] * 0.99).toFixed(2),
          h: (cryptoState[symbol] * 1.01).toFixed(2),
          l: (cryptoState[symbol] * 0.98).toFixed(2),
          v: (Math.random() * 1000).toFixed(2),
        },
      });

      this.emit('message', Buffer.from(message));
    }, 2000); // Every 2 seconds
  }

  ping() {
    // Simulate pong
    setTimeout(() => this.emit('pong'), 50);
  }

  close() {
    if (this.interval) clearInterval(this.interval);
    this.readyState = 3;
    this.emit('close', 1000, Buffer.from('Mock close'));
  }

  send(_data: string) {
    // No-op in mock
  }
}
```

Update the worker:

```typescript
// apps/worker/src/jobs/ingest-crypto-ws.ts
import WebSocket from 'ws';
import { MockBinanceWebSocket } from '../mocks/binance/ws-mock';
import { getPriceDataMode } from '../mocks/shared/price-mode';

function createBinanceWS(url: string): WebSocket | MockBinanceWebSocket {
  const mode = getPriceDataMode();
  if (mode === 'mock' || mode === 'fixture') {
    console.log('🎭 Using MOCK Binance WebSocket');
    return new MockBinanceWebSocket(url);
  }
  return new WebSocket(url);
}

// Use in startCryptoWebSocket():
//   ws = createBinanceWS(WS_URL);  // Instead of new WebSocket(WS_URL)
```

---

## 8. MSW for HTTP-Level Mocking in Tests

For unit/integration tests, use MSW (Mock Service Worker) to intercept HTTP calls **at the network layer** — even more robust than the strategy switch.

### 8.1 Install MSW

```bash
pnpm add -D msw@^2
```

### 8.2 Create MSW Handlers

```typescript
// apps/worker/src/mocks/msw/handlers.ts
import { http, HttpResponse } from 'msw';
import { generateLatestResponse } from '../metalpriceapi/generators/walk';
import latestFixture from '../metalpriceapi/fixtures/latest-success.json';

export const handlers = [
  // Latest endpoint
  http.get('https://api.metalpriceapi.com/v1/latest', ({ request }) => {
    const url = new URL(request.url);
    const apiKey = url.searchParams.get('api_key');
    const currencies = url.searchParams.get('currencies')?.split(',') || [];

    if (apiKey === 'invalid') {
      return HttpResponse.json({
        success: false,
        error: { code: 101, info: 'Invalid API key' },
      });
    }

    const response = generateLatestResponse(currencies.map(c => `USD${c}`));
    return HttpResponse.json(response, {
      headers: {
        'X-API-CURRENT': '5',
        'X-API-QUOTA': '50000',
      },
    });
  }),

  // Timeframe endpoint
  http.get('https://api.metalpriceapi.com/v1/timeframe', () => {
    return HttpResponse.json(require('../metalpriceapi/fixtures/timeframe-2025.json'));
  }),

  // EU regional endpoint
  http.get('https://api-eu.metalpriceapi.com/v1/latest', ({ request }) => {
    const response = generateLatestResponse(['USDXAU', 'USDXAG', 'USDXCU']);
    return HttpResponse.json(response);
  }),

  // Quota exhausted scenario
  http.get('*/quota-exhausted-test', () => {
    return HttpResponse.json({
      success: false,
      error: { code: 105, info: 'Monthly quota exceeded' },
    });
  }),
];
```

### 8.3 Set Up Vitest Integration

```typescript
// apps/worker/vitest.setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './src/mocks/msw/handlers';
import { afterAll, afterEach, beforeAll } from 'vitest';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// apps/worker/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node',
  },
});
```

Now any test that fires HTTP calls to MetalpriceAPI gets MSW responses. **Zero real API hits during tests.**

---

## 9. Environment File Updates

### 9.1 Local Development `.env.local`

```bash
# === Mode (default: mock for dev) ===
PRICE_DATA_MODE=mock

# === Real API Key (KEEP for occasional manual tests) ===
# METALPRICEAPI_KEY=your_real_key
# Don't commit this. Use only when explicitly setting PRICE_DATA_MODE=live

# === Other env vars unchanged ===
MONGODB_URI=...
UPSTASH_REDIS_REST_URL=...
```

### 9.2 Hetzner Worker `/home/deploy/.env`

```bash
# === Production: live mode ===
PRICE_DATA_MODE=live
METALPRICEAPI_KEY=your_real_production_key

# Other vars unchanged
```

### 9.3 Vercel Environment Variables

| Environment | PRICE_DATA_MODE |
|---|---|
| Production | `live` |
| Preview | `fixture` |
| Development (Vercel CLI) | `mock` |

Set these in Vercel Dashboard → Project → Settings → Environment Variables.

---

## 10. Per-Session Override (For Manual Testing)

When you need to test against the real API briefly:

```bash
# One-shot live mode (single command)
PRICE_DATA_MODE=live pnpm dev

# Permanent for current shell session
export PRICE_DATA_MODE=live
pnpm dev
# ... do live testing ...
unset PRICE_DATA_MODE  # Back to default (mock)
```

The mode is logged on every worker startup, so you always know which mode you're in:

```
🎭 MOCK mode active for MetalpriceAPI

   No real API calls will be made.
   Set PRICE_DATA_MODE=live for production testing.
```

---

## 11. Daily Quota Tracker (Production Safeguard)

Even in production, add a circuit breaker. If quota exceeds 95%, switch to fixture mode automatically:

```typescript
// apps/worker/src/mocks/metalpriceapi/quota-circuit-breaker.ts
let isThrottled = false;

export function checkQuota(used: number, total: number) {
  const usagePercent = used / total;

  if (usagePercent > 0.95 && !isThrottled) {
    console.error('🚨 CRITICAL: API quota >95%, falling back to fixtures');
    process.env.PRICE_DATA_MODE = 'fixture';
    isThrottled = true;

    // Send admin alert
    fetch(process.env.ALERT_WEBHOOK_URL!, {
      method: 'POST',
      body: JSON.stringify({
        type: 'quota_exhausted',
        used, total, usagePercent,
      }),
    }).catch(() => {});
  }

  // Auto-recover at start of new month (assume admin upgraded plan)
  if (usagePercent < 0.50 && isThrottled) {
    console.log('✅ Quota recovered, returning to live mode');
    process.env.PRICE_DATA_MODE = 'live';
    isThrottled = false;
  }
}
```

Call this from `fetchMetalpriceLatest` after every live response:

```typescript
const quotaUsed = parseInt(res.headers.get('X-API-CURRENT') || '0');
const quotaTotal = parseInt(res.headers.get('X-API-QUOTA') || '50000');
checkQuota(quotaUsed, quotaTotal);
```

---

## 12. Quota Math (Why This Matters)

**Without mocking:**

| Activity | Hits/Day |
|---|---|
| Hot reload during dev (each save = 1 fetch) | ~50 |
| Manual page refreshes | ~30 |
| Failed API tests retrying | ~20 |
| Claude Code experiments | ~50 |
| CI tests across PRs | ~100 |
| **Total** | **~250/day = 7,500/month** |

You'd burn 15% of your quota on dev alone.

**With mocking (this doc):**

| Activity | Hits/Day |
|---|---|
| Production worker (every 60s) | 1,440 |
| Fixture refresh (quarterly) | ~16 |
| Occasional live debugging | ~10 |
| **Total** | **~1,450/day = 43,500/month** |

Comfortably under 50,000 limit, with headroom for traffic spikes.

---

## 13. CLAUDE.md Additions

```markdown
### Mock Data Rules (CRITICAL)

ALWAYS:
- Default PRICE_DATA_MODE=mock in development and tests
- Use fetchMetalpriceLatest() helper, NEVER direct fetch to MetalpriceAPI
- Use createBinanceWS() helper, NEVER direct WebSocket to Binance
- Use MSW handlers in all Vitest/Playwright tests
- Capture fresh fixtures every 90 days (`pnpm tsx scripts/capture-fixtures.ts`)
- Log mode on worker startup so devs know which mode is active

NEVER:
- Call fetch('https://api.metalpriceapi.com/...') directly anywhere
- Set PRICE_DATA_MODE=live in development without explicit reason
- Commit real API keys to Git (only commit fixtures)
- Skip the mock layer because "it's just a quick test"
- Use real API in CI — always MSW
```

---

## 14. Implementation Checklist (Sprint 1)

- [ ] Create folder `apps/worker/src/mocks/`
- [ ] Run `capture-fixtures.ts` ONCE to grab real responses
- [ ] Commit fixtures to Git
- [ ] Implement `price-mode.ts` mode detection
- [ ] Implement `walk.ts` random walk generator
- [ ] Implement `handlers.ts` strategy switch
- [ ] Implement `MockBinanceWebSocket`
- [ ] Refactor `ingest-metals.ts` to use `fetchMetalpriceLatest()`
- [ ] Refactor `ingest-crypto-ws.ts` to use `createBinanceWS()`
- [ ] Refactor `backfill-historical.ts` to use `fetchMetalpriceTimeframe()`
- [ ] Install MSW v2
- [ ] Create MSW handlers in `apps/worker/src/mocks/msw/handlers.ts`
- [ ] Set up `vitest.setup.ts` with MSW
- [ ] Add `PRICE_DATA_MODE=mock` to `.env.local`
- [ ] Add `PRICE_DATA_MODE=live` to Hetzner production env
- [ ] Add `PRICE_DATA_MODE` to Vercel env vars (live in prod, fixture in preview)
- [ ] Implement quota circuit breaker in production
- [ ] Add startup logging that announces current mode
- [ ] Update CLAUDE.md with new rules
- [ ] Update doc 21 (Hetzner) section to reflect mode env var
- [ ] Update doc 22 (MetalpriceAPI) to reference mock layer
- [ ] Update doc 23 (Backfill) to use mock fixtures by default
- [ ] Test: run `pnpm dev` — verify "🎭 MOCK mode active" appears
- [ ] Test: run `pnpm test` — verify zero real API calls
- [ ] Test: temporarily set live mode — verify quota header logging works

---

## 15. Cost Impact

**Direct cost:** $0 (MSW is free, fixtures are free, generator is free)

**Indirect savings:**
- Before: ~7,500 dev hits/month — risk of quota exhaustion before launch
- After: ~16 dev hits/month — 99.8% reduction in dev quota usage

**Time savings:**
- Mock data is instant (no network) → tests run 50× faster
- No "API rate limited" errors blocking development
- Deterministic seeds make bug reproduction trivial

---

## 16. What This Doesn't Mock

Be aware: this strategy mocks **MetalpriceAPI** and **Binance**. The following remain real even in dev:

| Service | Why Not Mocked |
|---|---|
| MongoDB Atlas | Free tier; not a quota concern |
| Upstash Redis | Free tier; not a quota concern |
| Clerk | Free up to 10K MAU |
| Resend | Use test domain `onresend.dev` for dev — free, doesn't actually send |

If you want to fully offline-test, you can add MongoDB Memory Server and Redis Memory Server to Vitest setup — see `12-TESTING-STRATEGY.md` for details.

---

## 17. Cross-references

This doc supersedes/updates:

| Doc | What changes |
|---|---|
| `01-ARCHITECTURE-SPEC.md` | Add mock layer to ingestion diagram |
| `12-TESTING-STRATEGY.md` | Reference MSW setup here |
| `17-CLAUDE-AGENT-FILES.md` | Add Mock Data Rules to CLAUDE.md |
| `21-HETZNER-VPS-IMPLEMENTATION.md` | Add `PRICE_DATA_MODE=live` to worker env |
| `22-METALPRICEAPI-FIX-FOREX-YMYL.md` | Use `fetchMetalpriceLatest()` instead of direct fetch |
| `23-HISTORICAL-DATA-BACKFILL.md` | Default to fixtures; live mode only with explicit flag |

---

*Document 29 of the CIP-2026 Package — Mock Data System*
*Saves: ~7,500 API requests/month during development*
*Last reviewed: April 23, 2026*
