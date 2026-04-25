# 🔧 22 — MetalpriceAPI Fixes + Forex + Geo-Targeting + YMYL Compliance

**Purpose:** Fix all MetalpriceAPI implementation mistakes, add Currency Converter (Phase 2), target US/UK/Pakistan/India markets legally, and deliver an industry-standard subscription UI (fixing the side-spaces problem).

**Cross-references:** Supersedes any conflicting sections in `01`, `08`, `09`, `14`, `16`.

---

## 1. MetalpriceAPI — Mistakes Found in Previous Docs

### 1.1 Critical Mistakes to Fix

| # | Previous (Wrong) | Correct (Per Official Docs) | Impact |
|---|---|---|---|
| 1 | Ingested every **60 seconds** on Starter plan | Free plan is **daily only** — Basic Plus ($16.99/mo) needed for **60s updates** | Feature promise breaks on free/cheap plans |
| 2 | Said plan was "$30/mo" | Actual plan tiers: Free $0 / Essential $3.99 / Basic $8.99 / **Basic Plus $16.99** / Professional $27.99 | Wrong cost estimate |
| 3 | Used `&symbols=` query param | Correct param is `&currencies=` (comma-separated) | API calls would fail |
| 4 | Used `base=USD` with `rates[XAU]` directly as USD/oz | API returns `XAU` as **inverse** (1 USD = 0.0005 XAU). USD per oz is `USDXAU` field | Prices display inverted/wrong |
| 5 | Not using US vs EU server routing | MetalpriceAPI offers `api.metalpriceapi.com` (US) and `api-eu.metalpriceapi.com` (EU) | Latency hit for global users |
| 6 | No API quota monitoring | Response headers `X-API-CURRENT` and `X-API-QUOTA` should be logged every request | Silent quota exhaustion |
| 7 | Forex (150+ currencies) not included | MetalpriceAPI supports forex for free on all paid plans — no separate API needed | Paying twice for same capability |
| 8 | Used `hourly` endpoint across >2 days on Free | Free tier: max 2 days for hourly. Paid: max 7 days | API errors |
| 9 | No use of built-in Carat endpoint for gold variants (18k/22k/24k) | Native `/carat` endpoint exists on paid plans — handles 24k/23k/22k/18k/14k calculations | Reinventing the wheel |
| 10 | Used `&math=` operations for premium calculations on free tier | `&math` parameter exists but is only documented usage — no explicit tier restriction, but safest to calculate locally for free tier users | Portability |

### 1.2 Corrected API Call Pattern

```typescript
// ❌ WRONG (previous doc):
const url = `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&symbols=XAU,XAG,XCU`;
const price = data.rates.XAU; // This is INVERSE — wrong!

// ✅ CORRECT (per official docs):
const url = `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=XAU,XAG,XCU`;
const priceGoldUSDperOz = data.rates.USDXAU; // USD per troy oz of gold
const priceSilverUSDperOz = data.rates.USDXAG;
const priceCopperUSDperOz = data.rates.USDXCU;

// For forex (Phase 2):
const forexUrl = `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=EUR,GBP,PKR,INR,AED,JPY`;
const usdToPkr = data.rates.USDPKR; // 1 USD = X PKR
const usdToInr = data.rates.USDINR;
```

### 1.3 Recommended Plan Selection

Given your requirement for **60-second live updates**:

| Tier | Cost/mo | Update Freq | Good For |
|---|---|---|---|
| Free | $0 | Daily only | ❌ Not viable — kills "live price" promise |
| Essential | $3.99 | 30 min | ❌ Still too slow for "live" |
| Basic | $8.99 | 10 min | ⚠️ Acceptable only if you disable ticker pulse |
| **Basic Plus** | **$16.99** | **60 sec** | ✅ **Recommended for launch** |
| Professional | $27.99 | 60 sec | If you need >50K requests/mo |

**Recommended start:** Basic Plus at $16.99/mo (vs original incorrect estimate of $30). That's 50,000 requests/month = enough for 60-second polling 24/7 across metals + forex.

**Monthly requests math (60s polling):**
- Metals ingestion (XAU, XAG, XCU in one call): 1 request every 60s = 43,200/month
- Forex ingestion (20 currencies in one call, every 5 min): 8,640/month
- **Total: ~52,000/month** → Basic Plus (50K) is borderline. Upgrade to Professional ($27.99, 100K) for headroom.

### 1.4 Corrected Ingestion Code

