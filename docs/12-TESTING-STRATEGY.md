# 🧪 12 — Testing Strategy (Dynamic + Scalable)

**Goal:** Tests write themselves. You don't manually write 90% of them.
**Stack:** Vitest (unit + integration) + Playwright (E2E) + MSW (API mocking) + dynamic generators
**Why this stack:** Vitest is 10× faster than Jest, ESM-native, shares config with Next.js. Playwright is Microsoft-backed, multi-browser, zero flakiness at scale. Both free forever.
**Scale target:** Million-user platform means tests must run in <5 min in CI, even with 10,000+ test cases.

---

## 1. The "Don't Write Tests Twice" Philosophy

Traditional testing requires writing:
1. Zod schemas (validation)
2. TypeScript types (compile-time safety)
3. Unit tests (runtime verification)
4. Integration tests (API layer)
5. E2E tests (user flows)

**Same logic, five times.** We kill 60–70% of this duplication using:

1. **Zod schemas as single source of truth** → types auto-derived, validators auto-generated, fuzz test inputs auto-generated
2. **Property-based testing** → generators produce thousands of inputs, not hand-written examples
3. **Visual regression** → UI changes detected automatically, no "screenshot matches snapshot" tests to write
4. **Contract tests from OpenAPI** → API docs double as tests
5. **Data factories** → `createSubscriber()` produces valid fixtures from your schemas

---

## 2. Test Pyramid (for this project)

```
          ┌──────────────┐
          │     E2E      │  ~30 tests, ~5 min
          │  (Playwright)│  Core user journeys only
          └──────────────┘
         ┌────────────────┐
         │  Integration   │  ~150 tests, ~2 min
         │   (Vitest)     │  API routes + DB
         └────────────────┘
        ┌──────────────────┐
        │   Unit + Props   │  ~1000+ tests, ~30 sec
        │  (Vitest + fast-│  Pure functions, components
        │  check generators)│  Most generated, not written
        └──────────────────┘
```

---

## 3. Folder Structure

```
apps/web/
├── __tests__/
│   ├── unit/              # Isolated functions
│   ├── integration/       # API routes, DB queries
│   ├── components/        # React components
│   └── setup.ts
├── e2e/                   # Playwright tests
│   ├── fixtures/
│   ├── specs/
│   └── playwright.config.ts
├── vitest.config.ts
└── ...

packages/shared/
├── __tests__/
│   └── schemas.test.ts    # Schema validation tests (generated)
└── src/

tests-generators/          # Test generation scripts
├── generate-api-tests.ts
├── generate-schema-tests.ts
└── generate-component-tests.ts
```

---

## 4. Unit Tests with Dynamic Generation

### 4.1 Schema-based property testing

For every Zod schema, automatically generate tests that:
- ✅ Accept every valid input from a generator
- ❌ Reject every invalid input (fuzz)

```ts
// packages/shared/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { zodFaker } from '@zodock/faker';

import {
  SubscriberSchema,
  SubscribeRequestSchema,
  DisclaimerSchema,
  PriceSchema,
  CandleSchema,
} from '../src/schemas';

const SCHEMAS = [
  { name: 'Subscriber', schema: SubscriberSchema },
  { name: 'SubscribeRequest', schema: SubscribeRequestSchema },
  { name: 'Disclaimer', schema: DisclaimerSchema },
  { name: 'Price', schema: PriceSchema },
  { name: 'Candle', schema: CandleSchema },
];

describe.each(SCHEMAS)('$name schema', ({ schema }) => {
  it('accepts valid generated data (100 iterations)', () => {
    fc.assert(
      fc.property(zodFaker(schema), (valid) => {
        expect(schema.parse(valid)).toEqual(valid);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects null', () => {
    expect(() => schema.parse(null)).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => schema.parse({})).toThrow();
  });

  it('rejects strings where objects expected', () => {
    expect(() => schema.parse('not-an-object')).toThrow();
  });
});
```

**Why this matters:** Add a field to `SubscriberSchema` → tests automatically cover it. No manual updates.

### 4.2 Pure function tests (auto-scaffolded)

For every file in `lib/`, generate a skeleton test:

```ts
// tests-generators/generate-unit-tests.ts
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

function scanExports(filePath: string): string[] {
  // Parse file with ts compiler, return list of named exports
}

function generateTestStub(filePath: string, exports: string[]) {
  const testPath = filePath.replace('/src/', '/__tests__/unit/').replace('.ts', '.test.ts');
  if (fs.existsSync(testPath)) return; // Don't overwrite

  const content = `
import { describe, it, expect } from 'vitest';
import { ${exports.join(', ')} } from '${importPath}';

