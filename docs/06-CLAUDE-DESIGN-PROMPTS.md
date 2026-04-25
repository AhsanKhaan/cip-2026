# 🎨 06 — Claude Design Prompts (Token-Optimized)

**Strategy:** Paste **Design System Context** once, then fire focused component prompts. Each prompt references the design tokens without restating them.

---

## 🧠 DESIGN SYSTEM CONTEXT (paste once per session)

```
You are a senior UI/UX designer creating components for a commodity intelligence
platform. Design philosophy: "Bloomberg Terminal meets 2026 consumer polish."

DESIGN PRINCIPLES
- Dark mode first (it's the default, light mode optional)
- Data-dense but breathable (finance users expect information)
- Every interaction answers a question: why did this change?
- Motion is meaningful, never decorative
- Mobile-first (375px base), scale up to desktop
- WCAG AA minimum accessibility

STACK
- Tailwind CSS + shadcn/ui components
- lucide-react icons (stroke width 1.5, sizes 16/20/24)
- Inter font (UI), JetBrains Mono (numbers with tabular-nums)
- Framer Motion for complex animations (rare)

COLOR TOKENS (CSS vars, Tailwind-exposed)
- bg-canvas (#0A0E1A), bg-surface (#0F172A), bg-elevated (#1E293B)
- text-primary (#E4E7EB), text-secondary (#94A3B8), text-muted (#64748B)
- border-default (#1E293B), border-strong (#334155), border-focus (#3B82F6)
- signal-up (#10B981), signal-down (#EF4444), signal-flat (#94A3B8)
- brand-primary (#3B82F6), brand-gold (#FBBF24), brand-silver (#D1D5DB)
- brand-copper (#EA580C), brand-crypto (#F59E0B)
- status-info, status-success, status-warning, status-danger

SPACING: Tailwind default scale (4px units)
MAX WIDTHS: content max-w-7xl (1280px), reading max-w-3xl (768px)

TYPOGRAPHY RULES
- Prices use font-mono with tabular-nums and -0.02em letter-spacing
- Body uses font-sans at 16px base
- Scale: text-xs (12), text-sm (14), text-base (16), text-lg (18), text-xl (20),
  text-2xl (24), text-3xl (30), text-4xl (36), text-5xl (48)

MOTION RULES
- Price flash: 300ms ease-out (green up, red down)
- Skeleton shimmer: 1.5s linear loop
- Modal/toast: 200-250ms ease
- Respect prefers-reduced-motion

ICONOGRAPHY
- lucide-react only
- Size 16 for inline, 20 for buttons, 24 standalone
- Stroke width 1.5 default

DELIVERABLE FORMAT
- Complete React component file (TSX)
- Tailwind classes only — no inline styles, no CSS-in-JS
- Include TypeScript types for props
- Add accessibility (aria-*, role, keyboard nav)
- Return working code, not pseudocode
- Mobile styles in base, md:/lg: for larger screens
```

---

## 📋 DESIGN PROMPT INDEX

### Phase 1 — Foundation
- [D1.1] App layout + navigation (desktop + mobile)
- [D1.2] Footer with legal sections
- [D1.3] Theme toggle (dark default)

### Phase 2 — Price Components
- [D2.1] LivePriceCard (hero variant)
- [D2.2] LivePriceCard (compact variant)
- [D2.3] Price marquee (scrolling ticker)
- [D2.4] PriceChart container
- [D2.5] Range selector tabs

### Phase 3 — Conversion Components
- [D3.1] Subscription form (inline)
- [D3.2] Subscription form (modal)
- [D3.3] Subscription success state
- [D3.4] Category checkbox cards

### Phase 4 — Legal Components
- [D4.1] Disclaimer banner
- [D4.2] Disclaimer box
- [D4.3] Footer disclaimer (collapsible)

### Phase 5 — Page Layouts
- [D5.1] Landing page
- [D5.2] Category price page
- [D5.3] Blog post page
- [D5.4] Blog listing page
- [D5.5] Calculator page

