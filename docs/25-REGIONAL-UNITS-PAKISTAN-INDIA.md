# 🪙 25 — Regional Unit Implementation (Pakistan + India)

**Purpose:** Implement Tola, 10-Gram, 1-Gram, and Per-Ounce unit displays with multi-karat purity tables on Pakistan and India gold/silver/copper pages.

**Cross-references:** Supersedes relevant sections of docs 01, 04, 08, 09, 22.

**Last reviewed:** April 23, 2026

---

## 1. Critical Unit Standards (Research-Verified)

### 1.1 Tola Standards — Two Valid Values

South Asian gold markets use **two different tola definitions**. Both are valid. Your site must support both and let the user pick.

| Standard | Weight | Used In | Use Case |
|---|---|---|---|
| **Standard Tola** (Indian Tola) | **11.6638 g** | India, international comparisons, formal pricing | Default — used everywhere unless specified |
| **Pakistani Bazar Tola** (بازاری تولہ) | **12.5 g** | Local bullion dealers, Karachi Sarafa Bazaar | Show as secondary option on Pakistan pages |

**⚠️ Critical:** The 7.1% difference between 11.6638g and 12.5g can mean thousands of rupees on one tola. Users must clearly see which standard is applied.

### 1.2 Display Unit Priority by Country

| Country | Primary Display | Secondary | Tertiary |
|---|---|---|---|
| 🇵🇰 Pakistan | **Per Tola (11.6638g)** | Per 10 Gram | Per 1 Gram |
| 🇮🇳 India | **Per 10 Gram** | Per Tola (11.6638g) | Per 1 Gram |
| 🇦🇪 UAE | Per Gram | Per Tola | Per Ounce |
| 🇺🇸 US / 🇬🇧 UK | **Per Troy Ounce** | Per Gram | — |

**Why 10 Gram is primary for India:** Indian jewelers historically round 1 tola to 10g for easy calculation. Official IBJA rates are quoted per 10g. Keep Pakistan's primary as Tola.

### 1.3 Purity Standards by Country

| Karat | Purity | Pakistan | India | Use |
|---|---|---|---|---|
| **24K** | 99.9% | ✅ | ✅ | Coins, bars, investment |
| **22K** | 91.6% | ✅ | ✅ | Traditional jewelry |
| **21K** | 87.5% | ✅ | ❌ | Popular in Pakistan for wedding jewelry |
| **20K** | 83.3% | ✅ | ❌ | Budget jewelry |
| **18K** | 75.0% | ✅ | ✅ | Modern jewelry, western designs |
| **14K** | 58.3% | ✅ | Rare | Watches, costume jewelry |
| **12K** | 50.0% | ✅ | Rare | Low-end, rare |

---

## 2. Unit Conversion Library

Create `apps/web/lib/units.ts`:

