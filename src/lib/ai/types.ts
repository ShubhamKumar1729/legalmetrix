import type { BoundingBox, ExtractedField, Finding } from '@/types';

export interface AIAnalyzeRequest {
  inspectionId: string;
  imageIds: string[];
  imageUrls: string[];
  productMetadata?: {
    productName?: string;
    brand?: string;
    category?: string;
    barcode?: string;
  };
  ruleSetVersion: string;
  options?: {
    enableMultilingual?: boolean;
    enableFontAnalysis?: boolean;
    enableTamperingDetection?: boolean;
  };
}

export interface AIProcessingStage {
  id: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'WARNING' | 'FAILED';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  message?: string;
  details?: any;
}

export interface AIAnalyzeResponse {
  inspectionId: string;
  runId: string;
  processingStatus: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  stages: AIProcessingStage[];
  extractedFields: ExtractedField[];
  findings: Finding[];
  confidence: {
    average: number;
    min: number;
    max: number;
  };
  evidenceRegions: {
    imageId: string;
    boundingBox: BoundingBox;
    label: string;
    confidence: number;
  }[];
  warnings: string[];
  modelMetadata: {
    provider: string;
    modelName: string;
    modelVersion: string;
    processedAt: string;
    processingTimeMs: number;
  };
}

export interface AIModelProvider {
  name: string;
  version: string;
  /** True when the provider cannot actually read a package (development stand-in). */
  isDevelopmentProvider?: boolean;
  analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse>;
  extractText(imageUrl: string): Promise<{
    text: string;
    confidence: number;
    boundingBoxes: BoundingBox[];
    note?: string;
  }>;
  healthCheck(): Promise<boolean>;
}
