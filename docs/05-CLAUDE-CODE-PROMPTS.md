# 🤖 05 — Claude Code Prompts (Token-Optimized)

**Strategy:** Paste **System Context** once per session, then fire short **Task Prompts**. This saves 60–80% of tokens vs. restating architecture every time.

---

## 🧠 SYSTEM CONTEXT (paste this first, ONCE per Claude Code session)

```
You are a senior Next.js + MongoDB engineer building a commodity intelligence
platform (gold, silver, copper, crypto). Follow these rules strictly:

STACK
- Next.js 15 with App Router, TypeScript strict mode
- MongoDB Atlas with Time-Series collections
- Upstash Redis for caching
- BullMQ workers on separate Node process (not Next.js)
- Zod for all validation
- shadcn/ui + Tailwind CSS
- React Server Components by default; Client Components only when needed

ARCHITECTURE
- apps/web = Next.js frontend (Vercel)
- apps/worker = BullMQ worker (Hetzner VPS)
- packages/shared = shared types/schemas
- Every env var accessed via typed helper, never process.env directly

DATA FLOW
- Prices ingested every 60s by worker → MongoDB → Redis cache → Next.js pages
- NEVER call external APIs from Next.js API routes; always read from DB/cache
- ISR pages use revalidateTag(), worker triggers via /api/revalidate webhook

CODE STANDARDS
- All MongoDB operations use Zod-validated schemas
- All API routes return typed responses via NextResponse.json
- Errors logged via structured logger (pino), never console.log in prod code
- Connection pooling: module-level cached client for Mongo, HTTP for Upstash
- Use async/await, never .then() chains
- File naming: kebab-case for files, PascalCase for components, camelCase for functions

SECURITY
- Zod validate every input including route params and search params
- Rate limit with Upstash @upstash/ratelimit
- Sanitize HTML with DOMPurify
- Never log PII (email, phone) — hash or redact
- Use environment variables, never hardcode secrets

DELIVERABLES
- Each task = complete working code, no placeholders
- Include imports, types, error handling, edge cases
- If a file already exists, show full updated file
- Explain only WHY choices were made, not WHAT the code does
- Keep responses focused — no tangents or over-explanation
```

---

## 📋 TASK PROMPT INDEX

### Phase 1 — Foundation
- [T1.1] Project bootstrap (monorepo, tooling)
- [T1.2] MongoDB connection + time-series collections
- [T1.3] Redis client + rate limiter
- [T1.4] Shared schemas (Zod types)
- [T1.5] Env var management
- [T1.6] Logger setup
- [T1.7] Seed script runner

### Phase 2 — Ingestion Worker
- [T2.1] BullMQ queue setup
- [T2.2] Metals API ingestion job (cron 60s)
- [T2.3] Binance WebSocket listener
- [T2.4] Hourly aggregation job
- [T2.5] Daily aggregation job
- [T2.6] Failover logic (primary → fallback → stale)
- [T2.7] Worker Dockerfile

### Phase 3 — Next.js API Routes
- [T3.1] GET /api/price/[symbol]
- [T3.2] GET /api/candles/[symbol]
- [T3.3] POST /api/subscribe
- [T3.4] GET /api/verify
- [T3.5] POST /api/revalidate (worker webhook)
- [T3.6] POST /api/admin/broadcast

### Phase 4 — Disclaimer Engine
- [T4.1] Disclaimer library (fetch + cache)
- [T4.2] Category detection logic
- [T4.3] LegalDisclaimer component
- [T4.4] Seed disclaimers into MongoDB

### Phase 5 — Pages & UI
- [T5.1] Landing page
- [T5.2] Category price page (/gold, /silver etc.)
- [T5.3] Blog post page (MDX)
- [T5.4] Subscription form
- [T5.5] Live price card component
- [T5.6] Price chart component

### Phase 6 — Admin
- [T6.1] Admin auth (Clerk + role check)
- [T6.2] Admin subscribers list
- [T6.3] Admin broadcast composer
- [T6.4] Admin disclaimer editor

---

## 📌 ATOMIC TASK PROMPTS

### [T1.1] Project Bootstrap

