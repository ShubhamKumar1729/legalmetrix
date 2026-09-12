# AI Model Integration Contract — PackComply

## Overview

The platform is designed so the real AI/ML model team can integrate without rebuilding frontend. The contract is via `AIModelProvider` interface and `/api/ai/analyze` abstraction (implemented as `/api/inspections/[id]/analyze` calling the provider).

**Architecture:**
```
Frontend → Backend API (/api/inspections/[id]/analyze) → AI Adapter (aiRegistry) → Provider (Mock or Real)
```

NOT: Frontend → directly calls model.

---

## Provider Interface

**Location:** `src/lib/ai/types.ts`

```typescript
export interface AIModelProvider {
  name: string;
  version: string;
  analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse>;
  extractText(imageUrl: string): Promise<{ text: string; confidence: number; boundingBoxes: any[] }>;
  healthCheck(): Promise<boolean>;
}
```

---

## Request Contract

**Type:** `AIAnalyzeRequest`

```typescript
{
  inspectionId: string;          // UUID of inspection
  imageIds: string[];            // Internal image IDs
  imageUrls: string[];           // URLs to fetch images (local or S3 presigned)
  productMetadata?: {
    productName?: string;
    brand?: string;
    category?: string;           // FOOD, COSMETICS, etc.
    barcode?: string;
  };
  ruleSetVersion: string;        // e.g., "LM-PC-2011-v1.2"
  options?: {
    enableMultilingual?: boolean;
    enableFontAnalysis?: boolean;
    enableTamperingDetection?: boolean;
  };
}
```

**Image Format:**
- Input: JPEG, PNG, WebP, max 10 images, max 10MB each (validated)
- URLs: local `/uploads/...` or S3 presigned (provider should handle both)
- Quality metadata available in inspection record if needed

---

## Response Contract

**Type:** `AIAnalyzeResponse`

```typescript
{
  inspectionId: string;
  runId: string;                 // Unique AI run ID
  processingStatus: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  stages: AIProcessingStage[];   // 12 stages with status/progress
  extractedFields: ExtractedField[];
  findings: Finding[];
  confidence: {
    average: number;             // 0-100
    min: number;
    max: number;
  };
  evidenceRegions: {
    imageId: string;
    boundingBox: BoundingBox;    // { x, y, width, height, page? }
    label: string;               // e.g., "mrp", "net_quantity"
    confidence: number;
  }[];
  warnings: string[];
  modelMetadata: {
    provider: string;            // "mock" | "real"
    modelName: string;           // e.g., "LegalMetrology Vision v2.1"
    modelVersion: string;        // e.g., "lm-vision-v2.1.0"
    processedAt: string;         // ISO timestamp
    processingTimeMs: number;
  };
}
```

### ExtractedField

```typescript
{
  id: string;                    // Unique
  fieldName: string;             // "mrp" | "net_quantity" | "manufacturer_address" | "product_name" | "customer_care" | "manufacture_date" | etc.
  value: string;                 // Display value, e.g., "₹99"
  normalizedValue?: string;      // Normalized, e.g., "99.00" or "500"
  rawText: string;               // OCR raw, e.g., "MRP Rs. 99/-"
  language: string;              // "en" | "hi" | "pa" | etc.
  script: string;                // "Latin" | "Devanagari" | "Gurmukhi"
  confidence: number;            // 0-100
  sourceImageId: string;         // Which image
  boundingBox: BoundingBox;      // Location in image
  status: 'PASS' | 'VIOLATION' | 'WARNING' | 'REVIEW';
  editable: boolean;             // Can reviewer edit?
  reviewStatus: 'PENDING' | 'AI_CONFIRMED' | etc.
  ruleCode?: string;             // Associated rule
}
```

### Finding

```typescript
{
  id: string;
  inspectionId: string;
  declarationType: string;       // "MRP" | "NET_QUANTITY" | "MANUFACTURER" etc.
  title: string;                 // Human readable
  description: string;
  detectedValue?: string;
  expectedValue?: string;
  status: 'PASS' | 'VIOLATION' | 'WARNING' | 'REVIEW';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING';
  confidence: number;
  ruleId: string;
  ruleCode: string;              // e.g., "LM-PC-2011-6(1)(e)"
  legalReference: string;        // e.g., "Rule 6(1)(e)"
  evidence: {
    imageId: string;
    boundingBox: BoundingBox;
    croppedUrl?: string;         // Optional cropped evidence
  }[];
  reviewStatus: ReviewStatus;
  createdAt: string;
}
```

### BoundingBox Format

```typescript
{
  x: number;                     // Left, in pixels relative to image (0-400 for demo, but real should be 0-imageWidth)
  y: number;                     // Top
  width: number;
  height: number;
  page?: number;                 // For multi-page docs
}
```

**Important:** Frontend expects x/y/width/height as numbers. For demo we use 0-400 coordinate space, but real model should return actual pixel coordinates. Evidence viewer will scale proportionally.

### Processing Stages

