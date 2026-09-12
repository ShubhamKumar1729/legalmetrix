import { NextRequest, NextResponse } from 'next/server';
import { withoutSessionCookie } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/audit';
import { getSessionUser } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
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
  return withoutSessionCookie(NextResponse.json({ success: true }));
}
