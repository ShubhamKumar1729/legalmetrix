# Architecture — PackComply SIH 26034

## Overview

PackComply is a modular, production-grade GovTech platform built with Next.js 14 App Router, TypeScript strict, Tailwind, and MongoDB/Mongoose with in-memory fallback.

## Layers

### 1. Presentation Layer (UI)

- **Landing** (`/`) — Marketing, problem/solution, demo creds
- **Authenticated Shell** (`/app`) — Sidebar, TopNav, RBAC guard
  - Dashboard — KPIs, Recharts, recent inspections
  - Scan — 4-step wizard, image uploader, quality check
  - Scan/[id] — Results with evidence viewer, bounding boxes, findings table, extracted fields
  - Review — Queue with filters, evidence + review panel
  - Products — Repository, search, risk badges
  - E-commerce — URL input, listing vs package comparison
  - Analytics — Trends, repeat offenders, risk scoring
  - Reports — List + detail + PDF export
  - Rules — CRUD, DSL preview
  - Rule Versions — Timeline, publishing workflow
  - Admin — Users, Audit Log
  - Mobile — Field-optimized, sync queue

**Design System:**
- Deep blue/navy primary (trust, gov)
- White/light surfaces, subtle neutral backgrounds
- Green compliant, amber review, red violation, blue AI
- No excessive gradients/glassmorphism
- Plus Jakarta Sans + Inter, generous spacing, subtle shadows

### 2. API Layer (Next.js Route Handlers)

RESTful, consistent response format:

```json
// Success
{ "success": true, "data": ... }

// Error
{ "success": false, "error": { "code": "AUTH_FAILED", "message": "..." } }
```

Endpoints:
- POST /api/auth/login
- GET /api/inspections, POST /api/inspections, GET /api/inspections/[id], PATCH /api/inspections/[id]
- POST /api/inspections/[id]/analyze — triggers AI + rule engine
- GET /api/products, GET /api/products/[id], GET /api/products/[id]/history
- GET /api/rules, POST /api/rules, GET/PATCH /api/rules/[id]
- GET /api/analytics
- GET/POST /api/reports
- GET /api/audit-logs
- POST /api/ecommerce/analyze
- GET /api/search, GET /api/users, GET /api/configuration

All routes validate input (Zod) and enforce RBAC server-side.

### 3. Domain Services

#### AI Adapter

- `AIModelProvider` interface: `analyze(request): Promise<AIAnalyzeResponse>`
- `MockAIProvider` — deterministic, realistic stages, bounding boxes, confidence
- `AIProviderRegistry` — factory, fallback to mock in demo mode
- Future: implement interface, register, set AI_PROVIDER env

#### Rule Engine

- `RegulatoryRule` model: id, ruleCode, title, description, legalReference, category, applicableProductCategories, requirementType, validationLogic (JSON DSL), severity, enabled, effectiveFrom/To, version, evidenceRequired, reviewRequired, status (DRAFT→PUBLISHED→ARCHIVED)
- `evaluator.ts` — safe evaluator for DSL operators: exists, not_exists, equals, not_equals, contains, regex, gt/lt/gte/lte, in/not_in, AND/OR/NOT
- `engine.ts` — builds context from extractedFields + productMetadata, evaluates active rules, calculates compliance score, decides PASS/VIOLATION/WARNING/REVIEW based on confidence thresholds (90/75 configurable)
- `scoring.ts` — configurable weights per severity, compliance status logic

**No hardcoded rules in UI** — all via DB + engine.

#### Scoring & Risk

- Compliance score: 100 - (deductions / totalWeight * 100), deductions weighted by severity and confidence
- Risk score: violationRate*60 + criticalViolations*30 + reviewRate*10

#### Storage Adapter

- `StorageProvider` interface: upload, delete, getUrl, exists
- `LocalStorageProvider` — writes to ./uploads, returns mock URLs for demo reliability
- Ready for S3: implement interface, set STORAGE_TYPE=s3

#### E-commerce Provider

- `EcommerceProvider` interface: analyze(url)
- `MockEcommerceProvider` — simulates Amazon/Flipkart extraction
- Comparison: listingValue vs packageValue, match boolean, status

#### Audit Service

- `logAudit(event)` — stores in memory + MongoDB, logs to console
- Events: LOGIN, INSPECTION_CREATED, AI_ANALYSIS_COMPLETED, RULE_CREATED/UPDATED/PUBLISHED, REVIEW decisions, etc.
- Fields: timestamp, userId, userName, role, action, resource, resourceId, oldValue, newValue, ip, comment

