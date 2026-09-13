import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticateUser, SESSION_COOKIE } from '@/lib/auth/auth';
import { sessionCookieAttributes } from '@/lib/auth/cookie';
import { sessionPayload, badRequest } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/audit';
import { ensureBootstrapAdmin } from '@/lib/db/bootstrap';
import { db } from '@/lib/db/repository';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({}));

    if (!email || !password) {
      return badRequest('Email and password are required.');
    }

    await ensureBootstrapAdmin();

    const result = await authenticateUser(String(email), String(password));

    if (!result) {
      const userCount = await db.users.count();
      const message =
        userCount === 0
          ? 'No user accounts exist yet. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD, then restart the application to create the first administrator.'
          : 'Incorrect email or password.';
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_FAILED', message } },
        { status: 401 }
      );
    }

    cookies().set(SESSION_COOKIE, result.token, sessionCookieAttributes(req));

    await logAudit({
      userId: result.user.id,
      userName: result.user.name,
      role: result.user.role,
      action: 'LOGIN',
      resource: 'AUTH',
      resourceId: result.user.id,
      ip: req.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true, data: sessionPayload(result.user) });
  } catch (error) {
    console.error('[auth] login failed:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Sign in failed. Please try again.' } },
      { status: 500 }
    );
  }
}
