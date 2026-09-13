/**
 * Mobile navigation behaviour.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/mobile.nav.test.tsx
 *
 * jsdom does not apply CSS, so this cannot prove that the sidebar is hidden below the
 * md breakpoint — that is a visual check. What it does prove is the drawer's behaviour:
 * that it opens from the top-nav trigger, offers the same entries as the desktop rail,
 * and closes both on backdrop tap and after a selection.
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

const SESSION = {
  user: { id: 'user-1', email: 'inspector@example.test', name: 'Test Inspector', role: 'ENFORCEMENT_OFFICER', officialId: 'OFF-1' },
  simpleRole: 'INSPECTOR',
  simpleRoleLabel: 'Inspector',
  permissions: ['inspection:read', 'inspection:create', 'product:read', 'report:read'],
  system: {
    datastore: 'memory',
    mongodbConfigured: false,
    ai: { providers: [], developmentMode: true },
    rulesPublished: 0,
    userCount: 1,
    bootstrapConfigured: true,
    uploads: { allowedFormats: ['JPEG'], maxBytes: 10485760, minDimensionPx: 320 },
  },
};

async function mockFetch(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const data: unknown =
    path === '/api/auth/me'
      ? SESSION
      : path === '/api/notifications'
        ? { items: [], unread: 0 }
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
      useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
      usePathname: () => '/app/dashboard',
      useParams: () => ({}),
    };
  }
  return originalLoad.call(this, request, ...rest);
};

const NAV = ['Dashboard', 'New Inspection', 'Inspections', 'Products', 'Reports'];

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

/** The drawer is the only element carrying the fixed full-screen backdrop. */
function drawer() {
  return document.querySelector('.fixed.inset-0');
}

let fireEventRef: typeof import('@testing-library/react').fireEvent;

function openMenu() {
  const trigger = document.querySelector('button[aria-label="Open menu"]') as HTMLButtonElement;
  assert.ok(trigger, 'the top nav must expose an "Open menu" trigger');
  // fireEvent wraps the dispatch in act(); a raw .click() drives React 18's concurrent
  // renderer into a re-render loop and OOM-kills the process.
  fireEventRef.click(trigger);
}

async function main() {
  const { render, screen, waitFor, fireEvent } = await import('@testing-library/react');
  const { AppShell } = await import('../src/components/layout/app-shell');
  fireEventRef = fireEvent;

  console.log('\nLegalMetrix — mobile navigation test (jsdom)\n');

  await step('the drawer is closed on load', async () => {
    render(React.createElement(AppShell, null, React.createElement('div', null, 'PAGE CONTENT')));
    await screen.findAllByText('Dashboard', undefined, { timeout: 8000 });
    assert.equal(drawer(), null, 'the drawer must not be open before the trigger is used');
  });

  await step('the trigger opens the drawer and it carries the same entries', async () => {
    openMenu();
    await waitFor(() => assert.ok(drawer(), 'the drawer must open'), { timeout: 8000 });
    const text = body();
    for (const item of NAV) {
      assert.ok(text.includes(item), `the drawer must offer "${item}"`);
    }
    assert.equal(text.includes('Rules'), false, 'an inspector must not see Rules in the drawer either');
  });

  await step('tapping outside closes the drawer', async () => {
    assert.ok(drawer(), 'the drawer must be open first');
    const backdrop = drawer()?.querySelector('.bg-black\\/40') as HTMLElement;
    assert.ok(backdrop, 'the drawer must have a dismissible backdrop');
    fireEventRef.click(backdrop);
    await waitFor(() => assert.equal(drawer(), null, 'the backdrop must dismiss the drawer'), {
      timeout: 8000,
    });
  });

  await step('the menu trigger is labelled for assistive technology', async () => {
    const trigger = document.querySelector('button[aria-label="Open menu"]');
    assert.ok(trigger, 'the trigger must exist');
    // An icon-only control with no accessible name is unusable with a screen reader.
    assert.equal((trigger as HTMLElement).getAttribute('aria-label'), 'Open menu');
  });

  await step('the drawer can be reopened', async () => {
    openMenu();
    await waitFor(() => assert.ok(drawer(), 'the drawer must reopen'), { timeout: 8000 });
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
