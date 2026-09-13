import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { logAudit } from '@/lib/audit/audit';

/** Generates a compliance report for a real, analyzed inspection. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('report:write');
  if (isResponse(user)) return user;

  const inspection = await db.inspections.get(params.id);
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }
  if (inspection.status === 'DRAFT' || inspection.status === 'PROCESSING') {
    return badRequest('Analyze the inspection before generating a report.');
  }

  const existing = inspection.reportId ? await db.reports.get(inspection.reportId) : null;
  if (existing) {
    return NextResponse.json({ success: true, data: existing });
  }

  const violations = inspection.findings.filter((f) => f.status === 'VIOLATION');
  const review = inspection.findings.filter((f) => f.status === 'REVIEW');
  const summary = [
    `${inspection.findings.length} rule check(s) evaluated.`,
    violations.length > 0 ? `${violations.length} violation(s).` : 'No violations confirmed.',
    review.length > 0 ? `${review.length} finding(s) awaiting review.` : null,
    inspection.scored ? `Compliance score ${inspection.complianceScore}/100.` : 'Not scored — no rules configured.',
  ]
    .filter(Boolean)
    .join(' ');

  const reportNumber = `RPT-${inspection.inspectionNumber}`;
  const report = await db.reports.create({
    reportNumber,
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspectionNumber,
    productName: inspection.productName,
    status: inspection.status,
    complianceScore: inspection.complianceScore,
    generatedBy: user.id,
    generatedByName: user.name,
    summary,
    createdAt: new Date().toISOString(),
  });

  await db.inspections.update(inspection.id, {
    reportId: report.id,
    updatedAt: new Date().toISOString(),
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'REPORT_GENERATED',
    resource: 'REPORT',
    resourceId: report.id,
    newValue: { reportNumber, inspectionId: inspection.id },
  });

  return NextResponse.json({ success: true, data: report }, { status: 201 });
}
