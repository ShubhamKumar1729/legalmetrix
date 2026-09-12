# AI Model Integration Contract — PackComply

## Overview — the integration is ALREADY wired

You do **not** need to write any platform code. The HTTP adapter for external
model services is implemented at `src/lib/ai/http-provider.ts` and registered in
the registry as provider name **`real`**. Your model team only implements the
service itself (3 endpoints, below) and the three `.env` values.

> **Status:** ✅ `HTTPAIProvider` implemented — timeout, bearer auth, single retry,
> response normalization (missing arrays → `[]`, confidence clamped 0–100), error
> mapping, `GET /api/ai/status` health probe, and async polling via
> `GET /api/inspections/[id]/results` are all live. While `AI_PROVIDER=mock`,
> the deterministic demo model answers; nothing you build can break the UI
> because every response is validated against the contract below before rendering.

**Architecture:**
```
Frontend → API (/api/inspections/[id]/analyze) → aiRegistry → HTTPAIProvider → your model service
                                                       ↘ MockAIProvider (fallback in demo mode)
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

## Timeout & Retry (implemented)

- **Timeout:** every request aborts after `AI_TIMEOUT_MS` (default 60000)
- **Retry:** the registry retries a failing provider once, then in demo mode
  (`NEXT_PUBLIC_DEMO_MODE=true`) falls back to the mock so the flow never dead-ends;
  in production it surfaces a clean error and resets the inspection to draft
- **Long processing (already supported end-to-end):** if your model needs longer than
  the timeout, return `{ processingStatus: "PROCESSING", runId: "…" }` from `/analyze`.
  The analyze route stores the run and the UI polls `GET /api/inspections/[id]/results`
  (implemented) every 2s until `ready: true`, then refetches the inspection.

---

## How to Integrate Your Real Model

### 1. Implement the service contract on your side

Expose on your HTTP service (auth header `Authorization: Bearer <AI_SERVICE_KEY>` is
sent automatically):

| Endpoint | Purpose | Response |
|---|---|---|
| `GET  /health` | liveness for Settings → *Test connection* | `200` when ready |
| `POST /analyze` | full pipeline for one inspection | `AIAnalyzeResponse` below (or a subset — it is normalized) |
| `POST /extract-text` | single-image OCR (optional helper) | `{ text, confidence, boundingBoxes }` |

`/analyze` receives the `AIAnalyzeRequest` JSON below. Return as many contract fields
as you can; anything missing gets a safe default. If you return partial data, the
platform's own rule engine still re-validates extracted fields against the published
rules (defense in depth — model output alone never becomes a finding in demo fallback
paths).

### 2. Configure (no code)

```
AI_PROVIDER=real
AI_SERVICE_URL=https://your-model-endpoint.com
AI_SERVICE_KEY=***
AI_MODEL_VERSION=lm-vision-v2.1.0
AI_TIMEOUT_MS=60000
```

### 3. (Optional) a different protocol? Implement the interface

```typescript
// src/lib/ai/my-provider.ts
import { aiRegistry } from './provider';
import type { AIModelProvider } from './types';

export class MyProvider implements AIModelProvider {
  name = 'My Model'; version = 'v1';
  async analyze(req): Promise<AIAnalyzeResponse> { /* call service, map response */ }
  async extractText(imageUrl: string) { /* ... */ }
  async healthCheck() { return true; }
}
// register it:
aiRegistry.register('my-model', new MyProvider());   // then AI_PROVIDER=my-model
```

Use `HTTPAIProvider.normalize()` as a reference for mapping a loose response onto the
contract without crashing the UI.

## Testing Integration

1. Set `AI_PROVIDER=real`, URL and key in `.env`; restart the dev server
2. Open **Settings → AI model connection** → *Test connection* should report your service latency
3. Create an inspection via the UI — the results card shows *Model* = your `modelName`/`modelVersion` (proof the real provider ran)
4. Findings, evidence boxes and confidence render straight from your response — no UI work needed
5. If your service is down: demo mode falls back to mock once (banner in audit log), production shows a clean error
6. `npm test` keeps the contract green (it asserts on the mock as the reference implementation)

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
