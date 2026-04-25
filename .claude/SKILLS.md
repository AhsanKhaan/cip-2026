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