# 🔌 09 — API Contracts (REST Endpoint Reference)

**Purpose:** Every endpoint, fully specified. Claude Code reads this → writes consistent code.

**Base URL:** `https://yoursite.com`
**Content-Type:** `application/json` (all requests/responses)
**Auth:** Most endpoints public; admin endpoints require Clerk session cookie + role check.

---

## Endpoint Index

### Public
- `GET  /api/price/[symbol]` — Current price
- `GET  /api/candles/[symbol]` — Historical candles
- `GET  /api/price/[symbol]/rates` — Multi-currency conversion
- `POST /api/subscribe` — Create or update subscription
- `GET  /api/verify` — Verify email token
- `POST /api/preferences` — Update preferences via magic link
- `POST /api/unsubscribe` — Unsubscribe via magic link

### Internal (worker → web)
- `POST /api/revalidate` — Trigger ISR revalidation
- `POST /api/cron/*` — Vercel cron endpoints (if any)

### Admin (Clerk auth + role)
- `GET    /api/admin/subscribers` — List subscribers
- `GET    /api/admin/subscribers/[id]` — Subscriber detail
- `PATCH  /api/admin/subscribers/[id]` — Update subscriber
- `DELETE /api/admin/subscribers/[id]` — Soft delete (GDPR)
- `POST   /api/admin/broadcast` — Send broadcast
- `GET    /api/admin/broadcasts` — List broadcasts
- `GET    /api/admin/broadcasts/[id]` — Broadcast detail + stats
- `GET    /api/admin/disclaimers` — List disclaimers
- `POST   /api/admin/disclaimers` — Create disclaimer
- `PATCH  /api/admin/disclaimers/[id]` — Update disclaimer
- `POST   /api/admin/segment-preview` — Preview broadcast audience count

---

## Standard Response Envelope

### Success

```json
{
  "success": true,
  "data": { /* endpoint-specific */ }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ /* optional Zod issues */ ]
  }
}
```

### Standard error codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `UNAUTHORIZED` | 401 | Missing auth |
| `FORBIDDEN` | 403 | Auth present but insufficient |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | State conflict (e.g., duplicate) |
| `RATE_LIMITED` | 429 | Exceeded rate limit |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | External dependency down |

---

## 1. GET `/api/price/[symbol]`

Returns current price for a single asset.

**Runtime:** Edge
**Cache:** Redis 30s + CDN 30s SWR 5min
**Rate limit:** 120/min/IP

### Path params

| Name | Type | Validation |
|------|------|------------|
| symbol | string | One of: `gold`, `silver`, `copper`, `bitcoin`, `ethereum` |

### Response 200

```json
{
  "success": true,
  "data": {
    "symbol": "gold",
    "price": 2350.21,
    "currency": "USD",
    "change24h": 12.40,
    "changePercent24h": 0.53,
    "high24h": 2358.40,
    "low24h": 2337.80,
    "source": "metalpriceapi",
    "sourceTimestamp": "2026-04-22T08:23:12Z",
    "isStale": false
  }
}
```

### Response 404

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Symbol not tracked"
  }
}
```

### Response 429

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Retry in 60 seconds."
  }
}
```

Headers: `Retry-After: 60`

---

## 2. GET `/api/candles/[symbol]`

Historical OHLC candles for charting.

**Runtime:** Edge
**Cache:** Redis + CDN (TTL varies by range)
**Rate limit:** 60/min/IP

### Query params

| Name | Type | Default | Validation |
|------|------|---------|------------|
| range | string | `1D` | `1D` \| `7D` \| `1M` \| `3M` \| `1Y` \| `5Y` |

### Response 200

```json
{
  "success": true,
  "data": {
    "symbol": "gold",
    "range": "1D",
    "interval": "1m",
    "candles": [
      { "t": "2026-04-22T08:00:00Z", "o": 2348.12, "h": 2350.45, "l": 2347.80, "c": 2350.21 },
      { "t": "2026-04-22T08:01:00Z", "o": 2350.21, "h": 2351.00, "l": 2349.50, "c": 2350.90 }
    ]
  }
}
```

**Note:** Field names shortened (`t`, `o`, `h`, `l`, `c`) to reduce payload on mobile.

### Caching policy

