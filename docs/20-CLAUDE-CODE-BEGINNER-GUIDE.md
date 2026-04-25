# Claude Code — Beginner Setup Guide
## How to Install Your Agent Files into a Project

> **Who this is for:** Complete beginners who have never used Claude Code before.
> **What you'll achieve:** Claude Code will know your entire CIP-2026 project automatically — saving you 40–60% of typing every session.

---

## STEP 0 — Install Claude Code (First Time Only)

Claude Code runs in your terminal (command line). You install it once globally.

### Prerequisites
- Node.js version 18 or higher must be installed on your computer
- Check by opening your terminal and typing: `node --version`
- If you see a number like `v20.11.0` you're good. If not, go to https://nodejs.org and install it.

### Install Claude Code
Open your terminal and run this one command:

```bash
npm install -g @anthropic/claude-code
```

Then verify it worked:
```bash
claude --version
```

You should see a version number printed. Done.

---

## STEP 1 — Understand Where the Files Go

Your project folder (the one with your Next.js app) will look like this after setup:

```
cip-2026/                          ← Your project root
├── .claude/                       ← Hidden folder (create this)
│   ├── settings.json              ← Claude Code preferences
│   └── context/
│       └── glossary.md            ← Domain terms Claude should know
│
├── CLAUDE.md                      ← MOST IMPORTANT FILE (Claude reads this first)
├── AGENTS.md                      ← Just redirects to CLAUDE.md
├── SKILLS.md                      ← Custom shortcuts Claude can perform
│
├── app/                           ← Your Next.js app folder
├── components/
├── package.json
└── ... (rest of your project)
```

**The 3 key files live at the ROOT of your project** — same level as `package.json`.
The `.claude/` folder is hidden (starts with a dot) — that's normal.

---

## STEP 2 — Open Your Project in Terminal

Every command below must be run from INSIDE your project folder.

```bash
# Go to your project folder
# Replace the path with wherever your project actually is

cd /path/to/your/cip-2026

# On Mac example:
cd ~/Desktop/cip-2026

# On Windows example:
cd C:\Users\YourName\Desktop\cip-2026

# Confirm you're in the right place — you should see package.json listed
ls        # Mac/Linux
dir       # Windows
```

---

## STEP 3 — Create the .claude Folder and Settings File

Run these commands one by one in your terminal:

```bash
# Create the hidden .claude folder and the context subfolder
mkdir -p .claude/context
```

Now create the settings file. Copy and paste this entire block into your terminal:

```bash
cat > .claude/settings.json << 'EOF'
{
  "autoLoad": ["CLAUDE.md", "SKILLS.md", ".claude/context/glossary.md"],
  "preferences": {
    "verbosity": "normal",
    "autoApprove": false,
    "diffMode": "unified"
  },
  "context": {
    "maxTokens": 8000,
    "prioritize": ["CLAUDE.md"]
  }
}
EOF
```

Verify it was created:
```bash
cat .claude/settings.json
```
You should see the JSON content printed back.

---

## STEP 4 — Create CLAUDE.md (The Most Important File)

This is the file Claude reads before doing ANYTHING in your project.
Copy and paste this entire block into your terminal:

