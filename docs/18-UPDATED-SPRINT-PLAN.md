# 📅 18 — Updated Sprint Plan (v2 with Extension Scope)

**Timeline:** 16 weeks (up from original 12) due to added CMS + MFA + logging + testing + security infrastructure
**Cadence:** 8 sprints × 2 weeks
**Working hours:** ~25-30 hrs/week (solo founder, part-time capacity)
**Philosophy:** Infrastructure first. If logging and testing aren't in place by Sprint 2, every later sprint takes 2× longer.

---

## 1. Key Changes from v1 (doc 07)

| Item | v1 Plan | v2 Plan |
|------|---------|---------|
| Total weeks | 12 | 16 |
| Sprints | 6 | 8 |
| Logging | Not scoped | Sprint 1 |
| Testing infrastructure | Sprint 1 stub | Sprint 1 full + ongoing |
| Vulnerability scanning | Not scoped | Sprint 1 |
| CMS | Basic blog (Sprint 3) | Full CMS (Sprint 3-4) |
| MFA | Not scoped | Sprint 5 |
| Dynamic JSON-LD | Basic (Sprint 3) | Full per-post editor (Sprint 4) |
| Agent config files | Not scoped | **Day 1, before any coding** |

---

## 2. Day 0 (Before Sprint 1) — Setup Foundation

**Duration:** 2-3 days
**Goal:** Repository and tooling ready before any feature work begins.

### Tasks
- [ ] Create GitHub repo (private initially)
- [ ] Initialize Turborepo monorepo structure (per doc 01 § 4)
- [ ] **Install all agent config files** (per doc 17)
  - `README.md`
  - `CLAUDE.md`
  - `AGENTS.md`
  - `SKILLS.md`
  - `.claude/settings.json` + context + commands
- [ ] Create `docs/` directory, commit all 18 spec documents
- [ ] Configure `.env.example` with all required vars
- [ ] Enable GitHub settings:
  - Branch protection on `main`
  - Secret scanning
  - Dependabot
  - CodeQL
- [ ] Create Vercel account, link repo
- [ ] Create Hetzner account, provision CX22 VPS
- [ ] Create MongoDB Atlas M0 cluster
- [ ] Create Upstash Redis database
- [ ] Create Clerk application (MFA enabled from start)
- [ ] Create Resend account + verify domain

### Output
- Empty but fully-wired repo
- All SaaS accounts provisioned
- Agent files ready → Claude Code sessions start efficient

**Cost so far:** $0 (all free tiers)

---

## 3. Sprint 1 (Weeks 1-2) — Infrastructure

**Goal:** Tested, logged, secured foundation. Zero features yet.

### Epic 1.1 — Logging & Observability (doc 11)
- [ ] `T1.L1` Configure Pino with MongoDB transport
- [ ] `T1.L2` Create `logs` time-series collection with 30-day TTL
- [ ] `T1.L3` Correlation ID middleware (`x-trace-id`)
- [ ] `T1.L4` `withLogging` + `withJobLogging` wrappers
- [ ] `T1.L5` Audit helper for admin actions
- [ ] `T1.L6` Basic `/admin/logs` route (list view, no dashboard yet)

### Epic 1.2 — Testing Infrastructure (doc 12)
- [ ] `T1.T1` Install Vitest + Playwright + MSW + fast-check
- [ ] `T1.T2` Configure Vitest for web + worker packages
- [ ] `T1.T3` Configure Playwright with 3 browsers
- [ ] `T1.T4` `in-memory` MongoDB setup for integration tests
- [ ] `T1.T5` Data factories for all schemas
- [ ] `T1.T6` Create `gen:tests` script scaffolding
- [ ] `T1.T7` First E2E smoke test (home page loads)

### Epic 1.3 — Security Infrastructure (doc 13)
- [ ] `T1.S1` Husky + pre-commit npm audit hook
- [ ] `T1.S2` GitHub Actions security workflow
- [ ] `T1.S3` Dependabot config with auto-merge rules
- [ ] `T1.S4` Snyk free tier + `snyk monitor`
- [ ] `T1.S5` `security_scans` MongoDB collection + hourly scan worker
- [ ] `T1.S6` `/admin/security` route (dashboard comes Sprint 6)

