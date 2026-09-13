/**
 * Renders the real page components against an empty API and asserts that an empty
 * database produces zero values and designed empty states — never invented numbers.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/ui.empty.test.tsx
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

/* recharts / responsive helpers that jsdom does not provide */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverStub, configurable: true });
Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, configurable: true });
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => null,
});
// jsdom throws "Not implemented" on navigation; record it instead so a page that
// redirects a signed-in user fails the test rather than crashing the runner.
const navigations: string[] = [];
for (const method of ['assign', 'replace'] as const) {
  Object.defineProperty(window.Location.prototype, method, {
    configurable: true,
    writable: true,
    value: (url: string) => {
      navigations.push(url);
    },
  });
}
Object.defineProperty(window, 'onbeforeunload', { configurable: true, writable: true, value: null });

/* ------------------------------------------------------- empty API mock */

const SESSION = {
  user: {
    id: 'user-1',
    email: 'inspector@example.test',
    name: 'Test Inspector',
    role: 'INSPECTOR',
    officialId: 'OFF-1',
  },
  simpleRole: 'INSPECTOR',
  simpleRoleLabel: 'Inspector',
  permissions: ['inspection:create', 'inspection:read', 'product:read', 'report:read', 'rule:read', 'review:read'],
  system: {
    datastore: 'memory',
    mongodbConfigured: false,
    ai: { providers: [{ name: 'development', version: '1.0.0', development: true }], developmentMode: true },
    rulesPublished: 0,
    userCount: 1,
    bootstrapConfigured: true,
    uploads: { allowedFormats: ['JPEG', 'PNG', 'WEBP'], maxBytes: 10485760, minDimensionPx: 320 },
  },
};

const requested: string[] = [];

