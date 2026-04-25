# ⚖️ 02 — Auto-Disclaimer System Specification

**Goal:** Zero manual disclaimer work. Every page, every post, always compliant.

---

## 1. Why Auto-Disclaimers Matter (Compliance Context)

Financial content falls under Google's **YMYL (Your Money, Your Life)** quality framework, which means:

1. **Google:** Sites without proper disclaimers get demoted in rankings.
2. **FTC (US):** Missing affiliate disclosures = up to $51,744 per violation.
3. **FCA (UK) / ASIC (Australia):** Financial promotion rules require risk warnings.
4. **SEC/FINRA:** Content resembling advice without proper framing invites scrutiny.
5. **AI Search (Google AI Overviews, ChatGPT, Perplexity):** Cite high-trust signals — disclaimers are trust signals.

**Manual disclaimer management is fragile.** Writers forget. Templates drift. One missed post = compliance gap.

**Our solution:** Disclaimers stored in MongoDB, auto-injected by a React Server Component based on route + category detection. The writer never touches disclaimer text.

---

## 2. Disclaimer Taxonomy (What goes where)

| Page Type | Disclaimer Type(s) | Position |
|-----------|---------------------|----------|
| Blog post (any category) | `educational` + `affiliate` + `category-specific` | Top banner + bottom full text |
| Price page (e.g. `/gold-price-today`) | `data-accuracy` + `no-advice` | Top banner + footer |
| Calculator page | `calculator-accuracy` + `no-advice` | Below calculator + footer |
| Homepage | `general` | Footer only |
| About/Contact | `general` | Footer only |
| Privacy/Terms | None | N/A |

---

## 3. MongoDB Schema: `disclaimers` Collection

```ts
// packages/shared/src/schemas.ts
import { z } from 'zod';

export const DisclaimerSchema = z.object({
  _id: z.any().optional(),
  key: z.string(),                    // Unique identifier
  version: z.number().default(1),
  category: z.enum([
    'general',
    'gold', 'silver', 'copper',
    'crypto', 'bitcoin', 'ethereum',
    'stocks',
    'educational',
    'affiliate',
    'data-accuracy',
    'calculator-accuracy',
    'no-advice',
  ]),
  locale: z.string().default('en-US'),  // Future i18n
  title: z.string(),
  bodyMarkdown: z.string(),             // Rendered via MDX
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  displayStyle: z.enum(['banner', 'box', 'footer-text', 'inline']).default('box'),
  isActive: z.boolean().default(true),
  effectiveFrom: z.date(),
  lastReviewedBy: z.string().optional(),
  lastReviewedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Disclaimer = z.infer<typeof DisclaimerSchema>;
```

**Indexes:**
```js
db.disclaimers.createIndex({ category: 1, locale: 1, isActive: 1 });
db.disclaimers.createIndex({ key: 1 }, { unique: true });
```

---

## 4. Seed Data: The Actual Disclaimer Text

⚠️ **LEGAL NOTICE:** These are industry-standard drafts based on common finance blog practices. **You MUST have a lawyer in your jurisdiction review before going live.** Laws vary by country (US/UK/EU/India/Pakistan/UAE all differ on financial disclaimers).

### 4.1 `general` — Site-wide footer

**Key:** `disc-general-v1`
**Display:** `footer-text`
**Severity:** `info`

```markdown
The information provided on this website is for general informational and educational purposes only. It does not constitute financial, investment, legal, or tax advice. Always consult a qualified professional before making any financial decision. We do not guarantee the accuracy, completeness, or timeliness of any information presented. Past performance does not indicate future results. All investments carry risk, including the possible loss of principal.
```

### 4.2 `educational` — Every blog post (top)

**Key:** `disc-educational-v1`
**Display:** `box`
**Severity:** `info`

```markdown
**For Educational Purposes Only**

This article is intended to inform and educate. It is not personalized financial advice. Markets are volatile and what worked for others may not work for you. Before acting on any information here, do your own research and speak with a licensed advisor who understands your individual situation.
```

### 4.3 `affiliate` — Every blog post with links (top)

**Key:** `disc-affiliate-v1`
**Display:** `banner`
**Severity:** `info`

```markdown
**Affiliate Disclosure:** This post contains affiliate links. If you click through and make a qualifying purchase or signup, we may earn a commission at no additional cost to you. Our editorial opinions are not influenced by these relationships — we only recommend products and services we believe offer genuine value. Read our full [Affiliate Disclosure](/affiliate-disclosure) for details.
```