```bash
cat > CLAUDE.md << 'EOF'
# CIP-2026 — Commodity Intelligence Platform
## Claude Code Master Context

### Project Overview
Next.js 16.2 SaaS platform for gold, silver, copper, and crypto price intelligence.
Target market: South Asian diaspora (Pakistan, India, UAE). Scale target: 1M users.
Owner: Solo founder, Singapore-based.

### Version Pins (April 2026 — verify before adding packages)
- next: ^16.2.4
- react: ^19.2
- tailwindcss: v4 (NOT v3)
- zod: ^4.0 (import from 'zod/v4' or root after upgrade)
- @tiptap/react: ^3.0 (MIT free — do NOT enable paid collaboration features)
- lucide-react: ^1.8
- @clerk/nextjs: latest (v6+)

### Tech Stack (LOCKED — never suggest alternatives)
- Framework: Next.js 16.2 App Router (TypeScript, strict mode)
- Database: MongoDB Atlas (native driver — NEVER suggest Mongoose)
- Cache: Upstash Redis + @upstash/ratelimit
- Auth: Clerk (@clerk/nextjs — MFA enforced for admin routes)
- Hosting: Vercel (frontend) + Hetzner VPS (worker jobs)
- Queue: BullMQ
- UI: shadcn/ui + Tailwind v4 (use tw-animate-css NOT tailwindcss-animate)
- Email: Resend + React Email
- Charts: lightweight-charts (NEVER suggest Recharts or Chart.js)
- Editor: Tiptap v3 (free MIT extensions only)
- Logging: Pino → MongoDB logs collection
- Testing: Vitest + Playwright + @fast-check/vitest

### Locked Libraries (use ONLY these, no substitutions)
- Validation: Zod v4 (import { z } from 'zod/v4')
- Forms: react-hook-form + @hookform/resolvers/zod
- Icons: lucide-react (NEVER heroicons or FontAwesome)
- Dates: date-fns (NEVER moment or dayjs)
- Phone: libphonenumber-js
- ID generation: nanoid
- Markdown: next-mdx-remote/rsc

### NEVER Do These
- NEVER use Mongoose — use native mongodb driver only
- NEVER use moment.js — use date-fns
- NEVER use Recharts or Chart.js — use lightweight-charts
- NEVER use heroicons — use lucide-react
- NEVER use pages/ router — use App Router only
- NEVER store secrets in code — use environment variables
- NEVER disable TypeScript strict mode
- NEVER use console.log — use Pino logger
- NEVER create new API routes without Zod validation
- NEVER skip rate limiting on public endpoints
- NEVER use middleware.ts — Next.js 16 renamed this to proxy.ts (BREAKING CHANGE)
- NEVER use tailwindcss-animate — replaced by tw-animate-css in Tailwind v4
- NEVER use Zod v3 import syntax (z from 'zod') in new files — use 'zod/v4'

### ALWAYS Do These
- ALWAYS validate inputs with Zod before processing
- ALWAYS use withLogging() wrapper on API routes
- ALWAYS add rate limiting via @upstash/ratelimit
- ALWAYS use MongoDB native driver with module-level cached client
- ALWAYS add correlation ID (x-trace-id) to logs
- ALWAYS use TypeScript — no .js files
- ALWAYS run pnpm audit after adding new packages
- ALWAYS add loading and error states to UI components
- ALWAYS use async params in pages: const { slug } = await params (Next.js 16 breaking change)
- ALWAYS place Clerk auth in proxy.ts (not middleware.ts) for Next.js 16

### Price Data Sources
- Metals: MetalpriceAPI (60-second polling, Hetzner worker)
- Crypto: Binance WebSocket (real-time, Hetzner worker)
- Units: Troy ounce (gold/silver), pound (copper), USD default
- Gold units also in: tola (Pakistan = 11.664g), gram, kilogram

### Database Collections
logs, prices, candles, posts, subscribers, jsonld_templates, security_scans

### Design System
- Theme: Dark-first ("Bloomberg Terminal meets 2026")
- Brand colors: gold=#D4AF37, silver=#C0C0C0, copper=#B87333, crypto=#F7931A
- Price up: #22c55e (green), Price down: #ef4444 (red)

### File Reference
See /docs/ folder for full specs:
- Architecture: 01-ARCHITECTURE-SPEC.md
- API Contracts: 09-API-CONTRACTS.md
- MongoDB Schemas: 08-MONGODB-SCHEMAS.md
- CMS System: 14-CMS-SYSTEM.md
- MFA Auth: 15-MFA-AUTHENTICATION.md
- Logging: 11-LOGGING-OBSERVABILITY.md
EOF
```

---

## STEP 5 — Create AGENTS.md

Simple redirect file. Copy and paste:

