import type { RegulatoryRule, Finding, ExtractedField, Severity } from '@/types';
import { evaluateRule, type EvaluationContext } from './evaluator';
import { memoryDB, seedMemoryDB } from '../db/memory-store';
import { connectDB, isDBConnected } from '../db/connection';
import { RegulatoryRuleModel } from '../db/models';

export interface RuleEvaluationInput {
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
}

export class RuleEngine {
  private confidenceThresholdHigh: number;
  private confidenceThresholdMedium: number;

  constructor() {
    this.confidenceThresholdHigh = parseInt(process.env.CONFIDENCE_THRESHOLD_HIGH || '90');
    this.confidenceThresholdMedium = parseInt(process.env.CONFIDENCE_THRESHOLD_MEDIUM || '75');
  }

  async getActiveRules(ruleSetVersion?: string): Promise<RegulatoryRule[]> {
    await seedMemoryDB();

    // Try MongoDB first
    try {
      const connected = await connectDB();
      if (connected && isDBConnected()) {
        const query: any = { enabled: true, status: 'PUBLISHED' };
        if (ruleSetVersion) {
          query.version = ruleSetVersion.replace('LM-PC-2011-v', '').replace('v', '');
          // For simplicity, if version specified, filter by it, else get latest
        }
        const rules: any[] = await RegulatoryRuleModel.find(query).sort({ ruleCode: 1 });
        if (rules.length > 0) {
          return rules.map((r: any) => ({
            id: r._id.toString(),
            ruleCode: r.ruleCode,
            title: r.title,
            description: r.description || '',
            legalReference: r.legalReference || '',
            category: r.category || '',
            applicableProductCategories: r.applicableProductCategories || ['ALL'],
            requirementType: r.requirementType as any,
            validationLogic: r.validationLogic as any,
            severity: r.severity as any,
            enabled: r.enabled,
            effectiveFrom: r.effectiveFrom?.toISOString() || new Date().toISOString(),
            effectiveTo: r.effectiveTo?.toISOString(),
            version: r.version || '1.2',
            evidenceRequired: r.evidenceRequired || true,
            reviewRequired: r.reviewRequired || false,
            createdBy: r.createdBy || '',
            updatedBy: r.updatedBy || '',
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            status: r.status as any,
          }));
        }
      }
    } catch (e) {
      console.warn('RuleEngine MongoDB failed, using memory', e);
    }

    // Fallback to memory
    const memRules = memoryDB.rules.all().filter(r => r.enabled && r.status === 'PUBLISHED');
    return memRules;
  }

  private buildContext(extractedFields: ExtractedField[], productMetadata: any): EvaluationContext {
    const context: EvaluationContext = {
      category: productMetadata.category,
      product_name: productMetadata.productName,
      brand: productMetadata.brand,
      manufacturer: productMetadata.manufacturer,
    };

    // Add extracted fields to context
    for (const field of extractedFields) {
      context[field.fieldName] = field.value;
      context[`${field.fieldName}_confidence`] = field.confidence;
      context[`${field.fieldName}_exists`] = !!field.value;
      if (field.normalizedValue) {
        context[`${field.fieldName}_normalized`] = field.normalizedValue;
        // Try numeric
        const num = parseFloat(field.normalizedValue);
        if (!isNaN(num)) {
          context[`${field.fieldName}_value`] = num;
        }
      }
    }

    return context;
  }

