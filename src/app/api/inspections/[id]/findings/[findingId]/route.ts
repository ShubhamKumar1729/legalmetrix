import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { computeOutcome } from '@/lib/rules/scoring';
import { logAudit } from '@/lib/audit/audit';
import type { Finding } from '@/types';

type Decision = 'CONFIRM_VIOLATION' | 'CONFIRM_PASS' | 'CORRECT';

const DECISIONS: Decision[] = ['CONFIRM_VIOLATION', 'CONFIRM_PASS', 'CORRECT'];

/**
 * Human review of a single finding.
 *
 * CONFIRM_VIOLATION — the officer agrees the declaration is missing/incorrect
 * CONFIRM_PASS      — the officer confirms the package satisfies the rule
 * CORRECT           — the officer supplies the correct value (kept for model improvement)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; findingId: string } }
) {
  const user = requirePermission('review:write');
  if (isResponse(user)) return user;

  const inspection = await db.inspections.get(params.id);
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const decision = String(body.decision || '').toUpperCase() as Decision;
  if (!DECISIONS.includes(decision)) {
    return badRequest('A review decision is required.');
  }

  const finding = inspection.findings.find((f) => f.id === params.findingId);
  if (!finding) {
    return NextResponse.json({ success: false, error: { message: 'Finding not found' } }, { status: 404 });
  }

  const comment = String(body.comment || '').trim();
  const correctedValue = String(body.correctedValue || '').trim();

  const updatedFinding: Finding = {
    ...finding,
    status: decision === 'CONFIRM_PASS' ? 'PASS' : 'VIOLATION',
    reviewStatus: decision === 'CORRECT' ? 'CORRECTED' : 'HUMAN_CONFIRMED',
    correctedValue: decision === 'CORRECT' ? correctedValue : finding.correctedValue,
    reviewerId: user.id,
    reviewerName: user.name,
    reviewerComment: comment || undefined,
    reviewedAt: new Date().toISOString(),
  };

  if (decision === 'CORRECT' && !correctedValue) {
    return badRequest('A corrected value is required.');
  }

  const findings = inspection.findings.map((f) => (f.id === finding.id ? updatedFinding : f));
  const outcome = computeOutcome(findings);
  const stillPending = findings.some((f) => f.reviewStatus === 'PENDING');

  const updated = await db.inspections.update(inspection.id, {
    findings,
    status: outcome.status,
    complianceScore: outcome.score ?? inspection.complianceScore,
    scored: outcome.score !== null,
    reviewStatus: stillPending ? 'IN_REVIEW' : 'COMPLETED',
    updatedAt: new Date().toISOString(),
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'FINDING_REVIEWED',
    resource: 'FINDING',
    resourceId: finding.id,
    oldValue: { status: finding.status, detectedValue: finding.detectedValue, confidence: finding.confidence },
    newValue: {
      status: updatedFinding.status,
      reviewStatus: updatedFinding.reviewStatus,
      correctedValue: updatedFinding.correctedValue,
      comment,
    },
    comment,
  });

  return NextResponse.json({ success: true, data: { inspection: updated, finding: updatedFinding } });
}
