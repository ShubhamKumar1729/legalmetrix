# LegalMetrix — Package Label Compliance, made simple

> Scan a packaged product → the AI reads the legally-required label details → the rule engine checks them → a human officer decides → an evidenced, auditable report comes out. Built for the Legal Metrology (Packaged Commodities) Rules, 2011.

**Two design promises everything in this repo follows:**

1. **A new user should never be stuck.** Every screen has a plain-language explanation, the workflow is always the same 4 numbered steps, and official jargon (NON_COMPLIANT, VIOLATION, …) is always paired with friendly wording. In-app: `/app/guide` ("Start Here").
2. **Zero blue. Anywhere.** No `blue`, `sky`, `indigo`, `cyan`, `violet` — and not even blue-tinted grays like `slate`. Neutrals are warm `stone`, primary is emerald green, status is emerald/amber/red. Enforced by the palette in `globals.css` + a comment guard in `tailwind.config.ts`. If you add UI, use the semantic tokens (`primary`, `muted`, `background`…), never raw blue shades.

---

## Quick start

```bash
npm install
cp .env.example .env     # sensible defaults; demo works with no changes

npm run dev              # http://localhost:3000
npm test                 # rule engine + scoring + AI contract tests
npm run seed             # standalone seeding (memory store, mirrors to Mongo if reachable)
npm run build && npm start
```

**Demo accounts** (password `Gov@2026`): `officer@gov.in` (inspector) · `reviewer@gov.in` · `admin@gov.in` · `analyst@gov.in`.
Works with zero infrastructure: if `MONGODB_URI` isn't reachable, the app runs on an in-memory demo store (fast-fail, 2 s timeout — the UI never hangs waiting on Mongo).

---

## The workflow (what the UI teaches too)

| # | Step | Where | What happens |
|---|------|-------|--------------|
| 1 | Scan the package | New Scan | Pick photos (real upload to server, device-side quality measurement), fill basic product info |
| 2 | Check the AI's findings | Inspection result | 12-stage animated pipeline, per-declaration findings, photo evidence with highlighted region, confidence everywhere explained |
| 3 | Human decision | Review Queue | Accept / Correct / Reject each open finding (only Reviewers & Admins — enforced on the server, not just hidden in the UI) |
| 4 | Report | Reports | Generate & download the report; rule version + model version + every human decision included |

Supporting screens: **Products** (history & risk), **Online Listings** (listing vs pack comparison), **Trends & Risk** (repeat offenders), **Rules Library** (each rule explained in plain words, full draft→validated→approved→published→retired workflow), **Activity Log**, **Settings** (thresholds, scoring weights, AI model connection + live test button), and a mobile/field screen (`/mobile`).

## Architecture

```
Next.js 14 UI (plain-language, step-tracked)
   ↓ same-origin fetches (session = httpOnly cookie)
API route handlers ── every one guarded server-side: JWT cookie/Bearer + RBAC permission
   ├─ AI Adapter (src/lib/ai)        → registry → mock | real HTTP provider | custom
   ├─ Rule Engine (src/lib/rules)    → safe JSON DSL, no eval(), versioned rules
   ├─ Scoring (src/lib/rules/scoring)→ configurable weights & thresholds
   ├─ Storage (src/app/api/uploads)  → local disk now, S3-shaped swap later
   ├─ Audit (src/lib/audit)          → append-only, everything attributed
   └─ DB: Mongoose ⇄ in-memory fallback (singleton on globalThis so all
      routes share one store in dev — see src/lib/db/memory-store.ts)
```

Key files:
- `src/lib/ai/http-provider.ts` — the real-model adapter: **already implemented**; just point env vars at your service (below).
- `src/lib/auth/session.ts` — `guardRequest(req, 'permission')` used by every protected route.
- `src/lib/ui/labels.ts` — friendly status/severity/field wording + `describeLogic()` that translates rule DSL to sentences.
- `src/app/app/guide/page.tsx` — the Start Here guide + glossary.

## Plugging in your model (already wired for it)

Contract doc: **`MODEL_INTEGRATION.md`**. Short version — implement 3 endpoints (`GET /health`, `POST /analyze`, `POST /extract-text`) and set:

```
AI_PROVIDER=real
AI_SERVICE_URL=https://your-model-endpoint.com
AI_SERVICE_KEY=***
AI_TIMEOUT_MS=60000        # optional
```

That's it — no UI or platform code changes. Responses are normalized (missing arrays → `[]`, confidence clamped 0–100), long-running analysis can return `PROCESSING` and the UI polls `GET /api/inspections/[id]/results`, and in demo mode a failing real call falls back to the mock once instead of dead-ending. Watch the **Settings → AI model connection** card: it shows the active provider/model and has a live *Test connection* button (`/api/ai/status`).

## Security (real, not decorative)

- bcrypt password hashes (created users verified against their own hash; no plaintext shortcut)
- JWT sessions via httpOnly cookie + optional `Authorization: Bearer`
- **Every** API route (except login/placeholder) requires a valid session; sensitive routes additionally require an RBAC permission (`review:write`, `rule:write`, `config:write`, …) — verified: officer gets 403 on reviewer/admin endpoints
- Zod validation on login and user creation; upload type/size limits; path-traversal-safe evidence serving; append-only audit log
- X-Content-Type-Options, Referrer-Policy, X-Frame-Options (DENY in production, SAMEORIGIN in dev so previews work)

## Tests

`npm test` → rule evaluator operators, AND/OR/NOT logic, scoring range, plain-language rule descriptions, and the full mock-AI response contract (stages, findings, confidence, model metadata, rule references).

## Demo determinism

Product names *FreshBite* (82/100, needs review), *PureHarvest* (96, pass), *CleanCare* (45, violation) drive the prepared scenarios — but only when the mock provider is active and `NEXT_PUBLIC_DEMO_MODE=true`. Real-model results are never overridden.

## Docs

`ARCHITECTURE.md` · `MODEL_INTEGRATION.md` · `RULE_ENGINE.md` · `DATABASE.md` · `API.md` · `SECURITY.md` · `DEMO_GUIDE.md`

*Prototype disclaimer: all data is synthetic; AI output is an assisted assessment, never an autonomous enforcement decision — that is the point of the review queue.*
