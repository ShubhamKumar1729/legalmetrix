# AI Model Integration

Connecting the real vision model requires **no changes** to the camera, upload,
storage, inspection, review or reporting code. Implement one HTTP endpoint and set
three environment variables.

## Why the current setup extracts nothing

`AI_PROVIDER` defaults to `development`, which selects `MockAIProvider`. It accepts
the real request and returns the real response shape, but it reads nothing from the
package: it returns zero `extractedFields`, zero `findings`, and explains itself in
`warnings`.

The rule engine then sees no extracted data, so every configured rule becomes a
finding with confidence `0` and status `REVIEW` — routed to a human. No values are
invented at any point, and the whole pipeline (inspection → analysis → review →
report) can be exercised before a model exists.

## The contract

`POST $AI_SERVICE_URL`, with `Authorization: Bearer $AI_SERVICE_KEY` when set.

### Request — `AIAnalyzeRequest`

```jsonc
{
  "inspectionId": "…",
  "imageIds":   ["…", "…"],          // stable evidence ids
  "imageUrls":  ["/api/images/…"],   // same-origin; send the session cookie to fetch
  "productMetadata": { "productName": "…", "brand": "…", "category": "FOOD", "barcode": "…" },
  "ruleSetVersion": "LM-PC-2011",
  "options": { "enableMultilingual": true, "enableFontAnalysis": true, "enableTamperingDetection": true }
}
```

`imageUrls` are served by `GET /api/images/:id`, which requires a signed-in session.
Either forward the cookie, or fetch the bytes server-side from `STORAGE_PATH` using
the image id.

### Response — `AIAnalyzeResponse`

```jsonc
{
  "inspectionId": "…",
  "runId": "…",
  "processingStatus": "COMPLETED",
  "stages": [ { "id": "ocr", "name": "Text Extraction", "status": "COMPLETED", "progress": 100 } ],
  "extractedFields": [
    {
      "id": "ef-1",
      "fieldName": "mrp",              // must match the rule's validationLogic.field
      "value": "₹99",
      "normalizedValue": "99",
      "rawText": "MRP ₹99/- (Incl. of all taxes)",
      "language": "en",
      "script": "Latin",
      "confidence": 97,                // 0–100
      "sourceImageId": "…",            // one of the request's imageIds
      "boundingBox": { "x": 120, "y": 300, "width": 180, "height": 42 },
      "status": "PASS",                // PASS | VIOLATION | WARNING | REVIEW
      "editable": true,
      "reviewStatus": "AI_CONFIRMED",
      "ruleCode": "LM-PC-2011-6(1)(e)" // optional, improves matching
    }
  ],
  "findings": [ /* optional — see "How findings are combined" */ ],
  "confidence": { "average": 93, "min": 81, "max": 99 },
  "evidenceRegions": [ { "imageId": "…", "boundingBox": { … }, "label": "mrp", "confidence": 97 } ],
  "warnings": [],
  "modelMetadata": {
    "provider": "http", "modelName": "…", "modelVersion": "…",
    "processedAt": "…", "processingTimeMs": 4210
  }
}
```

### Field names the rule set expects

Use these `fieldName` values so extracted data matches published rules:

`product_name`, `brand`, `manufacturer_address`, `net_quantity`, `mrp`,
`customer_care`, `manufacture_date`, `best_before_date`, `country_of_origin`,
`batch_number`, `importer`.

Provide `normalizedValue` in a machine-comparable form (plain number for quantities
and prices) — the engine derives `<field>_value` from it for `gt`/`gte`/`lt`/`lte`.

### Bounding boxes

Report coordinates in **pixels of the source image**. They are shown in *Technical
details* and on the report, and they let a reviewer confirm what the model read.

## How findings are combined

The rule engine owns the compliance decision for every configured rule.
`mergeFindings()` then folds the model's output over it:

- a model finding matching a rule (by `ruleCode`) supplies the detected value,
  evidence and confidence;
- if the model's confidence is at or above `CONFIDENCE_THRESHOLD_MEDIUM`, its status
  is trusted, otherwise the rule engine's decision stands;
- model findings that match no rule are appended, so nothing the model reports is
  lost.

The final score and status are recomputed from the merged findings, so what is stored
always matches what is displayed.

## Enabling the model

```bash
AI_PROVIDER=http
AI_SERVICE_URL=https://your-model-host/analyze
AI_SERVICE_KEY=…
AI_MODEL_VERSION=your-model-1.0.0
```

Restart the application. **Admin** shows *Vision model connected* instead of *No
vision model connected*, and new inspections record the provider, model version and
processing time on the inspection itself.

### Sibling routes

`AI_SERVICE_URL` points at the analyze route. The other two calls are resolved from
the same base, so the model host exposes them alongside it:

| Call            | Route derived from `https://your-model-host/analyze` | Method | Body                |
| --------------- | --------------------------------------------------- | ------ | ------------------- |
| `analyze()`     | `https://your-model-host/analyze`                   | POST   | `AIAnalyzeRequest`  |
| `extractText()` | `https://your-model-host/extract-text`              | POST   | `{ imageUrl }`      |
| `healthCheck()` | `https://your-model-host/health`                    | GET    | —                   |

A trailing `/analyze` is stripped before the sibling is appended, so the routes sit
next to analyze rather than underneath it. All three carry
`Authorization: Bearer $AI_SERVICE_KEY` when the key is set. `extractText()` and
`healthCheck()` are part of the `AIModelProvider` interface and are covered by
`npm run test:aimodel`, but the inspection flow itself only calls `analyze()`.

## Writing an in-process provider instead

Implement `AIModelProvider` and register it:

```ts
import { aiRegistry } from '@/lib/ai/provider';

class MyProvider implements AIModelProvider {
  name = 'My model';
  version = '1.0.0';
  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> { /* … */ }
  async extractText(imageUrl: string) { /* … */ }
  async healthCheck() { return true; }
}

aiRegistry.register('myprovider', new MyProvider());   // then AI_PROVIDER=myprovider
```

Leave `isDevelopmentProvider` unset (or `false`) so the UI stops showing the
"no vision model connected" notice.

## Errors

If the provider throws, the analysis route resets the inspection to `DRAFT`, stores
the failure message in `analysisNotes` and returns `500`. The inspection, its images
and any earlier findings are preserved.
