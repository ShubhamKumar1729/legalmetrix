import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { analyzeWithAI, aiRegistry } from '@/lib/ai/provider';
import { ruleEngine } from '@/lib/rules/engine';
import { calculateComplianceScore } from '@/lib/rules/scoring';
import { logAudit } from '@/lib/audit/audit';
import { guardRequest } from '@/lib/auth/session';

/**
 * POST /api/inspections/[id]/analyze
 *
 * Runs the AI pipeline for an inspection through the provider registry
 * (mock by default; set AI_PROVIDER=real + AI_SERVICE_URL to use your model —
 * see MODEL_INTEGRATION.md), then re-validates against the rule engine,
 * scores, routes to human review, and updates the inspection record.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = guardRequest(req, 'inspection:update');
  if (denied) return denied;

  await seedMemoryDB();

  let inspection = await memoryDB.inspections.findById(params.id);
  if (!inspection) {
    inspection = memoryDB.inspections.all().find(i => i.inspectionId === params.id) || null;
  }
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  try {
    await memoryDB.inspections.update(inspection.id, {
      status: 'PROCESSING',
      updatedAt: new Date().toISOString(),
    });

    const aiRequest = {
      inspectionId: inspection.id,
      imageIds: inspection.images.map(img => img.id),
      imageUrls: inspection.images.map(img => img.url),
      productMetadata: {
        productName: inspection.productName,
        brand: inspection.brand,
        category: inspection.category,
        barcode: inspection.barcode,
      },
      ruleSetVersion: inspection.ruleSetVersion,
      options: {
        enableMultilingual: true,
        enableFontAnalysis: true,
        enableTamperingDetection: true,
      },
    };

    // Route through the registry so the configured provider (mock | real | custom) is used.
    const aiResult = await analyzeWithAI(aiRequest);

    // A long-running model may respond "still processing" with a runId — the client
    // polls GET /api/inspections/[id]/results until a final status arrives.
    if (aiResult.processingStatus === 'PROCESSING') {
      const pending = await memoryDB.inspections.update(inspection.id, {
        status: 'PROCESSING',
        aiRunId: aiResult.runId,
        aiModelMetadata: aiResult.modelMetadata,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, data: { inspection: pending, aiResult, pending: true } });
    }

    // Run the rule engine on the AI's extracted fields (defense in depth:
    // regulatory logic always re-validated server-side, never trusted from the model alone).
    const ruleResult = await ruleEngine.evaluate({
      extractedFields: aiResult.extractedFields,
      productMetadata: {
        productName: inspection.productName,
        brand: inspection.brand,
        category: inspection.category,
        manufacturer: inspection.manufacturer,
      },
      ruleSetVersion: inspection.ruleSetVersion,
    });

    const findings = aiResult.findings.length > 0 ? aiResult.findings : ruleResult.findings;

    const hasViolation = findings.some(f => f.status === 'VIOLATION');
    const hasReview = findings.some(f => f.status === 'REVIEW');

    // Score from the findings via the shared scoring module (configurable weights).
    let finalScore = findings.length > 0
      ? calculateComplianceScore(findings)
      : ruleResult.complianceScore || 95;

    let finalStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'REVIEW_REQUIRED' = 'COMPLIANT';
    if (hasViolation) finalStatus = 'NON_COMPLIANT';
    else if (hasReview) finalStatus = 'REVIEW_REQUIRED';

    // Deterministic overrides exist ONLY for the mock provider in demo mode so the
    // jury demo is 100% reproducible. Real model results are never overridden.
    if (aiRegistry.getProviderName() === 'mock' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      const lower = (inspection.productName || '').toLowerCase();
      if (lower.includes('freshbite')) { finalScore = 82; finalStatus = 'REVIEW_REQUIRED'; }
      else if (lower.includes('pureharvest')) { finalScore = 96; finalStatus = 'COMPLIANT'; }
      else if (lower.includes('cleancare')) { finalScore = 45; finalStatus = 'NON_COMPLIANT'; }
    }

    const updated = await memoryDB.inspections.update(inspection.id, {
      status: finalStatus,
      complianceScore: finalScore,
      confidenceSummary: {
        average: aiResult.confidence.average,
        min: aiResult.confidence.min,
        max: aiResult.confidence.max,
        lowConfidenceCount: aiResult.extractedFields.filter(f => f.confidence < 75).length,
      },
      findings,
      extractedFields: aiResult.extractedFields,
      aiRunId: aiResult.runId,
      aiModelMetadata: aiResult.modelMetadata,
      ruleSetVersion: ruleResult.ruleSetVersion,
      reviewStatus: hasReview || hasViolation ? 'PENDING' : 'NOT_REQUIRED',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await logAudit({
      userId: inspection.inspectorId,
      userName: inspection.inspectorName,
      role: 'ENFORCEMENT_OFFICER',
      action: 'AI_ANALYSIS_COMPLETED',
      resource: 'INSPECTION',
      resourceId: inspection.id,
      newValue: {
        aiRunId: aiResult.runId,
        modelProvider: aiResult.modelMetadata.provider,
        modelVersion: aiResult.modelMetadata.modelVersion,
        complianceScore: finalScore,
        findingsCount: findings.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: { inspection: updated, aiResult, ruleResult },
    });
  } catch (e) {
    console.error('Analyze error', e);
    await memoryDB.inspections.update(inspection.id, {
      status: 'DRAFT',
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json(
      { success: false, error: { message: 'AI analysis failed. The inspection was reset to draft — you can retry.' } },
      { status: 500 }
    );
  }
}
