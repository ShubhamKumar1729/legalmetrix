import type { Finding, Severity } from '@/types';

export interface ScoringConfig {
  weights: Record<Severity, number>;
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

export function calculateComplianceScore(findings: Finding[], config: ScoringConfig = defaultScoringConfig): number {
  if (findings.length === 0) return 100;

  let totalPossible = 0;
  let deductions = 0;

  // Calculate total possible weight (assume all mandatory)
  for (const finding of findings) {
    const weight = config.weights[finding.severity] || 5;
    totalPossible += weight;

    if (finding.status === 'VIOLATION') {
      let deduction = weight;
      if (config.confidenceImpact) {
        // Lower confidence reduces deduction slightly (uncertainty)
        const confidenceFactor = finding.confidence / 100;
        deduction = deduction * (0.8 + 0.2 * confidenceFactor);
      }
      deductions += deduction;
    } else if (finding.status === 'REVIEW') {
      deductions += weight * 0.5;
    } else if (finding.status === 'WARNING') {
      deductions += weight * 0.25;
    }
  }

  if (totalPossible === 0) return 100;

  const score = Math.max(0, Math.min(100, Math.round(100 - (deductions / totalPossible) * 100)));
  return score;
}

export function getComplianceStatus(score: number, hasViolations: boolean, hasReview: boolean): 'COMPLIANT' | 'NON_COMPLIANT' | 'REVIEW_REQUIRED' {
  if (hasViolations) {
    // If any critical violation, non-compliant
    return 'NON_COMPLIANT';
  }
  if (hasReview) {
    return 'REVIEW_REQUIRED';
  }
  return score >= defaultScoringConfig.thresholds.compliant ? 'COMPLIANT' : 'REVIEW_REQUIRED';
}

export function calculateRiskScore(inspections: { status: string; findings: Finding[] }[]): number {
  if (inspections.length === 0) return 0;

  const violationCount = inspections.filter(i => i.status === 'NON_COMPLIANT').length;
  const reviewCount = inspections.filter(i => i.status === 'REVIEW_REQUIRED').length;
  
  const criticalViolations = inspections.flatMap(i => i.findings).filter(f => f.severity === 'CRITICAL' && f.status === 'VIOLATION').length;
  
  const violationRate = violationCount / inspections.length;
  const recencyFactor = 1; // Could weight recent violations more

  let risk = violationRate * 60 + (criticalViolations / Math.max(1, inspections.length)) * 30 + (reviewCount / inspections.length) * 10;
  
  return Math.min(100, Math.round(risk * recencyFactor));
}