```typescript
// apps/worker/src/jobs/ingest-metals.ts — CORRECTED VERSION

const METALS_ENDPOINT = process.env.METALPRICEAPI_REGION === 'eu'
  ? 'https://api-eu.metalpriceapi.com/v1/latest'
  : 'https://api.metalpriceapi.com/v1/latest';

const METAL_SYMBOLS = 'XAU,XAG,XCU' as const;
const FOREX_SYMBOLS = 'EUR,GBP,PKR,INR,AED,JPY,AUD,CAD,CHF,CNY,SGD,HKD,SAR,QAR,KWD,OMR,BHD,THB,MYR,IDR' as const;

export async function ingestMetals(job: Job) {
  const traceId = `ingest-${Date.now()}`;
  const log = logger.child({ traceId, job: 'ingest-metals' });
  const apiKey = process.env.METALPRICEAPI_KEY!;

  const url = `${METALS_ENDPOINT}?api_key=${apiKey}&base=USD&currencies=${METAL_SYMBOLS},${FOREX_SYMBOLS}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  // ─── CRITICAL: Log quota headers ───────────
  const quotaUsed = response.headers.get('X-API-CURRENT');
  const quotaTotal = response.headers.get('X-API-QUOTA');
  log.info({ quotaUsed, quotaTotal }, 'API quota status');
  if (quotaTotal && quotaUsed && parseInt(quotaUsed) / parseInt(quotaTotal) > 0.8) {
    log.warn({ quotaUsed, quotaTotal }, '⚠️ API quota above 80% — alert admin');
  }

  const data = await response.json();

  if (!data.success) {
    // Check for known error codes
    const errorCode = data.error?.code;
    if (errorCode === 105) log.error('Monthly quota exceeded — upgrade plan');
    if (errorCode === 104) log.warn('Rate limit hit — will retry');
    throw new Error(`MetalpriceAPI error ${errorCode}: ${data.error?.info}`);
  }

  const db = await getMongo();
  const redis = getRedis();
  const now = new Date();
  const minuteFloor = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

  // ─── METALS: USD per troy ounce ───────────
  const metals = [
    { symbol: 'gold',   field: 'USDXAU' },
    { symbol: 'silver', field: 'USDXAG' },
    { symbol: 'copper', field: 'USDXCU' },
  ];

  for (const m of metals) {
    const priceUSDperOz = data.rates[m.field]; // ✅ Use USD-prefixed field
    if (!priceUSDperOz || priceUSDperOz <= 0) {
      log.warn({ symbol: m.symbol }, 'Invalid price — skipping');
      continue;
    }

    await db.collection('live_prices').updateOne(
      { symbol: m.symbol },
      {
        $set: {
          symbol: m.symbol,
          priceUSDperOz,
          priceUSDperGram: priceUSDperOz / 31.1035,  // 1 oz = 31.1035g
          priceUSDperTola:  priceUSDperOz * 0.375,    // 1 tola = 11.664g = 0.375 oz
          priceUSDperKg:    priceUSDperOz * 32.1507,
          timestamp: now,
          source: 'metalpriceapi',
        },
      },
      { upsert: true }
    );

    await db.collection('candles_1m').updateOne(
      { symbol: m.symbol, timestamp: minuteFloor },
      {
        $setOnInsert: { open: priceUSDperOz },
        $max:         { high: priceUSDperOz },
        $min:         { low:  priceUSDperOz },
        $set:         { close: priceUSDperOz, symbol: m.symbol, timestamp: minuteFloor },
      },
      { upsert: true }
    );

    await redis.set(`price:${m.symbol}`, JSON.stringify({
      price: priceUSDperOz,
      timestamp: now,
    }), { ex: 30 });
  }

  // ─── FOREX: 20 world currencies ───────────
  const forexCodes = FOREX_SYMBOLS.split(',');
  const forexBulk = forexCodes.map(code => {
    const rate = data.rates[`USD${code}`]; // 1 USD = X foreign
    return {
      updateOne: {
        filter: { code },
        update: {
          $set: {
            code,
            usdRate: rate,
            inverseRate: 1 / rate,
            timestamp: now,
            source: 'metalpriceapi',
          },
        },
        upsert: true,
      },
    };
  });
  if (forexBulk.length > 0) {
    await db.collection('forex_rates').bulkWrite(forexBulk);
  }

  // ─── Trigger Vercel ISR revalidation ───────────
  await triggerRevalidation(['price-gold', 'price-silver', 'price-copper', 'forex'], log);

  log.info({ metalsCount: 3, forexCount: forexCodes.length }, 'Ingestion complete');
}
```

---

## 2. Currency Converter Feature (Phase 2)

### 2.1 MongoDB Schemas — New Collections

```typescript
// ── 1. forex_rates — Current forex snapshots ──
interface ForexRate {
  _id: ObjectId;
  code: string;              // ISO 4217: 'USD' | 'EUR' | 'PKR' | 'INR' | ...
  usdRate: number;           // 1 USD = X of this currency (rates.USD[code])
  inverseRate: number;       // 1 [code] = X USD (1 / usdRate)
  change24h?: number;
  changePercent24h?: number;
  timestamp: Date;
  source: 'metalpriceapi';
}

// Indexes
db.forex_rates.createIndex({ code: 1 }, { unique: true });
db.forex_rates.createIndex({ timestamp: -1 });

// ── 2. forex_candles_1h — Hourly OHLC per currency ──
// Time-Series collection — same pattern as metals candles
db.createCollection('forex_candles_1h', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'code',
    granularity: 'hours',
  },
  expireAfterSeconds: 365 * 24 * 60 * 60,  // 1 year retention
});

// ── 3. forex_candles_1d — Daily OHLC, forever ──
db.createCollection('forex_candles_1d', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'code',
    granularity: 'days',
  },
});

// ── 4. currencies_meta — Display config per currency ──
interface CurrencyMeta {
  _id: ObjectId;
  code: string;              // 'PKR'
  name: string;              // 'Pakistani Rupee'
  symbol: string;            // '₨' or 'Rs'
  flag: string;              // '🇵🇰'
  country: string;           // 'Pakistan'
  region: 'asia' | 'europe' | 'america' | 'africa' | 'oceania' | 'middle-east';
  isActive: boolean;
  displayOrder: number;      // For sorting in UI
  seoPriority: number;       // 1-10: which currency pages get auto-gen SEO
}