  private calculateSeverityWeight(severity: Severity): number {
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
    const rules = await this.getActiveRules(input.ruleSetVersion);
    const context = this.buildContext(input.extractedFields, input.productMetadata);
    
    const findings: Finding[] = [];
    let passed = 0;
    let violations = 0;
    let warnings = 0;
    let reviewRequired = 0;

    const now = new Date().toISOString();
    const inspectionId = `eval-${Date.now()}`;

    for (const rule of rules) {
      // Check category applicability
      if (!rule.applicableProductCategories.includes('ALL') && 
          !rule.applicableProductCategories.includes(input.productMetadata.category)) {
        continue;
      }

      const evaluation = evaluateRule(rule.validationLogic, context);
      
      // Find corresponding extracted field for confidence
      const relatedField = input.extractedFields.find(f => 
        f.fieldName === rule.validationLogic.field || 
        f.ruleCode === rule.ruleCode
      );
      
      const confidence = relatedField?.confidence || 85;

      // Decision logic with confidence thresholds
      let status: 'PASS' | 'VIOLATION' | 'WARNING' | 'REVIEW' = 'PASS';
      let reviewStatus: any = 'AI_CONFIRMED';

      if (!evaluation.passed) {
        if (rule.requirementType === 'MANDATORY') {
          if (confidence >= this.confidenceThresholdHigh) {
            status = 'VIOLATION';
            violations++;
          } else if (confidence >= this.confidenceThresholdMedium) {
            status = rule.reviewRequired ? 'REVIEW' : 'VIOLATION';
            if (status === 'REVIEW') reviewRequired++; else violations++;
            reviewStatus = 'PENDING';
          } else {
            status = 'REVIEW';
            reviewRequired++;
            reviewStatus = 'PENDING';
          }
        } else if (rule.requirementType === 'RECOMMENDED') {
          status = 'WARNING';
          warnings++;
        } else {
          status = 'REVIEW';
          reviewRequired++;
        }
      } else {
        // Rule passed, but check confidence
        if (confidence < this.confidenceThresholdMedium) {
          status = 'REVIEW';
          reviewRequired++;
          reviewStatus = 'PENDING';
        } else if (confidence < this.confidenceThresholdHigh && rule.reviewRequired) {
          status = 'REVIEW';
          reviewRequired++;
          reviewStatus = 'PENDING';
        } else {
          status = 'PASS';
          passed++;
        }
      }

      // Only create finding if not PASS, or if it's a mandatory field that passed (for transparency)
      if (status !== 'PASS' || rule.requirementType === 'MANDATORY') {
        const finding: Finding = {
          id: `find-${inspectionId}-${rule.id}`,
          inspectionId,
          declarationType: rule.category,
          title: rule.title,
          description: evaluation.passed ? `${rule.title} - Compliant` : `${rule.title} - ${evaluation.reason}`,
          detectedValue: relatedField?.value,
          expectedValue: rule.description,
          status,
          severity: rule.severity,
          confidence,
          ruleId: rule.id,
          ruleCode: rule.ruleCode,
          legalReference: rule.legalReference,
          evidence: relatedField ? [{
            imageId: relatedField.sourceImageId,
            boundingBox: relatedField.boundingBox,
          }] : [],
          reviewStatus,
          createdAt: now,
        };

        // Avoid duplicate PASS findings for demo - only include violations and reviews plus critical passes
        if (status !== 'PASS' || ['MRP','NET_QUANTITY','MANUFACTURER_INFO'].includes(rule.category)) {
          findings.push(finding);
        } else if (status === 'PASS') {
          passed++;
        }
      }
    }

    // Calculate compliance score
    const totalWeight = rules.reduce((sum, r) => sum + this.calculateSeverityWeight(r.severity), 0);
    let deduction = 0;
    
    for (const finding of findings) {
      if (finding.status === 'VIOLATION') {
        deduction += this.calculateSeverityWeight(finding.severity);
      } else if (finding.status === 'REVIEW') {
        deduction += this.calculateSeverityWeight(finding.severity) * 0.5;
      } else if (finding.status === 'WARNING') {
        deduction += this.calculateSeverityWeight(finding.severity) * 0.25;
      }
    }

    const complianceScore = Math.max(0, Math.min(100, Math.round(100 - (deduction / totalWeight) * 100)));

    return {
      findings,
      complianceScore,
      ruleSetVersion: input.ruleSetVersion || process.env.DEFAULT_RULESET_VERSION || 'LM-PC-2011-v1.2',
      evaluatedRules: rules.length,
      passed,
      violations,
      warnings,
      reviewRequired,
    };
  }
}

export const ruleEngine = new RuleEngine();
