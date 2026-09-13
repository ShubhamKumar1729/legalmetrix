import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { getAuditLogs } from '@/lib/audit/audit';

/** Real audit trail only — no synthesised entries when the log is empty. */
export async function GET(req: NextRequest) {
  const user = requirePermission('audit:read');
  if (isResponse(user)) return user;

  const { searchParams } = new URL(req.url);
  const logs = await getAuditLogs({
    resource: searchParams.get('resource') || undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500),
  });

  return NextResponse.json({ success: true, data: { logs, total: logs.length } });
}