db.currencies_meta.createIndex({ code: 1 }, { unique: true });
db.currencies_meta.createIndex({ region: 1, displayOrder: 1 });

// ── 5. conversion_log — User conversion history (anonymous) ──
// For analytics, SEO content generation ("top conversions this week")
interface ConversionLog {
  _id: ObjectId;
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  timestamp: Date;
  country?: string;          // From IP geolocation (for geo-analytics)
  userAgent?: 'web' | 'mobile' | 'api';
}
db.createCollection('conversion_log', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'from',
    granularity: 'hours',
  },
  expireAfterSeconds: 90 * 24 * 60 * 60,  // 90-day retention (GDPR-friendly)
});
```

### 2.2 Seed Data: Top 30 Currencies

```typescript
// scripts/seed-currencies.ts
const CURRENCIES = [
  // Target markets (seoPriority 10)
  { code: 'USD', name: 'US Dollar',          symbol: '$',   flag: '🇺🇸', country: 'United States', region: 'america', seoPriority: 10 },
  { code: 'GBP', name: 'British Pound',      symbol: '£',   flag: '🇬🇧', country: 'United Kingdom', region: 'europe', seoPriority: 10 },
  { code: 'PKR', name: 'Pakistani Rupee',    symbol: '₨',   flag: '🇵🇰', country: 'Pakistan', region: 'asia', seoPriority: 10 },
  { code: 'INR', name: 'Indian Rupee',       symbol: '₹',   flag: '🇮🇳', country: 'India', region: 'asia', seoPriority: 10 },

  // Major world (seoPriority 8)
  { code: 'EUR', name: 'Euro',               symbol: '€',   flag: '🇪🇺', country: 'Eurozone', region: 'europe', seoPriority: 8 },
  { code: 'JPY', name: 'Japanese Yen',       symbol: '¥',   flag: '🇯🇵', country: 'Japan', region: 'asia', seoPriority: 8 },
  { code: 'CNY', name: 'Chinese Yuan',       symbol: '¥',   flag: '🇨🇳', country: 'China', region: 'asia', seoPriority: 8 },
  { code: 'AUD', name: 'Australian Dollar',  symbol: 'A$',  flag: '🇦🇺', country: 'Australia', region: 'oceania', seoPriority: 8 },
  { code: 'CAD', name: 'Canadian Dollar',    symbol: 'C$',  flag: '🇨🇦', country: 'Canada', region: 'america', seoPriority: 8 },
  { code: 'CHF', name: 'Swiss Franc',        symbol: 'CHF', flag: '🇨🇭', country: 'Switzerland', region: 'europe', seoPriority: 8 },

  // Gulf/South Asian diaspora (seoPriority 9 — your target audience)
  { code: 'AED', name: 'UAE Dirham',         symbol: 'د.إ', flag: '🇦🇪', country: 'UAE', region: 'middle-east', seoPriority: 9 },
  { code: 'SAR', name: 'Saudi Riyal',        symbol: '﷼',   flag: '🇸🇦', country: 'Saudi Arabia', region: 'middle-east', seoPriority: 9 },
  { code: 'QAR', name: 'Qatari Riyal',       symbol: '﷼',   flag: '🇶🇦', country: 'Qatar', region: 'middle-east', seoPriority: 9 },
  { code: 'KWD', name: 'Kuwaiti Dinar',      symbol: 'د.ك', flag: '🇰🇼', country: 'Kuwait', region: 'middle-east', seoPriority: 9 },
  { code: 'OMR', name: 'Omani Rial',         symbol: '﷼',   flag: '🇴🇲', country: 'Oman', region: 'middle-east', seoPriority: 9 },
  { code: 'BHD', name: 'Bahraini Dinar',     symbol: 'د.ب', flag: '🇧🇭', country: 'Bahrain', region: 'middle-east', seoPriority: 9 },

  // ASEAN
  { code: 'SGD', name: 'Singapore Dollar',   symbol: 'S$',  flag: '🇸🇬', country: 'Singapore', region: 'asia', seoPriority: 7 },
  { code: 'MYR', name: 'Malaysian Ringgit',  symbol: 'RM',  flag: '🇲🇾', country: 'Malaysia', region: 'asia', seoPriority: 7 },
  { code: 'THB', name: 'Thai Baht',          symbol: '฿',   flag: '🇹🇭', country: 'Thailand', region: 'asia', seoPriority: 7 },
  { code: 'IDR', name: 'Indonesian Rupiah',  symbol: 'Rp',  flag: '🇮🇩', country: 'Indonesia', region: 'asia', seoPriority: 7 },
  { code: 'HKD', name: 'Hong Kong Dollar',   symbol: 'HK$', flag: '🇭🇰', country: 'Hong Kong', region: 'asia', seoPriority: 7 },
];
```

### 2.3 Conversion API Contract

```typescript
// GET /api/convert?from=USD&to=PKR&amount=100
// Response:
{
  success: true,
  query: { from: 'USD', to: 'PKR', amount: 100 },
  result: 27845.50,
  rate: 278.4550,
  inverseRate: 0.003592,
  timestamp: '2026-04-23T12:34:56Z',
  disclaimer: 'Rates for reference only. See /disclaimer/forex',
}

