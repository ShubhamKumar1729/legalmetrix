/** Plain-language labels. The interface avoids technical jargon wherever possible. */

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Not analyzed',
  PROCESSING: 'Analyzing',
  COMPLIANT: 'Compliant',
  NON_COMPLIANT: 'Non-compliant',
  REVIEW_REQUIRED: 'Review required',
};

export const FINDING_STATUS_LABEL: Record<string, string> = {
  PASS: 'Passed',
  VIOLATION: 'Violation',
  WARNING: 'Warning',
  REVIEW: 'Needs review',
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting review',
  AI_CONFIRMED: 'Confirmed automatically',
  HUMAN_CONFIRMED: 'Confirmed by reviewer',
  CORRECTED: 'Corrected by reviewer',
  ESCALATED: 'Escalated',
};

export const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  WARNING: 'Warning',
};

export const RULE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  VALIDATION: 'In validation',
  READY_FOR_APPROVAL: 'Ready for approval',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const CATEGORY_LABEL: Record<string, string> = {
  FOOD: 'Food',
  COSMETICS: 'Cosmetics',
  GROCERY: 'Grocery',
  ELECTRONICS: 'Electronics',
  TEXTILES: 'Textiles',
  OTHER: 'Other',
};

export function statusVariant(status: string): 'compliant' | 'violation' | 'review' | 'processing' | 'secondary' {
  if (status === 'COMPLIANT') return 'compliant';
  if (status === 'NON_COMPLIANT') return 'violation';
  if (status === 'PROCESSING') return 'processing';
  if (status === 'REVIEW_REQUIRED' || status === 'REVIEW' || status === 'PENDING') return 'review';
  return 'secondary';
}

export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}