```typescript
// apps/web/lib/units.ts
// Canonical unit conversions — do NOT change these constants

export const UNITS = {
  // Base: 1 troy ounce = 31.1034768 grams (international standard)
  TROY_OUNCE_G:    31.1034768,

  // Tola standards
  TOLA_STANDARD_G: 11.6638125,   // Indian Tola = International standard
  TOLA_BAZAR_G:    12.5,          // Pakistani Market (Bazaar) Tola

  // Other units
  KG_G:            1000,
  POUND_G:         453.59237,
} as const;

export const KARAT_PURITY = {
  '24K': 0.999,
  '22K': 0.916,
  '21K': 0.875,
  '20K': 0.833,
  '18K': 0.750,
  '14K': 0.583,
  '12K': 0.500,
} as const;

export type Karat = keyof typeof KARAT_PURITY;
export type TolaStandard = 'standard' | 'bazar';

// ─────────────────────────────────────────────────────────────
// CORE: Convert from USD per troy ounce (API base) to any unit
// ─────────────────────────────────────────────────────────────

interface PriceInUnitInput {
  /** Price from MetalpriceAPI as USD per troy ounce (the rate.USDXAU value) */
  priceUSDperOz: number;
  /** USD → local currency rate (e.g. 1 USD = 278.45 PKR) */
  fxUSDtoLocal: number;
  /** Karat purity */
  karat: Karat;
  /** Tola standard (only relevant for Pakistan) */
  tolaStandard?: TolaStandard;
}

export function priceInUnits(input: PriceInUnitInput) {
  const { priceUSDperOz, fxUSDtoLocal, karat, tolaStandard = 'standard' } = input;
  const purity = KARAT_PURITY[karat];

  // 1. Convert USD/oz → local currency per troy ounce
  const localPerOz = priceUSDperOz * fxUSDtoLocal * purity;

  // 2. Convert to other units
  const localPerGram  = localPerOz / UNITS.TROY_OUNCE_G;
  const localPer10Gram = localPerGram * 10;
  const tolaGrams = tolaStandard === 'bazar' ? UNITS.TOLA_BAZAR_G : UNITS.TOLA_STANDARD_G;
  const localPerTola  = localPerGram * tolaGrams;
  const localPerKg    = localPerGram * UNITS.KG_G;

  return {
    perOz:    roundTo(localPerOz, 2),
    perGram:  roundTo(localPerGram, 2),
    per10Gram: roundTo(localPer10Gram, 2),
    perTola:  roundTo(localPerTola, 2),
    perKg:    roundTo(localPerKg, 2),
    meta: {
      karat,
      purity,
      tolaStandard,
      tolaGrams,
      fxRate: fxUSDtoLocal,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// HELPER: Generate full karat matrix for a country
// ─────────────────────────────────────────────────────────────

const PAKISTAN_KARATS: Karat[]  = ['24K', '22K', '21K', '20K', '18K'];
const INDIA_KARATS:    Karat[]  = ['24K', '22K', '18K'];

export function pakistanMatrix(priceUSDperOz: number, fxUSDtoPKR: number, tolaStandard: TolaStandard = 'standard') {
  return PAKISTAN_KARATS.map(k => ({
    karat: k,
    ...priceInUnits({ priceUSDperOz, fxUSDtoLocal: fxUSDtoPKR, karat: k, tolaStandard }),
  }));
}

export function indiaMatrix(priceUSDperOz: number, fxUSDtoINR: number) {
  return INDIA_KARATS.map(k => ({
    karat: k,
    ...priceInUnits({ priceUSDperOz, fxUSDtoLocal: fxUSDtoINR, karat: k, tolaStandard: 'standard' }),
  }));
}

// ─────────────────────────────────────────────────────────────
// Format: currency display
// ─────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency: 'PKR' | 'INR' | 'USD' | 'GBP', locale?: string) {
  const localeMap = {
    PKR: 'ur-PK',
    INR: 'en-IN',
    USD: 'en-US',
    GBP: 'en-GB',
  };

  return new Intl.NumberFormat(localeMap[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function roundTo(n: number, decimals: number) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
```

---

## 3. MongoDB Schema Updates

### 3.1 New Collection: `regional_rates` (Denormalized Cache)

Store pre-computed regional rates so the API route never does math at request time. Recalculated every 60 seconds by the worker.

```typescript
// Collection: regional_rates
interface RegionalRate {
  _id: ObjectId;
  symbol: 'gold' | 'silver' | 'copper';
  country: 'PK' | 'IN' | 'US' | 'UK' | 'AE';
  currency: 'PKR' | 'INR' | 'USD' | 'GBP' | 'AED';
  fxRate: number;             // USD → local at time of calc
  priceUSDperOz: number;      // Source price
  karats: {
    '24K': { perOz, perGram, per10Gram, perTola, perKg };
    '22K': { perOz, perGram, per10Gram, perTola, perKg };
    '21K'?: { ... };          // Pakistan only
    '20K'?: { ... };          // Pakistan only
    '18K':  { ... };
    '14K'?: { ... };          // Pakistan only
  };
  tolaStandard?: 'standard' | 'bazar';  // For Pakistan; standard for India
  timestamp: Date;
  computedAt: Date;
}

// Indexes
db.regional_rates.createIndex({ symbol: 1, country: 1, tolaStandard: 1 }, { unique: true });
db.regional_rates.createIndex({ computedAt: -1 });
```

### 3.2 Why Pre-Compute?

