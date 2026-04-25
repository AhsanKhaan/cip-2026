# 📚 00 — Master README & Decision Log (v2)

**Last updated:** April 22, 2026
**Version:** 2.0 (extended scope with CMS, MFA, logging, testing, security)
**Total documents:** 19 specification files + agent config files

---

## 1. How to Use This Package

This is a complete, end-to-end specification for building the **Commodity Intelligence Platform (CIP-2026)**. It's designed to be fed directly into Claude Code (coding assistant) and Claude Design (UI assistant) with minimal re-explanation needed, thanks to the agent config files in doc 17.

### Start here

1. **Read docs 00-01 fully** — sets mental model
2. **Skim docs 02-10** — original scope, reference as needed
3. **Read docs 11-17** — extension scope (new features)
4. **Use doc 18** (sprint plan) as your week-by-week execution guide
5. **Install the agent config files** (doc 17) before any coding

### During development

- Feed **doc 05** (code prompts) to Claude Code, one task at a time
- Feed **doc 06** (design prompts) to Claude Design for UI components
- Reference **doc 08** (schemas) + **doc 09** (APIs) constantly
- Run **doc 10** (QA) before every release

---

## 2. Document Index

### Original Scope (v1)

| # | Document | Purpose |
|---|----------|---------|
| 00 | This file | Master overview + decisions |
| 01 | Architecture Spec | Stack, deployment, data flow |
| 02 | Disclaimer System | Auto-inject legal text per page |
| 03 | Subscription System | Email subs + broadcasts |
| 04 | Design System | Tokens, components, page layouts |
| 05 | Claude Code Prompts | Task-level prompts for backend |
| 06 | Claude Design Prompts | Task-level prompts for UI |
| 07 | ~~PMO Sprint Plan v1~~ | **Superseded by doc 18** |
| 08 | MongoDB Schemas | 13 collections fully specified |
| 09 | API Contracts | 17 endpoints with request/response |
| 10 | QA Checklist | Pre-launch validation |

### Extension Scope (v2)

| # | Document | Purpose |
|---|----------|---------|
| 11 | Logging & Observability | Pino + MongoDB + admin dashboard |
| 12 | Testing Strategy | Vitest + Playwright + dynamic generation |
| 13 | Security & Vulnerability | npm audit + Dependabot + Snyk |
| 14 | CMS System | WordPress-grade content management |
| 15 | MFA Authentication | Clerk TOTP + backup codes |
| 16 | Dynamic JSON-LD | Per-page structured data editor |
| 17 | Claude Agent Files | CLAUDE.md, SKILLS.md, AGENTS.md |
| 18 | Updated Sprint Plan | 16-week execution with extension scope |

---

## 3. Technology Decisions (Cumulative)

### Core stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | Server Components reduce JS sent to client |
| Language | TypeScript strict | Type safety catches 80% of bugs at compile time |
| UI Library | shadcn/ui + Tailwind | Owned code (not npm dep), design tokens, accessible |
| Database | MongoDB Atlas M0 → M10 | Time-series support, free tier, familiar |
| Cache | Upstash Redis | Serverless, free tier, global edge |
| Auth | Clerk | MFA built-in, free to 10K MAU |
| Email | Resend + React Email | Developer-friendly, good deliverability |
| Worker | BullMQ on Hetzner CX22 | €5/mo, keeps Vercel costs down |
| Deployment | Vercel (web) + Hetzner (worker) | Split scales naturally |

### Extension decisions

| Feature | Choice | Rationale |
|---------|--------|-----------|
| Logging | Pino → MongoDB | One DB, simple until scale demands otherwise |
| Logging migration threshold | 5GB/day or 100K MAU | Then switch to Axiom |
| Testing | Vitest + Playwright + fast-check | Free, fast, millions-scale ready |
| Test generation | From Zod schemas via `gen:tests` | No manual boilerplate |
| MFA | Clerk TOTP (Google Authenticator compatible) | Tested, free tier |
| MFA backup | 10 backup codes, single-use | Industry standard |
| MFA SMS | Disabled | SIM-swap risk too high |
| CMS | Custom (built in-repo) | Better than WordPress for Next.js |
| Markdown editor | Tiptap | Best OSS WYSIWYG for markdown |
| CMS workflow | 4-stage (Draft → Pending → Approved → Published) | Clear separation of author/editor |
| Image CDN | Vercel Blob → S3 at scale | Start simple |
| JSON-LD | Per-page editor with templates + interpolation | Editor-friendly + consistent |
| Vuln scanning | npm audit + Snyk + Dependabot + OSV | 4 scanners for coverage |
| Vuln auto-fix | Dependabot auto-merges patches after CI green | Frictionless patching |

---

## 4. Decision Log

All significant decisions with rationale. Newest on top.

### Extension Phase (2026-04-22)

