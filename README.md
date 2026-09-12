# PackComply — AI-Powered Packaged Commodity Compliance Platform

**SIH Problem Statement 26034**
Ministry of Consumer Affairs, Food & Public Distribution — Department of Consumer Affairs

> "Software System to check compliance of Packaged Commodities under Legal Metrology (Packaged Commodities) Rules, 2011 by scanning products, images and labels."

---

## 🎯 Product Vision

Enforcement-grade GovTech platform that helps authorized officers:

1. **Capture** multi-side package images (field / upload / e-commerce)
2. **AI Analysis** — OCR, declaration detection, entity extraction, multilingual matching, font/readability
3. **Rule Validation** — Configurable JSON DSL engine, versioned, no hardcoded logic in UI
4. **Confidence Scoring** — 90% high / 75% medium thresholds, configurable, routes low-confidence to human review
5. **Human Review** — Accept / Reject / Correct with audit trail, AI vs Corrected delta stored for model improvement
6. **Evidence Management** — Geo-tagged images, bounding boxes, cropped evidence, immutable
7. **Reports** — PDF-ready, rule version, AI model version, audit trail, signatures
8. **Intelligence** — Repeat offender detection, risk scoring, geographic trends

**Core Principle:** AI-assisted assessment, human-decided enforcement. Final decision attributable to authorized officials.

---

## 🏗️ Architecture

```
Frontend (Next.js 14, React, TS, Tailwind, shadcn)
  ↓
Backend API (Next.js Route Handlers)
  ↓
Domain Services
  ├─ AI Adapter → AIModelProvider interface → MockAIProvider (now) → Real Model (future)
  ├─ Rule Engine → Safe JSON DSL evaluator (no arbitrary JS)
  ├─ Scoring Engine → Configurable weights
  ├─ Storage Adapter → Local (dev) → S3-compatible (prod)
  ├─ E-commerce Provider → Mock → Real adapters
  ├─ Audit Service → Immutable logs
  └─ Config Service → System-wide thresholds
  ↓
Database (MongoDB + Mongoose, fallback to in-memory for demo)
```

**Separation of Concerns:**
- UI never contains regulatory logic
- AI results originate from provider layer only
- Rules stored in DB, evaluated server-side
- All permissions enforced backend

See `ARCHITECTURE.md` for details.

---

## 🚀 Quick Start

```bash
# Clone & install
npm install

# Configure env (see .env.example)
cp .env.example .env
# Edit MONGODB_URI if you have MongoDB, else app uses in-memory store

# Seed demo data (optional, auto-seeds on first API call)
npm run seed

# Dev
npm run dev
# Open http://localhost:3000

# Build
npm run build
npm start
```

**Demo Credentials (password: Gov@2026):**
- officer@gov.in — Enforcement Officer
- reviewer@gov.in — Reviewer
- admin@gov.in — Super Admin
- analyst@gov.in — Analyst

---

## 🔑 Key Features Implemented

### Enforcement Dashboard
- KPIs: Total, Compliant, Violations, Review Required, Compliance Rate, Avg Confidence
- Charts: Inspections over time, Compliance vs Violations, Violation categories, Category distribution
- Recent inspections table with filters
- Repeat offender risk scoring

### Product Scanning
- 4 steps: Capture Method → Product Info → Upload Images → Quality Check
- Multi-side: FRONT, BACK, SIDE, TOP, BOTTOM, ADDITIONAL
- Image quality: resolution, blur, brightness, readability, coverage
- Warnings for poor quality

### AI Processing (Mock but Realistic)
- 12 stages: Image Quality → OCR → Text Region → Declaration Detection → Entity Extraction → Multilingual → MRP → Quantity → Font → Rule Validation → Confidence → Final Decision
- Each stage: pending/processing/completed/warning/failed with progress
- Deterministic mock for reliable jury demo
- Returns: extractedFields, findings, evidenceRegions, confidence, warnings, modelMetadata

### Rule Engine
- Safe JSON DSL: exists, equals, contains, regex, gt/lt/gte/lte, in/not_in, AND/OR/NOT
- No arbitrary JS execution
- Categories: MANUFACTURER_INFO, PRODUCT_IDENTITY, NET_QUANTITY, MRP, CONSUMER_CARE, READABILITY, etc.
- Severity: CRITICAL, HIGH, MEDIUM, LOW, WARNING
- Versioning: DRAFT → VALIDATION → READY_FOR_APPROVAL → APPROVED → PUBLISHED → ARCHIVED
- Every inspection stores ruleSetVersion used

### Human Review
- Queue with filters: low confidence, violation, category, severity
- Left: product image, Center: AI finding, Right: review panel
- Actions: Accept, Reject, Correct, Escalate, Add comment
- Stores AI Value vs Corrected Value for model improvement
- Audit logged

### Product Repository
- Search by product, brand, manufacturer, barcode, inspection ID, category, status, date
- Product detail: latest score, status, images, declarations, violations, history
- Timeline history with trend

### E-commerce Module
- EcommerceProvider interface
- MockEcommerceProvider
- URL → Listing retrieval → Compliance analysis → Package/Listing comparison → Mismatch detection
- Example: Listing MRP ₹99 vs Package MRP ₹89 → MISMATCH

### Analytics
- Violation trends, manufacturer trends, brand, category, geographic, time
- Repeat offender detection with risk score
- Enforcement prioritization: High/Medium/Low

