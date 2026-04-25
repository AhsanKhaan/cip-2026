# 🔐 15 — MFA Authentication (TOTP + Backup Codes)

**Provider:** Clerk (handles TOTP + backup codes natively, no custom crypto needed)
**TOTP Apps Supported:** Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden, any RFC 6238-compliant app
**Backup Codes:** 10 single-use codes generated on MFA setup, downloadable

---

## 1. Why Clerk for MFA

**Writing custom MFA is dangerous.** You'd need to:
- Implement TOTP (RFC 6238) correctly
- Handle time-window tolerance securely
- Store secrets encrypted (never plain)
- Generate backup codes with cryptographic randomness
- Rate-limit verification attempts
- Handle recovery without opening auth bypass

**Clerk does all of this correctly** with professional security audits. Free tier includes MFA up to 10,000 MAU. At scale it becomes ~$25/month — trivial vs. the cost of a breach.

**Your requirements met:**
- ✅ Google Authenticator works (standard TOTP)
- ✅ Backup codes (10 single-use) for phone-loss recovery
- ✅ Enforced for admin accounts
- ✅ Self-service setup and recovery
- ✅ Audit logs of all MFA events

---

## 2. MFA Enforcement Policy

### By role

| Role | MFA Required |
|------|--------------|
| `viewer` | Optional (not forced) |
| `author` | Required within 7 days of account creation |
| `editor` | Required immediately on first login |
| `admin` | Required before any admin action |

### Technical enforcement

```ts
// apps/web/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isEditorRoute = createRouteMatcher(['/author(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req) || isEditorRoute(req)) {
    const session = await auth();

    if (!session.userId) {
      return session.redirectToSignIn();
    }

    // Require MFA for these routes
    if (!session.sessionClaims?.two_factor) {
      return Response.redirect(new URL('/setup-mfa', req.url));
    }

    // Require MFA was verified in last 8 hours
    const mfaVerifiedAt = session.sessionClaims?.mfa_verified_at;
    if (!mfaVerifiedAt || Date.now() - mfaVerifiedAt > 8 * 60 * 60 * 1000) {
      return Response.redirect(new URL('/verify-mfa', req.url));
    }
  }
});
```

This forces MFA re-verification every 8 hours for admin/editor actions — short enough to protect against session theft, long enough to not be annoying.

---

## 3. User Setup Flow

### Step 1: First admin login

```
┌────────────────────────────────────────────────────────────┐
│  🔐 Set up Two-Factor Authentication                        │
│                                                            │
│  As an admin, you must protect your account with a         │
│  second factor. This takes 2 minutes.                      │
│                                                            │
│  You'll need:                                              │
│  • Your phone                                              │
│  • An authenticator app                                    │
│    (Google Authenticator, Microsoft Authenticator, etc.)   │
│                                                            │
│  [ Get Started ]                                           │
└────────────────────────────────────────────────────────────┘
```

### Step 2: QR code for TOTP

```
┌────────────────────────────────────────────────────────────┐
│  Scan this QR code with your authenticator app:            │
│                                                            │
│             ┌─────────────────────┐                        │
│             │ ▓▓▓ ▓▓▓▓▓▓▓▓ ▓▓▓▓▓ │                        │
│             │ ▓▓▓▓▓ ▓▓▓ ▓▓▓▓▓▓▓▓ │                        │
│             │  (QR code image)    │                        │
│             │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │                        │
│             └─────────────────────┘                        │
│                                                            │
│  Can't scan? Enter manually:                               │
│  ┌────────────────────────────────┐                        │
│  │ JBSWY3DPEHPK3PXP               │ [Copy]                 │
│  └────────────────────────────────┘                        │
│                                                            │
│  After adding, enter the 6-digit code:                     │
│  [ _ _ _ _ _ _ ]                                           │
│                                                            │
│  [ Verify ]                                                │
└────────────────────────────────────────────────────────────┘
```

### Step 3: Backup codes (CRITICAL)