### Phase 6 — Admin UI
- [D6.1] Admin dashboard shell
- [D6.2] Subscribers data table
- [D6.3] Broadcast composer form
- [D6.4] Disclaimer editor

---

## 📌 DESIGN PROMPT EXAMPLES

### [D1.1] App Layout + Navigation

```
Create the app shell: apps/web/app/layout.tsx, components/layout/Navbar.tsx,
components/layout/MobileNav.tsx.

Layout requirements:
- Full-height dark canvas
- Fixed navbar (56px tall)
- Main content with bottom padding for mobile nav if applicable
- Footer at bottom

Navbar desktop (≥1024px):
- Logo left (text: "CIP" or wordmark)
- Center nav: Markets (dropdown), Tools (dropdown), Learn, News
- Right: search icon, Subscribe button (primary)
- Dropdowns open on hover + click (accessible)
- Subtle border-bottom on scroll

Navbar mobile (<1024px):
- Hamburger left, logo center, search icon right
- Hamburger opens drawer from left
- Drawer: same nav items as desktop, organized vertically
- Drawer has overlay backdrop, closes on backdrop click
- Drawer animates slide-in 250ms ease

Accessibility:
- Focus trap in mobile drawer when open
- ESC closes drawer
- Skip to content link visible on keyboard focus
- ARIA current="page" on active nav item

Include full TSX code for all 3 files.
```

### [D2.1] LivePriceCard (Hero Variant)

```
Create components/price/LivePriceCard.tsx, hero variant (used on category pages
as the main focal point).

Layout (mobile base, desktop enhanced):
- Rounded card with bg-surface, 1px border-default
- Padding: p-6 mobile, p-8 desktop
- Max width: full mobile, w-fit desktop (hugs content)

Content structure (top to bottom):
1. Header row
   - Icon (matching asset: Gem for gold, Circle for silver, Bitcoin for BTC)
   - Asset name + symbol: "Gold" small, "XAU/USD" smaller muted
   - Right: "LIVE" badge (green dot + pulsing animation)

2. Price display
   - Very large: text-5xl on mobile, text-6xl desktop
   - font-mono, tabular-nums, letter-spacing -0.02em
   - Color: text-primary
   - Currency symbol smaller: "$" at 0.6em scale

3. Change indicator (below price)
   - Arrow icon (TrendingUp/Down/Minus)
   - Change value: "+12.40" with sign
   - Percentage: "(+0.53%)"
   - Timeframe: "today"
   - All colored by signal: green up, red down, muted flat

4. Sparkline (full width, 60px tall)
   - lightweight-charts area chart
   - Color matches signal direction (green/red)
   - Gradient fill fading to transparent

5. Stats row (grid 2 columns mobile, 4 desktop)
   - 24h High / 24h Low / 24h Volume / 24h Change %
   - Label (text-xs text-muted) above value (text-sm text-primary)

6. Actions row (flex gap-2)
   - Button primary: "View Full Chart" + ArrowRight icon
   - Button secondary: "Set Alert" + Bell icon

7. Footer (text-xs text-muted)
   - "Updated 14 seconds ago"
   - Hover tooltip: exact timestamp

States:
- Default: everything rendered
- Loading: skeleton replacements for price, change, sparkline, stats
- Price update: brief 300ms flash on price number (green bg fading out for up, red for down)
- Stale (no update >5min): yellow AlertCircle icon + tooltip "Data may be delayed"
- Error: red border, "Price temporarily unavailable" + last-known value with "STALE" badge

Props interface:
{
  symbol: 'gold' | 'silver' | 'copper' | 'bitcoin' | 'ethereum';
  initialData?: PriceData;  // Server-fetched starter data
  className?: string;
}

Use TanStack Query to poll /api/price/{symbol} every 60s.
Include full TSX with types, accessibility, and animations.
```

### [D2.3] Price Marquee