Expected 12 stages (can be fewer/more, UI handles dynamic):

1. Image Quality Analysis
2. OCR
3. Text Region Detection
4. Declaration Detection
5. Entity Extraction
6. Multilingual Matching
7. MRP Analysis
8. Net Quantity Analysis
9. Font/Readability Analysis
10. Rule Validation
11. Confidence Scoring
12. Final Decision

Each stage:
```typescript
{
  id: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'WARNING' | 'FAILED';
  progress: number;              // 0-100
  startedAt?: string;
  completedAt?: string;
  message?: string;
  details?: any;                 // Stage-specific, e.g., { languagesDetected: ['en','hi'] }
}
```

---

## Error Format

Provider should throw with message, adapter catches and falls back to mock in demo mode. For production, return:

```typescript
{
  inspectionId,
  runId,
  processingStatus: 'FAILED',
  stages: [... with FAILED status ...],
  extractedFields: [],
  findings: [],
  confidence: { average: 0, min: 0, max: 0 },
  evidenceRegions: [],
  warnings: [],
  modelMetadata: { ... },
  error: {
    code: 'OCR_FAILED' | 'MODEL_TIMEOUT' | 'INVALID_IMAGE' | etc.
    message: string;
    details?: any;
  }
}
```

---

## Model Versioning

Every response must include:

- `modelName` — e.g., "LegalMetrology Vision"
- `modelVersion` — semver, e.g., "v2.1.0"
- `provider` — "real" or custom name
- `processedAt` — ISO timestamp

These are stored in inspection `aiRunId` and report `aiModelVersion` for traceability.

---

## Authentication

- **Mock:** No auth
- **Real:** Set `AI_SERVICE_URL` and `AI_SERVICE_KEY` in env
- Provider should read from `process.env.AI_SERVICE_URL` and `AI_SERVICE_KEY`
- Use Bearer token or API key in header — implement in custom provider

---

## Timeout & Retry

- **Timeout:** 30s for demo, 60s for production (configurable via env `AI_TIMEOUT_MS`)
- **Retry:** Adapter retries once on failure, then falls back to mock in demo mode, throws in production
- **Long processing:** If model needs >60s, implement async webhook: return `PROCESSING` with `runId`, then frontend polls `GET /api/inspections/[id]/results` (you need to implement polling endpoint)

---

## How to Integrate Real Model

### Option 1: Implement Provider Class

Create `src/lib/ai/real-provider.ts`:

```typescript
import { AIModelProvider, AIAnalyzeRequest, AIAnalyzeResponse } from './types';

export class RealAIProvider implements AIModelProvider {
  name = 'LegalMetrology Vision';
  version = 'v2.1.0';

  async healthCheck() {
    const res = await fetch(`${process.env.AI_SERVICE_URL}/health`, {
      headers: { 'Authorization': `Bearer ${process.env.AI_SERVICE_KEY}` }
    });
    return res.ok;
  }

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
    const res = await fetch(`${process.env.AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_SERVICE_KEY}`
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`AI service failed: ${res.status}`);
    const data = await res.json();
    // Map real model response to AIAnalyzeResponse contract
    return this.mapResponse(data, request);
  }

  private mapResponse(data: any, request: AIAnalyzeRequest): AIAnalyzeResponse {
    // Map your model's output to contract
    // Ensure bounding boxes, confidence, extractedFields, findings match spec
  }

  async extractText(imageUrl: string) { ... }
}
```

### Option 2: Register Provider

In `src/lib/ai/provider.ts`:

```typescript
import { RealAIProvider } from './real-provider';
...
this.register('real', new RealAIProvider());
this.defaultProvider = process.env.AI_PROVIDER || 'mock';
```

### Option 3: Env Config

Set in `.env`:

```
AI_PROVIDER=real
AI_SERVICE_URL=https://your-model-endpoint.com
AI_SERVICE_KEY=your-key
AI_MODEL_VERSION=lm-vision-v2.1.0
```

No frontend changes needed.

---

## Testing Integration

1. Set `AI_PROVIDER=real` and real URL/key
2. Create inspection via UI
3. Check logs: `aiRegistry.analyze` should call real provider
4. Verify response matches contract — UI should render findings, evidence, confidence automatically
5. If fails, check fallback to mock in demo mode, or error in production

---

## Mock Provider for Reference

See `src/lib/ai/mock-provider.ts` for:

- Deterministic data based on product name (for reliable demo)
- Realistic stages with timing
- Bounding boxes
- Multilingual examples
- Warnings
- Confidence scores

Use as template for real provider mapping.

---

## Future Extensibility

- Additional models: register multiple providers, e.g., `ocr-provider`, `tampering-provider`, compose in adapter
- Additional languages: add to `language` and `script` fields, UI already supports
- Streaming: if model supports streaming stages, update stages incrementally via websocket or polling

---

## Contact

For integration questions, check `ARCHITECTURE.md` and `API.md`. The contract is intentionally simple to allow model team to focus on CV/NLP, not platform plumbing.
