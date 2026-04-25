# 📬 03 — Subscription System Specification

**Key Design Decision:** Single `subscribers` collection, categories stored as array, phone number optional in E.164 format (WhatsApp-ready from day one).

---

## 1. Why This Design

Your stated requirements translated into architecture:

| Requirement | Implementation |
|-------------|----------------|
| "Checkbox as an array in MongoDB" | `categories: string[]` field |
| "Maintains subscriber list separately" | Dedicated `subscribers` collection |
| "Optional Phone Number" | `phone: { number, country, verified } \| null` |
| "Broadcast message on WhatsApp later" | Phone stored E.164, `channels` tracks preference |
| "If not, only send emails" | Email is required, phone optional, channels array controls what you can send |

---

## 2. MongoDB Schema: `subscribers` Collection

```ts
// packages/shared/src/schemas.ts

import { z } from 'zod';

// E.164 phone number validation (+ country code, 10-15 digits)
const phoneRegex = /^\+[1-9]\d{1,14}$/;

export const CategoryEnum = z.enum([
  'gold',
  'silver',
  'copper',
  'crypto',
  'bitcoin',
  'ethereum',
  'stocks',
  'general',    // site-wide newsletter
]);

export const ChannelEnum = z.enum(['email', 'whatsapp', 'web-push']);

export const SubscriberSchema = z.object({
  _id: z.any().optional(),

  // Identity
  email: z.string().email().toLowerCase().trim(),
  phone: z.object({
    number: z.string().regex(phoneRegex),    // E.164: +923001234567
    country: z.string().length(2),           // ISO 3166 alpha-2: PK, US, UK
    verified: z.boolean().default(false),
    verifiedAt: z.date().optional(),
  }).nullable().default(null),

  // Preferences (the "checkbox array")
  categories: z.array(CategoryEnum).min(1).default(['general']),

  // Channel preferences (what they've consented to receive)
  channels: z.object({
    email: z.boolean().default(true),
    whatsapp: z.boolean().default(false),    // Auto-true when phone verified
    webPush: z.boolean().default(false),
  }),

  // Verification & consent
  emailVerified: z.boolean().default(false),
  verificationToken: z.string().nullable().default(null),
  verificationTokenExpiresAt: z.date().nullable().default(null),

  // GDPR / CCPA compliance
  consentedAt: z.date(),
  consentIpAddress: z.string().optional(),   // For audit trail
  consentSource: z.string(),                 // Page URL where they signed up
  consentMethod: z.enum(['form', 'import', 'api']).default('form'),
  unsubscribedAt: z.date().nullable().default(null),
  unsubscribeReason: z.string().nullable().default(null),

  // Engagement tracking
  emailsSent: z.number().default(0),
  emailsOpened: z.number().default(0),
  emailsClicked: z.number().default(0),
  whatsappsSent: z.number().default(0),
  lastEngagedAt: z.date().nullable().default(null),

  // Metadata
  source: z.string().optional(),             // Where they came from
  userAgent: z.string().optional(),
  geoCountry: z.string().optional(),
  tags: z.array(z.string()).default([]),     // Admin-added segmentation

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Subscriber = z.infer<typeof SubscriberSchema>;
```

### Indexes

```js
db.subscribers.createIndex({ email: 1 }, { unique: true });
db.subscribers.createIndex({ 'phone.number': 1 }, { sparse: true });
db.subscribers.createIndex({ categories: 1, emailVerified: 1 });
db.subscribers.createIndex({ 'channels.whatsapp': 1, 'phone.verified': 1 });
db.subscribers.createIndex({ unsubscribedAt: 1 });
db.subscribers.createIndex({ createdAt: -1 });
```

---

## 3. Supporting Collections

### 3.1 `broadcast_log` — every send is tracked

