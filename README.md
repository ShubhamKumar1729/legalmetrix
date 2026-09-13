# LegalMetrix — Packaged Commodity Compliance

Inspection, rule validation and reporting platform for the **Legal Metrology
(Packaged Commodities) Rules, 2011**.

An officer captures package images, the system checks every configured mandatory
declaration, uncertain findings go to human review, and a report is generated from
the stored record.

```
Login → Dashboard → New Inspection → Capture / Upload → Analyze → Result → Review → Report → History
```

The application starts **empty**. There is no seeded business data, no demo mode and
no built-in user account. Every product, inspection, finding and report in the system
was created by a real user action.

---

## 1. Installation

Requirements: Node.js 18.18+ (20 or 22 recommended).

```bash
npm install
cp .env.example .env     # then edit .env
npm run dev              # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Scripts:

| Command         | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Development server on `0.0.0.0:3000`               |
| `npm run build` | Production build (also type-checks every route)    |
| `npm start`     | Serve the production build                         |
| `npm run lint`  | ESLint                                             |
| `npm test`      | Unit tests for the rule engine, scoring and image validation |

End-to-end acceptance test (requires a running server started from a clean database):

```bash
BASE_URL=http://localhost:3100 node tests/e2e.mjs
```

---

## 2. Environment variables

See `.env.example` for the full annotated list. The important ones:

| Variable                    | Required | Purpose                                                        |
| --------------------------- | -------- | -------------------------------------------------------------- |
| `MONGODB_URI`               | no       | Persistent storage. Empty ⇒ in-memory store (data lost on restart) |
| `AUTH_SECRET`               | prod     | JWT signing key, minimum 32 characters                          |
| `BOOTSTRAP_ADMIN_EMAIL`     | no       | Email for the first administrator (see §4)                      |
| `BOOTSTRAP_ADMIN_PASSWORD`  | no       | Password for the first administrator                            |
| `AI_PROVIDER`               | no       | `development` (default) or `http`                               |
| `AI_SERVICE_URL`            | no       | Vision model endpoint when `AI_PROVIDER=http`                   |
| `STORAGE_PATH`              | no       | Where evidence images are written (default `./uploads`)         |
| `CONFIDENCE_THRESHOLD_HIGH` | no       | Confident automated decision threshold (default 90)             |
| `CONFIDENCE_THRESHOLD_MEDIUM` | no     | Below this, a finding goes to human review (default 75)         |

`.env` and every `.env.local` variant are gitignored. `.env.example` contains
placeholders only — no real credentials.

---

## 3. MongoDB setup

The data layer (`src/lib/db/repository.ts`) uses MongoDB when a connection is
available and an in-memory store otherwise; both start empty.

```bash
# Local Docker
docker run -d -p 27017:27017 --name legalmetrix-mongo mongo:7

