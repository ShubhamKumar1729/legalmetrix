/**
 * Plain-language labels for the whole app.
 *
 * The database and AI contract use official terms (NON_COMPLIANT, VIOLATION, …)
 * because reports and audits need exact wording. Every UI screen should show the
 * friendly label FIRST and the official term second, so a new officer can follow
 * the workflow without a glossary.
 */
import type { FindingStatus, RuleCondition, Severity } from '@/types';

export interface Friendly {
  label: string;   // what a person sees
  meaning: string; // one sentence of "why this matters"
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
}

const STATUS_FRIENDLY: Record<string, Friendly> = {
  DRAFT: { label: 'Started — not analyzed yet', meaning: 'This inspection is saved but the AI has not run on it yet.', tone: 'neutral' },
  PROCESSING: { label: 'AI is working on it', meaning: 'The model is reading the package photos right now.', tone: 'neutral' },
  COMPLIANT: { label: 'OK — all required details found', meaning: 'Every mandatory declaration was found and readable. No action needed.', tone: 'ok' },
  NON_COMPLIANT: { label: 'Problem — required detail missing or wrong', meaning: 'At least one mandatory declaration violates the rules. This may need enforcement action.', tone: 'bad' },
  REVIEW_REQUIRED: { label: 'Needs a human decision', meaning: 'The AI was not fully sure about one or more items, so an officer must confirm or correct them.', tone: 'warn' },
};

const FINDING_FRIENDLY: Record<FindingStatus, Friendly> = {
  PASS: { label: 'Looks fine', meaning: 'The required declaration is present and readable.', tone: 'ok' },
  VIOLATION: { label: 'Rule broken', meaning: 'A mandatory declaration is missing, unreadable, or does not match the rules.', tone: 'bad' },
  REVIEW: { label: 'Please check', meaning: 'The AI found this but is not fully confident — a human should verify.', tone: 'warn' },
  WARNING: { label: 'Soft issue', meaning: 'Not a hard violation, but worth noting in the report.', tone: 'warn' },
};

const SEVERITY_FRIENDLY: Record<Severity, Friendly> = {
  CRITICAL: { label: 'Critical', meaning: 'Breaks a mandatory rule — must be acted on.', tone: 'bad' },
  HIGH: { label: 'High', meaning: 'Serious issue that strongly affects compliance.', tone: 'bad' },
  MEDIUM: { label: 'Medium', meaning: 'Needs attention but not urgent.', tone: 'warn' },
  LOW: { label: 'Low', meaning: 'Minor issue; record it and move on.', tone: 'neutral' },
  WARNING: { label: 'Note', meaning: 'Just an observation for the file.', tone: 'neutral' },
};

export function friendlyStatus(status?: string): Friendly {
  return STATUS_FRIENDLY[status || ''] || { label: status || 'Unknown', meaning: '', tone: 'neutral' };
}

export function friendlyFinding(status?: FindingStatus): Friendly {
  return FINDING_FRIENDLY[status || 'PASS'] || FINDING_FRIENDLY.PASS;
}

export function friendlySeverity(severity?: Severity): Friendly {
  return SEVERITY_FRIENDLY[severity || 'LOW'] || SEVERITY_FRIENDLY.LOW;
}

/** Confidence as a plain sentence for non-technical users. */
export function friendlyConfidence(confidence: number): string {
  if (confidence >= 90) return `High certainty (${confidence}%)`;
  if (confidence >= 75) return `Medium certainty (${confidence}%) — quick check recommended`;
  return `Low certainty (${confidence}%) — a human must verify this`;
}

/**
 * Turn a stored rule DSL object into one readable sentence.
 * e.g. { field:'mrp', operator:'exists' } → "The package must show: mrp"
 */
const FIELD_PLAIN: Record<string, string> = {
  mrp: 'the MRP (maximum retail price)',
  net_quantity: 'the net quantity',
  net_quantity_value: 'the net quantity amount',
  manufacturer_address: 'the manufacturer\u2019s full address',
  product_name: 'the product name',
  customer_care: 'customer care contact details',
  manufacture_date: 'the month and year of manufacture',
  category: 'the product category',
  mrp_font_size: 'the MRP text size',
  unit_sale_price: 'the unit sale price',
  barcode: 'the barcode',
};

