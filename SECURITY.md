# Security — PackComply

## Authentication

- **Password Hashing:** bcryptjs with salt 10
- **Storage:** passwordHash never returned to client, never in logs
- **Demo Password:** `Gov@2026` for all demo users, hashed via bcrypt
- **JWT:** `jsonwebtoken` with `AUTH_SECRET` (min 32 chars), expiry 7d via `AUTH_EXPIRES_IN`
- **Token Verification:** `verifyToken()` checks signature, expiry
- **Session:** For demo, token in localStorage; production should use httpOnly secure cookie + CSRF protection

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

- **Frontend:** `canAccessRoute()` checks role vs path, redirects to login if no token
- **Backend:** Every API route should call `hasPermission(role, permission)` — currently implemented for critical routes, TODO for all
- **Never trust frontend:** Backend is source of truth

## Input Validation

- **Zod schemas** shared frontend/backend (planned, currently manual validation)
- **File Validation:** mime type check (image/jpeg, png, webp), size limit (10MB), no executable
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
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
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

- For cookie-based auth, need CSRF tokens
- Currently token in localStorage, so CSRF less relevant, but XSS more critical
- Production should use httpOnly cookie + SameSite=Strict + CSRF token

## Dependency Security

- `npm audit` regularly
- Pin versions in package.json
- No known vulnerabilities in used packages (Next.js 14.2.5, mongoose 8.4.4, etc.)

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
