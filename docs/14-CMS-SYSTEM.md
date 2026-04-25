# 📝 14 — CMS System (WordPress-Grade, Purpose-Built)

**Stack:** Next.js admin routes + MongoDB + Clerk (auth + roles) + Tiptap (markdown editor)
**Workflow:** Draft → Pending → Approved → Published (4 stages)
**Features:** Markdown with tables/images/links, per-post JSON-LD editor, meta preview, expiring preview URLs, role-based approval, category search

---

## 1. Why Build This (vs. WordPress)

You'd normally reach for WordPress — it's free and familiar. But for your stack:

| Concern | WordPress | Our CMS |
|---------|-----------|---------|
| Integration with Next.js | Complex (headless WP setup) | Native |
| Performance | Depends on plugins | Baseline fast |
| Security | Constant patching (#1 hacked CMS) | Surface limited to your code |
| Cost | $20–$100/mo (hosting + plugins) | Included in existing infra |
| Custom fields | Plugin (ACF) | Type-safe out of box |
| Speed to launch | 2–3 days setup | Already scoped here |

Since you have MongoDB, Clerk, and a Next.js app already running, **building a lean CMS is faster and more secure than bolting on WordPress**. This spec is the blueprint.

---

## 2. User Roles

| Role | Can Draft | Can Submit | Can Approve | Can Publish | Can Edit Published | Can Delete |
|------|-----------|------------|-------------|-------------|---------------------|------------|
| `viewer` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `author` | ✅ own | ✅ own | ❌ | ❌ | ✅ own (returns to Draft) | ✅ own drafts |
| `editor` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ + manage users |

**Key rule:** Authors can't approve their own posts. Always requires a separate editor/admin.

Roles stored in Clerk `publicMetadata.role` — server-checked on every action, never trusted from client.

---

## 3. Post Lifecycle (State Machine)

```
       ┌────────────┐   submit    ┌────────────┐   approve    ┌────────────┐   publish   ┌────────────┐
       │   DRAFT    │─────────────→│  PENDING   │─────────────→│  APPROVED  │─────────────→│ PUBLISHED  │
       └────────────┘              └────────────┘              └────────────┘              └────────────┘
            ↑                            │                          │                           │
            │  return for changes       │                          │                           │
            └────────────────────────────┘                          │                           │
            ↑                                                       │                           │
            │         reject                                        │                           │
            └───────────────────────────────────────────────────────┘                           │
            ↑                                                                                   │
            │  unpublish (rare, goes back to Approved)                                         │
            └───────────────────────────────────────────────────────────────────────────────────┘

Optional: APPROVED → SCHEDULED (with publishAt date) → PUBLISHED (by cron at publishAt)
```

### Allowed transitions per role

| From → To | Author | Editor | Admin |
|-----------|--------|--------|-------|
| Draft → Pending | ✅ (own) | ✅ | ✅ |
| Pending → Draft (return) | ❌ | ✅ | ✅ |
| Pending → Approved | ❌ | ✅ | ✅ |
| Approved → Published | ❌ | ✅ | ✅ |
| Approved → Draft (reject) | ❌ | ✅ | ✅ |
| Published → Archived | ❌ | ✅ | ✅ |
| Any → Deleted | Own drafts | ✅ | ✅ |

Every transition logged in `audit_log`.

---

## 4. MongoDB Schema: `posts` Collection

Replaces the `blogs` collection from doc 08 with a richer schema.

```ts
import { z } from 'zod';

export const PostStatusEnum = z.enum([
  'draft', 'pending', 'approved', 'scheduled', 'published', 'archived', 'deleted'
]);

export const PostSchema = z.object({
  _id: z.any().optional(),

  // Identity
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  title: z.string().min(5).max(200),
  description: z.string().min(50).max(500),       // Meta description
  excerpt: z.string().max(300).optional(),

  // Content (markdown — rendered via MDX pipeline)
  content: z.string(),                            // Full markdown
  contentHtml: z.string().optional(),             // Cached HTML (regenerated on save)
  coverImage: z.string().url().optional(),
  coverImageAlt: z.string().optional(),

  // Taxonomy
  category: z.enum([
    'gold', 'silver', 'copper', 'crypto', 'bitcoin', 'ethereum',
    'stocks', 'general', 'education', 'news'
  ]),
  tags: z.array(z.string()).max(10).default([]),

  // Authorship
  authorId: z.string(),                            // Clerk user ID
  authorName: z.string(),
  authorCredentials: z.string().optional(),       // E-E-A-T signals
  contributors: z.array(z.object({
    userId: z.string(),
    role: z.enum(['author', 'editor', 'reviewer']),
  })).default([]),

  // SEO & metadata (editor-controlled)
  seo: z.object({
    metaTitle: z.string().max(60).optional(),     // Override title for SEO
    metaDescription: z.string().max(160).optional(),
    canonicalUrl: z.string().url().optional(),
    noindex: z.boolean().default(false),
    ogImage: z.string().url().optional(),
    twitterCard: z.enum(['summary','summary_large_image']).default('summary_large_image'),
  }).default({}),

  // JSON-LD (PER-POST, editor-controlled — see section 7)
  jsonLd: z.array(z.object({
    type: z.enum([
      'Article', 'NewsArticle', 'BlogPosting', 'FAQPage',
      'HowTo', 'Review', 'Product', 'BreadcrumbList'
    ]),
    data: z.record(z.any()),                      // Actual JSON-LD payload
    enabled: z.boolean().default(true),
  })).default([]),

  // Workflow
  status: PostStatusEnum.default('draft'),
  submittedAt: z.date().optional(),
  approvedAt: z.date().optional(),
  approvedBy: z.string().optional(),
  publishedAt: z.date().optional(),
  publishedBy: z.string().optional(),
  scheduledFor: z.date().optional(),              // For 'scheduled' status
  rejectedAt: z.date().optional(),
  rejectionReason: z.string().optional(),
  archivedAt: z.date().optional(),

  // Versioning (keep last 10 revisions)
  version: z.number().default(1),
  revisions: z.array(z.object({
    version: z.number(),
    content: z.string(),
    title: z.string(),
    savedAt: z.date(),
    savedBy: z.string(),
    note: z.string().optional(),
  })).default([]).max(10),

  // Denormalized for fast queries
  readTimeMinutes: z.number().default(1),
  wordCount: z.number().default(0),
  hasAffiliateLinks: z.boolean().default(false),
  hasImages: z.boolean().default(false),
  hasTables: z.boolean().default(false),

  // Engagement
  viewCount: z.number().default(0),
  shareCount: z.number().default(0),
  featured: z.boolean().default(false),

  // Preview
  previewTokens: z.array(z.object({
    token: z.string(),
    createdBy: z.string(),
    createdAt: z.date(),
    expiresAt: z.date(),
    usedAt: z.date().optional(),
    singleUse: z.boolean().default(true),
  })).default([]),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Post = z.infer<typeof PostSchema>;
```

### Indexes

```js
db.posts.createIndex({ slug: 1 }, { unique: true });
db.posts.createIndex({ status: 1, publishedAt: -1 });
db.posts.createIndex({ category: 1, status: 1, publishedAt: -1 });
db.posts.createIndex({ tags: 1, status: 1, publishedAt: -1 });
db.posts.createIndex({ authorId: 1, status: 1, updatedAt: -1 });
db.posts.createIndex({ scheduledFor: 1, status: 1 });
db.posts.createIndex({ "previewTokens.token": 1 });
db.posts.createIndex({ featured: 1, publishedAt: -1 });

// Full-text search
db.posts.createIndex(
  { title: 'text', description: 'text', content: 'text', tags: 'text' },
  { weights: { title: 10, description: 5, tags: 3, content: 1 }, name: 'post_search' }
);
```

---

## 5. Markdown Editor (Tiptap)

**Why Tiptap:** WordPress-level editing experience, headless (fully customizable UI), ProseMirror-based (handles complex content reliably), extensible via plugins.

### 5.1 Required extensions

```ts
// apps/web/components/admin/Editor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';  // Markdown I/O
```

### 5.2 Toolbar features

- **Text formatting:** Bold, Italic, Strikethrough, Code, Underline
- **Headings:** H1, H2, H3, H4
- **Lists:** Bullet, Numbered, Task (checkboxes)
- **Links:** Insert/edit URL with validation
- **Images:** Upload (to Vercel Blob or S3) or insert by URL + alt text required
- **Tables:** Insert, add/remove rows/cols, merge cells, header toggle
- **Blockquote & code block** (with syntax highlight via lowlight)
- **Horizontal rule**
- **Markdown view toggle** (raw edit for power users)
- **Word count + read time** (live)

### 5.3 Slash commands (like Notion)

Type `/` to get a menu: `/heading1`, `/table`, `/image`, `/callout`, `/disclaimer-embed`

### 5.4 Auto-save

Every 10 seconds, save to `draft` status with `savedAt` timestamp. Never lose work.

### 5.5 Image handling

```
┌────────────────────────────────────────────────────┐
│  Upload image:                                     │
│  [ Drop file or click to browse ]                  │
│                                                    │
│  Alt text (REQUIRED): [                         ]  │  ← Accessibility
│  Caption (optional):  [                         ]  │
│                                                    │
│  [ Upload & Insert ]                              │
└────────────────────────────────────────────────────┘
```

Upload endpoint: `POST /api/admin/media/upload` → Vercel Blob (or S3) → returns CDN URL + inserts.

File constraints:
- Max size: 5 MB
- Types: JPEG, PNG, WebP, GIF
- Auto-convert to WebP for optimization
- Store original + generate responsive variants (400w, 800w, 1200w, 1600w)

---

## 6. Live Previews (3 Modes)

### 6.1 In-editor preview tab

Split view in the editor:

```
┌─────────────────────┬─────────────────────┐
│  Markdown Editor    │  Live Preview       │
│                     │  (rendered)         │
│                     │                     │
└─────────────────────┴─────────────────────┘
```

Toggles: [Editor only] [Split] [Preview only]

Previews with:
- ✅ Post styling (same CSS as published view)
- ✅ Auto-disclaimers (uses live disclaimer engine)
- ✅ Images
- ✅ Tables
- ❌ Live price widgets (shows placeholder)
- ❌ AdSense (shows placeholder)

### 6.2 Expiring preview URLs (WordPress-style "Preview" button)

Clicking [Preview] generates a public URL an editor can share with non-logged-in stakeholders.

```
POST /api/admin/posts/:id/preview-token
Body: { expiresInMinutes: 60, singleUse: true }

Response:
{
  "token": "prv_aB7xYz...",
  "url": "https://yoursite.com/preview/prv_aB7xYz",
  "expiresAt": "2026-04-22T09:23:00Z"
}
```

### 6.3 Preview page: `/preview/[token]`

```ts
// apps/web/app/preview/[token]/page.tsx
import { getMongo } from '@/lib/mongo';
import { redirect } from 'next/navigation';

export default async function PreviewPage({ params }) {
  const db = await getMongo();
  const post = await db.collection('posts').findOne({
    'previewTokens.token': params.token,
  });

  if (!post) redirect('/preview/expired');

  const tokenObj = post.previewTokens.find(t => t.token === params.token);
  if (!tokenObj) redirect('/preview/expired');
  if (tokenObj.expiresAt < new Date()) redirect('/preview/expired');
  if (tokenObj.singleUse && tokenObj.usedAt) redirect('/preview/expired');

  // Mark as used (if single-use)
  if (tokenObj.singleUse) {
    await db.collection('posts').updateOne(
      { _id: post._id, 'previewTokens.token': params.token },
      { $set: { 'previewTokens.$.usedAt': new Date() } }
    );
  }

  return <BlogPostView post={post} isPreview={true} />;
}

// Disable SEO indexing for previews
export const metadata = {
  robots: { index: false, follow: false },
};
```

### 6.4 Preview expiry options

| Option | Duration | Use case |
|--------|----------|----------|
| 15 min | Quick review | Editor checking a fix |
| 1 hour | Standard review | Client approval |
| 24 hours | External review | Legal review, external stakeholder |
| 7 days | Extended review | Guest author collaboration |

**Security:** Tokens are 32-char cryptographically random (nanoid), single-use by default, logged on access.

---

## 7. Dynamic JSON-LD Editor (Per Post)

The requirement: every page/post has its own JSON-LD, editable without code changes.

### 7.1 JSON-LD templates by post type

When an editor creates a post, JSON-LD is auto-generated from sensible defaults, then fully editable.

**Article template:**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{title}}",
  "description": "{{description}}",
  "image": ["{{coverImage}}"],
  "datePublished": "{{publishedAt}}",
  "dateModified": "{{updatedAt}}",
  "author": {
    "@type": "Person",
    "name": "{{authorName}}",
    "jobTitle": "{{authorCredentials}}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Commodity Intelligence Platform",
    "logo": {
      "@type": "ImageObject",
      "url": "https://yoursite.com/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://yoursite.com/blog/{{slug}}"
  }
}
```

**NewsArticle template:** (for /news posts)
```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "{{title}}",
  "datePublished": "{{publishedAt}}",
  "dateline": "{{dateline}}",
  "author": { ... },
  "articleSection": "{{category}}"
}
```

**FAQPage template:** (for posts with Q&A)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text"
      }
    }
  ]
}
```