```ts
export const BroadcastLogSchema = z.object({
  _id: z.any().optional(),
  broadcastId: z.string(),                   // UUID for grouping
  channel: ChannelEnum,
  targetCategories: z.array(CategoryEnum),
  subject: z.string().optional(),            // email only
  body: z.string(),
  bodyHtml: z.string().optional(),

  // Segment snapshot (for reproducibility)
  targetCount: z.number(),
  deliveryStats: z.object({
    queued: z.number().default(0),
    sent: z.number().default(0),
    delivered: z.number().default(0),
    failed: z.number().default(0),
    opened: z.number().default(0),
    clicked: z.number().default(0),
    unsubscribed: z.number().default(0),
    bounced: z.number().default(0),
  }),

  // Audit
  createdBy: z.string(),                     // Admin user ID
  status: z.enum(['draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled']),
  scheduledFor: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### 3.2 `subscriber_events` — engagement timeline

```ts
export const SubscriberEventSchema = z.object({
  _id: z.any().optional(),
  subscriberId: z.any(),                     // Ref to subscriber
  broadcastId: z.string().optional(),
  event: z.enum([
    'subscribed', 'verified', 'unsubscribed',
    'email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_bounced',
    'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read',
    'preferences_updated', 'phone_verified',
  ]),
  metadata: z.record(z.any()).optional(),
  timestamp: z.date(),
});
```

**Indexes:**
```js
db.subscriber_events.createIndex({ subscriberId: 1, timestamp: -1 });
db.subscriber_events.createIndex({ broadcastId: 1, event: 1 });
```

---

## 4. Subscription Form UX

### 4.1 Fields (in order)

```tsx
<SubscribeForm>
  <EmailInput label="Email *" required />

  <PhoneInputOptional>
    {/* Accordion-style expansion to keep form clean */}
    <Toggle>+ Add phone for WhatsApp updates (optional)</Toggle>
    {expanded && (
      <>
        <CountryCodeSelect defaultValue="+92" />
        <PhoneNumberInput placeholder="3001234567" />
        <Helper>We'll only use this for WhatsApp broadcasts you opt into.</Helper>
      </>
    )}
  </PhoneInputOptional>

  <CategoryCheckboxes label="What interests you?" required>
    <Checkbox value="gold" icon="🥇" label="Gold" description="Daily rates & analysis" />
    <Checkbox value="silver" icon="🥈" label="Silver" description="Market insights" />
    <Checkbox value="copper" icon="🥉" label="Copper" description="Economic indicator" />
    <Checkbox value="crypto" icon="₿" label="Crypto" description="Bitcoin, Ethereum & more" />
    <Checkbox value="stocks" icon="📈" label="Stocks" description="Weekly market digest" />
    <Checkbox value="general" icon="📬" label="All Markets" description="Weekly roundup" />
  </CategoryCheckboxes>

  <ConsentCheckbox required>
    I agree to receive emails about the topics I selected. I can unsubscribe anytime.
  </ConsentCheckbox>

  <Button type="submit">Subscribe</Button>

  <p className="text-xs text-muted">
    We respect your privacy. Read our <a href="/privacy">privacy policy</a>.
  </p>
