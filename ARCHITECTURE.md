# Architecture

Next.js 14 App Router · React 18 · TypeScript · Tailwind. Route handlers act as the
API layer; there is no separate backend service.

## Request flow

```
Browser
  → /app/** pages (client components inside AppShell)
  → /api/** route handlers
       → session check (httpOnly JWT cookie) + permission check
       → repository (db.*)
       → domain services (rule engine, AI provider, storage, audit)
```

## Layers

### Data access — `src/lib/db`
- `models.ts` — Mongoose schemas.
- `connection.ts` — connects when `MONGODB_URI` is set; never throws.
- `repository.ts` — the single `db` object used by every route. Each collection is a
  `Repository<T>` backed by MongoDB when connected, otherwise by an in-memory
  collection. Both start empty.
- `bootstrap.ts` — creates one administrator from `BOOTSTRAP_ADMIN_*` **only** when
  the user collection is empty.

Nothing in this layer ever inserts business records on its own.

### Authentication and authorisation — `src/lib/auth`
- `auth.ts` — bcrypt hashing, JWT signing/verification, `authenticateUser`.
- `session.ts` — `requireUser()` / `requirePermission()` helpers used by every route.
  They return a ready-to-send `NextResponse` (401/403) so the call site stays short.
- `rbac.ts` — the permission matrix for six backend roles, plus the mapping to the
  three roles the interface talks about (`simpleRole`).

### Analysis — `src/lib/ai`
- `types.ts` — `AIAnalyzeRequest` / `AIAnalyzeResponse` / `AIModelProvider`.
- `provider.ts` — registry selecting `development` or `http` from `AI_PROVIDER`.
- `mock-provider.ts` — development provider. Accepts the real request, returns the
  real response shape, extracts nothing, and reports that explicitly in `warnings`.
- `http-provider.ts` — calls the real vision model at `AI_SERVICE_URL`.
- `merge-findings.ts` — merges model findings over the rule engine's decisions.

### Rules — `src/lib/rules`
- `evaluator.ts` — safe JSON condition evaluator (no `eval`, no arbitrary code).
- `engine.ts` — loads published rules from the database and turns extracted fields
  into findings, using confidence thresholds to decide between violation and review.
- `scoring.ts` — `calculateComplianceScore`, `computeOutcome`, `calculateRiskScore`.
- `validation.ts` — Zod schema for rule payloads.

### Evidence — `src/lib/images`, `src/lib/storage`
- `inspect.ts` — parses real PNG/JPEG/WEBP headers to confirm the bytes are a
  decodable image and to read true dimensions; rejects unsupported, corrupt,
  truncated and low-resolution files.
- `local-storage.ts` — writes evidence under `STORAGE_PATH` and serves it through
  `GET /api/images/[id]`. The `StorageProvider` interface allows an object-storage
  implementation to be dropped in.

### E-commerce — `src/lib/ecommerce`
`provider.ts` defines the listing-provider interface. With no provider configured
the API returns `501 PROVIDER_NOT_CONFIGURED` instead of returning data.

### Audit — `src/lib/audit`
`logAudit()` writes a record for every sign-in, inspection, analysis, review, rule
change, user change and configuration change.

## The inspection pipeline

```
1  Product information            POST /api/inspections
2  Capture or upload images       POST /api/images  → normalized image record
3  Analyze                        POST /api/inspections/:id/analyze
       provider.analyze()         → extractedFields (+ optional findings)
       ruleEngine.evaluate()      → one finding per applicable published rule
       mergeFindings()            → model evidence over rule decisions
       computeOutcome()           → score, status, review flag
4  Review (if required)           POST /api/inspections/:id/findings/:findingId
5  Report                         POST /api/inspections/:id/report
```

Camera and upload converge at step 2: both produce the same `ProductImage` record,
so steps 3–5 never need to know where an image came from.

## Design rules this codebase follows

- No seeded or fabricated business data. Empty collections produce zeros and
  purpose-built empty states.
- Every read/write goes through the repository, so swapping the database touches
  one file.
- Compliance decisions come from stored rules plus real extracted data plus human
  review — never from hard-coded scenarios.
- Advanced detail (model metadata, raw OCR, bounding boxes) is available but hidden
  behind *Technical details*.
