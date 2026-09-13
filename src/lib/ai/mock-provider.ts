import { randomUUID } from 'node:crypto';
import type { AIAnalyzeRequest, AIAnalyzeResponse, AIModelProvider, AIProcessingStage } from './types';
import type { BoundingBox } from '@/types';

/**
 * Development AI provider.
 *
 * This provider exists so the inspection pipeline can be exercised end to end before the
 * real vision model is connected. It accepts the exact same request a real model receives
 * (image ids + urls, product metadata, rule set) and returns the exact same response
 * shape — but it performs NO reading of the package.
 *
 * It therefore returns zero extracted fields and zero findings, and says so explicitly in
 * `warnings`. The rule engine turns "no automated extraction available" into findings that
 * require human confirmation instead of inventing values.
 *
 * Swapping in the real model requires no changes to the camera, upload, storage or
 * inspection code: implement AIModelProvider and point AI_PROVIDER at it.
 */

const STAGES: Omit<AIProcessingStage, 'status' | 'progress' | 'startedAt' | 'completedAt'>[] = [
  { id: 'image-ingest', name: 'Image Intake', message: 'Loading inspection images' },
  { id: 'image-quality', name: 'Image Quality Check', message: 'Checking resolution and readability' },
  { id: 'ocr', name: 'Text Extraction', message: 'Reading printed declarations' },
  { id: 'declaration-detection', name: 'Declaration Detection', message: 'Locating mandatory declarations' },
  { id: 'entity-extraction', name: 'Entity Extraction', message: 'Parsing MRP, quantity, manufacturer' },
  { id: 'rule-validation', name: 'Rule Validation', message: 'Evaluating the configured rule set' },
  { id: 'confidence-scoring', name: 'Confidence Scoring', message: 'Calculating confidence per field' },
];

const emptyBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

export class MockAIProvider implements AIModelProvider {
  name = 'Development Provider (no model connected)';
  version = process.env.AI_MODEL_VERSION || 'dev-no-model';
  isDevelopmentProvider = true;

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async extractText(_imageUrl: string) {
    return {
      text: '',
      confidence: 0,
      boundingBoxes: [] as BoundingBox[],
      note: 'No vision model is connected, so no text was extracted.',
    };
  }

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
    const start = Date.now();

    const stages: AIProcessingStage[] = STAGES.map((stage, index) => ({
      ...stage,
      status: 'COMPLETED' as const,
      progress: 100,
      startedAt: new Date(start + index * 10).toISOString(),
      completedAt: new Date(start + (index + 1) * 10).toISOString(),
    }));

    const imagesReceived = request.imageIds?.length ?? 0;

    return {
      inspectionId: request.inspectionId,
      runId: `run-${randomUUID()}`,
      processingStatus: 'COMPLETED',
      stages,
      extractedFields: [],
      findings: [],
      confidence: { average: 0, min: 0, max: 0 },
      evidenceRegions: request.imageIds.map((imageId) => ({
        imageId,
        boundingBox: emptyBox,
        label: 'image',
        confidence: 0,
      })),
      warnings: [
        'No vision model is connected, so no declarations could be read from the package automatically.',
        `${imagesReceived} image(s) were received and stored. Configure AI_SERVICE_URL to enable automated extraction.`,
        'Every configured rule is listed below for human confirmation.',
      ],
      modelMetadata: {
        provider: 'development',
        modelName: this.name,
        modelVersion: this.version,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - start,
      },
    };
  }
}

export const mockAIProvider = new MockAIProvider();
