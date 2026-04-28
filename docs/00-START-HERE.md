# 🚀 CIP-2026 — Final Complete Package
## Master Index + Beginner Setup Guide (Read This First)

**Last updated:** April 23, 2026
**Total files:** 30 documents + 1 interactive diagram
**For:** Solo founder, beginner technical level
**Project:** Commodity Intelligence Platform (gold, silver, copper, crypto, forex)

---

## 📋 Complete File Index (In Reading Order)

| # | File | Purpose | Day/Sprint to Read |
|---|------|---------|-------------------|
| **00** | `00-START-HERE.md` (this file) | Master index + beginner setup | **Day 0 — FIRST** |
| 00a | `00-MASTER-README.md` | Decision log + architecture overview | Day 0 — Second |
| 01 | `01-ARCHITECTURE-SPEC.md` | Full system architecture | Day 0 |
| 02 | `02-DISCLAIMER-SYSTEM.md` | Legal disclaimer engine | Sprint 3 |
| 03 | `03-SUBSCRIPTION-SYSTEM.md` | Email subscription system | Sprint 3 |
| 04 | `04-DESIGN-SYSTEM.md` | Colors, fonts, components | Sprint 2 |
| 05 | `05-CLAUDE-CODE-PROMPTS.md` | Ready-to-use Claude Code prompts | Every sprint |
| 06 | `06-CLAUDE-DESIGN-PROMPTS.md` | UI/design prompts | Every sprint |
| 07 | `07-PMO-SPRINT-PLAN.md` | Original v1 plan (superseded by 18) | Reference |
| 08 | `08-MONGODB-SCHEMAS.md` | All database schemas | Sprint 1 |
| 09 | `09-API-CONTRACTS.md` | All API endpoints | Sprint 2 |
| 10 | `10-QA-CHECKLIST.md` | Pre-launch checklist | Sprint 8 |
| 11 | `11-LOGGING-OBSERVABILITY.md` | Pino → MongoDB logging | Sprint 1 |
| 12 | `12-TESTING-STRATEGY.md` | Vitest + Playwright setup | Sprint 1 |
| 13 | `13-SECURITY-VULNERABILITY.md` | npm audit + Snyk setup | Sprint 1 |
| 14 | `14-CMS-SYSTEM.md` | Blog CMS with Tiptap | Sprint 3–4 |
| 15 | `15-MFA-AUTHENTICATION.md` | Clerk TOTP + backup codes | Sprint 5 |
| 16 | `16-DYNAMIC-JSONLD.md` | SEO JSON-LD engine | Sprint 4 |
| 17 | `17-CLAUDE-AGENT-FILES.md` | CLAUDE.md / AGENTS.md / SKILLS.md content | **Day 0** |
| 18 | `18-UPDATED-SPRINT-PLAN.md` | 16-week sprint plan (v2 — use this one) | Every sprint |
| 20 | `20-CLAUDE-CODE-BEGINNER-GUIDE.md` | How to install Claude Code + files | **Day 0** |
| 21 | `21-HETZNER-VPS-IMPLEMENTATION.md` | Full Hetzner server setup | Sprint 1 |
| 22 | `22-METALPRICEAPI-FIX-FOREX-YMYL.md` | API fixes + forex + geo-targeting + YMYL | Sprint 2–3 |
| 23 | `23-HISTORICAL-DATA-BACKFILL.md` | 5-year historical data backfill (critical) | **Sprint 2** |
| 24 | `24-TIME-SYNCHRONIZATION.md` | Clock sync across all services | **Day 0 + Sprint 1** |
| 25 | `25-REGIONAL-UNITS-PAKISTAN-INDIA.md` | Tola, 10-gram, karat tables for PK/IN | **Sprint 3** |
| 26 | `26-DISASTER-RECOVERY-PLAN.md` | DR plan + Cloudflare Workers decision | **Day 0 + Sprint 1** |
| 27 | `27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md` | Weekly snapshots, 15-day MongoDB backup, network security | **Day 0 + Sprint 1** |
| 28 | `28-BEGINNER-DAY-ZERO-COMPLETE.md` | **MEGA Day 0 guide — read first** | **Day 0 — START HERE** |
| 29 | `29-MOCK-DATA-SYSTEM.md` | Mock data layer to preserve paid API quota | **Sprint 1 — CRITICAL** |
| — | `CIP-DATA-FLOW-DIAGRAM.html` | Visual architecture overview (open in browser) | Day 0 |