**D-EXT-7: Agent config files mandatory from Day 0**
Installing CLAUDE.md/AGENTS.md/SKILLS.md before any coding pays back immediately. Each session saves ~2000 tokens by not re-pasting context. Estimated total savings over 16 weeks: ~$200 in API costs, plus more consistent Claude outputs.

**D-EXT-6: Timeline extended from 12 to 16 weeks**
Original plan underestimated CMS + MFA + testing infrastructure. 16 weeks is realistic for solo founder at 25-30 hrs/week. Compressing risks burnout + tech debt.

**D-EXT-5: JSON-LD via templates + variable interpolation**
Pure JSON editing invites errors. Templates with `{{variables}}` give editors the power without the fragility. Form mode for non-technical users, JSON mode for advanced control.

**D-EXT-4: Custom CMS instead of headless WordPress**
WordPress adds hosting cost, security surface, and integration complexity for Next.js. Building a lean CMS on existing MongoDB+Clerk is ~2 sprints (~80 hours) vs. permanent WP maintenance overhead.

**D-EXT-3: MFA via Clerk, not custom**
Custom MFA is a cryptographic minefield. Clerk provides audited TOTP + backup codes + session management. Free up to 10K MAU. At scale, ~$25/month is negligible.

**D-EXT-2: Pre-commit security hook**
Husky + `pnpm audit --audit-level=high` in pre-commit blocks commits that introduce high/critical vulns. Slight friction, major long-term payoff.

**D-EXT-1: Tests generated from Zod schemas, not hand-written**
Schema-based property testing + factories eliminate 60-70% of boilerplate. Scale target (millions) demands CI runs <5 min, which dynamic generation enables via parallelization.

### Original Phase

**D-15: Hetzner for worker, Vercel for web**
Split deployment keeps Vercel serverless costs low (no long-running processes) while Hetzner €5 VPS handles BullMQ jobs and cron.

**D-14: MongoDB time-series for candles**
Native time-series collections with granularity=seconds save 70% storage vs. regular collections for OHLC data.

**D-13: Upstash Redis over managed Redis**
Serverless pricing (per-request) fits traffic pattern better than provisioned. Free tier covers up to 10K commands/day.

**D-12: Clerk over Auth.js**
MFA support built-in, better DX, free tier to 10K MAU. Auth.js would need custom MFA impl (~3 sprints).

**D-11: React Email over MJML**
Native JSX authoring, previewable in Next.js dev mode, no separate templating language.

**D-10: Tabular-nums for all prices**
Prevents layout shift as digits change. One CSS property, massive UX win.

**D-9: Dark-first theme**
Finance/markets aesthetic. Bloomberg Terminal inspiration. Light mode as inversion, not primary.

**D-8: Server Components by default**
Reduces JS sent to client. Use `'use client'` only when needed (forms, interactivity).

**D-7: Zod for validation end-to-end**
Single source of truth: types derived from schemas, runtime validation matches compile-time types.

**D-6: Turborepo monorepo**
Share types and schemas between web + worker. Fast incremental builds.

**D-5: 60-second ingestion cycle for metals**
Balance between freshness and API rate limits. Binance WebSocket streams crypto in real-time.

**D-4: Two-factor subscription confirmation**
Double opt-in protects against spam signups and abuse reports. RFC 8058 one-click unsubscribe.

**D-3: Auto-disclaimer injection**
Never trust authors to add correct disclaimers manually. Inject based on pathname + frontmatter + category matching.

**D-2: JSON-LD on every page type**
SEO best practice. Even landing page gets Organization + WebSite. Doc 16 extends to per-post.

**D-1: MongoDB Atlas M0 (free) for launch**
Free tier handles ~5K MAU easily. Migrate to M10 (~$57/mo) at 50K MAU. Autoscaling to M20+ beyond.

---

## 5. Scale Thresholds & Migration Paths

| Metric | Current (Launch) | Trigger | Migration |
|--------|------------------|---------|-----------|
| MAU | 0-5K | 100K MAU | MongoDB M0 → M10 |
| Logs/day | <100MB | >5GB/day | Pino → Axiom free tier (500GB/mo) |
| Subscribers | <1K | >10K | Resend free → paid ($20/mo for 50K emails) |
| Auth | Clerk free | 10K MAU | Clerk Pro (~$25/mo) |
| Search | MongoDB text | >100K posts | Add Meilisearch ($5/mo self-hosted) |
| Images | Vercel Blob | >10GB | Cloudflare R2 ($0.015/GB) |
| Worker | Hetzner CX22 | Job lag >5min | CX32 or horizontal scale |

**Cost progression:**
- Launch: ~$10/month (MongoDB M0 free, Hetzner €5, everything else free tier)
- 10K MAU: ~$85/month
- 100K MAU: ~$250/month
- 1M MAU: ~$900/month (dominated by MongoDB + Clerk)

---

## 6. Critical Reminders

Non-negotiable. Tattoo them on your brain.

### 🚨 Before launch

