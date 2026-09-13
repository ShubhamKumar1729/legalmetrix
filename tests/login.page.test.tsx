/**
 * Sign-in must not fail silently.
 *
 * A 200 from POST /api/auth/login proves the credentials were right and that the server
 * sent a session cookie. It does not prove the browser kept it: inside a cross-site iframe
 * the cookie can be blocked outright, and navigating anyway lands the user back on this
 * page with no error anywhere — indistinguishable from a wrong password. The page now
 * confirms the session landed before navigating, and says so when it did not.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/login.page.test.tsx
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
import React from 'react';

// ---------------------------------------------------------------------------
// jsdom harness
// ---------------------------------------------------------------------------

const navigationAttempts: string[] = [];
const virtualConsole = new VirtualConsole();
// jsdom refuses real navigation and reports it here, which is exactly the signal
// this suite needs in order to tell "navigated" from "stayed on the page".
virtualConsole.on('jsdomError', (error) => {
  if (error.message.includes('navigation')) navigationAttempts.push(error.message);
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/login',
  pretendToBeVisual: true,
  virtualConsole,
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

// The page uses next/link, which needs the router context the app shell provides.
const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function load(request: string, ...rest: unknown[]) {
  if (request === 'next/link') {
    return {
      __esModule: true,
      default: ({ children, href }: { children: React.ReactNode; href: string }) =>
        React.createElement('a', { href }, children),
    };
  }
  return originalLoad.call(this, request, ...rest);
};

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

const SESSION = {
  user: { id: 'user-1', email: 'inspector@legalmetrix.local', name: 'Inspector', role: 'SUPER_ADMIN', officialId: 'OFF-1' },
  simpleRole: 'ADMIN',
  simpleRoleLabel: 'Administrator',
  permissions: ['inspection:read'],
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

interface Behaviour {
  /** What POST /api/auth/login returns. */
  login: { status: number; body: unknown };
  /** What the follow-up GET /api/auth/me returns — i.e. whether the cookie stuck. */
  me: { status: number; body: unknown };
}

const calls: string[] = [];
let behaviour: Behaviour = {
  login: { status: 200, body: { success: true, data: { token: 'jwt' } } },
  me: { status: 200, body: { success: true, data: SESSION } },
};

function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const method = (init?.method || 'GET').toUpperCase();
  calls.push(`${method} ${path}`);

  const spec =
    path === '/api/auth/login' && method === 'POST'
      ? behaviour.login
      : path === '/api/auth/me'
        ? behaviour.me
        : path === '/api/auth/status'
          ? { status: 200, body: { success: true, data: { hasUsers: true, bootstrapConfigured: true, rulesPublished: 0, aiDevelopmentMode: true, datastore: 'memory' } } }
          : { status: 200, body: { success: true, data: {} } };

  return Promise.resolve(
    new Response(JSON.stringify(spec.body), {
      status: spec.status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

// ---------------------------------------------------------------------------
// suite
// ---------------------------------------------------------------------------

let passed = 0;
const failures: string[] = [];

async function step(name: string, fn: () => Promise<void>) {
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

const BLOCKED_HINT = 'your browser blocked the session cookie';

async function main() {
  const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const LoginPage = (await import('../src/app/login/page')).default;

  /** Renders the page, submits credentials, and returns once the page settles. */
  async function signIn() {
    navigationAttempts.length = 0;
    calls.length = 0;
    cleanup();
    render(React.createElement(LoginPage));
    await waitFor(() => assert.ok(document.querySelector('#email'), 'the form should render'));

    const email = document.querySelector('#email') as HTMLInputElement;
    const password = document.querySelector('#password') as HTMLInputElement;
    // fireEvent.change with a target is what drives React's onChange; assigning .value
    // directly leaves the controlled input empty, and jsdom then refuses to submit the
    // form because both fields are required.
    fireEvent.change(email, { target: { value: 'inspector@legalmetrix.local' } });
    fireEvent.change(password, { target: { value: 'Preview-Password-2026' } });
    assert.equal(email.value, 'inspector@legalmetrix.local', 'the email field must hold its value');
    assert.equal(password.value, 'Preview-Password-2026', 'the password field must hold its value');

    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => {
      assert.ok(
        navigationAttempts.length > 0 || body().includes(BLOCKED_HINT) || body().includes('Incorrect'),
        `the page should either navigate or explain itself; got "${body().slice(0, 200)}"`
      );
    });
  }

  console.log('\nLegalMetrix — login page test\n');

  await step('signs in and navigates when the session cookie sticks', async () => {
    behaviour = {
      login: { status: 200, body: { success: true, data: { token: 'jwt' } } },
      me: { status: 200, body: { success: true, data: SESSION } },
    };
    await signIn();

    assert.ok(
      calls.includes('GET /api/auth/me'),
      'login must confirm the session before navigating'
    );
    assert.ok(navigationAttempts.length > 0, 'a working session should navigate to the dashboard');
    assert.ok(!body().includes(BLOCKED_HINT), 'no cookie warning when the session works');
  });

  await step('says so instead of bouncing when the browser dropped the cookie', async () => {
    // The exact production failure: credentials accepted, cookie issued, but the browser
    // refuses to send it back, so the very next request is a 401.
    behaviour = {
      login: { status: 200, body: { success: true, data: { token: 'jwt' } } },
      me: { status: 401, body: { success: false, error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } } },
    };
    await signIn();

    assert.equal(navigationAttempts.length, 0, 'navigating here would bounce straight back to /login');
    assert.ok(body().includes(BLOCKED_HINT), `expected the blocked-cookie explanation; got "${body().slice(0, 300)}"`);
    assert.ok(
      body().includes('own browser tab'),
      'the message should tell the user what to do about it'
    );
  });

  await step('still reports a wrong password as a wrong password', async () => {
    behaviour = {
      login: {
        status: 401,
        body: { success: false, error: { code: 'AUTH_FAILED', message: 'Incorrect email or password.' } },
      },
      me: { status: 401, body: { success: false } },
    };
    await signIn();

    assert.equal(navigationAttempts.length, 0);
    assert.ok(body().includes('Incorrect email or password'), 'the API message should be surfaced verbatim');
    assert.ok(
      !body().includes(BLOCKED_HINT),
      'a rejected password must not be reported as a cookie problem'
    );
    assert.ok(
      !calls.includes('GET /api/auth/me'),
      'no point confirming a session when the login itself was rejected'
    );
  });

  cleanup();
  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    for (const failure of failures) console.log(`  FAIL ${failure}`);
    process.exit(1);
  }
}

void main();
