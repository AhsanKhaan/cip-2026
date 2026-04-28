# CIP-2026 — Claude Code Master Context

> **Read this file first in every session.** It contains the locked tech stack, business rules, and architectural decisions for the Commodity Intelligence Platform.

---

## Project Overview

**Product:** Commodity Intelligence Platform — real-time gold/silver/copper prices, cryptocurrency feeds, and currency converter (Phase 2). Targets US, UK, Pakistan, India audiences.

**Owner:** Solo founder, Singapore-based, beginner technical level.

**Scale target:** 1 million MAU.

**Stack philosophy:** Pre-computed reads, async writes, edge-cached responses. Worker writes to MongoDB; Vercel reads from cache → MongoDB → returns to user.

---

## Version Pins (April 2026 — Latest Stable, LOCKED)

```
next: ^16.2.4              react: ^19.2
typescript: ^5.x (strict)  tailwindcss: ^4.0 (Oxide engine)
zod: ^4.0                  @clerk/nextjs: ^7.2 (Core 3)
@upstash/redis: ^1.37      @upstash/ratelimit: ^2.0.6
mongodb: ^6.x              bullmq: ^5.x
pino: ^9.x                 vitest: ^3.x
playwright: ^1.x           @tiptap/react: ^3.x
lucide-react: ^1.8         date-fns: ^4.x
nanoid: ^5.x               libphonenumber-js: ^1.x
react-hook-form: ^7.x      @hookform/resolvers: ^3.x
lightweight-charts: latest resend: ^4.x
msw: ^2.x                  tw-animate-css: latest
```

---

## Tech Stack (LOCKED — never substitute)

- **Framework:** Next.js 16.2 App Router (TypeScript strict mode)
- **Database:** MongoDB Atlas (native driver — NOT Mongoose)
- **Cache:** Upstash Redis HTTP API (for Vercel API routes only)
- **Queue:** BullMQ on Hetzner with Local Redis (NOT Upstash for BullMQ)
- **Auth:** Clerk v7 (@clerk/nextjs) with TOTP MFA
- **Worker:** Hetzner CX22 Singapore ($4.51/mo) running BullMQ
- **Hosting:** Vercel Hobby (free)
- **CDN/DNS/SSL:** Cloudflare (free tier)
- **Backups:** Cloudflare R2 (zero egress fees)
- **UI:** shadcn/ui + Tailwind v4 (use `tw-animate-css` NOT `tailwindcss-animate`)
- **Editor:** Tiptap v3 (free MIT extensions only)
- **Charts:** lightweight-charts (NOT Recharts, NOT Chart.js)
- **Email:** Resend + React Email
- **Logging:** Pino → MongoDB logs collection
- **Testing:** Vitest + Playwright + @fast-check/vitest + MSW

---

## Locked Libraries (Use ONLY These)

- **Validation:** Zod v4 — `import { z } from 'zod/v4'`
- **DB driver:** native `mongodb` (NOT Mongoose)
- **Cache:** `@upstash/redis` + `@upstash/ratelimit`
- **Auth:** Clerk v7+ — auth file is `proxy.ts` not `middleware.ts`
- **Forms:** `react-hook-form` + `@hookform/resolvers/zod`
- **Icons:** `lucide-react` (NEVER heroicons, FontAwesome)
- **Charts:** `lightweight-charts` (NEVER Recharts, Chart.js)
- **Email:** Resend + React Email
- **Logger:** Pino
- **Testing:** Vitest + Playwright + @fast-check/vitest
- **HTTP mocking:** MSW v2 (in tests)
- **CMS editor:** Tiptap v3 (do NOT enable paid collaboration features)
- **Markdown:** `next-mdx-remote/rsc`
- **Phone:** `libphonenumber-js`
- **Dates:** `date-fns` + `date-fns-tz` (NEVER moment.js, dayjs)
- **CSS animations:** `tw-animate-css` (Tailwind v4)

---

## NEVER Do These (Auto-Fail Conditions)

### Framework
1. NEVER use `middleware.ts` — Next.js 16 renamed to `proxy.ts`
2. NEVER use sync params in pages — must be `const { slug } = await params`
3. NEVER use Pages Router — App Router only
4. NEVER use `tailwindcss-animate` — use `tw-animate-css` (Tailwind v4)
5. NEVER use Zod v3 imports `from 'zod'` in new code — `from 'zod/v4'`
6. NEVER disable TypeScript strict mode