// GET /api/forex/pair/USD-PKR?range=1M
// Returns historical candles for chart
```

---

## 3. Geo-Targeting Website Structure (US / UK / PK / IN)

### 3.1 URL Architecture — Single Domain, Path-Based

You should **NOT** use separate domains per country (e.g., `.co.uk`, `.pk`, `.in`) because:
1. Domain authority splits = harder to rank
2. Backlinks dilute
3. Costs more in infrastructure + SSL + domain renewals
4. Managing multiple CMSes is painful

**Instead, use path-based localization** with Next.js App Router and `hreflang` tags:

```
yourdomain.com/                          → US English (default)
yourdomain.com/uk/                       → UK English
yourdomain.com/pk/                       → Pakistan English + Urdu-friendly
yourdomain.com/in/                       → India English
yourdomain.com/pk/ur/                    → Pakistan Urdu (future Phase 3)
yourdomain.com/in/hi/                    → India Hindi (future Phase 3)
```

### 3.2 Complete Page Tree

```
/ (US home)
├── /gold-price-today                    → Primary US gold page
├── /silver-price-today
├── /copper-price-today
├── /bitcoin-price
├── /ethereum-price
│
├── /uk/
│   ├── /gold-price-today-uk             → "gold price today UK" target
│   ├── /silver-price-today-uk
│   └── /gold-price-per-gram-uk
│
├── /pk/                                 ← TARGET #1
│   ├── /gold-price-today-pakistan       → "gold price today pakistan" target
│   ├── /gold-rate-today-in-pakistan     → Alt keyword variant
│   ├── /silver-price-today-pakistan
│   ├── /gold-rate-karachi
│   ├── /gold-rate-lahore
│   ├── /gold-rate-islamabad
│   ├── /24k-gold-rate-in-pakistan
│   ├── /22k-gold-rate-in-pakistan
│   ├── /21k-gold-rate-in-pakistan
│   ├── /18k-gold-rate-in-pakistan
│   ├── /1-tola-gold-price                → Pakistan/India-specific unit
│   ├── /1-gram-gold-price
│   └── /usd-to-pkr                       → Currency converter landing
│
├── /in/                                 ← TARGET #2
│   ├── /gold-price-today-india          → "gold price today india" target
│   ├── /gold-rate-today-in-india
│   ├── /silver-price-today-india
│   ├── /gold-rate-mumbai
│   ├── /gold-rate-delhi
│   ├── /gold-rate-bangalore
│   ├── /gold-rate-chennai
│   ├── /gold-rate-kolkata
│   ├── /gold-rate-hyderabad
│   ├── /22k-gold-rate-india
│   ├── /24k-gold-rate-india
│   ├── /18k-gold-rate-india
│   ├── /gold-price-per-tola-india
│   ├── /gold-price-per-gram-india
│   └── /usd-to-inr
│
├── /forex/                              ← NEW: Currency converter hub
│   ├── /currency-converter               → Main calculator
│   ├── /usd-to-pkr                       → 20+ landing pages per pair
│   ├── /usd-to-inr
│   ├── /usd-to-gbp
│   ├── /gbp-to-pkr
│   ├── /gbp-to-inr
│   ├── /eur-to-pkr
│   ├── /aed-to-pkr                       → Remittance keyword (huge volume)
│   ├── /aed-to-inr
│   ├── /sar-to-pkr
│   └── /... (top 30 pairs auto-generated)
│
├── /blog/                               ← YMYL-compliant articles
│   ├── /gold/
│   │   ├── /why-gold-rises-with-inflation
│   │   ├── /difference-between-22k-and-24k-gold
│   │   └── /how-gold-prices-are-determined
│   ├── /silver/
│   ├── /crypto/
│   ├── /forex/                          → Currency/remittance articles
│   │   ├── /what-affects-pkr-to-usd-rate
│   │   ├── /send-money-uae-to-pakistan-guide
│   │   └── /best-time-to-send-remittance
│   └── /guides/
│
├── /faq/                                ← YMYL trust builder
│   ├── /gold-faq
│   ├── /silver-faq
│   ├── /crypto-faq
│   └── /forex-faq
│
├── /about/                              ← E-E-A-T mandatory
├── /editorial-policy/                   ← E-E-A-T mandatory
├── /authors/                            ← E-E-A-T mandatory
│   └── /[author-slug]
├── /contact/
├── /privacy/
├── /terms/
├── /disclaimer/                         ← YMYL mandatory
│   ├── /general
│   ├── /financial-disclaimer
│   ├── /gold-disclaimer
│   ├── /crypto-disclaimer
│   └── /forex-disclaimer
│
└── /admin/                              (Clerk + MFA protected)
    ├── /cms
    ├── /logs
    ├── /security
    └── /broadcast
