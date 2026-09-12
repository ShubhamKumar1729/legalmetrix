# Database Design — PackComply

## Overview

- **Primary:** MongoDB + Mongoose
- **Fallback:** In-memory store (`memory-store.ts`) for demo without MongoDB
- **Connection:** `connectDB()` with 2s timeout, falls back gracefully

## Collections

### users

```typescript
{
  _id: ObjectId,
  email: string unique indexed,
  name: string,
  officialId: string unique,
  role: 'SUPER_ADMIN' | 'REGULATORY_ADMIN' | 'ENFORCEMENT_OFFICER' | 'REVIEWER' | 'ANALYST' | 'AUDITOR',
  department: string,
  passwordHash: string,
  active: boolean,
  lastLogin: Date,
  createdAt, updatedAt
}
```

**Indexes:** email unique, officialId unique

**Seed:** 4 demo users with password `Gov@2026` (bcrypt hash)

### regulatoryrules

```typescript
{
  _id: ObjectId,
  ruleCode: string unique indexed, // e.g., "LM-PC-2011-6(1)(e)"
  title: string,
  description: string,
  legalReference: string,
  category: string indexed, // MANUFACTURER_INFO, etc.
  applicableProductCategories: string[],
  requirementType: 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED',
  validationLogic: { field, operator, value, logic, conditions },
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING',
  enabled: boolean,
  effectiveFrom: Date,
  effectiveTo: Date,
  version: string,
  evidenceRequired: boolean,
  reviewRequired: boolean,
  status: 'DRAFT' | 'VALIDATION' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED',
  createdBy, updatedBy, approvedBy, approvedAt, publishedBy, publishedAt,
  createdAt, updatedAt
}
```

**Indexes:** ruleCode unique, category, status, version

**Seed:** 8 rules covering LM-PC-2011 6(1)(a)-(f), 8, 10

### inspections

```typescript
{
  _id: ObjectId,
  inspectionId: string unique indexed, // e.g., "LM-2026-001042"
  productId: string indexed,
  productName: string text indexed,
  brand: string indexed,
  category: string indexed,
  manufacturer: string text indexed,
  barcode: string indexed,
  batchNumber: string,
  inspectorId: string indexed,
  inspectorName: string,
  status: 'DRAFT' | 'PROCESSING' | 'REVIEW_REQUIRED' | 'COMPLIANT' | 'NON_COMPLIANT' indexed,
  source: 'FIELD' | 'ECOMMERCE' | 'UPLOAD',
  images: [{
    _id: ObjectId,
    side: 'FRONT' | 'BACK' | 'SIDE' | 'TOP' | 'BOTTOM' | 'ADDITIONAL',
    url: string,
    originalName: string,
    size: number,
    mimeType: string,
    quality: { resolution, blurScore, brightness, readability, coverage },
    uploadedAt: Date
  }],
  location: { latitude, longitude, accuracy, address },
  startedAt: Date,
  completedAt: Date,
  aiRunId: string,
  ruleSetVersion: string, // e.g., "LM-PC-2011-v1.2" — for reproducibility
  complianceScore: number,
  confidenceSummary: { average, min, max, lowConfidenceCount },
  findings: [{
    _id: ObjectId,
    declarationType: string,
    title: string,
    description: string,
    detectedValue: string,
    expectedValue: string,
    status: 'PASS' | 'VIOLATION' | 'WARNING' | 'REVIEW',
    severity: string,
    confidence: number,
    ruleId: string,
    ruleCode: string,
    legalReference: string,
    evidence: [{ imageId, boundingBox: { x, y, width, height }, croppedUrl }],
    reviewStatus: string,
    correctedValue: string,
    reviewerId, reviewerComment,
    createdAt
  }],
  extractedFields: [{
    fieldName: string,
    value: string,
    normalizedValue: string,
    rawText: string,
    language: string,
    script: string,
    confidence: number,
    sourceImageId: string,
    boundingBox: { x, y, width, height },
    status: string,
    editable: boolean,
    reviewStatus: string,
    ruleCode: string
  }],
  reviewStatus: 'NOT_REQUIRED' | 'PENDING' | 'IN_REVIEW' | 'COMPLETED',
  reportId: string,
  createdAt, updatedAt
}
```

**Indexes:** inspectionId unique, productId, productName text, brand, category, manufacturer text, barcode, inspectorId, status, createdAt desc, text index on productName+brand+manufacturer

**Seed:** 3 inspections with realistic findings

### auditlogs

```typescript
{
  _id: ObjectId,
  timestamp: Date indexed,
  userId: string indexed,
  userName: string,
  role: string,
  action: string indexed, // LOGIN, INSPECTION_CREATED, AI_ANALYSIS_COMPLETED, RULE_CREATED, etc.
  resource: string indexed, // AUTH, INSPECTION, RULE, REPORT, USER
  resourceId: string indexed,
  oldValue: Mixed,
  newValue: Mixed,
  ip: string,
  comment: string
}
```