```
Create the monorepo structure.

Requirements:
- Turborepo
- Workspaces: apps/web, apps/worker, packages/shared
- TypeScript strict mode in all packages
- ESLint + Prettier at root
- Node 20+

Deliver:
- package.json (root)
- turbo.json
- tsconfig.base.json
- apps/web/package.json (Next.js 15, React 19, shadcn/ui deps)
- apps/worker/package.json (BullMQ, mongodb, ws, pino)
- packages/shared/package.json (zod only)
- .gitignore
- .env.example with all vars from architecture spec
- README.md with setup steps
```

### [T1.2] MongoDB Connection + Time-Series Collections

```
Create apps/web/lib/mongo.ts AND apps/worker/src/lib/mongo.ts.

Requirements:
- Module-level cached MongoClient (prevent connection storms in serverless)
- Connection string from env var MONGODB_URI
- Type-safe collection accessors for: live_prices, candles_1m, candles_1h,
  candles_1d, disclaimers, subscribers, broadcast_log, subscriber_events,
  alerts, blogs, audit_log
- Initialization function that creates time-series collections on first run:
  * candles_1m: timeField=timestamp, metaField=symbol, granularity=minutes,
    expireAfterSeconds=60 days
  * candles_1h: timeField=timestamp, metaField=symbol, granularity=hours,
    expireAfterSeconds=365 days
  * candles_1d: timeField=timestamp, metaField=symbol, granularity=hours
    (no expiry)
- All indexes from architecture spec
- Graceful shutdown handler

Do NOT use Mongoose. Use native MongoDB driver only.
```

### [T1.3] Redis Client + Rate Limiter

```
Create apps/web/lib/redis.ts.

Requirements:
- @upstash/redis client
- REST-based (works in Edge runtime)
- Helper functions: get, set, setex, del, incr
- Rate limiter using @upstash/ratelimit with sliding window
- Preconfigured rate limiters:
  * subscribe: 3 requests per IP per hour
  * api:price: 120 per IP per minute
  * api:candles: 60 per IP per minute
  * admin: 30 per user per minute

Export typed helpers. Include TypeScript example usage in JSDoc.
```

### [T1.4] Shared Schemas

```
Create packages/shared/src/schemas.ts containing ALL Zod schemas from the
project docs files 02-DISCLAIMER-SYSTEM.md and 03-SUBSCRIPTION-SYSTEM.md.

Include:
- CategoryEnum, ChannelEnum
- DisclaimerSchema
- SubscriberSchema (including nested phone object)
- SubscribeRequestSchema
- BroadcastLogSchema
- SubscriberEventSchema
- PriceSchema (symbol, price, currency, change24h, timestamp, isStale)
- CandleSchema (symbol, interval, open, high, low, close, volume, timestamp)
- AlertSchema (userId, symbol, direction, threshold, active, channels)

For each schema, export:
- The zod schema itself
- The TypeScript type via z.infer
- A typed validator function: validateX(data): X

Include JSDoc comments explaining fields.
```

### [T1.5] Env Var Management

```
Create packages/shared/src/env.ts.

Requirements:
- Typed env schema using Zod
- Validates on module load (fails fast with clear error)
- Separate schemas for web vs worker (they need different vars)
- Export typed helpers:
  * getWebEnv(): WebEnv
  * getWorkerEnv(): WorkerEnv
- Include all vars from 01-ARCHITECTURE-SPEC.md section 5

Never access process.env directly elsewhere in codebase.
```

### [T2.2] Metals API Ingestion Job

```
Create apps/worker/src/jobs/ingest-metals.ts.

Requirements:
- Fetches gold, silver, copper prices from MetalpriceAPI every 60 seconds
- Uses batch endpoint: GET https://api.metalpriceapi.com/v1/latest?api_key=X&base=USD&currencies=XAU,XAG,XCU
- Upserts into live_prices collection (one doc per symbol)
- Upserts into candles_1m using minute-bucketed timestamp:
  * $setOnInsert: symbol, timestamp, open (first price of minute)
  * $max: high
  * $min: low
  * $set: close (latest price)
- On primary API failure: retry 3× with exponential backoff, then try Metals-API
- On all sources failing: mark live_prices.isStale = true, log error
- After successful ingestion: fire revalidation webhook for each symbol
- After ingestion: queue checkAlerts job for each symbol

Export as BullMQ processor function. Include full error handling.
```