```

### 3.3 Keyword Targeting Per Page

| Page | Primary Keyword | Search Volume (approx) | Difficulty |
|---|---|---|---|
| `/pk/gold-price-today-pakistan` | "gold price today pakistan" | 165K/mo | Medium |
| `/pk/gold-rate-today-in-pakistan` | "gold rate today in pakistan" | 135K/mo | Medium |
| `/pk/22k-gold-rate-in-pakistan` | "22k gold rate in pakistan" | 33K/mo | Low-Medium |
| `/pk/gold-rate-karachi` | "gold rate karachi" | 27K/mo | Low |
| `/pk/1-tola-gold-price` | "1 tola gold price" | 74K/mo | Medium |
| `/in/gold-price-today-india` | "gold price today india" | 246K/mo | High |
| `/in/gold-rate-today-in-india` | "gold rate today in india" | 201K/mo | High |
| `/in/22k-gold-rate-india` | "22k gold rate today" | 110K/mo | Medium |
| `/in/gold-rate-mumbai` | "gold rate mumbai" | 49K/mo | Low-Medium |
| `/forex/aed-to-pkr` | "aed to pkr" | 246K/mo | Low |
| `/forex/aed-to-inr` | "aed to inr" | 165K/mo | Low |

---

## 4. hreflang + Geo SEO Setup

### 4.1 `hreflang` Implementation (Required)

Add to every localized page's `<head>`:

```tsx
// app/[locale]/gold/page.tsx or similar
import type { Metadata } from 'next';

export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `https://yourdomain.com/${locale}/gold-price-today-${locale}`,
      languages: {
        'en-US': 'https://yourdomain.com/gold-price-today',
        'en-GB': 'https://yourdomain.com/uk/gold-price-today-uk',
        'en-PK': 'https://yourdomain.com/pk/gold-price-today-pakistan',
        'en-IN': 'https://yourdomain.com/in/gold-price-today-india',
        'x-default': 'https://yourdomain.com/gold-price-today',
      },
    },
  };
}
```

### 4.2 Geo-Detection Middleware (Optional — Don't Auto-Redirect!)

**Google penalizes forced redirects.** Show a banner suggesting the local version instead:

```tsx
// components/LocaleBanner.tsx
'use client';
import { useEffect, useState } from 'react';

export function LocaleBanner() {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/geo').then(r => r.json()).then(data => {
      const currentPath = window.location.pathname;
      if (data.country === 'PK' && !currentPath.startsWith('/pk/')) setSuggestion('/pk/');
      if (data.country === 'IN' && !currentPath.startsWith('/in/')) setSuggestion('/in/');
      if (data.country === 'GB' && !currentPath.startsWith('/uk/')) setSuggestion('/uk/');
    });
  }, []);
  if (!suggestion) return null;
  return <div className="sticky top-0 bg-gold/10 p-3 text-center">
    You appear to be browsing from another region. <a href={suggestion} className="underline">View local prices →</a>
    <button onClick={() => setSuggestion(null)}>×</button>
  </div>;
}
```

---

## 5. YMYL / Google Policy Compliance (No Legal Risk)

Finance pages are **YMYL (Your Money or Your Life)** — Google's strictest category. Financial content requires verifiable expertise. Anonymous finance blogs without regulatory disclosures get suppressed after core updates.

### 5.1 Mandatory Pages (E-E-A-T Baseline)

| Page | What It Proves | Minimum Content |
|---|---|---|
| `/about` | Who runs this site | Founder name + photo, real business address, legal entity name, year founded |
| `/editorial-policy` | How content is created | Source list (LBMA, NY Fed, RBI, SBP), fact-check process, update cadence, AI disclosure |
| `/authors/[slug]` | Who wrote each article | Full name, photo, credentials, LinkedIn link, published date of each article |
| `/disclaimer/financial` | Legal protection | "Not financial advice", consult licensed advisor, jurisdictional variation |
| `/contact` | Real business | Email, physical mailing address, response SLA |
| `/privacy` | GDPR/CCPA compliant | Data collected, cookies, third parties, user rights, DPO contact |
| `/terms` | User agreement | Liability limits, governing law, arbitration clause |

### 5.2 Disclaimer Template (Financial — YMYL-compliant)

```markdown
## Financial Information Disclaimer

**Last reviewed:** 2026-04-23 by [Author Name], [Credentials]

The information on this page, including precious metal prices, cryptocurrency
quotes, and forex rates, is provided **for informational purposes only** and
is **not** financial, investment, tax, or legal advice.

### What we do
- Source rates from regulated data providers (LBMA Gold Price, regulated exchanges,
  central bank rates via MetalpriceAPI licensed feeds).
- Update prices every 60 seconds during market hours.
- Publish market commentary reviewed by our editorial team.

### What we don't do
- We do not operate as a registered investment advisor or broker-dealer.
- We do not offer personalized recommendations.
- We do not guarantee price accuracy, timeliness, or completeness.

### Before making decisions
Consult a licensed financial advisor registered in your jurisdiction:
- **United States:** SEC-registered investment adviser or FINRA broker
- **United Kingdom:** FCA-authorized firm (fca.org.uk/register)
- **Pakistan:** SECP-registered intermediary (secp.gov.pk)
- **India:** SEBI-registered investment adviser (sebi.gov.in)

### Liability
We disclaim all liability for losses arising from the use of information
presented on this site to the fullest extent permitted by applicable law.