```
Create components/price/PriceMarquee.tsx — scrolling ticker at top of landing
page showing all tracked assets.

Design:
- Full-width strip, 48px tall
- bg-surface, border-y border-default
- Horizontal scrolling list of assets
- Each asset: icon · name · price · change% (color-coded)
- Separator: · or thin vertical divider
- Continuous smooth scroll left (CSS animation)
- Pause on hover (desktop), pause on touch (mobile)
- Double the content so scroll is seamless (no jumping)

Accessibility:
- prefers-reduced-motion: replace with static list + horizontal scroll arrows
- role="marquee" with aria-live="off" (too noisy for screen readers)
- Each price has visible text + aria-label with full context

Animation:
- transform: translateX(-50%) over 60s linear infinite
- Duplicate content inside container for seamless loop

Include full TSX. Use data from props (server-fetched all symbols at once).
```

### [D3.1] Subscription Form (Inline)

```
Create components/subscription/SubscribeForm.tsx for inline placement
(landing page email capture, bottom of blog posts, sidebar).

Layout:
- Rounded card bg-elevated, p-6 (p-8 on desktop)
- Max-width: w-full (mobile), max-w-md (desktop inline)

Content:
1. Heading: "Get market insights in your inbox"
   text-2xl font-semibold
2. Subheading: "Weekly digest. Free forever. Unsubscribe anytime."
   text-sm text-secondary
3. Email input
   - Label: "Email" (sr-only on compact, visible on full)
   - Type email, required, full width
   - Placeholder: "you@example.com"
4. Phone toggle + input (collapsed by default)
   - Toggle row: Chevron icon + "Add phone for WhatsApp updates (optional)"
   - Expanded: country code select + phone number input side by side
   - Helper text below: "We'll only use this for broadcasts you opt into."
5. Category checkboxes
   - Label: "What interests you?"
   - Grid: 2 columns mobile, 3 desktop
   - Each checkbox = full card:
     - Icon + label + tiny description
     - Border on unchecked, border-brand + bg-elevated on checked
     - 44px min height for touch
   - Options: Gold 🥇, Silver 🥈, Copper 🥉, Crypto ₿, Stocks 📈, All 📬
6. Consent checkbox
   - "I agree to receive emails about selected topics"
   - Required, small text
7. Submit button
   - Full width, primary variant, lg size
   - Label: "Subscribe"
   - Loading state: spinner + "Subscribing..."
   - Success state: CheckCircle + "Check your inbox!"
8. Footer note
   - text-xs text-muted
   - "We respect your privacy. Read our Privacy Policy."

States:
- Idle
- Validating (real-time on blur)
- Submitting (form disabled, button loading)
- Success (form hidden, success message shown with confetti option)
- Error (inline error per field, top-level error banner if server error)

Validation:
- Email: format check on blur
- Phone (if provided): E.164 validation
- Categories: at least 1 required, shake animation if submit with none

Accessibility:
- Every input has associated label
- Errors use aria-describedby
- Submit disabled until all required fields valid
- Keyboard navigable

Props:
{
  defaultCategories?: string[];
  source?: string;
  variant?: 'inline' | 'compact';
  onSuccess?: () => void;
}

Use react-hook-form + zod. Submit to /api/subscribe.
Include full TSX with all states.
```

### [D3.4] Category Checkbox Cards

```
Create components/subscription/CategoryCheckboxes.tsx — reusable grid of
category selection cards.

Design per card:
- Rounded, border 1px
- Unchecked: border-default, bg-transparent
- Hover: border-strong, cursor-pointer
- Checked: border-brand-primary, bg-elevated, subtle glow
- Content:
  - Top: icon emoji at text-2xl
  - Middle: label (font-medium text-base)
  - Bottom: description (text-xs text-muted)
- Padding: p-4
- Min height: 88px (so text doesn't cram)

Grid:
- 2 columns on mobile (grid-cols-2)
- 3 columns on tablet+ (md:grid-cols-3)
- Gap: 3

Checkbox behavior:
- Entire card is clickable (not just checkbox)
- Visible checkbox in top-right corner when checked
- Keyboard: Tab to focus, Space to toggle
- aria-pressed and aria-label

Props:
{
  options: Array<{ value: string; icon: string; label: string; description: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  minSelected?: number;  // default 1
  error?: string;
}

Include TSX with all states and accessibility.
```

