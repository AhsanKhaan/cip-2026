# 🎨 04 — Design System Specification

**Design Philosophy:** "Bloomberg Terminal meets 2026 consumer polish"
**Primary Framework:** shadcn/ui + Tailwind CSS
**Theme:** Dark-first with optional light mode

---

## 1. Design Principles (why decisions are made)

1. **Data density is a feature, not a bug.** Finance users trust interfaces that show information. Sparse design reads as "content-light."
2. **Dark mode as default.** Reduces eye strain during extended research sessions. Almost every pro finance tool (Bloomberg, TradingView, Interactive Brokers) defaults to dark.
3. **Motion is meaningful.** Price changes animate (green flash up, red flash down). Nothing else animates unnecessarily.
4. **Mobile = 80% of traffic.** Every design starts from 375px wide and grows up, not the other way around.
5. **Accessibility is non-optional.** WCAG AA minimum. YMYL sites must be usable by everyone because everyone makes financial decisions.
6. **Speed is UX.** Every 100ms of latency loses users. Skeletons over spinners. Static over dynamic whenever possible.

---

## 2. Color System

### 2.1 Brand colors

```css
/* Primary brand */
--brand-gold: #FBBF24;        /* Gold accent — for gold-related UI */
--brand-silver: #D1D5DB;      /* Silver accent */
--brand-copper: #EA580C;      /* Copper accent */
--brand-crypto: #F59E0B;      /* Bitcoin orange (generic crypto) */
--brand-primary: #3B82F6;     /* Blue — CTAs, links, primary actions */
```

### 2.2 Semantic colors (dark mode)

```css
/* Backgrounds */
--bg-canvas:     #0A0E1A;    /* Main page background */
--bg-surface:    #0F172A;    /* Cards, containers */
--bg-elevated:   #1E293B;    /* Hover states, modals, popovers */
--bg-interactive:#334155;    /* Inputs, buttons */

/* Borders */
--border-default: #1E293B;
--border-strong:  #334155;
--border-focus:   #3B82F6;

/* Text */
--text-primary:   #E4E7EB;   /* Body text */
--text-secondary: #94A3B8;   /* Captions, labels */
--text-muted:     #64748B;   /* Disabled, timestamps */
--text-inverse:   #0F172A;   /* Text on light backgrounds */

/* Market signals */
--signal-up:     #10B981;    /* Green — price up, gains */
--signal-down:   #EF4444;    /* Red — price down, losses */
--signal-flat:   #94A3B8;    /* Gray — no change */

/* Status */
--status-info:    #3B82F6;
--status-success: #10B981;
--status-warning: #F59E0B;
--status-danger:  #EF4444;
--status-critical:#DC2626;
```

### 2.3 Light mode (optional, for accessibility)

```css
--bg-canvas:     #FFFFFF;
--bg-surface:    #F8FAFC;
--bg-elevated:   #F1F5F9;
--text-primary:  #0F172A;
--text-secondary:#475569;
/* ... inverted palette ... */
```

### 2.4 Contrast requirements (WCAG AA)

- Body text on background: minimum 4.5:1 contrast
- Large text (18pt+): minimum 3:1
- UI components (buttons, inputs): minimum 3:1 against adjacent colors
- **Never rely on color alone** for meaning (green = up + ↑ icon, red = down + ↓ icon)

---

## 3. Typography

### 3.1 Font stack

```css
/* Body and UI */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Numbers / prices / tabular data */
--font-mono: 'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace;

/* Display / hero text */
--font-display: 'Inter', sans-serif;  /* Variable font, heavy weight */
```

