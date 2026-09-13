/**
 * The product is built around three roles. The backend keeps finer-grained ones, but
 * an administrator creating an account should see three choices, not six.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/users.roles.test.tsx
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

const SESSION = {
  user: { id: 'user-1', email: 'admin@example.test', name: 'Test Admin', role: 'SUPER_ADMIN', officialId: 'OFF-1' },
  simpleRole: 'ADMIN',
  simpleRoleLabel: 'Administrator',
  permissions: ['user:read', 'user:write', 'inspection:read', 'audit:read'],
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
    path === '/api/auth/me' ? SESSION : path === '/api/users' ? { users: [], total: 0 } : {};
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

function roleOptions() {
  return Array.from(document.querySelectorAll('#user-role option')).map((option) => ({
    value: (option as HTMLOptionElement).value,
    label: option.textContent?.trim() || '',
  }));
}

async function main() {
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { SessionProvider } = await import('../src/components/session-provider');

  async function openForm() {
    cleanup();
    const page = (await import('../src/app/app/admin/users/page')).default;
    render(React.createElement(SessionProvider, null, React.createElement(page)));
    await screen.findByText('New User', undefined, { timeout: 8000 });
    fireEvent.click(screen.getByText('New User').closest('button') as HTMLButtonElement);
    await screen.findByLabelText(/^role/i, undefined, { timeout: 8000 });
  }

  console.log('\nLegalMetrix — user roles test (jsdom)\n');

  await step('creating an account offers exactly the three product roles', async () => {
    await openForm();
    const options = roleOptions();
    assert.equal(options.length, 3, `expected 3 roles, found ${JSON.stringify(options)}`);
    assert.deepEqual(
      options.map((option) => option.value),
      ['ENFORCEMENT_OFFICER', 'REVIEWER', 'REGULATORY_ADMIN'],
      'the three primary roles must be the whole list'
    );
    for (const label of ['Inspector', 'Reviewer', 'Administrator']) {
      assert.ok(
        options.some((option) => option.label.startsWith(label)),
        `"${label}" must be offered (found ${JSON.stringify(options.map((o) => o.label))})`
      );
    }
  });

  await step('the extra backend roles stay available behind an explicit toggle', async () => {
    await openForm();
    assert.equal(roleOptions().length, 3, 'they must be hidden by default');

    fireEvent.click(screen.getByText('More roles').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.ok(roleOptions().length > 3, 'the extra roles must appear'), { timeout: 8000 });

    const values = roleOptions().map((option) => option.value);
    for (const extra of ['ANALYST', 'AUDITOR', 'SUPER_ADMIN']) {
      assert.ok(values.includes(extra), `"${extra}" must still be assignable`);
    }

    fireEvent.click(screen.getByText('Fewer roles').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(roleOptions().length, 3, 'they must hide again'), { timeout: 8000 });
  });

  await step('each choice explains itself in plain language', async () => {
    await openForm();
    // The default is Inspector.
    assert.ok(body().includes('Captures packages and submits inspections'));

    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'REVIEWER' } });
    await waitFor(() => assert.ok(body().includes('Reviews uncertain or flagged findings')), { timeout: 8000 });

    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'REGULATORY_ADMIN' } });
    await waitFor(() => assert.ok(body().includes('Manages rules, users and system configuration')), {
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
