import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { currentAIProvider, isDevelopmentAI } from '@/lib/ai/provider';
import { mergeFindings } from '@/lib/ai/merge-findings';
import { ruleEngine } from '@/lib/rules/engine';
import { computeOutcome } from '@/lib/rules/scoring';
import { logAudit } from '@/lib/audit/audit';
import { getSystemConfig } from '@/lib/config/system';

/**
 * Runs the analysis pipeline for one inspection:
 *   stored images -> AI provider -> extracted fields -> rule engine -> findings -> outcome
 *
 * The provider is whatever AI_PROVIDER selects. With the default development provider no
 * fields are extracted, so every configured rule becomes a finding that needs human
 * confirmation — the pipeline behaves exactly the same once a real model is connected.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('inspection:update');
  if (isResponse(user)) return user;

  const inspection = await db.inspections.get(params.id);
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }
  if (inspection.images.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: 'This inspection has no images to analyze.' } },
      { status: 422 }
    );
  }

  const config = getSystemConfig();

  await db.inspections.update(inspection.id, { status: 'PROCESSING', updatedAt: new Date().toISOString() });

  try {
    const provider = currentAIProvider();

    const aiResult = await provider.analyze({
      inspectionId: inspection.id,
      imageIds: inspection.images.map((image) => image.id),
      imageUrls: inspection.images.map((image) => image.url),
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
    });

    const ruleResult = await ruleEngine.evaluate({
      inspectionId: inspection.id,
      extractedFields: aiResult.extractedFields,
      productMetadata: {
        productName: inspection.productName,
        brand: inspection.brand,
        category: inspection.category,
        manufacturer: inspection.manufacturer,
      },
      ruleSetVersion: inspection.ruleSetVersion,
    });

    const findings = mergeFindings(
      ruleResult.findings,
      aiResult.findings,
      config.ai.confidenceThresholdMedium
    );
    const outcome = computeOutcome(findings);

    const notes = [...ruleResult.notes, ...(aiResult.warnings || [])];
    if (isDevelopmentAI()) {
      notes.unshift(
        'Automated analysis is running without a vision model. Configure AI_PROVIDER and AI_SERVICE_URL to connect one.'
      );
    }

    const scored = outcome.score !== null;
    const reviewPending = findings.some((f) => f.reviewStatus === 'PENDING');

    const updated = await db.inspections.update(inspection.id, {
      status: scored ? outcome.status : 'REVIEW_REQUIRED',
      complianceScore: outcome.score ?? 0,
      scored,
      rulesEvaluated: ruleResult.evaluatedRules,
      findings,
      extractedFields: aiResult.extractedFields,
      confidenceSummary: {
        average: aiResult.confidence?.average ?? 0,
        min: aiResult.confidence?.min ?? 0,
        max: aiResult.confidence?.max ?? 0,
        lowConfidenceCount: aiResult.extractedFields.filter((f) => f.confidence < config.ai.confidenceThresholdMedium)
          .length,
      },
      aiRunId: aiResult.runId,
      aiProvider: aiResult.modelMetadata.provider,
      aiModelVersion: aiResult.modelMetadata.modelVersion,
      processingTimeMs: aiResult.modelMetadata.processingTimeMs,
      analysisNotes: notes,
      reviewStatus: reviewPending ? 'PENDING' : 'NOT_REQUIRED',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'INSPECTION_ANALYZED',
      resource: 'INSPECTION',
      resourceId: inspection.id,
      newValue: {
        aiRunId: aiResult.runId,
        aiModelVersion: aiResult.modelMetadata.modelVersion,
        rulesEvaluated: ruleResult.evaluatedRules,
        findings: findings.length,
        status: updated?.status,
      },
    });

    return NextResponse.json({
      success: true,
      data: { inspection: updated, aiResult, ruleSummary: ruleResult },
    });
  } catch (error) {
    console.error('[analyze] failed:', error);
    await db.inspections.update(inspection.id, {
      status: 'DRAFT',
      analysisNotes: [`Analysis failed: ${(error as Error).message}`],
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json(
      { success: false, error: { message: `Analysis failed: ${(error as Error).message}` } },
      { status: 500 }
    );
  }
}