| Range | Cache TTL | CDN SWR |
|-------|-----------|---------|
| 1D    | 60s       | 120s    |
| 7D    | 5min      | 10min   |
| 1M    | 15min     | 30min   |
| 3M    | 1h        | 2h      |
| 1Y    | 6h        | 12h     |
| 5Y    | 24h       | 48h     |

---

## 3. GET `/api/price/[symbol]/rates`

Multi-currency and multi-unit conversion for a price.

**Rate limit:** 60/min/IP

### Query params

| Name | Type | Default | Validation |
|------|------|---------|------------|
| currencies | csv | `USD,PKR,INR,AED,GBP` | Max 10 |

### Response 200

```json
{
  "success": true,
  "data": {
    "symbol": "gold",
    "basePrice": 2350.21,
    "baseCurrency": "USD",
    "baseUnit": "troy-ounce",
    "rates": {
      "USD": { "perOunce": 2350.21, "perGram": 75.56, "perTola": 881.33 },
      "PKR": { "perOunce": 655811, "perGram": 21087, "perTola": 245876 },
      "INR": { "perOunce": 195543, "perGram": 6287, "perTola": 73320 }
    },
    "fxRatesUpdated": "2026-04-22T08:00:00Z",
    "pricesUpdated": "2026-04-22T08:23:12Z"
  }
}
```

---

## 4. POST `/api/subscribe`

Create new subscriber or update existing.

**Runtime:** Node (needs full libphonenumber-js)
**Rate limit:** 3/hour/IP, 100/day/IP

### Request body

```json
{
  "email": "user@example.com",
  "phone": {
    "number": "+923001234567",
    "country": "PK"
  },
  "categories": ["gold", "crypto"],
  "channels": {
    "email": true,
    "whatsapp": true,
    "webPush": false
  },
  "source": "/gold-price-today",
  "consent": true,
  "website": ""
}
```

**Notes:**
- `phone` is optional
- `categories` must have ≥ 1 item
- `consent` must be `true` literal
- `website` is a honeypot — if non-empty, silently accept but do nothing

### Validation schema

```ts
const SubscribeRequestSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  phone: z.object({
    number: z.string().regex(/^\+[1-9]\d{1,14}$/),
    country: z.string().length(2).toUpperCase(),
  }).optional(),
  categories: z.array(z.enum([
    'gold','silver','copper','crypto','bitcoin','ethereum','stocks','general'
  ])).min(1),
  channels: z.object({
    email: z.boolean(),
    whatsapp: z.boolean(),
    webPush: z.boolean(),
  }),
  source: z.string().optional(),
  consent: z.literal(true),
  website: z.string().optional(),  // Honeypot
});
```

### Response 200 (new subscriber)

```json
{
  "success": true,
  "data": {
    "message": "Check your inbox to confirm your subscription.",
    "emailSent": true
  }
}
```

### Response 200 (existing verified, preferences updated)

```json
{
  "success": true,
  "data": {
    "message": "Your preferences have been updated.",
    "emailSent": false
  }
}
```

### Response 400

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [
      { "path": ["email"], "message": "Invalid email format" }
    ]
  }
}
```

### Response 429

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many subscription attempts. Please try again in an hour."
  }
}
```

---

## 5. GET `/api/verify`

Verify email via one-time token.

**Rate limit:** 10/token (prevent brute force)

### Query params

| Name | Type | Required |
|------|------|----------|
| token | string | Yes, 32-char nanoid |

### Behavior

- Look up subscriber by `verificationToken`
- Check token not expired (`verificationTokenExpiresAt` > now)
- Set `emailVerified: true`, clear token
- Log `verified` event
- Redirect to `/subscribe/success`

### Response 302

```
Location: /subscribe/success
```

### Response 400 (expired or invalid token)

```
Location: /subscribe/error?reason=invalid-token
```

---

## 6. POST `/api/preferences`

Update preferences via magic link (no password).

**Rate limit:** 10/subscriber/hour

### Request body

```json
{
  "token": "signed-jwt-from-email",
  "categories": ["gold", "stocks"],
  "phone": {
    "number": "+923001234567",
    "country": "PK"
  },
  "channels": {
    "email": true,
    "whatsapp": false,
    "webPush": false
  }
}
```

### JWT payload structure (for signing)

```ts
{
  sub: subscriberId,
  email: email,
  iat: timestamp,
  exp: timestamp + 7 days
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "message": "Preferences updated",
    "subscriber": {
      "categories": ["gold", "stocks"],
      "channels": { "email": true, "whatsapp": false, "webPush": false }
    }
  }
}
```