**HowTo template:** (for guide posts)
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "{{title}}",
  "step": [
    { "@type": "HowToStep", "name": "Step 1", "text": "..." }
  ]
}
```

### 7.2 Editor UI

```
┌──────────────────────────────────────────────────────────────┐
│  JSON-LD Structured Data                                     │
├──────────────────────────────────────────────────────────────┤
│  Active schemas:                                             │
│                                                              │
│  ▼ Article (auto-generated, editable)         [Edit] [×]    │
│  ▼ FAQPage (3 questions)                       [Edit] [×]    │
│                                                              │
│  [ + Add schema ▾]                                           │
│    ├─ NewsArticle                                            │
│    ├─ Review                                                 │
│    ├─ HowTo                                                  │
│    ├─ Product                                                │
│    └─ Custom (advanced)                                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ✓ All schemas valid                                         │
│  [Validate with Google] [Preview in Rich Results Test]       │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Edit modal per schema

```
┌─────────────────────────────────────────────────────────────┐
│  Edit: Article JSON-LD                                [×]   │
├─────────────────────────────────────────────────────────────┤
│  Mode: [Form ● ] [JSON ○ ]                                 │
│                                                             │
│  Headline:       [Why Gold Is Surging in 2026         ]    │
│  Description:    [Analysis of 2026 gold rally drivers ]    │
│  Image URL:      [https://yoursite.com/images/gold.jpg]    │
│  Date published: [2026-04-22T08:00:00Z            📅]      │
│  Author name:    [Jane Doe                          ]      │
│  Author cred:    [CFA, 10 years commodity analysis  ]      │
│                                                             │
│  [Preview rendered JSON-LD]                                 │
│  [Save] [Cancel]                                            │
└─────────────────────────────────────────────────────────────┘
```

