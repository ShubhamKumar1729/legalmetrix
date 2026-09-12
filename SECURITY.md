# Security — LegalMetrix

## Authentication

- **Password Hashing:** bcryptjs with salt 10
- **Storage:** passwordHash never returned to client, never in logs
- **Demo Password:** `Gov@2026` for all demo users, hashed via bcrypt
- **JWT:** `jsonwebtoken` with `AUTH_SECRET` (min 32 chars), expiry 7d via `AUTH_EXPIRES_IN`
- **Token Verification:** signature + expiry checked on **every protected API request** (`src/lib/auth/session.ts`)
- **Session:** httpOnly, SameSite=Lax `lm_session` cookie set by the login route (secure flag in production) — plus optional `Authorization: Bearer` for API clients. localStorage only holds a copy for display; it is never trusted alone
- **Passwords:** demo seed users carry a real bcrypt hash; users created via the admin UI are verified against their own hash (no plaintext shortcut anymore)

## RBAC

### Roles

- `SUPER_ADMIN` — full access
- `REGULATORY_ADMIN` — rules, publishing, config, audit read
- `ENFORCEMENT_OFFICER` — create inspections, view own, submit, view reports, ecommerce
- `REVIEWER` — review findings, modify AI results, approve/reject
- `ANALYST` — view analytics, export
- `AUDITOR` — view audit logs, historical records, no modification

### Permission Matrix

Defined in `src/lib/auth/rbac.ts` as `rolePermissions: Record<Role, Permission[]>`

Permissions:
- inspection:create/read/update/delete
- review:read/write
- product:read/history
- rule:read/write/publish
- analytics:read
- report:read/write/download
- user:read/write
- audit:read
- config:read/write
- ecommerce:analyze

### Enforcement

- **Backend (source of truth):** every route handler calls `guardRequest(req, permission)` from `src/lib/auth/session.ts` — 401 without a session, 403 when the role lacks the permission. Covered: inspections (read/create/update/analyze/review decisions), products, analytics, reports, rules, users, audit logs, configuration, ecommerce analysis, search, evidence upload/serve
- **Frontend:** `canAccessRoute()` mapping + AppShell redirect exist only to avoid dead-end screens; hiding a button is never the security boundary (e.g. the review panel renders read-only with an explanation for roles lacking `review:write`)
- Verified in tests/manual QA: officer curl-ing a reviewer decision endpoint gets 403 even with a valid session

## Input Validation

- **Zod schemas** on login and user creation (`zod`); other endpoints validate required fields and return 400 with a human-readable message (all copy on screen is plain language)
- **File Validation:** mime type check (image/jpeg, png, webp), size limit (10MB), no executable; evidence served through an authenticated route with `path.basename` traversal guard
- **Barcode:** alphanumeric, max 50 chars
- **URL:** valid URL format for ecommerce
- **Rule DSL:** validated via `evaluateCondition` — only allowed operators, no eval, no Function constructor

## File Storage

- **Abstraction:** `StorageProvider` interface, local dev writes to `./uploads`, prod S3 with presigned URLs
- **No direct filesystem access** from frontend
- **Mock URLs** for demo reliability (`/api/placeholder/image`)
- **Size Limits:** 10MB per image, 10 images max per inspection

## Secure Headers

Via `next.config.mjs`:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY (production) | SAMEORIGIN (dev, so local previews/embeds work)
```

Future: Content-Security-Policy, Strict-Transport-Security, etc.

## Audit Logging

- **Immutable:** Logs never updated/deleted by normal admins
- **Logged Events:** login, logout, inspection creation/update, AI result generated, AI result corrected, finding reviewed, rule created/edited/published, config changed, report generated/downloaded, user role changed
- **Fields:** timestamp, userId, userName, role, action, resource, resourceId, oldValue, newValue, ip, comment
- **Storage:** memory + MongoDB, console log for debugging
- **Read-Only:** Audit log page shows all logs, no edit/delete buttons

## Evidence Integrity

- **Immutable from ordinary users:** Evidence images cannot be replaced without audit entry
- **Geo-tagged:** Optional latitude/longitude, accuracy, address, capturedAt
- **Bounding Boxes:** Stored with findings, linked to imageId
- **Versioning:** If evidence changed, new audit entry with old/new values

## Secrets Management

- **Env Vars:** All secrets via `.env`, never in source
- **.env.example:** Placeholders only, no real secrets
- **Frontend:** Only `NEXT_PUBLIC_` vars exposed, no secrets
- **.gitignore:** Should ignore `.env`, `uploads/`, `node_modules/`

## Rate Limiting (Future)

- Per IP: 100 req/min
- Per user: 50 req/min for inspections, 10 req/min for AI analyze
- Implement via middleware or reverse proxy (e.g., Upstash, Redis)

## XSS Protection

- React escapes by default
- No `dangerouslySetInnerHTML` except for SVG placeholder (safe)
- No inline event handlers from user input
- Content Security Policy planned

## CSRF Protection

- Cookie is SameSite=Lax (state-changing requests are POST/PATCH via fetch — not top-level navigations), JSON-only endpoints reject `multipart`/form posts, and all fetches are same-origin. For a stricter posture, move to SameSite=Strict or add double-submit tokens when real enforcement data is wired in

## Dependency Security

Current audit posture (Sep 2026):

- **Fixed by this repo:** `jspdf` removed entirely (unused — report export is plain text; its DOMPurify XSS/ReDoS chain left with it), `uuid` bumped (buffer bounds fix), `postcss` overridden to ≥8.5, `minimatch` (ReDoS) overridden, `next` on latest 14.2.x
- **Accepted, dev-only:** `@next/eslint-plugin-next` → `glob` CLI advisory — lint tooling only, not part of the runtime bundle, never invoked with untrusted patterns
- **Open, documented:** one `next` advisory (cache poisoning / image-optimization DoS) whose patch line is Next 15.x; this app does not use `next/image` optimization or shared response caches, and a major Next upgrade is deliberately out of scope here. Re-run `npm audit` when Next 15 is adopted
- `npm audit` should be re-checked per release

## Data Privacy

- **Location:** Optional, not required
- **PII:** Only official IDs, not personal data
- **Retention:** 365 days configurable, after that archive (not delete for audit)
- **Demo Data:** Clearly labeled synthetic, no real government records

## Legal Disclaimer

- AI outputs labeled "AI-assisted compliance assessment" not legal authority
- Final decisions attributable to authorized officials
- UI shows AI Assessment vs Human Review vs Final Decision separately

## Future Hardening

- 2FA for admins
- IP allowlisting for gov networks
- Device fingerprinting
- Session revocation
- Password complexity rules
- Account lockout after 5 failed attempts
- Encryption at rest for MongoDB
- TLS everywhere
- S3 bucket policy with least privilege

## Testing Security

- Auth: valid/invalid credentials, expired token, role escalation attempt
- RBAC: officer cannot publish rules, auditor cannot create inspections
- Input: SQL injection (not applicable MongoDB but NoSQL injection check), XSS payloads, file type bypass
- Audit: verify logs created for all critical actions
