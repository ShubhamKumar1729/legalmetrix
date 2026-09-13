# Security

## Credentials

**There are no built-in accounts and no hard-coded credentials anywhere in this
repository** — not in source, not in seed data (there is none), not in fixtures, not
in comments, not in documentation.

The first administrator is created in one of two ways:

1. `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` in the environment, applied
   only when the user collection is empty and never re-applied afterwards.
2. **Admin → Users** by an existing administrator.

`.env.example` ships with empty placeholders only. `.env` and its local variants are
gitignored. If you suspect a bootstrap password has leaked, rotate it via
`PATCH /api/users/:id` and remove the variables from the environment.

## Passwords and sessions

- Passwords are hashed with bcrypt (cost 10). Hashes are never returned by any API
  route (`publicUser()` strips them).
- Sessions are signed JWTs (HS256, `AUTH_SECRET`) held in an httpOnly
  `legalmetrix_session` cookie — not reachable from JavaScript, so a stored-XSS bug
  cannot steal the token.
- `AUTH_SECRET` is mandatory in production; the server throws rather than falling back
  to a development key.
- Minimum password length for accounts created in the UI is 8 characters. Set a
  stronger policy at the identity layer if your deployment has one.

## Authorisation

Every route handler starts with `requireUser()` or `requirePermission()`, which return
a ready-to-send `401` / `403` response:

```ts
const user = requirePermission('review:write');
if (isResponse(user)) return user;
```

There are no unauthenticated data routes. Evidence images (`GET /api/images/:id`)
require a session as well.

Six backend roles map to a permission matrix in `src/lib/auth/rbac.ts`; the interface
presents them as Inspector, Reviewer and Admin. Rule publishing is a separate
permission (`rule:publish`) from rule authoring (`rule:write`).

## Input validation

- Rule payloads are validated with Zod, including the recursive validation-logic
  schema. An invalid operator or missing field is rejected with `400`.
- The rule evaluator interprets a JSON condition structure. It never compiles or
  executes a string, so a rule cannot run arbitrary code. Regexes are constructed
  inside a `try` and a bad pattern fails the condition instead of throwing.
- Inspection updates are limited to an explicit allow-list of fields.
- Image ids supplied by a client are checked against storage before being attached to
  an inspection — a client cannot reference an arbitrary URL as evidence.

## Uploads

`inspectImage()` reads the real file bytes and rejects:

| Code                 | Condition                                    |
| -------------------- | -------------------------------------------- |
| `EMPTY_FILE`         | zero-length body                             |
| `FILE_TOO_LARGE`     | over 10 MB                                   |
| `UNSUPPORTED_FORMAT` | not a genuine JPEG, PNG or WEBP (magic bytes)|
| `UNREADABLE_IMAGE`   | headers cannot be parsed                     |
| `TRUNCATED_IMAGE`    | JPEG without `FFD9`, PNG without `IEND`      |
| `LOW_RESOLUTION`     | shortest side under 320 px                   |

The declared MIME type is not trusted: the format is detected from the bytes. Stored
files are named with a server-generated UUID and served through
`GET /api/images/:id`, which validates the id against `^[a-zA-Z0-9-]+$` before
touching the filesystem, so the parameter cannot traverse directories.

## Audit trail

Every sign-in, sign-out, inspection creation, analysis, review decision, rule change,
user change, report generation and configuration change is written to `auditlogs`
with actor, role, resource, old value and new value. No route updates or deletes
audit entries. Reviewers' corrections store both the AI value and the corrected value.

## Transport and headers

`next.config.mjs` applies to every response:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

The session cookie is `SameSite=Lax` and `Secure` in production. Camera access
requires a secure context, so field deployments must be served over HTTPS.

## Data handling

- Evidence images stay in `STORAGE_PATH`; nothing is sent to a third party.
- The analysis provider receives image ids, same-origin URLs and product metadata
  only. Point `AI_SERVICE_URL` at an endpoint inside your trust boundary.
- No analytics or telemetry code is present.

## Known limitations

- In-memory mode loses data on restart; it is a sandbox convenience, not a deployment
  option. Set `MONGODB_URI` for real use.
- Runtime configuration (`PATCH /api/configuration`) is held in memory for the life of
  the process. Persist it before running multiple instances.
- There is no rate limiting; put the application behind a gateway that provides it.
- Password policy beyond length is not enforced; integrate your identity provider for
  SSO-grade requirements.