Form mode for non-technical users. JSON mode for editors who want direct control.

### 7.4 Validation

Before save, every JSON-LD block is:
1. Parsed (valid JSON)
2. Checked against schema.org types via `schema-dts` library
3. Submitted to Google's Rich Results Test API (optional, 100/day free)
4. Flagged if structured warnings (e.g., "missing publisher")

### 7.5 Rendering at runtime

```tsx
// apps/web/app/blog/[slug]/page.tsx
export default async function BlogPost({ params }) {
  const post = await getPost(params.slug);

  return (
    <>
      {post.jsonLd.filter(j => j.enabled).map((j, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(interpolateVariables(j.data, post))
          }}
        />
      ))}
      <BlogContent post={post} />
    </>
  );
}
```

Variables like `{{title}}` get substituted at render time so editors don't manually copy values.

---

## 8. Meta Preview

A "Preview as shared link" modal that shows the post as it would appear when shared to Google, Facebook, Twitter, LinkedIn, WhatsApp.

```
┌─────────────────────────────────────────────────────────────┐
│  Share Preview                                         [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 Google search result:                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ yoursite.com › blog › why-gold-2026                 │   │
│  │ Why Gold Is Surging in 2026                         │   │
│  │ Analysis of 2026 gold rally drivers and what...     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📘 Facebook / LinkedIn:                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Large OG image]                                     │   │
│  │                                                      │   │
│  │ WHY GOLD IS SURGING IN 2026                          │   │
│  │ Analysis of 2026 gold rally drivers...              │   │
│  │ yoursite.com                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🐦 Twitter/X:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [OG image (summary_large_image)]                    │   │
│  │ Why Gold Is Surging in 2026                         │   │
│  │ Analysis of 2026 gold rally drivers...              │   │
│  │ yoursite.com                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💬 WhatsApp:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Thumb] Why Gold Is Surging in 2026                 │   │
│  │        Analysis of 2026 gold rally drivers...       │   │
│  │        yoursite.com                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠ Meta description too long (175/160). Will truncate.     │
│                                                             │
│  [Edit meta] [Close]                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Category Search on News Posts

**Front-end search UX:**

```
┌─────────────────────────────────────────────────────────────┐
│  📰 News                                                    │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Search news...] [Gold ●] [Silver ○] [Crypto ○]         │
│  Date range: [All time ▾]    Sort: [Newest ▾]               │
├─────────────────────────────────────────────────────────────┤
│  Results (42)                                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [img] Gold Hits New High as Fed Pauses Rate Cuts     │  │
│  │       GOLD · 2 hours ago · 5 min read                │  │
│  │       Highlight: Gold futures climbed 1.8%...        │  │
│  └───────────────────────────────────────────────────────┘  │
│  ...                                                        │
│                                                             │
│  [Load more]                                                │
└─────────────────────────────────────────────────────────────┘
```

### 9.1 API: `GET /api/news/search`

Query params:
- `q`: search term
- `category`: filter
- `from`, `to`: date range
- `sort`: `newest` | `oldest` | `most-read`
- `page`, `limit`

### 9.2 MongoDB query

```ts
const pipeline = [];