### Libraries
7. NEVER use Mongoose — native `mongodb` driver only
8. NEVER use Recharts or Chart.js — use lightweight-charts
9. NEVER use moment.js or dayjs — use date-fns
10. NEVER use heroicons or FontAwesome — use lucide-react
11. NEVER use `console.log` — use Pino logger

### Architecture
12. NEVER call `fetch('https://api.metalpriceapi.com/...')` directly — use `fetchMetalpriceLatest()` helper
13. NEVER instantiate `new WebSocket()` for Binance — use `createBinanceWS()` helper
14. NEVER use Upstash for BullMQ — Local Redis on Hetzner (TCP required, Upstash HTTP incompatible)
15. NEVER fetch from external APIs inside Next.js API routes — read from MongoDB/Redis only
16. NEVER trust client-supplied timestamps — server uses `new Date()`
17. NEVER use `setInterval` for cron-like scheduling — use BullMQ schedulers
18. NEVER hardcode tola as 12.5g only — support both 11.6638g (standard) and 12.5g (bazaar)

### MetalpriceAPI
19. NEVER use `&symbols=` query param — use `&currencies=`
20. NEVER read `rates.XAU` as USD/oz — use `rates.USDXAU` (inverse field)
21. NEVER subscribe to MetalpriceAPI Free tier — Basic Plus minimum for 60s updates
22. NEVER set `PRICE_DATA_MODE=live` in development without explicit reason

### Security
23. NEVER store secrets in code — environment variables only
24. NEVER prefix server-only secrets with `NEXT_PUBLIC_`
25. NEVER expose port 6379 (Redis) to internet — bind 127.0.0.1 only
26. NEVER use `PasswordAuthentication yes` in SSH config
27. NEVER use `PermitRootLogin yes` in SSH config
28. NEVER set MongoDB Atlas IP whitelist to 0.0.0.0/0 in production
29. NEVER skip rate limiting on public API endpoints
30. NEVER skip Zod validation on API inputs

### Content / Compliance
31. NEVER scrape prices from Kitco, Goldprice.org, or Bloomberg — licensed APIs only
32. NEVER write "Buy now" or "guaranteed returns" content (YMYL violation)
33. NEVER use author name "Admin" — real name with credentials required
34. NEVER auto-redirect users by IP geolocation — use a banner instead
35. NEVER reproduce article paragraphs from competitors — paraphrase + cite
36. NEVER reproduce song lyrics, poems, or other copyrighted creative works

### Development
37. NEVER commit `.env`, `.env.local`, or any file with real secrets
38. NEVER commit real API keys — only commit MSW fixtures
39. NEVER share Atlas connection strings between production and development
40. NEVER use Clerk production keys in local dev — use `pk_test_*` / `sk_test_*`

---

## ALWAYS Do These

### Code
1. ALWAYS validate inputs with Zod v4 before any operation
2. ALWAYS wrap API routes with `withLogging()` and `withRateLimit()`
3. ALWAYS use module-level cached MongoDB client
4. ALWAYS use TypeScript — no `.js` files in source
5. ALWAYS add loading + error states to UI components
6. ALWAYS add `tabular-nums` class on numeric/price displays
7. ALWAYS add correlation ID (`x-trace-id`) to logs

### Next.js 16 Specifics
8. ALWAYS use async params: `const { slug } = await params`
9. ALWAYS place Clerk auth in `proxy.ts` not `middleware.ts`
10. ALWAYS export the function as `proxy()` (not `middleware()`)

### Time / Timestamps
11. ALWAYS store timestamps as native `Date` objects (MongoDB stores UTC BSON)
12. ALWAYS use `new Date()` on server — never trust client timestamps
13. ALWAYS set server timezone to UTC (`timedatectl set-timezone UTC`)
14. ALWAYS convert to user's timezone only at render time in React (use `date-fns-tz`)
15. ALWAYS store both `priceTimestamp` (from API) and `storedAt` (server) on price ingestion
16. ALWAYS use `getUTCHours()` / `getUTCDay()` instead of `getHours()` / `getDay()`

### Data Pipeline
17. ALWAYS use `fetchMetalpriceLatest()` helper for all MetalpriceAPI calls
18. ALWAYS use `createBinanceWS()` helper for crypto WebSocket
19. ALWAYS log `X-API-CURRENT` and `X-API-QUOTA` headers from MetalpriceAPI
20. ALWAYS alert admin when API quota exceeds 80%
21. ALWAYS pre-compute regional rates server-side (not at API time)
22. ALWAYS use BullMQ cron schedulers, never `setInterval`

### Mock Mode
23. ALWAYS default `PRICE_DATA_MODE=mock` in development and tests
24. ALWAYS use MSW handlers in all Vitest/Playwright tests
25. ALWAYS log mode on worker startup so devs know which mode is active