Prices may be delayed. Spot prices may differ from dealer/retailer prices
due to premiums, taxes, and local market conditions.
```

### 5.3 Content Rules (Do NOT Violate)

| ❌ NEVER | ✅ ALWAYS |
|---|---|
| "Buy gold now before it's too late" | "Gold has historically moved with..." |
| "Guaranteed returns" | "Past performance does not indicate..." |
| "Best time to invest in crypto" | "Factors investors consider include..." |
| "You will make money if..." | "Some analysts suggest..." |
| Copy-paste from Kitco, Goldprice.org, Bloomberg | Paraphrase + attribute + link source |
| Scrape real-time prices from competitors | Use licensed APIs (MetalpriceAPI is licensed) |
| Use unauthorized logos (Federal Reserve, central banks) | Use text-only references |
| Claim "we are financial advisors" without registration | "We provide market data, not advice" |

### 5.4 AI-Generated Content Rules

Google's 2026 guidance: AI content is allowed **IF** reviewed by a named expert, enriched with original insights, and attributed to a named author accountable for accuracy.

**For every article:**
1. Author byline with real name (not "Admin")
2. "Reviewed by [Editor Name], [Credentials]" above fold
3. Published date + "Last updated" date (ISO format)
4. At least 2 citations to primary sources (LBMA, SBP, RBI, SEC filings, etc.)
5. "AI-assisted editorial disclosure" footer if applicable

---

## 6. Dynamic JSON-LD System — Complete Templates

### 6.1 Per-Page Schema Types

| Page Type | Schema.org Type | Rich Result |
|---|---|---|
| Price page (gold/silver/copper) | `Product` + `Offer` | Rich price card |
| Currency converter | `WebApplication` | App rich card |
| Currency pair page (USD→PKR) | `WebPage` + `FAQPage` | FAQ rich result |
| Blog article | `Article` + `Person` (author) | Article rich card |
| FAQ page | `FAQPage` | FAQ accordion in SERP |
| Author page | `Person` + `hasCredential` | Knowledge panel eligibility |
| Homepage | `Organization` + `WebSite` + `SearchAction` | Sitelinks + search box |
| About page | `Organization` | Knowledge panel |
| Disclaimer | `WebPage` | — |

### 6.2 Seed Templates (15 Templates for Admin Editor)

#### Template 1: `product-metal-price` (for gold/silver/copper pages)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{product.name}}",
  "description": "{{product.description}}",
  "image": "{{product.imageUrl}}",
  "brand": {
    "@type": "Brand",
    "name": "{{site.name}}"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "{{price.currency}}",
    "price": "{{price.value}}",
    "priceValidUntil": "{{price.validUntil}}",
    "availability": "https://schema.org/InStock",
    "url": "{{page.url}}"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "{{ratings.count}}"
  }
}
```

#### Template 2: `article-blog` (for blog posts)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{post.title}}",
  "description": "{{post.excerpt}}",
  "image": "{{post.featuredImage}}",
  "datePublished": "{{post.publishedAt}}",
  "dateModified": "{{post.updatedAt}}",
  "author": {
    "@type": "Person",
    "name": "{{author.name}}",
    "url": "{{author.url}}",
    "hasCredential": "{{author.credential}}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{{site.name}}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{site.logo}}"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "{{page.url}}"
  }
}
```

#### Template 3: `faq-page`

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{#each faqs}}
    {
      "@type": "Question",
      "name": "{{this.question}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{this.answer}}"
      }
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}
```

#### Template 4: `currency-converter` (for /forex/currency-converter)

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Currency Converter",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Any (Web)",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "featureList": [
    "Real-time exchange rates",
    "150+ world currencies",
    "Historical rate charts",
    "No registration required"
  ]
}
```

#### Template 5: `breadcrumb`

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{#each crumbs}}
    {
      "@type": "ListItem",
      "position": {{@index_plus_1}},
      "name": "{{this.name}}",
      "item": "{{this.url}}"
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}
```

#### Templates 6–15 (summarized; full JSON in admin editor seed):
- `organization` (for /about)
- `website-search` (for homepage sitelinks search box)
- `person-author` (for /authors/[slug])
- `exchange-rate-pair` (for /forex/usd-to-pkr style pages)
- `news-article` (for timely market commentary)
- `how-to` (for guides like "how to read gold charts")
- `video-object` (for tutorial videos)
- `local-business` (for city-specific Pakistan/India pages)
- `review` (for dealer comparisons, if you do them)
- `event` (for market announcements)

### 6.3 Admin Editor Integration (Enhanced from Doc 16)

The CMS editor at `/admin/cms/posts/[id]` exposes a **JSON-LD tab** with:

```
┌──────────────────────────────────────────────────────────┐
│ Meta & Schema                                            │
├──────────────────────────────────────────────────────────┤
│ Meta Title (max 60 chars)     [___________________]      │
│ Meta Description (max 160)    [___________________]      │
│ Canonical URL                 [___________________]      │
│ OG Image                      [Upload] [___________]     │
│ ─────────────────────────────────────────────────────────│
│ JSON-LD Schema                                           │
│   [ Template: ▼ Article - Blog ]    [Use Form Mode]     │
│   ┌────────────────────────────────────────────────┐   │
│   │ { "@context": "https://schema.org", ...       │   │
│   │   ⟨auto-populated from post data⟩              │   │
│   │ }                                              │   │
│   └────────────────────────────────────────────────┘   │
│   [✓ Validate]  [⚡ Test in Google Rich Results]       │
│ ─────────────────────────────────────────────────────────│
│ Preview                                                  │
│   [🌐 Google SERP] [📘 Facebook] [🐦 X]  [💬 WhatsApp] │
└──────────────────────────────────────────────────────────┘
```