if (q) {
  pipeline.push({
    $match: { $text: { $search: q }, status: 'published' }
  });
  pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
}

if (category) pipeline.push({ $match: { category } });
if (from || to) {
  pipeline.push({
    $match: {
      publishedAt: {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) }),
      }
    }
  });
}

pipeline.push({
  $sort: sort === 'most-read' ? { viewCount: -1 }
       : sort === 'oldest' ? { publishedAt: 1 }
       : q ? { score: { $meta: 'textScore' } }
       : { publishedAt: -1 }
});

pipeline.push({ $skip: (page - 1) * limit });
pipeline.push({ $limit: limit });

// Exclude full content from response (too large)
pipeline.push({
  $project: { content: 0, revisions: 0, previewTokens: 0 }
});
```

### 9.3 Frontend

```tsx
// app/news/page.tsx
import { SearchBar } from '@/components/news/SearchBar';
import { NewsList } from '@/components/news/NewsList';
import { CategoryTabs } from '@/components/news/CategoryTabs';

export default function NewsPage({ searchParams }) {
  return (
    <div>
      <SearchBar defaultQuery={searchParams.q} />
      <CategoryTabs active={searchParams.category} />
      <NewsList
        query={searchParams.q}
        category={searchParams.category}
        page={searchParams.page ?? 1}
      />
    </div>
  );
}
```

### 9.4 At scale: Meilisearch/Typesense

MongoDB text search handles ~100K posts fine. Beyond that, add Meilisearch (self-hosted, <$5/mo for small instance):
- Instant autocomplete
- Typo tolerance
- Facets (category, tag, date)
- 5ms response time

Worker syncs MongoDB posts → Meilisearch on publish.

---

## 10. Admin UI Routes

```
/admin                           # Dashboard with stats
/admin/posts                     # List all (with status filters)
/admin/posts/new                 # Create
/admin/posts/[id]/edit           # Edit
/admin/posts/[id]/preview        # In-admin preview
/admin/posts/[id]/revisions      # Version history
/admin/posts/approvals           # Pending approval queue
/admin/posts/scheduled           # Scheduled posts
/admin/media                     # Image library
/admin/categories                # Manage categories
/admin/subscribers               # (from doc 03)
/admin/broadcasts                # (from doc 03)
/admin/disclaimers               # (from doc 02)
/admin/logs                      # (from doc 11)
/admin/security                  # (from doc 13)
/admin/users                     # Manage team (admins only)
/admin/settings                  # Site settings
```

### 10.1 Approval queue page

```
┌─────────────────────────────────────────────────────────────┐
│  Pending Approvals (3)                                       │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Why Gold Is Surging in 2026                          │  │
│  │ Jane Doe · Submitted 2h ago · gold · 1,240 words     │  │
│  │ [Preview] [Approve] [Return to Author] [Reject]      │  │
│  └───────────────────────────────────────────────────────┘  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

