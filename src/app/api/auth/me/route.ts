import { NextResponse } from 'next/server';
import { getSessionUser, sessionPayload, unauthorized } from '@/lib/auth/session';
import { getSystemStatus } from '@/lib/system/info';

export async function GET() {
  const user = getSessionUser();
  if (!user) return unauthorized();
  const system = await getSystemStatus();
  return NextResponse.json({ success: true, data: { ...sessionPayload(user), system } });
}
