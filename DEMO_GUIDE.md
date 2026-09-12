# Demo Guide — SIH 26034 Jury Presentation (60-90 seconds)

## Setup (Before Jury)

1. **Start App:**
   ```bash
   npm install
   npm run dev
   # Open http://localhost:3000
   ```

2. **Verify Seed Data:**
   - Landing page shows dashboard preview
   - Login page has demo credentials prefilled (officer@gov.in / Gov@2026)

3. **Deterministic Mock:**
   - MockAIProvider returns same results for same product names
   - No random failures — reliable demo
   - Processing stages animate with realistic timing (800ms)

## 60-Second Flow (Must Communicate Intelligence)

### 0-10s: Landing + Login

- Show landing page: "AI-Powered Packaged Commodity Compliance"
- Highlight: Ministry of Consumer Affairs, SIH 26034, trust/security badges
- Click "Start Inspection" or "Open Platform" → Login as Enforcement Officer (officer@gov.in / Gov@2026)

### 10-20s: Dashboard

- **Enforcement Dashboard** opens
- Point to KPIs: Total 2,847, Compliant 1,923, Violations 412, Review 512
- Charts: Inspections over time, compliance distribution, repeat offenders
- Recent inspections table: show LM-2026-001042 FreshBite REVIEW_REQUIRED 82
- Say: "Real data from backend, not static"

### 20-35s: New Inspection → AI Analysis

- Click "New Inspection" → Select "Upload Images" → Product info prefilled FreshBite Premium Biscuits
- Upload images: front/back already there, quality check shows 92% readability, warning for small font
- Click "Start AI Analysis" → **AI Processing Pipeline UI** with 12 stages:
  - Image Quality → OCR → Text Region → Declaration Detection → Entity Extraction → Multilingual → MRP → Quantity → Font → Rule Validation → Confidence → Final Decision
  - Each stage shows COMPLETED with check, one WARNING for font size
- Say: "Mock AI now, real model plugs via AIModelProvider interface without UI rebuild — see MODEL_INTEGRATION.md"

### 35-50s: Results → Evidence → Review

- **Results Page:** Product name, inspection ID, date, inspector, location (Ludhiana)
- **Compliance Score:** 82/100, REVIEW_REQUIRED, breakdown Passed/Violations/Warnings
- **Findings Table:** MRP PASS 98%, Net Quantity PASS 96%, Manufacturer REVIEW 71%, Customer Care VIOLATION 94% — each with confidence, evidence button, rule code LM-PC-2011-6(1)(e)
- **Evidence Viewer:** Package image with bounding box overlay, click finding focuses evidence region, geo-tagged lat/lng
- **Extracted Fields:** Show multilingual, bounding box coordinates, language EN/Latin, editable
- Click "Review Queue" → Show queue with 4 items, filters low confidence/violation
- Open review: Left image, center AI finding, right review panel with Accept/Correct/Reject, audit trail
- Correct manufacturer address → shows AI Value vs Corrected Value for model improvement

### 50-60s: Reports → Rules → Intelligence

- **Generate Report:** Click Reports → list with RPT-LM-2026-001042, download PDF (txt for demo, jsPDF ready)
- **Report Includes:** Gov identity, inspection ID, product, inspector, date, location, images, declarations, score, violations, confidence, rule refs, evidence, review decisions, rule version v1.2, AI model v0.1.0, audit info
- **Traceability:** Finding → Evidence → AI → Rule → Rule Version → Reviewer → Final Report
- **Rules:** Go to Rules → 8 rules, JSON DSL, no hardcoded logic, versioning, publishing workflow DRAFT→PUBLISHED, historical reproducibility
- **Analytics:** Repeat offender detection, risk scoring, enforcement prioritization High/Medium/Low
- **E-commerce:** Show listing vs package mismatch (MRP ₹99 vs ₹89)

### Closing (10s)

- "We inspect products, use AI to extract, validate against configurable regulations, show evidence, quantify confidence, involve humans when uncertain, maintain versions, generate reports, track history, identify repeat offenders, inspect e-commerce, support field enforcement"
- "Built as serious GovTech, not college CRUD — modular, scalable, secure, auditable, ready for real model integration"

## Key Talking Points for Judges

1. **No Fake Buttons:** Every button works — SCAN creates inspection, ANALYZE calls backend/mock AI, VIEW shows real stored result, REVIEW edits DB, RULE CHANGE creates version, PUBLISH changes active rules, REPORT generates real report, HISTORY shows previous inspections unchanged, AUDIT LOG records actions

2. **No Hardcoded Rules:** React components never contain `if (mrpMissing)`. All via rule engine DB + JSON DSL, safe evaluator, versioned

3. **AI Abstraction:** `AIModelProvider` interface, `MockAIProvider` now, real model later via `aiRegistry.register()`, no frontend changes — documented in MODEL_INTEGRATION.md

4. **Confidence vs Compliance:** Clearly distinguished — AI confidence (98%) vs Compliance score (82/100) — not same

5. **Evidence Traceability:** Judge can trace Finding → Evidence (image+box) → AI output (model v0.1.0) → Rule (v1.2) → Reviewer decision → Final report

6. **Security:** RBAC 6 roles, backend enforced, bcrypt, JWT, audit logs, secure headers, no secrets in frontend

7. **Offline & Mobile:** /mobile route, camera-first, sync queue UI, offline indicator, local draft queue abstraction

8. **Demo Reliability:** Deterministic seed, no external dependencies, works offline, fast processing

## Backup Demos

If time:

- Show Rule Editor: Create new rule, validation, publish, run inspection again with new rule
- Show Product History: Timeline with PASS/VIOLATION, trend
- Show Audit Log: Immutable trail with user, timestamp, old/new values
- Show User Management: RBAC roles

## Troubleshooting

- If MongoDB not available: App auto-falls back to in-memory, still works
- If images fail: Placeholder SVG via /api/placeholder/image
- If AI fails: Fallback to mock in demo mode
- If build fails: Check RuleCondition operator optional fix

## What Makes This SIH-Winning

- Looks professional for national hackathon — not childish, not generic SaaS, but GovTech enterprise
- Behaves like real product, not prototype
- Modular, scalable, configurable, secure, responsive, ready for real AI model
- Complete end-to-end flow, not just dashboard
- Documentation: README, ARCHITECTURE, MODEL_INTEGRATION, RULE_ENGINE, DATABASE, API, SECURITY, DEMO_GUIDE
- .env.example, seed scripts, clean structure, TypeScript strict, no TODOs for core functionality
