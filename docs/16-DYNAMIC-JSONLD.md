# 🔍 16 — Dynamic JSON-LD Engine

**Goal:** Every page has purpose-built structured data. Editors can customize per-post without code changes. Auto-generates where editors don't override.

---

## 1. Coverage Matrix (Every Page Gets JSON-LD)

| Page type | Auto schemas | Editable in CMS |
|-----------|--------------|------------------|
| Landing `/` | Organization + WebSite + SearchAction | Admin only |
| Category price `/gold` | WebPage + Product (price) + BreadcrumbList + FAQPage | Admin only |
| Blog post `/blog/[slug]` | Article/BlogPosting + Author + BreadcrumbList | ✅ Per post |
| News post `/news/[slug]` | NewsArticle + Author + BreadcrumbList | ✅ Per post |
| About page | AboutPage + Organization | Admin only |
| Contact | ContactPage + Organization | Admin only |
| Calculator `/calculator/gold` | WebApplication + FAQPage | Admin only |
| Preview `/preview/*` | ❌ None (noindex) | n/a |

---

## 2. MongoDB: `jsonld_templates` Collection

Stores template definitions. When an editor creates a post, the appropriate template auto-populates its `jsonLd` array with interpolated data.

```ts
interface JsonLdTemplate {
  _id: ObjectId;
  key: string;                      // 'blog-article', 'news-article', 'product-price'
  name: string;                     // Human-readable
  description: string;
  scope: 'global' | 'post' | 'page';
  applicableTo: string[];           // ['blog', 'news'] or ['price', 'calculator']
  schemaType: string;               // 'Article', 'NewsArticle', 'Product', etc.
  template: Record<string, any>;    // JSON-LD with {{variables}}
  requiredVariables: string[];      // Must be present
  optionalVariables: string[];
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes
```js
db.jsonld_templates.createIndex({ key: 1 }, { unique: true });
db.jsonld_templates.createIndex({ scope: 1, isActive: 1 });
db.jsonld_templates.createIndex({ applicableTo: 1, isActive: 1 });
```

---

## 3. Seed Templates (Pre-loaded)

### 3.1 Blog Article (`key: 'blog-article'`)

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{{title}}",
  "alternativeHeadline": "{{seo.metaTitle}}",
  "description": "{{description}}",
  "image": {
    "@type": "ImageObject",
    "url": "{{coverImage}}",
    "width": 1200,
    "height": 630
  },
  "datePublished": "{{publishedAt}}",
  "dateModified": "{{updatedAt}}",
  "author": {
    "@type": "Person",
    "name": "{{authorName}}",
    "jobTitle": "{{authorCredentials}}",
    "url": "{{site.url}}/authors/{{authorSlug}}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{{site.name}}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{site.logo}}"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "{{site.url}}/blog/{{slug}}"
  },
  "keywords": "{{tags}}",
  "articleSection": "{{category}}",
  "wordCount": "{{wordCount}}",
  "timeRequired": "PT{{readTimeMinutes}}M"
}
```

### 3.2 News Article (`key: 'news-article'`)

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "{{title}}",
  "description": "{{description}}",
  "image": ["{{coverImage}}"],
  "datePublished": "{{publishedAt}}",
  "dateModified": "{{updatedAt}}",
  "dateline": "{{dateline}}",
  "author": {
    "@type": "Person",
    "name": "{{authorName}}"
  },
  "publisher": {
    "@type": "NewsMediaOrganization",
    "name": "{{site.name}}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{site.logo}}"
    }
  },
  "mainEntityOfPage": "{{site.url}}/news/{{slug}}",
  "articleSection": "{{category}}"
}
```

### 3.3 Product (Price page, `key: 'product-price'`)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{assetName}}",
  "description": "Current market price of {{assetName}}",
  "image": "{{site.url}}/assets/{{symbol}}.jpg",
  "offers": {
    "@type": "Offer",
    "price": "{{currentPrice}}",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "{{priceValidUntil}}",
    "url": "{{site.url}}/{{symbol}}-price-today"
  }
}
```