Each action requires a note for audit trail.

---

## 11. API Endpoints (CMS-specific)

```
POST   /api/admin/posts                      Create draft
GET    /api/admin/posts                      List (filtered)
GET    /api/admin/posts/:id                  Get one
PATCH  /api/admin/posts/:id                  Update
DELETE /api/admin/posts/:id                  Soft delete
POST   /api/admin/posts/:id/submit           Draft → Pending
POST   /api/admin/posts/:id/approve          Pending → Approved
POST   /api/admin/posts/:id/reject           Pending → Draft + reason
POST   /api/admin/posts/:id/publish          Approved → Published
POST   /api/admin/posts/:id/unpublish        Published → Approved
POST   /api/admin/posts/:id/schedule         Approved → Scheduled
POST   /api/admin/posts/:id/archive          Published → Archived
GET    /api/admin/posts/:id/revisions        List revisions
POST   /api/admin/posts/:id/restore/:ver     Restore revision

POST   /api/admin/posts/:id/preview-token    Generate preview URL
DELETE /api/admin/posts/:id/preview-token/:t Revoke token

POST   /api/admin/posts/:id/jsonld           Add JSON-LD block
PATCH  /api/admin/posts/:id/jsonld/:index    Update JSON-LD
DELETE /api/admin/posts/:id/jsonld/:index    Delete JSON-LD

POST   /api/admin/media/upload               Upload image
GET    /api/admin/media                      List media
DELETE /api/admin/media/:id                  Delete media

GET    /api/news/search                      Public: search posts
GET    /api/news/categories                  Public: category list
```