---

## 7. POST `/api/unsubscribe`

One-click unsubscribe (Gmail/Yahoo RFC 8058 compliance).

### Request body

```json
{
  "token": "signed-jwt",
  "reason": "too-many-emails"
}
```

Or via GET for one-click email link: `/api/unsubscribe?token=X`

### Response 200

```json
{
  "success": true,
  "data": {
    "message": "You've been unsubscribed. We're sorry to see you go."
  }
}
```

---

## 8. POST `/api/revalidate`

Worker triggers ISR revalidation.

**Auth:** Shared secret header
**Called by:** Hetzner worker after price update

### Request body

```json
{
  "tag": "price-gold",
  "secret": "<REVALIDATE_SECRET>"
}
```

### Valid tags

- `price-<symbol>` — Category price page
- `blog-<slug>` — Specific blog post
- `blog-list` — Blog listing pages
- `disclaimers` — When disclaimer edited

### Response 200

```json
{
  "success": true,
  "data": {
    "revalidated": true,
    "tag": "price-gold"
  }
}
```

### Response 401

If secret doesn't match — log as security event.

---

## 9. GET `/api/admin/subscribers`

Paginated subscriber list with filters.

**Auth:** Clerk session + admin role
**Rate limit:** 30/min/user

### Query params

| Name | Type | Default | Notes |
|------|------|---------|-------|
| page | number | 1 | 1-indexed |
| limit | number | 50 | Max 200 |
| category | string | — | Filter by category |
| hasPhone | boolean | — | Has any phone |
| whatsappReady | boolean | — | Has verified phone |
| verified | boolean | — | Email verified |
| search | string | — | Email substring search |
| sortBy | string | `createdAt` | `createdAt` \| `lastEngagedAt` |
| sortOrder | string | `desc` | `asc` \| `desc` |

### Response 200

```json
{
  "success": true,
  "data": {
    "subscribers": [
      {
        "id": "507f1f77bcf86cd799439011",
        "email": "user@example.com",
        "phone": { "number": "+92***4567", "country": "PK", "verified": false },
        "categories": ["gold", "crypto"],
        "channels": { "email": true, "whatsapp": true, "webPush": false },
        "emailVerified": true,
        "createdAt": "2026-03-15T10:20:00Z",
        "lastEngagedAt": "2026-04-20T14:22:11Z",
        "emailsSent": 12,
        "emailsOpened": 8
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 342,
      "totalPages": 7
    }
  }
}
```

**Note:** Phone masked in list view for security. Full number only on detail endpoint.

---

## 10. POST `/api/admin/broadcast`

Send broadcast to matching subscribers.

**Auth:** Clerk + admin role

### Request body

```json
{
  "channel": "email",
  "categories": ["gold"],
  "subject": "Gold breaks $2,400 — what's next?",
  "body": "Plain text body...",
  "bodyHtml": "<p>HTML body...</p>",
  "scheduledFor": null,
  "testOnly": false
}
```

**Behavior:**
- If `testOnly: true` → send only to admin's email
- If `scheduledFor` is future date → create as scheduled
- Otherwise send immediately (queues jobs)

### Validation

```ts
{
  channel: z.enum(['email', 'whatsapp', 'both']),
  categories: z.array(CategoryEnum).min(1),
  subject: z.string().max(200).optional(),
  body: z.string().min(10).max(50000),
  bodyHtml: z.string().optional(),
  scheduledFor: z.string().datetime().nullable(),
  testOnly: z.boolean().default(false),
}
```

### Response 202 (accepted, processing)

```json
{
  "success": true,
  "data": {
    "broadcastId": "bc_abc123",
    "status": "sending",
    "targetCount": 342,
    "channel": "email"
  }
}
```

---

## 11. POST `/api/admin/segment-preview`

Preview how many subscribers a broadcast would hit.

### Request body

```json
{
  "channel": "email",
  "categories": ["gold", "silver"]
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "estimatedRecipients": 234,
    "breakdown": {
      "gold": 180,
      "silver": 95,
      "overlap": 41
    },
    "eligibility": {
      "emailVerified": 234,
      "notUnsubscribed": 234,
      "emailEnabled": 228
    }
  }
}
```

---

