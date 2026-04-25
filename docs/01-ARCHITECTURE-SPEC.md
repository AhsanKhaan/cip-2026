# 🏗️ 01 — Architecture Specification

**Project:** Commodity Intelligence Platform (CIP)
**Stack:** Next.js 15 App Router + MongoDB + Redis + Vercel + Cloudflare

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│  MetalpriceAPI (REST)    │  Binance WS     │  Metals-API (FB)  │
│  Gold/Silver/Copper      │  BTC/ETH live   │  Failover source  │
└──────────┬──────────────────────┬──────────────────┬─────────────┘
           ↓                      ↓                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                    INGESTION LAYER (Worker)                     │
├─────────────────────────────────────────────────────────────────┤
│  • Cron Workers (BullMQ on Hetzner VPS $4/mo)                   │
│  • 1-min REST pull for metals (batch endpoint)                  │
│  • Persistent WebSocket for crypto (auto-reconnect)             │
│  • Aggregation jobs: 1m → 1h (hourly) → 1d (daily)              │
└──────────┬──────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER (MongoDB Atlas)                │
├─────────────────────────────────────────────────────────────────┤
│  live_prices   │  candles_1m    │  candles_1h   │  candles_1d  │
│  (4 docs)      │  (60d TTL)     │  (365d TTL)   │  (forever)   │
│                                                                 │
│  blogs  │  disclaimers  │  subscribers  │  alerts  │  users     │
│  broadcast_log  │  audit_log                                    │
└──────────┬──────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CACHE LAYER (Upstash Redis)                  │
├─────────────────────────────────────────────────────────────────┤
│  price:<symbol>       → 30s TTL                                 │
│  candles:<sym>:<rng>  → 60s – 6h TTL (varies by range)          │
│  disclaimer:<cat>     → 1h TTL (cached disclaimer text)         │
│  rate-limit:<ip>      → 1h TTL                                  │
└──────────┬──────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERING LAYER (Vercel)                     │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 15 App Router                                          │
│  • Server Components (SSR with streaming)                       │
│  • ISR pages with revalidateTag() for instant updates           │
│  • API Routes for dynamic queries                               │
│  • Middleware for geo/currency/rate-limiting                    │
└──────────┬──────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE LAYER (Cloudflare)                      │
├─────────────────────────────────────────────────────────────────┤
│  • Global CDN caching                                           │
│  • WAF (DDoS, bot protection)                                   │
│  • DNS + SSL                                                    │
└──────────┬──────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Web (Next.js)  │  Mobile WebView (Capacitor)  │  Alert Engine  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure Decisions

### 2.1 Why Vercel for frontend, Hetzner VPS for workers?

**Vercel strengths:** Edge network, ISR, zero-config Next.js, automatic SSL.
**Vercel weakness:** Cron drift, no long-running processes, expensive function invocations at scale.

**Split responsibility:**
- Vercel runs the **Next.js app** (ISR pages + API routes).
- Hetzner VPS ($4.51/mo CX11) runs the **BullMQ worker** (cron + WebSocket listener).
- Both talk to the same MongoDB Atlas + Upstash Redis.

This gives you Vercel's edge performance AND reliable worker execution without Vercel Pro's $20/mo cost penalty.

### 2.2 Why MongoDB Time-Series (not ClickHouse or Timescale)?

Trade-off chosen: **operational simplicity > maximum performance**.

- Single database (MongoDB) for all data = one connection string, one admin surface.
- Time-series collections give you 90% compression + 10× faster range queries vs regular collections.
- No DevOps overhead (Atlas-managed).
- Sufficient for 10M+ candle rows, which is ~6 years of 4 assets at 1-minute resolution.
- Migrate to ClickHouse only if/when you exceed 100M rows or need sub-10ms query latency.

### 2.3 Why Upstash Redis (not Redis Cloud or self-hosted)?

- Serverless-friendly (HTTP API, works in Vercel Edge runtime).
- Free tier: 10K commands/day — sufficient for MVP.
- No connection pool exhaustion issues (HTTP, not TCP).
- Pay-per-request pricing scales linearly.

---

## 3. Core Data Flow (Step-by-Step)

### 3.1 Ingestion flow (every 60 seconds)