# .env
MONGODB_URI=mongodb://localhost:27017/legalmetrix
```

Collections (created on first write, never pre-populated):

| Collection         | Contents                                            |
| ------------------ | --------------------------------------------------- |
| `users`            | Accounts and bcrypt password hashes                 |
| `inspections`      | Inspection record, images, findings, extracted fields |
| `products`         | Created automatically on the first inspection of a product |
| `reports`          | Generated compliance reports                        |
| `regulatoryrules`  | Configurable rule definitions and versions          |
| `auditlogs`        | Immutable record of every significant action        |
| `ecommercelistings`| Listings actually analyzed                          |

Run without MongoDB and the server logs:
`[db] MONGODB_URI not set — using in-memory store (data is not persisted)`.
The Admin page shows which store is active.

---

## 4. Authentication setup

**There are no built-in accounts and no hard-coded credentials anywhere in the
codebase.** Create the first administrator in one of two ways.

**Option A — bootstrap from the environment.** Set `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD`, then start the application. The account is created only
if the user collection is empty, and it is never re-created afterwards.

```bash
BOOTSTRAP_ADMIN_EMAIL=first.admin@legalmetrix.example \
BOOTSTRAP_ADMIN_PASSWORD='a-long-unique-password' \
npm run dev
```

**Option B — from an existing account.** Sign in as an administrator and use
**Admin → Users → New User**.

Sessions use an httpOnly `legalmetrix_session` cookie holding a signed JWT
(`AUTH_SECRET`). Every API route checks the session and the caller's permissions
before reading or writing; unauthenticated requests get `401`, and authenticated
callers without the required permission get `403`.

Three roles are surfaced in the interface:

| Role          | Can do                                                        |
| ------------- | ------------------------------------------------------------- |
| **Inspector** | Create inspections, capture images, generate reports          |
| **Reviewer**  | Confirm, reject or correct flagged findings                   |
| **Admin**     | Manage rules, users and system configuration                  |

Six backend roles (`SUPER_ADMIN`, `REGULATORY_ADMIN`, `ENFORCEMENT_OFFICER`,
`REVIEWER`, `ANALYST`, `AUDITOR`) map onto those three; the full permission matrix
lives in `src/lib/auth/rbac.ts`.

---

## 5. Running the application

1. Sign in at `/login`.
2. **Dashboard** shows real totals (all zero on a clean database) and the primary
   action, *Start New Inspection*.
3. **Rules** — publish at least one rule first. Until then inspections cannot be
   scored, and the result page says so.
4. **New Inspection** walks through Product → Images → Analysis → Result → Report.
5. **Review** lists findings awaiting a human decision.
6. **Reports** lists reports that were actually generated; each can be printed or
   downloaded as a PDF.

---

## 6. Camera permissions

Image capture uses `navigator.mediaDevices.getUserMedia()`.

- **Secure context required.** Browsers only expose the camera API over HTTPS or
  `localhost`. Deploy behind TLS for field use; otherwise the component reports
  *"Camera access requires a secure (HTTPS) connection."*
- **Permission prompt.** On first use the browser asks for camera access. If the
  officer declines, the UI shows *"Camera access was denied"* with an
  *Upload Image Instead* action.
- **No camera.** If the device has no video input, the UI shows *"Camera is not
  available on this device"* with an *Upload Image* action.
- **Camera in use.** If another application holds the device, the UI offers
  *Try again* and *Upload instead*.
- **Switch camera** appears only when more than one video input is present.
- **Flash** appears only when the track reports `torch` capability.

Captured frames are read from the `<video>` element into a canvas and encoded as
JPEG, exactly like an uploaded file, so both paths produce the same normalized
image record.

---

## 7. AI model integration

The pipeline is provider-based, so connecting the real model requires no change to
the camera, upload, storage, inspection or reporting code.

```
Camera or Upload
   → client-side quality measurement (real pixels)
   → POST /api/images  (server validates type, size, dimensions, integrity)
   → stored evidence + normalized image record
   → POST /api/inspections        (image ids attached)
   → POST /api/inspections/:id/analyze
        → AIModelProvider.analyze(AIAnalyzeRequest)
        → extractedFields
        → RuleEngine.evaluate(extractedFields, rules)
        → findings, score, status