### 3.4 FAQPage (`key: 'faq-page'`)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": "{{faqItems}}"
}
```

Where `faqItems` is an array editors build in a UI:
```json
[
  {
    "@type": "Question",
    "name": "What is the gold price today?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "The gold price as of {{now}} is ${{currentPrice}} per ounce."
    }
  }
]
```

### 3.5 BreadcrumbList (`key: 'breadcrumbs'`)

Auto-generated from URL path, rarely edited:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "{{site.url}}" },
    { "@type": "ListItem", "position": 2, "name": "{{parentName}}", "item": "{{parentUrl}}" },
    { "@type": "ListItem", "position": 3, "name": "{{currentName}}", "item": "{{currentUrl}}" }
  ]
}
```

### 3.6 Organization (`key: 'organization'`, global)

Site-wide, injected on every page via layout:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{{site.name}}",
  "url": "{{site.url}}",
  "logo": "{{site.logo}}",
  "sameAs": [
    "{{site.social.twitter}}",
    "{{site.social.linkedin}}",
    "{{site.social.facebook}}"
  ]
}
```

### 3.7 WebSite with SearchAction (`key: 'website-search'`, landing page only)

Enables Google's site search box in results:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{{site.name}}",
  "url": "{{site.url}}",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "{{site.url}}/news?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

---

## 4. Variable Interpolation Engine

### 4.1 Variable syntax

- `{{variable}}` — simple substitution
- `{{object.nested}}` — dot notation
- `{{array[0]}}` — array indexing
- `{{site.*}}` — global site variables

### 4.2 Implementation

```ts
// apps/web/lib/jsonld/interpolate.ts
import get from 'lodash.get';

const VARIABLE_RE = /\{\{([\w.\[\]]+)\}\}/g;

export function interpolate<T>(template: T, context: Record<string, any>): T {
  if (typeof template === 'string') {
    return template.replace(VARIABLE_RE, (_, path) => {
      const value = get(context, path);
      if (value === undefined || value === null) return '';
      return String(value);
    }) as any;
  }

  if (Array.isArray(template)) {
    return template.map(item => interpolate(item, context)) as any;
  }

  if (template && typeof template === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = interpolate(value, context);
    }
    return result;
  }

  return template;
}
```

### 4.3 Context builder (what variables are available)

```ts
// apps/web/lib/jsonld/context.ts
export function buildContext(post: Post, site: SiteConfig) {
  return {
    // Post data
    title: post.title,
    description: post.description,
    slug: post.slug,
    category: post.category,
    tags: post.tags?.join(', '),
    coverImage: post.coverImage || site.defaultOgImage,
    authorName: post.authorName,
    authorCredentials: post.authorCredentials || '',
    authorSlug: slugify(post.authorName),
    publishedAt: post.publishedAt?.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    wordCount: post.wordCount,
    readTimeMinutes: post.readTimeMinutes,

    // SEO overrides
    seo: post.seo,

    // Site
    site: {
      name: site.name,
      url: site.url,
      logo: site.logoUrl,
      social: site.social,
    },

    // Dynamic (for price pages)
    currentPrice: post.currentPrice,
    priceValidUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    symbol: post.symbol,

    // Time
    now: new Date().toISOString(),
    currentYear: new Date().getFullYear(),
  };
}
```

---

## 5. Admin Editor UI

### 5.1 Per-post JSON-LD panel

```
┌──────────────────────────────────────────────────────────────┐
│  Structured Data (JSON-LD)                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Active schemas:                                             │
│                                                              │
│  ✅ Article (from blog-article template)       [Edit] [Off] │
│     Auto-generated from post fields                          │
│                                                              │
│  ✅ BreadcrumbList                              [Edit] [Off] │
│     Auto-generated from URL                                  │
│                                                              │
│  ✅ FAQPage (3 questions)                       [Edit] [×]   │
│     Custom, editor-added                                     │
│                                                              │
│  [ + Add schema ]                                            │
│    ├─ HowTo                                                  │
│    ├─ Review                                                 │
│    ├─ Product                                                │
│    ├─ VideoObject                                            │
│    └─ Custom...                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Validation: ✅ All schemas valid                            │
│  [Test with Google Rich Results] [Copy rendered JSON]        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Edit modal — dual mode

