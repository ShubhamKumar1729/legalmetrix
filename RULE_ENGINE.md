# Rule Engine

Rules are configuration, not code. Compliance logic lives in the database and is
managed from **Rules** in the application; changing a rule never requires a deploy.

## What is evaluated

`RuleEngine.getActiveRules()` selects rules that are `enabled` **and** `PUBLISHED`.
When several versions of the same `ruleCode` are published, the highest version wins.

If no rule qualifies, the engine returns zero findings and the note
*"No regulatory rules are configured yet, so compliance could not be evaluated."*
The inspection is marked `scored: false` and the result page says so. There is no
built-in fallback rule set.

## Rule shape

```jsonc
{
  "ruleCode": "LM-PC-2011-6(1)(e)",
  "title": "MRP declaration",
  "description": "Retail sale price declared inclusive of all taxes",
  "legalReference": "Rule 6(1)(e)",
  "category": "MRP",
  "applicableProductCategories": ["ALL"],
  "requirementType": "MANDATORY",
  "severity": "CRITICAL",
  "validationLogic": { "field": "mrp", "operator": "exists" },
  "reviewRequired": false,
  "version": "1.0",
  "status": "PUBLISHED"
}
```

`applicableProductCategories` may list specific categories (`FOOD`, `COSMETICS`, …)
or `ALL`. Rules that do not apply to the inspected category are skipped.

## Validation DSL

A condition is either a field test or a logical combination:

```jsonc
{ "field": "mrp", "operator": "exists" }
{ "field": "net_quantity_value", "operator": "gte", "value": 1 }
{ "field": "mrp", "operator": "regex", "value": "MRP\\s*[₹Rs]" }
{ "logic": "AND", "conditions": [ … ] }
{ "logic": "OR",  "conditions": [ … ] }
{ "logic": "NOT", "conditions": [ … ] }
```

Operators: `exists`, `not_exists`, `equals`, `not_equals`, `contains`, `regex`, `gt`,
`lt`, `gte`, `lte`, `in`, `not_in`.

The evaluator (`src/lib/rules/evaluator.ts`) walks this structure directly — it never
compiles or executes a string, so a rule cannot run arbitrary code, and every
evaluation produces a human-readable `reason` that is stored on the finding.

## Evaluation context

Built from the product metadata plus every field the analysis provider extracted:

| Key                        | Source                                        |
| -------------------------- | --------------------------------------------- |
| `product_name`, `brand`, `category`, `manufacturer` | inspection record       |
| `<field>`                  | extracted value                               |
| `<field>_normalized`       | normalized value                              |
| `<field>_value`            | numeric form of the normalized value          |
| `<field>_confidence`       | extraction confidence                         |

## Decision logic

For each applicable rule, the engine evaluates the condition and looks up the
extracted field named by `validationLogic.field` (or matching `ruleCode`).

**Confidence is zero when nothing was extracted.** That is what routes findings to
human review when no vision model is connected, instead of asserting violations the
system cannot actually see.

| Condition | Confidence | Requirement | Result |
| --------- | ---------- | ----------- | ------ |
| passes    | ≥ medium (75) | any | `PASS`, auto-confirmed |
| passes    | < medium   | any         | `REVIEW`, pending |
| fails     | ≥ high (90) | mandatory   | `VIOLATION` |
| fails     | ≥ medium   | mandatory, `reviewRequired` false | `VIOLATION` |
| fails     | ≥ medium   | mandatory, `reviewRequired` true  | `REVIEW`, pending |
| fails     | < medium   | mandatory   | `REVIEW`, pending |
| fails     | any        | recommended | `WARNING` |
| fails     | any        | conditional | `REVIEW`, pending |

Thresholds come from `CONFIDENCE_THRESHOLD_HIGH` and `CONFIDENCE_THRESHOLD_MEDIUM`.

## Scoring

`calculateComplianceScore()` weights each finding by severity
(CRITICAL 25, HIGH 15, MEDIUM 8, LOW 3, WARNING 1) and deducts:

- full weight for a `VIOLATION` (scaled slightly by confidence)
- half weight for `REVIEW`
- a quarter weight for `WARNING`

It returns `null` when there is nothing to score, so the UI can show *Not scored*
rather than a misleading 100.

`computeOutcome()` turns findings into the inspection status:

- any violation → `NON_COMPLIANT`
- otherwise any finding in review, or any finding still `PENDING` → `REVIEW_REQUIRED`
- otherwise `COMPLIANT` (or `REVIEW_REQUIRED` if the score falls below 80)

The same function is re-run after every human review decision, so the score and
status always match the findings that actually exist.

## Versioning

*Create Version* clones a rule as a new draft with the next version number. The
published version keeps applying until the new one is published, so rule changes are
traceable and reversible. Every create, update, publish and version action is written
to the audit log with the old and new values.

## Permissions

| Action                       | Permission      |
| ---------------------------- | --------------- |
| Read rules                   | `rule:read`     |
| Create / edit / new version  | `rule:write`    |
| Publish                      | `rule:publish`  |

`SUPER_ADMIN` and `REGULATORY_ADMIN` hold all three; other roles are read-only.
