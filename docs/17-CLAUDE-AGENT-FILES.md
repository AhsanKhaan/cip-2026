# 🤖 17 — Claude Agent Configuration Files

**Purpose:** These files live in your repo and help Claude Code / Claude Design automatically understand your project without you re-explaining it every session.

**Token savings:** With these files present, Claude Code reads them automatically when you open a project — you save ~2,000 tokens per session by not re-pasting system context.

---

## 1. File Overview

| File | Location | Read by | Purpose |
|------|----------|---------|---------|
| `README.md` | Repo root | Everyone | Human onboarding, setup instructions |
| `CLAUDE.md` | Repo root | Claude Code | Project conventions, rules, preferences |
| `AGENTS.md` | Repo root | Claude Code (v2025 convention) | Same as CLAUDE.md — industry standard |
| `SKILLS.md` | Repo root | Claude Code with skills | Custom skill definitions |
| `.claude/` | Repo root | Claude Code | Project-scoped Claude config |

**Best practice:** Create all of them. `CLAUDE.md` is Anthropic's convention, `AGENTS.md` is becoming the cross-tool standard. Maintain both (or symlink one to the other) so whichever tool you use finds it.

---

## 2. `README.md` (for humans)

Create at repo root. This is what collaborators and future-you read to get oriented.

```markdown
# Commodity Intelligence Platform (CIP)

Real-time market intelligence for gold, silver, copper, and crypto.

## Stack

- **Frontend:** Next.js 16.2 (App Router) + Tailwind v4 + shadcn/ui
- **Backend:** Next.js API routes + BullMQ worker
- **Database:** MongoDB Atlas (time-series) + Upstash Redis
- **Auth:** Clerk (MFA required for admins)
- **Deployment:** Vercel (web) + Hetzner VPS (worker)

## Architecture

See [docs/01-ARCHITECTURE-SPEC.md](./docs/01-ARCHITECTURE-SPEC.md) for full details.

## Quick Start

```bash
# Install
pnpm install

# Copy env template
cp .env.example .env.local
# Fill in values (see docs/01 section 5 for full list)

# Initialize database
pnpm tsx scripts/init-db.ts

# Seed disclaimers
pnpm --filter worker seed:disclaimers

# Start dev
pnpm dev          # Runs web + worker concurrently
```

## Project Structure

```
apps/
  web/         Next.js frontend
  worker/      BullMQ worker (ingestion + jobs)
packages/
  shared/      Shared Zod schemas + types
docs/          Full specifications (00-16)
scripts/       One-off scripts (init, seeds)
```

## Scripts

```bash
pnpm dev                  # Start all apps in dev
pnpm build                # Production build
pnpm test                 # Run all tests
pnpm test:e2e             # Playwright E2E
pnpm lint                 # ESLint + Prettier
pnpm typecheck            # TypeScript check
pnpm security:audit       # Vulnerability scan
pnpm gen:tests            # Auto-generate test scaffolds
```

## Documentation

All specs in `/docs`:
- 00 — Master README & decisions
- 01 — Architecture
- 02 — Auto-disclaimer system
- 03 — Subscription system
- 04 — Design system
- 05 — Claude Code prompts
- 06 — Claude Design prompts
- 07 — PMO sprint plan
- 08 — MongoDB schemas
- 09 — API contracts
- 10 — QA checklist
- 11 — Logging & observability
- 12 — Testing strategy
- 13 — Security & vulnerabilities
- 14 — CMS system
- 15 — MFA authentication
- 16 — Dynamic JSON-LD

## Contributing

1. Create feature branch from `main`
2. Write code following conventions in [CLAUDE.md](./CLAUDE.md)
3. Add tests (or run `pnpm gen:tests` for auto-scaffolds)
4. Ensure `pnpm lint && pnpm typecheck && pnpm test` pass
5. Open PR — CI runs full security + test suite
6. Request review

## License

Proprietary. All rights reserved.

## Support

- Technical: [dev@yoursite.com](mailto:dev@yoursite.com)
- Security: [security@yoursite.com](mailto:security@yoursite.com)
```

---

## 3. `CLAUDE.md` (for Claude Code)

This is the most important file. Claude reads it automatically when you open the repo.

