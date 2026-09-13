import { NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';

/** Only reports that were actually generated appear here. */
export async function GET() {
  const user = requirePermission('report:read');
  if (isResponse(user)) return user;

  const reports = await db.reports.list({}, { sortDescBy: 'createdAt' });
  return NextResponse.json({ success: true, data: { reports, total: reports.length } });
}
