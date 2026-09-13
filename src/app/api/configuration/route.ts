import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { getSystemConfig, updateSystemConfig } from '@/lib/config/system';
import { getSystemStatus } from '@/lib/system/info';
import { logAudit } from '@/lib/audit/audit';

export async function GET() {
  const user = requirePermission('config:read');
  if (isResponse(user)) return user;
  return NextResponse.json({ success: true, data: { config: getSystemConfig(), status: await getSystemStatus() } });
}

export async function PATCH(req: NextRequest) {
  const user = requirePermission('config:write');
  if (isResponse(user)) return user;

  const before = getSystemConfig();
  const body = await req.json().catch(() => ({}));
  const updated = updateSystemConfig(body);

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'CONFIG_UPDATED',
    resource: 'CONFIGURATION',
    resourceId: 'system',
    oldValue: before,
    newValue: updated,
  });

  return NextResponse.json({ success: true, data: { config: updated } });
}
