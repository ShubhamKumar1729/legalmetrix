import type { NextRequest } from 'next/server';

/**
 * Attributes for the session cookie.
 *
 * Getting this wrong looks like a broken login rather than a broken cookie: the sign-in
 * request succeeds and sets the cookie, the browser then declines to send it back, and
 * the very next authenticated request is a 401 that bounces the user to /login.
 *
 * Two rules drive this:
 *
 * 1. `Secure` is required for the cookie to be sent over HTTPS-only contexts, and is
 *    rejected outright by browsers when `SameSite=None`. It must follow the protocol the
 *    request actually arrived on, not NODE_ENV — behind a TLS-terminating proxy the app
 *    itself still sees http and still runs in development mode.
 *
 * 2. `SameSite=Lax` cookies are not sent in a cross-site context. An app embedded in an
 *    iframe on another domain — how a hosted preview is shown — needs `SameSite=None`.
 *    That weakens CSRF protection, so it is opt-in rather than the default.
 */

export type SameSiteSetting = 'lax' | 'strict' | 'none';

function configuredSameSite(): SameSiteSetting {
  const value = (process.env.SESSION_COOKIE_SAME_SITE || '').toLowerCase();
  if (value === 'none' || value === 'strict' || value === 'lax') return value;
  return 'lax';
}

/** True when the client reached us over HTTPS, including through a proxy. */
function arrivedOverHttps(req: NextRequest): boolean {
  const forwarded = req.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  return req.nextUrl.protocol === 'https:';
}

export function sessionCookieAttributes(req: NextRequest) {
  const sameSite = configuredSameSite();
  // Browsers reject SameSite=None without Secure, so this is forced rather than inferred.
  const secure = sameSite === 'none' ? true : arrivedOverHttps(req) || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