**Form mode** (non-technical users):

```
┌────────────────────────────────────────────────────────────┐
│  Edit: Article JSON-LD                                 [×] │
├────────────────────────────────────────────────────────────┤
│  Mode: [● Form] [○ JSON]                                  │
│                                                            │
│  Headline *    [Why Gold Is Surging in 2026         ]     │
│  Description * [Analysis of 2026 gold rally drivers ]     │
│                                                            │
│  Image URL     [{{coverImage}} — auto            ]        │
│                                                            │
│  Author        [Jane Doe                           ]       │
│  Credentials   [CFA, 10 years commodity analysis   ]       │
│                                                            │
│  Date Published [2026-04-22T08:00:00Z — auto       ]       │
│                                                            │
│  Keywords      [{{tags}} — auto from tags          ]       │
│                                                            │
│  [Show rendered] [Save] [Cancel]                           │
└────────────────────────────────────────────────────────────┘
```

**JSON mode** (advanced):

```
┌────────────────────────────────────────────────────────────┐
│  Edit: Article JSON-LD                                 [×] │
├────────────────────────────────────────────────────────────┤
│  Mode: [○ Form] [● JSON]                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ {                                                    │ │
│  │   "@context": "https://schema.org",                  │ │
│  │   "@type": "BlogPosting",                            │ │
│  │   "headline": "{{title}}",                           │ │
│  │   "description": "{{description}}",                  │ │
│  │   ... (syntax highlighted)                           │ │
│  │ }                                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Valid variables: {{title}}, {{description}}, {{slug}},    │
│  {{coverImage}}, {{authorName}}, {{publishedAt}},          │
│  {{updatedAt}}, {{site.name}}, {{site.url}}, ...           │
│                                                            │
│  [Format JSON] [Validate] [Save] [Cancel]                  │
└────────────────────────────────────────────────────────────┘
```

### 5.3 FAQ builder (specialized UI for FAQPage)

```
┌────────────────────────────────────────────────────────────┐
│  FAQ Questions                                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Q1: [What is the gold price today?                ]  [×] │
│  A1: [The current gold price is ${{currentPrice}}...] 📝  │
│                                                            │
│  Q2: [How is gold price determined?                ]  [×] │
│  A2: [Gold price is determined by supply and demand...] 📝│
│                                                            │
│  Q3: [What drives gold prices up?                  ]  [×] │
│  A3: [Inflation, geopolitical uncertainty...]          📝 │
│                                                            │
│  [ + Add question ]                                       │
│                                                            │
│  [Save] [Cancel]                                          │
└────────────────────────────────────────────────────────────┘
```

Each answer supports markdown (stored as plain text in JSON-LD after strip).

---

## 6. Validation Layer

Three levels of checks before save:

### 6.1 Syntactic (JSON validity)

```ts
function validateSyntax(jsonLdStr: string) {
  try {
    JSON.parse(jsonLdStr);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}
```

### 6.2 Semantic (schema.org type conformance)

Use `schema-dts` package (TypeScript definitions for all schema.org types):

```ts
import type { Article, NewsArticle, FAQPage } from 'schema-dts';

function validateStructure(data: any, expectedType: string) {
  if (data['@type'] !== expectedType) {
    return { valid: false, error: `Expected @type ${expectedType}, got ${data['@type']}` };
  }

  // Check required fields per type
  const required = REQUIRED_FIELDS[expectedType];
  for (const field of required) {
    if (!data[field]) {
      return { valid: false, error: `Required field missing: ${field}` };
    }
  }

  return { valid: true };
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  Article: ['headline', 'author', 'datePublished'],
  NewsArticle: ['headline', 'author', 'datePublished', 'dateModified'],
  FAQPage: ['mainEntity'],
  Product: ['name', 'offers'],
  BreadcrumbList: ['itemListElement'],
};
```