> **Note:** Docs 19 does not exist. Numbering preserves gaps so you can insert future docs without renumbering.

---

## ⚡ Critical Decisions Locked (Read Before Starting)

These are the final architectural decisions. Do not change these without re-reading the referenced doc:

### Tech Stack (LOCKED)
| Layer | Choice | Why | Doc |
|---|---|---|---|
| Framework | **Next.js 16.2** | Latest stable, App Router + proxy.ts | 01, 17 |
| Database | **MongoDB Atlas + native driver** | Time-series for candles, no Mongoose | 08 |
| Cache | **Upstash Redis (HTTP)** | For Vercel API routes only | 01 |
| Queue | **Local Redis on Hetzner + BullMQ** | Upstash incompatible with BullMQ | 21 |
| Auth | **Clerk v6 + MFA** | TOTP, Google Authenticator, 10 backup codes | 15 |
| Worker | **Hetzner CX22 ($4.51/mo) Singapore** | Real server for WebSocket + cron | 21 |
| Price API | **MetalpriceAPI Basic Plus ($16.99/mo)** | 60-second updates + forex included | 22 |
| Charts | **lightweight-charts** (NOT Recharts) | Performance, TradingView-style | 17 |
| Editor | **Tiptap v3 (free MIT)** | Markdown + blocks + images | 14 |
| Validation | **Zod v4** | 14× faster than v3 | 17 |
| Testing | **Vitest + Playwright + fast-check** | Schema-based test generation | 12 |
| Logging | **Pino → MongoDB** | Admin dashboard at /admin/logs | 11 |

### Business Decisions (LOCKED)
- **Target markets:** US (primary), UK, Pakistan, India
- **Geo strategy:** Single domain with `/uk/`, `/pk/`, `/in/` paths (NOT subdomains)
- **Forex:** Included free in MetalpriceAPI — no separate API needed
- **YMYL compliance:** Every article has author + credentials + disclaimer + "last reviewed"
- **Copyright:** Licensed APIs only (MetalpriceAPI + Binance WebSocket + CoinGecko free tier)

### Cost at Launch (LOCKED)
Total: **~$22.50/month** — see doc 22 section 9 for full breakdown.

---

## 🎯 Day 0 Setup (3–5 Hours)

Complete this in order. Do not skip steps.

### Step 1: Create All Accounts (45 minutes)

Open each in a new tab and sign up. All free to start.

| # | Service | URL | What to save |
|---|---------|-----|--------------|
| 1 | GitHub | github.com | — |
| 2 | Vercel | vercel.com | — |
| 3 | MongoDB Atlas | mongodb.com/atlas | Connection string |
| 4 | Upstash | upstash.com | REST URL + token |
| 5 | Clerk | clerk.com | Publishable + Secret keys |
| 6 | Resend | resend.com | API key + verify domain |
| 7 | MetalpriceAPI | metalpriceapi.com | API key + **select Basic Plus plan** |
| 8 | Hetzner | hetzner.com/cloud | Will provision server in Step 6 |

---

### Step 2: Install Tools on Your Computer (20 minutes)

```bash
# Install Node.js 22 LTS
# https://nodejs.org → Download LTS → Install

# Verify
node --version   # Should show v22.x.x

# Install pnpm
npm install -g pnpm
pnpm --version

# Install Claude Code
npm install -g @anthropic/claude-code
claude --version

# Verify Git is installed
git --version
```

---

### Step 3: Create Your Next.js Project (10 minutes)

