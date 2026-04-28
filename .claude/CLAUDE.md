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


### Local Development Rules

ALWAYS:
- Run docker-compose.dev.yml for Redis (mirrors Hetzner Local Redis)
- Use PRICE_DATA_MODE=mock by default in dev
- Use a SEPARATE Atlas dev cluster (NEVER share with production)
- Use a SEPARATE Upstash dev database
- Use Clerk DEVELOPMENT instance keys (pk_test_*, sk_test_*)
- Worker should hot-reload via tsx watch in dev

NEVER:
- Connect to production MongoDB Atlas from local dev
- Use production Upstash Redis token in local dev
- Use Clerk production keys in local development
- Run live mode (PRICE_DATA_MODE=live) for routine dev work
- Commit .env.local files to Git