### 4.4 `data-accuracy` — Every price page

**Key:** `disc-data-accuracy-v1`
**Display:** `banner`
**Severity:** `warning`

```markdown
**About This Price Data:** Prices update approximately every 60 seconds during active market hours and are sourced from commercial market data providers. While we strive for accuracy, prices may vary between exchanges, regions, and providers. Use these prices as a reference only — verify current rates with your broker or dealer before transacting. We are not liable for trading or purchasing decisions made based on this data.
```

### 4.5 `calculator-accuracy` — Calculator pages

**Key:** `disc-calculator-v1`
**Display:** `box`
**Severity:** `info`

```markdown
This calculator provides estimates based on current market prices and the inputs you provide. Actual buying or selling prices from dealers will differ due to premiums, spreads, commissions, taxes, and regional variations. Treat results as approximate guidance only, not as transaction prices.
```

### 4.6 `no-advice` — Price and calculator pages

**Key:** `disc-no-advice-v1`
**Display:** `footer-text`
**Severity:** `info`

```markdown
We are not registered investment advisors, brokers, or dealers. Nothing on this page constitutes a recommendation to buy, sell, or hold any asset. Markets can be volatile and losses can exceed initial investments in some instruments. Consult a licensed professional for advice tailored to your situation.
```

### 4.7 Category-specific — `gold`

**Key:** `disc-gold-v1`
**Display:** `box`
**Severity:** `info`

```markdown
**About Gold Investments:** Physical gold carries storage, insurance, and liquidity considerations. Gold ETFs, mining stocks, and gold IRAs each have distinct risk profiles. Gold prices are influenced by interest rates, currency movements, and global events, and can remain flat or decline for extended periods. Gold is often considered a long-term store of value rather than a short-term trade.
```

### 4.8 Category-specific — `silver`

**Key:** `disc-silver-v1`
**Display:** `box`
**Severity:** `info`

```markdown
**About Silver Investments:** Silver has both monetary and industrial demand, making it more volatile than gold. Physical silver carries higher storage costs per dollar of value due to its bulk. Silver prices can swing significantly on industrial cycles, and premiums over spot for coins and bars can be substantial.
```

### 4.9 Category-specific — `crypto`

**Key:** `disc-crypto-v1`
**Display:** `box`
**Severity:** `warning`

```markdown
**Cryptocurrency Risk Warning:** Cryptocurrencies are highly volatile, largely unregulated in many jurisdictions, and can lose significant value quickly. You could lose all of your investment. Cryptocurrencies may not be legal in your country — verify local regulations before participating. We do not recommend investing more than you can afford to lose entirely. This content is for education only and is not a solicitation to invest.
```

### 4.10 Category-specific — `stocks`

**Key:** `disc-stocks-v1`
**Display:** `box`
**Severity:** `info`

```markdown
**About Stock Investments:** Individual stocks carry higher risk than diversified funds. Past returns do not predict future performance. The stocks, companies, or sectors discussed here may not be suitable for your portfolio, risk tolerance, or time horizon. Taxes, commissions, and bid-ask spreads can significantly affect real-world returns.
```

### 4.11 Category-specific — `copper`

**Key:** `disc-copper-v1`
**Display:** `box`
**Severity:** `info`

```markdown
**About Copper Investments:** Copper is a cyclical industrial commodity. Its price closely tracks global economic activity, especially construction and manufacturing. Futures contracts carry leverage risks; copper-related ETFs, miners, and physical holdings each have different exposure profiles.
```

---

## 5. Disclaimer Engine: Core Logic

### 5.1 Category detection rules

