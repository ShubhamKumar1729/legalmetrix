# Demo Guide — LegalMetrix (60–90 seconds)

## Setup

```bash
npm install && npm run dev        # MongoDB optional — falls back to in-memory instantly
```

- Deterministic demo model: product names **FreshBite** (→ 82/100, needs review), **PureHarvest** (→ 96 pass), **CleanCare** (→ 45 violation). No random failures; pipeline animation is cosmetic only.
- Demo accounts (password `Gov@2026`): officer / reviewer / admin / analyst @gov.in.

## The flow

### 0–10s · Login (and the pitch)

Open `/` → “Four steps. Always the same four.” → Sign in. Point out: the whole product is one 4-step flow plus lookup screens; a brand-new officer is walked through by the **Start Here** page (show it — glossary included). Note the palette: deliberately zero blue, warm neutrals + emerald.

### 10–25s · Scan

**New Scan** → Upload photos (they really upload to `/api/uploads` and brightness/resolution are measured on-device) → product info prefilled with FreshBite → **Start AI analysis** → land on results: 12 pipeline stages animate, then every legally-required item with plain-language verdicts (Looks fine / Please check / Rule broken) and confidence explained (“AI certainty”).

### 25–45s · Evidence + human decision (the heart)

- Click a finding row → photo evidence with the **highlighted region** and the exact legal reference.
- Officer can look, not decide — the panel says so (RBAC enforced server-side; 403s in the API even if you curl).
- Log in as **reviewer@gov.in**, open the same item from **Review Queue**, press **Correct**, type the full address → AI value vs human value stored side by side; the score and status re-route live (82 → after decisions: resolved).

### 45–60s · Report + traceability

Review queue is empty → **Generate report** → open from **Reports**, Download. Walk the line: Finding → photo+region → AI (model+version) → rule (rule-set version) → named reviewer decision → report. Nothing can be quietly edited: **Activity Log** already shows LOGIN / AI_ANALYSIS_COMPLETED / REVIEW_CORRECT with before/after values.

### 60–90s · Admin strength (pick 1–2)

- **Rules Library** — each rule translated to one sentence; open one → publish workflow buttons (draft → tested → approved → published) with “past inspections keep their version” explanation.
- **Settings → AI model connection** — shows active provider/model + *Test connection*; say: “their model plugs in with three env variables — contract in MODEL_INTEGRATION.md; responses are normalized so the UI can’t crash; long runs poll `/results`.”
- **Trends & Risk** — repeat-offender table with plain “what to do” column; **Online Listings** — ₹99 listing vs ₹89 pack mismatch example.

## Points judges care about

1. **No fake buttons** — uploads, searches, review decisions, user create/disable, rule create/publish, report download all hit the real backend.
2. **Human decides** — enforced by permissions, not by vibes.
3. **Rules are data** — versioned JSON DSL, safe evaluator, no regulation in components.
4. **New-user test**: hand the keyboard to someone who’s never seen it; they complete a scan guided only by on-screen wording.
5. **Secure & honest** — real JWT sessions (httpOnly cookie), bcrypt, zod, immutable audit trail, “demo data / AI-assisted, not legal authority” disclaimers where needed.

## Troubleshooting

- Mongo down → automatic in-memory (2s fail-fast, never blocks requests).
- Image odd → placeholder SVG at `/api/placeholder/image?text=…`.
- Model service down (real mode + demo flag) → one retry, then mock fallback; inspection stays re-runnable.