Editors can:
1. Pick template from dropdown → auto-fills from post
2. Toggle **Form mode** (easy) vs **JSON mode** (advanced)
3. Click **Validate** → runs through schema-dts validator
4. Click **Test in Google Rich Results** → opens Google's tool in new tab with URL pre-filled
5. Preview how the post appears in Google SERP, Facebook, X, WhatsApp

---

## 7. Industry-Standard Subscription UI (Fixing the Side-Spaces Problem)

### 7.1 The Problem (From Your Screenshot)

Your current subscription box has empty side spaces on mobile/tablet because:
1. Component uses `max-width` without `w-full` on container
2. No responsive padding scaling
3. Card centered in a too-narrow container
4. Missing `flex-1` on input field

### 7.2 Corrected Component (Industry-Standard)

```tsx
// components/subscription/SubscribeBox.tsx
'use client';
import { useState } from 'react';
import { z } from 'zod/v4';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2, Mail } from 'lucide-react';

const Schema = z.object({
  email: z.email('Please enter a valid email'),
  categories: z.array(z.enum(['gold', 'silver', 'copper', 'crypto', 'forex'])).min(1, 'Select at least one'),
});
type FormData = z.infer<typeof Schema>;

const CATEGORIES = [
  { id: 'gold',   label: 'Gold',   color: '#D4AF37', icon: '🪙' },
  { id: 'silver', label: 'Silver', color: '#C0C0C0', icon: '🥈' },
  { id: 'copper', label: 'Copper', color: '#B87333', icon: '🔶' },
  { id: 'crypto', label: 'Crypto', color: '#F7931A', icon: '₿' },
  { id: 'forex',  label: 'Forex',  color: '#22c55e', icon: '💱' },
] as const;

export function SubscribeBox({ source }: { source: string }) {
  const { register, handleSubmit, watch, setValue, formState } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', categories: ['gold'] },
  });
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const selected = watch('categories');

  const toggleCategory = (id: string) => {
    const current = watch('categories');
    if (current.includes(id as any)) {
      setValue('categories', current.filter(c => c !== id) as any);
    } else {
      setValue('categories', [...current, id] as any);
    }
  };

  const onSubmit = async (data: FormData) => {
    setStatus('loading');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-6 w-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Check your inbox</h3>
        <p className="mt-1 text-sm text-slate-400">We sent you a confirmation email to verify your subscription.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6 md:p-8"
    >
      {/* Header */}
      <div className="mb-5 text-center sm:mb-6">
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 ring-1 ring-amber-500/30">
          <Mail className="h-5 w-5 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-white sm:text-xl">Daily market updates</h3>
        <p className="mt-1.5 text-sm text-slate-400">
          Real-time alerts for the assets you care about. One email, no spam.
        </p>
      </div>

      {/* Category chips — responsive grid */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
          Choose your categories
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {CATEGORIES.map(cat => {
            const active = selected.includes(cat.id as any);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                    : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span aria-hidden>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
        {formState.errors.categories && (
          <p className="mt-1.5 text-xs text-red-400">{formState.errors.categories.message}</p>
        )}
      </div>

      {/* Email + Button — stacks on mobile, inline on desktop */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          {...register('email')}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50 sm:min-w-[140px]"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Subscribing…</span>
            </>
          ) : (
            <span>Subscribe</span>
          )}
        </button>
      </div>
      {formState.errors.email && (
        <p className="mt-2 text-xs text-red-400">{formState.errors.email.message}</p>
      )}

      {/* Trust line */}
      <p className="mt-4 text-center text-xs text-slate-500">
        Free forever. Unsubscribe with one click. We never share your email.
      </p>

      {status === 'error' && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-300">
          Something went wrong. Please try again or contact support.
        </div>
      )}
    </form>
  );
}
```

### 7.3 Why This Is Better Than the Previous UI

| Old Problem | Fix |
|---|---|
| Empty side spaces on mobile | `w-full` on form + responsive padding `p-5 sm:p-6 md:p-8` |
| Unclear which categories are selected | Visual chip-style toggles with color + icon + ring indicator |
| Email + button too cramped | Stacks on mobile (`flex-col`), inline on desktop (`sm:flex-row`) |
| No loading state | Spinner + "Subscribing…" text on submit |
| No success/error feedback | Dedicated success card with checkmark, inline error messages |
| Generic "Subscribe" CTA | Trust line below reinforces free + unsubscribe + no-spam |
| Hidden errors | Inline Zod errors under each field |
| Not accessible | `aria-hidden` on decorative icons, proper `autoComplete="email"`, focus rings |

### 7.4 Where to Place It

Don't wrap it in a narrow container. Use:

```tsx
// In your page:
<section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
  <SubscribeBox source="/gold-price-today" />
</section>
```

- `max-w-2xl` = 672px maximum (industry standard for subscription forms)
- `w-full` means it fills the viewport up to that max
- `px-4 sm:px-6` gives breathing room on small screens without wasting space

---

## 8. Copyright-Safe Data Strategy

### 8.1 What's Legal

✅ **Prices from licensed APIs** (MetalpriceAPI, Binance public WebSocket, CoinGecko)
✅ **Your own written analysis** (not copied from Kitco/Goldprice.org)
✅ **Publicly licensed central bank data** (SBP, RBI, NY Fed, ECB — all free to republish with attribution)
✅ **Wikipedia text** (under CC BY-SA — must attribute)
✅ **Your own photos / AI-generated images** (ensure AI terms allow commercial use)