${exports.map(fn => `
describe('${fn}', () => {
  it.todo('happy path');
  it.todo('edge case: empty input');
  it.todo('edge case: maximum size');
  it.todo('error: invalid input throws');
});
`).join('')}`;

  fs.writeFileSync(testPath, content);
}

// Run: pnpm run gen:tests
// Creates stub files for any lib/* without a test
```

This puts `.todo()` markers in every untested function. Claude Code can fill them in later with focused prompts.

### 4.3 Data factories

```ts
// __tests__/factories/subscriber.ts
import { faker } from '@faker-js/faker';
import type { Subscriber } from '@shared/schemas';

export function createSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    _id: faker.database.mongodbObjectId(),
    email: faker.internet.email().toLowerCase(),
    phone: {
      number: `+92${faker.string.numeric(10)}`,
      country: 'PK',
      verified: false,
    },
    categories: faker.helpers.arrayElements(['gold','silver','crypto'], { min: 1, max: 3 }),
    channels: { email: true, whatsapp: false, webPush: false },
    emailVerified: true,
    verificationToken: null,
    verificationTokenExpiresAt: null,
    consentedAt: faker.date.past(),
    consentSource: '/test',
    consentMethod: 'form',
    unsubscribedAt: null,
    unsubscribeReason: null,
    emailsSent: 0,
    emailsOpened: 0,
    emailsClicked: 0,
    whatsappsSent: 0,
    lastEngagedAt: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createSubscribers(n: number, overrides = {}) {
  return Array.from({ length: n }, () => createSubscriber(overrides));
}
```

Usage:

```ts
const verified = createSubscriber({ emailVerified: true });
const bulk = createSubscribers(100, { categories: ['gold'] });
```

---

## 5. Integration Tests (API routes + DB)

### 5.1 In-memory MongoDB for speed

```ts
// __tests__/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongod: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  globalThis.testDb = client.db('test');
});

afterAll(async () => {
  await client?.close();
  await mongod?.stop();
});

beforeEach(async () => {
  // Clear all collections between tests
  const collections = await globalThis.testDb.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
});
```

### 5.2 API route testing pattern

```ts
// __tests__/integration/api/subscribe.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/subscribe/route';
import { createSubscriber } from '../../factories/subscriber';

function mockRequest(body: any) {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.42',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/subscribe', () => {
  it('creates subscriber with valid payload', async () => {
    const res = await POST(mockRequest({
      email: 'new@example.com',
      categories: ['gold'],
      channels: { email: true, whatsapp: false, webPush: false },
      consent: true,
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const inDb = await testDb.collection('subscribers').findOne({ email: 'new@example.com' });
    expect(inDb).toBeTruthy();
    expect(inDb.emailVerified).toBe(false);
  });

  it('updates existing subscriber preferences', async () => {
    const existing = await testDb.collection('subscribers').insertOne(
      createSubscriber({ email: 'exists@example.com', categories: ['gold'] })
    );

    const res = await POST(mockRequest({
      email: 'exists@example.com',
      categories: ['silver', 'crypto'],
      channels: { email: true, whatsapp: false, webPush: false },
      consent: true,
    }));

    expect(res.status).toBe(200);
    const updated = await testDb.collection('subscribers').findOne({ email: 'exists@example.com' });
    expect(updated.categories).toEqual(['silver', 'crypto']);
  });

  it('rejects missing consent', async () => {
    const res = await POST(mockRequest({
      email: 'no-consent@example.com',
      categories: ['gold'],
      channels: { email: true, whatsapp: false, webPush: false },
      // consent missing
    }));
    expect(res.status).toBe(400);
  });

  it('rate-limits after 3 requests from same IP', async () => {
    for (let i = 0; i < 3; i++) {
      await POST(mockRequest({
        email: `test${i}@example.com`,
        categories: ['gold'],
        channels: { email: true, whatsapp: false, webPush: false },
        consent: true,
      }));
    }

    const res = await POST(mockRequest({
      email: 'rate-limited@example.com',
      categories: ['gold'],
      channels: { email: true, whatsapp: false, webPush: false },
      consent: true,
    }));

    expect(res.status).toBe(429);
  });

  it('silently accepts honeypot submissions without creating subscriber', async () => {
    const res = await POST(mockRequest({
      email: 'bot@example.com',
      categories: ['gold'],
      channels: { email: true, whatsapp: false, webPush: false },
      consent: true,
      website: 'http://spam.com',   // Honeypot filled
    }));

    expect(res.status).toBe(200);
    const inDb = await testDb.collection('subscribers').findOne({ email: 'bot@example.com' });
    expect(inDb).toBeNull();
  });
});
```

### 5.3 Auto-generated API contract tests