### Epic 1.4 — App Skeleton
- [ ] `T1.A1` Next.js 15 app with App Router
- [ ] `T1.A2` Tailwind + shadcn/ui configured with design tokens (doc 04)
- [ ] `T1.A3` Root layout with nav, footer
- [ ] `T1.A4` Clerk integration (sign-in, sign-up routes, no MFA yet)
- [ ] `T1.A5` MongoDB + Redis connection helpers
- [ ] `T1.A6` Worker app with BullMQ + basic job runner

### Sprint 1 Success Criteria
- ✅ `pnpm dev` runs both apps
- ✅ `pnpm test` runs green (even if only smoke tests)
- ✅ `pnpm security:audit` shows 0 high/critical
- ✅ A log written in dev appears in MongoDB and admin viewer
- ✅ All PRs require CI checks to pass
- ✅ Can sign in (MFA not yet enforced)

---

## 4. Sprint 2 (Weeks 3-4) — Price Ingestion & Caching

**Goal:** Real-time prices flowing from APIs → MongoDB → Redis → UI.

### Epic 2.1 — Data Pipeline
- [ ] `T2.1` Metalpriceapi.com integration in worker
- [ ] `T2.2` Binance WebSocket for BTC/ETH ingestion
- [ ] `T2.3` Upsert logic for `prices` (latest) and `candles` (OHLC)
- [ ] `T2.4` Cron scheduler: 60s for metals, streaming for crypto
- [ ] `T2.5` Error handling + exponential backoff
- [ ] `T2.6` Failover to secondary data source
- [ ] `T2.7` Stale data detection (>5 min old → mark stale)

### Epic 2.2 — Read API
- [ ] `T2.8` `GET /api/price/:symbol` with Redis caching
- [ ] `T2.9` `GET /api/candles/:symbol?interval=1h&range=7d`
- [ ] `T2.10` Response compression + CDN caching headers
- [ ] `T2.11` Rate limiting per IP via Upstash
- [ ] `T2.12` Integration tests (auto-generated from Zod schemas)

### Epic 2.3 — Price Display Components
- [ ] `T2.13` `<LivePriceCard>` with tabular-nums, flash on change
- [ ] `T2.14` `<PriceChart>` using lightweight-charts
- [ ] `T2.15` Interval switcher (1H, 1D, 1W, 1M, 1Y)
- [ ] `T2.16` Loading/error/stale states

### Sprint 2 Success Criteria
- ✅ Gold/silver/copper/crypto prices update in <90s of API push
- ✅ Chart renders smoothly on mobile
- ✅ p95 latency on `/api/price/*` < 100ms
- ✅ System survives data source outage gracefully (stale banner appears)

---

## 5. Sprint 3 (Weeks 5-6) — CMS Foundation

**Goal:** Editors can create, edit, submit posts. Approval workflow functioning.

### Epic 3.1 — CMS Data Model (doc 14)
- [ ] `T3.1` `posts` collection with full schema + indexes
- [ ] `T3.2` Role-based permissions (Clerk `publicMetadata.role`)
- [ ] `T3.3` 4-stage state machine enforcement (server-side)
- [ ] `T3.4` Revisions array (keep last 10)
- [ ] `T3.5` Slug generation + uniqueness

### Epic 3.2 — Markdown Editor
- [ ] `T3.6` Tiptap editor component with all required extensions
- [ ] `T3.7` Toolbar: bold, italic, H1-H4, lists, links, code
- [ ] `T3.8` Table support (insert, add/remove rows/cols)
- [ ] `T3.9` Image upload flow (required alt text)
- [ ] `T3.10` Slash commands (`/heading1`, `/table`, `/image`)
- [ ] `T3.11` Auto-save every 10 seconds
- [ ] `T3.12` Word count + read time live