```
┌────────────────────────────────────────────────────────────┐
│  ⚠️  Save These Backup Codes                                │
│                                                            │
│  If you lose your phone, these codes are the ONLY way      │
│  to access your account. Each code works ONCE.             │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  1. xR7k-m3Nq-9pLw                                 │    │
│  │  2. 8tH2-vB6n-4yGc                                 │    │
│  │  3. qZ9d-pL3k-7mNw                                 │    │
│  │  4. aB4j-xQ8r-5tPy                                 │    │
│  │  5. cV2m-sF7h-1zTk                                 │    │
│  │  6. yR5n-bW9q-6xLp                                 │    │
│  │  7. jH3t-uA7v-2mKe                                 │    │
│  │  8. gS8y-rN4c-9pDw                                 │    │
│  │  9. kL6b-eP2q-5vMz                                 │    │
│  │  10. nT4w-iQ9f-7xGh                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  [ Download as .txt ]  [ Print ]  [ Copy all ]            │
│                                                            │
│  ☐  I have saved my backup codes in a safe place           │
│                                                            │
│  [ Continue ] (only enabled after checkbox)                │
└────────────────────────────────────────────────────────────┘
```

### Step 4: Confirmation

```
✅ Two-factor authentication is active

Next time you log in, you'll enter:
1. Your password
2. A 6-digit code from your authenticator app
```

---

## 4. Login Flow (Post-Setup)

```
┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
│   Email + Password    │ → │  6-digit TOTP code    │ → │      Logged in        │
└───────────────────────┘    └───────────────────────┘    └───────────────────────┘
                                        │
                                  [Use backup code]
                                        ↓
                             ┌───────────────────────┐
                             │  Enter backup code    │
                             │  (one-time use)       │
                             └───────────────────────┘
```

### Login screen UI

```
┌────────────────────────────────────────────────┐
│  🔐 Two-Factor Authentication                   │
│                                                │
│  Open your authenticator app and enter the     │
│  6-digit code:                                 │
│                                                │
│  [ _ _ _ _ _ _ ]                               │
│                                                │
│  [ Verify ]                                    │
│                                                │
│  ─────────────  OR  ─────────────              │
│                                                │
│  [ Use a backup code ]                         │
│                                                │
│  Having trouble? [ Contact support ]           │
└────────────────────────────────────────────────┘
```

### Using a backup code

```
┌────────────────────────────────────────────────┐
│  🔑 Enter Backup Code                           │
│                                                │
│  Use one of your 10 backup codes:              │
│                                                │
│  [ xxxx - xxxx - xxxx ]                        │
│                                                │
│  After this, you'll have N backup codes left.  │
│  We'll prompt you to regenerate if you're low. │
│                                                │
│  [ Verify ]                                    │
└────────────────────────────────────────────────┘
```

---

## 5. Recovery Flows

### 5.1 Lost phone + has backup codes

1. User logs in with password
2. Clicks "Use a backup code"
3. Enters backup code → authenticated
4. **Immediately prompted:** "Your TOTP is compromised. Set up a new authenticator."
5. Goes through setup again → new QR code, new secret
6. Old TOTP secret invalidated
7. Old backup codes invalidated (new ones generated)

### 5.2 Lost phone + no backup codes (worst case)

User must:
1. Email `security@yoursite.com` from the email on their account
2. Provide identity proof (government ID + selfie, OR another pre-arranged recovery method)
3. Admin manually disables MFA on that account in Clerk dashboard
4. User re-sets up MFA on next login

**This is deliberately manual** — automated recovery is a bypass attackers will exploit. Keep the friction.

### 5.3 Backup code theft (suspected)

1. User logs into account settings
2. Clicks "Regenerate backup codes"
3. Requires TOTP or existing backup code to confirm
4. New 10 codes generated, old ones invalidated
5. Audit log records the regeneration

---

## 6. Clerk Configuration

### Dashboard settings

In Clerk dashboard → **User & Authentication** → **Multi-factor**:

- ✅ Authenticator app (TOTP) — enabled
- ✅ Backup codes — enabled, 10 codes
- ❌ SMS — disabled (SIM-swap risk)
- ❌ Phone call — disabled

### Code-level config