## 12. GET `/api/admin/broadcasts`

List past broadcasts.

### Query params

| Name | Type | Default |
|------|------|---------|
| page | number | 1 |
| limit | number | 20 |
| status | string | — |
| channel | string | — |

### Response 200

```json
{
  "success": true,
  "data": {
    "broadcasts": [
      {
        "broadcastId": "bc_abc123",
        "channel": "email",
        "subject": "Gold breaks $2,400",
        "targetCount": 342,
        "status": "completed",
        "deliveryStats": {
          "sent": 340, "delivered": 335, "opened": 187, "clicked": 42,
          "bounced": 5, "unsubscribed": 2
        },
        "createdAt": "2026-04-20T10:00:00Z",
        "completedAt": "2026-04-20T10:12:34Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
  }
}
```

---

## 13. GET `/api/admin/disclaimers`

List all disclaimers.

### Response 200

```json
{
  "success": true,
  "data": {
    "disclaimers": [
      {
        "id": "507f...",
        "key": "disc-gold-v1",
        "category": "gold",
        "title": "About Gold Investments",
        "severity": "info",
        "displayStyle": "box",
        "isActive": true,
        "version": 1,
        "lastReviewedAt": "2026-04-01T00:00:00Z",
        "lastReviewedBy": "admin@site.com"
      }
    ]
  }
}
```

---

## 14. PATCH `/api/admin/disclaimers/[id]`

Update disclaimer (creates new version).

### Request body

```json
{
  "title": "Updated title",
  "bodyMarkdown": "Updated body text...",
  "severity": "warning"
}
```

### Behavior

- Copies existing doc, increments `version`, keeps old version as `isActive: false`
- Creates new doc with `version: oldVersion + 1`, `isActive: true`
- Invalidates Redis cache: `disclaimer:<key>`
- Triggers revalidation: `tag: 'disclaimers'`
- Creates `audit_log` entry

### Response 200

```json
{
  "success": true,
  "data": {
    "disclaimer": { /* new version */ },
    "previousVersion": 1,
    "newVersion": 2
  }
}
```

---

## 15. Global Middleware Behavior

### Rate limiting

```ts
// apps/web/middleware.ts
const limits = {
  '/api/subscribe': { window: '1 h', max: 3 },
  '/api/price': { window: '1 m', max: 120 },
  '/api/candles': { window: '1 m', max: 60 },
  '/api/admin': { window: '1 m', max: 30 },
};
```

All rate-limit responses include:
- `X-RateLimit-Limit`: Max allowed
- `X-RateLimit-Remaining`: Remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds to wait (on 429)

### Security headers (all responses)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.upstash.io https://api.resend.com
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 16. Webhooks (Phase 2+)

### Resend webhook: `/api/webhooks/resend`

Receives delivery events:
- `email.sent`, `email.delivered`, `email.opened`, `email.clicked`
- `email.bounced`, `email.complained`

Updates `broadcast_log.deliveryStats` and `subscriber_events`.

### Clerk webhook: `/api/webhooks/clerk`

User lifecycle:
- `user.created` → seed user record
- `user.updated` → sync metadata
- `user.deleted` → GDPR soft delete

---

## 17. Error Handling Pattern

All API routes follow this pattern:

```ts
export async function POST(req: Request) {
  try {
    // 1. Rate limit
    const { success } = await ratelimit.subscribe.limit(ip);
    if (!success) return errorResponse('RATE_LIMITED', 429);

    // 2. Parse + validate
    const body = await req.json();
    const parsed = SubscribeRequestSchema.safeParse(body);
    if (!parsed.success) return errorResponse('VALIDATION_ERROR', 400, parsed.error.issues);

    // 3. Business logic
    const result = await doThing(parsed.data);

    // 4. Success
    return successResponse(result);
  } catch (err) {
    // 5. Log full error server-side, return generic to client
    logger.error({ err, route: 'subscribe' }, 'Unhandled error');
    return errorResponse('INTERNAL_ERROR', 500);
  }
}
```

Helpers:
```ts
function successResponse<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

function errorResponse(code: string, status: number, details?: any) {
  return NextResponse.json(
    { success: false, error: { code, message: MESSAGES[code], details } },
    { status }
  );
}
```

---

**End of `09-API-CONTRACTS.md`. Proceed to `10-QA-CHECKLIST.md`.**
