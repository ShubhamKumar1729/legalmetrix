import type { Finding } from '@/types';

export interface ScoringConfig {
  weights: Record<string, number>;
  thresholds: {
    compliant: number;
    review: number;
  };
  confidenceImpact: boolean;
}

export const defaultScoringConfig: ScoringConfig = {
  weights: {
    CRITICAL: 25,
    HIGH: 15,
    MEDIUM: 8,
    LOW: 3,
    WARNING: 1,
  },
  thresholds: {
    compliant: 80,
    review: 50,
  },
  confidenceImpact: true,
};

/**
 * Deterministic compliance score derived only from the findings that actually exist.
 * Returns null when there is nothing to score.
 */
export function calculateComplianceScore(
  findings: Finding[],
  config: ScoringConfig = defaultScoringConfig
): number | null {
  if (!findings || findings.length === 0) return null;

  let totalPossible = 0;
  let deductions = 0;

  for (const finding of findings) {
    const weight = config.weights[finding.severity] ?? 5;
    totalPossible += weight;

    if (finding.status === 'VIOLATION') {
      let deduction = weight;
      if (config.confidenceImpact) {
        const confidenceFactor = (finding.confidence ?? 0) / 100;
        deduction *= 0.8 + 0.2 * confidenceFactor;
      }
      deductions += deduction;
    } else if (finding.status === 'REVIEW') {
      deductions += weight * 0.5;
    } else if (finding.status === 'WARNING') {
      deductions += weight * 0.25;
    }
  }

  if (totalPossible === 0) return null;
  return Math.max(0, Math.min(100, Math.round(100 - (deductions / totalPossible) * 100)));
}

export interface InspectionOutcome {
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'REVIEW_REQUIRED';
  score: number | null;
  passed: number;
  violations: number;
  warnings: number;
  review: number;
  reviewStatus: 'NOT_REQUIRED' | 'PENDING';
}

/** Single source of truth for turning findings into a status, score and review flag. */
export function computeOutcome(findings: Finding[]): InspectionOutcome {
  const score = calculateComplianceScore(findings);
  const violations = findings.filter((f) => f.status === 'VIOLATION').length;
  const review = findings.filter((f) => f.status === 'REVIEW').length;
  const warnings = findings.filter((f) => f.status === 'WARNING').length;
  const passed = findings.filter((f) => f.status === 'PASS').length;
  const awaitingHuman = findings.some((f) => f.reviewStatus === 'PENDING');

  let status: InspectionOutcome['status'] = 'COMPLIANT';
  if (violations > 0) status = 'NON_COMPLIANT';
  else if (review > 0 || awaitingHuman) status = 'REVIEW_REQUIRED';
  else if (score !== null && score < defaultScoringConfig.thresholds.compliant) status = 'REVIEW_REQUIRED';

  return {
    status,
    score,
    passed,
    violations,
    warnings,
    review,
    reviewStatus: awaitingHuman ? 'PENDING' : 'NOT_REQUIRED',
  };
}

/** Risk score for a product, computed from its real inspection history. */
export function calculateRiskScore(inspections: { status: string; findings: Finding[] }[]): number {
  if (inspections.length === 0) return 0;

  const violationCount = inspections.filter((i) => i.status === 'NON_COMPLIANT').length;
  const reviewCount = inspections.filter((i) => i.status === 'REVIEW_REQUIRED').length;
  const criticalViolations = inspections
    .flatMap((i) => i.findings || [])
    .filter((f) => f.severity === 'CRITICAL' && f.status === 'VIOLATION').length;

  const violationRate = violationCount / inspections.length;
  const risk =
    violationRate * 60 +
    (criticalViolations / Math.max(1, inspections.length)) * 30 +
    (reviewCount / inspections.length) * 10;

  return Math.min(100, Math.round(risk));
}
