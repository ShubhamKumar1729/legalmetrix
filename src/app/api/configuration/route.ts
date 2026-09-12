import { NextRequest, NextResponse } from 'next/server';
import { guardRequest } from '@/lib/auth/session';
import { getSystemConfig, updateSystemConfig } from '@/lib/config/system';

export async function GET(req: NextRequest) {
  const denied = guardRequest(req, 'config:read'); if (denied) return denied;
  return NextResponse.json({ success: true, data: getSystemConfig() });
}

export async function PATCH(req: NextRequest) {
  const denied = guardRequest(req, 'config:write'); if (denied) return denied;
  const body = await req.json();
  const updated = updateSystemConfig(body);
  return NextResponse.json({ success: true, data: updated });
}
