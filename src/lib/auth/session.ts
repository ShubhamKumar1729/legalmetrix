/**
 * Session handling — shared by the login route and every protected API route.
 *
 * A JWT is delivered in TWO ways so both browser pages and API clients work:
 *  1. httpOnly cookie  → automatically sent by the browser (all UI fetches, <img> tags)
 *  2. Authorization: Bearer <token> → for scripted/external API clients
 *
 * Usage inside a route handler:
 *
 *   const denied = await guardRequest(req, 'rule:write');
 *   if (denied) return denied;
 *
 * This makes the RBAC claim in the README true: permissions are enforced
 * on the server, not just hidden in the UI.
 */
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@/types';
import { hasPermission, type Permission } from './rbac';

export const SESSION_COOKIE = 'lm_session';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-key-for-sih-26034-must-be-32-chars-long';
const EXPIRES_IN = process.env.AUTH_EXPIRES_IN || '7d';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  officialId: string;
}

export function signSession(user: SessionUser): string {
  return jwt.sign({ ...user }, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SECRET) as SessionUser;
  } catch {
    return null;
  }
}

/** Attach the session cookie to a response (used by /api/auth/login). */
export function withSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

/** Clear the session cookie (used by /api/auth/logout). */
export function withoutSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  return cookie || null;
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  const token = extractToken(req);
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Returns undefined when access is allowed, or a ready-to-return 401/403 response.
 */
export function guardRequest(req: NextRequest, permission?: Permission): NextResponse | undefined {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } },
      { status: 401 }
    );
  }
  if (permission && !hasPermission(user.role, permission)) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: `Your role (${user.role.replace(/_/g, ' ')}) is not allowed to do this.` } },
      { status: 403 }
    );
  }
  return undefined;
}