</SubscribeForm>
```

### 4.2 Contextual pre-selection

When the form appears on a category page (e.g. `/gold-price-today`), pre-check the matching category:

```tsx
<SubscribeForm defaultCategories={['gold']} source={pathname} />
```

---

## 5. API Endpoints

### 5.1 POST `/api/subscribe`

**Request:**
```json
{
  "email": "user@example.com",
  "phone": {
    "number": "+923001234567",
    "country": "PK"
  },
  "categories": ["gold", "crypto"],
  "channels": { "email": true, "whatsapp": true, "webPush": false },
  "source": "/gold-price-today",
  "consent": true
}
```

**Validation (Zod):**
```ts
export const SubscribeRequestSchema = z.object({
  email: z.string().email(),
  phone: z.object({
    number: z.string().regex(phoneRegex),
    country: z.string().length(2),
  }).optional(),
  categories: z.array(CategoryEnum).min(1),
  channels: z.object({
    email: z.boolean(),
    whatsapp: z.boolean(),
    webPush: z.boolean(),
  }),
  source: z.string().optional(),
  consent: z.literal(true),  // Must be explicitly true
});
```

**Flow:**
1. Validate payload
2. Rate limit check: 3 requests / IP / hour (via Redis)
3. Check existing subscriber by email
   - If exists & verified: update categories/phone, return 200
   - If exists & unverified: resend verification, return 200
   - If new: create doc with `emailVerified: false`, `verificationToken`
4. Send verification email via Resend
5. Return `{ success: true, message: "Check your inbox to verify" }`

**Response codes:**
- 200: Success
- 400: Validation error
- 429: Rate limited
- 500: Server error

### 5.2 GET `/api/verify?token=XXX`

**Flow:**
1. Look up subscriber by `verificationToken`
2. Check `verificationTokenExpiresAt` (24 hour window)
3. Set `emailVerified: true`, clear token
4. Log `verified` event
5. Redirect to `/subscribe/success`

### 5.3 POST `/api/subscribe/preferences` (magic link)

Subscriber clicks "Manage preferences" in an email:

**Email link:** `https://site.com/preferences?token=<signed-jwt>`

Page reads JWT, loads current preferences, shows form to update:
- Add/remove categories
- Update phone
- Unsubscribe from specific channels
- Full unsubscribe button

### 5.4 POST `/api/admin/broadcast` (admin only)

**Request:**
```json
{
  "channel": "email",
  "categories": ["gold"],
  "subject": "Gold breaks $2,400 — what's next?",
  "body": "...",
  "bodyHtml": "...",
  "scheduledFor": null
}
```

**Flow:**
1. Auth check (Clerk + admin role)
2. Query subscribers: `{ categories: { $in: [...] }, emailVerified: true, unsubscribedAt: null, 'channels.email': true }`
3. Create `broadcast_log` entry
4. Queue 100-sub batches to BullMQ
5. Worker processes via Resend API
6. Update `broadcast_log.deliveryStats` as webhooks fire

### 5.5 GET `/api/admin/subscribers` (admin only)

Paginated list with filters:
- `?category=gold`
- `?hasPhone=true`
- `?whatsappOptIn=true`
- `?verified=true`
- `?search=email...`

---

## 6. Email Templates

Use **React Email** (`@react-email/components`) for type-safe, previewable templates.

### 6.1 Verification email

```tsx
// emails/VerifyEmail.tsx
export default function VerifyEmail({ verifyUrl, categories }) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your subscription to get market updates</Preview>
      <Body>
        <Container>
          <Heading>One click to confirm</Heading>
          <Text>
            Thanks for subscribing! You'll receive updates about:{' '}
            <strong>{categories.join(', ')}</strong>.
          </Text>
          <Button href={verifyUrl}>Confirm my email</Button>
          <Text>Link expires in 24 hours.</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### 6.2 Welcome email (post-verification)

Include:
- What they'll receive
- Frequency expectations
- How to manage preferences (magic link)
- Quick links to top content in their categories

### 6.3 Unsubscribe mechanism

**Every email includes:**
- "Manage preferences" magic link (granular control)
- "Unsubscribe from all" one-click link

**One-click unsubscribe** is now required by Gmail & Yahoo for bulk senders (RFC 8058 `List-Unsubscribe: <mailto:...>, <https://...>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`).

---

## 7. WhatsApp-Ready Implementation (Phase 4)

Schema is ready from day 1. To activate:

### 7.1 Setup (when ready)

1. Apply for WhatsApp Business API via Meta Business Manager or BSP (e.g. Twilio, 360dialog).
2. Verify business + get phone number ID.
3. Submit message templates for approval (WhatsApp requires pre-approved templates for marketing).

### 7.2 Phone verification flow