**Indexes:** timestamp, userId, action, resource, resourceId

### reports

```typescript
{
  _id: ObjectId,
  reportId: string unique, // RPT-LM-2026-001042
  inspectionId: string indexed,
  productName: string,
  status: string,
  complianceScore: number,
  ruleSetVersion: string,
  aiModelVersion: string,
  generatedBy: string,
  generatedAt: Date,
  content: Mixed, // full inspection + findings + evidence + audit
  createdAt, updatedAt
}
```

### Additional Collections (Planned)

- productImages — separate if images large, reference via storage abstraction
- extractedFields — could be separate for querying, currently embedded
- evidence — immutable, separate collection with hash
- reviews — reviewer decisions, linked to findings
- ruleVersions, ruleSets — for versioning
- ecommerceListings — URL, platform, extracted data, comparison
- analyticsSnapshots — cached aggregates
- notifications — userId, type, read, etc.
- systemConfigurations — AI thresholds, scoring weights
- aiModelRuns — runId, inspectionId, provider, modelName, version, request, results, status
- syncQueue — offline-first, local drafts

## In-Memory Store

**File:** `src/lib/db/memory-store.ts`

- `MemoryCollection<T>` — Map-based, methods: create, findById, findOne, find (with query, limit, skip, sort), update, delete, count, clear, all
- `memoryDB` — object with collections: users, inspections, rules, auditLogs, ecommerceListings, products, reports, notifications
- `seedMemoryDB()` — idempotent, seeds if empty

**Why:** Ensures demo works without MongoDB, deterministic data for jury, no external dependencies.

## Connection Logic

```typescript
// src/lib/db/connection.ts
export async function connectDB(): Promise<boolean> {
  if (isConnected) return true;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    isConnected = true;
    return true;
  } catch {
    return false; // fallback to memory
  }
}
```

- If `NEXT_PUBLIC_DEMO_MODE=true` or MongoDB unavailable, uses memory
- All services try MongoDB first, catch and fallback to memory
- Logs status

## Data Model: Inspection

See `src/types/index.ts` for full Inspection interface.

Key fields for traceability:

- `inspectionId` — human-readable, e.g., LM-2026-001042
- `productId` — links to product repository
- `images[]` — with quality metrics, side, url, uploadedAt
- `location` — optional lat/lng, accuracy, address
- `aiRunId` — links to AI run
- `ruleSetVersion` — exact version used, for reproducibility
- `complianceScore` — 0-100
- `confidenceSummary` — avg, min, max, lowConfidenceCount
- `findings[]` — with ruleId, ruleCode, legalReference, evidence bounding boxes, reviewStatus, correctedValue
- `extractedFields[]` — with language, script, confidence, boundingBox, editable
- `reviewStatus` — PENDING, IN_REVIEW, COMPLETED, NOT_REQUIRED
- `reportId` — links to report

## Data Model: AI Run

Not yet separate collection, but stored in inspection + audit log. Future:

```typescript
{
  runId,
  inspectionId,
  provider: 'mock' | 'real',
  modelName, modelVersion,
  requestMetadata,
  processingStages,
  results,
  startedAt, completedAt,
  status,
  errors
}
```

## Indexing Strategy

- **Unique:** inspectionId, reportId, ruleCode, email, officialId
- **Indexed:** status, category, brand, barcode, manufacturer, inspectorId, userId, action, resource
- **Text:** productName, brand, manufacturer (for search)
- **Sort:** createdAt desc for recent inspections
- **Avoid:** Loading thousands at once — use pagination (limit/skip), server-side filtering

## Seeding

Run `npm run seed` or auto-seeds on first API call. Creates:

- Users: admin, officer, reviewer, analyst (Gov@2026)
- Rules: 8 LM-PC-2011 rules
- Inspections: FreshBite (REVIEW_REQUIRED 82), PureHarvest (COMPLIANT 96), CleanCare (NON_COMPLIANT 45)
- Products: 5 with risk scores
- Audit logs: demo

## Retention & Archival

- `system.retentionDays` = 365 (configurable)
- Archived rules: status ARCHIVED, still referenced by old inspections/reports
- Reports: never deleted, only archived

## Future: Real MongoDB

- Set `MONGODB_URI` in .env
- App will auto-connect, seed if empty
- All memory operations have MongoDB equivalents already coded (try/catch fallback)
- For production, remove memory fallback or keep as cache

## Security

- No passwords in logs
- Audit logs read-only for normal admins
- Evidence immutable — changes create new audit entry
- Location optional, not required