### [T2.3] Binance WebSocket Listener

```
Create apps/worker/src/jobs/ingest-crypto-ws.ts.

Requirements:
- Persistent WebSocket to wss://stream.binance.com:9443/ws/btcusdt@ticker/ethusdt@ticker
- Auto-reconnect on close with 5s backoff
- Heartbeat ping every 30s, reconnect if no pong in 60s
- On each tick message: parse and upsert live_prices + candles_1m
- Rate-limit writes: max 1 write per symbol per second (buffer incoming ticks)
- Log connection state changes (connect/disconnect/reconnect) with structured logger
- Graceful shutdown: close WS cleanly on SIGTERM

This should run as a long-lived process, not a BullMQ job.
Export a start() function that the worker entrypoint calls.
```

### [T2.4] Hourly Aggregation Job

```
Create apps/worker/src/jobs/aggregate-hourly.ts.

Requirements:
- Runs at minute 0 of every hour
- Aggregates previous hour's candles_1m into candles_1h
- Uses MongoDB $group pipeline (do NOT loop in Node):
  * $match: timestamp in previous hour
  * $sort: timestamp ascending
  * $group by symbol:
    - open: $first('$open')
    - close: $last('$close')
    - high: $max('$high')
    - low: $min('$low')
    - volume: $sum('$volume')
- Bulk upsert into candles_1h with filter { symbol, timestamp: hourBucket }
- Idempotent (safe to re-run without duplicates)
- Log row count processed

Same pattern for Task T2.5 (aggregate-daily).
```

### [T2.6] Failover Logic

```
Create apps/worker/src/lib/price-fetcher.ts.

Requirements:
- Single function fetchPrices(symbols): returns PriceData[]
- Tries sources in order:
  1. MetalpriceAPI (primary)
  2. Metals-API (fallback)
  3. Stale data from live_prices collection (marked isStale=true)
- Each source has 5s timeout
- Logs which source succeeded
- Throws only if all sources fail AND no stale data exists
- Returns same shape regardless of source

Include retry logic with exponential backoff (3 attempts per source).
```

### [T3.1] Price API Route

```
Create apps/web/app/api/price/[symbol]/route.ts.

Requirements:
- GET handler
- Validates symbol against CategoryEnum (Zod)
- Rate limit check via Redis (120/min/IP)
- Cache key: price:${symbol}, 30s TTL
- Cache miss: query live_prices collection, cache result
- Response includes Cache-Control header: public, s-maxage=30, stale-while-revalidate=300
- Returns 200 with PriceSchema-shaped JSON
- Returns 404 if symbol not found
- Returns 429 if rate limited
- Returns 500 with generic error message on internal errors (log full error server-side)

Use Edge runtime for lowest latency.
```

### [T3.2] Candles API Route

```
Create apps/web/app/api/candles/[symbol]/route.ts.

Requirements:
- GET handler, search params: range (1D|7D|1M|3M|1Y|5Y), default 1D
- Rate limit 60/min/IP
- Resolve range → collection + time window:
  * 1D: candles_1m, last 24h
  * 7D: candles_1h, last 7d
  * 1M: candles_1h, last 30d
  * 3M: candles_1d, last 90d
  * 1Y: candles_1d, last 365d
  * 5Y: candles_1d, last 5y, $bucketAuto to 260 points
- Cache TTL varies: 60s for 1D, 15min for 1M, 1h for 1Y
- Downsample to max 300 points using $bucketAuto
- Return: [{ t, o, h, l, c, v }] (short field names to reduce payload)

Optimize for mobile bandwidth — gzip response, minimize payload.
```

### [T3.3] Subscribe API Route