### 6.3 Google Rich Results API (optional, paid at volume)

```ts
async function testWithGoogle(jsonLd: any) {
  const response = await fetch(
    `https://searchconsole.googleapis.com/v1/urlTestingTools/richResults:run`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GOOGLE_API_KEY}` },
      body: JSON.stringify({ url: renderedPreviewUrl })
    }
  );

  return response.json();
}
```

Rate: ~100 requests/day free. Not called on every save — only on "Test with Google" button.

---

## 7. Rendering at Runtime

### 7.1 Per-page component

```tsx
// apps/web/components/seo/JsonLd.tsx
import Script from 'next/script';

type Props = {
  schemas: Array<{ type: string; data: any; enabled: boolean }>;
  context: Record<string, any>;
};

export function JsonLd({ schemas, context }: Props) {
  return (
    <>
      {schemas
        .filter(s => s.enabled)
        .map((s, i) => {
          const interpolated = interpolate(s.data, context);
          return (
            <Script
              key={`jsonld-${s.type}-${i}`}
              id={`jsonld-${s.type}-${i}`}
              type="application/ld+json"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(interpolated)
              }}
            />
          );
        })}
    </>
  );
}
```

### 7.2 In blog post page

```tsx
// apps/web/app/blog/[slug]/page.tsx
export default async function BlogPost({ params }) {
  const post = await getPost(params.slug);
  const site = getSiteConfig();
  const context = buildContext(post, site);

  return (
    <>
      <JsonLd schemas={post.jsonLd} context={context} />
      <article>{/* ... */}</article>
    </>
  );
}
```

### 7.3 Global schemas in root layout

```tsx
// apps/web/app/layout.tsx
import { getGlobalSchemas } from '@/lib/jsonld';

