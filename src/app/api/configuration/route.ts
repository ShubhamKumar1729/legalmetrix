import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig, updateSystemConfig } from '@/lib/config/system';

export async function GET() {
  return NextResponse.json({ success: true, data: getSystemConfig() });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const updated = updateSystemConfig(body);
  return NextResponse.json({ success: true, data: updated });
}