### [D4.2] Disclaimer Box

```
Create components/legal/DisclaimerBox.tsx.

Design:
- Rounded card
- Border-left 4px (color by severity)
- Background subtle tint of severity color (5% opacity)
- Padding: p-5
- Icon in top-left, body content flowing right

Severity variants:
- info: border-blue, bg-blue-500/5, Info icon
- warning: border-amber, bg-amber-500/5, AlertTriangle icon
- critical: border-red, bg-red-500/5, AlertCircle icon

Content structure:
1. Icon (24x24) + Title row
   - Title: font-semibold text-base
2. Body (MDX rendered)
   - Prose styling: text-sm text-secondary
   - Links underlined, hover color
   - Paragraphs mb-2

Accessibility:
- role="note" for info/warning
- role="alert" for critical
- aria-labelledby pointing to title

Props:
{
  title: string;
  bodyMarkdown: string;  // will be rendered as MDX
  severity: 'info' | 'warning' | 'critical';
  className?: string;
}

Use next-mdx-remote/rsc for server rendering the markdown.
Include TSX.
```

### [D5.1] Landing Page

```
Create app/page.tsx (landing page).

Sections top-to-bottom:

1. HERO (full viewport min-h on desktop, auto on mobile)
   - Large heading: "Live market intelligence, delivered"
   - Subheading: "Gold, silver, crypto, and commodities — tracked, analyzed,
     explained. Free forever."
   - CTA row: primary "Start Tracking" + secondary "See Live Prices"
   - Below CTAs: small text "⭐ Trusted by 12,000+ investors" (social proof)
   - Right side (desktop only): mini dashboard mockup with 4 LivePriceCards
     in compact variant, subtly animated

2. PRICE MARQUEE (full width scrolling ticker)

3. "LIVE PRICES" GRID section
   - Section heading: "Real-time across markets"
   - 4-column grid (responsive: 1 col mobile, 2 col tablet, 4 col desktop)
   - Cards: Gold, Silver, Copper, Bitcoin — each LivePriceCard compact
   - Each card links to its detail page

4. "WHY US" section (3-column features)
   - Real-time data: ⚡ icon + heading + description
   - Smart alerts: 🔔 icon + heading + description
   - Educational: 🎓 icon + heading + description
   - Cards bg-surface, subtle hover lift

5. "LEARN" section (latest blog posts)
   - Section heading: "Learn the markets"
   - 3-column grid (responsive)
   - Each card: cover image + title + excerpt + read time + category tag
   - "View all posts →" link at bottom

6. SUBSCRIBE CTA section (centered, prominent)
   - Bg: bg-elevated, rounded, py-12
   - Heading: "Get daily market insights"
   - SubscribeForm (compact variant, inline)

7. FOOTER

Use Server Components where possible (fetch initial prices server-side).
All spacing should breathe: py-16 to py-24 between sections on desktop.

Include full page.tsx + any new components needed.
```

### [D5.2] Category Price Page

```
Create app/(marketing)/[category]/page.tsx (handles /gold, /silver,
/copper, /bitcoin, /ethereum).

Structure per 04-DESIGN-SYSTEM.md section 6.2.

Specific sections:
1. Breadcrumb
2. LivePriceCard (hero variant)
3. Auto-injected LegalDisclaimer (top — data-accuracy banner)
4. PriceChart (full-width, 500px tall)
5. Country rates table (data from /api/price/[symbol]/rates)
6. Compact calculator
7. Direct answer blocks for AI overviews:
   - Q/A pairs rendered as <dl>
   - Schema.org FAQPage JSON-LD
8. Related blog posts (3 cards, filtered by category)
9. FAQ section with collapsible items
10. Inline SubscribeForm with category pre-checked
11. Auto-injected LegalDisclaimer (footer — no-advice)
12. Footer

Page must:
- Use ISR with revalidate=60
- Include JSON-LD structured data for Product (price)
- Include meta tags for SEO
- Dynamic OG image showing current price

Include full page.tsx with metadata export.
Should support all 5 categories via params.
```

