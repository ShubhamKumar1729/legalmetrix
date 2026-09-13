import type { ExtractedField, Finding, RegulatoryRule, Severity } from '@/types';
import { evaluateRule, type EvaluationContext } from './evaluator';
import { db } from '../db/repository';

export interface RuleEvaluationInput {
  inspectionId: string;
  extractedFields: ExtractedField[];
  productMetadata: {
    productName: string;
    brand: string;
    category: string;
    manufacturer: string;
  };
  ruleSetVersion?: string;
}

export interface RuleEvaluationOutput {
  findings: Finding[];
  complianceScore: number;
  ruleSetVersion: string;
  evaluatedRules: number;
  passed: number;
  violations: number;
  warnings: number;
  reviewRequired: number;
  notes: string[];
}

function compareVersions(a: string, b: string): number {
  const pa = (a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = (b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Configurable rule engine.
 *
 * Rules come from the database only. When no rules are published, the engine evaluates
 * nothing and says so — it never falls back to a hard-coded rule set.
 */
export class RuleEngine {
  private highThreshold = parseInt(process.env.CONFIDENCE_THRESHOLD_HIGH || '90', 10);
  private mediumThreshold = parseInt(process.env.CONFIDENCE_THRESHOLD_MEDIUM || '75', 10);

  /** Published, enabled rules. When several versions of a rule code are published, the newest wins. */
  async getActiveRules(): Promise<RegulatoryRule[]> {
    const published = await db.rules.list({ enabled: true, status: 'PUBLISHED' });
    const byCode = new Map<string, RegulatoryRule>();
    for (const rule of published) {
      const existing = byCode.get(rule.ruleCode);
      if (!existing || compareVersions(rule.version, existing.version) > 0) {
        byCode.set(rule.ruleCode, rule);
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));
  }

  private buildContext(extractedFields: ExtractedField[], metadata: RuleEvaluationInput['productMetadata']): EvaluationContext {
    const context: EvaluationContext = {
      category: metadata.category,
      product_name: metadata.productName,
      brand: metadata.brand,
      manufacturer: metadata.manufacturer,
    };

    for (const field of extractedFields) {
      context[field.fieldName] = field.value;
      context[`${field.fieldName}_confidence`] = field.confidence;
      if (field.normalizedValue) {
        context[`${field.fieldName}_normalized`] = field.normalizedValue;
        const numeric = parseFloat(field.normalizedValue);
        if (!Number.isNaN(numeric)) context[`${field.fieldName}_value`] = numeric;
      }
    }

    return context;
  }

  private severityWeight(severity: Severity): number {
    switch (severity) {
      case 'CRITICAL': return 25;
      case 'HIGH': return 15;
      case 'MEDIUM': return 8;
      case 'LOW': return 3;
      case 'WARNING': return 1;
      default: return 5;
    }
  }

  async evaluate(input: RuleEvaluationInput): Promise<RuleEvaluationOutput> {
    const rules = await this.getActiveRules();
    const notes: string[] = [];

    if (rules.length === 0) {
      return {
        findings: [],
        complianceScore: 0,
        ruleSetVersion: input.ruleSetVersion || 'none',
        evaluatedRules: 0,
        passed: 0,
        violations: 0,
        warnings: 0,
        reviewRequired: 0,
        notes: ['No regulatory rules are configured yet, so compliance could not be evaluated.'],
      };
    }

    const context = this.buildContext(input.extractedFields, input.productMetadata);
    const findings: Finding[] = [];
    const now = new Date().toISOString();
    const counts = { passed: 0, violations: 0, warnings: 0, reviewRequired: 0 };
    let totalWeight = 0;
    let deductions = 0;

    for (const rule of rules) {
      const appliesToAll = rule.applicableProductCategories.includes('ALL');
      if (!appliesToAll && !rule.applicableProductCategories.includes(input.productMetadata.category)) {
        continue;
      }

      const evaluation = evaluateRule(rule.validationLogic, context);
      const field = rule.validationLogic.field;
      const relatedField = field
        ? input.extractedFields.find((f) => f.fieldName === field || f.ruleCode === rule.ruleCode)
        : input.extractedFields.find((f) => f.ruleCode === rule.ruleCode);

      // No extracted field means nothing was read from the package — confidence is zero,
      // which routes the rule to human review rather than asserting a violation.
      const confidence = relatedField?.confidence ?? 0;
      const weight = this.severityWeight(rule.severity);
      totalWeight += weight;

      let status: Finding['status'] = 'PASS';
      let reviewStatus: Finding['reviewStatus'] = 'AI_CONFIRMED';
      let description = evaluation.reason;

      if (evaluation.passed && confidence >= this.mediumThreshold) {
        status = 'PASS';
        reviewStatus = 'AI_CONFIRMED';
        counts.passed += 1;
      } else if (evaluation.passed) {
        status = 'REVIEW';
        reviewStatus = 'PENDING';
        description = `Declaration matched the rule but was read with low confidence (${confidence}%). Human confirmation required.`;
        counts.reviewRequired += 1;
        deductions += weight * 0.5;
      } else if (rule.requirementType === 'RECOMMENDED') {
        status = 'WARNING';
        reviewStatus = 'AI_CONFIRMED';
        counts.warnings += 1;
        deductions += weight * 0.25;
      } else if (confidence >= this.highThreshold) {
        status = 'VIOLATION';
        reviewStatus = 'AI_CONFIRMED';
        counts.violations += 1;
        deductions += weight;
      } else if (confidence >= this.mediumThreshold && !rule.reviewRequired) {
        status = 'VIOLATION';
        reviewStatus = 'AI_CONFIRMED';
        counts.violations += 1;
        deductions += weight;
      } else {
        status = 'REVIEW';
        reviewStatus = 'PENDING';
        description =
          confidence === 0
            ? 'This declaration was not detected in the supplied images. Human confirmation required.'
            : `Detected with insufficient confidence (${confidence}%). Human confirmation required.`;
        counts.reviewRequired += 1;
        deductions += weight * 0.5;
      }

      findings.push({
        id: `finding-${rule.id}`,
        inspectionId: input.inspectionId,
        declarationType: rule.category,
        title: rule.title,
        description,
        detectedValue: relatedField?.value || undefined,
        expectedValue: rule.description,
        status,
        severity: rule.severity,
        confidence,
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
        legalReference: rule.legalReference,
        evidence: relatedField
          ? [{ imageId: relatedField.sourceImageId, boundingBox: relatedField.boundingBox }]
          : [],
        reviewStatus,
        createdAt: now,
      });
    }

    const complianceScore =
      totalWeight === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (deductions / totalWeight) * 100)));

    if (input.extractedFields.length === 0) {
      notes.push(
        'No declarations were extracted automatically, so every rule is listed for human confirmation.'
      );
    }

    return {
      findings,
      complianceScore,
      ruleSetVersion: input.ruleSetVersion || 'current',
      evaluatedRules: findings.length,
      ...counts,
      notes,
    };
  }
}

export const ruleEngine = new RuleEngine();