```

**Default (`AI_PROVIDER=development`).** `MockAIProvider` accepts the real request
and returns the real response shape but reads nothing from the package. It returns
zero extracted fields and says so in `warnings`. The rule engine therefore marks
every configured rule as **needs review** rather than inventing values.

**Real model (`AI_PROVIDER=http`).** Implement the contract in
`src/lib/ai/types.ts` behind an HTTP endpoint:

```
POST $AI_SERVICE_URL
Authorization: Bearer $AI_SERVICE_KEY
{ inspectionId, imageIds, imageUrls, productMetadata, ruleSetVersion, options }
→ AIAnalyzeResponse { extractedFields, findings, confidence, evidenceRegions, warnings, modelMetadata }
```

Then set:

```bash
AI_PROVIDER=http
AI_SERVICE_URL=https://your-model-host/analyze
AI_SERVICE_KEY=...
AI_MODEL_VERSION=your-model-1.0.0
```

Confident findings from the model (≥ `CONFIDENCE_THRESHOLD_MEDIUM`) are merged over
the rule engine's decision; less confident ones leave the finding in human review.
See `MODEL_INTEGRATION.md` for the field-level contract.

---

## 8. Rule configuration

Rules are data, not code. **Admin → Rules** manages them; `rule:write` is needed to
author and `rule:publish` to publish.

Each rule has: rule code, title, what the package must show, legal reference,
category, applicable product categories, severity, requirement type, a validation
condition, and a version.

The validation condition is a safe JSON DSL (no arbitrary code):

```json
{ "field": "mrp", "operator": "exists" }
{ "field": "net_quantity_value", "operator": "gte", "value": 1 }
{ "logic": "AND", "conditions": [ … ] }
```

Operators: `exists`, `not_exists`, `equals`, `not_equals`, `contains`, `regex`,
`gt`, `lt`, `gte`, `lte`, `in`, `not_in`.

Only **published and enabled** rules are evaluated. *Create Version* clones a rule
as a new draft; the published version keeps applying until the new one is published.
With no published rules, an inspection reports *"No regulatory rules are configured
yet, so compliance could not be evaluated."* See `RULE_ENGINE.md`.

---

## 9. Production deployment

1. Set `MONGODB_URI` to a real, reachable instance.
2. Set `AUTH_SECRET` to a unique value of at least 32 characters. The server refuses
   to fall back to a development secret in production.
3. Configure `AI_PROVIDER` / `AI_SERVICE_URL` for automated analysis.
4. Serve over HTTPS — required for camera access and for the secure session cookie.
5. Point `STORAGE_PATH` at durable storage, or add an object-storage
   `StorageProvider` (`src/lib/storage/local-storage.ts` shows the interface).
6. Create the first administrator with the bootstrap variables, then remove them
   from the environment once the account exists.
7. Review the audit log periodically (**Admin → Audit log**).

`next.config.mjs` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
and a strict referrer policy on every response.

---

## 10. Sessions and the iframe trap

The session cookie is `legalmetrix_session` — httpOnly, `Path=/`, seven days.

`Secure` follows the protocol the request actually arrived on (`x-forwarded-proto`),
not `NODE_ENV`. Behind a TLS-terminating proxy the app still sees `http` and still runs
in development, and a `Secure` flag keyed off `NODE_ENV` would be missing exactly there.

`SameSite` defaults to `lax`. **If the app is embedded in an iframe on a different
domain, a `lax` cookie is not sent back** — the sign-in succeeds, the browser drops the
cookie, and the next request bounces you to `/login` with no error shown. Set
`SESSION_COOKIE_SAME_SITE=none` in that case; it forces `Secure`, so the site must be
served over HTTPS.

`SameSite=None; Secure` on its own is still not sufficient inside an iframe. To the
browser that is a *third-party* cookie, and third-party cookies are blocked by default
(Safari ITP, Firefox ETP, Chrome's third-party cookie deprecation) regardless of the
`Secure` flag. The cookie is stored, silently omitted from the next request, and sign-in
looks broken with no error anywhere. `SESSION_COOKIE_SAME_SITE=none` therefore also sets
the `Partitioned` (CHIPS) attribute, which keys the cookie to the embedding top-level
site — not shared across sites, so browsers allow it. A normal same-site deployment gets
`lax` and no `Partitioned`, since browsers only honour it alongside `SameSite=None`.

`tests/session-cookie.test.ts` covers both branches.


---

## 11. Compliance assistant

**Compliance AI** is a navigation entry of its own: pick a stored inspection, then ask
about it. The same panel also sits on every inspection result page, already bound to
that inspection. **There is no language model
behind it** — it is a deterministic lookup over records already in the database, so it
cannot invent a fact.

- With no inspection selected it asks *"Which inspection would you like me to look
  at?"* instead of answering about something it was not given.
- Every answer names the records it was built from (`groundedIn`).
- A question the stored record cannot answer is refused with `answered: false`, and
  the panel says so rather than dressing up a guess.

The logic lives in `src/lib/assistant/assistant.ts`; `POST /api/assistant` is the only
entry point. To attach a real assistant model later, replace `answerQuestion` — the
route, the context object and the panel do not change.

---

## 12. Tests

Fourteen suites run offline — no real camera, no real vision model, no database.
Two need a build: `test:api` runs against a server you start from an empty database,
and `test:realmodel` boots its own server and a stub vision model to prove the
`AI_PROVIDER=http` path end to end.

| Command             | What it runs                                                                    | Scope                                    |
| ------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm test`          | Rule engine, scoring, image inspection, RBAC, numbering                         | Pure library logic                       |
| `npm run test:camera` | The real `CameraCapture` component in a DOM                                   | Permission, preview, capture, retake, use photo, every failure state, stream cleanup |
| `npm run test:imagemanager` | The real `ImageManager` component in a DOM                              | Multiple images on one inspection, camera/upload parity, reorder, remove, cap, rejections |
| `npm run test:ui`   | The real page components against an empty API                                   | Zero KPIs, empty states, navigation, no demo UI |
| `npm run test:wizard` | The five-step inspection wizard, capturing through the real camera component | Validation, step progression, review routing, failure recovery |
| `npm run test:cookie`   | Session cookie attributes                                                  | SameSite/Secure across proxy and iframe cases |
| `npm run test:aimodel` | The real vision-model path against a stub model server                     | Endpoint, bearer auth, response parsing, error surfacing, confidence merge |
| `npm run test:assistant` | The assistant's answering logic                                            | Answers only from stored records; refuses what it cannot know |
| `npm run test:assistant:panel` | The assistant UI panel                                               | Sends real questions, shows refusals, keeps the thread |
| `npm run test:assistant:page` | The Compliance AI page                                                 | Inspection picker binds the panel; no stale thread |
| `npm run test:inspection` | The inspection result page                                                  | Assistant panel is mounted; no invented score |
| `npm run test:users`  | The account-creation role picker                                             | Three product roles; extras behind a toggle |
| `npm run test:mobile` | The mobile navigation drawer                                                 | Opens, offers the same entries, dismisses |
| `npm run test:report` | The report page and its PDF export                                            | Report rendering, audit trail, PDF bytes |
| `npm run test:api`  | Every API route against a running server                                        | Full inspection lifecycle                |
| `npm run test:realmodel` | A real inspection through `AI_PROVIDER=http`                              | Boots its own server and stub vision model; asserts what gets stored |