**Why Inter + JetBrains Mono:**
- Inter is optimized for screen reading at small sizes
- JetBrains Mono has true tabular digits (critical — prices don't wiggle as they update)
- Both are free, open-source, available on Google Fonts + `@next/font`

### 3.2 Type scale

```css
--text-xs:   0.75rem;   /* 12px — micro labels, timestamps */
--text-sm:   0.875rem;  /* 14px — captions, helper text */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — emphasized body */
--text-xl:   1.25rem;   /* 20px — subheadings */
--text-2xl:  1.5rem;    /* 24px — section headings */
--text-3xl:  1.875rem;  /* 30px — page titles */
--text-4xl:  2.25rem;   /* 36px — hero prices */
--text-5xl:  3rem;      /* 48px — landing hero */
--text-6xl:  3.75rem;   /* 60px — marquee prices */

--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### 3.3 Price numeral display

```css
.price {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;  /* Critical: fixed-width digits */
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.02em;
}
```

---

## 4. Spacing & Layout

### 4.1 Spacing scale (Tailwind default — stick with it)

```
0, 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px),
6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px), 20 (80px), 24 (96px)
```

### 4.2 Layout grid

- Max content width: `max-w-7xl` (1280px)
- Reading max width (blog): `max-w-3xl` (768px)
- Sidebar width: `w-64` (256px)
- Mobile edge padding: `px-4` (16px)
- Desktop edge padding: `lg:px-8` (32px)

### 4.3 Breakpoints (Tailwind default)

```
sm:  640px   (large phone / small tablet)
md:  768px   (tablet portrait)
lg:  1024px  (tablet landscape / small laptop)
xl:  1280px  (desktop)
2xl: 1536px  (large desktop)
```

**Mobile-first rule:** write base styles for mobile, add `md:`, `lg:` etc. for larger screens.

---

## 5. Component Specifications

### 5.1 LivePriceCard (the most important component)

**Purpose:** Display current price for a single asset with real-time updates.

**Anatomy:**
```
┌─────────────────────────────────────────┐
│ 🥇 Gold (XAU/USD)              [Live ●] │  ← Header row
│                                         │
│ $2,350.21                               │  ← Large price (tabular-nums)
│ ↗ +12.40 (+0.53%) today                 │  ← Change indicator
│                                         │
│ ▁▂▃▅▆▅▆▇█▇▆ 24h sparkline               │  ← Mini chart
│                                         │
│ High: 2,358.40  Low: 2,337.80           │  ← 24h high/low
│                                         │
│ [Full Chart →]  [Set Alert 🔔]          │  ← Actions
│                                         │
│ Updated 14 seconds ago                  │  ← Freshness signal
└─────────────────────────────────────────┘
```

**States:**
- **Default:** Price visible, last-updated timestamp
- **Loading:** Skeleton placeholder (NOT spinner)
- **Fresh update:** Brief green/red flash on price change (200ms)
- **Stale (no update > 5 min):** Yellow warning icon + "Last updated X min ago"
- **Error (API down):** Red warning + "Price temporarily unavailable" + last known value with "STALE" badge

**Accessibility:**
- `role="status"` with `aria-live="polite"` for price updates
- Screen reader announces "Gold price updated to $2,350.21, up 0.53%"
- Sparkline has text alternative: "24 hour price chart: trending up"

**Props:**
```ts
type LivePriceCardProps = {
  symbol: 'gold' | 'silver' | 'copper' | 'bitcoin' | 'ethereum';
  variant?: 'full' | 'compact' | 'inline';
  showChart?: boolean;
  showActions?: boolean;
  className?: string;
};
```

### 5.2 PriceChart

**Purpose:** Interactive chart showing price history across ranges.

**Library:** `lightweight-charts` (by TradingView — same lib powers their UI)
**Why not Recharts:** 10× slower with large datasets, not optimized for financial candles.

**Range selector:** `[1D] [7D] [1M] [3M] [1Y] [5Y] [ALL]`
**Chart type toggle:** `[Line] [Candles] [Area]`

**Interactions:**
- Hover → crosshair + tooltip with OHLC at that time
- Pinch to zoom on mobile
- Drag to pan
- Double-tap to reset

**Design tokens for chart:**
```ts
const chartTheme = {
  backgroundColor: 'var(--bg-surface)',
  textColor: 'var(--text-secondary)',
  gridColor: 'var(--border-default)',
  upColor: 'var(--signal-up)',
  downColor: 'var(--signal-down)',
  crosshairColor: 'var(--border-strong)',
};
```

### 5.3 SubscribeForm

**States:**
- Idle (form visible)
- Validating (button disabled, mini spinner)
- Submitting (form locked, progress indicator)
- Success ("Check your email!" confirmation)
- Error (inline error messages per field)

**Progressive disclosure:**
- Email field always visible
- Phone field collapsed behind toggle: `+ Add phone for WhatsApp (optional)`
- Categories: 6 checkboxes with icons, 2 columns on mobile, 3 on desktop
- Consent checkbox (required) with legal copy

**Validation:**
- Email: inline on blur
- Phone: inline on blur + country code flag preview
- Categories: at least 1 required (shown in red if submit attempted without)
- Consent: required

**Mobile optimization:**
- Large tap targets (44×44 px minimum)
- Full-width inputs
- Submit button sticky above keyboard on iOS

### 5.4 LegalDisclaimer

**Variants by `displayStyle`:**

**Banner:**
```
┌─────────────────────────────────────────────────┐
│ ⚠ About This Data: Prices update every 60s...  │
└─────────────────────────────────────────────────┘
```
- Full-width strip at top of page
- Yellow/amber for warning, blue for info
- Border-left 4px accent

**Box:**
```
┌───────────────────────────────┐
│ ℹ  For Educational Purposes   │
│                               │
│ This article is intended to   │
│ inform and educate...         │
│                               │
│ [Read more about our policy →]│
└───────────────────────────────┘
```
- Contained card, rounded corners
- Icon + title + body text

**Footer text:**
- Small text, muted color
- Collapsed by default: "⓵ Legal disclaimer (tap to expand)"
- Expands to full text on click

### 5.5 Navigation

**Desktop (≥1024px):**
```
[LOGO]   Markets ▾   Tools ▾   Learn   News          🔍   [Subscribe]
```

**Mobile:**
```
[≡]   [LOGO]                                               🔍
```

**Drawer contents (mobile):**
```
Markets
  ├─ Gold
  ├─ Silver
  ├─ Copper
  ├─ Crypto
  └─ Stocks
