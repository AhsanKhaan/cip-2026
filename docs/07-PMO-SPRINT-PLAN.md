# 📅 07 — PMO Sprint Plan (12 Weeks to Launch)

**Methodology:** 2-week sprints × 6 = 12 weeks
**Assumes:** Solo founder or 1 developer + occasional help
**Output:** MVP with content, monetization, and SEO — NOT the full SaaS (that's Phase 3+)

---

## 📈 Roadmap Overview

| Sprint | Weeks | Theme | Exit Criteria |
|--------|-------|-------|---------------|
| **S1** | 1-2 | Foundation | Monorepo live, Mongo/Redis connected, env configured |
| **S2** | 3-4 | Ingestion | Prices flow from API → DB → Cache, charts work |
| **S3** | 5-6 | Content & Disclaimers | Blog system + disclaimer engine + seeded disclaimers |
| **S4** | 7-8 | Pages & UI | All marketing pages designed, price pages live |
| **S5** | 9-10 | Monetization | Subscription flow + affiliate integrations + ads |
| **S6** | 11-12 | Polish & Launch | QA, SEO, legal review, deploy |

---

## 🎯 Success Metrics (12-week launch target)

- ✅ 30+ published blog posts across 5 categories
- ✅ All 4-5 price pages live with real data
- ✅ AdSense application submitted (and ideally approved)
- ✅ 3+ affiliate programs integrated (TradingView, Coinbase, Birch Gold minimum)
- ✅ 100+ email subscribers from launch traffic
- ✅ Core Web Vitals all "Good" (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- ✅ Lighthouse score 95+ on landing page
- ✅ Zero critical accessibility violations (axe-core)
- ✅ All legal pages live (Privacy, Terms, Disclaimer, Affiliate Disclosure)

---

## 🗓️ SPRINT 1 — Foundation (Weeks 1-2)

### Goals
- Dev environment working
- All infrastructure provisioned
- Core code scaffolding complete

### Tasks

#### Week 1: Environment & Infrastructure

**Day 1-2: Account setup (non-coding)**
- [ ] Buy domain (Namecheap, Cloudflare, or Porkbun recommended)
- [ ] Vercel account + link to GitHub
- [ ] MongoDB Atlas account → create free M0 cluster
- [ ] Upstash Redis account → create free DB
- [ ] Cloudflare account → point nameservers to CF
- [ ] Resend account (email) → verify sending domain with SPF/DKIM/DMARC
- [ ] Hetzner Cloud account → provision CX11 VPS ($4.51/mo)
- [ ] MetalpriceAPI signup → paid tier ($30/mo)
- [ ] Clerk account (auth for later)
- [ ] GitHub repo (private, connected to Vercel)

**Day 3-4: Monorepo bootstrap**
- Prompt: `[T1.1] Project Bootstrap` in Claude Code
- Output: Working monorepo with Turborepo
- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter web dev` starts Next.js on :3000
- [ ] `pnpm --filter worker dev` starts worker process
- [ ] Git push → Vercel auto-deploy succeeds

**Day 5: Database & Cache**
- Prompts: `[T1.2]`, `[T1.3]`, `[T1.4]`, `[T1.5]`, `[T1.6]`
- [ ] MongoDB connection pool works
- [ ] Time-series collections created
- [ ] All indexes in place
- [ ] Redis client + rate limiter tested
- [ ] All Zod schemas defined in `packages/shared`
- [ ] Env validation throws on missing vars
- [ ] Logger writes structured JSON

#### Week 2: Scaffolding & Security

**Day 1-2: Next.js shell**
- Prompt: `[D1.1] App Layout + Navigation`
- [ ] Root layout + theme provider
- [ ] Navbar (desktop + mobile drawer)
- [ ] Footer with legal links (pages empty for now)

**Day 3: Security middleware**
- [ ] CSP headers
- [ ] Rate limiting on API routes
- [ ] CORS config
- [ ] Error boundary pages (404, 500)

**Day 4: Legal pages (empty templates)**
- [ ] `/privacy-policy`
- [ ] `/terms-of-service`
- [ ] `/affiliate-disclosure`
- [ ] `/financial-disclaimer`
- [ ] `/contact`
- [ ] `/about`
- (Text via Termly or a lawyer in Sprint 6)

**Day 5: Monitoring**
- [ ] Sentry connected (free tier)
- [ ] Plausible or GA4 connected
- [ ] Uptime monitoring (BetterStack free tier)
- [ ] Status page (optional, free via BetterStack)

### Sprint 1 Deliverables
- ✅ Live dev URL (preview on Vercel)
- ✅ Git repo with 3+ commits/day
- ✅ All infrastructure accounts active
- ✅ ~$35/mo infrastructure spend confirmed

### Sprint 1 Retro Questions
1. Were there any account/API approval delays?
2. Is the dev loop fast (hot reload, logs, errors)?
3. Any env vars we forgot?

---

## 🗓️ SPRINT 2 — Ingestion (Weeks 3-4)

### Goals
- Prices flowing from API → DB every 60s
- Charts working with real data
- Basic price pages rendering

### Tasks

#### Week 3: Worker & Ingestion

**Day 1-2: BullMQ + Metals ingestion**
- Prompts: `[T2.1]`, `[T2.2]`
- [ ] BullMQ queue running against Redis
- [ ] Metals ingestion job runs every 60s on local dev
- [ ] `live_prices` collection updates with gold/silver/copper
- [ ] `candles_1m` accumulates data correctly (verify OHLC logic)

**Day 3: Crypto WebSocket**
- Prompt: `[T2.3]`
- [ ] Binance WS connects on worker start
- [ ] BTC/ETH live prices update in DB
- [ ] Auto-reconnect works (kill connection, verify reconnect)

**Day 4: Aggregations**
- Prompts: `[T2.4]`, `[T2.5]`
- [ ] Hourly aggregation runs at :00 every hour
- [ ] Daily aggregation runs at 00:00 UTC
- [ ] Manual trigger scripts for backfilling history

**Day 5: Failover & Deploy worker**
- Prompt: `[T2.6]`, `[T2.7]`
- [ ] Failover tested (manually block primary API → fallback activates)
- [ ] Dockerfile builds cleanly
- [ ] Worker deployed to Hetzner VPS
- [ ] PM2 or systemd for process management
- [ ] Worker survives VPS reboot

#### Week 4: API Routes & Charts

**Day 1-2: Read APIs**
- Prompts: `[T3.1]`, `[T3.2]`
- [ ] `/api/price/[symbol]` returns cached price
- [ ] `/api/candles/[symbol]?range=X` returns chart data
- [ ] Load testing: 100 concurrent requests sub-200ms

**Day 3: Revalidation**
- Prompt: `[T3.5]`
- [ ] Worker calls `/api/revalidate` after each price update
- [ ] ISR cache invalidates → next page load shows new data within 60s

**Day 4: Price components**
- Prompts: `[D2.1]`, `[D2.2]`
- [ ] LivePriceCard hero variant rendering
- [ ] Price flash animation on update works
- [ ] TanStack Query polling every 60s

**Day 5: Charts**
- Prompt: `[T5.6]`
- [ ] PriceChart renders all ranges (1D, 7D, 1M, 3M, 1Y)
- [ ] Touch gestures work on mobile
- [ ] Chart adapts to theme

### Sprint 2 Deliverables
- ✅ `/gold-price-today` live with real data
- ✅ Charts work across all ranges
- ✅ Worker running 24/7 on Hetzner
- ✅ Monitoring dashboards show uptime

---

## 🗓️ SPRINT 3 — Content & Disclaimers (Weeks 5-6)

### Goals
- Auto-disclaimer engine working
- Blog system live
- 10+ articles drafted

### Tasks

#### Week 5: Disclaimer Engine

**Day 1: Schema + seeds**
- Prompt: `[T4.4]`
- [ ] Run seed script → 11 disclaimers in DB
- [ ] Verify each has all fields populated

**Day 2-3: Engine**
- Prompts: `[T4.1]`, `[T4.2]`, `[T4.3]`
- [ ] Category detection logic passes unit tests
- [ ] LegalDisclaimer component renders correctly
- [ ] Redis caching verified (second load hits cache)
- [ ] Changing a disclaimer in DB → invalidates cache → updates in UI

**Day 4-5: Integration**
- [ ] Disclaimer shows on every blog post (top + bottom)
- [ ] Disclaimer shows on every price page (top + footer)
- [ ] Footer disclaimer on every page
- [ ] Test with affiliate link detection (add/remove links → banner toggles)

#### Week 6: Blog System + Content

**Day 1-2: Blog infrastructure**
- [ ] `contentlayer` or custom MDX loader set up
- [ ] `content/blog/*.mdx` files rendered at `/blog/[slug]`
- [ ] Prompt: `[D5.3]` → blog post page designed
- [ ] Prompt: `[D5.4]` → blog listing page

**Day 3: Category + tag pages**
- [ ] `/blog/category/gold`, `/blog/tag/inflation`, etc.
- [ ] Pagination (10 per page)
- [ ] RSS feed generated

**Day 4-5: Write first 10 articles**
Target mix for SEO cluster:
- 3 gold articles (1 pillar + 2 supporting)
- 3 silver articles
- 2 crypto articles
- 2 general / cross-topic

Pillar examples:
- "Complete Beginner's Guide to Gold Investing in 2026"
- "Silver vs Gold: Which Metal Belongs in Your Portfolio"
- "Bitcoin for Beginners: Everything You Need to Start"

Cluster examples:
- "How Gold ETFs Differ from Physical Gold"
- "Gold-to-Silver Ratio Explained"
- "How to Store Silver Safely at Home"
- "What Moves Gold Prices Day to Day"

### Sprint 3 Deliverables
- ✅ Blog system fully functional
- ✅ Disclaimer engine verified (no manual input needed)
- ✅ 10 published articles
- ✅ SEO metadata on every post
- ✅ Sitemap generated automatically

---

## 🗓️ SPRINT 4 — Pages & UI (Weeks 7-8)

### Goals
- Landing page live
- All 5 category pages live
- Calculators working
- Country rates tables

### Tasks

#### Week 7: Landing + Category Pages

**Day 1-2: Landing**
- Prompt: `[D5.1]`
- [ ] Hero with animated price cards
- [ ] Price marquee
- [ ] Features section
- [ ] Latest blog posts
- [ ] Subscribe CTA
- [ ] Lighthouse 95+

**Day 3-5: Category pages**
- Prompt: `[D5.2]`
- [ ] `/gold` live
- [ ] `/silver` live
- [ ] `/copper` live
- [ ] `/bitcoin` live
- [ ] `/ethereum` live
- [ ] Each has country rates table with live currency conversion
- [ ] JSON-LD structured data validates in Google's Rich Results Test
- [ ] FAQ section with schema.org FAQPage markup

#### Week 8: Calculators + Country Rates

**Day 1-2: Calculators**
- Prompt: `[D5.5]`
- [ ] Gold calculator with weight/purity/currency
- [ ] Silver calculator
- [ ] Copper calculator
- [ ] Crypto calculator
- [ ] Shareable URLs (params encode inputs)

**Day 3-4: Country-specific pages**
- [ ] `/gold-rate-pakistan` (PKR conversion)
- [ ] `/gold-rate-india` (INR)
- [ ] `/gold-rate-uae` (AED)
- [ ] `/gold-rate-uk` (GBP)
- [ ] Currency conversion live
- [ ] Tola/masha/gram conversions (important for South Asian markets)

**Day 5: Content batch #2**
- [ ] 10 more articles published (20 total now)
- [ ] Internal linking between articles (pillar ↔ clusters)

### Sprint 4 Deliverables
- ✅ All public pages designed and live
- ✅ 20 published articles
- ✅ Calculators working with live data
- ✅ Country pages for top 4 gold markets

---

## 🗓️ SPRINT 5 — Monetization (Weeks 9-10)

### Goals
- Subscription flow complete
- Affiliate links integrated
- AdSense application submitted

### Tasks

#### Week 9: Subscriptions

**Day 1-2: Form & API**
- Prompts: `[T3.3]`, `[T3.4]`, `[D3.1]`, `[D3.4]`
- [ ] Form on landing page
- [ ] Form inline in blog posts
- [ ] POST /api/subscribe works end-to-end
- [ ] Verification email delivered
- [ ] Verification link works, redirects to success
- [ ] Welcome email sent after verification

**Day 3: Preferences magic link**
- [ ] `/preferences?token=X` page
- [ ] JWT-based, 7-day expiry
- [ ] Can update categories, phone, unsubscribe
- [ ] One-click unsubscribe works

**Day 4-5: Admin basics**
- Prompt: `[T6.1]`, `[D6.2]`
- [ ] Clerk auth on `/admin` routes
- [ ] Admin role check (env var allow-list initially)
- [ ] `/admin/subscribers` list with filters
- [ ] CSV export

#### Week 10: Affiliates + Ads

**Day 1-2: Affiliate setup**
- [ ] Apply to TradingView partner program → get affiliate ID
- [ ] Apply to Coinbase affiliate → get link
- [ ] Apply to Birch Gold affiliate → get link
- [ ] Apply to Flippa/Empire Flippers affiliate programs
- [ ] Create `AffiliateLink` component that adds `rel="sponsored"` + UTM
- [ ] Inline affiliate links in top 5 articles

**Day 3: AdSense application**
- [ ] Verify site has 20+ quality articles
- [ ] Privacy policy, About, Contact live
- [ ] No prohibited content
- [ ] Apply via AdSense dashboard
- [ ] Add ads.txt file
- [ ] Wait for response (usually 1-2 weeks)

**Day 4-5: Content batch #3**
- [ ] 10 more articles (30 total)
- [ ] Focus on high-intent keywords: "best X to buy", "how to invest in Y"
- [ ] Affiliate links placed contextually

### Sprint 5 Deliverables
- ✅ Subscription funnel working
- ✅ 3+ affiliate programs integrated
- ✅ AdSense submitted
- ✅ 30 published articles
- ✅ Admin dashboard functional

---

## 🗓️ SPRINT 6 — Polish & Launch (Weeks 11-12)

### Goals
- QA everything
- SEO optimized
- Legal reviewed
- Public launch

### Tasks

#### Week 11: QA & Optimization

**Day 1: Full QA pass (use `10-QA-CHECKLIST.md`)**
- [ ] All pages load <2s on 4G
- [ ] Mobile responsive across 320px – 1920px
- [ ] No console errors
- [ ] No broken links (use Screaming Frog free version)
- [ ] Accessibility: axe-core shows zero violations
- [ ] Forms work with keyboard only

**Day 2: SEO deep dive**
- [ ] `sitemap.xml` includes all pages with proper priorities
- [ ] `robots.txt` correct
- [ ] All pages have unique titles + meta descriptions
- [ ] All images have alt text
- [ ] Structured data validates on every page
- [ ] Internal linking graph dense (every post links to 3-5 others)
- [ ] Submit sitemap to Google Search Console
- [ ] Submit to Bing Webmaster Tools

**Day 3: Performance**
- [ ] Lighthouse CI on all pages
- [ ] Core Web Vitals green
- [ ] Image optimization audit
- [ ] Font loading optimized (font-display: swap)
- [ ] Bundle analyzer → remove unused deps

**Day 4: Legal review (CRITICAL)**
- [ ] Lawyer reviews Privacy Policy
- [ ] Lawyer reviews Terms of Service
- [ ] Lawyer reviews Affiliate Disclosure
- [ ] Lawyer reviews Financial Disclaimers
- [ ] Lawyer reviews Cookie Policy + consent banner
- [ ] Update disclaimer texts based on feedback
- (Budget: $300-1000 for initial review; use LegalZoom or local lawyer)

**Day 5: Security audit**
- [ ] Run `npm audit`, fix high/critical
- [ ] Headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] All secrets in env vars, not code
- [ ] Rate limiting tested (DDoS simulation)
- [ ] SQL injection N/A (MongoDB + Zod) but NoSQL injection prevented
- [ ] XSS prevented (DOMPurify on all user content)

#### Week 12: Pre-launch & Launch

**Day 1-2: Pre-launch content**
- [ ] Final 5 articles for launch (35 total)
- [ ] "About Us" page with E-E-A-T signals (author bios, credentials)
- [ ] Launch blog post explaining the platform

**Day 3: Pre-launch marketing**
- [ ] Share preview with 10 trusted people for feedback
- [ ] Fix critical feedback items
- [ ] Set up Google Analytics + Plausible
- [ ] Set up Google Search Console
- [ ] Set up Bing Webmaster
- [ ] Create Twitter/X account, LinkedIn page, Reddit account (for promotion)

**Day 4: Soft launch**
- [ ] Announce on Reddit (r/personalfinance, r/investing, relevant subs)
- [ ] Submit to Product Hunt
- [ ] Submit to Hacker News
- [ ] Share on personal social media
- [ ] First newsletter sent to early subscribers

**Day 5: Monitor + iterate**
- [ ] Watch error rates in Sentry
- [ ] Watch traffic in analytics
- [ ] Respond to user feedback
- [ ] Fix any emerging issues

### Sprint 6 Deliverables
- ✅ Platform publicly launched
- ✅ 35+ articles live
- ✅ Legal review complete
- ✅ All compliance boxes checked
- ✅ First real users on the site

---

## 📊 Weekly Progress Tracking

Use a simple tracker (Notion, Linear, GitHub Projects):

| Column | Meaning |
|--------|---------|
| Backlog | Not started |
| This Sprint | Committed for current 2 weeks |
| In Progress | Actively being worked on |
| Review | Done, awaiting verification |
| Done | Verified complete |

### Daily standup (even solo)
- What did I finish yesterday?
- What am I working on today?
- Is anything blocking me?

### Sprint review (end of each sprint)
- What shipped?
- What didn't?
- Why not?
- What adjustments for next sprint?

---

## 🚧 Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-------------|
| API provider outage | High | Medium | Failover + stale data flag |
| MongoDB M0 hits limits | Medium | Medium | Monitor → upgrade to M10 before limits |
| AdSense rejection | High | Medium | Ensure 20+ posts, quality content, E-E-A-T signals |
| Legal issues post-launch | Critical | Low | Lawyer review in Sprint 6 |
| Worker crashes silently | High | Medium | Health checks + PM2 auto-restart + alerts |
| Spam signups | Medium | High | Honeypot + rate limiting + email verification |
| Negative SEO (competitors) | Medium | Low | Regular Search Console monitoring |
| Key person bus factor | Critical | Variable | Document everything (you're doing this now!) |

---

## 📝 Post-Launch Roadmap (Sprint 7+)

Once MVP is live and stable, the next ~6 months:

### Months 4-6: Growth
- Scale to 50+ articles
- YouTube channel (repurpose blog content)
- Email list to 1,000+
- Apply to Mediavine Journey (1K sessions threshold)
- Paid newsletter tier ($5/mo) for power users

### Months 6-9: SaaS Layer
- User accounts (Clerk)
- Watchlists
- Price alerts
- Dashboard
- Subscription billing (Stripe)

### Months 9-12: Mobile + Scale
- Capacitor mobile apps
- WhatsApp Business API integration
- International expansion (localization)
- Partnership outreach

---

**End of `07-PMO-SPRINT-PLAN.md`. Proceed to `08-MONGODB-SCHEMAS.md`.**