```bash
# Create the project
npx create-next-app@latest cip-2026 \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd cip-2026

# Initialize Git
git init
git add -A
git commit -m "Initial Next.js 16 setup"
```

---

### Step 4: Install the Agent Files (15 minutes — CRITICAL)

Follow `20-CLAUDE-CODE-BEGINNER-GUIDE.md`. The summary:

```bash
# Inside your project folder
mkdir -p .claude/context
```

Then create these 5 files (full contents are in doc 20):
1. `CLAUDE.md` — master rules (see doc 20 step 4 for full content)
2. `AGENTS.md` — redirects to CLAUDE.md
3. `SKILLS.md` — custom shortcuts
4. `.claude/settings.json` — Claude Code settings
5. `.claude/context/glossary.md` — domain terms

**Important:** Copy the CLAUDE.md content exactly from doc 20 Step 4. It contains all the locked rules (proxy.ts, Zod v4, MetalpriceAPI fixes, YMYL compliance, etc.).

---

### Step 5: Copy All Docs Into Your Project (5 minutes)

```bash
# Inside your project folder
mkdir -p docs

# Copy all 24 .md files into docs/
# You can drag-drop in your file manager, or:
cp /path/to/downloaded/docs/*.md docs/

# Verify
ls docs/
# Should show files 00 through 22
```

---

### Step 6: Provision Hetzner Server (60 minutes)

Follow `21-HETZNER-VPS-IMPLEMENTATION.md` sections 2–6:

1. Create SSH key on your computer
2. Create Hetzner project → CX22 → Singapore → Ubuntu 24.04 → paste SSH key
3. SSH in as root
4. Run the full setup commands (Node.js 22, pnpm, PM2, UFW firewall, fail2ban)
5. Create `deploy` user
6. **Install Local Redis** (Section 5.2 Option B) — for BullMQ
7. Save server IP address

---

### Step 7: Configure Environment Variables (15 minutes)

```bash
# Inside your project folder
touch .env.local
```

Minimum values:

```bash
# === Database ===
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=cip_production

# === Upstash Redis (cache only — for Vercel) ===
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# === Clerk ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxx
CLERK_SECRET_KEY=sk_live_xxxx

# === Prices ===
METALPRICEAPI_KEY=your_api_key
METALPRICEAPI_REGION=us

# === Revalidation ===
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
REVALIDATE_SECRET=paste_random_32_chars_here

# === Email ===
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@yoursite.com
```

On the Hetzner server, create a separate `.env` in `/home/deploy/apps/cip-worker/` with the same variables PLUS:

```bash
# === Local Redis for BullMQ ===
BULLMQ_REDIS_HOST=127.0.0.1
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=YourStrongRedisPassword
BULLMQ_REDIS_TLS=false
```

---

### Step 8: Connect GitHub + Vercel (10 minutes)

```bash
# Create empty repo on github.com, then:
git remote add origin https://github.com/yourusername/cip-2026.git
git branch -M main
git push -u origin main
```

Then on vercel.com:
1. New Project → Import from GitHub → select `cip-2026`
2. Add all env vars in Settings → Environment Variables
3. Click Deploy

---

### Step 9: Verify Everything Works (20 minutes)

```bash
# 1. Local dev server
pnpm dev
# Visit http://localhost:3000

# 2. Start Claude Code
claude
# First message: "Read CLAUDE.md and confirm you understand the project"

# 3. Test Claude knows the rules
# Ask: "Where does Clerk middleware go in Next.js 16?"
# Expected answer: proxy.ts (not middleware.ts)

# Ask: "What chart library do we use?"
# Expected answer: lightweight-charts

# Ask: "What field do we read for gold USD/oz from MetalpriceAPI?"
# Expected answer: rates.USDXAU (not rates.XAU)

# 4. Verify Hetzner worker is running
ssh deploy@YOUR_SERVER_IP
pm2 status
# Should show cip-worker | online
```

---

## 📅 Sprint Schedule (16 Weeks)

See `18-UPDATED-SPRINT-PLAN.md` for full detail.