```markdown
# Claude Code Configuration

This file tells Claude Code about project conventions, preferences, and constraints.
Claude should read this before generating any code in this repository.

## Project Context

This is a **commodity intelligence platform** (live prices + blog + CMS) built with:
- Next.js 16.2 (App Router) + TypeScript strict
- MongoDB (time-series collections for candles)
- Upstash Redis for caching
- BullMQ worker on Hetzner VPS for ingestion + jobs
- Clerk for auth with MFA required on admin routes
- shadcn/ui + Tailwind v4 for UI (dark-first theme)

**Version pins (April 2026):**
- next: 16.2.4 | react: 19.2 | tailwindcss: v4 | zod: v4 | tiptap: v3 | @clerk/nextjs: v7.2 | lucide-react: 1.8.x

Full architecture: `/docs/01-ARCHITECTURE-SPEC.md`

## Critical Rules

### 1. NEVER

- Use `console.log` in production code → use `logger` from `@/lib/logger`
- Access `process.env.*` directly → use typed `getWebEnv()` / `getWorkerEnv()`
- Write database queries without Zod validation
- Fetch from external APIs inside Next.js API routes → read from MongoDB/Redis only
- Use Mongoose → native `mongodb` driver only
- Hardcode secrets → always env vars
- Write `any` types → use `unknown` + narrow, or proper types
- Include PII in logs (email, phone, token) → auto-redaction handles it, but don't bypass
- Import from `@/components/ui/*` into server components if shadcn component uses client hooks
- Use `middleware.ts` → **BREAKING CHANGE in Next.js 16: renamed to `proxy.ts`** with exported function named `proxy()`
- Use Zod v3 imports from `'zod'` root in new code → import from `'zod/v4'` or upgrade to `zod@4`

### 2. ALWAYS

- Use React Server Components by default; add `'use client'` only when needed
- Validate all inputs with Zod (route params, query, body)
- Use `cache()` from React for deduped data fetching within a request
- Rate-limit new API endpoints via `@upstash/ratelimit`
- Add `traceId` to logs: `logger.child({ traceId: req.headers.get('x-trace-id') })`
- Write tests in the same PR as new features
- Use `tabular-nums` for price/numeric displays (`font-variant-numeric: tabular-nums`)
- Include `aria-*` attributes for interactive elements
- Respect `prefers-reduced-motion`

## Code Style

- **File names:** kebab-case for files, PascalCase for component files
- **Functions:** camelCase
- **Types/Interfaces:** PascalCase
- **Constants:** SCREAMING_SNAKE_CASE
- **Imports:** Absolute via `@/` path aliases, no relative traversal past `../`
- **Error handling:** `try/catch` with structured logger, never swallow errors silently
- **Async:** `async/await` only, no `.then()` chains
- **Comments:** Explain WHY, not WHAT. Prefer self-documenting code.

## Testing

- **Framework:** Vitest for unit + integration, Playwright for E2E
- **Location:** `__tests__/` adjacent to source, `e2e/specs/` for Playwright
- **Coverage target:** 80% statements, 100% on security-critical paths
- Generate tests where possible via `pnpm gen:tests` — don't write boilerplate

## Common Patterns

### API route

```ts
// apps/web/app/api/example/route.ts
import { z } from 'zod';
import { withLogging } from '@/lib/with-logging';
import { ratelimit } from '@/lib/redis';
import { getMongo } from '@/lib/mongo';

const RequestSchema = z.object({ /* ... */ });

export const POST = withLogging(async (req: Request) => {
  // 1. Rate limit
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { success } = await ratelimit.api.limit(ip);
  if (!success) return Response.json({ error: 'rate_limited' }, { status: 429 });

  // 2. Validate
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });

  // 3. Business logic
  const db = await getMongo();
  const result = await db.collection('...').findOne({ /* ... */ });

  // 4. Response
  return Response.json({ success: true, data: result });
}, '/api/example');
```

### Server Component fetching data

```tsx
// app/some-page/page.tsx
import { cache } from 'react';
import { getMongo } from '@/lib/mongo';

const getPost = cache(async (slug: string) => {
  const db = await getMongo();
  return db.collection('posts').findOne({ slug, status: 'published' });
});

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;  // Next.js 16: params is now async
  const post = await getPost(slug);
  if (!post) notFound();
  return <Article post={post} />;
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.slug);
  return { title: post?.title, description: post?.description };
}
```

### Worker job

```ts
// apps/worker/src/jobs/example.ts
import { withJobLogging } from '../lib/with-job-logging';

