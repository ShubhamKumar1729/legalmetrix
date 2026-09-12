import type { RuleCondition } from '@/types';

/**
 * Safe Rule Evaluator
 * Evaluates structured rule conditions without executing arbitrary code
 * Prevents injection, ensures auditability
 */

export interface EvaluationContext {
  [field: string]: any;
}

export interface EvaluationResult {
  passed: boolean;
  reason: string;
  evaluatedConditions: any[];
}

export function evaluateCondition(condition: RuleCondition, context: EvaluationContext): { passed: boolean; reason: string } {
  // Handle logical operators
  if (condition.logic) {
    const subConditions = condition.conditions || [];
    
    if (condition.logic === 'AND') {
      for (const sub of subConditions) {
        const res = evaluateCondition(sub, context);
        if (!res.passed) {
          return { passed: false, reason: `AND failed: ${res.reason}` };
        }
      }
      return { passed: true, reason: 'All AND conditions passed' };
    }
    
    if (condition.logic === 'OR') {
      for (const sub of subConditions) {
        const res = evaluateCondition(sub, context);
        if (res.passed) {
          return { passed: true, reason: `OR passed: ${res.reason}` };
        }
      }
      return { passed: false, reason: 'No OR conditions passed' };
    }
    
    if (condition.logic === 'NOT') {
      if (subConditions.length === 0) return { passed: true, reason: 'NOT with no conditions' };
      const res = evaluateCondition(subConditions[0], context);
      return { passed: !res.passed, reason: res.passed ? 'NOT negated true to false' : 'NOT negated false to true' };
    }
  }

  // Handle field operators
  const field = condition.field;
  if (!field) {
    return { passed: false, reason: 'No field specified' };
  }

  const value = context[field];
  const expected = condition.value;

  switch (condition.operator) {
    case 'exists':
      return {
        passed: value !== undefined && value !== null && value !== '',
        reason: value ? `${field} exists` : `${field} missing`,
      };
    
    case 'not_exists':
      return {
        passed: value === undefined || value === null || value === '',
        reason: !value ? `${field} does not exist (expected)` : `${field} exists but should not`,
      };
    
    case 'equals':
      return {
        passed: value == expected,
        reason: value == expected ? `${field} equals ${expected}` : `${field} (${value}) != ${expected}`,
      };
    
    case 'not_equals':
      return {
        passed: value != expected,
        reason: value != expected ? `${field} not equals ${expected}` : `${field} equals ${expected} but should not`,
      };
    
    case 'contains':
      if (typeof value === 'string' && typeof expected === 'string') {
        return {
          passed: value.toLowerCase().includes(expected.toLowerCase()),
          reason: value.toLowerCase().includes(expected.toLowerCase()) 
            ? `${field} contains ${expected}` 
            : `${field} does not contain ${expected}`,
        };
      }
      if (Array.isArray(value)) {
        return {
          passed: value.includes(expected),
          reason: value.includes(expected) ? `${field} array contains ${expected}` : `${field} array missing ${expected}`,
        };
      }
      return { passed: false, reason: `${field} contains check failed - invalid types` };
    
    case 'regex':
      try {
        const regex = new RegExp(expected);
        return {
          passed: regex.test(String(value)),
          reason: regex.test(String(value)) ? `${field} matches ${expected}` : `${field} does not match ${expected}`,
        };
      } catch {
        return { passed: false, reason: `Invalid regex ${expected}` };
      }
    
    case 'gt':
      return {
        passed: Number(value) > Number(expected),
        reason: Number(value) > Number(expected) ? `${field} ${value} > ${expected}` : `${field} ${value} <= ${expected}`,
      };
    
    case 'gte':
      return {
        passed: Number(value) >= Number(expected),
        reason: Number(value) >= Number(expected) ? `${field} ${value} >= ${expected}` : `${field} ${value} < ${expected}`,
      };
    
    case 'lt':
      return {
        passed: Number(value) < Number(expected),
        reason: Number(value) < Number(expected) ? `${field} ${value} < ${expected}` : `${field} ${value} >= ${expected}`,
      };
    
    case 'lte':
      return {
        passed: Number(value) <= Number(expected),
        reason: Number(value) <= Number(expected) ? `${field} ${value} <= ${expected}` : `${field} ${value} > ${expected}`,
      };
    
    case 'in':
      if (Array.isArray(expected)) {
        return {
          passed: expected.includes(value),
          reason: expected.includes(value) ? `${field} ${value} in [${expected.join(',')}]` : `${field} ${value} not in [${expected.join(',')}]`,
        };
      }
      return { passed: false, reason: `in operator requires array` };
    
    case 'not_in':
      if (Array.isArray(expected)) {
        return {
          passed: !expected.includes(value),
          reason: !expected.includes(value) ? `${field} ${value} not in excluded list` : `${field} ${value} in excluded list`,
        };
      }
      return { passed: false, reason: `not_in operator requires array` };
    
    default:
      return { passed: false, reason: `Unknown operator ${condition.operator}` };
  }
}

export function evaluateRule(ruleCondition: RuleCondition, context: EvaluationContext): EvaluationResult {
  const result = evaluateCondition(ruleCondition, context);
  return {
    passed: result.passed,
    reason: result.reason,
    evaluatedConditions: [ruleCondition],
  };
}