#### Config Service

- System-wide: AI thresholds, scoring weights, inspection quality minima, retention, notifications
- In-memory for demo, MongoDB-ready

### 4. Data Layer

#### MongoDB Models (Mongoose)

- User: email, name, officialId, role, department, passwordHash, active, lastLogin
- RegulatoryRule: ruleCode unique indexed, title, validationLogic, severity, status, version, etc.
- Inspection: inspectionId unique indexed, productName text indexed, brand, category, manufacturer, barcode indexed, inspectorId indexed, status indexed, images[], location, ruleSetVersion, complianceScore, confidenceSummary, findings[], extractedFields[], reviewStatus, timestamps
- AuditLog: timestamp indexed, userId indexed, action indexed, resource indexed, resourceId indexed
- Report: reportId unique, inspectionId indexed, content

**Indexes:** product name text, barcode, manufacturer, brand, inspection ID, status, createdAt, ruleCode, userId

#### Memory Store Fallback

- `MemoryCollection<T>` — Map-based, create/findById/findOne/find/update/delete/count
- `memoryDB` — users, inspections, rules, auditLogs, products, reports, etc.
- `seedMemoryDB()` — deterministic demo data:
  - 4 users (admin, officer, reviewer, analyst)
  - 8 rules (LM-PC-2011 6(1)(a)-(f), 8, 10)
  - 3 inspections: FreshBite REVIEW_REQUIRED 82, PureHarvest COMPLIANT 96, CleanCare NON_COMPLIANT 45
  - 5 products with risk scores
- Auto-seeds on first API call, idempotent

#### Connection

- `connectDB()` — tries MongoDB with 2s timeout, falls back to memory, logs status
- `isDBConnected()` — checks readyState

## Data Flow: Inspection

1. Officer creates inspection via POST /api/inspections → stored DRAFT
2. Uploads images → stored via StorageProvider
3. POST /api/inspections/[id]/analyze
   - Updates status PROCESSING
   - Calls AI Adapter → MockAIProvider.analyze() → 12 stages, extractedFields, findings, confidence, evidenceRegions, warnings, modelMetadata
   - Calls Rule Engine → evaluates active rules against context → findings + complianceScore
   - Merges (deterministic for demo)
   - Calculates final status: COMPLIANT / NON_COMPLIANT / REVIEW_REQUIRED
   - Updates inspection with findings, extractedFields, complianceScore, confidenceSummary, aiRunId, completedAt
   - Logs audit
4. If REVIEW_REQUIRED → appears in Review Queue
5. Reviewer opens → Accept/Correct/Reject → PATCH inspection, logs audit with old/new
6. Report generation → POST /api/reports → stored with ruleSetVersion + aiModelVersion
7. Product history updated → Analytics recalculates repeat offenders

## Security

- bcrypt password hashing
- JWT (AUTH_SECRET min 32 chars, 7d expiry)
- RBAC: 6 roles, permission matrix, canAccessRoute(), backend enforcement on every API
- Input validation: Zod schemas shared frontend/backend
- File validation: mime type, size limit, no executable
- Secure headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict
- No secrets in frontend, env vars only
- Audit logging immutable

## Scalability & Extensibility

- AI Provider pluggable — no UI rebuild needed
- Storage Provider pluggable — local → S3
- E-commerce Provider pluggable — add adapters
- Rule DSL safe — no code injection
- Rule versioning — historical reproducibility
- Config service — thresholds not hardcoded
- Offline-first abstraction — sync queue ready for PWA + IndexedDB

## Deployment

- Next.js standalone, Node 20
- Env: MONGODB_URI, AUTH_SECRET, STORAGE_*, AI_*
- Demo mode: NEXT_PUBLIC_DEMO_MODE=true → uses memory store, mock AI, deterministic data
- Production: set MONGODB_URI, AUTH_SECRET, STORAGE_TYPE=s3, AI_PROVIDER=real, AI_SERVICE_URL/KEY
- Build: `npm run build`, start: `npm start -p 3000 -H 0.0.0.0`
- Preview: 0.0.0.0 binding, host allowlist handled via next.config.mjs

## Tradeoffs

- Used in-memory fallback for demo reliability without external MongoDB — production would require real MongoDB
- Mock AI simulates stages with 800ms delay — real model would have longer processing, need queue/webhook
- Local storage returns mock URLs — S3 would need presigned URLs
- PDF generation simplified to txt for demo — jsPDF integration ready