1. Hetzner worker cron triggers `ingestPrices()` job.
2. Worker makes **one batch API call**: `GET /api/v1/latest?symbols=XAU,XAG,XCU&currencies=USD`.
3. Response parsed into 3 price ticks (metals) + worker reads current Binance WS state for BTC/ETH.
4. For each symbol:
   - **Upsert** into `live_prices` collection (snapshot).
   - **Upsert** into `candles_1m` (with $max/$min/$first/$last for OHLC).
5. Worker calls Next.js revalidation endpoint: `POST /api/revalidate?tag=price-gold&secret=XXX`.
6. Vercel invalidates ISR cache for affected pages.
7. Worker queues alert check job: `checkAlerts` for each symbol that moved.
8. Alert worker reads user alerts from MongoDB, matches against new price, queues `send-email` / `send-push` jobs for triggered alerts.

**Failure modes handled:**
- API timeout → retry with backoff → fall back to Metals-API → serve stale (flagged).
- MongoDB write fails → Redis pub/sub buffer → retry worker drains buffer.
- Revalidation endpoint fails → logged, next tick will sync (max 60s delay).

### 3.2 User request flow (page load)

1. User visits `/gold-price-today`.
2. Cloudflare CDN checks cache → HIT → return instantly (if within ISR window).
3. If MISS → Vercel Edge serves ISR HTML (regenerated every 60s).
4. HTML includes:
   - Live price (from `live_prices` via DB fetch, cached per request).
   - Chart data (from `candles_1m` for 1D view).
   - Auto-injected disclaimer (from `disclaimers` collection via `<LegalDisclaimer category="gold">`).
   - Subscription form (prefilled with gold category checked).
5. Client hydrates → TanStack Query takes over for live updates.
6. Client polls `/api/price/gold` every 60s (cached in Redis, 30s TTL).

### 3.3 Subscription flow

1. User fills form on any page: email, optional phone (+country code), category checkboxes.
2. POST `/api/subscribe` with:
   ```json
   { "email": "user@x.com", "phone": "+923001234567", "categories": ["gold","crypto"], "source": "/gold-price-today" }
   ```
3. API validates → checks rate limit (3/hour/IP) → checks duplicate email.
4. If new: create `subscribers` doc with `verified: false` + generate token.
5. Send verification email via Resend.
6. User clicks link → GET `/api/verify?token=XXX` → sets `verified: true`.
7. Confirmation email sent + welcome sequence starts.

### 3.4 Admin broadcast flow

1. Admin navigates to `/admin/broadcast` (protected by Clerk auth).
2. Selects channel (email only / email + WhatsApp), categories targeted, composes message.
3. POST `/api/admin/broadcast` → creates `broadcast_log` entry, queues jobs.
4. Worker processes jobs in batches of 100 (respects provider rate limits).
5. Each send updates `broadcast_log.deliveryStats`.

---

## 4. Security Architecture

### 4.1 Authentication layers

| Surface | Auth method | Why |
|---------|-------------|-----|
| Public pages | None | SEO-first |
| Subscriber portal | Magic link (no password) | Passwordless = lower friction |
| User dashboard (Phase 3) | Clerk | Google/Apple/email |
| Admin panel | Clerk + role check | Role-based access |
| Worker → Next.js revalidation | Shared secret | Simple, internal |
| Cron endpoints | Bearer token | Vercel cron protection |

### 4.2 Rate limiting strategy

All via Upstash Redis + middleware:

```
/api/subscribe              → 3 req / IP / hour
/api/price/*                → 120 req / IP / minute (polling allowance)
/api/candles/*              → 60 req / IP / minute
/api/admin/*                → 30 req / user / minute
```

### 4.3 Input validation

- All API routes use **Zod schemas** for validation.
- Phone numbers: libphonenumber-js (E.164 format enforced).
- Email: RFC 5322 regex + MX record check on subscription.
- HTML sanitization: DOMPurify on any user-submitted content.

---

## 5. Environment Variables (complete list)

Create `.env.local` and Vercel environment variables:

```bash
# Database
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=cip_production

# Cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# APIs
METALPRICEAPI_KEY=...
METALSAPI_KEY=...              # Fallback
COINGECKO_API_KEY=             # Optional, free tier works without

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yoursite.com
EMAIL_REPLY_TO=support@yoursite.com

# Auth (Phase 3)
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Internal
REVALIDATE_SECRET=<random-32-char>
CRON_SECRET=<random-32-char>
ADMIN_ALLOWED_EMAILS=admin@yoursite.com

# Analytics (Phase 2)
NEXT_PUBLIC_GA_ID=G-...
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yoursite.com

# WhatsApp (future — Phase 4)
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Site
NEXT_PUBLIC_SITE_URL=https://yoursite.com
```

---

## 6. Repository Structure

```
commodity-intelligence/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   │   ├── page.tsx          # Landing
│   │   │   │   ├── [category]/
│   │   │   │   │   └── page.tsx      # /gold, /silver, etc.
│   │   │   │   └── blog/
│   │   │   │       └── [slug]/
│   │   │   │           └── page.tsx
│   │   │   ├── (dashboard)/           # Phase 3
│   │   │   ├── api/
│   │   │   │   ├── price/[symbol]/route.ts
│   │   │   │   ├── candles/[symbol]/route.ts
│   │   │   │   ├── subscribe/route.ts
│   │   │   │   ├── verify/route.ts
│   │   │   │   ├── revalidate/route.ts
│   │   │   │   └── admin/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui
│   │   │   ├── legal/
│   │   │   │   ├── LegalDisclaimer.tsx
│   │   │   │   └── DisclaimerProvider.tsx
│   │   │   ├── subscription/
│   │   │   │   ├── SubscribeForm.tsx
│   │   │   │   └── CategoryCheckboxes.tsx
│   │   │   ├── price/
│   │   │   │   ├── LivePriceCard.tsx
│   │   │   │   ├── PriceChart.tsx
│   │   │   │   └── Calculator.tsx
│   │   │   └── blog/
│   │   ├── lib/
│   │   │   ├── mongo.ts
│   │   │   ├── redis.ts
│   │   │   ├── disclaimers.ts         # Disclaimer engine
│   │   │   ├── email.ts
│   │   │   └── schemas/               # Zod schemas
│   │   └── content/
│   │       └── blog/                  # MDX posts
│   └── worker/                        # Hetzner VPS worker
│       ├── src/
│       │   ├── jobs/
│       │   │   ├── ingest-metals.ts
│       │   │   ├── ingest-crypto-ws.ts
│       │   │   ├── aggregate-hourly.ts
│       │   │   ├── aggregate-daily.ts
│       │   │   ├── check-alerts.ts
│       │   │   └── broadcast.ts
│       │   ├── lib/
│       │   └── index.ts               # BullMQ setup
│       └── Dockerfile
├── packages/
│   ├── shared/                        # Shared types & schemas
│   │   └── src/
│   │       ├── types.ts
│   │       └── schemas.ts
│   └── config/
├── docs/                              # This delivery package lives here
├── turbo.json                         # Turborepo config
├── package.json
└── README.md
```

---

## 7. Critical Performance Targets

| Metric | Target | How |
|--------|--------|-----|
| LCP (Largest Contentful Paint) | < 2.0s | ISR + edge cache |
| TTFB (Time to First Byte) | < 200ms | Cloudflare CDN |
| Price API response | < 50ms (cache hit), < 150ms (cache miss) | Redis + Mongo indexes |
| Chart API response | < 100ms | Pre-aggregated candles |
| Subscription form submit | < 500ms | Async email send |
| Alert delivery latency | < 2 min from trigger | Direct BullMQ processing |

---

## 8. Scaling Thresholds & Upgrade Triggers

| User threshold | Action |
|----------------|--------|
| 0 – 5K MAU | MVP stack works as-is (~$30/mo) |
| 5K – 50K MAU | Upgrade Vercel to Pro ($20), MongoDB to M10 ($57) |
| 50K – 500K MAU | Add Cloudflare Pro ($20), scale Redis tier, add worker replicas |
| 500K+ MAU | Consider ClickHouse migration for candles, CDN-level caching |

---

**End of `01-ARCHITECTURE-SPEC.md`. Proceed to `02-DISCLAIMER-SYSTEM.md`.**