### Reports
- Includes: Gov identity, inspection ID, product, manufacturer, inspector, date, location, images, declarations, compliance status, score, violations, confidence, rule refs, evidence, review decisions, rule version, AI model version, audit info, signature placeholders
- PDF export (txt for demo, jsPDF ready)
- Traceability: Finding → Evidence → AI → Rule → Rule Version → Reviewer → Final Report

### Administration
- Users: create, deactivate, role assign, last login
- Rules: CRUD, clone, version, publish with validation
- Audit Log: login, inspection, AI result, correction, rule changes, report gen, role changes
- System Config: AI thresholds, scoring weights, inspection config

### Security
- bcrypt password hashing
- JWT sessions
- RBAC with 6 roles
- Server-side authorization on every API
- Input validation via Zod
- File type/size validation
- Secure headers
- No secrets in frontend

### Offline-First & Mobile
- /mobile route: camera-first, large capture button, sync queue UI
- Offline indicator, pending sync, syncing, synced, failed states
- Sync abstraction ready for PWA + IndexedDB

---

## 🧪 Mock AI Provider

**Location:** `src/lib/ai/mock-provider.ts`

Implements `AIModelProvider` interface. Returns deterministic results based on product name:

- FreshBite → 82 score, REVIEW_REQUIRED, 1 missing (customer care), 1 low confidence (manufacturer)
- PureHarvest → 96, COMPLIANT
- CleanCare → 45, NON_COMPLIANT, MRP missing

**Future Integration:** Implement `AIModelProvider` and register in `aiRegistry`. See `MODEL_INTEGRATION.md`.

---

## 📊 Demo Scenario (60s Jury Flow)

1. Login as officer@gov.in / Gov@2026
2. Dashboard opens — KPIs, charts, recent inspections
3. Click "New Inspection" → Select Upload → Fill FreshBite Biscuits → Upload front/back
4. Quality check shows 92% readability, warning for small font
5. Click "Start AI Analysis" → Pipeline UI with 12 stages animates
6. Results: MRP PASS 98%, Net Quantity PASS 96%, Manufacturer REVIEW 71%, Customer Care VIOLATION 94%
7. Compliance Score 82/100 • REVIEW_REQUIRED • Confidence 89% avg
8. Evidence viewer shows bounding boxes on image
9. Open Review Queue → Examine evidence → Correct manufacturer address → Accept
10. Generate Report → Download PDF → Product saved to repository
11. Analytics updates • Repeat offender trend visible
12. Go to Rules → Create new rule version → Publish → New inspections use new version automatically

---

## 📁 Project Structure

```
src/
  app/
    page.tsx (landing)
    login/page.tsx
    app/ (authenticated shell)
      dashboard/
      scan/[inspectionId]/
      review/
      products/
      ecommerce/
      analytics/
      reports/
      rules/
      rule-versions/
      admin/
    api/
      auth/
      inspections/
      products/
      rules/
      analytics/
      reports/
      audit-logs/
      ecommerce/
      ...
  components/
    ui/ (shadcn)
    layout/ (sidebar, top-nav, app-shell)
  lib/
    db/ (connection, memory-store, models)
    auth/ (auth, rbac)
    ai/ (provider, mock-provider, types)
    rules/ (engine, evaluator, scoring)
    storage/ (storage, local-storage)
    audit/
    config/
  types/
  utils/
```

---

## 🧭 Documentation

- `ARCHITECTURE.md` — System design, modules, data flow
- `MODEL_INTEGRATION.md` — How to plug real AI model
- `RULE_ENGINE.md` — DSL, evaluation, versioning
- `DATABASE.md` — Collections, indexes, models
- `API.md` — REST endpoints, request/response
- `SECURITY.md` — Auth, RBAC, audit, headers
- `DEMO_GUIDE.md` — Jury presentation flow

---

## ✅ SIH Quality Bar

All items from spec verified:

- [x] Landing polished
- [x] Auth + RBAC functional (backend enforced)
- [x] Dashboard functional with real data
- [x] Multi-image upload
- [x] Mock AI functional with pipeline UI
- [x] OCR data structure + bounding boxes
- [x] Confidence scores configurable
- [x] Rule engine functional, not hardcoded
- [x] Rule versioning + publishing workflow
- [x] Human review + edits + audit
- [x] Product repository + history
- [x] E-commerce mock provider
- [x] Analytics + repeat offender
- [x] Compliance scoring configurable
- [x] Evidence management immutable
- [x] Reports + PDF
- [x] User management
- [x] Audit logs
- [x] Search + filters + export
- [x] Mobile responsive + offline queue abstraction
- [x] Security, validation, loading/empty/error states
- [x] Seed data + deterministic demo
- [x] Docs + .env.example + integration contract

---

## 📜 Legal Disclaimer

This is a prototype for Smart India Hackathon 2026. All product data is synthetic, fictional, and clearly labeled as demo. Not connected to real government databases. AI outputs are "AI-assisted compliance assessment" not legal authority. Final decisions attributable to authorized officials.

---

## 🏆 Built For

- **Problem Statement:** 26034
- **Organization:** Ministry of Consumer Affairs
- **Theme:** Miscellaneous
- **Category:** Software

**PackComply** — Trustworthy, auditable, configurable, scalable GovTech enforcement platform.
#   l e g a l m e t r i x  
 #   l e g a l m e t r i x  
 