<div align="center">

# CIP-2026

### Commodity Intelligence Platform

**Real-time gold, silver, copper, crypto prices and currency converter for global markets.**

Built for the South Asian diaspora — targeting US 🇺🇸, UK 🇬🇧, Pakistan 🇵🇰, India 🇮🇳, and Gulf 🇦🇪.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Native_Driver-47A248?style=flat-square&logo=mongodb)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#license)

[Live Demo](#) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Documentation](./docs/00-START-HERE.md)

</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Backups & Recovery](#backups--recovery)
- [Documentation](#documentation)
- [Cost](#cost)
- [Roadmap](#roadmap)
- [Security](#security)
- [License](#license)

---

## About

CIP-2026 is a SaaS platform delivering real-time precious metals, cryptocurrency, and forex prices with:

- **60-second live updates** for gold, silver, copper (XAU, XAG, XCU)
- **Real-time crypto** via Binance WebSocket (BTC, ETH)
- **Currency converter** with 150+ world currencies (Phase 2)
- **Regional price tables** in tola, 10-gram, 1-gram for Pakistan/India audiences
- **Multi-karat support** (24K, 22K, 21K, 20K, 18K) with both standard and bazaar tola
- **Geo-localized SEO** targeting `/uk/`, `/pk/`, `/in/` markets via single domain + hreflang
- **YMYL-compliant content** with disclaimers, author credentials, and citations
- **CMS with Tiptap editor** featuring 4-stage workflow, expiring preview URLs, dynamic JSON-LD
- **MFA-protected admin** via Clerk TOTP + backup codes

**Target scale:** 1 million MAU
**Total monthly cost:** ~$25.50/mo at launch

---

## Features

### For Visitors
- 🪙 Live precious metal prices (gold, silver, copper) updated every 60 seconds
- ₿ Real-time cryptocurrency feeds (BTC, ETH) via WebSocket
- 💱 Currency converter (Phase 2) — supports remittance pairs (AED→PKR, AED→INR, GBP→PKR)
- 📊 Historical price charts (1D / 7D / 1M / 3M / 1Y / 5Y) powered by lightweight-charts
- 🇵🇰 🇮🇳 Regional rate tables in tola, 10-gram, 1-gram with multi-karat support
- 🏙️ City-specific pages (Karachi, Lahore, Mumbai, Delhi, Chennai…)
- 📧 Email subscription with category preferences (gold, silver, crypto, forex)
- 🌍 Geo-aware UX with `/pk/`, `/in/`, `/uk/` paths and hreflang tags

### For Admins (Authenticated + MFA)
- ✍️ CMS with Tiptap v3 markdown editor (links, tables, images, code blocks)
- 🔄 4-stage publishing workflow (Draft → Pending → Approved → Published)
- 🔒 Single-use preview URLs with configurable expiry (15min / 1h / 24h / 7d)
- 🏷️ Dynamic JSON-LD editor (form mode + JSON mode + Google Rich Results validator)
- 📊 Live log dashboard with filters, trace view, and live tail
- 🛡️ Security dashboard (npm audit, Snyk, dependency CVE tracking)
- 📈 Subscription broadcast manager with Resend integration
- 👥 Role hierarchy: viewer → author → editor → admin

### Engineering
- ✅ Pino → MongoDB structured logging with PII redaction + 30-day TTL
- 🧪 Vitest + Playwright + fast-check property testing (auto-generated from Zod schemas)
- 🔐 Clerk MFA enforced for all admin routes with 8-hour re-verify window
- 🚦 Upstash rate limiting per IP with graceful Redis fallback to MongoDB
- 📦 5-layer security: Husky pre-commit → CI Snyk/OSV → Dependabot → manual review → Snyk monitor
- 💾 Weekly Hetzner snapshots + 15-day MongoDB R2 backups
- ⏰ chrony NTP-synced UTC timezone across all servers
- 🌐 Cloudflare WAF + DDoS protection (free tier)

---

## Tech Stack

All versions are locked in `CLAUDE.md` and verified as latest stable for **April 2026**.

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | `^16.2.4` | App Router framework |
| **React** | `^19.2` | UI runtime |
| **TypeScript** | `^5.x` (strict) | Type safety |
| **Tailwind CSS** | `^4.0` (Oxide engine) | Styling |
| **shadcn/ui** | latest | Component primitives (Radix-based) |
| **lightweight-charts** | latest | TradingView-style price charts (NOT Recharts) |
| **Tiptap** | `^3.x` | CMS editor (free MIT extensions) |
| **lucide-react** | `^1.8` | Icons |
| **react-hook-form** + Zod | `^7` + `^4` | Type-safe forms |

### Backend / Worker
| Technology | Version | Purpose |
|---|---|---|
| **MongoDB** native driver | `^6.x` | Database (NOT Mongoose) |
| **Upstash Redis** | `^1.37` | Cache + rate limiting (HTTP API for Vercel) |
| **Local Redis** | (apt) | BullMQ job queue (TCP — Upstash incompatible with BullMQ) |
| **BullMQ** | `^5.x` | Job scheduling + queues |
| **Pino** | `^9.x` | Structured logging → MongoDB |
| **Zod** | `^4.0` | Runtime validation |
| **date-fns** | `^4.x` | Date utilities (NOT moment.js) |

### Auth, Email, Testing
| Technology | Version | Purpose |
|---|---|---|
| **@clerk/nextjs** | `^7.2` (Core 3) | Auth + MFA (TOTP) |
| **Resend** | `^4.x` | Transactional + broadcast email |
| **Vitest** | `^3.x` | Unit + integration tests |
| **Playwright** | `^1.x` | E2E + visual regression |
| **fast-check** | latest | Property-based testing |
| **Storybook** | latest | Component docs + interaction tests |

### Infrastructure
| Service | Plan | Cost |
|---|---|---|
| **Vercel** | Hobby | $0 |
| **MongoDB Atlas** | M0 (free tier) | $0 |
| **Upstash Redis** | Pay-as-you-go | ~$1/mo |
| **Hetzner Cloud** | CX22 Singapore | $4.51/mo |
| **MetalpriceAPI** | Basic Plus (60s updates) | $16.99/mo |
| **Cloudflare** | Free + R2 storage | ~$2/mo |
| **Clerk** | Free (10K MAU) | $0 |
| **Resend** | Free (3K emails/mo) | $0 |
| **Total** | | **~$25.50/mo** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            Cloudflare (DNS + SSL + WAF + CDN)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Next.js 16)                       │
│   ISR pages · API routes · Server Components · proxy.ts      │
└────────┬─────────────────────────────────────────┬──────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────┐                 ┌─────────────────────┐
│   Upstash Redis     │                 │   MongoDB Atlas     │
│   (HTTP cache)      │                 │   (time-series)     │
│   30s price TTL     │                 │   live_prices       │
│   rate limiting     │                 │   candles_1m/1h/1d  │
└─────────────────────┘                 │   posts, logs, etc. │
         ▲                              └──────────▲──────────┘
         │                                         │
         └────────────────┬────────────────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │  Hetzner CX22 (SG)   │
                │  Singapore — $4.51   │
                ├──────────────────────┤
                │  BullMQ + Local      │
                │  Redis + PM2         │
                │  · Metals 60s ingest │
                │  · Crypto WS live    │
                │  · Aggregation jobs  │
                │  · Alert checks      │
                └────────┬─────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌──────────┐
         │ Metal  │ │Metals  │ │ Binance  │
         │priceAPI│ │API     │ │   WS     │
         │primary │ │fallback│ │ +Coin-   │
         │        │ │        │ │ Gecko    │
         └────────┘ └────────┘ └──────────┘
```

**Read flow:** User → Cloudflare cache → Vercel ISR → Upstash → MongoDB (never calls MetalpriceAPI directly)

**Write flow:** Hetzner worker → MetalpriceAPI/Binance → MongoDB → Upstash → triggers Vercel revalidation

📊 [View interactive architecture diagram](./docs/CIP-DATA-FLOW-DIAGRAM.html)

---

## Project Structure

```
cip-2026/
├── .claude/                 # Claude Code workspace config
│   ├── CLAUDE.md            # Master rules (Claude reads first)
│   ├── AGENTS.md            # Redirect to CLAUDE.md
│   ├── SKILLS.md            # Custom Claude shortcuts
│   ├── settings.json        # Permissions + auto-load config
│   └── context/
│       └── glossary.md      # Domain terms (tola, candle, YMYL)
├── README.md                # This file
│
├── apps/
│   ├── web/                 # Next.js 16 frontend
│   │   ├── src/
│   │   │   ├── app/         # App Router pages + API routes
│   │   │   ├── components/  # Reusable React components
│   │   │   ├── lib/         # mongo, redis, logger, utils
│   │   │   └── hooks/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── worker/              # Hetzner background worker
│       ├── src/
│       │   ├── index.ts     # BullMQ scheduler + workers
│       │   ├── jobs/        # ingest-metals, crypto-ws, aggregation
│       │   └── lib/
│       ├── scripts/         # backfill, seeds, snapshots, backups
│       ├── ecosystem.config.js
│       └── package.json
│
├── packages/
│   ├── shared/              # Shared types + constants
│   └── ui/                  # Shared UI components
│
├── docs/                    # 28 implementation docs (READ THESE)
│   ├── 00-START-HERE.md
│   ├── 28-BEGINNER-DAY-ZERO-COMPLETE.md   ← Start here
│   └── ... (26 other specification docs)
│
├── .github/
│   └── workflows/           # CI/CD pipelines
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

> **Note on Claude file locations:** Claude Code supports `CLAUDE.md` at either the project root **or** inside `.claude/`. This project uses `.claude/CLAUDE.md` to keep the root tidy. If you also use other AI coding tools (Cursor, Zed, OpenCode, Aider), some expect `AGENTS.md` at the root for portability — symlink it if needed.

---

## Prerequisites

### On Your Computer
- **Node.js 22 LTS** ([download](https://nodejs.org))
- **pnpm 9.x** (`npm install -g pnpm`)
- **Git** ([download](https://git-scm.com))
- **VS Code** (recommended) with ESLint + Prettier + Tailwind extensions
- **Claude Code CLI** (`npm install -g @anthropic/claude-code`)

### Required Accounts
| Service | Purpose | Plan |
|---|---|---|
| [GitHub](https://github.com) | Code hosting | Free |
| [Vercel](https://vercel.com) | Frontend hosting | Hobby (free) |
| [MongoDB Atlas](https://mongodb.com/atlas) | Database | M0 (free) |
| [Upstash](https://upstash.com) | Redis cache | Free tier |
| [Clerk](https://clerk.com) | Auth + MFA | Free up to 10K MAU |
| [Resend](https://resend.com) | Email | Free 3K/mo |
| [MetalpriceAPI](https://metalpriceapi.com) | Price feeds | **Basic Plus $16.99** ⚠️ |
| [Hetzner Cloud](https://hetzner.com/cloud) | Worker VPS | $4.51/mo |
| [Cloudflare](https://cloudflare.com) | DNS + R2 backups | Free + ~$2 |

> ⚠️ **Critical:** MetalpriceAPI Free tier is daily updates only. You need **Basic Plus ($16.99/mo)** for 60-second updates.

---

## Quick Start

> 📘 **Beginner?** Read [`docs/28-BEGINNER-DAY-ZERO-COMPLETE.md`](./docs/28-BEGINNER-DAY-ZERO-COMPLETE.md) for a complete 3-5 hour walkthrough with every account setup, command, and verification step.

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cip-2026.git
cd cip-2026
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with credentials from your accounts (see [Environment Variables](#environment-variables) below).

### 4. Initialize Database

```bash
# Create MongoDB collections + indexes
pnpm tsx apps/worker/scripts/init-db.ts

# Seed currency metadata + disclaimers
pnpm tsx apps/worker/scripts/seed-currencies.ts
pnpm tsx apps/worker/scripts/seed-disclaimers.ts
```

### 5. Run Historical Backfill (Critical Before Launch)

This populates 5 years of daily data + 90 days of hourly data so charts work on Day 1.

```bash
CONFIRM_BACKFILL=yes pnpm tsx apps/worker/scripts/backfill-historical.ts
```

Takes ~3-5 minutes, uses ~44 MetalpriceAPI requests.

### 6. Start Development Servers

In one terminal — frontend:

```bash
pnpm dev
# Open http://localhost:3000
```

In another terminal — worker (locally for dev):

```bash
pnpm dev:worker
```

### 7. Start Claude Code (Optional but Recommended)

```bash
claude
# First message: "Read CLAUDE.md and confirm you understand the project"
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# === Database ===
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=cip_production

# === Cache (Upstash HTTP — for Vercel API routes) ===
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxx

# === Auth (Clerk v7) ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxx
CLERK_SECRET_KEY=sk_live_xxxx

# === Price APIs ===
METALPRICEAPI_KEY=your_basic_plus_key
METALSAPI_KEY=your_fallback_key
METALPRICEAPI_REGION=us

# === Site ===
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=generate_with_crypto_randomBytes_32

# === Email ===
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@yoursite.com

# === Worker-only (set on Hetzner /home/deploy/.env) ===
BULLMQ_REDIS_HOST=127.0.0.1
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=YourStrongRedisPassword
BULLMQ_REDIS_TLS=false
WORKER_ID=cip-worker-01
LOG_LEVEL=info

# === Hetzner backups (worker only) ===
HCLOUD_TOKEN=your_hetzner_api_token
CF_ACCOUNT_ID=your_cloudflare_account_id
ALERT_WEBHOOK_URL=https://yoursite.com/api/admin/alert
```

Generate `REVALIDATE_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **Security:** Never commit `.env.local` or `.env`. They're gitignored. Store credentials in a password manager (1Password / Bitwarden).

---

## Development

### Common Scripts

```bash
pnpm dev              # Run frontend (http://localhost:3000)
pnpm dev:worker       # Run worker locally
pnpm build            # Production build
pnpm start            # Run production build locally
pnpm lint             # ESLint
pnpm type-check       # TypeScript strict check
pnpm format           # Prettier write

# Database
pnpm tsx scripts/init-db.ts              # Create collections + indexes
pnpm tsx scripts/backfill-historical.ts  # Populate historical candles
pnpm tsx scripts/seed-currencies.ts      # Seed forex metadata

# Utilities
pnpm gen:tests        # Auto-generate test scaffolds from Zod schemas
pnpm gen:tests:api    # Generate API route tests
pnpm gen:tests:stories # Generate Storybook stories
```

### Working with Claude Code

Inside the project directory:

```bash
claude
```

Use the custom skills defined in `SKILLS.md`:

```
"Use the add-api-route skill to create GET /api/forex/usd-pkr"
"Use the add-component skill to create LivePriceCard"
"Use the fix-vulnerability skill"
"Use the deploy-to-staging skill"
```

If Claude suggests something that violates the locked stack:

```
"Re-read CLAUDE.md. Check the NEVER list. Use the locked alternative."
```

---

## Testing

```bash
# Unit + integration tests (Vitest)
pnpm test
pnpm test:watch
pnpm test:coverage      # Target: 80% overall, 100% security-critical

# E2E tests (Playwright — runs Chromium, Firefox, Webkit + mobile)
pnpm test:e2e
pnpm test:e2e:ui        # Interactive mode

# Visual regression
pnpm test:visual

# Property-based tests (auto-generated from Zod schemas)
pnpm test:properties

# Load tests (k6)
pnpm test:load          # Target: p95 < 100ms on /api/price/*, 10K RPS
```

CI runs all tests on every push, sharded 4-way across browsers.

---

## Deployment

### Frontend (Vercel)

```bash
# First time: connect repo to Vercel
# Visit: vercel.com → New Project → Import GitHub repo

# After connection: every push to main auto-deploys to production
git push origin main

# Manual deployment
pnpm vercel --prod

# Preview deployment (uses staging env vars)
pnpm vercel
```

### Worker (Hetzner)

```bash
# SSH into Hetzner server
ssh deploy@YOUR_SERVER_IP

# Deploy update
cd /home/deploy/apps/cip-2026
git pull origin main
cd apps/worker
pnpm install --frozen-lockfile
pnpm build
pm2 reload cip-worker --update-env

# Verify
pm2 status
pm2 logs cip-worker --lines 20
```

> 📘 Full Hetzner provisioning steps: [`docs/21-HETZNER-VPS-IMPLEMENTATION.md`](./docs/21-HETZNER-VPS-IMPLEMENTATION.md)

---

## Backups & Recovery

### Backup Schedule
- **Weekly Hetzner snapshots** — Sundays 2 AM UTC (4 retained, ~$2/mo)
- **MongoDB exports to Cloudflare R2** — 1st and 16th 3 AM UTC (6 retained = 90 days)
- **MongoDB Atlas continuous backup** — built-in (7 days, free tier)

### Restore from Hetzner Snapshot

```
1. Hetzner Console → Servers → + Add Server
2. Image: Snapshots tab → select most recent
3. Same specs (CX22 Singapore)
4. Wait ~5 minutes for new server
5. Update MongoDB Atlas IP whitelist with new IP
```

### Restore MongoDB from R2

```bash
# Download backup
aws s3 cp s3://cip-mongodb-backups/cip-mongodb-cip_production-YYYYMMDD-HHMMSS.gz ./restore.gz \
  --endpoint-url "https://YOUR_CF_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --profile r2

# Restore (drops existing data)
mongorestore \
  --uri="$MONGODB_URI" \
  --db="cip_production" \
  --archive=restore.gz \
  --gzip \
  --drop
```

> 📘 Complete DR playbooks for 8 failure scenarios: [`docs/26-DISASTER-RECOVERY-PLAN.md`](./docs/26-DISASTER-RECOVERY-PLAN.md)

---

## Documentation

This project includes **28 documentation files** that fully specify the system. Read in this order:

### Day 0 (Setup — Required First)
1. [`docs/28-BEGINNER-DAY-ZERO-COMPLETE.md`](./docs/28-BEGINNER-DAY-ZERO-COMPLETE.md) — Full setup walkthrough
2. [`docs/00-START-HERE.md`](./docs/00-START-HERE.md) — Master index of all docs
3. [`docs/CIP-DATA-FLOW-DIAGRAM.html`](./docs/CIP-DATA-FLOW-DIAGRAM.html) — Visual architecture
4. [`docs/17-CLAUDE-AGENT-FILES.md`](./docs/17-CLAUDE-AGENT-FILES.md) — CLAUDE.md/AGENTS.md/SKILLS.md content
5. [`docs/21-HETZNER-VPS-IMPLEMENTATION.md`](./docs/21-HETZNER-VPS-IMPLEMENTATION.md) — Worker server setup

### Architecture & Specs
- [`docs/01-ARCHITECTURE-SPEC.md`](./docs/01-ARCHITECTURE-SPEC.md) — System architecture
- [`docs/08-MONGODB-SCHEMAS.md`](./docs/08-MONGODB-SCHEMAS.md) — All database schemas
- [`docs/09-API-CONTRACTS.md`](./docs/09-API-CONTRACTS.md) — REST API specs

### Critical Implementation Details
- [`docs/22-METALPRICEAPI-FIX-FOREX-YMYL.md`](./docs/22-METALPRICEAPI-FIX-FOREX-YMYL.md) — API correct usage + forex + YMYL compliance
- [`docs/23-HISTORICAL-DATA-BACKFILL.md`](./docs/23-HISTORICAL-DATA-BACKFILL.md) — Day 1 chart data setup
- [`docs/24-TIME-SYNCHRONIZATION.md`](./docs/24-TIME-SYNCHRONIZATION.md) — Clock sync across services
- [`docs/25-REGIONAL-UNITS-PAKISTAN-INDIA.md`](./docs/25-REGIONAL-UNITS-PAKISTAN-INDIA.md) — Tola/gram/karat tables
- [`docs/26-DISASTER-RECOVERY-PLAN.md`](./docs/26-DISASTER-RECOVERY-PLAN.md) — DR playbooks
- [`docs/27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md`](./docs/27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md) — Backups + security hardening

### Subsystems
- [`docs/02-DISCLAIMER-SYSTEM.md`](./docs/02-DISCLAIMER-SYSTEM.md) — Legal disclaimer engine
- [`docs/03-SUBSCRIPTION-SYSTEM.md`](./docs/03-SUBSCRIPTION-SYSTEM.md) — Email subscriptions
- [`docs/04-DESIGN-SYSTEM.md`](./docs/04-DESIGN-SYSTEM.md) — Colors, typography, components
- [`docs/11-LOGGING-OBSERVABILITY.md`](./docs/11-LOGGING-OBSERVABILITY.md) — Pino → MongoDB
- [`docs/12-TESTING-STRATEGY.md`](./docs/12-TESTING-STRATEGY.md) — Vitest + Playwright
- [`docs/13-SECURITY-VULNERABILITY.md`](./docs/13-SECURITY-VULNERABILITY.md) — Dependency security
- [`docs/14-CMS-SYSTEM.md`](./docs/14-CMS-SYSTEM.md) — Tiptap CMS workflow
- [`docs/15-MFA-AUTHENTICATION.md`](./docs/15-MFA-AUTHENTICATION.md) — Clerk MFA setup
- [`docs/16-DYNAMIC-JSONLD.md`](./docs/16-DYNAMIC-JSONLD.md) — SEO schema engine

### Project Management
- [`docs/18-UPDATED-SPRINT-PLAN.md`](./docs/18-UPDATED-SPRINT-PLAN.md) — 16-week roadmap
- [`docs/05-CLAUDE-CODE-PROMPTS.md`](./docs/05-CLAUDE-CODE-PROMPTS.md) — Pre-written task prompts
- [`docs/06-CLAUDE-DESIGN-PROMPTS.md`](./docs/06-CLAUDE-DESIGN-PROMPTS.md) — UI/design prompts
- [`docs/10-QA-CHECKLIST.md`](./docs/10-QA-CHECKLIST.md) — Pre-launch checklist

---

## Cost

### Monthly Operating Cost at Launch

| Service | Plan | Cost |
|---|---|---|
| Hetzner CX22 Singapore | Worker VPS | $4.51 |
| MetalpriceAPI | Basic Plus (60s + forex) | $16.99 |
| Weekly Hetzner snapshots | 4 retained | ~$2.00 |
| Upstash Redis | Pay-as-you-go | ~$1.00 |
| Cloudflare R2 (backups) | Storage + ops | ~$0.10 |
| MongoDB Atlas M0 | Free tier | $0 |
| Vercel Hobby | Free tier | $0 |
| Clerk | Free up to 10K MAU | $0 |
| Resend | Free 3K emails/mo | $0 |
| Cloudflare DNS + WAF | Free | $0 |
| Binance WebSocket | Public API | $0 |
| **Total** | | **~$25.50/mo** |

### Scale Thresholds

| Users | Trigger | New Cost |
|---|---|---|
| 5K MAU | Vercel function limits | +$20 (Pro) |
| 10K MAU | Clerk free limit | +$25 |
| 50K users | MongoDB 512MB full | +$57 (M10) |
| 100K users | Logs >5GB/day | +$25 (Axiom) |

---

## Roadmap

### Sprint Schedule (16 Weeks)

| Sprint | Weeks | Focus |
|---|---|---|
| **Day 0** | Pre-sprint | Account + tool setup |
| Sprint 1 | 1-2 | Logging, testing, security infrastructure |
| Sprint 2 | 3-4 | MongoDB schemas, price ingestion, forex |
| Sprint 3 | 5-6 | US/UK/PK/IN price pages + disclaimers + regional units |
| Sprint 4 | 7-8 | CMS + Tiptap editor + JSON-LD |
| Sprint 5 | 9-10 | Clerk MFA + admin panel + log dashboard |
| Sprint 6 | 11-12 | Email subscriptions + alerts + currency converter |
| Sprint 7 | 13-14 | Performance, SEO, YMYL compliance, QA |
| Sprint 8 | 15-16 | Legal review, monitoring, **launch** 🚀 |

### Phase 2 (Post-launch)
- Currency converter Phase 2 with full forex pages
- City-level pages for top 20 Pakistani/Indian cities
- Urdu and Hindi locales
- Mobile app (Capacitor wrapper around Next.js PWA)
- WhatsApp price alerts via Twilio

> 📘 Full sprint detail: [`docs/18-UPDATED-SPRINT-PLAN.md`](./docs/18-UPDATED-SPRINT-PLAN.md)

---

## Security

### Network Security
- **UFW firewall:** default deny inbound, only port 22/tcp open
- **SSH:** key-only auth, no root login, deploy user only, 3 retry max
- **Fail2ban:** 24-hour SSH ban after 3 failed attempts
- **Local Redis:** bound to 127.0.0.1 only, password-protected
- **MongoDB Atlas:** IP whitelist (Hetzner + admin home IP only)
- **Cloudflare WAF:** 5 custom rules + DDoS protection

### Application Security
- **Auth:** Clerk MFA required on all `/admin/*` routes
- **Headers:** CSP, HSTS preload, X-Frame-Options DENY
- **Validation:** Zod v4 on every API input (reject before processing)
- **Rate limiting:** Upstash per IP on public endpoints
- **Logging:** PII auto-redaction (email, phone, tokens)
- **Secrets:** 90-day rotation policy, never in code, never in `NEXT_PUBLIC_*`

### Reporting Security Issues

If you discover a security vulnerability, please email **security@yoursite.com** instead of opening a public issue. We aim to acknowledge within 24 hours and provide a fix within 7 days for critical issues.

> 📘 Full security guide: [`docs/27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md`](./docs/27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md) and [`docs/13-SECURITY-VULNERABILITY.md`](./docs/13-SECURITY-VULNERABILITY.md)

---

## Contributing

This is currently a closed-source solo project. Internal contribution guidelines:

1. **Branch from `main`** with descriptive name (`feat/forex-converter`, `fix/tola-calc`)
2. **Run `pnpm lint && pnpm test && pnpm build`** before pushing
3. **Follow CLAUDE.md NEVER/ALWAYS rules** — Claude Code enforces them
4. **PR template** auto-checks for: tests added, docs updated, no console.log, no Mongoose
5. **All financial content** must include disclaimer + author with credentials (YMYL compliance)

---

## License

**Proprietary — All rights reserved.**

Copyright © 2026 [Your Company Name]. This source code is private and not licensed for redistribution, modification, or commercial use without explicit written permission.

The `docs/` folder contains specifications and designs that are also proprietary.

---

## Acknowledgments

Built with reference to:
- **MetalpriceAPI** — licensed precious metals price feeds
- **Binance Public API** — cryptocurrency WebSocket streams
- **LBMA** — gold/silver reference pricing
- **State Bank of Pakistan, Reserve Bank of India** — currency reference rates
- **Anthropic Claude** — AI development assistance throughout

---

<div align="center">

**Built for the South Asian diaspora 🌏**

[Documentation](./docs/00-START-HERE.md) · [Architecture Diagram](./docs/CIP-DATA-FLOW-DIAGRAM.html) · [Sprint Plan](./docs/18-UPDATED-SPRINT-PLAN.md)

[⬆ back to top](#cip-2026)

</div>