export function plainFieldName(field: string): string {
  return FIELD_PLAIN[field] || field.replace(/_/g, ' ');
}

export function describeLogic(condition?: RuleCondition): string {
  if (!condition) return 'No conditions set.';
  if (condition.logic && condition.conditions) {
    const parts = condition.conditions.map(describeLogic);
    if (condition.logic === 'AND') return `${parts.join(' AND ')}`;
    if (condition.logic === 'OR') return `${parts.join(' OR ')}`;
    if (condition.logic === 'NOT') return `NOT (${parts.join(', ')})`;
  }
  const f = plainFieldName(condition.field || '');
  switch (condition.operator) {
    case 'exists': return `The label must show ${f}`;
    case 'not_exists': return `The label must NOT show ${f}`;
    case 'equals': return `${f} must be “${condition.value}”`;
    case 'not_equals': return `${f} must not be “${condition.value}”`;
    case 'contains': return `${f} must contain “${condition.value}”`;
    case 'regex': return `${f} must match the pattern ${condition.value}`;
    case 'gt': return `${f} must be more than ${condition.value}`;
    case 'gte': return `${f} must be at least ${condition.value}`;
    case 'lt': return `${f} must be less than ${condition.value}`;
    case 'lte': return `${f} must be at most ${condition.value}`;
    case 'in': return `${f} must be one of: ${(Array.isArray(condition.value) ? condition.value : []).join(', ')}`;
    case 'not_in': return `${f} must not be one of: ${(Array.isArray(condition.value) ? condition.value : []).join(', ')}`;
    default: return 'Custom check';
  }
}

export const WORKFLOW_STEPS = [
  { n: 1, title: 'Scan the package', where: '/app/scan', plain: 'Photograph the label and start an inspection. The AI reads the photos.' },
  { n: 2, title: 'Check the AI\u2019s findings', where: '/app/scan', plain: 'See what the AI detected on the label — accept, correct, or reject each item.' },
  { n: 3, title: 'Decide in the review queue', where: '/app/review', plain: 'Anything the AI was unsure about waits here for a human decision.' },
  { n: 4, title: 'Generate the report', where: '/app/reports', plain: 'Export an evidence-backed compliance report with the full audit trail.' },
];

export const GLOSSARY: { term: string; plain: string }[] = [
  { term: 'MRP', plain: 'Maximum Retail Price — the maximum price a shop can charge. The number printed on the pack must be visible and match online listings.' },
  { term: 'Net quantity', plain: 'How much product is inside (weight/volume/count), in standard units like grams or millilitres.' },
  { term: 'Declaration', plain: 'An information block the law requires on every packaged product: name, address, MRP, quantity, contact details, dates.' },
  { term: 'Finding', plain: 'One result from the AI about one declaration — “looks fine”, “problem”, or “please check”.' },
  { term: 'Confidence', plain: 'How sure the AI is about a result (0–100%). Below 75% a human must verify before any action.' },
  { term: 'Compliance score', plain: '0–100 summary of one inspection. 80+ usually means compliant; lower means issues were found.' },
  { term: 'Rule set (LM-PC-2011)', plain: 'The checklist of legal requirements from the Legal Metrology (Packaged Commodities) Rules, 2011, stored as configurable data — not hard-coded.' },
  { term: 'Rule version', plain: 'Each published edition of the checklist. Inspections remember which version was used, so old reports stay valid forever.' },
  { term: 'Severity', plain: 'How serious a broken rule is: Critical and High matter most; Low items are notes.' },
  { term: 'Evidence / bounding box', plain: 'The exact photo region the AI read. Boxes on the image prove what was seen — this is what makes decisions defensible.' },
  { term: 'Audit trail', plain: 'An append-only log of who did what and when. Nobody can quietly change history.' },
  { term: 'Human review', plain: 'The AI never decides enforcement. An authorized officer accepts, corrects, or rejects — that decision is what counts.' },
];