```bash
cat > AGENTS.md << 'EOF'
# CIP-2026 — Agent Instructions

All agent instructions, rules, and context are maintained in CLAUDE.md.

Please read CLAUDE.md before taking any action in this project.
EOF
```

---

## STEP 6 — Create SKILLS.md

These are custom shortcuts Claude can run. Copy and paste:

```bash
cat > SKILLS.md << 'EOF'
# CIP-2026 — Claude Skills

## How to Use Skills
Type the skill name in your Claude Code prompt, e.g.:
"Use the add-api-route skill to create a GET /api/metals/copper endpoint"

---

## Skill: add-api-route
**Trigger:** "add an API route" or "create endpoint"
**What Claude does:**
1. Creates file at app/api/{route}/route.ts
2. Adds Zod validation schema
3. Adds withLogging() wrapper
4. Adds rate limiting via @upstash/ratelimit
5. Returns typed JSON response
6. Creates matching Vitest test file

---

## Skill: add-mongo-collection
**Trigger:** "add a collection" or "create MongoDB schema"
**What Claude does:**
1. Adds schema to lib/db/schemas/{name}.ts
2. Adds TypeScript interface
3. Adds indexes (including TTL if time-series)
4. Creates seed script at scripts/seed-{name}.ts

---

## Skill: add-component
**Trigger:** "add a component" or "create a UI component"
**What Claude does:**
1. Creates component at components/{category}/{Name}.tsx
2. Uses shadcn/ui primitives
3. Uses lucide-react icons only
4. Adds TypeScript props interface
5. Adds loading and error states
6. Creates matching Storybook story

---

## Skill: fix-vulnerability
**Trigger:** "fix vulnerability" or "security issue"
**What Claude does:**
1. Runs pnpm audit to identify issues
2. Attempts pnpm audit --fix
3. For manual fixes: checks for package overrides
4. Runs pnpm dedupe after fixing
5. Logs fix to security_scans collection

---

## Skill: deploy-to-staging
**Trigger:** "deploy to staging"
**What Claude does:**
1. Runs pnpm type-check
2. Runs pnpm lint
3. Runs pnpm test
4. Runs pnpm build
5. If all pass: runs vercel --target preview

---

## Skill: rotate-secrets
**Trigger:** "rotate secrets" or "update API keys"
**What Claude does:**
1. Lists all secrets from .env.example
2. Identifies which service each belongs to
3. Provides step-by-step rotation checklist
4. Reminds to update Vercel environment variables
EOF
```

---

## STEP 7 — Create the Glossary File

Domain terms so Claude understands your business:

```bash
cat > .claude/context/glossary.md << 'EOF'
# CIP-2026 Domain Glossary

## Price Units
- **tola**: Pakistani gold unit = 11.664 grams = 0.375 troy oz
- **troy ounce**: Standard metals unit = 31.1035 grams
- **candle**: OHLCV data point (Open, High, Low, Close, Volume)

## Business Terms
- **YMYL**: "Your Money or Your Life" — Google's high-scrutiny content category
- **pip**: Smallest price movement unit
- **spread**: Difference between buy and sell price

## Technical Terms
- **ingestion cycle**: 60-second Hetzner worker job that fetches and stores prices
- **correlation ID**: x-trace-id header that links all logs from one request
- **preview token**: Single-use URL token for viewing unpublished CMS posts

## User Roles
- **viewer**: Read-only access
- **author**: Can write posts, cannot approve
- **editor**: Can approve others' posts
- **admin**: Full access including MFA settings, logs, security dashboard

## Post States
- Draft → Pending Review → Approved → Published (optional: Scheduled)
EOF
```

---

## STEP 8 — Copy Your Documentation Into the Project

Your 19 documentation files from this package should be stored in your project so Claude can reference them.

```bash
# Create a docs folder in your project
mkdir -p docs

# If you downloaded the docs as files, copy them in:
# cp /path/to/downloaded/docs/*.md docs/

# Your docs folder should contain:
# docs/00-MASTER-README.md
# docs/01-ARCHITECTURE-SPEC.md
# docs/02-DISCLAIMER-SYSTEM.md
# ... all 19 files
```