export const processExample = withJobLogging(async (job, log) => {
  log.info({ context: job.data }, 'Processing example job');

  try {
    // ... work ...
    return { processed: true };
  } catch (err) {
    log.error({ err }, 'Example job failed');
    throw err; // BullMQ will retry
  }
}, 'example');
```

## Preferred Libraries (don't suggest alternatives unless asked)

- **Validation:** Zod v4 (`import { z } from 'zod/v4'` or `zod@^4`)
- **DB driver:** native `mongodb`
- **Cache:** `@upstash/redis` + `@upstash/ratelimit`
- **Auth:** Clerk (`@clerk/nextjs` v7+) — auth file is now `proxy.ts` not `middleware.ts`
- **Forms:** `react-hook-form` + `@hookform/resolvers/zod`
- **Icons:** `lucide-react` (^1.8) — NOT heroicons, NOT FontAwesome
- **Charts:** `lightweight-charts` (NOT Recharts, NOT Chart.js)
- **Email:** Resend + React Email
- **Logger:** Pino
- **Testing:** Vitest + Playwright + `@fast-check/vitest`
- **CMS editor:** Tiptap v3 (MIT, free — do NOT use collaboration/AI paid features)
- **Markdown:** `next-mdx-remote/rsc` for server rendering
- **Phone:** `libphonenumber-js`
- **Date:** `date-fns` (NOT moment.js, NOT dayjs)
- **CSS:** Tailwind v4 — use `@import "tw-animate-css"` NOT `tailwindcss-animate`

## File Generation Rules

When creating a new file:
1. Check if a similar pattern exists → match it
2. Add Zod schemas to `packages/shared/src/schemas.ts` if reusable
3. Add MongoDB indexes to `scripts/init-db.ts`
4. Add API route documentation to `docs/09-API-CONTRACTS.md`
5. Add test file (or run `pnpm gen:tests`)

## Token Saving Tips

- Don't restate architecture — it's in `/docs/01`
- Don't re-explain schemas — reference `/docs/08` section numbers
- Don't repeat security rules — they're above, apply them silently
- When uncertain, ask ONE question, not five

## When to ASK vs. DO

**Just do** — styling tweaks, adding tests, fixing typos, implementing from clear specs

**Ask first** — adding dependencies, changing auth logic, modifying public APIs, deleting data

## Related Docs

- `/docs/05-CLAUDE-CODE-PROMPTS.md` — Task-by-task prompt library
- `/docs/06-CLAUDE-DESIGN-PROMPTS.md` — Design component prompts
- `/docs/08-MONGODB-SCHEMAS.md` — Full schema reference
- `/docs/09-API-CONTRACTS.md` — Endpoint contracts
```

---

## 4. `AGENTS.md` (cross-tool standard)

Same content as `CLAUDE.md`, different filename. Many AI coding tools (Cursor, Cline, Continue) read `AGENTS.md` by convention. To avoid duplication:

**Option A — Symlink:**
```bash
ln -s CLAUDE.md AGENTS.md
```

**Option B — Short redirect file:**
```markdown
# AGENTS.md

This file redirects AI coding agents to the primary configuration.

Please read [CLAUDE.md](./CLAUDE.md) for full project conventions.

All rules, patterns, and preferences documented there apply to all AI agents
working in this repository.
```

**Recommendation:** Use Option B (short redirect) so tool authors can grep for `AGENTS.md` existence without following symlinks, and update CLAUDE.md as the single source of truth.

---

## 5. `SKILLS.md` (custom skill definitions)

For Claude Code's skill system. Define reusable recipes Claude can invoke automatically.