Tools
  ├─ Calculators
  └─ Converters
Learn
News
───────────
About
Contact
Privacy
Terms
───────────
[Subscribe button]
```

### 5.6 Calculator

```
┌──────────────────────────────────────┐
│ Gold Calculator                      │
├──────────────────────────────────────┤
│ Weight                               │
│ [  5.0  ]  [ Gram ▾ ]                │
│                                      │
│ Currency                             │
│ [ USD ▾ ] (auto-detected: PKR)       │
│                                      │
│ Purity                               │
│ ⦿ 24K   ○ 22K   ○ 18K                │
│                                      │
│ ────────────────────────────         │
│                                      │
│ Value                                │
│ $377.45 USD                          │
│ ≈ 105,386 PKR                        │
│                                      │
│ [Copy]  [Share]  [Save]              │
│                                      │
│ Based on gold price: $2,350.21/oz    │
│ Last updated: 14 seconds ago         │
└──────────────────────────────────────┘
```

**Behavior:**
- Real-time recalculation on input change (debounced 200ms)
- Auto-detect user currency from geo IP
- "Save" requires login (Phase 3)
- Share generates URL with params: `?weight=5&unit=gram&purity=24k&currency=USD`

---

## 6. Page Layouts

### 6.1 Landing page (`/`)

```
┌──────────────────────────────────────────────────┐
│  NAV                                             │
├──────────────────────────────────────────────────┤
│                                                  │
│  HERO                                            │
│  "Live market intelligence for gold,             │
│   silver, crypto, and commodities."              │
│                                                  │
│  [Gold Price] [Silver Price] [Crypto] [Stocks]   │
│  (live tickers scrolling)                        │
│                                                  │
│  [Subscribe Free] [Explore Markets]              │
│                                                  │
├──────────────────────────────────────────────────┤
│  LIVE PRICE GRID (4 cards)                       │
│  [Gold] [Silver] [Copper] [Bitcoin]              │
├──────────────────────────────────────────────────┤
│  WHY US (3 columns)                              │
│  ⚡ Real-time  📊 Smart alerts  🎓 Educational   │
├──────────────────────────────────────────────────┤
│  RECENT BLOG POSTS (3 cards)                     │
├──────────────────────────────────────────────────┤
│  EMAIL CAPTURE (big, centered)                   │
│  "Get daily market insights in your inbox"       │
│  [Subscribe form]                                │
├──────────────────────────────────────────────────┤
│  FOOTER                                          │
└──────────────────────────────────────────────────┘
```

### 6.2 Price page (`/gold-price-today`)

```
┌──────────────────────────────────────────────────┐
│  NAV                                             │
├──────────────────────────────────────────────────┤
│  BREADCRUMB: Home > Markets > Gold > Price Today │
├──────────────────────────────────────────────────┤
│  HERO (LivePriceCard — large variant)            │
│  Current Gold Price: $2,350.21/oz                │
│  +12.40 (0.53%) today                            │
├──────────────────────────────────────────────────┤
│  [DATA ACCURACY BANNER]                          │
├──────────────────────────────────────────────────┤
│  CHART (full width, 500px tall)                  │
│  [Range selector]                                │
├──────────────────────────────────────────────────┤
│  COUNTRY RATES TABLE                             │
│  Country    | per gram (24K) | per tola         │
│  Pakistan   | 21,075 PKR     | 245,876          │
│  India      | 6,285 INR      | —                │
│  UAE        | 277 AED        | 3,228            │
│  (expandable)                                    │
├──────────────────────────────────────────────────┤
│  QUICK CALCULATOR (compact)                      │
├──────────────────────────────────────────────────┤
│  DIRECT ANSWERS (for AI overviews)               │
│  Q: What is the gold price today?                │
│  A: $2,350.21 per troy ounce...                  │
├──────────────────────────────────────────────────┤
│  RELATED BLOG POSTS (3 cards)                    │
├──────────────────────────────────────────────────┤
│  FAQ (JSON-LD structured)                        │
├──────────────────────────────────────────────────┤
│  SUBSCRIBE FORM (pre-checked: gold)              │
├──────────────────────────────────────────────────┤
│  [NO-ADVICE DISCLAIMER]                          │
│  FOOTER                                          │
└──────────────────────────────────────────────────┘
```

### 6.3 Blog post

```
┌──────────────────────────────────────────────────┐
│  NAV                                             │
├──────────────────────────────────────────────────┤
│  COVER IMAGE (16:9, dynamically generated OG)    │
├──────────────────────────────────────────────────┤
│  TITLE                                           │
│  "Why Gold Prices Are Surging in 2026"           │
│                                                  │
│  By Author · April 22, 2026 · 8 min read         │
│  Tags: [Gold] [Inflation] [Markets]              │
├──────────────────────────────────────────────────┤
│  [EDUCATIONAL + AFFILIATE DISCLAIMERS]           │
├──────────────────────────────────────────────────┤
│  TABLE OF CONTENTS (sticky sidebar on desktop)   │
├──────────────────────────────────────────────────┤
│  CONTENT (MDX rendered)                          │
│  - Max width 720px (reading comfort)             │
│  - Embedded charts, calculators, tables          │
│  - Inline affiliate links (underlined +          │
│    tiny "ad" marker for transparency)            │
├──────────────────────────────────────────────────┤
│  [CATEGORY-SPECIFIC DISCLAIMER]                  │
├──────────────────────────────────────────────────┤
│  AUTHOR BIO                                      │
│  "Written by... [credentials]"                   │
├──────────────────────────────────────────────────┤
│  RELATED POSTS                                   │
├──────────────────────────────────────────────────┤
│  SUBSCRIBE FORM (pre-checked: post's category)   │
├──────────────────────────────────────────────────┤
│  FOOTER                                          │
└──────────────────────────────────────────────────┘
```

---

## 7. Motion & Interaction

### 7.1 Allowed animations

| Animation | Purpose | Duration | Easing |
|-----------|---------|----------|--------|
| Price flash (green/red) | Signal price change | 300ms fade | ease-out |
| Skeleton shimmer | Loading state | 1.5s loop | linear |
| Modal fade + scale | Entry/exit | 200ms | ease-in-out |
| Button hover | Affordance | 150ms | ease |
| Toast slide-in | Notifications | 250ms | ease-out |
| Chart redraw | Data update | 400ms | ease-in-out |

### 7.2 Forbidden animations

- Parallax scrolling (slow, distracting, bad for focus)
- Auto-playing video/GIF anywhere near content
- Bounce/elastic easings (feels childish in finance)
- Animations longer than 500ms for UI feedback
- Rotating icons for loading (use skeleton)

### 7.3 Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Iconography

**Library:** `lucide-react` (consistent stroke width, 1,400+ icons)
**Default size:** 16×16 (inline), 20×20 (buttons), 24×24 (standalone)
**Stroke width:** 1.5 (default), 2 (emphasized)

**Semantic icon map:**
```ts
{
  price_up:      TrendingUp,
  price_down:    TrendingDown,
  price_flat:    Minus,
  alert:         Bell,
  verified:      BadgeCheck,
  loading:       Loader2,       // only if skeleton not appropriate
  error:         AlertCircle,
  success:       CheckCircle2,
  warning:       AlertTriangle,
  info:          Info,
  external:      ExternalLink,
  copy:          Copy,
  share:         Share2,
  search:        Search,
  menu:          Menu,
  close:         X,
  chevronDown:   ChevronDown,
  chevronRight:  ChevronRight,
  gold:          Gem,            // custom would be better
  silver:        Circle,
  crypto:        Bitcoin,
  stocks:        LineChart,
}
```

**Emoji usage rules:**
- Allowed: 🥇 🥈 🥉 ₿ 📈 in navigation, category labels (brand-friendly)
- Forbidden: Inside body text, inside serious financial data displays

---

## 9. Form Design Standards

### 9.1 Input states

```
Default:        border: var(--border-default), bg: var(--bg-interactive)
Hover:          border: var(--border-strong)
Focus:          border: var(--border-focus), ring: 2px var(--border-focus)/20
Disabled:       opacity: 0.5, cursor: not-allowed
Error:          border: var(--status-danger), message below
Success:        border: var(--status-success), checkmark right
```

### 9.2 Label position

- Label above input (never placeholder-as-label — bad accessibility)
- Required marker: `*` in red after label
- Helper text below input, small & muted
- Error text replaces helper text when active, same position

### 9.3 Button hierarchy

```
Primary:      bg: brand-primary, text: white       — 1 per section max
Secondary:    bg: bg-elevated, border: border-strong — supporting actions
Ghost:        transparent, hover: bg-elevated      — tertiary actions
Destructive:  bg: status-danger, text: white       — delete, unsubscribe
```

**Sizes:**
- `sm`: 32px tall, text-sm
- `md`: 40px tall, text-base (default)
- `lg`: 48px tall, text-lg — for primary CTAs

---

## 10. Content Tone & Voice

### 10.1 Voice attributes

- **Informed, not authoritative.** We share knowledge, not decrees.
- **Precise, not pedantic.** Numbers are exact. Claims are sourced. Hedges are honest.
- **Welcoming to beginners, respectful of experts.** Explain jargon, don't condescend.
- **Cautiously optimistic.** Markets have upside and downside. Never hype, never doom.

### 10.2 Copy rules

- Prices include currency: `$2,350.21 USD`, never just `2,350.21`
- Percentages include direction: `+0.53%` / `-0.53%`, not `0.53%`
- Time is relative in UI: "14 seconds ago" / "2 hours ago", absolute in metadata
- Never say "guaranteed returns", "risk-free", "sure thing"
- Always caveat predictions: "analysts suggest", "could", "may"

### 10.3 Error messages

Bad: "Invalid input"
Good: "Please enter a valid email address (e.g. you@example.com)"

Bad: "Something went wrong"
Good: "We couldn't submit your subscription. Please try again or contact support."

---

## 11. Accessibility Mandate

Every component must:

- Pass WCAG 2.1 AA automated tests (axe-core)
- Work with keyboard only (Tab, Enter, Space, Escape, arrow keys)
- Work with screen reader (tested with NVDA on Windows, VoiceOver on macOS/iOS)
- Support `prefers-reduced-motion` and `prefers-color-scheme`
- Maintain 4.5:1 contrast for body, 3:1 for UI elements
- Have visible focus indicators (never `outline: none` without replacement)
- Use semantic HTML: `<button>` for buttons, `<a>` for links, `<nav>`, `<main>`, `<article>`
- Include ARIA labels for icon-only buttons
- Announce dynamic changes (price updates) via `aria-live`

---

## 12. Design Token Export

Stored in `apps/web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Full token set from sections 2, 3, 4 above */
    --bg-canvas: 10 14 26;
    /* ... etc ... */
  }
}
```

Tailwind config references tokens:

```ts
// tailwind.config.ts
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        // ... etc
        'signal-up': 'rgb(var(--signal-up) / <alpha-value>)',
        'signal-down': 'rgb(var(--signal-down) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

---

**End of `04-DESIGN-SYSTEM.md`. Proceed to `05-CLAUDE-CODE-PROMPTS.md`.**