```ts
// apps/web/lib/disclaimers.ts

export function detectCategory(pathname: string, frontmatter?: { category?: string; tags?: string[] }): string[] {
  const categories: string[] = [];

  // Rule 1: Explicit frontmatter category wins
  if (frontmatter?.category) categories.push(frontmatter.category);

  // Rule 2: URL path patterns
  if (/\/gold/.test(pathname))    categories.push('gold');
  if (/\/silver/.test(pathname))  categories.push('silver');
  if (/\/copper/.test(pathname))  categories.push('copper');
  if (/\/bitcoin|\/btc/.test(pathname))   categories.push('bitcoin', 'crypto');
  if (/\/ethereum|\/eth/.test(pathname))  categories.push('ethereum', 'crypto');
  if (/\/crypto/.test(pathname))  categories.push('crypto');
  if (/\/stocks?/.test(pathname)) categories.push('stocks');

  // Rule 3: Tags from blog frontmatter
  frontmatter?.tags?.forEach(t => {
    if (['gold','silver','copper','crypto','bitcoin','ethereum','stocks'].includes(t)) {
      categories.push(t);
    }
  });

  return [...new Set(categories)]; // dedupe
}

export function detectPageType(pathname: string): 'blog' | 'price' | 'calculator' | 'marketing' {
  if (/\/blog\//.test(pathname)) return 'blog';
  if (/-price-today|\/price/.test(pathname)) return 'price';
  if (/-calculator|\/calculator/.test(pathname)) return 'calculator';
  return 'marketing';
}

export function selectDisclaimers(pageType: string, categories: string[], hasAffiliateLinks: boolean): string[] {
  const keys: string[] = [];

  switch (pageType) {
    case 'blog':
      keys.push('disc-educational-v1');
      if (hasAffiliateLinks) keys.push('disc-affiliate-v1');
      break;
    case 'price':
      keys.push('disc-data-accuracy-v1', 'disc-no-advice-v1');
      break;
    case 'calculator':
      keys.push('disc-calculator-v1', 'disc-no-advice-v1');
      break;
    case 'marketing':
      keys.push('disc-general-v1');
      break;
  }

  // Add category-specific disclaimers
  categories.forEach(cat => {
    keys.push(`disc-${cat}-v1`);
  });

  return [...new Set(keys)];
}
```

### 5.2 React Server Component wrapper

```tsx
// apps/web/components/legal/LegalDisclaimer.tsx
import { getDisclaimers } from '@/lib/disclaimers';
import { cache } from 'react';

const getCachedDisclaimers = cache(async (keys: string[]) => {
  return getDisclaimers(keys); // Hits Redis first, Mongo fallback
});

type Props = {
  pathname: string;
  frontmatter?: { category?: string; tags?: string[] };
  hasAffiliateLinks?: boolean;
  position: 'top' | 'bottom' | 'footer';
};

export async function LegalDisclaimer({ pathname, frontmatter, hasAffiliateLinks, position }: Props) {
  const pageType = detectPageType(pathname);
  const categories = detectCategory(pathname, frontmatter);
  const keys = selectDisclaimers(pageType, categories, hasAffiliateLinks ?? false);
  const disclaimers = await getCachedDisclaimers(keys);

  // Filter by position intent
  const filtered = disclaimers.filter(d => {
    if (position === 'top') return d.displayStyle === 'banner' || d.displayStyle === 'box';
    if (position === 'bottom') return d.displayStyle === 'box';
    if (position === 'footer') return d.displayStyle === 'footer-text';
    return false;
  });

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-4 my-6" data-disclaimer-position={position}>
      {filtered.map(d => <DisclaimerCard key={d.key} disclaimer={d} />)}
    </div>
  );
}
```

### 5.3 Integration in pages

```tsx
// app/blog/[slug]/page.tsx (blog post)
export default async function BlogPost({ params }) {
  const post = await getPost(params.slug);

  return (
    <article>
      <h1>{post.title}</h1>

      {/* TOP: Educational + Affiliate + Category-specific */}
      <LegalDisclaimer
        pathname={`/blog/${params.slug}`}
        frontmatter={post.frontmatter}
        hasAffiliateLinks={post.hasAffiliateLinks}
        position="top"
      />

      <MDXContent source={post.content} />

      {/* BOTTOM: Reinforcement */}
      <LegalDisclaimer
        pathname={`/blog/${params.slug}`}
        frontmatter={post.frontmatter}
        hasAffiliateLinks={post.hasAffiliateLinks}
        position="bottom"
      />
    </article>
  );
}
```

```tsx
// app/[category]/page.tsx (price pages like /gold)
export default async function CategoryPage({ params }) {
  return (
    <main>
      <LivePriceCard symbol={params.category} />

      <LegalDisclaimer pathname={`/${params.category}`} position="top" />

      <PriceChart symbol={params.category} />

      <LegalDisclaimer pathname={`/${params.category}`} position="footer" />
    </main>
  );
}
```

