import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';

/** GET /api/auth/me — who am I? Used by the app shell to show the signed-in user. */
export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not signed in' } }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: user });
}