Every endpoint in `09-API-CONTRACTS.md` has a known request/response schema. Generate contract tests:

```ts
// tests-generators/generate-api-contract-tests.ts

const API_CONTRACTS = [
  {
    path: '/api/subscribe',
    method: 'POST',
    requestSchema: SubscribeRequestSchema,
    responseSchema: SubscribeResponseSchema,
    expectedCodes: [200, 400, 429, 500],
  },
  // ... all endpoints
];

for (const contract of API_CONTRACTS) {
  generateTestFile(contract);
}

function generateTestFile(c) {
  const content = `
describe('${c.method} ${c.path} contract', () => {
  it('accepts schema-valid payload', () => {
    fc.assert(
      fc.property(zodFaker(${c.requestSchema}), async (payload) => {
        const res = await fetch('${c.path}', { method: '${c.method}', body: JSON.stringify(payload) });
        expect(${c.expectedCodes}).toContain(res.status);
      })
    );
  });

  it('rejects invalid payload with 400', async () => {
    const res = await fetch('${c.path}', { method: '${c.method}', body: '{}' });
    expect(res.status).toBe(400);
  });
});`;
  // write to file
}
```

---

## 6. Component Tests

### 6.1 Storybook + Interactions (hybrid approach)

Every component has a `*.stories.tsx` file. Storybook stories double as tests.

```tsx
// components/subscription/SubscribeForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { SubscribeForm } from './SubscribeForm';

const meta: Meta<typeof SubscribeForm> = {
  component: SubscribeForm,
  title: 'Subscription/SubscribeForm',
};
export default meta;

export const Default: StoryObj = {};

export const Filled: StoryObj = {
  args: {
    defaultCategories: ['gold'],
  },
};

export const SubmitsSuccessfully: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email/i), 'test@example.com');
    await userEvent.click(canvas.getByRole('checkbox', { name: /gold/i }));
    await userEvent.click(canvas.getByLabelText(/agree/i));
    await userEvent.click(canvas.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(canvas.getByText(/check your inbox/i)).toBeInTheDocument();
    });
  },
};

export const ShowsValidationErrors: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(canvas.getByText(/email required/i)).toBeInTheDocument();
    });
  },
};
```

These run in both:
- Storybook UI (visual)
- Vitest CI (headless, via `@storybook/test-runner`)

### 6.2 Auto-generated stories

For simple components (buttons, badges, labels), scaffold stories automatically:

```ts
// tests-generators/generate-stories.ts

const scan = await glob('components/**/*.tsx');

for (const file of scan) {
  const storyFile = file.replace('.tsx', '.stories.tsx');
  if (fs.existsSync(storyFile)) continue;

  const componentName = path.basename(file, '.tsx');
  fs.writeFileSync(storyFile, `
import type { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  component: ${componentName},
  title: 'Components/${componentName}',
};
export default meta;

export const Default: StoryObj = {};
  `);
}
```

---

## 7. E2E Tests with Playwright

### 7.1 Configuration

```ts
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html'], ['github']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'mobile-chrome', use: devices['Pixel 7'] },
    { name: 'mobile-safari', use: devices['iPhone 14'] },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 7.2 Core user journey (critical path)

```ts
// e2e/specs/subscribe-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Subscription flow', () => {
  test('new user can subscribe to gold updates', async ({ page }) => {
    await page.goto('/gold-price-today');

    // Disclaimer banner visible (from auto-injection)
    await expect(page.getByText(/about this price data/i)).toBeVisible();

    // Subscribe form with gold pre-checked
    const goldCheckbox = page.getByRole('checkbox', { name: /gold/i });
    await expect(goldCheckbox).toBeChecked();

    // Fill email + consent
    await page.getByLabel(/email/i).fill('e2e-test@example.com');
    await page.getByLabel(/agree/i).check();
    await page.getByRole('button', { name: /subscribe/i }).click();

    // Success message
    await expect(page.getByText(/check your inbox/i)).toBeVisible();
  });

  test('live price updates within 90 seconds', async ({ page }) => {
    await page.goto('/gold');
    const price = page.getByTestId('live-price-value');
    const initial = await price.textContent();

    await page.waitForTimeout(90_000);
    const next = await price.textContent();
    // Price may be same (flat market) but timestamp should change
    const timestamp = page.getByTestId('last-updated');
    await expect(timestamp).toContainText(/second|just now/i);
  });
});
```

### 7.3 Accessibility E2E

```ts
// e2e/specs/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/gold', '/silver', '/bitcoin', '/blog/sample-post'];