Computing karat + unit conversions for each request = wasteful. Pre-compute every 60s when new prices arrive → all users read from a single flat document. Math done **once** per minute, not once per request.

---

## 4. Updated Worker: Regional Rate Computation

Add to `apps/worker/src/jobs/ingest-metals.ts` (after existing live_prices update):

```typescript
import { pakistanMatrix, indiaMatrix, priceInUnits } from '@cip/shared/units';

async function computeAndStoreRegionalRates(
  db: Db,
  metal: { symbol: string; priceUSDperOz: number },
  forexRates: Record<string, number>,
  log: Logger
) {
  const now = new Date();

  // Pakistan — both tola standards
  for (const tolaStandard of ['standard', 'bazar'] as const) {
    const karats = pakistanMatrix(metal.priceUSDperOz, forexRates['PKR'], tolaStandard);
    const byKarat = Object.fromEntries(karats.map(k => [k.karat, {
      perOz: k.perOz, perGram: k.perGram, per10Gram: k.per10Gram,
      perTola: k.perTola, perKg: k.perKg,
    }]));

    await db.collection('regional_rates').updateOne(
      { symbol: metal.symbol, country: 'PK', tolaStandard },
      {
        $set: {
          symbol: metal.symbol,
          country: 'PK',
          currency: 'PKR',
          fxRate: forexRates['PKR'],
          priceUSDperOz: metal.priceUSDperOz,
          karats: byKarat,
          tolaStandard,
          timestamp: now,
          computedAt: now,
        },
      },
      { upsert: true }
    );
  }

  // India — only standard tola
  const indiaKarats = indiaMatrix(metal.priceUSDperOz, forexRates['INR']);
  const indiaByKarat = Object.fromEntries(indiaKarats.map(k => [k.karat, {
    perOz: k.perOz, perGram: k.perGram, per10Gram: k.per10Gram,
    perTola: k.perTola, perKg: k.perKg,
  }]));

  await db.collection('regional_rates').updateOne(
    { symbol: metal.symbol, country: 'IN', tolaStandard: 'standard' },
    {
      $set: {
        symbol: metal.symbol,
        country: 'IN',
        currency: 'INR',
        fxRate: forexRates['INR'],
        priceUSDperOz: metal.priceUSDperOz,
        karats: indiaByKarat,
        tolaStandard: 'standard',
        timestamp: now,
        computedAt: now,
      },
    },
    { upsert: true }
  );

  log.info({ symbol: metal.symbol }, 'Regional rates computed');
}

// Call this inside existing ingestMetals() after live_prices update:
//
//   for (const metal of metals) {
//     // ... existing live_prices + candles_1m upserts ...
//     await computeAndStoreRegionalRates(db, { symbol: metal.symbol, priceUSDperOz }, forexRates, log);
//   }
```

---

## 5. API Contract — `GET /api/regional-rate/[symbol]`

New endpoint to power Pakistan/India pages.

```
GET /api/regional-rate/gold?country=PK&tola=standard
```

**Query params:**
| Name | Type | Values | Default |
|---|---|---|---|
| country | string | `PK` \| `IN` \| `US` \| `UK` \| `AE` | Required |
| tola | string | `standard` \| `bazar` | `standard` |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "symbol": "gold",
    "country": "PK",
    "currency": "PKR",
    "fxRate": 278.4550,
    "priceUSDperOz": 2350.21,
    "tolaStandard": "standard",
    "tolaGrams": 11.6638125,
    "karats": {
      "24K": {
        "perOz": 654392.15,
        "perGram": 21040.18,
        "per10Gram": 210401.80,
        "perTola": 245466.22,
        "perKg": 21040180.00
      },
      "22K": { ... },
      "21K": { ... },
      "20K": { ... },
      "18K": { ... }
    },
    "timestamp": "2026-04-23T12:34:12.000Z"
  }
}
```

**Caching:**
- Redis key: `regional_rate:gold:PK:standard`, TTL 60s
- CDN: 30s + stale-while-revalidate 60s

---

## 6. UI Component — Pakistan/India Gold Price Tables

Create `components/regional/RegionalRateTable.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { formatCurrency } from '@/lib/units';