// Node's undici Response; jsdom does not provide one.
function envelope(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMPTY_ROUTES: Record<string, unknown> = {
  '/api/auth/me': SESSION,
  '/api/auth/status': {
    hasUsers: true,
    bootstrapConfigured: true,
    rulesPublished: 0,
    aiDevelopmentMode: true,
    datastore: 'memory',
  },
  '/api/analytics': {
    kpis: {
      totalInspections: 0,
      complianceRate: 0,
      compliant: 0,
      violations: 0,
      reviewRequired: 0,
      pendingReviews: 0,
    },
    hasData: false,
    overTime: [],
    categoryDistribution: [],
  },
  '/api/inspections': { inspections: [], total: 0 },
  '/api/products': { products: [], total: 0 },
  '/api/reports': { reports: [], total: 0 },
  '/api/rules': { rules: [], total: 0, versions: [] },
  '/api/ecommerce/analyze': { configured: false, provider: null },
  '/api/ecommerce/listings': { listings: [], total: 0 },
  '/api/notifications': { notifications: [], unread: 0 },
  '/api/configuration': { retentionDays: 365, confidenceThresholdHigh: 90, confidenceThresholdMedium: 60 },
};

async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  requested.push(path);
  if (path in EMPTY_ROUTES) return envelope(EMPTY_ROUTES[path]);
  return new Response(JSON.stringify({ success: true, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

/* ------------------------------------------------------------- harness */
/* ------------------------------------------------------------- harness */


async function main() {
  const { render, screen, waitFor, cleanup } = await import('@testing-library/react');
  const { SessionProvider } = await import('../src/components/session-provider');

  let passed = 0;
  const failures: string[] = [];

  async function renderPage(name: string, loader: () => Promise<{ default: React.ComponentType<any> }>, props: Record<string, unknown> = {}) {
    cleanup();
    requested.length = 0;
    navigations.length = 0;
    const page = (await loader()).default;
    render(React.createElement(SessionProvider, null, React.createElement(page, props)));
    // Wait for the empty state to appear, which proves data loading has settled.
    await waitFor(() => {
      const body = document.body.textContent || '';
      assert.ok(body.length > 0);
    }, { timeout: 5000 });
    return { name };
  }

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

  function numbersInBody() {
    // Strip the app name, dates and CSS noise before looking for invented figures.
    return body();
  }

  console.log('\nLegalMetrix — empty-database UI test (jsdom)\n');

  await step('the dashboard shows zero KPIs and a first-inspection empty state', async () => {
    await renderPage('dashboard', () => import('../src/app/app/dashboard/page'));
    await screen.findByText('No inspections yet', undefined, { timeout: 8000 });

    const text = body();
    assert.ok(text.includes('Total Inspections'), 'Total Inspections KPI must be present');
    assert.ok(text.includes('Compliance Rate'), 'Compliance Rate KPI must be present');
    assert.ok(text.includes('Review Required'), 'Review Required KPI must be present');
    assert.ok(text.includes('Violations'), 'Violations KPI must be present');
    assert.ok(text.includes('Start New Inspection'), 'the primary CTA must be present');
    assert.ok(
      text.includes('Start your first inspection to begin building your compliance records.'),
      'the empty-database subtitle must be shown instead of a personalised greeting'
    );

    // Every KPI must read zero on an empty database.
    const cards = Array.from(document.querySelectorAll('[class*="text-3xl"]')).map((node) => node.textContent?.trim());
    assert.ok(cards.length >= 4, `expected 4 KPI values, found ${cards.length}`);
    for (const value of cards.slice(0, 4)) {
      assert.ok(value === '0' || value === '0%', `KPI must be zero on an empty database, found "${value}"`);
    }

    // No chart may be rendered from invented data.
    assert.equal(document.querySelectorAll('.recharts-surface').length, 0, 'no charts on an empty database');
    assert.ok(!/Welcome back/.test(text), 'the personalised greeting must not appear without data');

    // The analytics card must explain itself rather than render an empty chart.
    assert.ok(
      text.includes('Analytics will appear after inspections are completed.'),
      'the analytics panel must show its empty state on an empty database'
    );
    assert.ok(text.includes('Compliance Overview'), 'the analytics card must still be titled');
  });

  await step('the products page shows its empty state', async () => {
    await renderPage('products', () => import('../src/app/app/products/page'));
    await screen.findByText('No products inspected yet', undefined, { timeout: 8000 });
    assert.ok(body().includes('Start an inspection to automatically create your first product record.'));
  });

  await step('the reports page shows its empty state', async () => {
    await renderPage('reports', () => import('../src/app/app/reports/page'));
    await screen.findByText('No reports generated yet', undefined, { timeout: 8000 });
  });

  await step('the review page shows its empty state', async () => {
    await renderPage('review', () => import('../src/app/app/review/page'));
    await screen.findByText('No findings currently require review', undefined, { timeout: 8000 });
  });

  await step('the rules page shows its empty state', async () => {
    await renderPage('rules', () => import('../src/app/app/rules/page'));
    await screen.findByText('No regulatory rules configured yet', undefined, { timeout: 8000 });
  });

  await step('the inspections page shows its empty state', async () => {
    await renderPage('inspections', () => import('../src/app/app/inspections/page'));
    await screen.findByText('No inspections yet', undefined, { timeout: 8000 });
  });

  await step('the e-commerce page shows its empty state', async () => {
    await renderPage('ecommerce', () => import('../src/app/app/ecommerce/page'));
    await screen.findByText('No e-commerce listings analyzed yet', undefined, { timeout: 8000 });
  });

  await step('no page mentions demo mode or sample data', async () => {
    const pages: [string, () => Promise<{ default: React.ComponentType<any> }>][] = [
      ['dashboard', () => import('../src/app/app/dashboard/page')],
      ['products', () => import('../src/app/app/products/page')],
      ['reports', () => import('../src/app/app/reports/page')],
      ['review', () => import('../src/app/app/review/page')],
      ['rules', () => import('../src/app/app/rules/page')],
      ['inspections', () => import('../src/app/app/inspections/page')],
      ['ecommerce', () => import('../src/app/app/ecommerce/page')],
    ];
    for (const [name, loader] of pages) {
      await renderPage(name, loader);
      await new Promise((resolve) => setTimeout(resolve, 60));
      const text = numbersInBody().toLowerCase();
      for (const forbidden of ['demo mode', 'demo data', 'sample data', 'try demo', 'load sample', 'fake']) {
        assert.ok(!text.includes(forbidden), `${name} must not mention "${forbidden}"`);
      }
      assert.equal(navigations.length, 0, `${name} must not redirect a signed-in user`);
    }
  });

  async function renderSidebar(permissions: string[]) {
    cleanup();
    const previous = EMPTY_ROUTES['/api/auth/me'];
    EMPTY_ROUTES['/api/auth/me'] = { ...SESSION, permissions };
    const { Sidebar } = await import('../src/components/layout/sidebar');
    render(
      React.createElement(
        SessionProvider,
        null,
        React.createElement(
          'div',
          null,
          React.createElement(Sidebar, { collapsed: false, setCollapsed: () => undefined })
        )
      )
    );
    await screen.findByText('Dashboard', undefined, { timeout: 8000 });
    const links = Array.from(document.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    EMPTY_ROUTES['/api/auth/me'] = previous;
    return links;
  }

  await step('the sidebar exposes the simplified navigation', async () => {
    const links = await renderSidebar([
      'inspection:create',
      'inspection:read',
      'review:read',
      'product:read',
      'report:read',
      'ecommerce:analyze',
      'rule:read',
      'user:read',
    ]);
    for (const label of [
      'Dashboard',
      'New Inspection',
      'Inspections',
      'Review',
      'Products',
      'Reports',
      'E-commerce',
      'Rules',
      'Admin',
      'Compliance AI',
    ]) {
      assert.ok(links.includes(label), `the "${label}" entry must be present (found ${JSON.stringify(links)})`);
    }
    assert.equal(links.length, 10, `navigation should hold exactly 10 entries, found ${JSON.stringify(links)}`);
    for (const removed of ['Analytics', 'History', 'Evidence', 'Scan', 'Notifications']) {
      assert.ok(!links.includes(removed), `"${removed}" must not be a top-level navigation entry`);
    }
    assert.ok(
      links.includes('Compliance AI'),
      'the assistant is a real page, so it must be reachable from the navigation'
    );
  });

  await step('navigation is limited to what the signed-in role may open', async () => {
    const links = await renderSidebar(['inspection:create', 'inspection:read', 'product:read', 'report:read']);
    assert.ok(links.includes('Dashboard'), 'every role keeps the dashboard');
    assert.ok(!links.includes('Admin'), 'an inspector must not see Admin');
    assert.ok(!links.includes('Review'), 'without review:read the Review queue is hidden');
    assert.ok(!links.includes('Rules'), 'without rule:read the Rules page is hidden');
  });


console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}
process.exit(0);
}

void main();
