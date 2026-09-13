import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth/auth';
import { sessionCookieAttributes } from '@/lib/auth/cookie';
import { getSessionUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/audit';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (user) {
    await logAudit({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'LOGOUT',
      resource: 'AUTH',
      resourceId: user.id,
    });
  }
  const { maxAge, ...attributes } = sessionCookieAttributes(req);
  cookies().set(SESSION_COOKIE, '', { ...attributes, maxAge: 0 });
  return NextResponse.json({ success: true });
}
