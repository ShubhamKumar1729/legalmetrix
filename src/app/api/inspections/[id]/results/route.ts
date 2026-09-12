import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { guardRequest } from '@/lib/auth/session';

/**
 * GET /api/inspections/[id]/results — poll for AI analysis results.
 *
 * Long-running model providers may return processingStatus: 'PROCESSING' with a runId
 * instead of a finished result. The frontend (and any integration test) can poll this
 * endpoint until the inspection reaches a final status. See MODEL_INTEGRATION.md.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = guardRequest(req, 'inspection:read');
  if (denied) return denied;

  await seedMemoryDB();
  let inspection = await memoryDB.inspections.findById(params.id);
  if (!inspection) {
    inspection = memoryDB.inspections.all().find(i => i.inspectionId === params.id) || null;
  }
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      inspectionId: inspection.id,
      status: inspection.status,
      ready: inspection.status !== 'PROCESSING' && inspection.status !== 'DRAFT',
      aiRunId: inspection.aiRunId || null,
      modelMetadata: (inspection as any).aiModelMetadata || null,
      complianceScore: inspection.complianceScore,
      findings: inspection.findings,
      extractedFields: inspection.extractedFields,
      confidenceSummary: inspection.confidenceSummary,
    },
  });
}