| Sprint | Weeks | Focus | Key Deliverables |
|--------|-------|-------|------------------|
| Day 0 | Pre-sprint | Setup | Accounts + agent files + Hetzner ready |
| Sprint 1 | 1–2 | Infrastructure | Logging, testing, security scanning |
| Sprint 2 | 3–4 | Data layer | MongoDB schemas, price ingestion, forex |
| Sprint 3 | 5–6 | Core pages | US gold/silver/copper/crypto pages + disclaimers |
| Sprint 4 | 7–8 | CMS + geo | Tiptap CMS + JSON-LD + UK/PK/IN pages |
| Sprint 5 | 9–10 | Auth | Clerk MFA + admin panel + log dashboard |
| Sprint 6 | 11–12 | Subscriptions | Email signup + Resend + alerts + forex converter |
| Sprint 7 | 13–14 | Polish | Performance, SEO, YMYL compliance, QA |
| Sprint 8 | 15–16 | Launch | Legal review, monitoring, go live |

---

## 🔑 Locked Rules Summary (From CLAUDE.md)

### NEVER Do These
- ❌ Use `middleware.ts` — Next.js 16 renamed to `proxy.ts`
- ❌ Use `params.slug` — use `const { slug } = await params` (async in Next.js 16)
- ❌ Use Mongoose — use native MongoDB driver only
- ❌ Use Recharts or Chart.js — use lightweight-charts
- ❌ Use moment.js or dayjs — use date-fns
- ❌ Use heroicons — use lucide-react
- ❌ Use `console.log` — use Pino logger
- ❌ Use `tailwindcss-animate` — use `tw-animate-css` (Tailwind v4)
- ❌ Use `&symbols=` with MetalpriceAPI — use `&currencies=`
- ❌ Read `rates.XAU` as USD/oz — use `rates.USDXAU` (inverse field)
- ❌ Use Upstash for BullMQ — use Local Redis on Hetzner
- ❌ Scrape prices from Kitco/Goldprice/Bloomberg — licensed APIs only
- ❌ Write "Buy now" or "guaranteed returns" — YMYL violation
- ❌ Use author name "Admin" — real name with credentials required
- ❌ Auto-redirect users by IP — Google penalizes; use banner instead

### ALWAYS Do These
- ✅ Validate inputs with Zod v4 before any operation
- ✅ Wrap API routes with `withLogging()`
- ✅ Rate-limit public endpoints via Upstash
- ✅ Log `X-API-CURRENT` + `X-API-QUOTA` headers on every MetalpriceAPI call
- ✅ Alert admin when API quota exceeds 80%
- ✅ Include `hreflang` tags on localized pages
- ✅ Include financial disclaimer component on YMYL pages
- ✅ Include "Last reviewed" date + author credentials on articles
- ✅ Cite primary sources (LBMA, SBP, RBI, SEC) in financial content

---

## 💰 Monthly Cost at Launch

| Service | Plan | Cost |
|---------|------|------|
| Hetzner CX22 | Singapore worker | $4.51 |
| Local Redis | On Hetzner (for BullMQ) | $0 |
| MongoDB Atlas | M0 Free | $0 |
| Upstash Redis | Free tier (cache only) | $0–1 |
| Vercel | Hobby | $0 |
| Clerk | Free (10K MAU) | $0 |
| Resend | Free (3K emails) | $0 |
| MetalpriceAPI | Basic Plus (60s updates + forex) | $16.99 |
| Binance WebSocket | Public API | $0 |
| **Total** | | **~$22.50/mo** |

---

## 🎨 Key UI Fixes Applied

The subscription box side-spaces problem from your screenshot is fixed in doc 22 section 7. Use `w-full` with responsive padding, responsive flex direction, chip-style category toggles, and proper loading/success/error states. Full working component included.

---

## 🌍 Geo-Targeting & Keywords

Target URLs (detailed in doc 22 section 3):

