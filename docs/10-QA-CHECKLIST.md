# ✅ 10 — Pre-Launch QA Checklist

**Purpose:** Run through this entire document before going live. Don't skip items.
**Mindset:** "If I missed this, what's the worst that happens?" For YMYL sites, the worst can be severe.

---

## 🎯 How to Use This Checklist

1. Go through top to bottom, one category per day (takes ~1 week)
2. Mark every item as ✅ (pass) or ❌ (fix needed)
3. No launch until every item is ✅ or explicitly deferred with a ticket
4. Re-run this every quarter after launch

---

## 1. Functionality — Core Flows

### 1.1 Price data
- [ ] `/api/price/gold` returns 200 with current data
- [ ] Price updates within 90 seconds of source change
- [ ] Worker recovers from MetalpriceAPI outage (failover to Metals-API)
- [ ] Worker recovers from MongoDB timeout
- [ ] Binance WebSocket auto-reconnects within 10s of disconnect
- [ ] Stale data flag (`isStale: true`) appears in UI when all sources down
- [ ] Price pages render server-side (view page source → see numbers in HTML)

### 1.2 Charts
- [ ] 1D range loads and displays 1-minute candles
- [ ] 7D, 1M, 3M, 1Y, 5Y ranges all work
- [ ] Chart adapts to theme (dark/light)
- [ ] Crosshair tooltip shows OHLC on hover
- [ ] Mobile: touch gestures work (pinch zoom, pan)
- [ ] Responsive: chart resizes on window resize
- [ ] Loading state shows skeleton, not blank

