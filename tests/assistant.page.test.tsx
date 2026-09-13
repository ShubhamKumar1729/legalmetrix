/**
 * The Compliance AI page: pick a real inspection, then ask about it.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/assistant.page.test.tsx
 */
import assert from 'node:assert/strict';
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

const INSPECTIONS = [
  {
    id: 'ins-1',
    inspectionNumber: 'LM-2026-000001',
    productName: 'Test Packaged Rice',
    brand: 'Test Brand',
    status: 'REVIEW_REQUIRED',
    createdAt: '2026-09-13T09:00:00.000Z',
  },
  {
    id: 'ins-2',
    inspectionNumber: 'LM-2026-000002',
    productName: 'Test Biscuit Pack',
    brand: 'Other Brand',
    status: 'COMPLIANT',
    createdAt: '2026-09-12T09:00:00.000Z',
  },
];

const SESSION = {
  user: { id: 'user-1', email: 'inspector@example.test', name: 'Test Inspector', role: 'ENFORCEMENT_OFFICER', officialId: 'OFF-1' },
  simpleRole: 'INSPECTOR',
  simpleRoleLabel: 'Inspector',
  permissions: ['inspection:read', 'inspection:create'],
  system: {
    datastore: 'memory',
    mongodbConfigured: false,
    ai: { providers: [], developmentMode: true },
    rulesPublished: 1,
    userCount: 1,
    bootstrapConfigured: true,
    uploads: { allowedFormats: ['JPEG'], maxBytes: 10485760, minDimensionPx: 320 },
  },
};

/** Records what the panel actually sent, so a test can prove the binding. */
const sentBodies: unknown[] = [];

async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];

  if (path === '/api/assistant') {
    const parsed = JSON.parse(String(init?.body ?? '{}'));
    sentBodies.push(parsed);
    const data = parsed.inspectionId
      ? {
          answer: `LM-2026-00000${parsed.inspectionId === 'ins-1' ? 1 : 2} has 1 confirmed violation(s).`,
          groundedIn: ['LM-2026-000001'],
          answered: true,
          inspectionId: parsed.inspectionId,
          needsInspection: false,
          source: 'stored-records',
        }
      : {
          answer: 'Which inspection would you like me to look at?',
          groundedIn: [],
          answered: false,
          inspectionId: null,
          needsInspection: true,
          source: 'stored-records',
        };
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data: unknown =
    path === '/api/auth/me'
      ? SESSION
      : path.startsWith('/api/inspections')
        ? { inspections: INSPECTIONS, total: INSPECTIONS.length }
        : {};
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

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
  const { render, screen, waitFor, fireEvent, cleanup } = await import('@testing-library/react');
  const { SessionProvider } = await import('../src/components/session-provider');

  async function openPage() {
    cleanup();
    sentBodies.length = 0;
    const page = (await import('../src/app/app/assistant/page')).default;
    render(React.createElement(SessionProvider, null, React.createElement(page)));
    await screen.findByText('Compliance AI', undefined, { timeout: 8000 });
  }

  async function ask(text: string) {
    const input = screen.getByLabelText('Ask the assistant') as HTMLInputElement;
    fireEvent.change(input, { target: { value: text } });
    fireEvent.click(screen.getByText('Ask').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.ok(sentBodies.length > 0, 'a question must be sent'), { timeout: 8000 });
  }

  console.log('\nLegalMetrix — Compliance AI page test (jsdom)\n');

  await step('the page lists real inspections to ask about', async () => {
    await openPage();
    await waitFor(() => assert.ok(body().includes('Test Packaged Rice'), 'inspections must load'), {
      timeout: 8000,
    });
    assert.ok(body().includes('LM-2026-000001'), 'the inspection number must be shown');
    assert.ok(body().includes('LM-2026-000002'), 'both stored inspections must be listed');
  });

  await step('with no inspection selected the assistant asks which one to use', async () => {
    await ask('What failed?');
    assert.deepEqual(
      sentBodies[0],
      { question: 'What failed?' },
      'no inspectionId may be sent when none is selected'
    );
    await waitFor(() => assert.ok(body().includes('Which inspection would you like me to look at?')), {
      timeout: 8000,
    });
  });

  await step('selecting an inspection binds the assistant to it', async () => {
    await openPage();
    await waitFor(() => assert.ok(body().includes('Test Packaged Rice')), { timeout: 8000 });

    fireEvent.click(screen.getByText('Test Packaged Rice').closest('button') as HTMLButtonElement);
    await ask('What failed?');

    assert.deepEqual(
      sentBodies[0],
      { question: 'What failed?', inspectionId: 'ins-1' },
      'the selected inspection must be sent with the question'
    );
    await waitFor(() => assert.ok(body().includes('has 1 confirmed violation'), 'the answer must render'), {
      timeout: 8000,
    });
  });

  await step('switching inspection starts a fresh thread bound to the new one', async () => {
    fireEvent.click(screen.getByText('Test Biscuit Pack').closest('button') as HTMLButtonElement);
    await ask('What failed?');

    const last = sentBodies[sentBodies.length - 1] as { inspectionId?: string };
    assert.equal(last.inspectionId, 'ins-2', 'the new selection must be used');
    // A stale thread from ins-1 would be misleading under ins-2.
    await waitFor(() => assert.equal(body().includes('LM-2026-000001 has 1 confirmed'), false, 'the old thread must be cleared'), {
      timeout: 8000,
    });
  });

  await step('the page says the answers are not invented', async () => {
    await openPage();
    await waitFor(() => assert.ok(body().includes('never from a model that might guess')), {
      timeout: 8000,
    });
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
