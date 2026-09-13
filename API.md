# API Reference

All responses use one envelope:

```jsonc
{ "success": true,  "data": { … } }
{ "success": false, "error": { "code": "STRING", "message": "Human readable" } }
```

Every route except `POST /api/auth/login` and `GET /api/auth/status` requires the
`legalmetrix_session` httpOnly cookie. Unauthenticated requests return `401`;
authenticated callers without the required permission return `403`.

The **Permission** column refers to `src/lib/auth/rbac.ts`.

---

## Authentication

### `POST /api/auth/login` — public
```jsonc
{ "email": "first.admin@legalmetrix.example", "password": "…" }
→ 200 { user, simpleRole, simpleRoleLabel, permissions }   // sets the session cookie
→ 401 AUTH_FAILED
```
When no accounts exist the message explains how to create the first administrator.
Sign-in is written to the audit log.

### `POST /api/auth/logout`
Clears the cookie and records a `LOGOUT` audit entry.

### `GET /api/auth/me`
`{ user, simpleRole, simpleRoleLabel, permissions, system }` where `system` reports
the active data store, analysis provider, published rule count, account count,
bootstrap state and upload constraints.

### `GET /api/auth/status` — public, no credentials exposed
`{ hasUsers, bootstrapConfigured, rulesPublished, aiDevelopmentMode, datastore }`

---

## Evidence images

### `POST /api/images` — `inspection:create`
`multipart/form-data`: `image` (File), `side`, `source` (`CAMERA` | `UPLOAD`),
`quality` (optional JSON measured client-side).

```jsonc
→ 200 {
  "id": "…", "url": "/api/images/…", "side": "FRONT", "source": "CAMERA",
  "originalName": "…", "size": 184320, "mimeType": "image/jpeg",
  "width": 900, "height": 640,
  "quality": { "resolution": 640, "brightness": 0.62, "blurScore": 0.18, "readability": 0.79 },
  "uploadedAt": "…"
}
→ 422 UNSUPPORTED_FORMAT | EMPTY_FILE | FILE_TOO_LARGE | UNREADABLE_IMAGE
      | TRUNCATED_IMAGE | LOW_RESOLUTION
```
Camera captures and uploads return the identical shape. The server validates the real
file bytes, not the client's claims.

### `GET /api/images` — `inspection:create`
Upload constraints, so the UI can describe them accurately.

### `GET /api/images/:id` — any signed-in user
Streams the stored image. `401` without a session, `404` if absent.

---

## Inspections

### `GET /api/inspections?limit&status&q` — `inspection:read`
`{ inspections: […], total }`, newest first.

### `POST /api/inspections` — `inspection:create`
```jsonc
{ "productName": "…", "brand": "…", "category": "FOOD", "manufacturer": "…",
  "barcode": "…", "batchNumber": "…", "source": "FIELD",
  "images": [ { "id": "…", "side": "FRONT", "source": "CAMERA", "quality": { … } } ] }
→ 201 Inspection (status DRAFT)
```
Validates required fields, enforces the image limit, and confirms every referenced
image actually exists in storage. Creates the product record if this is the product's
first inspection.

### `GET /api/inspections/:id` — `inspection:read`
Also resolves by `inspectionNumber`.

### `PATCH /api/inspections/:id` — `inspection:update`
Editable fields only: `reviewStatus`, `location`, `batchNumber`, `barcode`.

### `POST /api/inspections/:id/analyze` — `inspection:update`
Runs the provider, then the rule engine, then merges and scores.
```jsonc
→ 200 { "inspection": …, "aiResult": …, "ruleSummary": … }
→ 422 if the inspection has no images
```

### `POST /api/inspections/:id/findings/:findingId` — `review:write`
```jsonc
{ "decision": "CONFIRM_VIOLATION" | "CONFIRM_PASS" | "CORRECT",
  "correctedValue": "…",   // required for CORRECT
  "comment": "…" }
→ 200 { inspection, finding }
```
Recomputes the score and status, and records who decided what.