### Epic 3.3 — Admin Post Routes
- [ ] `T3.13` `/admin/posts` list with filters
- [ ] `T3.14` `/admin/posts/new` creation page
- [ ] `T3.15` `/admin/posts/[id]/edit` editor page
- [ ] `T3.16` `/admin/posts/approvals` approval queue
- [ ] `T3.17` Split view: editor + live preview
- [ ] `T3.18` All post API endpoints (see doc 14 § 11)

### Epic 3.4 — Image Upload
- [ ] `T3.19` Vercel Blob integration
- [ ] `T3.20` WebP auto-conversion + 4 responsive sizes
- [ ] `T3.21` Alt text enforcement

### Sprint 3 Success Criteria
- ✅ Author can create draft, submit for approval
- ✅ Editor sees pending queue, can approve/reject with reason
- ✅ Author cannot approve own post (tested)
- ✅ Images upload, convert to WebP, insert with alt text
- ✅ Tables work in editor and preview
- ✅ Auto-save prevents data loss on refresh

---

## 6. Sprint 4 (Weeks 7-8) — CMS Advanced + JSON-LD

**Goal:** Preview URLs, meta/JSON-LD editor, public blog pages.

### Epic 4.1 — Preview System (doc 14 § 6)
- [ ] `T4.1` Preview token generation (nanoid, single-use)
- [ ] `T4.2` `previewTokens` array on posts
- [ ] `T4.3` `/preview/[token]` route with expiry + single-use check
- [ ] `T4.4` Preview options modal (15m/1h/24h/7d)
- [ ] `T4.5` Meta preview modal (Google/FB/Twitter/WhatsApp)

### Epic 4.2 — Dynamic JSON-LD (doc 16)
- [ ] `T4.6` `jsonld_templates` collection + 7 seed templates
- [ ] `T4.7` Variable interpolation engine
- [ ] `T4.8` Context builder
- [ ] `T4.9` Per-post JSON-LD editor (form + JSON mode)
- [ ] `T4.10` FAQPage specialized builder
- [ ] `T4.11` Auto-populate on post creation
- [ ] `T4.12` Validation (syntactic + schema.org)
- [ ] `T4.13` `JsonLd` component (Server Component with `<Script>`)
- [ ] `T4.14` Global schemas in root layout

### Epic 4.3 — Public Blog
- [ ] `T4.15` `/blog` index page with category tabs
- [ ] `T4.16` `/blog/[slug]` individual post
- [ ] `T4.17` `/news` index with category search (doc 14 § 9)
- [ ] `T4.18` `/news/[slug]` news posts
- [ ] `T4.19` MongoDB text search on published posts
- [ ] `T4.20` Related posts (tag-based)
- [ ] `T4.21` Reading progress indicator
- [ ] `T4.22` Share buttons (copy link, Twitter, WhatsApp)

### Epic 4.4 — Scheduled Publishing
- [ ] `T4.23` `scheduledFor` status handling
- [ ] `T4.24` Cron job every minute to publish due posts
- [ ] `T4.25` Revalidation trigger on publish

### Sprint 4 Success Criteria
- ✅ Editor can generate preview URL with expiry
- ✅ Single-use preview works once only
- ✅ All published posts have at least Article + Breadcrumb JSON-LD
- ✅ JSON-LD passes Google Rich Results Test
- ✅ Category search returns relevant results
- ✅ Scheduled post auto-publishes within 60s of target time

---

## 7. Sprint 5 (Weeks 9-10) — Auth Hardening + Subscriptions

**Goal:** MFA for admins, email subscription system, disclaimer engine.

### Epic 5.1 — MFA (doc 15)
- [ ] `T5.1` Enable MFA in Clerk dashboard
- [ ] `T5.2` Middleware enforcement for admin/editor routes
- [ ] `T5.3` Setup flow: QR code → verify → backup codes
- [ ] `T5.4` Login flow: password → TOTP → (or backup code fallback)
- [ ] `T5.5` `/settings/security` self-service page
- [ ] `T5.6` Regenerate backup codes flow
- [ ] `T5.7` Active sessions viewer + revoke
- [ ] `T5.8` MFA audit events
- [ ] `T5.9` Rate limits on MFA endpoints
- [ ] `T5.10` MFA E2E test with `otplib`