Full request/response contracts follow the pattern in doc 09.

---

## 12. Scheduled Publishing (Cron)

Worker job runs every minute:

```ts
// apps/worker/src/jobs/publish-scheduled.ts
async function publishScheduled() {
  const db = await getMongo();
  const now = new Date();

  const due = await db.collection('posts').find({
    status: 'scheduled',
    scheduledFor: { $lte: now }
  }).toArray();

  for (const post of due) {
    await db.collection('posts').updateOne(
      { _id: post._id },
      {
        $set: {
          status: 'published',
          publishedAt: now,
          publishedBy: 'system:scheduler',
          updatedAt: now,
        }
      }
    );

    // Trigger revalidation
    await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/revalidate`, {
      method: 'POST',
      body: JSON.stringify({ tag: `blog-${post.slug}`, secret: env.REVALIDATE_SECRET })
    });

    logger.info({
      context: { postId: post._id.toString(), slug: post.slug }
    }, 'Post auto-published on schedule');
  }
}
```

---

## 13. QA Checklist for CMS

- [ ] Authors can't approve their own posts
- [ ] Role permissions enforced server-side (try API calls from browser console)
- [ ] Post state machine rejects invalid transitions
- [ ] Tiptap editor saves markdown cleanly (round-trip preserves formatting)
- [ ] Images upload, convert to WebP, generate responsive sizes
- [ ] Alt text required for all images
- [ ] Tables render correctly in editor and published view
- [ ] Preview tokens expire at stated time
- [ ] Preview tokens with `singleUse: true` work only once
- [ ] Preview page has `noindex,nofollow`
- [ ] JSON-LD editor produces valid schema.org (run through Google Rich Results Test)
- [ ] JSON-LD variable interpolation works at runtime
- [ ] Meta preview shows accurate Google/FB/Twitter/WhatsApp renderings
- [ ] Scheduled posts publish within 60 seconds of `scheduledFor`
- [ ] Search finds posts by title, tags, content
- [ ] Category filters combine with search
- [ ] Every state transition logged in audit_log
- [ ] Revision history preserved (last 10)

---

**End of `14-CMS-SYSTEM.md`. Proceed to `15-MFA-AUTHENTICATION.md`.**
