# API Documentation — PackComply

## Base URL

- Dev: `http://localhost:3000/api`
- Prod: `https://your-domain.com/api`

## Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid credentials",
    "details": { ... }
  }
}
```

**Status Codes:** 200 OK, 201 Created, 400 Validation, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Server Error

---

## Authentication

### POST /api/auth/login

**Request:**
```json
{
  "email": "officer@gov.in",
  "password": "Gov@2026"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "user-officer", "email": "officer@gov.in", "name": "Rajesh Kumar", "role": "ENFORCEMENT_OFFICER", "officialId": "GOV-EO-042" },
    "token": "jwt-token"
  }
}
```

**Notes:** Sets audit log LOGIN. Token stored in localStorage for demo, httpOnly cookie for production.

---

## Inspections

### GET /api/inspections

Query: `?status=REVIEW_REQUIRED&search=FreshBite&limit=50&skip=0`

**Response:**
```json
{
  "success": true,
  "data": {
    "inspections": [ { "id": "insp-001", "inspectionId": "LM-2026-001042", "productName": "FreshBite Premium Biscuits", "status": "REVIEW_REQUIRED", "complianceScore": 82, ... } ],
    "total": 3
  }
}
```

### POST /api/inspections

**Request:**
```json
{
  "productName": "FreshBite Premium Biscuits",
  "brand": "FreshBite",
  "category": "FOOD",
  "manufacturer": "FreshBite Foods Pvt Ltd",
  "barcode": "8901234567890",
  "images": [ { "id": "img-1", "side": "FRONT", "url": "/api/placeholder/image?text=Front", ... } ],
  "source": "FIELD",
  "location": { "latitude": 30.9009, "longitude": 75.8573 }
}
```

**Response:** Created inspection DRAFT

### GET /api/inspections/[id]

Param `id` can be internal `id` or human `inspectionId` (e.g., LM-2026-001042)

**Response:** Full inspection with findings, extractedFields, images, etc.

### PATCH /api/inspections/[id]

**Request:** Partial update, e.g., `{ "status": "COMPLIANT", "reviewStatus": "COMPLETED" }`

### POST /api/inspections/[id]/analyze

Triggers AI + Rule Engine.

**Request:** None (uses inspection data)

**Response:**
```json
{
  "success": true,
  "data": {
    "inspection": { ... updated with findings, score, status ... },
    "aiResult": { "runId": "ai-run-xxx", "extractedFields": [...], "findings": [...], "confidence": {...}, "modelMetadata": {...} },
    "ruleResult": { "findings": [...], "complianceScore": 82, ... }
  }
}
```

**Side Effects:** Updates inspection status to COMPLIANT/NON_COMPLIANT/REVIEW_REQUIRED, logs audit AI_ANALYSIS_COMPLETED

---

## Products

### GET /api/products

Query: `?search=FreshBite&category=FOOD`

**Response:** Enriched products with inspections count, violations, lastInspection

### GET /api/products/[id]

**Response:**
```json
{
  "success": true,
  "data": {
    "product": { "id": "prod-freshbite", "name": "FreshBite Premium Biscuits", ... },
    "inspections": [ ... ]
  }
}
```

### GET /api/products/[id]/history

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [ ... inspections sorted desc ... ],
    "trend": [ { "date": "2026-09-10", "score": 82, "status": "REVIEW_REQUIRED", "inspectionId": "LM-2026-001042" } ]
  }
}
```

---

## Rules

### GET /api/rules

**Response:** All rules sorted by ruleCode

### POST /api/rules

**Request:**
```json
{
  "ruleCode": "LM-PC-2011-6(1)(e)",
  "title": "MRP Declaration",
  "description": "Retail sale price must be declared",
  "legalReference": "Rule 6(1)(e)",
  "category": "MRP",
  "applicableProductCategories": ["ALL"],
  "requirementType": "MANDATORY",
  "validationLogic": { "field": "mrp", "operator": "exists" },
  "severity": "CRITICAL",
  "version": "1.2",
  "status": "DRAFT"
}
```

**Response:** Created rule, logs audit RULE_CREATED

### GET /api/rules/[id]

**Response:** Single rule

### PATCH /api/rules/[id]

**Request:** Partial update

**Response:** Updated rule, logs audit RULE_UPDATED

### POST /api/rules/[id]/versions (planned)

Creates new version, clones rule, increments version.