- [ ] **Legal review of all disclaimers** — written sign-off from qualified lawyer
- [ ] **Privacy policy + Terms of Service** published and linked
- [ ] **Cookie consent** GDPR-compliant
- [ ] **MFA enforced** on all admin/editor accounts
- [ ] **0 high/critical vulnerabilities** at time of launch
- [ ] **Backup/restore tested** — actually restore a backup, don't assume
- [ ] **On-call process documented** — even for solo founder

### 🚨 Ongoing

- [ ] **Weekly 15-min security review** — Monday 9am, non-negotiable
- [ ] **Monthly disclaimer re-review** — laws change
- [ ] **Quarterly secret rotation** — API keys, webhooks, tokens
- [ ] **Legal compliance check before new features** — especially around financial info
- [ ] **Monitor logs daily** during first 3 months post-launch

### ⚠ Never

- Claim to offer financial advice (even implicitly)
- Store user passwords (Clerk handles auth)
- Log PII in plaintext
- Skip Dependabot security PRs
- Auto-merge major version upgrades
- Disable MFA for "convenience"
- Ship untested migration scripts to production
- Answer legal questions yourself — refer to counsel

---

## 7. How Claude Works Best With This Package

### With agent config files installed (doc 17)

Claude Code auto-reads `CLAUDE.md` and has full context. You can say:

> "Add a new API endpoint for `/api/news/trending`"

...and Claude will:
- Follow the API route pattern from CLAUDE.md
- Add Zod schemas to shared package
- Add rate limiting
- Add documentation to doc 09
- Create tests in the right place
- Use Pino logger correctly

...all without you re-explaining any of it.

### Without agent config files

You'll repeat yourself constantly. Don't skip doc 17. It's the cheapest, highest-leverage artifact in this whole package.

### Token optimization tips

- Reference docs by number: "per doc 14 § 6" instead of pasting the whole section
- Use skill names from SKILLS.md: "Run the fix-vulnerability skill"
- Commit the docs to your repo, not just Claude's context
- Update docs as you go — they're source of truth, not history

---

## 8. Support & Handoff

### If someone else takes over

Give them:
1. Repository access
2. Link to this README (doc 00)
3. Expected onboarding time: 1 day to read docs, 2 days to set up local dev

### Knowledge transfer checklist

- [ ] Walk through architecture (doc 01)
- [ ] Demo CMS workflow end-to-end
- [ ] Show logs dashboard + how to investigate
- [ ] Explain the 4-stage approval process
- [ ] Share all credentials via password manager
- [ ] Review incident response playbook
- [ ] Do one deployment together
- [ ] Schedule weekly pairing for first month

---

## 9. Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-04-22 | Extended scope: CMS, MFA, logging, testing, security, JSON-LD editor, agent files. Timeline to 16 weeks. |
| 1.0 | Earlier | Initial 10-doc package for core platform. |

---

## 10. Glossary

- **CIP** — Commodity Intelligence Platform
- **YMYL** — Your Money Your Life (Google's high-stakes content category)
- **Tola** — 11.66g (common South Asian gold unit)
- **OHLC** — Open, High, Low, Close (candle chart terminology)
- **TOTP** — Time-based One-Time Password (RFC 6238, used by Google Authenticator)
- **Tick** — Single price update
- **Ingestion** — Fetching prices from external APIs into MongoDB
- **Failover** — Switching to backup data source when primary fails
- **Disclaimer engine** — Auto-injection system for legal disclaimers
- **JSON-LD** — JavaScript Object Notation for Linked Data (Google's preferred structured data format)
- **4-stage workflow** — Draft → Pending → Approved → Published (CMS states)
- **T-ID** — Task ID (e.g., T3.5 refers to Sprint 3 task 5)
- **DRY** — Don't Repeat Yourself

---

## 11. Contact Points (Fill In)

- **Primary developer:** [Your name] — [your@email.com]
- **Legal counsel:** [Firm name] — [lawyer@firm.com]
- **Security contact:** security@yoursite.com (create this alias)
- **GitHub repo:** [URL]
- **Vercel project:** [URL]
- **Clerk application:** [Dashboard URL]
- **MongoDB cluster:** [Atlas URL]
- **Status page:** [URL]

---

## 12. Final Word

This is a lot. That's intentional — rigorous upfront specs save 10× the time later. Every hour spent here saves 5 hours of "wait, how does this work again?" during sprints.

Some tips:
- Read at your own pace. Marathon reads don't stick.
- Trust the sprint plan (doc 18). Slipping = compounding pain.
- The extension scope (docs 11-17) makes the platform enterprise-grade. Don't skip.
- The agent files (doc 17) are the MVP of your Claude productivity. Use them.
- Ship early, learn fast. Sprint 8 is soft launch, not perfection.

You've got this. 🚀

---

**End of `00-MASTER-README.md` v2. Begin with `01-ARCHITECTURE-SPEC.md`.**