| Market | URL | Primary Keyword | Volume |
|---|---|---|---|
| 🇺🇸 US | `/gold-price-today` | "gold price today" | 823K/mo |
| 🇬🇧 UK | `/uk/gold-price-today-uk` | "gold price today UK" | 90K/mo |
| 🇵🇰 Pakistan | `/pk/gold-price-today-pakistan` | "gold price today pakistan" | 165K/mo |
| 🇮🇳 India | `/in/gold-price-today-india` | "gold price today india" | 246K/mo |
| 🌐 Converter | `/forex/currency-converter` | "currency converter" | 1.2M/mo |
| 💸 Remittance | `/forex/aed-to-pkr` | "aed to pkr" | 246K/mo |
| 💸 Remittance | `/forex/aed-to-inr` | "aed to inr" | 165K/mo |

Plus city-level pages (Karachi/Lahore/Mumbai/Delhi) and carat-level pages (22k/24k/18k).

---

## 📞 Where to Get Help (By Problem Type)

| Problem | Go to |
|---|---|
| Don't know which doc to read | This file's index table above |
| Architecture/infrastructure | `01-ARCHITECTURE-SPEC.md` |
| Database question | `08-MONGODB-SCHEMAS.md` |
| API endpoint spec | `09-API-CONTRACTS.md` |
| Backend feature task | `05-CLAUDE-CODE-PROMPTS.md` |
| UI component task | `06-CLAUDE-DESIGN-PROMPTS.md` |
| Worker/Hetzner issue | `21-HETZNER-VPS-IMPLEMENTATION.md` § 9 troubleshooting |
| Claude Code issue | `20-CLAUDE-CODE-BEGINNER-GUIDE.md` § troubleshooting |
| MetalpriceAPI question | `22-METALPRICEAPI-FIX-FOREX-YMYL.md` § 1 |
| Forex/converter | `22-METALPRICEAPI-FIX-FOREX-YMYL.md` § 2 |
| YMYL/Google compliance | `22-METALPRICEAPI-FIX-FOREX-YMYL.md` § 5 |
| Subscription UI | `22-METALPRICEAPI-FIX-FOREX-YMYL.md` § 7 |
| Empty chart on Day 1 | `23-HISTORICAL-DATA-BACKFILL.md` |
| Clock drift / timestamps wrong | `24-TIME-SYNCHRONIZATION.md` |
| Tola/10-gram/karat on PK/IN pages | `25-REGIONAL-UNITS-PAKISTAN-INDIA.md` |
| What if MongoDB/Hetzner/Redis fails? | `26-DISASTER-RECOVERY-PLAN.md` |
| Cloudflare Workers question | `26-DISASTER-RECOVERY-PLAN.md` § A |
| Daily snapshots + MongoDB backup | `27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md` |
| Network security + SSH hardening | `27-AUTOMATED-BACKUPS-NETWORK-SECURITY.md` § C |
| Sprint planning | `18-UPDATED-SPRINT-PLAN.md` |
| Pre-launch | `10-QA-CHECKLIST.md` |
| Visual architecture | `CIP-DATA-FLOW-DIAGRAM.html` |

---

## ✅ Day 0 Completion Checklist

Before moving to Sprint 1, confirm ALL of these:

- [ ] All 8 accounts created (GitHub, Vercel, MongoDB, Upstash, Clerk, Resend, MetalpriceAPI, Hetzner)
- [ ] MetalpriceAPI plan is **Basic Plus or higher** (not Free or Essential)
- [ ] Node.js 22 + pnpm + Claude Code installed locally
- [ ] Next.js project created and pushed to GitHub
- [ ] All 5 agent files created: CLAUDE.md, AGENTS.md, SKILLS.md, .claude/settings.json, .claude/context/glossary.md
- [ ] All 24 documents copied into `/docs` folder inside your project
- [ ] Hetzner CX22 provisioned in Singapore with Ubuntu 24.04
- [ ] Local Redis installed on Hetzner (for BullMQ)
- [ ] **chrony installed + UTC timezone set on Hetzner (doc 24)**
- [ ] **SSH hardened: PasswordAuthentication no, PermitRootLogin no (doc 27)**
- [ ] **UFW firewall: default deny, only port 22 open (doc 27)**
- [ ] **Fail2ban: active, 3 retries, 24h SSH ban (doc 27)**
- [ ] **Daily snapshot script deployed + cron scheduled 2 AM UTC (doc 27)**
- [ ] **MongoDB backup script deployed + cron scheduled 1st/16th 3 AM UTC (doc 27)**
- [ ] **Cloudflare R2 bucket created with versioning (doc 27)**
- [ ] Deploy user created on Hetzner
- [ ] PM2 installed + configured for auto-restart
- [ ] `.env.local` populated with all required values
- [ ] Server `.env` file populated with all worker variables
- [ ] GitHub repo connected to Vercel
- [ ] Security headers configured in `next.config.ts` (doc 27)
- [ ] All env vars configured in Vercel dashboard
- [ ] Claude Code tested — knows the locked rules
- [ ] MongoDB Atlas IP whitelist: specific IPs only (no 0.0.0.0/0)
- [ ] **Before Sprint 2: run historical backfill script (doc 23)**
- [ ] **Test restore: verify both snapshot and R2 backup work (doc 27)**

If all boxes checked → proceed to Sprint 1 (doc 18).

---

## 🎯 What's New vs. Previous Versions

If you've been following along, here's what changed:

### v1 (Original 10 docs)
Basic spec for gold/silver/copper/crypto with blog.

### v2 (Added docs 11–18)
Added logging, testing, security, CMS, MFA, JSON-LD, agent config files.

### v3 (Previous Version)
- **Added doc 20:** Claude Code beginner setup guide
- **Added doc 21:** Full Hetzner VPS implementation
- **Added doc 22:** MetalpriceAPI fixes, forex, geo-targeting, YMYL, fixed subscription UI
- **Updated doc 17:** CLAUDE.md with all v16 Next.js breaking changes, Zod v4, Tiptap v3
- **Confirmed:** Upstash + BullMQ incompatibility, use Local Redis on Hetzner
- **Corrected:** MetalpriceAPI plan is $16.99/mo (Basic Plus) not $30
- **Fixed:** Subscription UI no longer has side-spaces problem

### v3.1 (Previous Version)
- **Added doc 23:** Historical backfill — solves empty 1Y/5Y charts on Day 1
- **Added doc 24:** Time synchronization — clocks aligned across Vercel/Atlas/Upstash/Hetzner via chrony + UTC-everywhere policy
- **Updated:** Day 0 checklist now includes chrony install + backfill run before Sprint 2

### v3.2 (Previous Version)
- **Added doc 25:** Regional units — Tola, 10-gram, 1-gram, karat tables for Pakistan + India pages

### v3.3 (Previous Version)
- **Added doc 26:** Disaster Recovery Plan + Cloudflare Workers verdict
- **Added doc 27:** Daily Hetzner snapshots + 15-day MongoDB R2 backup + full network security

### v3.4 (This Version — FINAL)
- **Added doc 28:** Comprehensive Day 0 beginner guide with full folder structure tree
- **Changed:** Hetzner snapshots from **daily → weekly** (saves ~$1.50/mo)
- **Updated:** Clerk to **v7.2.3** (Core 3) — was v6
- **Verified:** All version pins are April 2026 latest stable (Next 16.2.4, React 19.2, Tailwind v4, Zod v4, Tiptap v3, Clerk v7.2)
- **Total cost:** ~$25.50/mo | **29 docs + 1 diagram**
- **Supports:** Both standard tola (11.6638g) and Pakistani bazaar tola (12.5g) with user toggle
- **Supports:** 5 karats for Pakistan (24K/22K/21K/20K/18K), 3 for India (24K/22K/18K)
- **Pre-computes** all rates server-side every 60s → zero math in API routes

---

*Last reviewed: April 23, 2026*
*Commodity Intelligence Platform v3.0 — 25 files, ready for Sprint 1*