type Karat = '24K' | '22K' | '21K' | '20K' | '18K' | '14K';

interface Props {
  symbol: 'gold' | 'silver' | 'copper';
  country: 'PK' | 'IN';
  initialData: {
    currency: 'PKR' | 'INR';
    tolaStandard?: 'standard' | 'bazar';
    tolaGrams?: number;
    timestamp: string;
    karats: Record<Karat, {
      perOz: number;
      perGram: number;
      per10Gram: number;
      perTola: number;
    }>;
  };
}

const PAKISTAN_KARATS: Karat[] = ['24K', '22K', '21K', '20K', '18K'];
const INDIA_KARATS:    Karat[] = ['24K', '22K', '18K'];

export function RegionalRateTable({ symbol, country, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [tolaStandard, setTolaStandard] = useState<'standard' | 'bazar'>(
    initialData.tolaStandard || 'standard'
  );

  const karats = country === 'PK' ? PAKISTAN_KARATS : INDIA_KARATS;
  const currency = data.currency;

  // Re-fetch when user toggles tola standard (Pakistan only)
  async function switchTola(std: 'standard' | 'bazar') {
    setTolaStandard(std);
    const res = await fetch(`/api/regional-rate/${symbol}?country=${country}&tola=${std}`);
    const json = await res.json();
    if (json.success) setData(json.data);
  }

  return (
    <section className="w-full space-y-6">
      {/* Header with tola selector (Pakistan only) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {symbol === 'gold' ? 'Gold' : symbol === 'silver' ? 'Silver' : 'Copper'} Rates in {country === 'PK' ? 'Pakistan' : 'India'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Updated <time dateTime={data.timestamp}>
              {new Date(data.timestamp).toLocaleString(country === 'PK' ? 'en-PK' : 'en-IN', {
                hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
              })}
            </time>
          </p>
        </div>

        {country === 'PK' && (
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-sm">
            <button
              onClick={() => switchTola('standard')}
              className={`rounded-md px-3 py-1.5 transition ${
                tolaStandard === 'standard'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Standard Tola (11.66g)
            </button>
            <button
              onClick={() => switchTola('bazar')}
              className={`rounded-md px-3 py-1.5 transition ${
                tolaStandard === 'bazar'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bazaar Tola (12.5g)
            </button>
          </div>
        )}
      </div>

      {/* Main karat × weight table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/80">
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Purity</th>
              <th className="p-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                {country === 'PK' ? 'Per Tola' : 'Per 10 Gram'}
              </th>
              <th className="p-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                {country === 'PK' ? 'Per 10 Gram' : 'Per Tola'}
              </th>
              <th className="p-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Per 1 Gram</th>
              <th className="p-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Per Ounce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {karats.map((k, i) => {
              const row = data.karats[k];
              if (!row) return null;
              const isPrimary = (country === 'PK' && k === '24K') || (country === 'IN' && k === '22K');
              return (
                <tr
                  key={k}
                  className={`transition hover:bg-slate-900/50 ${isPrimary ? 'bg-amber-500/5' : ''}`}
                >
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-2 font-semibold ${
                      k === '24K' ? 'text-amber-400' :
                      k === '22K' ? 'text-amber-500' :
                      k === '21K' ? 'text-amber-600' :
                      k === '20K' ? 'text-orange-500' :
                      k === '18K' ? 'text-orange-600' :
                      'text-slate-400'
                    }`}>
                      <span className="inline-block h-2 w-2 rounded-full bg-current" />
                      {k}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-white">
                    {formatCurrency(country === 'PK' ? row.perTola : row.per10Gram, currency)}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-slate-300">
                    {formatCurrency(country === 'PK' ? row.per10Gram : row.perTola, currency)}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-slate-300">
                    {formatCurrency(row.perGram, currency)}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-slate-400 hidden sm:table-cell">
                    {formatCurrency(row.perOz, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Educational footer */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400">
        <p>
          <strong className="text-slate-300">Unit conversion:</strong>{' '}
          {country === 'PK' && tolaStandard === 'standard' &&
            '1 Tola = 11.6638 grams (standard). '
          }
          {country === 'PK' && tolaStandard === 'bazar' &&
            '1 Bazaar Tola = 12.5 grams (used by local Sarafa dealers). '
          }
          {country === 'IN' && '1 Tola = 11.6638 grams (standard). '}
          1 Troy Ounce = 31.1035 grams. Prices shown include applicable purity and current USD/{currency} exchange rate
          ({data.fxRate?.toFixed(4)}).
        </p>
        <p className="mt-2">
          Prices for reference only. Actual retail rates may differ due to dealer premiums,
          sales tax ({country === 'PK' ? 'GST + withholding' : 'GST'}), and making charges.
          See our <a href="/disclaimer/gold" className="text-amber-400 underline">full disclaimer</a>.
        </p>
      </div>
    </section>
  );
}
```

---

## 7. Quick-Calculator Component (Enter any quantity)

For pages like `/pk/gold-price-today-pakistan`, include a live quick calculator:

```tsx
// components/regional/QuickCalculator.tsx
'use client';
import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/units';

interface Props {
  rates: {
    perGram: number;
    perTola: number;
    per10Gram: number;
  };
  currency: 'PKR' | 'INR';
  karat: string;
}

export function QuickCalculator({ rates, currency, karat }: Props) {
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState<'tola' | '10gram' | 'gram'>('tola');

  const total = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const rate = unit === 'tola' ? rates.perTola : unit === '10gram' ? rates.per10Gram : rates.perGram;
    return q * rate;
  }, [quantity, unit, rates]);

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
        <h3 className="text-sm font-semibold text-white">Calculate {karat} Gold Value</h3>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-500">Quantity</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="sm:w-40">
          <label className="mb-1 block text-xs text-slate-500">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as any)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="tola">Tola</option>
            <option value="10gram">10 Gram</option>
            <option value="gram">1 Gram</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-slate-800 pt-4">
        <span className="text-sm text-slate-400">Total value ({karat})</span>
        <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
          {formatCurrency(total, currency)}
        </span>
      </div>
    </div>
  );
}
```

---

## 8. Server Page Implementation

Example: `app/pk/gold-price-today-pakistan/page.tsx`

```tsx
// app/pk/gold-price-today-pakistan/page.tsx
import type { Metadata } from 'next';
import { getMongo } from '@/lib/mongo';
import { RegionalRateTable } from '@/components/regional/RegionalRateTable';
import { QuickCalculator } from '@/components/regional/QuickCalculator';
import { LegalDisclaimer } from '@/components/disclaimer/LegalDisclaimer';
import { SubscribeBox } from '@/components/subscription/SubscribeBox';
import { PriceChart } from '@/components/charts/PriceChart';
import { JsonLd } from '@/components/seo/JsonLd';