export default async function RootLayout({ children }) {
  const globalSchemas = await getGlobalSchemas();  // Organization, WebSite
  const siteContext = { site: getSiteConfig() };

  return (
    <html>
      <head>
        <JsonLd schemas={globalSchemas} context={siteContext} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## 8. Auto-Population on Post Creation

When author creates a new blog post, the system:

1. Loads post type template (e.g., `blog-article`)
2. Copies it to `post.jsonLd[0]`
3. Editor sees it pre-populated, can edit

```ts
// apps/web/app/api/admin/posts/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  // Fetch applicable templates
  const templates = await db.collection('jsonld_templates')
    .find({ applicableTo: body.type, scope: 'post', isActive: true })
    .toArray();

  const post = {
    ...body,
    status: 'draft',
    jsonLd: templates.map(t => ({
      type: t.schemaType,
      data: t.template,
      enabled: true,
      sourceTemplate: t.key,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('posts').insertOne(post);
  return Response.json({ success: true, data: post });
}
```

---

## 9. Smart Suggestions

If editor omits a commonly helpful schema, suggest it:

```ts
function suggestSchemas(post: Post): string[] {
  const suggestions: string[] = [];

  // Has "How to" in title → suggest HowTo
  if (/how to/i.test(post.title)) suggestions.push('HowTo');

  // Has tables with questions → suggest FAQPage
  if (/Q:|Question:|FAQ/i.test(post.content)) suggestions.push('FAQPage');

  // Review-like content → suggest Review
  if (/review|vs\.|compared|rating/i.test(post.title)) suggestions.push('Review');

  // Long-form with author → ensure Article present
  if (post.wordCount > 800 && !post.jsonLd.find(j => j.type === 'Article')) {
    suggestions.push('Article');
  }

  return suggestions;
}
```

Shown in editor sidebar:

```
💡 Suggestions
─────────────────────────────────
• Add FAQPage — your post has Q&A sections
• Add HowTo — your title suggests a tutorial
[ Apply suggestions ]
```

---

## 10. Variable Inspector

Dev/editor tool — click "View variables" to see what's available:

```
┌────────────────────────────────────────────────────────────┐
│  Available Variables                                 [×]   │
├────────────────────────────────────────────────────────────┤
│  {{title}}          → "Why Gold Is Surging in 2026"       │
│  {{description}}    → "Analysis of 2026 gold rally..."    │
│  {{slug}}           → "why-gold-surging-2026"             │
│  {{category}}       → "gold"                              │
│  {{tags}}           → "gold, inflation, markets"          │
│  {{coverImage}}     → "https://cdn.../gold.jpg"           │
│  {{authorName}}     → "Jane Doe"                          │
│  {{authorCredentials}} → "CFA, 10 years..."               │
│  {{publishedAt}}    → "2026-04-22T08:00:00Z"              │
│  {{updatedAt}}      → "2026-04-22T08:15:22Z"              │
│  {{wordCount}}      → 1240                                │
│  {{readTimeMinutes}} → 6                                   │
│  {{site.name}}      → "Commodity Intelligence"            │
│  {{site.url}}       → "https://yoursite.com"              │
│  ... (scroll for more)                                    │
└────────────────────────────────────────────────────────────┘
```

---

## 11. Testing & Validation Workflow

### 11.1 Editor workflow

1. Write post, add JSON-LD schemas
2. Click [Preview rendered JSON] → sees final output
3. Click [Test with Google] → opens Google's Rich Results Test in new tab with current URL
4. Fix any warnings shown
5. Submit for approval

### 11.2 Automated test

In CI, for every published post:

```ts
// scripts/validate-jsonld.ts
import { getMongo } from '../lib/mongo';

async function validateAllPublished() {
  const db = await getMongo();
  const posts = await db.collection('posts')
    .find({ status: 'published' })
    .toArray();

  const errors: any[] = [];
  for (const post of posts) {
    for (const schema of post.jsonLd) {
      const result = validateStructure(
        interpolate(schema.data, buildContext(post, SITE)),
        schema.type
      );
      if (!result.valid) {
        errors.push({ slug: post.slug, type: schema.type, error: result.error });
      }
    }
  }

  if (errors.length) {
    console.error('JSON-LD validation errors:', errors);
    process.exit(1);
  }
}
```

---

## 12. API Endpoints

```
GET    /api/admin/jsonld-templates         List templates
POST   /api/admin/jsonld-templates         Create template (admin only)
PATCH  /api/admin/jsonld-templates/:id     Update template
DELETE /api/admin/jsonld-templates/:id     Delete template

GET    /api/admin/posts/:id/jsonld         Get post's JSON-LD
POST   /api/admin/posts/:id/jsonld         Add schema to post
PATCH  /api/admin/posts/:id/jsonld/:idx    Update schema
DELETE /api/admin/posts/:id/jsonld/:idx    Remove schema

POST   /api/admin/jsonld/validate          Validate JSON-LD
POST   /api/admin/jsonld/preview           Preview interpolated output
```

---

## 13. QA Checklist for JSON-LD System

- [ ] Every published blog post has at least Article + BreadcrumbList
- [ ] Every news post has NewsArticle + BreadcrumbList
- [ ] Every price page has Product + FAQPage + BreadcrumbList
- [ ] Landing has Organization + WebSite with SearchAction
- [ ] Variable interpolation works for all {{vars}}
- [ ] No unescaped characters in rendered JSON (quotes, newlines)
- [ ] All schemas pass Google Rich Results Test
- [ ] All schemas validate on schema.org validator
- [ ] Editor form mode saves → data appears in JSON mode correctly
- [ ] JSON mode manual edits don't break form mode on reopen
- [ ] FAQPage builder adds/removes questions cleanly
- [ ] Template changes propagate to new posts (not retroactive)
- [ ] Disabled schemas (`enabled: false`) don't render
- [ ] Preview pages have NO JSON-LD (noindex)

---

**End of `16-DYNAMIC-JSONLD.md`. Proceed to `17-CLAUDE-AGENT-FILES.md`.**