```
Create apps/web/app/api/subscribe/route.ts.

Requirements:
- POST handler
- Validate body with SubscribeRequestSchema
- Rate limit: 3/hour/IP, 100/day/IP
- Lowercase & trim email
- Validate phone with libphonenumber-js if provided
- Check existing subscriber by email:
  * If verified: update categories + phone, return 200 "Preferences updated"
  * If unverified: regenerate token, resend verification
  * If new: insert with verified=false + token
- Generate verification token (nanoid, 32 chars)
- Send verification email via Resend (use React Email template from /emails)
- Log event to subscriber_events collection
- Return 200 with generic "check your inbox" message (don't leak existence)

Include IP address + user agent in subscriber doc for audit.
Honeypot field: if body.website is not empty, silently 200 but do nothing.
```

### [T4.1] Disclaimer Library

```
Create apps/web/lib/disclaimers.ts based on 02-DISCLAIMER-SYSTEM.md.

Requirements:
- detectCategory(pathname, frontmatter): string[]
- detectPageType(pathname): 'blog' | 'price' | 'calculator' | 'marketing'
- selectDisclaimers(pageType, categories, hasAffiliateLinks): string[] (keys)
- getDisclaimers(keys): Promise<Disclaimer[]>
  * Checks Redis first (1h TTL cache)
  * Falls back to MongoDB disclaimers collection
  * Filters by isActive=true
- detectAffiliateLinks(content): boolean

Implement exactly as specified in section 5 of 02-DISCLAIMER-SYSTEM.md.
Use React's cache() wrapper for deduping within a single request.
```

### [T4.3] LegalDisclaimer Component

```
Create apps/web/components/legal/LegalDisclaimer.tsx
AND apps/web/components/legal/DisclaimerCard.tsx.

Requirements:
- LegalDisclaimer is a React Server Component (async)
- Props: pathname, frontmatter, hasAffiliateLinks, position ('top'|'bottom'|'footer')
- Uses lib/disclaimers helpers to determine which disclaimers to render
- Filters by position:
  * top: banner + box styles
  * bottom: box only
  * footer: footer-text only
- DisclaimerCard renders a single disclaimer:
  * banner: full-width strip, colored border-left
  * box: rounded card with icon + title + body
  * footer-text: small muted text, collapsible
- Body is MDX-rendered (use @next/mdx or next-mdx-remote)
- Severity determines color: info=blue, warning=amber, critical=red
- Full accessibility: role='note' or 'alert' based on severity

Style with Tailwind using design tokens from 04-DESIGN-SYSTEM.md.
```

### [T4.4] Seed Disclaimers

```
Create apps/worker/src/seeds/disclaimers.ts
AND apps/worker/src/seeds/disclaimer-data.ts.

Requirements:
- disclaimer-data.ts contains an array of all 11 disclaimers from section 4
  of 02-DISCLAIMER-SYSTEM.md (general, educational, affiliate, data-accuracy,
  calculator-accuracy, no-advice, gold, silver, copper, crypto, stocks).
- Each entry has all fields of DisclaimerSchema with proper defaults.
- disclaimers.ts runs: for each seed, upsert into disclaimers collection
  with key as unique identifier.
- Safe to re-run (upsert, not insert).
- Logs count of inserted/updated.
- Call via: pnpm --filter worker seed:disclaimers
```

### [T5.4] Subscription Form

```
Create apps/web/components/subscription/SubscribeForm.tsx.

Requirements:
- Client Component ('use client')
- Fields exactly per 03-SUBSCRIPTION-SYSTEM.md section 4
- Form library: react-hook-form + @hookform/resolvers/zod
- Validation schema: SubscribeRequestSchema from shared package
- Phone input with country code selector (use react-phone-input-2 or similar)
- Categories as grid of checkbox cards with icons
- Props:
  * defaultCategories?: Category[] (for pre-selection on category pages)
  * source?: string (the page URL, passed to API)
  * variant?: 'inline' | 'modal' | 'sidebar'
- On submit:
  * Disable form, show loading state
  * POST /api/subscribe
  * On success: show "Check your inbox" success state (confetti optional)
  * On error: inline error messages + retry affordance
- Honeypot field (hidden input named 'website')
- Accessible: proper labels, aria-describedby for errors
- Mobile: 44×44px tap targets, full-width inputs

Style using design tokens. Dark-first.
```