### Epic 5.2 — Email Subscriptions (doc 03)
- [ ] `T5.11` `subscribers` collection + schema
- [ ] `T5.12` Subscribe form component (multi-channel)
- [ ] `T5.13` `POST /api/subscribe` with honeypot + rate limit
- [ ] `T5.14` Double opt-in email via Resend
- [ ] `T5.15` Verification endpoint
- [ ] `T5.16` One-click unsubscribe (RFC 8058)
- [ ] `T5.17` Preferences page (magic-link authenticated)

### Epic 5.3 — Auto-Disclaimers (doc 02)
- [ ] `T5.18` `disclaimers` collection + 11 seed documents
- [ ] `T5.19` `<LegalDisclaimer>` Server Component
- [ ] `T5.20` Pathname-based auto-injection logic
- [ ] `T5.21` Frontmatter-based disclaimer override
- [ ] `T5.22` Admin disclaimer CRUD UI
- [ ] `T5.23` Draft/review/publish workflow for disclaimers
- [ ] `T5.24` **REMINDER: Legal review required before Sprint 5 ends**

### Sprint 5 Success Criteria
- ✅ Admin can't access `/admin` without MFA
- ✅ Backup codes work for phone-loss recovery
- ✅ Subscribers complete double opt-in flow
- ✅ Unsubscribe works in 1 click from email
- ✅ Every page displays required disclaimers
- ✅ **Legal review completed and sign-off received**

---

## 8. Sprint 6 (Weeks 11-12) — Admin Dashboards + Broadcasts

**Goal:** Complete admin experience. Internal tools ready.

### Epic 6.1 — Admin Log Dashboard (doc 11 § 7)
- [ ] `T6.1` `/admin/logs` full UI with filters
- [ ] `T6.2` Statistics cards (errors, warnings, latency)
- [ ] `T6.3` Expandable log entries with full context
- [ ] `T6.4` Trace view (all logs for one traceId)
- [ ] `T6.5` Live tail mode (auto-refresh)
- [ ] `T6.6` Export to CSV
- [ ] `T6.7` Alert rules configuration
- [ ] `T6.8` Email alerts for threshold breaches

### Epic 6.2 — Admin Security Dashboard (doc 13 § 9)
- [ ] `T6.9` `/admin/security` UI with vuln counts
- [ ] `T6.10` Open Dependabot PRs list
- [ ] `T6.11` Accepted risks table
- [ ] `T6.12` Failed login attempts graph
- [ ] `T6.13` "Run scan now" button

### Epic 6.3 — Broadcasts (doc 03 § 8)
- [ ] `T6.14` `broadcasts` collection + worker jobs
- [ ] `T6.15` `/admin/broadcasts/new` compose UI
- [ ] `T6.16` Category + audience filters
- [ ] `T6.17` Rate-limited send via Resend (10/sec)
- [ ] `T6.18` Unsubscribe footer auto-injection
- [ ] `T6.19` Bounce/complaint handling webhook
- [ ] `T6.20` Analytics per broadcast (sent/delivered/opened/clicked)

### Epic 6.4 — User Management
- [ ] `T6.21` `/admin/users` list view (admins only)
- [ ] `T6.22` Role assignment UI
- [ ] `T6.23` Manual MFA reset for lost-phone recovery
- [ ] `T6.24` Account lockout/unlock

### Sprint 6 Success Criteria
- ✅ Admin can investigate any issue via logs in <60s
- ✅ Alert fires and emails admin within 60s of threshold breach
- ✅ First test broadcast sent to subset of subscribers
- ✅ 0 high-severity vulns open
- ✅ Every admin action appears in audit log

---

## 9. Sprint 7 (Weeks 13-14) — Calculators + Polish

**Goal:** High-value interactive features, performance optimization.

### Epic 7.1 — Calculators
- [ ] `T7.1` `/calculator/gold` — gold price in tola/gram/ounce
- [ ] `T7.2` `/calculator/silver` — silver price converter
- [ ] `T7.3` `/calculator/gold-currency` — USD → PKR/INR/AED
- [ ] `T7.4` `/calculator/zakat` — Zakat on gold/silver
- [ ] `T7.5` FAQPage JSON-LD on calculator pages

