/**
 * Proves the assistant panel is actually mounted on the inspection result page.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/inspection.page.test.tsx
 *
 * The page is a client component that shows a skeleton until its fetch resolves, so
 * the panel is never in the server-rendered HTML. This renders the real page with a
 * stubbed API and checks the panel appears once the inspection has loaded.
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;

for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  try {
    Object.defineProperty(globalThis, key, {
      value: (window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  } catch {
    /* not configurable */
  }
}
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true });
Object.defineProperty(window.Element.prototype, 'scrollTo', { configurable: true, writable: true, value: () => undefined });

const INSPECTION = {
  id: 'ins-1',
  inspectionNumber: 'LM-2026-000001',
  productName: 'Test Packaged Rice',
  brand: 'Test Brand',
  category: 'FOOD',
  manufacturer: 'Test Foods Pvt Ltd',
  inspectorId: 'user-1',
  inspectorName: 'Test Inspector',
  status: 'REVIEW_REQUIRED' as const,
  source: 'FIELD' as const,
  images: [],
  startedAt: '2026-09-13T09:00:00.000Z',
  ruleSetVersion: 'LM-PC-2011',
  rulesEvaluated: 1,
  complianceScore: 0,
  scored: false,
  confidenceSummary: { average: 0, min: 0, max: 0, lowConfidenceCount: 1 },
  findings: [
    {
      id: 'find-1',
      inspectionId: 'ins-1',
      declarationType: 'MRP',
      title: 'MRP declaration',
      description: 'Retail sale price must be declared.',
      status: 'REVIEW' as const,
      severity: 'CRITICAL' as const,
      confidence: 0,
      ruleId: 'rule-1',
      ruleCode: 'LM-PC-2011-6(1)(e)',
      legalReference: 'Rule 6(1)(e)',
      evidence: [],
      reviewStatus: 'PENDING' as const,
      createdAt: '2026-09-13T09:02:00.000Z',
    },
  ],
  extractedFields: [],
  analysisNotes: ['No vision model is connected.'],
  reviewStatus: 'PENDING' as const,
  createdAt: '2026-09-13T09:00:00.000Z',
  updatedAt: '2026-09-13T09:02:00.000Z',
};

const SESSION = {
  user: { id: 'user-2', email: 'reviewer@example.test', name: 'Test Reviewer', role: 'REVIEWER', officialId: 'OFF-2' },
  simpleRole: 'REVIEWER',
  simpleRoleLabel: 'Reviewer',
  permissions: ['inspection:read', 'review:read', 'review:write', 'report:read'],
  system: {
    datastore: 'memory',
    mongodbConfigured: false,
    ai: { providers: [], developmentMode: true },
    rulesPublished: 1,
    userCount: 2,
    bootstrapConfigured: true,
    uploads: { allowedFormats: ['JPEG'], maxBytes: 10485760, minDimensionPx: 320 },
  },
};

async function mockFetch(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  // GET /api/inspections/:id returns the Inspection itself; the product route wraps history.
  const data: unknown = path.startsWith('/api/products/')
    ? { history: [] }
    : path.startsWith('/api/inspections/')
      ? INSPECTION
      : path === '/api/auth/me'
        ? SESSION
        : {};
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function load(request: string, ...rest: unknown[]) {
  if (request === 'next/navigation') {
    return {
      useParams: () => ({ id: 'ins-1' }),
      usePathname: () => '/app/inspections/ins-1',
      useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
    };
  }
  return originalLoad.call(this, request, ...rest);
};

let passed = 0;
const failures: string[] = [];

async function step(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(error as Error).message}`);
  }
}

function body() {
  return document.body.textContent || '';
}

async function main() {
  const { render, screen, waitFor, fireEvent } = await import('@testing-library/react');
  const { SessionProvider } = await import('../src/components/session-provider');

  console.log('\nLegalMetrix — inspection result page test (jsdom)\n');

  await step('the result page loads the inspection and mounts the assistant panel', async () => {
    const page = (await import('../src/app/app/inspections/[id]/page')).default;
    render(React.createElement(SessionProvider, null, React.createElement(page)));

    // The page renders a skeleton first; wait for real content.
    await screen.findByText('Findings', undefined, { timeout: 8000 });
    assert.ok(body().includes(INSPECTION.inspectionNumber), 'the inspection number must render');

    await waitFor(
      () => assert.ok(body().includes('Compliance assistant'), 'the assistant panel must be mounted'),
      { timeout: 8000 }
    );
    assert.ok(body().includes('There is no language model here'), 'the panel must state it is not a model');
    assert.ok(document.querySelector('input[aria-label="Ask the assistant"]'), 'the question input must render');
  });

  await step('an unscored inspection shows no invented score', async () => {
    const text = body();
    assert.ok(!/\b\d{1,3}\/100\b/.test(text.replace(/0\/100/g, '')), 'only a real 0/100 may appear, and only if scored');
    assert.ok(text.includes('No vision model is connected'), 'the stored analysis note must be shown');
  });

  await step('technical metadata stays collapsed until asked for', async () => {
    // Model version, processing time, OCR and bounding boxes belong behind a disclosure,
    // not in front of the compliance outcome.
    assert.ok(body().includes('Technical details'), 'the disclosure must be present');
    assert.equal(body().includes('AI run ID'), false, 'metadata must be hidden by default');

    fireEvent.click(screen.getByText('Technical details').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.ok(body().includes('AI run ID'), 'expanding must reveal the metadata'), {
      timeout: 8000,
    });
    assert.ok(body().includes('Processing time'), 'processing time must be shown');
    assert.ok(body().includes('Extracted fields'), 'the OCR section must be present');
    assert.ok(
      body().includes('No fields were extracted automatically'),
      'with no vision model it must say so rather than show an empty table as if it were data'
    );
    assert.ok(body().includes('Image metadata'), 'image metadata must be present');

    fireEvent.click(screen.getByText('Technical details').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(body().includes('AI run ID'), false, 'it must collapse again'), {
      timeout: 8000,
    });
  });

  await step('the page exposes the finding for review', async () => {
    const text = body();
    assert.ok(text.includes('MRP declaration'), 'the finding must be listed');
    assert.ok(text.includes('LM-PC-2011-6(1)(e)'), 'the rule code must be shown');
    assert.ok(text.includes('Confidence'), 'confidence must be shown');
  });

  (Module as unknown as { _load: Function })._load = originalLoad;

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