### 8.2 What's Illegal / Risky

❌ **Scraping Kitco, Goldprice.org, Bloomberg prices** — violates ToS, Bloomberg actively litigates
❌ **Using their charts** — chart screenshots are copyrighted works
❌ **Copying article text** — even paraphrasing too closely is a derivative work
❌ **Using LBMA logos without license**
❌ **Embedding iframe from competitor sites** — their ToS forbid it
❌ **Reusing their JSON-LD blocks** — schema itself isn't copyrighted but the *data values* are

### 8.3 Attribution Blocks (Put on Every Price Page)

```tsx
<div className="text-xs text-slate-500 mt-6">
  <p>Prices provided by <a href="https://metalpriceapi.com" rel="nofollow">MetalpriceAPI</a> under commercial license.</p>
  <p>Cryptocurrency data from Binance public WebSocket.</p>
  <p>Historical reference rates: LBMA (gold/silver), LME (copper).</p>
  <p>Last updated: <time dateTime="2026-04-23T12:34:56Z">Apr 23, 2026 12:34 UTC</time></p>
</div>
```

---

## 9. Updated Cost Estimate

| Line Item | Was (wrong) | Now (corrected) |
|---|---|---|
| MetalpriceAPI | $30/mo (guessed) | **$16.99/mo (Basic Plus)** or **$27.99/mo (Professional)** |
| Forex API (separate) | not included | **$0** — included in MetalpriceAPI |
| Redis for BullMQ | Upstash | **Local Redis on Hetzner ($0 extra)** |
| Hetzner | $4.51/mo | $4.51/mo |
| MongoDB Atlas | Free (M0) | Free (M0) |
| Upstash Redis (cache only) | ~$1 | ~$1 |
| Vercel Hobby | Free | Free |
| Clerk | Free | Free |
| Resend | Free | Free |
| **Total Month 1** | ~$35 | **~$22.50** (Basic Plus) or **~$33.50** (Professional) |

You're actually saving money by fixing these mistakes.

---

## 10. Updated CLAUDE.md Rules (Add to Existing)

```markdown
### MetalpriceAPI Rules (CRITICAL)

- ALWAYS use `&currencies=` (not `&symbols=`) in MetalpriceAPI requests
- ALWAYS read price from `rates.USD<SYMBOL>` field (e.g., `rates.USDXAU`), NOT `rates.XAU`
- ALWAYS log `X-API-CURRENT` and `X-API-QUOTA` response headers on every call
- ALWAYS alert admin when quota usage exceeds 80%
- ALWAYS use `api-eu.metalpriceapi.com` for EU-based users if we add EU data center
- MetalpriceAPI supports forex natively — DO NOT add a separate forex API
- Use `/carat` endpoint for 24k/22k/18k gold — DO NOT implement carat math manually
- Plan required: Basic Plus ($16.99/mo) minimum for 60-second updates

### YMYL Compliance Rules

- NEVER write "buy now", "guaranteed returns", or "best investment" language
- NEVER copy article text from competitor sites (paraphrase + cite)
- NEVER scrape prices from Kitco/Goldprice.org/Bloomberg — use licensed APIs only
- NEVER use author name "Admin" — always real name with credentials
- ALWAYS include disclaimer component on every price/forex/crypto page
- ALWAYS include "Last reviewed" date on YMYL articles
- ALWAYS include citations to primary sources (LBMA, SBP, RBI, SEC)
- ALWAYS use hreflang tags on localized pages (/uk/, /pk/, /in/)

### Forex Implementation (Phase 2)

- Cache forex rates with 5-minute TTL (not 30s like metals)
- Forex ingestion cron: every 5 minutes (not 60s — rates move slower)
- ALWAYS store both `usdRate` and `inverseRate` to avoid runtime math
- ALWAYS seed `currencies_meta` with flag/symbol/country for proper UI
- For PKR, INR display: use native symbols (₨, ₹) not ISO codes
```

---

## 11. Implementation Order

### Phase 1 (Launch)
1. ✅ Fix MetalpriceAPI ingestion code (Section 1.4 above)
2. ✅ Subscribe to Basic Plus or Professional plan
3. ✅ Build US + UK + PK + IN price pages
4. ✅ Deploy corrected subscription UI (Section 7)
5. ✅ Add all YMYL-required pages (about, editorial-policy, authors, disclaimers)
6. ✅ Configure hreflang + geo banner

### Phase 2 (Month 2)
7. Add `forex_rates` + `forex_candles_1h` + `currencies_meta` collections
8. Build `/forex/currency-converter` main calculator page
9. Auto-generate top 30 currency-pair landing pages (`/forex/usd-to-pkr`, etc.)
10. Publish forex-category blog posts (remittance guides)
11. Add forex category to subscription form
12. Update JSON-LD editor with `currency-converter` and `exchange-rate-pair` templates

### Phase 3 (Month 4+)
13. Add city-specific pages (gold-rate-karachi, gold-rate-mumbai, etc.)
14. Add Urdu/Hindi locales
15. Historical charts for all forex pairs

---

*Document 22 of the CIP-2026 Package — MetalpriceAPI Fixes + Forex + Geo-Targeting + YMYL Compliance*
*Supersedes conflicts in: 01, 08, 09, 14, 16 — applies retroactively*
*Last reviewed: April 23, 2026*
