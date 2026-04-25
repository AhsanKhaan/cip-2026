# 🚀 28 — Complete Beginner Day 0 Guide
## Zero to Working Development Environment (Step-by-Step)

> **Read this BEFORE doing anything.** It walks you from "I have no project" to "Claude Code knows my project, my server is running, my GitHub is connected." Estimated time: **3–5 hours.**

**Last reviewed:** April 23, 2026
**Latest stable versions verified:**
- Next.js **16.2.4**
- React **19.2**
- Tailwind CSS **v4** (Oxide engine)
- TypeScript **5.x** (strict mode)
- Zod **v4**
- Tiptap **v3**
- @clerk/nextjs **v7.2.3** (Core 3)
- @upstash/redis **1.37.0**
- @upstash/ratelimit **2.0.6**
- MongoDB native driver **6.x**
- BullMQ **5.x**
- Pino **9.x**
- lucide-react **^1.8**
- date-fns **4.x**
- shadcn/ui (latest, Radix primitives)
- Vitest **3.x** + Playwright **1.x**

---

## Table of Contents

1. [Phase 1 — Create All Accounts (45 min)](#phase-1)
2. [Phase 2 — Install Tools on Your Computer (20 min)](#phase-2)
3. [Phase 3 — Create Project Folder (15 min)](#phase-3)
4. [Phase 4 — Final Folder Structure (Reference)](#phase-4)
5. [Phase 5 — Create All Claude Code Agent Files (30 min)](#phase-5)
6. [Phase 6 — Install Project Dependencies (10 min)](#phase-6)
7. [Phase 7 — Provision Hetzner Server (60 min)](#phase-7)
8. [Phase 8 — Configure Backups + Security (30 min)](#phase-8)
9. [Phase 9 — Connect to GitHub + Vercel (15 min)](#phase-9)
10. [Phase 10 — Verify Everything Works (15 min)](#phase-10)
11. [Day 0 Final Checklist](#final-checklist)

---

## <a name="phase-1"></a>Phase 1 — Create All Accounts (45 min)

Open each link in a new tab and create a free account. Save credentials in your password manager (1Password / Bitwarden).

| # | Service | URL | What You'll Get |
|---|---------|-----|-----------------|
| 1 | **GitHub** | https://github.com | Code hosting (free private repos) |
| 2 | **Vercel** | https://vercel.com | Frontend hosting (Hobby plan free) |
| 3 | **MongoDB Atlas** | https://mongodb.com/atlas | Database (M0 free tier, 512MB) |
| 4 | **Upstash** | https://upstash.com | Redis cache (free tier 500K cmds/mo) |
| 5 | **Clerk** | https://clerk.com | Auth + MFA (free up to 10K MAU) |
| 6 | **Resend** | https://resend.com | Email (free 3K emails/mo) |
| 7 | **MetalpriceAPI** | https://metalpriceapi.com | Metals + forex prices (Basic Plus $16.99/mo for 60s updates) |
| 8 | **Hetzner Cloud** | https://hetzner.com/cloud | Worker server ($4.51/mo CX22) |
| 9 | **Cloudflare** | https://cloudflare.com | DNS, SSL, WAF, R2 storage (free tier) |

### Per-Account Setup

#### 1. MongoDB Atlas (Database)

```
1. Sign up → Create new project: "cip-2026"
2. Build a Database → Choose M0 Free Tier
3. Cloud provider: AWS, Region: ap-southeast-1 (Singapore)
4. Create cluster (takes 3 minutes)
5. Database Access → Add Database User:
   - Username: cip_app
   - Password: [generate strong, save it]
   - Built-in Role: Atlas Admin
6. Network Access → ADD IP ADDRESS → 0.0.0.0/0 (TEMPORARY)
   (we'll restrict this in Phase 8)
7. Connect → Connect Your Application → Copy connection string
   Save: mongodb+srv://cip_app:PASSWORD@cluster0.xxxxx.mongodb.net/
```

#### 2. Upstash (Redis Cache)

```
1. Sign up → Create Redis Database
2. Name: cip-cache
3. Type: Regional → Singapore
4. Eviction: Yes (we use it as cache)
5. Once created → REST API tab
   Copy: UPSTASH_REDIS_REST_URL
   Copy: UPSTASH_REDIS_REST_TOKEN
```

#### 3. Clerk (Auth — IMPORTANT: Latest is v7)

```
1. Sign up → Create Application
2. Name: CIP-2026
3. Select sign-in methods: Email, Google
4. Select region: closest to your users
5. Once created → API Keys tab
   Copy: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   Copy: CLERK_SECRET_KEY
6. Multi-factor → Enable TOTP authenticator app
7. Backup codes: Enable
```

#### 4. MetalpriceAPI (Critical — pick correct plan)

```
1. Sign up at metalpriceapi.com
2. ⚠️ CRITICAL: Subscribe to Basic Plus plan ($16.99/mo)
   — Free plan is daily updates only (your "live" price won't be live)
   — Basic ($8.99) is 10-min updates (acceptable but choppy)
   — Basic Plus ($16.99) is 60-second updates ← REQUIRED
   — Professional ($27.99) is also 60s with more requests
3. Dashboard → API Keys → Copy your key
```

#### 5. Hetzner Cloud (Worker VPS)

```
1. Sign up at hetzner.com/cloud
2. Add payment method
3. New users get €20 free credit (~4 months CX22)
4. Don't create the server yet — we'll do that in Phase 7
   But generate API token now:
5. Security → API Tokens → Generate
   Permission: Read & Write
   Name: cip-snapshot-automation
   Save the token (shown once)
```

#### 6. Cloudflare (DNS + R2 Backups)

```
1. Sign up at cloudflare.com
2. Add your domain (we'll configure in Phase 9)
3. Click R2 → Create Bucket → Name: cip-mongodb-backups
4. Settings → Enable Versioning
5. Manage R2 API Tokens → Create Token:
   - Token name: cip-backup-token
   - Permissions: Object Read & Write
   - Specific bucket: cip-mongodb-backups
   Save: Access Key ID and Secret Access Key
6. Note your Cloudflare Account ID (top-right of dashboard)
```

#### 7. Resend (Email)

```
1. Sign up at resend.com
2. Add your domain → follow DNS instructions in Cloudflare
3. Wait for verification (~10 minutes)
4. API Keys → Create → Copy key
```

---

## <a name="phase-2"></a>Phase 2 — Install Tools on Your Computer (20 min)

### 2.1 Install Node.js 22 LTS

```bash
# Go to https://nodejs.org → Download LTS (currently 22.x.x)
# Run installer

# Verify (open terminal/PowerShell):
node --version
# Should show: v22.x.x
```

### 2.2 Install pnpm

```bash
npm install -g pnpm
pnpm --version
# Should show: 9.x.x or higher
```

### 2.3 Install Claude Code

```bash
npm install -g @anthropic/claude-code
claude --version
```

### 2.4 Install Git

```bash
# Mac: usually pre-installed
# Windows: download from https://git-scm.com/download/win
git --version

# Set up Git globally
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### 2.5 Install VS Code (Recommended Editor)

```
Download from https://code.visualstudio.com
```

Install these VS Code extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features (built-in)
- GitLens

### 2.6 Generate SSH Key (for Hetzner)

```bash
# Generate key
ssh-keygen -t ed25519 -C "cip2026-$(whoami)"

# When asked for location, press Enter (default)
# When asked for passphrase, press Enter twice (no passphrase)

# Display your public key — copy this entire line
cat ~/.ssh/id_ed25519.pub        # Mac/Linux
# OR
type $env:USERPROFILE\.ssh\id_ed25519.pub    # Windows PowerShell
```

Save the public key — you'll paste it into Hetzner in Phase 7.

---

## <a name="phase-3"></a>Phase 3 — Create Project Folder (15 min)

### 3.1 Create the Next.js Project

Open terminal, navigate to where you want the project (e.g., `~/Desktop`):

```bash
# Mac/Linux
cd ~/Desktop

# Windows
cd $env:USERPROFILE\Desktop
```

Run this exact command:

```bash
pnpm create next-app@latest cip-2026 \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm
```

Wait 2 minutes for installation.

```bash
cd cip-2026
```

### 3.2 Initialize Git

```bash
git init
git add -A
git commit -m "Initial Next.js 16 + Tailwind v4 setup"
```

### 3.3 Verify the Project Runs

```bash
pnpm dev
# Open http://localhost:3000 — you should see the Next.js welcome page
# Press Ctrl+C to stop
```

---

## <a name="phase-4"></a>Phase 4 — Final Folder Structure (Reference)

This is what your project will look like after Day 0 is complete. Use this as a reference while building.

```
cip-2026/
│
├── 📁 .claude/                              ← Claude Code workspace config
│   ├── settings.json                        ← Auto-load files & preferences
│   └── context/
│       └── glossary.md                      ← Domain terms (tola, candle, YMYL)
│
├── 📄 CLAUDE.md                             ← MASTER RULES (Claude reads first)
├── 📄 AGENTS.md                             ← Redirect to CLAUDE.md
├── 📄 SKILLS.md                             ← Custom Claude shortcuts
│
├── 📁 docs/                                 ← All 28 project docs go here
│   ├── 00-START-HERE.md
│   ├── 00-MASTER-README.md
│   ├── 01-ARCHITECTURE-SPEC.md
│   ├── 02-DISCLAIMER-SYSTEM.md
│   ├── ...                                  ← (all other docs)
│   ├── 27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md
│   └── 28-BEGINNER-DAY-ZERO.md              ← This file
│
├── 📁 apps/                                 ← Monorepo apps
│   ├── 📁 web/                              ← Next.js frontend
│   │   ├── 📁 src/
│   │   │   ├── 📁 app/                      ← Next.js 16 App Router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                 ← Homepage (US gold)
│   │   │   │   ├── proxy.ts                 ← ⚠️ NOT middleware.ts (Next.js 16)
│   │   │   │   ├── globals.css
│   │   │   │   ├── api/
│   │   │   │   │   ├── price/[symbol]/route.ts
│   │   │   │   │   ├── candles/[symbol]/route.ts
│   │   │   │   │   ├── subscribe/route.ts
│   │   │   │   │   ├── revalidate/route.ts
│   │   │   │   │   └── health/time/route.ts
│   │   │   │   ├── pk/                      ← Pakistan locale
│   │   │   │   │   └── gold-price-today-pakistan/page.tsx
│   │   │   │   ├── in/                      ← India locale
│   │   │   │   │   └── gold-price-today-india/page.tsx
│   │   │   │   ├── uk/                      ← UK locale
│   │   │   │   ├── forex/                   ← Currency converter
│   │   │   │   ├── blog/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── cms/page.tsx
│   │   │   │   │   ├── logs/page.tsx
│   │   │   │   │   ├── security/page.tsx
│   │   │   │   │   └── broadcast/page.tsx
│   │   │   │   ├── about/page.tsx           ← E-E-A-T required
│   │   │   │   ├── editorial-policy/page.tsx
│   │   │   │   ├── authors/[slug]/page.tsx
│   │   │   │   └── disclaimer/page.tsx
│   │   │   │
│   │   │   ├── 📁 components/
│   │   │   │   ├── ui/                      ← shadcn/ui primitives
│   │   │   │   ├── price/
│   │   │   │   │   ├── LivePriceCard.tsx
│   │   │   │   │   └── PriceChart.tsx       ← lightweight-charts
│   │   │   │   ├── regional/
│   │   │   │   │   ├── RegionalRateTable.tsx
│   │   │   │   │   └── QuickCalculator.tsx
│   │   │   │   ├── subscription/
│   │   │   │   │   └── SubscribeBox.tsx
│   │   │   │   ├── disclaimer/
│   │   │   │   │   └── LegalDisclaimer.tsx
│   │   │   │   ├── cms/                     ← Tiptap editor
│   │   │   │   └── seo/
│   │   │   │       └── JsonLd.tsx
│   │   │   │
│   │   │   ├── 📁 lib/
│   │   │   │   ├── env.ts                   ← Zod-validated env vars
│   │   │   │   ├── mongo.ts                 ← MongoDB cached client
│   │   │   │   ├── redis.ts                 ← Upstash client
│   │   │   │   ├── logger.ts                ← Pino → MongoDB
│   │   │   │   ├── units.ts                 ← Tola, gram conversions
│   │   │   │   ├── api/
│   │   │   │   │   ├── withLogging.ts       ← API route wrapper
│   │   │   │   │   └── withRateLimit.ts
│   │   │   │   └── jsonld/
│   │   │   │       ├── interpolate.ts
│   │   │   │       └── templates.ts
│   │   │   │
│   │   │   ├── 📁 hooks/
│   │   │   ├── 📁 types/
│   │   │   └── 📁 styles/
│   │   │
│   │   ├── public/
│   │   ├── next.config.ts                   ← Security headers configured
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json                    ← strict: true
│   │   ├── package.json
│   │   └── .env.local                       ← LOCAL secrets (gitignored)
│   │
│   └── 📁 worker/                           ← Hetzner background worker
│       ├── 📁 src/
│       │   ├── index.ts                     ← BullMQ + scheduler entry
│       │   ├── jobs/
│       │   │   ├── ingest-metals.ts         ← Every 60s
│       │   │   ├── ingest-crypto-ws.ts      ← Persistent WebSocket
│       │   │   ├── aggregate-hourly.ts      ← 1m → 1h candles
│       │   │   ├── aggregate-daily.ts       ← 1h → 1d candles
│       │   │   ├── check-alerts.ts
│       │   │   └── broadcast-emails.ts
│       │   └── lib/
│       │       ├── env.ts
│       │       ├── mongo.ts
│       │       ├── redis.ts
│       │       └── logger.ts
│       ├── scripts/
│       │   ├── backfill-historical.ts       ← Run before launch (doc 23)
│       │   ├── seed-currencies.ts
│       │   └── seed-disclaimers.ts
│       ├── ecosystem.config.js              ← PM2 config
│       ├── package.json
│       └── tsconfig.json
│
├── 📁 packages/                             ← Shared monorepo code
│   ├── shared/                              ← Types + constants
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── units.ts                     ← Same constants both apps use
│   │   │   └── disclaimers.ts
│   │   └── package.json
│   └── ui/                                  ← Shared UI components
│
├── 📁 .github/
│   └── workflows/
│       ├── ci.yml                           ← Test + lint on push
│       ├── security-audit.yml               ← Daily npm audit
│       └── deploy.yml                       ← Deploy worker on push
│
├── 📁 .vscode/                              ← Editor config
│   ├── settings.json
│   └── extensions.json
│
├── 📄 .gitignore                            ← node_modules, .env*, .next/
├── 📄 .nvmrc                                ← Node 22.x lock
├── 📄 pnpm-workspace.yaml                   ← Monorepo definition
├── 📄 turbo.json                            ← Turborepo config
├── 📄 package.json                          ← Root with scripts
└── 📄 README.md                             ← Public-facing project info
```

---

## <a name="phase-5"></a>Phase 5 — Create All Claude Code Agent Files (30 min)

> **CRITICAL:** These files must exist before you start any coding session. They tell Claude Code your locked tech stack, business rules, and shortcuts. Without them, Claude will guess and likely choose wrong libraries.

Make sure you're in your project root:

```bash
cd cip-2026
pwd   # Should show your project path
```

### 5.1 Create the .claude Directory Structure

```bash
# Create the hidden folder and context subfolder
mkdir -p .claude/context
```

### 5.2 Create CLAUDE.md (THE MOST IMPORTANT FILE)

This is the file Claude Code reads first in every session. Copy and paste this entire block into your terminal — it creates the file with all locked rules:

```bash
cat > CLAUDE.md << 'CLAUDE_END'
# CIP-2026 — Commodity Intelligence Platform
## Master Context for Claude Code

## Project Overview

**Product:** Commodity Intelligence Platform — live gold/silver/copper prices, crypto prices, and (Phase 2) currency converter. Targets US, UK, Pakistan, India audiences.

**Owner:** Solo founder, Singapore-based, beginner technical level.

**Scale target:** 1 million MAU.

**Stack philosophy:** Pre-computed reads, async writes, edge-cached responses.

---

## Version Pins (April 2026 — Latest Stable)

```
next: ^16.2.4              react: ^19.2
typescript: ^5.x (strict)  tailwindcss: ^4.0 (Oxide engine)
zod: ^4.0                  @clerk/nextjs: ^7.2  ← v7 (Core 3)
@upstash/redis: ^1.37      @upstash/ratelimit: ^2.0.6
mongodb: ^6.x              bullmq: ^5.x
pino: ^9.x                 vitest: ^3.x
playwright: ^1.x           @tiptap/react: ^3.x
lucide-react: ^1.8         date-fns: ^4.x
nanoid: ^5.x               libphonenumber-js: ^1.x
react-hook-form: ^7.x      @hookform/resolvers: ^3.x
lightweight-charts: latest resend: ^4.x
```

---

## Tech Stack (LOCKED)

- **Framework:** Next.js 16.2 App Router (TypeScript strict mode)
- **Database:** MongoDB Atlas (native driver — NOT Mongoose)
- **Cache:** Upstash Redis HTTP API (for Vercel API routes only)
- **Queue:** BullMQ on Hetzner with Local Redis (NOT Upstash for BullMQ)
- **Auth:** Clerk v7 (@clerk/nextjs) with TOTP MFA
- **Worker:** Hetzner CX22 Singapore ($4.51/mo) running BullMQ
- **Hosting:** Vercel Hobby (free)
- **CDN/DNS/SSL:** Cloudflare (free tier)
- **Backups:** Cloudflare R2 (zero egress fees)
- **UI:** shadcn/ui + Tailwind v4 (use tw-animate-css NOT tailwindcss-animate)
- **Editor:** Tiptap v3 (free MIT extensions only)
- **Charts:** lightweight-charts (NOT Recharts, NOT Chart.js)
- **Email:** Resend + React Email
- **Logging:** Pino → MongoDB logs collection
- **Testing:** Vitest + Playwright + @fast-check/vitest

---

## Locked Libraries (NEVER substitute)

- Validation: **Zod v4** — `import { z } from 'zod/v4'`
- Forms: **react-hook-form** + **@hookform/resolvers/zod**
- Icons: **lucide-react** (NEVER heroicons, FontAwesome, or others)
- Dates: **date-fns** (NEVER moment.js or dayjs)
- Phone: **libphonenumber-js**
- ID generation: **nanoid**
- Markdown rendering: **next-mdx-remote/rsc**

---

## NEVER Do These (Auto-Fail Conditions)

1. NEVER use `middleware.ts` — Next.js 16 renamed to `proxy.ts`
2. NEVER use sync params in pages — must be `const { slug } = await params`
3. NEVER use Mongoose — use native `mongodb` driver only
4. NEVER use Recharts or Chart.js — use lightweight-charts
5. NEVER use moment.js or dayjs — use date-fns
6. NEVER use heroicons — use lucide-react
7. NEVER use Pages Router — App Router only
8. NEVER store secrets in code — environment variables
9. NEVER disable TypeScript strict mode
10. NEVER use `console.log` — use Pino logger
11. NEVER create new API routes without Zod v4 validation
12. NEVER skip rate limiting on public endpoints
13. NEVER use `tailwindcss-animate` — use `tw-animate-css` (Tailwind v4)
14. NEVER use Zod v3 imports `from 'zod'` in new code — `from 'zod/v4'`
15. NEVER use `&symbols=` with MetalpriceAPI — use `&currencies=`
16. NEVER read `rates.XAU` as USD/oz — use `rates.USDXAU`
17. NEVER use Upstash for BullMQ — Local Redis on Hetzner (TCP required)
18. NEVER scrape prices from Kitco/Goldprice/Bloomberg — licensed APIs only
19. NEVER write "Buy now" or "guaranteed returns" content (YMYL violation)
20. NEVER use author name "Admin" — real name with credentials
21. NEVER auto-redirect users by IP geolocation — use a banner instead
22. NEVER expose Redis port 6379 to the internet
23. NEVER use `PasswordAuthentication yes` in SSH config
24. NEVER trust client-supplied timestamps — server uses `new Date()`
25. NEVER hardcode tola as 12.5g only — support both 11.6638 (standard) and 12.5g (bazaar)

## ALWAYS Do These

1. ALWAYS validate inputs with Zod v4 before any operation
2. ALWAYS wrap API routes with `withLogging()` and `withRateLimit()`
3. ALWAYS use module-level cached MongoDB client
4. ALWAYS add correlation ID (x-trace-id) to logs
5. ALWAYS use TypeScript — no .js files in source
6. ALWAYS run `pnpm audit` after adding dependencies
7. ALWAYS add loading + error states to UI components
8. ALWAYS use async params: `const { slug } = await params` (Next.js 16)
9. ALWAYS place Clerk auth in `proxy.ts` not `middleware.ts`
10. ALWAYS log `X-API-CURRENT` and `X-API-QUOTA` from MetalpriceAPI
11. ALWAYS alert admin when API quota exceeds 80%
12. ALWAYS include `hreflang` tags on localized pages
13. ALWAYS include financial disclaimer on YMYL pages
14. ALWAYS include "Last reviewed" date and author credentials
15. ALWAYS cite primary sources (LBMA, SBP, RBI, SEC) in financial content
16. ALWAYS store timestamps as native Date objects (UTC BSON)
17. ALWAYS use `getUTCHours()` not `getHours()`
18. ALWAYS use BullMQ cron schedulers, never `setInterval`
19. ALWAYS pre-compute regional rates server-side, not at API time
20. ALWAYS use `tabular-nums` font feature on price columns
21. ALWAYS use weekly Hetzner snapshots (cron Sundays 2 AM UTC)
22. ALWAYS use 15-day MongoDB backups to R2 (1st & 16th)
23. ALWAYS rotate API keys every 90 days
24. ALWAYS bind local Redis to 127.0.0.1 only

---

## Architecture (Read Flow)

```
User → Cloudflare CDN → Vercel ISR → Upstash Redis (cache) → MongoDB Atlas
                                          ↑
                              Hetzner Worker (every 60s)
                                          ↑
                          MetalpriceAPI + Binance WebSocket
```

User requests **never** call MetalpriceAPI directly. The worker writes prices to MongoDB and Upstash; Vercel reads from cache → MongoDB → returns to user.

## Database Collections

`logs`, `live_prices`, `candles_1m` (TTL 7d), `candles_1h` (TTL 365d), `candles_1d` (forever), `forex_rates`, `forex_candles_1h`, `currencies_meta`, `posts`, `subscribers`, `jsonld_templates`, `security_scans`, `disclaimers`, `regional_rates`, `alerts`, `conversion_log`

## Price Data Sources

- Metals: MetalpriceAPI Basic Plus (60-second polling, Hetzner worker)
- Crypto: Binance public WebSocket (real-time, Hetzner worker)
- Forex: Same MetalpriceAPI call (no separate API needed)
- Fallbacks: MetalsAPI (metals backup), CoinGecko (crypto backup)

## Units (CRITICAL for Pakistan/India)

- 1 troy oz = 31.1034768 grams (international)
- 1 standard tola = 11.6638125 g (Indian, formal pricing)
- 1 bazaar tola = 12.5 g (Pakistani Sarafa dealers — must support both)
- 1 kg = 1000 g

Pakistan karats: 24K, 22K, 21K, 20K, 18K
India karats: 24K, 22K, 18K
Pakistan primary unit: tola
India primary unit: 10 gram

## Design System

- Theme: Dark-first ("Bloomberg Terminal meets 2026")
- Brand: gold #D4AF37, silver #C0C0C0, copper #B87333, crypto #F7931A
- Up/Down: green #22c55e / red #ef4444
- Font: Inter (UI) + JetBrains Mono (numeric/code)
- All price displays must use `font-feature-settings: "tnum"` (tabular-nums)

## Reference Documents

When asked to do anything, consult these in `/docs`:

- Architecture: `01-ARCHITECTURE-SPEC.md`
- API contracts: `09-API-CONTRACTS.md`
- MongoDB schemas: `08-MONGODB-SCHEMAS.md`
- CMS: `14-CMS-SYSTEM.md`
- MFA/Auth: `15-MFA-AUTHENTICATION.md`
- Logging: `11-LOGGING-OBSERVABILITY.md`
- Hetzner setup: `21-HETZNER-VPS-IMPLEMENTATION.md`
- MetalpriceAPI fixes + forex + YMYL: `22-METALPRICEAPI-FIX-FOREX-YMYL.md`
- Backfill: `23-HISTORICAL-DATA-BACKFILL.md`
- Time sync: `24-TIME-SYNCHRONIZATION.md`
- Regional units: `25-REGIONAL-UNITS-PAKISTAN-INDIA.md`
- DR plan: `26-DISASTER-RECOVERY-PLAN.md`
- Backups + security: `27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md`
- Sprint plan: `18-UPDATED-SPRINT-PLAN.md`
- Code prompts: `05-CLAUDE-CODE-PROMPTS.md`
- Design prompts: `06-CLAUDE-DESIGN-PROMPTS.md`
CLAUDE_END

echo "✓ CLAUDE.md created"
```

### 5.3 Create AGENTS.md

```bash
cat > AGENTS.md << 'AGENTS_END'
# CIP-2026 Agent Instructions

All agent rules, locked libraries, and architectural decisions are maintained in **CLAUDE.md**.

Please read CLAUDE.md before taking any action in this project.

For task-specific shortcuts, see SKILLS.md.
AGENTS_END

echo "✓ AGENTS.md created"
```

### 5.4 Create SKILLS.md

```bash
cat > SKILLS.md << 'SKILLS_END'
# CIP-2026 — Custom Claude Code Skills

These skills are shortcuts for common tasks. Invoke by saying:
"Use the [skill-name] skill to ..."

---

## Skill: add-api-route

**Trigger:** "add an API route" / "create endpoint"

**Steps Claude performs:**
1. Create file at `apps/web/src/app/api/{route}/route.ts`
2. Wrap handler with `withLogging()` from `@/lib/api/withLogging`
3. Add Zod v4 input schema (`import { z } from 'zod/v4'`)
4. Add rate limiting via `@upstash/ratelimit`
5. Return typed JSON response
6. Create matching Vitest test at `*.test.ts`

---

## Skill: add-mongo-collection

**Trigger:** "add collection" / "create MongoDB schema"

**Steps:**
1. Add TypeScript interface to `apps/web/src/lib/db/schemas/{name}.ts`
2. Add MongoDB index definitions
3. Add TTL index if time-series
4. Add seed script at `apps/worker/scripts/seed-{name}.ts`
5. Update `08-MONGODB-SCHEMAS.md` documentation

---

## Skill: add-component

**Trigger:** "add component" / "create UI component"

**Steps:**
1. Create at `apps/web/src/components/{category}/{Name}.tsx`
2. Use shadcn/ui primitives only
3. Use lucide-react icons only
4. Add TypeScript props interface
5. Add loading and error states
6. Add `tabular-nums` class on any numeric display
7. Create Storybook story `{Name}.stories.tsx`

---

## Skill: add-cms-post-type

**Trigger:** "add post type" / "new content type"

**Steps:**
1. Add to `posts` collection schema
2. Add Tiptap v3 editor config in admin
3. Generate JSON-LD template entry in `jsonld_templates`
4. Update workflow state machine (Draft→Pending→Approved→Published)

---

## Skill: fix-vulnerability

**Trigger:** "fix vulnerability" / "security issue"

**Steps:**
1. Run `pnpm audit` to identify
2. Try `pnpm audit --fix`
3. For manual: use package overrides in `package.json`
4. Run `pnpm dedupe`
5. Log fix to `security_scans` collection

---

## Skill: deploy-to-staging

**Trigger:** "deploy to staging"

**Steps:**
1. `pnpm type-check`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. If pass: `vercel --target preview`

---

## Skill: rotate-secrets

**Trigger:** "rotate secrets"

**Steps:**
1. List all secrets from `.env.example`
2. Identify which service each belongs to
3. Provide rotation steps for each (where to regenerate)
4. Reminder to update Vercel env vars
5. Reminder to update Hetzner `/home/deploy/scripts/.env`

---

## Skill: setup-regional-page

**Trigger:** "create regional page" / "add Pakistan/India page"

**Steps:**
1. Create page at `apps/web/src/app/{locale}/{slug}/page.tsx`
2. Use `RegionalRateTable` component
3. Use `QuickCalculator` component
4. Add hreflang alternates in metadata
5. Add JSON-LD with `product-metal-price` template
6. Add `LegalDisclaimer` component
7. Use ISR with `revalidate = 60`
SKILLS_END

echo "✓ SKILLS.md created"
```

### 5.5 Create .claude/settings.json

```bash
cat > .claude/settings.json << 'SETTINGS_END'
{
  "autoLoad": [
    "CLAUDE.md",
    "SKILLS.md",
    ".claude/context/glossary.md"
  ],
  "preferences": {
    "verbosity": "normal",
    "autoApprove": false,
    "diffMode": "unified",
    "preferShellOnly": false
  },
  "context": {
    "maxTokens": 8000,
    "prioritize": ["CLAUDE.md", "SKILLS.md"]
  },
  "lockedVersions": {
    "next": "^16.2.4",
    "react": "^19.2",
    "typescript": "^5.0",
    "tailwindcss": "^4.0",
    "zod": "^4.0",
    "@clerk/nextjs": "^7.2",
    "@tiptap/react": "^3.0"
  }
}
SETTINGS_END

echo "✓ .claude/settings.json created"
```

### 5.6 Create .claude/context/glossary.md

```bash
cat > .claude/context/glossary.md << 'GLOSSARY_END'
# CIP-2026 Domain Glossary

## Price Units

- **tola** — South Asian gold weight unit
  - Standard tola = 11.6638125 g (Indian, formal)
  - Bazaar tola = 12.5 g (Pakistani Sarafa dealers)
  - Both must be supported on Pakistan pages with toggle
- **troy ounce** — International standard = 31.1034768 g
- **gram / 10 gram** — India primary unit (10g standard from IBJA)
- **karat / K** — Gold purity (24K = 99.9%, 22K = 91.6%, 21K = 87.5%, 18K = 75%)
- **candle** — OHLCV data point (Open, High, Low, Close, Volume)

## Business Terms

- **YMYL** — "Your Money or Your Life" Google E-E-A-T category, requires expert authorship + disclaimers
- **E-E-A-T** — Experience, Expertise, Authoritativeness, Trustworthiness
- **LBMA** — London Bullion Market Association (gold/silver reference price source)
- **LME** — London Metal Exchange (copper reference)
- **IBJA** — Indian Bullion and Jewellers Association (Indian gold rate authority)
- **SBP** — State Bank of Pakistan (PKR exchange rate authority)
- **RBI** — Reserve Bank of India (INR rate authority)
- **PSQCA** — Pakistan Standards & Quality Control Authority (gold hallmark)
- **BIS** — Bureau of Indian Standards (916 hallmark for 22K)
- **Sarafa Bazaar** — Traditional gold market (Karachi, Mumbai, Lahore)

## Technical Terms

- **ingestion cycle** — 60-second BullMQ job that fetches from MetalpriceAPI and writes to MongoDB
- **correlation ID / trace ID** — `x-trace-id` header that links all logs from one request
- **preview token** — Single-use URL token for viewing unpublished CMS posts
- **revalidation tag** — Next.js ISR cache key triggered by worker after price update
- **hreflang** — HTML tag indicating language/region variants of a page
- **proxy.ts** — Next.js 16 file replacing middleware.ts (BREAKING CHANGE)
- **time-series collection** — MongoDB native storage type optimized for timestamps

## User Roles

- **viewer** — Read-only access (default for new admin users)
- **author** — Can write CMS posts; cannot approve own work
- **editor** — Can approve others' posts; cannot delete published
- **admin** — Full access including MFA settings, logs, security dashboard

## CMS States

- **Draft** — Author working
- **Pending Review** — Submitted for approval
- **Approved** — Editor approved, awaiting publish
- **Published** — Live on site
- **Scheduled** — Future-dated publish (optional state)

## Geo Codes

- **PK** — Pakistan (PKR currency, urdu-PK locale)
- **IN** — India (INR currency, en-IN locale)
- **UK / GB** — United Kingdom (GBP currency, en-GB locale)
- **US** — United States (USD, en-US locale, default)
- **AE** — UAE (AED currency, important for Gulf diaspora remittance)
GLOSSARY_END

echo "✓ .claude/context/glossary.md created"
```

### 5.7 Verify All Agent Files Exist

```bash
ls -la CLAUDE.md AGENTS.md SKILLS.md .claude/settings.json .claude/context/glossary.md
```

You should see all 5 files. Each should have a non-zero size.

---

## <a name="phase-6"></a>Phase 6 — Install Project Dependencies (10 min)

Add these packages to your project. Use exact versions for stability:

```bash
# Core production dependencies
pnpm add zod@^4 mongodb@^6 @upstash/redis@^1.37 @upstash/ratelimit@^2.0.6
pnpm add @clerk/nextjs@^7.2
pnpm add lucide-react@^1.8 date-fns@^4 nanoid@^5 libphonenumber-js@^1
pnpm add react-hook-form@^7 @hookform/resolvers@^3
pnpm add pino@^9 pino-pretty@^11
pnpm add lightweight-charts
pnpm add resend@^4 @react-email/components
pnpm add @tiptap/react@^3 @tiptap/starter-kit@^3 @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table @tiptap/extension-code-block-lowlight @tiptap/extension-task-list @tiptap/extension-character-count
pnpm add next-mdx-remote
pnpm add date-fns-tz

# Tailwind v4 animation (replaces tailwindcss-animate)
pnpm add tw-animate-css

# Dev dependencies
pnpm add -D vitest@^3 @vitest/ui playwright @playwright/test
pnpm add -D @types/node@^22 @fast-check/vitest fast-check
pnpm add -D msw @testing-library/react @testing-library/jest-dom jsdom

# shadcn/ui setup (interactive — accept defaults)
pnpm dlx shadcn@latest init
```

Verify everything installed:

```bash
pnpm list --depth 0
```

Commit:

```bash
git add -A
git commit -m "Install all production dependencies (April 2026 stable versions)"
```

---

## <a name="phase-7"></a>Phase 7 — Provision Hetzner Server (60 min)

### 7.1 Create Hetzner Server

1. Log in to https://console.hetzner.cloud
2. Click your `cip-2026` project
3. **+ Add Server**:
   - Location: **Singapore (AP-Southeast)**
   - Image: **Ubuntu 24.04**
   - Type: **Shared vCPU → CX22** (2 vCPU, 4GB RAM, $4.51/mo)
   - Networking: defaults
   - SSH Keys: paste your SSH public key from Phase 2.6
   - Name: `cip-worker-01`
4. **Create & Buy Now**
5. Note the IP address shown (e.g., `65.108.XXX.XXX`)

### 7.2 SSH In and Update System

```bash
ssh root@YOUR_SERVER_IP

# Update everything
apt update && apt upgrade -y

# Install essentials
apt install -y curl wget git unzip build-essential ufw fail2ban chrony
```

### 7.3 Set UTC Timezone (Critical for Time Sync)

```bash
timedatectl set-timezone UTC
timedatectl    # Confirm "Time zone: UTC"
```

### 7.4 Install Node.js 22 LTS + pnpm + PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm pm2

node --version    # v22.x.x
pnpm --version
pm2 --version
```

### 7.5 Create Deploy User (Don't Run as Root!)

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy

# Copy SSH key access to deploy user
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Test SSH as deploy user (in a new terminal — keep root session open):

```bash
ssh deploy@YOUR_SERVER_IP    # Should work
```

### 7.6 Install Local Redis (For BullMQ — NOT Upstash)

```bash
apt install -y redis-server
nano /etc/redis/redis.conf
```

Find these lines and update:

```
bind 127.0.0.1                 # only localhost
requirepass YourStrongPasswordHere123!
appendonly yes                 # AOF persistence
protected-mode yes
```

Save (Ctrl+O, Enter, Ctrl+X), then:

```bash
systemctl restart redis-server
systemctl enable redis-server

# Test
redis-cli -a YourStrongPasswordHere123! ping
# Should print: PONG
```

### 7.7 Configure UFW Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'

# Block common attack ports explicitly
ufw deny 23/tcp comment 'Telnet'
ufw deny 27017/tcp comment 'MongoDB direct'
ufw deny 6379/tcp comment 'Redis direct (local only)'

ufw --force enable
ufw status verbose
```

### 7.8 Configure Fail2ban

```bash
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
maxretry = 3
bantime = 86400
EOF

systemctl restart fail2ban
systemctl enable fail2ban
fail2ban-client status sshd
```

### 7.9 Configure chrony (NTP Time Sync)

```bash
cat > /etc/chrony/chrony.conf << 'EOF'
pool 0.pool.ntp.org iburst maxsources 4
pool 1.pool.ntp.org iburst maxsources 4
pool time.cloudflare.com iburst
pool time.google.com iburst
driftfile /var/lib/chrony/chrony.drift
makestep 1.0 3
rtcsync
allow 127.0.0.1
EOF

systemctl restart chrony
systemctl enable chrony
sleep 30
chronyc tracking
# "System time" should be < 100ms
```

### 7.10 Harden SSH (After Confirming Deploy User Works)

```bash
nano /etc/ssh/sshd_config
```

Set these:

```
PasswordAuthentication no
PermitRootLogin no
AllowUsers deploy
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

```bash
systemctl restart sshd
# Open NEW terminal, verify deploy user can still log in
# DO NOT close current root session until deploy user works
```

---

## <a name="phase-8"></a>Phase 8 — Configure Backups + Security (30 min)

Now set up the weekly snapshot script and 15-day MongoDB backups.

### 8.1 Create Scripts Directory and Env File

```bash
# As deploy user
su - deploy
mkdir -p /home/deploy/scripts /home/deploy/logs /home/deploy/backups/mongodb

# Create env file
cat > /home/deploy/scripts/.env << 'EOF'
HCLOUD_TOKEN=your_hetzner_api_token
ALERT_WEBHOOK_URL=https://yoursite.com/api/admin/alert
MONGODB_URI=mongodb+srv://cip_app:PASSWORD@cluster.mongodb.net/
MONGODB_DB_NAME=cip_production
CF_ACCOUNT_ID=your_cloudflare_account_id
EOF

chmod 600 /home/deploy/scripts/.env
```

### 8.2 Install Weekly Snapshot Script

Copy the full script from **doc 27 section A.3** into `/home/deploy/scripts/snapshot.sh`. The script is ~80 lines — pre-built, just paste it. Make executable:

```bash
chmod +x /home/deploy/scripts/snapshot.sh
```

### 8.3 Install MongoDB Backup Script

Install AWS CLI first (compatible with Cloudflare R2):

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
cd /tmp && unzip awscliv2.zip
sudo ./aws/install
aws --version

# Configure for R2
aws configure --profile r2
# AWS Access Key ID: your_r2_access_key
# AWS Secret Access Key: your_r2_secret
# Default region: auto
# Default format: json
```

Install mongodump:

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-database-tools
mongodump --version
```

Now copy the full backup script from **doc 27 section B.4** into `/home/deploy/scripts/mongodb-backup.sh` and make executable:

```bash
chmod +x /home/deploy/scripts/mongodb-backup.sh
```

### 8.4 Schedule Both with Cron

```bash
crontab -e
```

Add these lines:

```cron
# Weekly Hetzner snapshot every Sunday at 2 AM UTC
0 2 * * 0 /home/deploy/scripts/snapshot.sh >> /home/deploy/logs/snapshot.log 2>&1

# MongoDB backup to Cloudflare R2 every 15 days (1st and 16th at 3 AM UTC)
0 3 1,16 * * /home/deploy/scripts/mongodb-backup.sh >> /home/deploy/logs/mongodb-backup.log 2>&1

# Clean old logs (keep 30 days)
0 4 * * * find /home/deploy/logs -name "*.log" -mtime +30 -delete
```

### 8.5 Test Both Scripts Manually

```bash
# Test snapshot
/home/deploy/scripts/snapshot.sh
tail -20 /home/deploy/logs/snapshot.log

# Test MongoDB backup
/home/deploy/scripts/mongodb-backup.sh
tail -30 /home/deploy/logs/mongodb-backup.log
```

Verify in Hetzner Console (Snapshots tab) and Cloudflare R2 dashboard.

### 8.6 Restrict MongoDB Atlas to Hetzner IP

```
1. MongoDB Atlas → Network Access
2. DELETE the 0.0.0.0/0 entry (the temporary one)
3. ADD IP ADDRESS:
   - YOUR_HETZNER_IP/32 (worker access)
   - YOUR_HOME_IP/32 (local dev access)
```

---

## <a name="phase-9"></a>Phase 9 — Connect to GitHub + Vercel (15 min)

### 9.1 Push to GitHub

```bash
# Local machine, in cip-2026 folder
# Create empty repo on github.com (private), then:

git remote add origin https://github.com/yourusername/cip-2026.git
git branch -M main
git push -u origin main
```

### 9.2 Connect to Vercel

```
1. vercel.com → New Project → Import from GitHub
2. Select cip-2026 repo
3. Framework Preset: Next.js (auto-detected)
4. Root Directory: ./
5. Add Environment Variables:
   - MONGODB_URI
   - MONGODB_DB_NAME
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY
   - METALPRICEAPI_KEY
   - REVALIDATE_SECRET (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   - RESEND_API_KEY
   - EMAIL_FROM
   - NEXT_PUBLIC_SITE_URL
6. Deploy
```

### 9.3 Add Custom Domain (Optional, Phase 1+)

```
Vercel → Project → Settings → Domains → Add
Then in Cloudflare → DNS → Add CNAME pointing to Vercel target
```

---

## <a name="phase-10"></a>Phase 10 — Verify Everything Works (15 min)

### 10.1 Local Development

```bash
cd cip-2026
pnpm dev
# Open http://localhost:3000 — should see Next.js page (we haven't built UI yet)
```

### 10.2 Claude Code Knows the Stack

```bash
# In project folder
claude
```

In the Claude Code prompt, ask:

```
Read CLAUDE.md and confirm:
1. What Next.js version are we using?
2. What goes in proxy.ts vs middleware.ts?
3. What chart library is locked?
4. What is the difference between standard tola and bazaar tola?
5. What Clerk version are we using?
```

Expected answers:
1. Next.js 16.2.4
2. proxy.ts (Next.js 16 renamed middleware.ts)
3. lightweight-charts (NOT Recharts)
4. Standard = 11.6638g (Indian/formal), Bazaar = 12.5g (Pakistani Sarafa dealers)
5. v7.2 (Core 3)

### 10.3 Hetzner Worker Reachable

```bash
ssh deploy@YOUR_HETZNER_IP

# Check services
systemctl status redis-server   # active (running)
systemctl status chrony          # active (running)
systemctl status fail2ban        # active (running)
ufw status                       # active, port 22 only

# Check Redis
redis-cli -a YourPassword ping   # PONG

# Check time sync
chronyc tracking | grep "System time"   # < 100ms
```

### 10.4 Cron Schedule Active

```bash
# As deploy user
crontab -l
# Should show 3 cron lines (snapshot, backup, log cleanup)
```

### 10.5 Backup Verifies

```bash
# Already tested in Phase 8.5 — should be green
ls /home/deploy/logs/
# snapshot.log, mongodb-backup.log present
```

### 10.6 Vercel Deployment Live

```bash
# Visit your Vercel URL — should show default Next.js page
# Check: vercel.com → Project → Deployments → status: Ready
```

---

## <a name="final-checklist"></a>🎯 Day 0 Final Checklist

Before moving to Sprint 1, ALL of these must be ✅:

### Accounts & Access
- [ ] All 9 accounts created with credentials in password manager
- [ ] MetalpriceAPI plan = Basic Plus or Professional ($16.99+ — NOT Free, NOT Essential)
- [ ] Hetzner API token generated and saved
- [ ] Cloudflare R2 bucket created with versioning + token saved

### Local Computer
- [ ] Node.js 22 LTS installed
- [ ] pnpm 9.x installed
- [ ] Claude Code installed
- [ ] Git configured with name + email
- [ ] VS Code installed with extensions
- [ ] SSH key generated (id_ed25519)

### Project
- [ ] cip-2026/ folder created with `pnpm create next-app`
- [ ] All dependencies installed (Next 16, React 19, Tailwind v4, Zod v4, Tiptap v3, Clerk v7)
- [ ] Tailwind v4 with `tw-animate-css` (NOT tailwindcss-animate)
- [ ] Git initialized with first commit
- [ ] Project pushed to private GitHub repo

### Claude Files (CRITICAL)
- [ ] `CLAUDE.md` exists with all v16 rules + Clerk v7
- [ ] `AGENTS.md` redirects to CLAUDE.md
- [ ] `SKILLS.md` lists all 7 custom skills
- [ ] `.claude/settings.json` configured
- [ ] `.claude/context/glossary.md` has all domain terms
- [ ] Claude Code tested with verification questions (Phase 10.2)

### Documents
- [ ] All 28 docs copied to `/docs` folder inside the project

### Hetzner Server
- [ ] CX22 Singapore Ubuntu 24.04 provisioned
- [ ] System updated (`apt upgrade`)
- [ ] Node 22 LTS + pnpm + PM2 installed
- [ ] Deploy user created with SSH access
- [ ] Local Redis installed, bound to 127.0.0.1, AOF on
- [ ] UFW: deny incoming, port 22 only
- [ ] Fail2ban configured (3 retries, 24h ban)
- [ ] chrony configured, drift < 100ms
- [ ] Timezone = UTC
- [ ] SSH hardened: PasswordAuth no, PermitRootLogin no

### Backups + Monitoring
- [ ] `/home/deploy/scripts/.env` created with all secrets
- [ ] `snapshot.sh` deployed and tested manually (creates one weekly snapshot)
- [ ] `mongodb-backup.sh` deployed and tested (uploads to R2)
- [ ] Cron scheduled: weekly snapshot Sunday 2 AM, MongoDB 1st/16th 3 AM
- [ ] AWS CLI configured for R2 with credentials
- [ ] mongodump installed and verified
- [ ] UptimeRobot monitoring 3 endpoints

### Vercel
- [ ] Project imported from GitHub
- [ ] All env vars added in Vercel Settings
- [ ] First deployment succeeded (Ready status)

### MongoDB Atlas
- [ ] Network Access updated: removed 0.0.0.0/0
- [ ] Whitelisted: Hetzner IP/32 + your home IP/32
- [ ] M0 cluster running

### Verification
- [ ] Claude Code answers verification questions correctly
- [ ] Hetzner SSH works as deploy user only (not root)
- [ ] Vercel preview URL loads
- [ ] No errors in `pm2 status` (when worker is built — Sprint 1)

---

## ⚠️ Common Day 0 Mistakes to Avoid

| Mistake | Consequence | Fix |
|---|---|---|
| Subscribed to MetalpriceAPI Free | Daily updates only — kills "live" promise | Upgrade to Basic Plus ($16.99) |
| Used Mongoose | Time-series collections won't work | Native `mongodb` driver only |
| Used `middleware.ts` for Clerk | Won't run in Next.js 16 | Rename to `proxy.ts` |
| Skipped chrony on Hetzner | Clock drift breaks candles | Install + configure |
| Daily snapshots | $3+/month | Weekly only ($2/month) |
| Used Upstash for BullMQ | $100+/month from polling | Local Redis on Hetzner |
| Synced params: `params.slug` | Next.js 16 throws error | `const { slug } = await params` |
| MongoDB IP whitelist 0.0.0.0/0 | Anyone with credentials can connect | Restrict to Hetzner + home IP |
| Used Recharts | Performance issues at scale | lightweight-charts |
| Used moment.js | 67kb bundle bloat | date-fns |
| Author name "Admin" | Google YMYL penalty | Real name + credentials |
| Hardcoded tola = 12.5g | Wrong for Indian users | Support both 11.6638g + 12.5g |

---

## 🎉 You're Done!

If every checklist item is ✅, you have a production-grade development environment.

**Total time invested:** 3-5 hours
**Total monthly cost:** ~$25.50 (Hetzner $4.51 + MetalpriceAPI $16.99 + backups $2 + Upstash $1 + everything else free)
**Next step:** Open `18-UPDATED-SPRINT-PLAN.md` to begin Sprint 1.

---

## How to Use Claude Code Day-to-Day

### Starting Each Session

```bash
cd cip-2026
claude
```

First message every session:

```
Read CLAUDE.md and confirm understanding of CIP-2026.
What's our locked tech stack and Top 3 NEVER rules?
```

### Building Features

Open `05-CLAUDE-CODE-PROMPTS.md` — every feature has a ready-made prompt. Example:

```
Use prompt T2.1 from doc 05:
"Create the GET /api/price/[symbol] route per doc 09 §2.
Use withLogging wrapper, Zod v4 validation, Upstash rate limit."
```

### Using Skills

```
Use the add-api-route skill to create GET /api/forex/USD-PKR
Use the add-component skill to create LivePriceCard
Use the fix-vulnerability skill (when pnpm audit shows issues)
Use the deploy-to-staging skill
```

### When Claude Drifts

If Claude suggests something that violates the rules:

```
Re-read CLAUDE.md. Check the NEVER list. We never use Mongoose / Recharts / moment.js. Use the locked alternative.
```

---

*Document 28 of the CIP-2026 Package — Beginner Day 0 Setup Guide*
*Supersedes:* doc 20 (older shorter version)
*Cross-references:* All other docs become useful only after Day 0 is complete
*Last reviewed:* April 23, 2026