### `POST /api/inspections/:id/report` — `report:write`
`422` if the inspection has not been analyzed. Idempotent: a second call returns the
existing report.

---

## Reports

### `GET /api/reports` — `report:read`
`{ reports, total }` — only reports that were generated.

### `GET /api/reports/:id` — `report:read`
`{ report, inspection, auditTrail }` where the trail covers the inspection, every
finding review and the report generation.

---

## Products

### `GET /api/products?q` — `product:read`
Each product carries `inspectionCount`, `violationCount`, `latestScore` and
`riskScore`, all computed from stored inspections.

### `GET /api/products/:id` — `product:read`
`{ product, history, trend }`.

---

## Rules

### `GET /api/rules` — `rule:read`
### `POST /api/rules` — `rule:write` (publishing additionally needs `rule:publish`)
Zod-validated payload; rejects a duplicate `ruleCode` + `version`.
### `GET /api/rules/:id` — `rule:read` → `{ rule, versions }`
### `PATCH /api/rules/:id` — `rule:write`
### `POST /api/rules/:id/versions` — `rule:write`
Creates the next draft version; the published version keeps applying until the new
one is published.

---

## Users

### `GET /api/users` — `user:read`
Returns accounts without password hashes.
### `POST /api/users` — `user:write`
`{ email, name, password (≥8 chars), role, officialId?, department? }`
### `PATCH /api/users/:id` — `user:write`
Cannot deactivate your own account.

---

## Intelligence

### `GET /api/analytics` — `analytics:read`
```jsonc
{ "kpis": { totalInspections, compliant, violations, reviewRequired, complianceRate,
            avgConfidence, pendingReviews, products, reports, rulesPublished },
  "hasData": false,
  "overTime": [ { "date": "…", "inspections": 0, "compliant": 0, "violations": 0 } ],
  "violationCategories": [], "categoryDistribution": [], "manufacturers": [] }
```
Every value is derived from stored inspections. Days without activity stay at zero.

### `GET /api/notifications` — `inspection:read`
Derived from findings awaiting review and generated reports. Empty list when there is
nothing.

### `GET /api/audit-logs?resource&limit` — `audit:read`
### `GET /api/search?q` — `inspection:read`
Searches real inspections, products and (with `rule:read`) rules.

---

## Assistant

### `POST /api/assistant` — `inspection:read`

```jsonc
// request
{ "question": "What failed?", "inspectionId": "…" }   // inspectionId is optional

// response
{
  "answer": "LM-2026-000001 has 1 confirmed violation(s): …",
  "groundedIn": ["LM-2026-000001", "LM-PC-2011-6(1)(e)"],
  "answered": true,
  "inspectionId": "…",
  "source": "stored-records",
  "needsInspection": false
}
```

There is **no language model** behind this. It is a deterministic lookup over stored
records, so it cannot invent a fact:

- Without `inspectionId` it replies `Which inspection would you like me to look at?`
  with `answered: false` rather than answering about an inspection it was not given.
- An unknown `inspectionId` returns `404`; an empty question returns `400`.
- A question the record cannot answer returns `answered: false` and says what it does
  have, instead of guessing.
- `groundedIn` lists the records the answer was built from.

To attach a real assistant model later, replace `answerQuestion` in
`src/lib/assistant/assistant.ts`. The route and the context object stay the same.

## Configuration

### `GET /api/configuration` — `config:read` → `{ config, status }`
### `PATCH /api/configuration` — `config:write`
Recorded in the audit log.

---

## E-commerce

### `POST /api/ecommerce/analyze` — `ecommerce:analyze`
```jsonc
{ "url": "https://…", "inspectionId": "…" }
→ 200 { listing, comparison, listingId }
→ 501 PROVIDER_NOT_CONFIGURED   // no ECOMMERCE_API_URL configured
→ 502 ANALYSIS_FAILED
```
### `GET /api/ecommerce/analyze` — `ecommerce:analyze` → `{ configured }`
### `GET /api/ecommerce/listings` — `ecommerce:analyze`
Only listings that were actually analyzed.