### Epic 7.2 — SEO Polish
- [ ] `T7.6` `sitemap.xml` (dynamic, regenerated on publish)
- [ ] `T7.7` `robots.txt`
- [ ] `T7.8` OG image auto-generation via `@vercel/og`
- [ ] `T7.9` Canonical URLs on all pages
- [ ] `T7.10` 404/500 pages with disclaimer

### Epic 7.3 — Performance
- [ ] `T7.11` Lighthouse audit — target 90+ on all 4 metrics
- [ ] `T7.12` Font optimization (subset + preload)
- [ ] `T7.13` Image optimization audit
- [ ] `T7.14` Bundle analysis + code splitting
- [ ] `T7.15` Database query optimization (slow query log)

### Epic 7.4 — Accessibility Audit
- [ ] `T7.16` Full axe-core pass on top 10 pages
- [ ] `T7.17` Keyboard navigation complete
- [ ] `T7.18` Screen reader testing (VoiceOver / NVDA)
- [ ] `T7.19` Color contrast verified

### Epic 7.5 — Test Coverage Push
- [ ] `T7.20` Achieve 80% coverage overall
- [ ] `T7.21` 100% coverage on security-critical paths
- [ ] `T7.22` Load testing via k6 — hit 1000 RPS target

### Sprint 7 Success Criteria
- ✅ Lighthouse scores: Performance 90+, Accessibility 95+, SEO 95+
- ✅ All top-10 pages pass axe-core audit
- ✅ Load test: 1000 RPS sustained with p99 < 500ms
- ✅ Calculators accurate (verified against external sources)
- ✅ Test coverage: 80%+ overall, 100% critical paths

---

## 10. Sprint 8 (Weeks 15-16) — Launch Prep + Soft Launch

**Goal:** Production-ready. Soft launch to small audience.

### Epic 8.1 — Launch Prep
- [ ] `T8.1` Full QA pass using doc 10 checklist
- [ ] `T8.2` Legal review of all disclaimers (final sign-off)
- [ ] `T8.3` Privacy policy + terms of service pages
- [ ] `T8.4` Cookie consent banner (GDPR-compliant)
- [ ] `T8.5` Email domain warming (Resend) with ramp-up plan
- [ ] `T8.6` DNS configuration + SSL certs
- [ ] `T8.7` Production env vars verified
- [ ] `T8.8` Backup/restore procedure tested
- [ ] `T8.9` Incident response runbook documented

### Epic 8.2 — Monitoring Setup
- [ ] `T8.10` Vercel Analytics enabled
- [ ] `T8.11` Uptime monitoring (BetterStack free tier)
- [ ] `T8.12` Log alert rules deployed
- [ ] `T8.13` Status page at `status.yoursite.com`
- [ ] `T8.14` On-call rotation defined (even solo — process matters)

### Epic 8.3 — Soft Launch
- [ ] `T8.15` Deploy to production
- [ ] `T8.16` Share with 10-20 beta testers (friends, forums)
- [ ] `T8.17` Monitor logs obsessively for 7 days
- [ ] `T8.18` Fix critical issues within 24h
- [ ] `T8.19` Collect user feedback
- [ ] `T8.20` Performance monitoring: real-world p95 vs. synthetic

### Epic 8.4 — Content Seed
- [ ] `T8.21` 10 foundational blog posts published
- [ ] `T8.22` 20 news articles covering current market
- [ ] `T8.23` All calculators battle-tested
- [ ] `T8.24` FAQ pages for each major topic

### Sprint 8 Success Criteria
- ✅ Site live at production URL
- ✅ First 10-20 users onboarded
- ✅ 0 critical issues in first 48h of launch
- ✅ Subscription conversion > 2% (baseline)
- ✅ Legal sign-off on disclaimers (written)
- ✅ Monitoring dashboards green

---