### Localization / SEO
26. ALWAYS include `hreflang` tags on localized pages (`/uk/`, `/pk/`, `/in/`)
27. ALWAYS include "Last reviewed" date and author credentials on YMYL content
28. ALWAYS cite primary sources (LBMA, SBP, RBI, SEC) in financial articles
29. ALWAYS include financial disclaimer component on YMYL pages

### Security & Operations
30. ALWAYS run `pnpm audit` after adding dependencies
31. ALWAYS rotate API keys every 90 days
32. ALWAYS bind local Redis to 127.0.0.1 only with password
33. ALWAYS use UFW default deny on Hetzner (only port 22 inbound)
34. ALWAYS use `tw-animate-css` import for animations (Tailwind v4)
35. ALWAYS run weekly Hetzner snapshot (cron Sundays 2 AM UTC)
36. ALWAYS run MongoDB backup to R2 every 15 days (1st & 16th)

### Local Dev
37. ALWAYS run `docker compose -f docker-compose.dev.yml up -d` for local Redis
38. ALWAYS use SEPARATE Atlas dev cluster (never share with production)
39. ALWAYS use SEPARATE Upstash dev database
40. ALWAYS use Clerk **test** instance keys in local dev

---

## Architecture Read Flow

```
User → Cloudflare CDN → Vercel ISR → Upstash Redis (cache) → MongoDB Atlas
                                          ↑
                              Hetzner Worker (every 60s)
                                          ↑
                          MetalpriceAPI + Binance WebSocket
                                          ↑
                            Mock layer in dev (zero API hits)
```

User requests **never** call MetalpriceAPI directly. The worker writes prices to MongoDB and Upstash; Vercel reads from cache → MongoDB → returns to user.

---

## Database Collections

| Collection | Purpose | Retention |
|---|---|---|
| `logs` | Pino structured logs | 30-day TTL |
| `live_prices` | Latest price snapshot per symbol | Permanent |
| `candles_1m` | 1-minute OHLC candles | 7-day TTL |
| `candles_1h` | 1-hour OHLC candles | 365-day TTL |
| `candles_1d` | 1-day OHLC candles | Forever |
| `forex_rates` | Currency snapshots | Permanent |
| `forex_candles_1h` | Forex hourly OHLC | 365-day TTL |
| `currencies_meta` | Currency display config | Permanent |
| `regional_rates` | Pre-computed PK/IN karat × unit tables | Permanent |
| `posts` | CMS articles | Permanent |
| `subscribers` | Email list | Permanent |
| `jsonld_templates` | SEO schema templates | Permanent |
| `disclaimers` | YMYL legal content | Permanent |
| `security_scans` | npm audit + Snyk results | 90-day TTL |
| `alerts` | User price alerts | Permanent |
| `conversion_log` | Anonymous conversion analytics | 90-day TTL |

---

## Price Data Sources

- **Metals:** MetalpriceAPI Basic Plus (60-second polling, Hetzner worker)
- **Crypto:** Binance public WebSocket (real-time, Hetzner worker)
- **Forex:** Same MetalpriceAPI call (no separate API needed — included free)
- **Fallbacks:** MetalsAPI (metals backup), CoinGecko (crypto backup)
- **Mock:** Random walk generator (`apps/worker/src/mocks/metalpriceapi/`)

---

## Units (CRITICAL for Pakistan/India)

```
1 troy oz       = 31.1034768 g  (international standard)
1 standard tola = 11.6638125 g  (Indian, formal pricing)
1 bazaar tola   = 12.5 g        (Pakistani Sarafa dealers — must support both)
1 kg            = 1000 g
```

**Pakistan karats:** 24K, 22K, 21K, 20K, 18K
**India karats:** 24K, 22K, 18K
**Pakistan primary unit:** tola (with toggle for standard vs bazaar)
**India primary unit:** 10 gram

---

## Environment Modes

```
PRICE_DATA_MODE=mock      → 100% mock data (zero API hits)    [dev default]
PRICE_DATA_MODE=fixture   → Replay last real response (zero)  [staging]
PRICE_DATA_MODE=live      → Hits real API (production only)   [prod only]
```

Auto-detect when not set:
- Local dev → `mock`
- CI tests → `mock` (via MSW)
- Vercel preview → `fixture`
- Production → `live`

---

## Design System