### 5.4 Footer (global)

```tsx
// app/layout.tsx
<body>
  {children}
  <Footer>
    <LegalDisclaimer pathname="/" position="footer" />
  </Footer>
</body>
```

---

## 6. Affiliate Link Auto-Detection

To trigger the affiliate disclaimer automatically on posts that contain affiliate links:

```ts
// apps/web/lib/detect-affiliate-links.ts

const AFFILIATE_PATTERNS = [
  /tradingview\.com\/.*ref=/i,
  /coinbase\.com\/join/i,
  /binance\.com\/.*ref=/i,
  /birchgold\.com\/.*ref=/i,
  /flippa\.com\/.*ref=/i,
  /empireflippers\.com\/.*ref=/i,
  // Add your actual affiliate patterns here
];

export function detectAffiliateLinks(content: string): boolean {
  return AFFILIATE_PATTERNS.some(pattern => pattern.test(content));
}
```

This is called at build time on MDX content and result stored in post frontmatter automatically.

---

## 7. Admin UI for Disclaimer Management (Phase 2)

Route: `/admin/disclaimers` (protected by Clerk + role check)

Features:
- List all disclaimers with status, version, last reviewed date
- Edit disclaimer text with version increment
- Preview disclaimer in context (on any live page)
- Bulk "mark reviewed" with date stamp
- Change log showing who edited what and when

**Non-negotiable:** When a disclaimer is edited, the old version is NOT deleted — it's versioned. This provides audit trail for any future legal dispute.

---

## 8. Disclaimer Caching Strategy

```ts
// apps/web/lib/disclaimers.ts

import { redis } from './redis';
import { getMongo } from './mongo';

const CACHE_TTL = 3600; // 1 hour

export async function getDisclaimers(keys: string[]): Promise<Disclaimer[]> {
  const results: Disclaimer[] = [];
  const missing: string[] = [];

  // 1. Try Redis
  for (const key of keys) {
    const cached = await redis.get(`disclaimer:${key}`);
    if (cached) results.push(JSON.parse(cached as string));
    else missing.push(key);
  }

  // 2. Fetch missing from Mongo
  if (missing.length > 0) {
    const db = await getMongo();
    const docs = await db.collection('disclaimers')
      .find({ key: { $in: missing }, isActive: true })
      .toArray();

    // 3. Cache them
    await Promise.all(docs.map(doc =>
      redis.setex(`disclaimer:${doc.key}`, CACHE_TTL, JSON.stringify(doc))
    ));

    results.push(...docs);
  }

  return results;
}
```

**Cache invalidation:** When admin edits a disclaimer, API route calls `redis.del(disclaimer:<key>)` + `revalidateTag('disclaimers')`.

---

## 9. Seeding Script (run once on setup)

```ts
// apps/worker/src/seeds/disclaimers.ts
import { getMongo } from '../lib/mongo';
import { DISCLAIMER_SEEDS } from './disclaimer-seeds';

async function seed() {
  const db = await getMongo();
  for (const seed of DISCLAIMER_SEEDS) {
    await db.collection('disclaimers').updateOne(
      { key: seed.key },
      { $set: { ...seed, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`Seeded ${DISCLAIMER_SEEDS.length} disclaimers`);
}
seed().then(() => process.exit(0));
```

`DISCLAIMER_SEEDS` is the array from section 4 above.

---

## 10. QA Checklist for Disclaimer System

- [ ] Every blog post renders `educational` disclaimer at top
- [ ] Posts with affiliate links show `affiliate` banner
- [ ] Posts tagged `gold` show `disc-gold-v1` at bottom
- [ ] `/gold-price-today` shows `data-accuracy` banner
- [ ] `/gold-calculator` shows `calculator-accuracy` box
- [ ] Footer on every page shows `general` disclaimer
- [ ] Admin can edit disclaimer → cache invalidates → next page load shows new text within 60s
- [ ] Old disclaimer version is preserved in DB (audit trail)
- [ ] Disclaimer text is indexed by Google (server-rendered, not client-injected)
- [ ] Disclaimer boxes have proper ARIA roles for screen readers
- [ ] Mobile rendering: disclaimers are readable, not cramped

---

**End of `02-DISCLAIMER-SYSTEM.md`. Proceed to `03-SUBSCRIPTION-SYSTEM.md`.**