```bash
npm run test:all          # the 14 offline suites; excludes test:api and test:realmodel
```

`next dev` and `next start` cannot share a build directory — they overwrite each
other's chunks and both then fail with `MODULE_NOT_FOUND`. When running the preview and
the acceptance server side by side, give the second one its own output:

```bash
NEXT_DIST_DIR=.next-e2e npm run build
NEXT_DIST_DIR=.next-e2e npx next start -p 3100
```

`test:api` asserts against an **empty database** and exits with a clear message if the
server has already served traffic:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@example.test \
BOOTSTRAP_ADMIN_PASSWORD='a-long-unique-password' \
AUTH_SECRET='at-least-32-characters-of-random-text' \
  npx next start -p 3100

BASE_URL=http://localhost:3100 npm run test:api
```

`test:realmodel` needs the same build but starts and stops its own server, so it
takes no arguments — it boots the app with `AI_PROVIDER=http` pointed at a stub
vision model on a local port, then shuts both down:

```bash
NEXT_DIST_DIR=.next-e2e npm run build
npm run test:realmodel
```

It refuses to start if that build is missing, or if its port (3200 by default,
override with `REAL_MODEL_APP_PORT`) is already serving.

Two honest limits. The camera suite stubs `navigator.mediaDevices`, so it proves the
component's own logic — it cannot substitute for pointing a real device at a real
package. The report suite captures the document at jsPDF's `save()` boundary and
asserts on the real PDF bytes; jsdom has no download plumbing, so the browser's
file-save step itself is not exercised.

---

## Repository layout

```
src/
  app/
    login/                      Sign-in screen
    app/                        Authenticated workspace
      dashboard/                Totals, recent inspections, compliance overview
      inspections/              List · new (5-step wizard) · [id] result + review
      review/                   Findings awaiting a human decision
      products/                 Auto-created products · [id] history
      reports/                  Generated reports · [id] view / print / PDF
      rules/                    Rule management · [id] edit / publish / version
      ecommerce/                Listing comparison (provider required)
      admin/                    Users · audit log · system status
      profile/                  Account and permissions
    api/                        Route handlers (all session- and permission-checked)
  components/
    camera/                     getUserMedia capture with permission and fallback states
    inspection/                 Image manager (camera + upload, same normalized output)
    layout/                     Shell, sidebar, top navigation
    ui/                         Buttons, cards, badges, inputs, empty states
  lib/
    ai/                         Provider interface, registry, development + HTTP providers
    auth/                       Passwords, JWT sessions, RBAC
    db/                         Mongoose models, connection, repository, bootstrap
    ecommerce/                  Listing provider interface and comparison
    images/                     Server-side image validation
    rules/                      Evaluator, engine, scoring, validation schema
    storage/                    Evidence storage provider
    audit/                      Audit trail
    config/ system/ labels/     Runtime config, system status, UI labels
tests/
  critical.test.ts              Rule engine, scoring, image, RBAC (npm test)
  camera.component.test.tsx     CameraCapture in a DOM (npm run test:camera)
  imagemanager.component.test.tsx  Multiple images + camera/upload parity (npm run test:imagemanager)
  ui.empty.test.tsx             Pages + navigation on an empty API (npm run test:ui)
  session-cookie.test.ts        Session cookie flags (npm run test:cookie)
  ai-http-provider.test.ts      Real model path (npm run test:aimodel)
  assistant.test.ts             Assistant answering logic (npm run test:assistant)
  assistant.panel.test.tsx      Assistant panel UI (npm run test:assistant:panel)
  assistant.page.test.tsx       Compliance AI page (npm run test:assistant:page)
  inspection.page.test.tsx      Result page mounts the panel (npm run test:inspection)
  users.roles.test.tsx          Three-role picker on Admin (npm run test:users)
  mobile.nav.test.tsx           Mobile navigation drawer (npm run test:mobile)
  wizard.test.tsx               Five-step wizard driven end to end (npm run test:wizard)
  report.test.tsx               Report page + PDF export (npm run test:report)
  e2e.mjs                       Full lifecycle against a running server (npm run test:api)
  e2e-real-model.mjs            Real model path end to end (npm run test:realmodel)
  helpers/png.mjs               Builds a real PNG for upload tests
```

Supporting documents: `ARCHITECTURE.md`, `DATABASE.md`, `API.md`,
`RULE_ENGINE.md`, `MODEL_INTEGRATION.md`, `SECURITY.md`.