### [T5.5] LivePriceCard

```
Create apps/web/components/price/LivePriceCard.tsx.

Requirements:
- Accepts props from 04-DESIGN-SYSTEM.md section 5.1
- Server Component by default (fetches initial price)
- Wraps a Client Component for live updates (TanStack Query)
- Anatomy exactly as described in design spec
- States: default, loading (skeleton), fresh-update (flash), stale (warning), error
- Price uses font-mono with font-variant-numeric: tabular-nums
- Sparkline via lightweight-charts library
- aria-live='polite' on price value for screen readers
- Flash animation only if prefers-reduced-motion is NOT set

Variants: full, compact, inline.
```

### [T5.6] PriceChart

```
Create apps/web/components/price/PriceChart.tsx.

Requirements:
- Client Component ('use client')
- Library: lightweight-charts v4+
- Props: symbol, defaultRange (default '1D'), height (default 500)
- Range selector tabs: 1D / 7D / 1M / 3M / 1Y / 5Y
- Chart type toggle: Line / Candles / Area
- Fetches data from /api/candles/[symbol]?range=X via TanStack Query
- Crosshair tooltip shows OHLC at hover
- Respects design tokens for colors (dark theme)
- Loading state: chart-shaped skeleton
- Error state: "Chart data unavailable" with retry button
- Auto-refresh every 60s for 1D view, longer intervals for other ranges
- Touch-friendly on mobile: pinch zoom, pan

Include resize observer to handle responsive width changes.
```

### [T6.3] Admin Broadcast Composer

```
Create apps/web/app/admin/broadcasts/new/page.tsx
AND apps/web/app/api/admin/broadcast/route.ts.

Requirements (page):
- Auth: Clerk + admin role check (redirect to / if not admin)
- Form fields:
  * Channel: radio (email / whatsapp / both)
  * Categories: checkbox array (multi-select)
  * Subject (email only)
  * Body: rich text editor (tiptap)
  * Preview HTML (React Email render)
  * Schedule: 'Send now' or datetime picker
- Segment preview: live count of matching subscribers (debounced API call)
- Test send: sends to admin email only
- Submit → POST to /api/admin/broadcast

Requirements (API):
- Zod validate body
- Admin auth check
- Create broadcast_log entry with status='draft'
- Query subscribers: { categories: $in, emailVerified: true,
  unsubscribedAt: null, 'channels.<channel>': true }
- If whatsapp: also require 'phone.verified': true
- Queue BullMQ jobs in batches of 100
- Update broadcast_log status='sending'
- Return 202 with broadcastId for status polling
```

---

## 🎯 PROMPT TEMPLATE FOR NEW TASKS

When you need a new task not listed above, use this template:

```
Task: [T-ID] [Short name]

Context: [1 sentence about why this exists]

Files to create/modify:
- apps/web/...
- apps/worker/...

Requirements:
- [ ] [Specific behavior 1]
- [ ] [Specific behavior 2]
- [ ] [Edge case handling]
- [ ] [Performance requirement]

Integration points:
- Reads from: [which collection/cache/API]
- Writes to: [which collection/cache/event]
- Triggered by: [what calls this]

Acceptance criteria:
- [Observable behavior that proves it works]

Refer to project docs:
- XX-FILENAME.md section X for schema
- YY-FILENAME.md section Y for design tokens
```

---

## 💡 TOKEN-SAVING TIPS

1. **Never restate architecture in every prompt** — system context handles it
2. **Reference doc sections** instead of pasting content (`see 03-X section 4.2`)
3. **Group related tasks** in one session — Claude Code remembers across turns
4. **Ask for diffs, not full files** on edits: "Update X, show only changed sections"
5. **Commit between tasks** so you can say "continue from git HEAD"
6. **Keep your own cheatsheet** of paths/schemas — paste when needed
7. **Disable tools you don't need** — each unused tool steals tokens

---

**End of `05-CLAUDE-CODE-PROMPTS.md`. Proceed to `06-CLAUDE-DESIGN-PROMPTS.md`.**
