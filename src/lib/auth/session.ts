import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken, type SessionUser } from './auth';
import {
  hasPermission,
  permissionsFor,
  simpleRole,
  SIMPLE_ROLE_LABEL,
  type Permission,
} from './rbac';

export function getSessionUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message } }, { status: 401 });
}

export function forbidden(message = 'You do not have permission to perform this action') {
  return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message } }, { status: 400 });
}

/** Returns the signed-in user or a ready-to-return 401 response. */
export function requireUser(): SessionUser | NextResponse {
  const user = getSessionUser();
  return user ?? unauthorized();
}

/** Returns the signed-in user if they hold `permission`, otherwise a 401/403 response. */
export function requirePermission(permission: Permission): SessionUser | NextResponse {
  const user = getSessionUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.role, permission)) return forbidden();
  return user;
}

export function isResponse(value: SessionUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

/** The shape the client receives after a successful sign-in. */
export function sessionPayload(user: SessionUser) {
  const simple = simpleRole(user.role);
  return {
    user,
    simpleRole: simple,
    simpleRoleLabel: SIMPLE_ROLE_LABEL[simple],
    permissions: permissionsFor(user.role),
  };
}