## 11. Risk Register (v2)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Legal review delays disclaimers past Sprint 5 | Medium | High | Schedule legal consult in Sprint 4 week 2 |
| MFA setup confuses users | Low | Medium | Help page + screenshots at `/help/mfa` |
| CMS editor buggy with tables | Medium | Medium | Extensive QA in Sprint 3; Tiptap is battle-tested |
| Price feed vendor rate-limits | High | Critical | Failover config + 15min Redis cache |
| Vulnerability requires breaking upgrade | Medium | Medium | Test suite catches regressions; patch-package as fallback |
| Solo founder burnout | Medium | High | Buffer weeks every 4 sprints; realistic scope |
| Scale beyond M10 before ready | Low | Medium | MongoDB autoscaling + clear migration doc |

---

## 12. Post-Launch Roadmap (Weeks 17+)

Not in this plan but high-priority post-launch:

| Phase | Weeks | Scope |
|-------|-------|-------|
| Stabilization | 17-20 | Bug fixes, perf, SEO iteration |
| Monetization | 21-24 | AdSense, affiliate integration, sponsor slots |
| WhatsApp channel | 25-28 | Meta WABA setup, template messages |
| Stocks module | 29-34 | New asset class, same patterns |
| Mobile app | 35+ | React Native (if web KPIs justify) |

---

## 13. Week-by-Week Gantt Summary

```
Week 1  | Day0 Setup + Sprint 1 start (infra)
Week 2  | Sprint 1 end — logging/testing/security foundation
Week 3  | Sprint 2 start — ingestion pipeline
Week 4  | Sprint 2 end — prices live + charts
Week 5  | Sprint 3 start — CMS core + Tiptap
Week 6  | Sprint 3 end — approval workflow working
Week 7  | Sprint 4 start — preview URLs + JSON-LD
Week 8  | Sprint 4 end — public blog + news search
Week 9  | Sprint 5 start — MFA + subscriptions
Week 10 | Sprint 5 end — disclaimers + legal review
Week 11 | Sprint 6 start — admin dashboards
Week 12 | Sprint 6 end — broadcasts + alerts
Week 13 | Sprint 7 start — calculators + SEO
Week 14 | Sprint 7 end — performance + a11y
Week 15 | Sprint 8 start — launch prep
Week 16 | Sprint 8 end — soft launch live
```

---

## 14. Critical Path Items (Cannot Slip)

1. **Week 1: Agent config files** — every day without them costs tokens
2. **Week 2: Logging** — debugging is impossible without structured logs
3. **Week 2: Testing infra** — regressions compound without tests
4. **Week 8: Legal consult booked** — can't launch without disclaimer sign-off
5. **Week 10: MFA enforced** — cannot expose admin without it in production
6. **Week 15: Privacy policy + TOS** — GDPR non-negotiable

If any of these slip, subsequent sprints shift by the same amount — do not compress later sprints to compensate.

---

## 15. Definition of Done (Per Story)

A task isn't "done" until:

- [ ] Code written and works locally
- [ ] Tests pass (auto-generated minimum + any complex logic covered)
- [ ] `pnpm lint` + `pnpm typecheck` clean
- [ ] `pnpm security:audit` clean
- [ ] Documentation updated (if user-facing or API change)
- [ ] Logged with structured logger (if backend)
- [ ] Audited with `audit()` helper (if admin action)
- [ ] Accessible (if UI — axe-core pass, keyboard navigable)
- [ ] Reviewed (even solo — self-review with 24h gap between write and review)
- [ ] Merged to `main` via PR with all CI green

---

## 16. Anti-Patterns to Avoid

- ❌ Skipping tests "just this once" — they always become permanent
- ❌ Ignoring Dependabot PRs — they pile up
- ❌ Adding features before Sprint 1 infra done — creates tech debt
- ❌ Not using the agent config files — Claude forgets and makes wrong choices
- ❌ Copying disclaimer text without legal review
- ❌ Shipping admin routes without MFA enforcement

---

**End of `18-UPDATED-SPRINT-PLAN.md`. Proceed to `19-UPDATED-MASTER-README.md`.**