export const revalidate = 60; // ISR: re-render every 60s

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Gold Rate Today in Pakistan — 24K, 22K, 21K per Tola & 10 Gram',
    description: 'Live gold price today in Pakistan. Latest 24K, 22K, 21K, 20K & 18K gold rates per tola, 10 gram, and 1 gram in Pakistani Rupees (PKR). Updated every 60 seconds.',
    alternates: {
      canonical: 'https://yourdomain.com/pk/gold-price-today-pakistan',
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

export default async function PakistanGoldPage() {
  const db = await getMongo();
  const data = await db.collection('regional_rates').findOne({
    symbol: 'gold',
    country: 'PK',
    tolaStandard: 'standard',
  });

  if (!data) {
    return <div>Loading latest rates...</div>;
  }

  // Serialize for client component
  const initialData = {
    currency: data.currency,
    tolaStandard: data.tolaStandard,
    tolaGrams: 11.6638125,
    fxRate: data.fxRate,
    timestamp: data.timestamp.toISOString(),
    karats: data.karats,
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-slate-500">
        <a href="/" className="hover:text-white">Home</a>
        {' / '}
        <a href="/pk" className="hover:text-white">Pakistan</a>
        {' / '}
        <span className="text-white">Gold Rate Today</span>
      </nav>

      {/* Hero + primary rate */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          Gold Rate Today in Pakistan
        </h1>
        <p className="mt-3 text-base text-slate-400 sm:text-lg">
          Live 24K, 22K, 21K, 20K & 18K gold prices per tola, 10 gram, and 1 gram in PKR.
          Updated every 60 seconds from international markets.
        </p>
      </header>

      {/* Regional rate table — the STAR */}
      <div className="mb-10">
        <RegionalRateTable
          symbol="gold"
          country="PK"
          initialData={initialData}
        />
      </div>

      {/* Quick calculator */}
      <div className="mb-10">
        <QuickCalculator
          rates={{
            perGram: data.karats['24K'].perGram,
            perTola: data.karats['24K'].perTola,
            per10Gram: data.karats['24K'].per10Gram,
          }}
          currency="PKR"
          karat="24K"
        />
      </div>

      {/* Historical chart */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold text-white">Gold Price History</h2>
        <PriceChart symbol="gold" currency="PKR" defaultRange="1M" />
      </section>

      {/* Major cities table */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold text-white">Gold Rates in Major Pakistani Cities</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Peshawar', 'Quetta', 'Multan', 'Faisalabad'].map(city => (
            <a
              key={city}
              href={`/pk/gold-rate-${city.toLowerCase()}`}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition hover:border-amber-500/30 hover:bg-slate-900"
            >
              <div className="text-sm font-semibold text-white">{city}</div>
              <div className="mt-1 text-xs text-slate-500">View local rate →</div>
            </a>
          ))}
        </div>
      </section>

      {/* Subscribe */}
      <section className="mb-10">
        <SubscribeBox source="/pk/gold-price-today-pakistan" />
      </section>

      {/* Required: financial disclaimer */}
      <LegalDisclaimer category="gold" region="PK" />

      {/* JSON-LD (dynamic, from template) */}
      <JsonLd template="product-metal-price" data={{
        product: {
          name: 'Gold (24K) per Tola in Pakistan',
          description: 'Live 24K gold rate per tola in Pakistani Rupees',
        },
        price: {
          value: data.karats['24K'].perTola,
          currency: 'PKR',
        },
      }} />
    </main>
  );
}
```

---

## 9. Updated Collections Overview

Add to doc 08 MongoDB Schemas:

```typescript
// Collection inventory (add to existing):
// - regional_rates — NEW (pre-computed rates per country × tola standard)

// Existing collections that now feed regional_rates:
// - live_prices (source: USD per oz)
// - forex_rates (source: USD → local rates)
```

---

## 10. CLAUDE.md Additions

Add these rules:

```markdown
### Regional Unit Rules (Pakistan & India)

ALWAYS:
- Use constants from @/lib/units.ts — never hardcode conversion factors
- Store precomputed regional_rates every 60s in worker (NOT at API time)
- Show Pakistan pages with Tola as PRIMARY unit, 10-gram as secondary
- Show India pages with 10-gram as PRIMARY unit, Tola as secondary
- Include all 5 karats for Pakistan: 24K, 22K, 21K, 20K, 18K
- Include 3 karats for India: 24K, 22K, 18K
- Show unit conversion footnote on every regional page
- Apply purity multiplier BEFORE unit conversion (USD/oz × purity → then to tola/gram)
- Use tabular-nums font feature for all price columns (tabular-nums class)

NEVER:
- Hardcode Pakistani tola as 12.5g only — support both 11.6638g (standard) and 12.5g (bazaar)
- Hardcode Indian tola as 10g — standard Indian tola is 11.6638g (some jewelers round to 10g for calc)
- Use different tola constants in different files — import from @/lib/units.ts
- Compute unit conversions in API route — always read from regional_rates collection
- Display prices without currency symbol (always use Intl.NumberFormat)
- Show karats not applicable to country (e.g., don't show 21K on India pages)
```

---

## 11. Testing Rules

Add these tests to Vitest:

```typescript
// apps/web/lib/units.test.ts
import { priceInUnits, UNITS, KARAT_PURITY } from './units';

describe('Unit conversions', () => {
  // Seed: 1 troy oz of 24K gold at $2350, 1 USD = 278.45 PKR
  const input = { priceUSDperOz: 2350, fxUSDtoLocal: 278.45 };

  it('Pakistan standard tola gives correct PKR/tola for 24K', () => {
    const r = priceInUnits({ ...input, karat: '24K', tolaStandard: 'standard' });
    // 2350 × 278.45 × 0.999 / 31.1035 × 11.6638 = 245,335 approx
    expect(r.perTola).toBeCloseTo(245335, -2); // within 100 PKR
  });

  it('Pakistan bazaar tola = standard tola × (12.5 / 11.6638)', () => {
    const std  = priceInUnits({ ...input, karat: '24K', tolaStandard: 'standard' });
    const bzr  = priceInUnits({ ...input, karat: '24K', tolaStandard: 'bazar' });
    expect(bzr.perTola / std.perTola).toBeCloseTo(12.5 / 11.6638, 3);
  });

  it('22K is exactly 91.6% of 24K price', () => {
    const k24 = priceInUnits({ ...input, karat: '24K' });
    const k22 = priceInUnits({ ...input, karat: '22K' });
    expect(k22.perGram / k24.perGram).toBeCloseTo(0.916 / 0.999, 4);
  });

  it('Per 10 gram = per gram × 10 exactly', () => {
    const r = priceInUnits({ ...input, karat: '24K' });
    expect(r.per10Gram).toBeCloseTo(r.perGram * 10, 2);
  });
});
```

---

## 12. SEO Content Blocks (Write Once, Reuse)

For each regional page, include these SEO content sections:

### Pakistan Page — Content Blocks

```markdown
## How Gold Prices Are Determined in Pakistan

Gold rates in Pakistan are calculated from three inputs:
1. **International gold spot price** (in USD per troy ounce from LBMA)
2. **USD to PKR exchange rate** (interbank rate from State Bank of Pakistan)
3. **Purity adjustment** (24K = 99.9%, 22K = 91.6%, 21K = 87.5%, 18K = 75.0%)

Local dealers may add a premium for making charges (usually 5-20% for jewelry).

## 1 Tola vs 10 Gram — Which Should I Use?

In Pakistan, gold is traditionally bought and sold per tola:
- **Standard Tola** = 11.6638 grams (official, used by news sites and formal pricing)
- **Bazaar Tola** = 12.5 grams (used by local Sarafa dealers in Karachi Sarafa Bazaar)

If you're buying at a branded jeweler → you'll likely pay by standard tola.
If you're buying at a traditional Sarafa bazaar → always confirm which standard is quoted.

Use the toggle above to switch between the two standards.

## Where to Buy Gold in Pakistan

Major trading hubs include Karachi Sarafa Bazaar, Lahore's Anarkali, Rawalpindi Sarafa Bazaar,
and branded showrooms like Damas, Sahar Jewellers, and Hamza Gold. Always request a BSI
(Bureau of Standards) certificate or PSQCA hallmark for authenticity.

## Gold Weight in Pakistani Traditions

- **Bridal set** (necklace + bangles + earrings): 5-15 tola typically
- **Standard chain**: 2-4 tola
- **Wedding ring**: 2-5 gram
- **Gold bar (small investment)**: 1 tola (popular) or 10 tola

## FAQ (Pakistan Gold)

**Q: Why is 24K more expensive than 22K?**
24K is purer (99.9% gold) versus 22K (91.6%). Fewer alloy metals mean more gold content per tola.

**Q: What's the difference between standard and bazaar tola?**
Standard tola = 11.6638g (international). Bazaar tola = 12.5g (local Pakistani dealers). Always confirm before buying.

**Q: How is gold rate calculated daily?**
International spot price × USD-to-PKR exchange rate × purity factor.
Our site updates these every 60 seconds automatically.
```

### India Page — Content Blocks

```markdown
## How Gold Prices Are Determined in India

Gold rates in India are calculated from:
1. **International spot price** (USD per troy ounce from LBMA)
2. **USD to INR exchange rate** (RBI reference rate)
3. **Purity** (24K = pure, 22K = 91.6% used in jewelry, 18K = 75% modern)
4. **GST** (3% on gold purchase in India, added by seller)

## Gold Rate per Tola or per 10 Gram in India?

Indian jewelers traditionally quote rates per 10 gram (official IBJA standard).
However, many customers still ask in tola.

- **1 Tola** = 11.6638 grams (standard)
- Some jewelers round to 10 grams for easy calculation in older systems
- Always confirm the unit before finalizing purchase

## Popular Gold Purities in India

- **22K (916 gold)** — Most popular for jewelry; has BIS hallmark "916"
- **24K** — For investment coins and bars (less common in jewelry due to softness)
- **18K** — Modern western-style designs, diamond jewelry settings

## Where to Buy Gold in India

Major hubs: Zaveri Bazaar (Mumbai), Chandni Chowk (Delhi), Thanga Maligai (Chennai),
TBZ, Tanishq, Malabar Gold showrooms. Always check BIS hallmark.

## FAQ (India Gold)

**Q: What does 916 mean on gold jewelry?**
916 = 91.6% pure gold = 22K. This is the BIS (Bureau of Indian Standards) hallmark for 22K gold.

**Q: Why does gold price differ by city in India?**
Minor differences due to local octroi, GST collection, and dealer margins. Spot price is identical nationwide.

**Q: Is it better to buy 22K or 24K?**
22K for jewelry (more durable). 24K for investment (purer, easier to resell at full value).
```

---

## 13. Updated Sitemap Entries

Add these pages to the sitemap (see doc 22 for full geo structure):

```
/pk/gold-price-today-pakistan          ← Primary Pakistan gold page (this doc's implementation)
/pk/gold-rate-today-in-pakistan        ← Alt URL (keyword variant)
/pk/silver-price-today-pakistan
/pk/copper-price-today-pakistan
/pk/24k-gold-rate-in-pakistan
/pk/22k-gold-rate-in-pakistan
/pk/21k-gold-rate-in-pakistan
/pk/18k-gold-rate-in-pakistan
/pk/1-tola-gold-price
/pk/10-gram-gold-price-pakistan

/in/gold-price-today-india             ← Primary India gold page
/in/gold-rate-today-in-india
/in/silver-price-today-india
/in/copper-price-today-india
/in/22k-gold-rate-india
/in/24k-gold-rate-india
/in/18k-gold-rate-india
/in/gold-rate-per-10-gram-india
/in/gold-rate-per-tola-india
```

---

## 14. Implementation Checklist (Add to Sprint 3)

- [ ] Create `@/lib/units.ts` with all constants + conversion functions
- [ ] Add Vitest tests for unit conversions (all karats, both tola standards)
- [ ] Create `regional_rates` MongoDB collection + indexes
- [ ] Update worker `ingest-metals.ts` to call `computeAndStoreRegionalRates()` on each tick
- [ ] Implement `/api/regional-rate/[symbol]` endpoint
- [ ] Build `RegionalRateTable` component with tola standard toggle
- [ ] Build `QuickCalculator` component
- [ ] Create `/pk/gold-price-today-pakistan` page
- [ ] Create `/in/gold-price-today-india` page
- [ ] Add JSON-LD for price schema (per page)
- [ ] Add hreflang tags on all regional pages
- [ ] Mobile-test: table scrolls horizontally without breaking layout
- [ ] Verify currency formatting with `en-PK` and `en-IN` locales
- [ ] Add both tola standards to disclaimer page `/disclaimer/gold`

---

## 15. Cost & Performance Impact

| Concern | Answer |
|---|---|
| API quota impact | **Zero.** Uses existing 60s ingestion. No extra MetalpriceAPI calls. |
| MongoDB storage | Negligible (~5KB per symbol per country per tola standard × 4 = 20KB total) |
| Redis storage | Negligible (3 symbols × 5 countries × 60s TTL = ~15 keys) |
| API response time | Unchanged (pre-computed, just a findOne lookup) |
| Worker CPU | +5ms per ingestion tick (negligible) |

---

*Document 25 of the CIP-2026 Package — Regional Unit Implementation for Pakistan + India*
*Cross-references: 01, 04, 08, 09, 22 need minor updates per sections 9 and 13 above.*
*Supersedes any conflicting unit-conversion code in earlier docs.*
*Last reviewed: April 23, 2026*
