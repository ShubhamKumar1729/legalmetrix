import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { logAudit } from '@/lib/audit/audit';
import { guardRequest, getSessionUser } from '@/lib/auth/session';
import { calculateComplianceScore } from '@/lib/rules/scoring';
import type { ReviewStatus } from '@/types';

/**
 * POST /api/inspections/[id]/findings/[findingId]
 *
 * Human review decision for one AI finding — the AI-assisted / human-decided core.
 * body: { decision: 'ACCEPT' | 'REJECT' | 'CORRECT', correctedValue?, comment? }
 *
 * The AI value vs. human value delta is stored on the finding and audit-logged
 * so it can later be exported for model improvement.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; findingId: string } }
) {
  const denied = guardRequest(req, 'review:write');
  if (denied) return denied;
  const session = getSessionUser(req)!;

  await seedMemoryDB();
  let inspection = await memoryDB.inspections.findById(params.id);
  if (!inspection) {
    inspection = memoryDB.inspections.all().find(i => i.inspectionId === params.id) || null;
  }
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  const { decision, correctedValue, comment } = body || {};
  if (!['ACCEPT', 'REJECT', 'CORRECT'].includes(decision)) {
    return NextResponse.json(
      { success: false, error: { message: "decision must be 'ACCEPT', 'REJECT' or 'CORRECT'" } },
      { status: 400 }
    );
  }
  if (decision === 'CORRECT' && !correctedValue) {
    return NextResponse.json(
      { success: false, error: { message: 'CORRECT requires a correctedValue' } },
      { status: 400 }
    );
  }

  const findings = [...(inspection.findings || [])];
  const index = findings.findIndex(f => f.id === params.findingId);
  if (index === -1) {
    return NextResponse.json({ success: false, error: { message: 'Finding not found' } }, { status: 404 });
  }
  const before = { ...findings[index] };
  const finding = { ...findings[index] };

  let reviewStatus: ReviewStatus = 'AI_CONFIRMED';
  if (decision === 'ACCEPT') {
    reviewStatus = 'AI_CONFIRMED'; // human confirmed the AI was right
  } else if (decision === 'REJECT') {
    reviewStatus = 'HUMAN_CONFIRMED'; // human overruled the AI finding
    finding.status = 'PASS';
  } else if (decision === 'CORRECT') {
    reviewStatus = 'CORRECTED';
    finding.correctedValue = correctedValue;
    finding.status = 'PASS'; // corrected declaration resolves the flag
  }

  finding.reviewStatus = reviewStatus;
  finding.reviewerId = session.id;
  finding.reviewerComment = comment || undefined;
  findings[index] = finding;

  // Re-score and re-route the inspection based on remaining open findings.
  const stillViolation = findings.some(f => f.status === 'VIOLATION');
  const stillReview = findings.some(f => f.reviewStatus === 'PENDING' && f.status !== 'PASS');
  const anyHumanAction = findings.some(f => f.reviewStatus !== 'PENDING');

  let status = inspection.status as string;
  if (stillViolation) status = 'NON_COMPLIANT';
  else if (stillReview) status = 'REVIEW_REQUIRED';
  else status = 'COMPLIANT';

  const recalcScore =
    findings.length > 0 ? Math.max(inspection.complianceScore, calculateComplianceScore(findings)) : 100;

  const updated = await memoryDB.inspections.update(inspection.id, {
    findings,
    status: status as any,
    complianceScore: recalcScore,
    reviewStatus: stillReview ? 'IN_REVIEW' : anyHumanAction ? 'COMPLETED' : inspection.reviewStatus,
    updatedAt: new Date().toISOString(),
  });

  await logAudit({
    userId: session.id,
    userName: session.name,
    role: session.role,
    action: `REVIEW_${decision}`,
    resource: 'FINDING',
    resourceId: finding.id,
    oldValue: { value: before.detectedValue, status: before.status, reviewStatus: before.reviewStatus },
    newValue: { value: finding.correctedValue || finding.detectedValue, status: finding.status, reviewStatus: finding.reviewStatus },
    ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
    comment: comment || undefined,
  });

  return NextResponse.json({ success: true, data: { finding, inspection: updated } });
}