### 1.3 Subscription
- [ ] Form submits successfully with minimal input (email + 1 category)
- [ ] Form submits with phone number
- [ ] Email verification sent within 30 seconds
- [ ] Verification link works and redirects to success page
- [ ] Verification link expires after 24 hours
- [ ] Duplicate subscription updates existing user (doesn't error)
- [ ] Welcome email sent after verification
- [ ] Magic link preferences page works without login
- [ ] One-click unsubscribe works from every email
- [ ] Unsubscribed users don't receive any future broadcasts

### 1.4 Calculators
- [ ] Gold calculator: weight × purity × price = correct value
- [ ] All unit conversions correct (gram, ounce, tola, kilo)
- [ ] Currency conversion reflects live FX rates
- [ ] Share URL preserves inputs and reproduces on load
- [ ] Works on mobile with touch-friendly inputs

### 1.5 Blog
- [ ] All MDX posts render without errors
- [ ] Code blocks have syntax highlighting
- [ ] Images load with proper alt text
- [ ] Internal links work (no 404s)
- [ ] External links open in new tab with `rel="noopener"`
- [ ] Table of contents auto-generates from headings
- [ ] Related posts show correctly by category
- [ ] Author bio appears at bottom
- [ ] Read time auto-calculated

### 1.6 Admin
- [ ] Admin login requires valid Clerk session
- [ ] Non-admin users redirected from `/admin/*`
- [ ] Subscribers list paginates correctly
- [ ] Subscribers can be filtered by category, channel, verified
- [ ] CSV export downloads complete subscriber list
- [ ] Broadcast composer preview count matches actual send count
- [ ] Test send goes only to admin email
- [ ] Broadcasts execute and stats update

---

## 2. Disclaimer Engine (CRITICAL)

This is compliance-critical. Verify every case.

### 2.1 Presence
- [ ] Every blog post shows `educational` disclaimer at top
- [ ] Blog posts with affiliate links show `affiliate` banner at top
- [ ] Blog posts tagged `gold` show `disc-gold-v1` at bottom
- [ ] Blog posts tagged `crypto` show `disc-crypto-v1` (warning severity) at bottom
- [ ] `/gold`, `/silver`, `/copper` show `data-accuracy` banner
- [ ] `/bitcoin`, `/ethereum` show `data-accuracy` banner + `crypto` disclaimer
- [ ] Calculator pages show `calculator-accuracy` + `no-advice`
- [ ] Footer on every page shows `general` disclaimer
- [ ] No page is missing required disclaimers (spot-check 20 random pages)

### 2.2 Rendering
- [ ] Disclaimers render server-side (visible in view-source)
- [ ] Severity colors correct: info=blue, warning=amber, critical=red
- [ ] Display styles correct: banner=full-width, box=contained, footer=small
- [ ] Mobile: disclaimers readable, not cramped
- [ ] Screen reader announces disclaimers with proper role

### 2.3 Admin
- [ ] Editing a disclaimer creates a new version (old preserved)
- [ ] Version history visible in admin UI
- [ ] Cache invalidates within 60s of edit
- [ ] Audit log records who edited what
- [ ] Inactive disclaimers don't render

### 2.4 Auto-detection
- [ ] Adding affiliate link to post → `affiliate` banner appears
- [ ] Removing affiliate links → banner disappears
- [ ] Post tagged `gold` → gold disclaimer shown
- [ ] Post tagged `crypto,bitcoin` → both disclaimers shown (deduped by key)

---

## 3. Performance

Run Lighthouse + PageSpeed Insights + WebPageTest on every key page.

### 3.1 Core Web Vitals
- [ ] LCP (Largest Contentful Paint): < 2.5s on 4G
- [ ] FID (First Input Delay): < 100ms
- [ ] CLS (Cumulative Layout Shift): < 0.1
- [ ] INP (Interaction to Next Paint): < 200ms
- [ ] TTFB (Time to First Byte): < 600ms

### 3.2 Bundle size
- [ ] Home page JS bundle: < 150KB (gzipped)
- [ ] First Load JS total: < 250KB
- [ ] Unused JavaScript under 100KB (check Coverage tab in DevTools)
- [ ] No duplicate dependencies (check `pnpm dedupe`)

### 3.3 API performance
- [ ] `/api/price/*` cache hit: < 50ms
- [ ] `/api/price/*` cache miss: < 150ms
- [ ] `/api/candles/*` for 1D: < 100ms
- [ ] `/api/subscribe`: < 500ms (async email doesn't block)

### 3.4 Load testing
- [ ] 100 concurrent users on landing: no errors, p95 < 500ms
- [ ] 1000 req/min on `/api/price/gold`: sustained, no errors
- [ ] Worker handles 24h of traffic without memory leak (heap stable)

### 3.5 Image optimization
- [ ] All images use `next/image` component
- [ ] Critical images preloaded
- [ ] Non-critical images lazy-loaded
- [ ] WebP/AVIF formats served where supported
- [ ] OG images generated dynamically

---

## 4. SEO & Discoverability

### 4.1 On-page SEO
- [ ] Every page has unique `<title>` (50-60 chars)
- [ ] Every page has unique meta description (150-160 chars)
- [ ] H1 on every page, one per page
- [ ] Logical heading hierarchy (no skipping levels)
- [ ] All images have descriptive alt text
- [ ] Canonical URL set on every page
- [ ] Open Graph tags complete (og:title, og:description, og:image, og:url, og:type)
- [ ] Twitter Card tags complete
- [ ] Language tag set (`<html lang="en">`)

### 4.2 Technical SEO
- [ ] `sitemap.xml` at root, auto-generated, updates daily
- [ ] `robots.txt` at root, allows crawlers, blocks admin
- [ ] Sitemap submitted to Google Search Console
- [ ] Sitemap submitted to Bing Webmaster Tools
- [ ] No render-blocking JavaScript above fold
- [ ] HTML valid (check via validator.w3.org)
- [ ] No duplicate content (canonical correct)
- [ ] Redirects: 301 (permanent) for URL changes, not 302

### 4.3 Structured data
- [ ] Landing page: Organization schema
- [ ] Price pages: Product schema with current price
- [ ] Blog posts: Article + Author schema
- [ ] FAQ sections: FAQPage schema
- [ ] All validate in Google's Rich Results Test
- [ ] All validate on schema.org validator

### 4.4 Internal linking
- [ ] Every blog post has ≥ 3 internal links
- [ ] Every category page links to relevant blog posts
- [ ] Blog pillar pages link to cluster pages and vice versa
- [ ] No orphan pages (every page reachable from home within 3 clicks)
- [ ] Broken link check: 0 broken internal links (use Screaming Frog)

### 4.5 AI search optimization (new in 2026)
- [ ] Direct answer blocks at top of long articles (200 chars, one paragraph)
- [ ] FAQ sections with schema.org FAQPage markup
- [ ] Author E-E-A-T signals on every post (credentials, bio, expertise)
- [ ] `llms.txt` file at root (tells AI crawlers what to focus on)
- [ ] Content structure scannable (short paragraphs, subheadings)

---

## 5. Accessibility (WCAG AA)

### 5.1 Automated
- [ ] axe-core: 0 violations on home
- [ ] axe-core: 0 violations on category page
- [ ] axe-core: 0 violations on blog post
- [ ] axe-core: 0 violations on subscribe form
- [ ] WAVE tool: no errors on all key pages
- [ ] Lighthouse accessibility score: 100

### 5.2 Keyboard navigation
- [ ] Tab through entire page — logical order
- [ ] All interactive elements reachable via keyboard
- [ ] Focus indicator visible on every focused element
- [ ] Skip link to main content (visible on Tab from top)
- [ ] No keyboard traps (except modals, which are explicit)
- [ ] Escape closes modals and dropdowns

### 5.3 Screen reader
- [ ] Tested with NVDA on Windows
- [ ] Tested with VoiceOver on macOS / iOS
- [ ] Form labels associated correctly
- [ ] Errors announced on submit
- [ ] Dynamic price updates announced (aria-live)
- [ ] Images have alt text (decorative = empty alt)
- [ ] Icons have aria-label or sr-only text

### 5.4 Visual
- [ ] Body text contrast ≥ 4.5:1 against background
- [ ] Large text contrast ≥ 3:1
- [ ] UI components contrast ≥ 3:1 against adjacent colors
- [ ] Focus indicators contrast ≥ 3:1
- [ ] Color not the sole means of conveying information (up/down = color + icon)
- [ ] Works at 200% zoom without horizontal scroll
- [ ] Works with Windows High Contrast mode
- [ ] Respects `prefers-reduced-motion`
- [ ] Respects `prefers-color-scheme`

---

## 6. Security

### 6.1 Secrets
- [ ] No secrets in code (grep for common patterns: `sk_`, `pk_`, passwords)
- [ ] All secrets in Vercel env vars + local `.env.local` (gitignored)
- [ ] `.env.example` has placeholders, no real values
- [ ] Secrets rotated from any previously committed/shared values

### 6.2 Headers (check via securityheaders.com)
- [ ] `Content-Security-Policy` set and restrictive
- [ ] `Strict-Transport-Security` with long max-age
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` disables unnecessary APIs
- [ ] Score: A or A+ on securityheaders.com

### 6.3 Input validation
- [ ] Every API route has Zod validation
- [ ] URL params validated (e.g., `symbol` against allowlist)
- [ ] Query params validated
- [ ] File uploads have size + type limits (if any)
- [ ] HTML content sanitized with DOMPurify

### 6.4 Rate limiting
- [ ] `/api/subscribe`: 3/hour/IP confirmed
- [ ] `/api/price/*`: 120/min/IP confirmed
- [ ] Subscription form: honeypot field present and tested
- [ ] Admin endpoints: 30/min/user confirmed

### 6.5 Dependency audit
- [ ] `npm audit`: 0 high or critical vulnerabilities
- [ ] `npm outdated`: no major version lags > 6 months
- [ ] `snyk test` (optional): clean

### 6.6 Authentication (Phase 3+)
- [ ] Clerk configured with proper origins whitelist
- [ ] Admin role enforced server-side (not just UI-hidden)
- [ ] Session timeouts reasonable (30 days sliding)
- [ ] Password strength requirements if email+password
- [ ] 2FA available for admin accounts

---

## 7. Legal & Compliance

### 7.1 Required pages
- [ ] Privacy Policy (GDPR + CCPA compliant)
- [ ] Terms of Service
- [ ] Cookie Policy (with consent banner)
- [ ] Financial Disclaimer page
- [ ] Affiliate Disclosure page
- [ ] About Us page with author credentials (E-E-A-T)
- [ ] Contact page with valid business email
- [ ] DMCA / Copyright notice

### 7.2 GDPR (if any EU traffic)
- [ ] Cookie consent banner before non-essential cookies
- [ ] Privacy policy mentions data processor (Vercel, MongoDB, Upstash)
- [ ] Right to access: endpoint to export user data
- [ ] Right to deletion: endpoint to delete account + confirm
- [ ] Right to rectification: preferences page allows updates
- [ ] Data breach notification process documented (72h)

### 7.3 CAN-SPAM (US email)
- [ ] Every email has valid physical postal address
- [ ] Unsubscribe link in every email
- [ ] Unsubscribe honored within 10 days
- [ ] "From" accurately identifies sender
- [ ] Subject not misleading

### 7.4 CASL (Canada)
- [ ] Explicit consent recorded (date, method, content)
- [ ] Unsubscribe mechanism works within 10 days
- [ ] Sender identification in every email

### 7.5 Financial disclaimers (YMYL)
- [ ] ⚠️ **Lawyer reviewed all disclaimer text** (most important!)
- [ ] Disclaimers on every applicable page (see Section 2 above)
- [ ] No claim of being a "financial advisor" without license
- [ ] No guarantees of returns
- [ ] Past performance disclaimer on performance mentions

### 7.6 Affiliate compliance (FTC)
- [ ] "This post contains affiliate links" clearly disclosed near top
- [ ] Each affiliate link marked with `rel="sponsored"`
- [ ] Affiliate disclosure page accessible from footer
- [ ] Not hidden in small text or below-the-fold

### 7.7 Cookie consent (EU ePrivacy)
- [ ] Banner shows before any non-essential cookies set
- [ ] Granular choices: analytics, marketing, functional
- [ ] Consent recorded with timestamp + IP
- [ ] Easy to revoke consent

---

## 8. Deliverability (Email)

### 8.1 Domain setup
- [ ] SPF record: `v=spf1 include:resend.com ~all`
- [ ] DKIM: Resend public keys added
- [ ] DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@yoursite.com`
- [ ] BIMI (optional, improves branding)
- [ ] All DNS records propagated and verified

### 8.2 Reputation
- [ ] Sender domain: dedicated subdomain like `mail.yoursite.com`
- [ ] IP warmup (if dedicated) — start small, ramp up over 30 days
- [ ] Bounce rate < 2% (monitor Resend dashboard)
- [ ] Complaint rate < 0.1%

### 8.3 Content
- [ ] Physical address in every email footer
- [ ] Unsubscribe link prominent in footer
- [ ] One-click unsubscribe (`List-Unsubscribe` header)
- [ ] Text version alongside HTML (Resend handles)
- [ ] No spam trigger words in subject ("FREE!!!", "GUARANTEED")
- [ ] Mail-tester.com score: 9/10 or better

---

## 9. Analytics & Monitoring

### 9.1 Analytics
- [ ] Plausible or GA4 installed and firing
- [ ] Conversion events tracked:
  - Subscription form submit
  - Subscription verified
  - Chart interaction
  - Calculator use
  - Affiliate link click
- [ ] Goal funnels set up
- [ ] Real-time dashboard accessible

### 9.2 Error monitoring
- [ ] Sentry capturing frontend + backend errors
- [ ] Source maps uploaded for readable stack traces
- [ ] Error alerts configured (Slack, email)
- [ ] Sensitive data not logged (emails, phones)

### 9.3 Uptime
- [ ] External monitor checking home page every 5 min (BetterStack/UptimeRobot)
- [ ] API health check endpoint: `/api/health`
- [ ] Alerts on downtime (SMS + email)
- [ ] Status page (optional but nice)

### 9.4 Business metrics
- [ ] Dashboard for: DAU, subscribers, broadcasts sent, top articles
- [ ] Funnel tracking: landing → form view → form submit → verified
- [ ] Cohort retention: subscribers who open email 30/60/90 days after signup

---

## 10. Mobile Experience

Test on real devices, not just DevTools.

### 10.1 iOS Safari
- [ ] No horizontal scroll on any page
- [ ] Price cards readable on iPhone SE (smallest target)
- [ ] Forms work (keyboard doesn't cover submit button)
- [ ] Pinch zoom works on charts
- [ ] Bottom safe area respected (notch devices)

### 10.2 Android Chrome
- [ ] Same as above on Pixel + Samsung
- [ ] Samsung Internet browser tested

### 10.3 Tablet
- [ ] iPad landscape: layout doesn't break at 1024px
- [ ] iPad portrait: uses tablet layout appropriately

### 10.4 Touch targets
- [ ] All buttons ≥ 44×44px on mobile
- [ ] Checkboxes easy to tap (card-style, not tiny native)
- [ ] No hover-only interactions (everything has touch equivalent)

---

## 11. Content Quality

### 11.1 Every blog post
- [ ] Original content (not AI-generated without heavy editing)
- [ ] No factual errors (fact-check current data)
- [ ] Sources cited for claims
- [ ] Author credentials visible
- [ ] Published date visible
- [ ] Last updated date if edited
- [ ] At least one image (cover)
- [ ] Metadata complete (title, description, tags)

### 11.2 Editorial
- [ ] No typos (use Grammarly or similar)
- [ ] Consistent tone (professional but approachable)
- [ ] No plagiarism (run through Copyscape)
- [ ] Links work (no broken affiliate links, no 404s)

---

## 12. Monitoring Post-Launch (First 72 Hours)

Intensive monitoring for 3 days:

- [ ] Check Sentry every 2 hours
- [ ] Check Resend dashboard for bounces/complaints
- [ ] Check worker logs for errors
- [ ] Check MongoDB Atlas metrics (connections, storage)
- [ ] Check Upstash dashboard (requests, errors)
- [ ] Check analytics for traffic patterns
- [ ] Respond to user feedback within 24h

### Rollback plan
- [ ] Documented: how to revert to previous Vercel deploy
- [ ] Documented: how to restart worker on Hetzner
- [ ] Documented: how to restore MongoDB from backup
- [ ] Documented: who to call for DNS/Cloudflare issues

---

## 13. Final Sign-Off

Before clicking "go live":

- [ ] All sections above: ✅ complete or explicitly deferred
- [ ] Lawyer has reviewed legal pages and disclaimers
- [ ] Backup of MongoDB taken
- [ ] DNS changes queued with rollback capability
- [ ] Launch announcement drafted (email, social, HN, Reddit)
- [ ] Support email monitored
- [ ] Team notified of launch time
- [ ] Celebratory beverage ready 🥂

---

## 14. Ongoing (Post-Launch Quarterly)

Every 3 months:

- [ ] Review & update disclaimer texts
- [ ] Audit affiliate links (remove dead ones, update commissions)
- [ ] Performance audit (Lighthouse re-run)
- [ ] Security audit (dependencies, CSP)
- [ ] Accessibility re-test
- [ ] Legal page review (law changes)
- [ ] Analytics deep-dive (what's working, what's not)
- [ ] Subscriber list hygiene (remove inactive 12+ months)

---

## 15. Emergency Procedures

### If data source goes down
1. Check worker logs: `ssh hetzner && pm2 logs worker`
2. Verify failover activated: `curl /api/price/gold` → check `source` field
3. If stale for > 30 min: post status update on site
4. Contact primary API support
5. Document incident for retrospective

### If site goes down
1. Check Vercel status page
2. Check Cloudflare status
3. Check MongoDB Atlas status
4. Check Upstash status
5. If our issue: rollback via Vercel dashboard (1 click)
6. If external: wait + communicate on Twitter/status page

### If GDPR request received
1. Acknowledge within 72 hours
2. Respond substantively within 30 days
3. Access request → export all data for email
4. Deletion request → soft delete + wipe PII, keep audit log
5. Document response for compliance

### If security incident
1. Isolate affected systems
2. Assess scope of exposure
3. Notify affected users within 72 hours if PII exposed (GDPR)
4. File reports with relevant authorities
5. Post-mortem + fix + document

---

**End of `10-QA-CHECKLIST.md`. This completes the 10-document delivery package.**

**Congratulations — you now have everything needed to build and launch the platform. 🚀**