```markdown
# SKILLS.md

Custom skills for the Commodity Intelligence Platform project.
Claude Code loads these automatically when working in this repo.

---

## Skill: `add-api-route`

**Trigger:** User asks to add an API endpoint.

**Steps:**
1. Verify endpoint doesn't already exist (check `apps/web/app/api/`)
2. Create route file following pattern in `CLAUDE.md` § Common Patterns → API route
3. Add Zod request/response schemas to `packages/shared/src/schemas.ts`
4. Add rate limit entry to `apps/web/lib/redis.ts`
5. Add endpoint spec to `docs/09-API-CONTRACTS.md`
6. Create test file at `apps/web/__tests__/integration/api/<name>.test.ts`
7. Run `pnpm typecheck && pnpm test` to verify

---

## Skill: `add-mongo-collection`

**Trigger:** User adds a new data domain.

**Steps:**
1. Design Zod schema in `packages/shared/src/schemas.ts`
2. Add TypeScript type via `z.infer`
3. Add indexes to `scripts/init-db.ts`
4. Document schema in `docs/08-MONGODB-SCHEMAS.md`
5. Add typed collection accessor to `apps/web/lib/mongo.ts`
6. Create factory in `__tests__/factories/` for test data

---

## Skill: `add-cms-post-type`

**Trigger:** User adds a new blog/post category or content type.

**Steps:**
1. Add enum value to `PostCategoryEnum` in schema
2. Create JSON-LD template in `scripts/seed-jsonld-templates.ts`
3. Add auto-disclaimer mapping in `apps/web/lib/disclaimers.ts`
4. Add route handler if it has its own URL pattern
5. Add to search filter options
6. Document in `docs/14-CMS-SYSTEM.md`

---

## Skill: `fix-vulnerability`

**Trigger:** User reports or npm audit shows a vulnerability.

**Steps:**
1. Run `pnpm audit --json` to see full details
2. Identify affected package and attack vector
3. Try `pnpm audit --fix` first (safest)
4. If that fails, try `pnpm update <package>` to latest minor
5. If breaking change required, add to `pnpm.overrides` with pinned safe version
6. Run full test suite
7. Document in commit message with CVE reference

---

## Skill: `add-component`

**Trigger:** User asks for a new React component.

**Steps:**
1. Determine if it's a Server Component or Client Component
2. Check `docs/04-DESIGN-SYSTEM.md` for existing patterns/tokens
3. Use only design tokens (no ad-hoc colors)
4. Add `aria-*` attributes for accessibility
5. Create Storybook story at `*.stories.tsx`
6. Add to component index if part of a module

---

## Skill: `deploy-to-staging`

**Trigger:** User is ready to test in staging.

**Steps:**
1. Ensure `main` branch is clean and CI green
2. Push to `staging` branch → triggers Vercel preview
3. Run `pnpm test:e2e --project=chromium` against preview URL
4. Run security audit: `pnpm security:full`
5. Manual smoke test of top 3 user flows
6. If all pass: create PR from staging to production

---

## Skill: `rotate-secrets`

**Trigger:** Quarterly security rotation, or suspected leak.

**Steps:**
1. Generate new secrets (nanoid or `openssl rand -hex 32`)
2. Update in Vercel env vars
3. Update in Hetzner worker env
4. Update in local `.env.local` for active devs
5. Old secret expires gracefully (24h overlap on auth tokens)
6. Log rotation event in audit log
7. Document in `/docs/security-reviews/YYYY-MM-DD.md`
```

---

## 6. `.claude/` Directory

Newer Claude Code versions support project-scoped configuration in `.claude/` directory:

```
.claude/
├── settings.json      # Project config
├── context/
│   ├── architecture.md   # Short summary for context
│   ├── conventions.md    # Coding rules
│   └── glossary.md       # Project-specific terms
└── commands/
    ├── test.md           # Custom slash command: /test
    └── deploy.md         # Custom slash command: /deploy
```

### `.claude/settings.json`

```json
{
  "autoLoad": ["CLAUDE.md", "docs/01-ARCHITECTURE-SPEC.md"],
  "preferences": {
    "style": "concise",
    "askBeforeDestructive": true,
    "preferServerComponents": true,
    "testWithNewFeatures": true
  },
  "ignore": [
    "node_modules/",
    ".next/",
    "dist/",
    "coverage/",
    "playwright-report/",
    "*.log"
  ]
}
```

### `.claude/context/glossary.md`

Teaches Claude your domain-specific terms:

```markdown
# Glossary

- **CIP** — Commodity Intelligence Platform (this project)
- **YMYL** — Your Money Your Life (Google content quality framework)
- **Tick** — A single price update from a data source
- **Candle** — OHLC bar for a time interval (1m, 1h, 1d)
- **Ingestion** — Pulling prices from external sources into MongoDB
- **Stale data** — Last known price when all sources unreachable
- **Disclaimer engine** — Auto-injection system for legal text
- **4-stage workflow** — Draft → Pending → Approved → Published (CMS)
- **Tola** — 11.66 grams (common gold unit in South Asia)
- **Failover** — Using backup API when primary fails
- **Metals** — Gold, silver, copper (non-crypto commodities here)
- **T-ID** — Task ID referencing docs/05 prompts (e.g., T1.1, T3.3)
- **D-ID** — Design task ID referencing docs/06 (e.g., D2.1, D5.3)
```

