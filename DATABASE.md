# Database

Two interchangeable stores, one access layer.

- **MongoDB** when `MONGODB_URI` is set and reachable — persistent, for real use.
- **In-memory** otherwise — so the application runs in a sandbox. Data is lost on
  restart, and the Admin page shows which store is active.

Both start empty. **Nothing is seeded.** There is no seed script, no fixture file and
no startup routine that inserts business records. The only record the application
ever creates by itself is the optional bootstrap administrator, and only when the
user collection is empty and `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
are set.

## Collections

### `users`
| Field          | Type   | Notes                              |
| -------------- | ------ | ---------------------------------- |
| `email`        | string | unique, lowercased                 |
| `name`         | string |                                    |
| `officialId`   | string | optional                           |
| `role`         | string | one of the six backend roles       |
| `department`   | string | optional                           |
| `passwordHash` | string | bcrypt (cost 10); never returned by the API |
| `active`       | bool   | disabled accounts cannot sign in   |
| `lastLogin`    | date   |                                    |

### `inspections`
The core record. Embedded arrays keep an inspection self-contained.

- Identity: `inspectionNumber` (`LM-<year>-<6 digits>`, unique), `productId`,
  `productName`, `brand`, `category`, `manufacturer`, `barcode`, `batchNumber`
- Ownership: `inspectorId`, `inspectorName`
- Lifecycle: `status` (`DRAFT` → `PROCESSING` → `COMPLIANT` / `NON_COMPLIANT` /
  `REVIEW_REQUIRED`), `startedAt`, `completedAt`, `reviewStatus`
- Evidence: `images[]` — `id`, `side`, `url`, `source` (`CAMERA` | `UPLOAD`),
  `originalName`, `size`, `mimeType`, `width`, `height`,
  `quality { resolution, brightness?, blurScore?, readability? }`
- Analysis: `aiRunId`, `aiProvider`, `aiModelVersion`, `processingTimeMs`,
  `ruleSetVersion`, `rulesEvaluated`, `complianceScore`, `scored`,
  `confidenceSummary`, `extractedFields[]`, `analysisNotes[]`
- Outcome: `findings[]` — `id`, `title`, `description`, `detectedValue`,
  `expectedValue`, `status`, `severity`, `confidence`, `ruleId`, `ruleCode`,
  `legalReference`, `evidence[]`, `reviewStatus`, `correctedValue`, `reviewerId`,
  `reviewerName`, `reviewerComment`, `reviewedAt`
- `reportId`

`scored` is `false` when no rule could be evaluated, so the UI can show *Not scored*
instead of implying a result.

### `products`
Created automatically the first time a product name is inspected. Inspection counts,
violation counts and risk scores are computed from stored inspections at read time,
never stored as static numbers.

### `reports`
One per generated report: `reportNumber` (`RPT-<inspection number>`), `inspectionId`,
summary, outcome, score, `generatedBy`, `generatedByName`. The report body is read
live from the inspection, so a report always reflects the stored record.

### `regulatoryrules`
Rule code, title, description, legal reference, category, applicable product
categories, requirement type, `validationLogic` (JSON condition), severity, `enabled`,
effective dates, `version`, `evidenceRequired`, `reviewRequired`, `status`. Several
versions of a rule code can coexist; the engine evaluates the newest published one.

### `auditlogs`
`timestamp`, `userId`, `userName`, `role`, `action`, `resource`, `resourceId`,
`oldValue`, `newValue`, `ip`, `comment`. Append-only from the application's point of
view — no route updates or deletes audit entries.

### `ecommercelistings`
Only written when a configured provider returns real listing data.

## Accessing the data

Always through `src/lib/db/repository.ts`:

```ts
import { db } from '@/lib/db/repository';

const inspections = await db.inspections.list({ status: 'NON_COMPLIANT' }, { sortDescBy: 'createdAt' });
const inspection  = await db.inspections.get(id);
const created     = await db.inspections.create(payload);
const updated     = await db.inspections.update(id, { status: 'COMPLIANT' });
const count       = await db.inspections.count({});
```

Mongo document `_id` values are mapped to `id` strings by the repository, so callers
never depend on the store in use.

## Resetting

Drop the collections (MongoDB) or restart the process (in-memory). The application
comes back with zero records and shows its empty states.