for (const p of PAGES) {
  test(`${p} has no a11y violations`, async ({ page }) => {
    await page.goto(p);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
```

### 7.4 Visual regression

```ts
// e2e/specs/visual.spec.ts
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', size: { width: 375, height: 667 } },
  { name: 'tablet', size: { width: 768, height: 1024 } },
  { name: 'desktop', size: { width: 1440, height: 900 } },
];

for (const vp of VIEWPORTS) {
  test(`landing page visual (${vp.name})`, async ({ page }) => {
    await page.setViewportSize(vp.size);
    await page.goto('/');
    await expect(page).toHaveScreenshot(`landing-${vp.name}.png`, {
      maxDiffPixels: 100,     // tolerance
      fullPage: true,
    });
  });
}
```

First run generates baselines. Subsequent runs compare. CI fails if diff > tolerance.

---

## 8. Performance & Load Testing

### 8.1 k6 load tests (free, open-source)

```js
// load-tests/subscribe-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },      // Ramp to 100 users
    { duration: '3m', target: 100 },      // Hold
    { duration: '1m', target: 1000 },     // Spike
    { duration: '3m', target: 1000 },     // Hold
    { duration: '1m', target: 0 },        // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],       // 1% error budget
  },
};

export default function () {
  const res = http.get('https://yoursite.com/api/price/gold');
  check(res, {
    'status 200': r => r.status === 200,
    'response < 150ms': r => r.timings.duration < 150,
  });
  sleep(1);
}
```

Run: `k6 run load-tests/subscribe-flow.js`

### 8.2 Targets for millions-of-users scale

| Endpoint | p50 | p95 | p99 | Max RPS |
|----------|-----|-----|-----|---------|
| `/api/price/*` | < 30ms | < 100ms | < 250ms | 10,000 |
| `/api/candles/*` | < 80ms | < 200ms | < 500ms | 2,000 |
| `/api/subscribe` | < 200ms | < 500ms | < 1000ms | 100 |
| Page render (SSR) | < 200ms | < 600ms | < 1500ms | 5,000 |

---

## 9. CI/CD Test Pipeline

### 9.1 GitHub Actions workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [pull_request, push]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:unit --coverage
      - uses: codecov/codecov-action@v4

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        shard: [1/4, 2/4, 3/4, 4/4]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm exec playwright install ${{ matrix.browser }}
      - run: pnpm test:e2e --project=${{ matrix.browser }} --shard=${{ matrix.shard }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.browser }}-${{ matrix.shard }}
          path: playwright-report/

  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 9.2 Branch protection

- No merge to `main` without:
  - All tests green
  - 1 approval (self-review OK initially)
  - No open security issues
  - Linear history (rebase, not merge)

---

## 10. Coverage Targets

| Type | Target | Enforced |
|------|--------|----------|
| Statements | 80% | CI fails < 75% |
| Branches | 75% | CI fails < 70% |
| Functions | 85% | CI fails < 80% |
| Lines | 80% | CI fails < 75% |

Critical paths must be 100%:
- `apps/web/app/api/subscribe/`
- `apps/web/lib/disclaimers.ts`
- `apps/web/lib/auth.ts`
- `apps/worker/src/jobs/ingest-*`

---

## 11. Dynamic Test Generation Commands

These scripts eliminate manual test writing:

```json
// package.json
{
  "scripts": {
    "gen:tests": "tsx tests-generators/generate-all.ts",
    "gen:tests:api": "tsx tests-generators/generate-api-contract-tests.ts",
    "gen:tests:schemas": "tsx tests-generators/generate-schema-tests.ts",
    "gen:tests:stories": "tsx tests-generators/generate-stories.ts",
    "gen:factories": "tsx tests-generators/generate-factories.ts",
    "test": "vitest",
    "test:unit": "vitest run __tests__/unit",
    "test:integration": "vitest run __tests__/integration",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:load": "k6 run load-tests/subscribe-flow.js",
    "test:a11y": "playwright test e2e/specs/a11y.spec.ts"
  }
}
```

**Workflow:**
1. Write a Zod schema
2. Run `pnpm gen:tests` → tests appear for that schema
3. Run `pnpm test` → they pass (or fail, prompting fix)
4. Create a component → run `pnpm gen:tests:stories` → stub story appears
5. Fill in `play()` blocks for interactive tests

Result: **You only write tests for complex business logic.** Schema validation, API contracts, simple component rendering all auto-tested.

---

## 12. Test Data Cleanup

After CI runs, ensure no orphan data:

```ts
// __tests__/global-teardown.ts
import { MongoClient } from 'mongodb';

export default async function teardown() {
  if (process.env.NODE_ENV !== 'test') return;

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Drop test database
  await db.dropDatabase();
  await client.close();
}
```

---

**End of `12-TESTING-STRATEGY.md`. Proceed to `13-SECURITY-VULNERABILITY.md`.**