### `.claude/commands/test.md`

```markdown
# /test command

When user types `/test`, run this sequence:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test:unit`
4. `pnpm test:integration`
5. If all pass, suggest: "Want to run E2E? That takes ~5 min."
6. Only if user confirms: `pnpm test:e2e`

Report results clearly with any failures highlighted.
```

### `.claude/commands/deploy.md`

```markdown
# /deploy command

When user types `/deploy`, perform these checks before deployment:

1. `git status` — must be clean
2. `git branch` — must be on `main` or a release branch
3. `pnpm lint && pnpm typecheck && pnpm test` — all must pass
4. `pnpm security:audit` — no high/critical
5. Show summary, ask "Proceed with deployment? [y/N]"
6. If yes: `git push` (CI handles deploy via Vercel webhook)
7. Monitor Vercel dashboard for deploy status
```

---

## 7. Keeping Files In Sync

When the project evolves, these files must be updated. Include in your PR checklist:

- [ ] Added new dependency? → Update `CLAUDE.md` "Preferred Libraries" if applicable
- [ ] New coding pattern? → Add to `CLAUDE.md` "Common Patterns"
- [ ] New skill/workflow? → Add to `SKILLS.md`
- [ ] Breaking API change? → Update `docs/09-API-CONTRACTS.md`
- [ ] New folder? → Update `README.md` "Project Structure"

**Automate reminder:** Add a git hook:

```bash
# .husky/pre-commit
if git diff --cached --name-only | grep -q "package.json"; then
  echo "⚠ package.json changed. Did you update CLAUDE.md if adding a new library?"
fi
```

---

## 8. Repository Root Layout (Final)

```
commodity-intelligence/
├── README.md             ← For humans
├── CLAUDE.md             ← Primary agent config
├── AGENTS.md             ← Redirect to CLAUDE.md
├── SKILLS.md             ← Custom Claude skills
├── .claude/              ← Project-scoped Claude config
│   ├── settings.json
│   ├── context/
│   └── commands/
├── .gitignore
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── apps/
│   ├── web/
│   └── worker/
├── packages/
│   └── shared/
├── docs/
│   ├── 00-MASTER-README.md
│   ├── 01-ARCHITECTURE-SPEC.md
│   ├── ... (all 17 docs)
└── scripts/
```

---

## 9. Measurable Benefit

With these files in place:

| Scenario | Without files | With files |
|----------|---------------|-----------|
| Start new coding session | Paste ~2000 tokens of context | 0 tokens (auto-loaded) |
| "Add a new API route" | ~500 tokens to re-explain conventions | ~50 tokens (skill reference) |
| "Fix this vulnerability" | 200 tokens of steps | 0 tokens (skill auto-runs) |
| Claude uses wrong library | Common | Rare (CLAUDE.md locks preferences) |
| Claude forgets project terms | Common ("what's a 'tola'?") | Never (glossary loaded) |

**Estimated savings:** 40-60% reduction in per-session prompt tokens + faster, more consistent outputs.

---

## 10. QA Checklist for Agent Files

- [ ] `README.md` includes quick start and doc index
- [ ] `CLAUDE.md` lists critical NEVER/ALWAYS rules
- [ ] `CLAUDE.md` has code patterns for API routes + components + workers
- [ ] `CLAUDE.md` locks preferred libraries
- [ ] `AGENTS.md` exists (redirect or symlink)
- [ ] `SKILLS.md` has skills for common workflows (add-api-route, fix-vulnerability, etc.)
- [ ] `.claude/settings.json` configured with autoLoad
- [ ] `.claude/context/glossary.md` covers domain terms
- [ ] `.claude/commands/` has custom slash commands
- [ ] Files referenced by absolute path from repo root
- [ ] PR template reminds updating these files

---

**End of `17-CLAUDE-AGENT-FILES.md`. Proceed to `18-UPDATED-SPRINT-PLAN.md`.**