### POST /api/rule-versions/[id]/publish (planned)

Publishes draft → PUBLISHED, validates, requires confirmation.

---

## Analytics

### GET /api/analytics

**Response:**
```json
{
  "success": true,
  "data": {
    "kpis": { "totalInspections": 3, "compliant": 1, "violations": 1, "reviewRequired": 1, "complianceRate": 33, "avgConfidence": 89, "pendingReviews": 1, "repeatOffenders": 1 },
    "overTime": [ { "date": "2026-09-06", "inspections": 2, "compliant": 1, "violations": 1 } ],
    "violationCategories": [ { "name": "CUSTOMER_CARE", "value": 1 } ],
    "categoryDistribution": [ { "name": "FOOD", "value": 2 } ],
    "repeatOffenders": [ { "manufacturer": "CleanCare Labs, Mumbai", "inspections": 1, "violations": 1, "violationRate": 100, "riskScore": 89, "trend": "increasing" } ],
    "recentInspections": [ ... ]
  }
}
```

---

## Reports

### GET /api/reports

**Response:** List of reports with reportId, inspectionNumber, productName, status, score, date, inspector, ruleVersion, aiModel

### POST /api/reports

**Request:**
```json
{ "inspectionId": "insp-001" }
```

**Response:** Generated report with content including inspection, findings, evidence, ruleSetVersion, aiRunId

### GET /api/reports/[id] (via list filtering for demo)

Returns report detail.

---

## E-commerce

### POST /api/ecommerce/analyze

**Request:**
```json
{
  "url": "https://www.amazon.in/FreshBite-Premium-Biscuits-500g/dp/B0XXXX",
  "packageInspectionId": "insp-001" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listing": { "id": "uuid", "url": "...", "platform": "Amazon", "productName": "...", "mrp": "₹99", "netQuantity": "500 g", ... },
    "packageData": { "mrp": "₹89", "netQuantity": "500 g", ... },
    "comparison": [ { "field": "MRP", "listingValue": "₹99", "packageValue": "₹89", "match": false, "status": "VIOLATION" } ],
    "overallStatus": "MISMATCH",
    "complianceScore": 75
  }
}
```

---

## Audit Logs

### GET /api/audit-logs

Query: `?resource=INSPECTION&limit=100`

**Response:** Array of audit logs with timestamp, userId, userName, role, action, resource, resourceId, oldValue, newValue, ip, comment

---

## Search

### GET /api/search

Query: `?q=FreshBite`

**Response:**
```json
{
  "success": true,
  "data": [
    { "type": "Inspection", "id": "insp-001", "title": "LM-2026-001042", "subtitle": "FreshBite Premium Biscuits", "href": "/app/scan/insp-001" },
    { "type": "Product", "id": "prod-freshbite", "title": "FreshBite Premium Biscuits", "subtitle": "FreshBite", "href": "/app/products/prod-freshbite" },
    { "type": "Rule", "id": "rule-004", "title": "LM-PC-2011-6(1)(e)", "subtitle": "MRP Declaration", "href": "/app/rules/rule-004" }
  ]
}
```

---

## Users

### GET /api/users

**Response:** List of users with id, email, name, officialId, role, department, active, lastLogin

---

## Configuration

### GET /api/configuration

**Response:** SystemConfig with ai, compliance, inspection, system sections

### PATCH /api/configuration

**Request:** Partial SystemConfig update

**Response:** Updated config

---

## Placeholder

### GET /api/placeholder/image

Query: `?text=FreshBite+Front`

**Response:** SVG placeholder image (for demo when real images not available)

---

## Error Handling

All endpoints:

- Validate input (Zod or manual)
- Return 400 for validation errors
- Return 401 if no token (except login, landing)
- Return 403 if role lacks permission
- Return 404 if not found
- Return 500 for server errors (no stack trace leaked)
- Log audit for important actions
- Try MongoDB, fallback to memory, log warning

---

## Rate Limiting (Future)

- Implement per IP and per user
- 100 req/min for inspections, 10 req/min for AI analyze

---

## Security Headers

Via `next.config.mjs`:

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

---

## Testing

- Unit: evaluator, scoring
- API: auth, inspection creation, AI analysis, rule publishing, report gen, audit logging
- Critical happy path: create inspection → analyze → review → report

See `SECURITY.md` for auth/RBAC details.