```ts
// apps/web/lib/auth.ts
import { createClerkClient } from '@clerk/nextjs/server';

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Helper: check if user has MFA set up
export async function hasMFASetup(userId: string): Promise<boolean> {
  const user = await clerk.users.getUser(userId);
  return (user.totpEnabled || false) && (user.backupCodeEnabled || false);
}

// Helper: check if user is admin with valid MFA
export async function requireAdminWithMFA(userId: string) {
  const user = await clerk.users.getUser(userId);

  if (user.publicMetadata.role !== 'admin' && user.publicMetadata.role !== 'editor') {
    throw new Error('UNAUTHORIZED');
  }

  if (!user.totpEnabled) {
    throw new Error('MFA_REQUIRED');
  }

  return user;
}
```

### Sign-in component

```tsx
// apps/web/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-surface border border-default',
        }
      }}
      redirectUrl="/admin"
    />
  );
}
```

Clerk's `<SignIn>` automatically handles:
- Password entry
- TOTP prompt if user has MFA
- Backup code option
- Rate limiting (5 failed attempts = 15 min lockout)

---

## 7. Audit Events for MFA

All MFA actions logged in `audit_log` via the `audit()` helper from doc 11:

```ts
// On MFA setup
await audit('auth.mfa.setup', { type: 'user', id: userId }, actor, {});

// On successful MFA verification
await audit('auth.mfa.verified', { type: 'user', id: userId }, actor, {
  after: { method: 'totp' }
});

// On backup code use
await audit('auth.mfa.backup_used', { type: 'user', id: userId }, actor, {
  after: { codesRemaining: 8 }
});

// On backup codes regenerated
await audit('auth.mfa.backup_regenerated', { type: 'user', id: userId }, actor, {});

// On MFA disabled (admin reset)
await audit('auth.mfa.disabled_by_admin', { type: 'user', id: userId }, admin, {
  after: { reason: 'lost-phone-recovery' }
});

// On failed MFA attempts
await audit('auth.mfa.failed', { type: 'user', id: userId }, actor, {
  after: { attempts: 3 }
});
```

Admin dashboard `/admin/logs?action=auth.mfa.*` filters to MFA events.

---

## 8. Alerts (Security Incidents)

Worker cron checks every 5 minutes:

```ts
// apps/worker/src/jobs/check-mfa-alerts.ts

// Alert 1: 5+ failed MFA attempts on same account in 1 hour
const failed = await db.collection('audit_log').aggregate([
  { $match: {
      action: 'auth.mfa.failed',
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
  }},
  { $group: { _id: '$resourceId', count: { $sum: 1 } } },
  { $match: { count: { $gte: 5 } } }
]).toArray();

for (const f of failed) {
  await sendSecurityAlert({
    severity: 'high',
    message: `5+ MFA failures on user ${f._id}`,
    action: 'Consider temporary lockout + email user',
  });
}

// Alert 2: Backup codes running low (< 3 remaining)
// User gets email + dashboard banner prompting regeneration

// Alert 3: MFA disabled by admin (always alert)
```

---

## 9. Self-Service Account Settings

Users manage their own MFA at `/settings/security`:

```
┌─────────────────────────────────────────────────────────────┐
│  Security Settings                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Password                                                   │
│  Last changed 47 days ago                                   │
│  [ Change password ]                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Two-Factor Authentication      Status: ✅ Active            │
│                                                             │
│  Authenticator app (TOTP)      Set up 2026-03-15           │
│  [ Disable ] [ Reset to new device ]                        │
│                                                             │
│  Backup codes: 7 of 10 remaining                            │
│  ⚠ Running low. Consider regenerating.                      │
│  [ Regenerate codes ]                                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active Sessions                                            │
│  • Chrome on Mac (Karachi)   Current  [ This is me ]       │
│  • Safari on iPhone           2h ago    [ Revoke ]         │
│  • Firefox on Windows         3d ago    [ Revoke ]         │
│  [ Revoke all other sessions ]                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Recent Security Events                                     │
│  • MFA verified     Today 08:23 from Karachi                │
│  • Password used    Today 08:23 from Karachi                │
│  • Backup code used 2d ago from Lahore  ⚠ different city    │
│  [ View full history ]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Rate Limiting MFA Endpoints

Beyond Clerk's built-in limits, add our own layer:

```ts
const mfaLimits = {
  'auth:verify-totp': { window: '15m', max: 10 },
  'auth:verify-backup': { window: '1h', max: 5 },
  'auth:mfa-setup': { window: '1h', max: 3 },
};
```

Exceeded limits:
- Block further attempts for window duration
- Email user (possible unauthorized attempt)
- Log in `audit_log`
- Flag account for admin review

---

## 11. Implementation Checklist

### Phase 1 — Setup (Sprint 5)
- [ ] Clerk account provisioned with MFA enabled in dashboard
- [ ] Middleware enforces MFA for `/admin` + `/author` routes
- [ ] Sign-in, sign-up, setup-MFA pages work
- [ ] Backup codes downloadable
- [ ] Audit logging integrated

### Phase 2 — Polish
- [ ] Self-service settings page at `/settings/security`
- [ ] Regenerate backup codes flow
- [ ] Session management UI
- [ ] MFA failure alerts to user email

### Phase 3 — Advanced
- [ ] Security event feed in user settings
- [ ] Unusual login location detection (new country → re-verify MFA)
- [ ] Hardware key support (WebAuthn) — Clerk Enterprise

---

## 12. Testing MFA

### 12.1 Manual QA

- [ ] Sign up as new user → MFA setup flow appears
- [ ] Scan QR with Google Authenticator → 6-digit code works
- [ ] Scan QR with Authy → works
- [ ] Scan QR with Microsoft Authenticator → works
- [ ] Backup codes displayed → downloadable → each works ONCE
- [ ] Using backup code marks it used in Clerk
- [ ] Expired TOTP code rejected
- [ ] Future TOTP code rejected (clock skew tolerance ±30s only)
- [ ] 5 failed attempts = account locked 15 min
- [ ] Admin can reset MFA on user account
- [ ] MFA events appear in audit log

### 12.2 E2E test (Playwright)

```ts
// e2e/specs/mfa-flow.spec.ts
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test('admin must pass MFA to access /admin', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('admin-test@yoursite.com');
  await page.getByLabel('Password').fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /continue/i }).click();

  // TOTP prompt should appear
  await expect(page.getByText(/two-factor/i)).toBeVisible();

  // Generate current TOTP from test secret
  const totp = authenticator.generate(process.env.TEST_ADMIN_TOTP_SECRET);
  await page.getByLabel(/code/i).fill(totp);
  await page.getByRole('button', { name: /verify/i }).click();

  // Should land on admin dashboard
  await expect(page).toHaveURL(/\/admin/);
});
```

---

## 13. Documentation for Users

Ship a help page at `/help/mfa` covering:

- Why MFA matters (plain English)
- How to install an authenticator app
- Step-by-step setup guide with screenshots
- What to do if phone lost
- What to do if backup codes lost
- FAQ: "Is SMS supported?" (no, explain why)
- Support contact for recovery

---

## 14. QA Checklist for MFA

- [ ] Admin cannot access `/admin` without MFA
- [ ] Editor cannot access `/author` without MFA
- [ ] MFA setup takes under 3 minutes end-to-end
- [ ] QR code scans correctly in Google Authenticator
- [ ] QR code scans correctly in Authy
- [ ] Manual secret entry works
- [ ] 6-digit TOTP verification succeeds
- [ ] 10 backup codes generated, downloadable, copyable
- [ ] Each backup code works once, then invalidated
- [ ] Backup codes regeneration flow works
- [ ] Lost phone + backup code flow restores access
- [ ] All MFA events appear in audit log
- [ ] Rate limits active on verification endpoints
- [ ] Session timeout for MFA is 8 hours
- [ ] Users can see and revoke other sessions
- [ ] SMS explicitly disabled (verified in Clerk config)

---

**End of `15-MFA-AUTHENTICATION.md`. Proceed to `16-DYNAMIC-JSONLD.md`.**