When phone number is added:
1. Send WhatsApp OTP via Business API or Twilio Verify
2. User enters OTP → set `phone.verified: true`
3. Now eligible for WhatsApp broadcasts

### 7.3 Broadcast function

```ts
async function sendWhatsAppBroadcast(broadcastId: string, template: string, categories: string[]) {
  const db = await getMongo();
  const recipients = await db.collection('subscribers').find({
    categories: { $in: categories },
    'phone.verified': true,
    'channels.whatsapp': true,
    unsubscribedAt: null,
  }).toArray();

  for (const batch of chunk(recipients, 100)) {
    await queue.add('whatsapp-send', { broadcastId, template, batch });
  }
}
```

### 7.4 Compliance notes

- WhatsApp **does not allow marketing messages** outside 24-hour customer service window unless using an approved template.
- Opt-in must be explicit and provable (we store `consentedAt` + `channels.whatsapp`).
- Unsubscribe keywords (`STOP`, `UNSUBSCRIBE`) must be honored within 24 hours.

---

## 8. Admin Dashboard Pages

### `/admin/subscribers`
- Data table: email, phone (masked), categories, verified, joined date, last engaged
- Filters: category, channel, verified, active, search
- Actions: view detail, export CSV, send test, suspend

### `/admin/subscribers/[id]`
- Full profile + event timeline
- Manual preference edit
- Broadcast history for this user

### `/admin/broadcasts`
- List of past broadcasts with delivery stats
- "New broadcast" → compose form
- Preview before send
- Schedule for later

### `/admin/broadcasts/new`
- Channel selector: Email / WhatsApp / Both
- Category targeting (checkbox matching subscription preferences)
- Segment preview: "This will send to 3,842 subscribers"
- Template picker / rich text editor
- Test send to admin email
- Send / Schedule buttons

---

## 9. Anti-Abuse & Deliverability

### 9.1 Rate limits

| Endpoint | Limit |
|----------|-------|
| POST /api/subscribe | 3 / IP / hour, 100 / IP / day |
| GET /api/verify | 10 / token (prevent brute force) |
| POST /api/subscribe/preferences | 10 / subscriber / hour |

### 9.2 Email deliverability setup

**Before launch:**
- Set up SPF, DKIM, DMARC on your domain
- Warm up new IP gradually (Resend handles this on shared IPs)
- Use dedicated subdomain for sending: `mail.yoursite.com`
- Include physical postal address in every email (CAN-SPAM requirement)
- Keep bounce rate below 2%, complaint rate below 0.1%

### 9.3 Honeypot + reCAPTCHA on form

- Hidden honeypot field — bots fill it, we reject
- Add reCAPTCHA v3 (invisible) if spam becomes problematic
- Email blacklist for disposable providers (`mailinator.com`, etc.)

---

## 10. QA Checklist for Subscription System

- [ ] Form validates email format client-side AND server-side
- [ ] Phone field is optional — form submits without it
- [ ] Phone field validates E.164 format when provided
- [ ] At least 1 category required to submit
- [ ] Verification email sent within 30 seconds
- [ ] Verification link works, expires after 24h
- [ ] Duplicate signup updates existing subscriber, doesn't create dup
- [ ] Magic link preferences page works without login
- [ ] Unsubscribe works with one click + records timestamp
- [ ] Admin broadcast previews correct segment count
- [ ] Broadcast delivery stats update in real-time
- [ ] Phone number is stored in E.164 format
- [ ] Consent fields (`consentedAt`, `consentSource`, `consentIpAddress`) populated
- [ ] CAN-SPAM compliance: unsubscribe + physical address in every email
- [ ] GDPR compliance: data export + deletion request endpoints exist
- [ ] Rate limiting prevents brute subscribe attempts

---

**End of `03-SUBSCRIPTION-SYSTEM.md`. Proceed to `04-DESIGN-SYSTEM.md`.**