---

## STEP 9 — Start Claude Code

Now you're ready to use Claude Code in your project.

```bash
# Make sure you're in your project root
cd /path/to/cip-2026

# Start Claude Code
claude
```

You'll see an interactive prompt. Claude will automatically read `CLAUDE.md` on startup.

**Your first message should be:**
```
Read CLAUDE.md and confirm you understand the CIP-2026 project rules and tech stack.
```

Claude will respond confirming it knows: Next.js 15, MongoDB native driver, Upstash Redis, Clerk MFA, locked libraries, etc.

---

## STEP 10 — Verify Everything Is Working

Test that Claude knows your project by asking these questions one at a time:

```
Question 1: "What chart library should we use in this project?"
Expected: lightweight-charts (NOT Recharts)

Question 2: "How should I connect to MongoDB?"
Expected: Native mongodb driver with module-level cached client (NOT Mongoose)

Question 3: "What's a tola?"
Expected: Pakistani gold unit = 11.664 grams

Question 4: "Create a basic API route for GET /api/test"
Expected: Should include Zod v4 validation, withLogging(), rate limiting automatically

Question 5: "Where does Clerk middleware go in Next.js 16?"
Expected: proxy.ts (NOT middleware.ts) — this is a breaking change in Next.js 16

Question 6: "How do I read page params in Next.js 16?"
Expected: const { slug } = await params — params is now async
```

If Claude answers correctly — your setup is working perfectly.

---

## Troubleshooting

### Problem: Claude doesn't seem to know my tech stack
**Fix:** Explicitly ask it to re-read the file:
```
Please re-read CLAUDE.md now and confirm the locked library rules.
```

### Problem: Claude suggests Mongoose or Recharts
**Fix:** Remind it:
```
Check CLAUDE.md — we never use Mongoose or Recharts in this project.
```

### Problem: `claude` command not found after install
**Fix:** Your terminal needs to restart, or npm global bin is not in PATH:
```bash
# Add to your ~/.bashrc or ~/.zshrc:
export PATH="$(npm bin -g):$PATH"
# Then restart your terminal
```

### Problem: `.claude/settings.json` not loading
**Fix:** Make sure you're running `claude` from the project root (same folder as `CLAUDE.md`):
```bash
pwd           # Should show your project root
ls CLAUDE.md  # Should find the file
claude        # Now start
```

---

## Quick Reference Card

| What you want | What to type in Claude Code |
|---|---|
| Create a new API endpoint | "Use add-api-route skill: create GET /api/metals/gold" |
| Add a new database collection | "Use add-mongo-collection skill: create alerts collection" |
| Create a UI component | "Use add-component skill: create GoldPriceCard component" |
| Fix a security warning | "Use fix-vulnerability skill" |
| Deploy for testing | "Use deploy-to-staging skill" |
| Check your stack rules | "What are the NEVER rules in this project?" |
| Remind Claude of context | "Re-read CLAUDE.md and summarize the project" |

---

## File Checklist — Run This to Verify Setup

```bash
echo "=== Checking CIP-2026 Claude Code Setup ==="
echo ""

check_file() {
  if [ -f "$1" ]; then
    echo "✅  $1"
  else
    echo "❌  $1 — MISSING"
  fi
}

check_file "CLAUDE.md"
check_file "AGENTS.md"
check_file "SKILLS.md"
check_file ".claude/settings.json"
check_file ".claude/context/glossary.md"

echo ""
echo "=== Done. Fix any ❌ items before starting Claude Code ==="
```

Save this as `check-setup.sh` and run it with:
```bash
bash check-setup.sh
```

---

*Document 20 of the CIP-2026 Package — Claude Code Beginner Setup Guide*
*Cross-reference: 17-CLAUDE-AGENT-FILES.md for full agent file specifications*
