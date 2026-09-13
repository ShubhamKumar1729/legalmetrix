import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('report:read');
  if (isResponse(user)) return user;

  const report = (await db.reports.get(params.id)) || (await db.reports.findOne({ reportNumber: params.id }));
  if (!report) {
    return NextResponse.json({ success: false, error: { message: 'Report not found' } }, { status: 404 });
  }

  const inspection = await db.inspections.get(report.inspectionId);
  const findingIds = (inspection?.findings || []).map((finding) => finding.id);

  // The trail covers the inspection itself, every finding review and the report generation.
  const recent = await db.auditLogs.list({}, { sortDescBy: 'timestamp', limit: 500 });
  const auditTrail = recent.filter(
    (log) =>
      (log.resource === 'INSPECTION' && log.resourceId === report.inspectionId) ||
      (log.resource === 'FINDING' && findingIds.includes(log.resourceId)) ||
      (log.resource === 'REPORT' && log.resourceId === report.id)
  );

  return NextResponse.json({ success: true, data: { report, inspection, auditTrail } });
}
