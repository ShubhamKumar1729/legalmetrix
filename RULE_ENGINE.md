# Rule Engine — LegalMetrix

## Philosophy

**No hardcoded regulatory logic in UI.** All rules stored in DB, evaluated server-side via safe DSL.

Bad:
```tsx
if (mrpMissing) showViolation() // ❌ Hardcoded in component
```

Good:
```
AI output → normalized finding → Rule Engine → Decision → UI renders decision
```

---

## Rule Schema

```typescript
{
  id: string;
  ruleCode: string;              // e.g., "LM-PC-2011-6(1)(e)" unique, indexed
  title: string;                 // "MRP Declaration"
  description: string;           // Human readable requirement
  legalReference: string;        // "Rule 6(1)(e)"
  category: string;              // MANUFACTURER_INFO, PRODUCT_IDENTITY, NET_QUANTITY, MRP, CONSUMER_CARE, READABILITY, DATE_DECLARATION, UNIT_PRICE, etc.
  applicableProductCategories: string[]; // ["ALL"] or ["FOOD","GROCERY"]
  requirementType: 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED';
  validationLogic: RuleCondition; // JSON DSL
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING';
  enabled: boolean;
  effectiveFrom: string;         // ISO date
  effectiveTo?: string;
  version: string;               // "1.2"
  evidenceRequired: boolean;
  reviewRequired: boolean;       // If true, low confidence → REVIEW not VIOLATION
  status: 'DRAFT' | 'VALIDATION' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  createdBy, updatedBy, createdAt, updatedAt, approvedBy, approvedAt, publishedBy, publishedAt
}
```

---

## Validation Logic DSL

Safe, no arbitrary JS. Evaluated by `evaluateCondition()` in `src/lib/rules/evaluator.ts`.

### Structure

```typescript
interface RuleCondition {
  field?: string;                // e.g., "mrp", "net_quantity", "manufacturer_address", "category"
  operator?: 'exists' | 'not_exists' | 'equals' | 'not_equals' | 'contains' | 'regex' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value?: any;
  logic?: 'AND' | 'OR' | 'NOT';
  conditions?: RuleCondition[];  // For logic operators
}
```

### Operators

- `exists`: field present and non-empty
- `not_exists`: field missing
- `equals`: == (loose)
- `not_equals`: !=
- `contains`: substring (case-insensitive) or array includes
- `regex`: RegExp test
- `gt`, `gte`, `lt`, `lte`: numeric comparison
- `in`: value in array
- `not_in`: value not in array

### Logical

- `AND`: all conditions must pass
- `OR`: at least one passes
- `NOT`: negates first condition

### Examples

**MRP must exist:**
```json
{ "field": "mrp", "operator": "exists" }
```

**Net quantity >= 1000g requires unit price (conditional):**
```json
{
  "logic": "AND",
  "conditions": [
    { "field": "category", "operator": "in", "value": ["FOOD", "GROCERY"] },
    { "field": "net_quantity_value", "operator": "gte", "value": 1000 }
  ]
}
```

**Manufacturer address must contain PIN (regex):**
```json
{ "field": "manufacturer_address", "operator": "regex", "value": "\\d{6}" }
```

---

## Evaluation Flow

1. **Build Context** from extractedFields + productMetadata:
   ```typescript
   {
     category: "FOOD",
     product_name: "FreshBite Biscuits",
     mrp: "₹99",
     mrp_confidence: 98,
     mrp_exists: true,
     net_quantity: "500 g",
     net_quantity_normalized: "500",
     net_quantity_value: 500,
     ...
   }
   ```

2. **Get Active Rules**: `enabled=true && status=PUBLISHED`, filter by `applicableProductCategories` includes ALL or product category, optionally by `ruleSetVersion`

3. **Evaluate Each Rule** via `evaluateCondition()`

4. **Confidence-Aware Decision**:
   - High confidence (>=90) + rule satisfied → PASS
   - High confidence + rule violated → VIOLATION
   - Medium confidence (75-89) + rule violated + reviewRequired → REVIEW (else VIOLATION)
   - Low confidence (<75) → REVIEW
   - Thresholds configurable via env / SystemConfig

5. **Findings**: Create Finding per rule (or per violation), with severity, confidence, evidence, ruleCode, legalReference, reviewStatus

6. **Compliance Score**: `100 - (deductions / totalWeight * 100)`, deductions weighted by severity and confidence impact

---

## Versioning & Publishing

### Workflow

```
DRAFT
  ↓ (validation)
VALIDATION
  ↓ (ready)
READY_FOR_APPROVAL
  ↓ (regulatory admin approves)
APPROVED
  ↓ (publish)
PUBLISHED (active, used for new inspections)
  ↓ (archived when superseded)
ARCHIVED (historical, still referenced by old reports)
```

### Guarantees

- Never overwrite historical rules
- Each inspection stores `ruleSetVersion` used (e.g., "LM-PC-2011-v1.2")
- Historical reports remain reproducible
- Draft can be cloned, edited, compared
- Only REGULATORY_ADMIN / SUPER_ADMIN can publish
- Publishing requires explicit confirmation dialog

### Implementation

- Memory: `memoryDB.rules` with `status` field
- MongoDB: `RegulatoryRuleModel` with `status` enum, `version`, `effectiveFrom/To`
- API: `POST /api/rules` (create DRAFT), `PATCH /api/rules/[id]` (edit), `POST /api/rules/[id]/versions` (new version), `POST /api/rule-versions/[id]/publish` (publish)

---

## Rule Management UI

- List: search by code/title, filter by category/severity/status
- Detail: view/edit, DSL preview ("IF: ... THEN: ..."), legal reference, effective dates
- Editor: form with validation, JSON DSL editor (with helper), severity, categories, reviewRequired toggle
- Preview: human-readable IF/THEN
- Validation: checks for valid DSL, no empty fields, before publishing
- Compare versions: diff view (future)

---

## Scoring Configuration

Stored in `SystemConfig` and `defaultScoringConfig`:

```typescript
{
  weights: { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, WARNING: 1 },
  thresholds: { compliant: 80, review: 50 },
  confidenceImpact: true
}
```

Not hardcoded in UI — passed to `calculateComplianceScore()`.

---

## Auditability

Any change affecting compliance decisions logged:

- Rule created/edited/published: oldValue, newValue, user, timestamp
- Scoring config changed
- Confidence threshold changed
- Stored in `auditLogs`

---

## Future Extensibility

- Additional operators: add to evaluator (safe, no eval)
- Additional regulatory frameworks: add category, legalReference
- Additional languages: DSL already language-agnostic (field names)
- Complex rules: nest AND/OR/NOT arbitrarily
- ML-based rules: could add `ml_model` field referencing AI output

---

## Testing

- Unit tests for evaluator: each operator, AND/OR/NOT, edge cases
- Integration: create rule, run inspection, verify finding status matches expected
- Publishing workflow test

See `src/lib/rules/evaluator.ts` for safe evaluation logic.
