/**
 * Session cookie attributes.
 *
 *   npx tsx tests/session-cookie.test.ts
 *
 * A wrong SameSite or Secure flag does not look like a cookie bug — it looks like a
 * broken login. The browser accepts the sign-in, then refuses to return the cookie, and
 * the next authenticated request 401s the user back to /login. That failure is invisible
 * to a curl-based test, which is how it shipped in the first place.
 */
import assert from 'node:assert/strict';
import { sessionCookieAttributes } from '../src/lib/auth/cookie';

function request(opts: { proto?: string | null; protocol?: string }) {
  const headers = new Headers();
  if (opts.proto !== null && opts.proto !== undefined) headers.set('x-forwarded-proto', opts.proto);
  const url = `${opts.protocol === 'https:' ? 'https' : 'http'}://localhost:3000/api/auth/login`;
  return { headers, nextUrl: { protocol: opts.protocol || 'http:' } } as never;
}

/**
 * Next's typings mark process.env.NODE_ENV read-only, and Object.defineProperty rejects
 * the process.env object outright, so the only way to drive both branches is a cast.
 */
const env = process.env as { NODE_ENV?: string };

function withNodeEnv(value: string, fn: () => void) {
  const previous = env.NODE_ENV;
  env.NODE_ENV = value;
  try {
    fn();
  } finally {
    env.NODE_ENV = previous;
  }
}

let passed = 0;
const failures: string[] = [];

function step(name: string, fn: () => void) {
  const previous = process.env.SESSION_COOKIE_SAME_SITE;
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(error as Error).message}`);
  } finally {
    if (previous === undefined) delete process.env.SESSION_COOKIE_SAME_SITE;
    else process.env.SESSION_COOKIE_SAME_SITE = previous;
  }
}

console.log('\nLegalMetrix — session cookie test\n');

step('defaults to SameSite=Lax, the safer CSRF posture', () => {
  delete process.env.SESSION_COOKIE_SAME_SITE;
  const attrs = sessionCookieAttributes(request({ proto: 'http' }));
  assert.equal(attrs.sameSite, 'lax');
});

step('marks the cookie Secure when the request arrived over HTTPS', () => {
  delete process.env.SESSION_COOKIE_SAME_SITE;
  // Behind a TLS-terminating proxy the app sees http and runs in development, but the
  // browser is on HTTPS. Keying Secure off NODE_ENV instead loses the flag there.
  withNodeEnv('development', () => {    const attrs = sessionCookieAttributes(request({ proto: 'https' }));
    assert.equal(attrs.secure, true, 'a proxied HTTPS request must still get a Secure cookie');
  });
});

step('does not mark the cookie Secure on plain HTTP in development', () => {
  delete process.env.SESSION_COOKIE_SAME_SITE;
  withNodeEnv('development', () => {    const attrs = sessionCookieAttributes(request({ proto: 'http' }));
    assert.equal(attrs.secure, false, 'a Secure cookie over http:// would be dropped by the browser');
  });
});

step('SameSite=None forces Secure, which browsers require', () => {
  process.env.SESSION_COOKIE_SAME_SITE = 'none';
  withNodeEnv('development', () => {    const attrs = sessionCookieAttributes(request({ proto: 'http' }));
    assert.equal(attrs.sameSite, 'none');
    assert.equal(attrs.secure, true, 'SameSite=None without Secure is rejected outright');
  });
});

step('partitions the cookie in SameSite=None mode so it survives a cross-site iframe', () => {
  // Without Partitioned the cookie is a plain third-party cookie and is dropped by
  // default in an iframe: login sets it, the next request arrives without it, and the
  // user is bounced straight back to /login.
  process.env.SESSION_COOKIE_SAME_SITE = 'none';
  withNodeEnv('development', () => {    const attrs = sessionCookieAttributes(request({ proto: 'http' }));
    assert.equal(attrs.partitioned, true, 'CHIPS is what lets a cross-site iframe keep the session');
  });
});

step('does not partition a normal same-site deployment', () => {
  // Partitioned cookies are only honoured with SameSite=None and Secure, so applying it
  // to a lax deployment would add an attribute browsers ignore at best.
  for (const mode of ['lax', 'strict', 'nonsense']) {
    process.env.SESSION_COOKIE_SAME_SITE = mode;
    const attrs = sessionCookieAttributes(request({ proto: 'https' }));
    assert.equal(attrs.partitioned, false, `SameSite=${mode} must not be partitioned`);
  }
  delete process.env.SESSION_COOKIE_SAME_SITE;
  const attrs = sessionCookieAttributes(request({ proto: 'https' }));
  assert.equal(attrs.partitioned, false, 'the unset default (lax) must not be partitioned');
});

step('accepts an explicit strict setting', () => {
  process.env.SESSION_COOKIE_SAME_SITE = 'STRICT';
  const attrs = sessionCookieAttributes(request({ proto: 'https' }));
  assert.equal(attrs.sameSite, 'strict');
});

step('falls back to Lax on an unrecognised value', () => {
  process.env.SESSION_COOKIE_SAME_SITE = 'nonsense';
  const attrs = sessionCookieAttributes(request({ proto: 'http' }));
  assert.equal(attrs.sameSite, 'lax');
});

step('the cookie is always HttpOnly and scoped to the site root', () => {
  delete process.env.SESSION_COOKIE_SAME_SITE;
  const attrs = sessionCookieAttributes(request({ proto: 'https' }));
  assert.equal(attrs.httpOnly, true, 'the session token must never be readable by script');
  assert.equal(attrs.path, '/');
  assert.equal(attrs.maxAge, 60 * 60 * 24 * 7);
});

step('trusts the first entry of a multi-proxy x-forwarded-proto chain', () => {
  delete process.env.SESSION_COOKIE_SAME_SITE;
  withNodeEnv('development', () => {    const attrs = sessionCookieAttributes(request({ proto: 'https, http' }));
    assert.equal(attrs.secure, true);
  });
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}
process.exit(0);