### [D5.3] Blog Post Page

```
Create app/blog/[slug]/page.tsx using MDX.

Structure per 04-DESIGN-SYSTEM.md section 6.3.

Layout:
- Header: cover image (16:9, next/image), title, meta row (author, date,
  read time, tags)
- Auto-injected LegalDisclaimer (top — educational + affiliate + category)
- 2-column on desktop (≥1024px):
  - Left: TOC (sticky, 25% width)
  - Right: MDX content (max-w-3xl)
- 1-column on mobile (TOC collapsed into drawer)
- Prose styling for MDX content:
  - Heading hierarchy with anchor links
  - Code blocks with syntax highlighting
  - Blockquotes with left border
  - Images rounded with captions
  - Tables styled with design tokens
  - Inline affiliate links underlined with small "Ad" marker
- Auto-injected LegalDisclaimer (bottom — category-specific)
- Author bio card (avatar, name, credentials, brief bio, social links)
- Related posts (3 cards)
- SubscribeForm with post's category pre-checked
- Footer

MDX components to customize:
- h1-h6 with anchor links
- a (external links get icon)
- pre + code with theme
- blockquote
- table/thead/tbody/tr/td
- img (via next/image)

Must support:
- Frontmatter: title, description, coverImage, author, publishedAt, updatedAt,
  category, tags, readTime
- Reading time auto-calculated from content length
- OG image generated dynamically with title + author
- ISR with revalidate=3600

Include full page.tsx + MDX components file.
```

### [D6.2] Subscribers Data Table

```
Create app/admin/subscribers/page.tsx.

Layout:
- Page header with title "Subscribers" + CTA "Export CSV"
- Stats row (4 cards): Total, Verified, With Phone, Active Last 30d
- Filter bar: search (email), category dropdown, verified toggle,
  has-phone toggle, date range
- Data table with columns:
  - Email (primary, clickable → detail page)
  - Phone (masked: +92 *** 4567)
  - Categories (chip list)
  - Channels (icons: ✉ email, 💬 whatsapp, 🔔 push)
  - Verified (badge)
  - Joined (relative time, tooltip exact)
  - Last engaged (relative)
  - Actions (dropdown: view, edit, suspend)
- Pagination (page size 50, prev/next)
- Empty state (no subscribers yet)
- Loading state (skeleton rows)

Use shadcn/ui Table + DataTable pattern (TanStack Table).
Server Component for initial fetch, Client Component for interactions.

Accessibility:
- Table caption
- Sortable columns with aria-sort
- Row selection with keyboard

Include full page.tsx with filter/pagination logic.
```

---

## 🎯 PROMPT TEMPLATE FOR NEW DESIGNS

```
Component: [D-ID] [Name]

Purpose: [1 sentence — what problem does it solve?]

Location: [file path]

Layout (mobile → desktop):
- [Structure description]

Design tokens used:
- Colors: [specific tokens]
- Spacing: [specific classes]
- Typography: [specific scales]

States to handle:
- [ ] Default
- [ ] Loading (skeleton, not spinner)
- [ ] Error
- [ ] Empty
- [ ] Interactive states (hover, focus, active, disabled)

Accessibility requirements:
- [ ] Keyboard navigation
- [ ] ARIA attributes
- [ ] Focus management
- [ ] Screen reader announcements (if dynamic)

Props interface:
```ts
{ ... }
```

Reference: 04-DESIGN-SYSTEM.md section X
```

---

## 💡 DESIGN TOKEN-SAVING TIPS

1. **Reference design system by section number** (saves tokens vs. pasting)
2. **Request one variant at a time** — don't ask for full, compact, and inline in one prompt
3. **Ask for Storybook stories** alongside components for free documentation
4. **Use the design system context** as base knowledge; don't re-explain colors
5. **Request visual preview images** only when structure is unclear — text spec is often clearer

---

**End of `06-CLAUDE-DESIGN-PROMPTS.md`. Proceed to `07-PMO-SPRINT-PLAN.md`.**