- **Theme:** Dark-first ("Bloomberg Terminal meets 2026")
- **Brand:** gold `#D4AF37`, silver `#C0C0C0`, copper `#B87333`, crypto `#F7931A`
- **Up/Down:** green `#22c55e` / red `#ef4444`
- **Font:** Inter (UI) + JetBrains Mono (numeric/code)
- All price displays must use `font-feature-settings: "tnum"` (`tabular-nums` class)

---

## Folder Structure

```
cip-2026/
├── .claude/
│   ├── CLAUDE.md (this file — or at root)
│   ├── AGENTS.md
│   ├── SKILLS.md
│   ├── settings.json
│   └── context/glossary.md
├── apps/
│   ├── web/        # Next.js 16 frontend
│   └── worker/     # Hetzner background worker
├── packages/
│   ├── shared/     # Types + constants
│   └── ui/         # Shared components
├── docs/           # 30 implementation docs
└── docker-compose.dev.yml
```

---

## Reference Documents (Consult Before Implementing)

When asked to do anything, consult these in `/docs`:

| Topic | Document |
|---|---|
| Architecture | `01-ARCHITECTURE-SPEC.md` |
| API contracts | `09-API-CONTRACTS.md` |
| MongoDB schemas | `08-MONGODB-SCHEMAS.md` |
| Code prompts | `05-CLAUDE-CODE-PROMPTS.md` |
| Design prompts | `06-CLAUDE-DESIGN-PROMPTS.md` |
| Disclaimers | `02-DISCLAIMER-SYSTEM.md` |
| Subscriptions | `03-SUBSCRIPTION-SYSTEM.md` |
| Design system | `04-DESIGN-SYSTEM.md` |
| Logging | `11-LOGGING-OBSERVABILITY.md` |
| Testing | `12-TESTING-STRATEGY.md` |
| Security audits | `13-SECURITY-VULNERABILITY.md` |
| CMS | `14-CMS-SYSTEM.md` |
| MFA/Auth | `15-MFA-AUTHENTICATION.md` |
| JSON-LD | `16-DYNAMIC-JSONLD.md` |
| Hetzner setup | `21-HETZNER-VPS-IMPLEMENTATION.md` |
| MetalpriceAPI + forex + YMYL | `22-METALPRICEAPI-FIX-FOREX-YMYL.md` |
| Historical backfill | `23-HISTORICAL-DATA-BACKFILL.md` |
| Time sync | `24-TIME-SYNCHRONIZATION.md` |
| Regional units (PK/IN) | `25-REGIONAL-UNITS-PAKISTAN-INDIA.md` |
| Disaster recovery | `26-DISASTER-RECOVERY-PLAN.md` |
| Backups + security | `27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md` |
| Beginner Day 0 | `28-BEGINNER-DAY-ZERO-COMPLETE.md` |
| Mock data system | `29-MOCK-DATA-SYSTEM.md` |
| Local dev VPS | `30-LOCAL-DEV-VPS-SETUP.md` |
| Sprint plan | `18-UPDATED-SPRINT-PLAN.md` |
| QA checklist | `10-QA-CHECKLIST.md` |
| Master index | `00-START-HERE.md` |

---

## Cost Targets

```
Production: ~$25.50/mo
- Hetzner CX22:           $4.51
- MetalpriceAPI Basic+:   $16.99
- Hetzner snapshots:      $2.00 (weekly, 4 retained)
- Upstash Redis:          $1.00
- MongoDB R2 backups:     $0.10
- Atlas M0, Vercel Hobby, Clerk free, Resend free, Cloudflare free, Binance: $0
```

Scale thresholds:
- 5K MAU → Vercel Pro (+$20)
- 10K MAU → Clerk Pro (+$25)
- 50K users → Atlas M10 (+$57)
- 100K users → Axiom logs (+$25)

---

## Self-Check Before Responding

Before generating code, verify:

1. ✅ Did I check the relevant doc in `/docs/`?
2. ✅ Am I using the locked library (not a substitute)?
3. ✅ Am I using `proxy.ts` instead of `middleware.ts`?
4. ✅ Am I using `await params` (not sync params)?
5. ✅ Am I using `fetchMetalpriceLatest()` (not direct fetch)?
6. ✅ Did I add Zod validation?
7. ✅ Did I add `withLogging()` wrapper?
8. ✅ Did I use Pino, not console.log?
9. ✅ Did I store timestamps as Date objects, not strings?
10. ✅ For PK/IN content: did I use the units library and show both tola standards?

If any answer is "no" — stop and fix before continuing.

---

*Master context for Claude Code — CIP-2026 v3.4 (April 2026)*
*Total docs: 30. Read `00-START-HERE.md` for full index.*
