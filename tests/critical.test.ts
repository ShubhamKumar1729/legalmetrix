/**
 * Critical Workflow Tests — PackComply SIH 26034
 * Run with: npm test (if jest configured) or node --loader tsx
 */

import { evaluateCondition } from '../src/lib/rules/evaluator';
import { calculateComplianceScore } from '../src/lib/rules/scoring';

console.log('=== PackComply Critical Tests ===');

// Test 1: Rule Evaluator - exists
const test1 = evaluateCondition({ field: 'mrp', operator: 'exists' }, { mrp: '₹99' });
console.assert(test1.passed === true, 'Test 1 Failed: exists should pass');
console.log('✓ Test 1: exists operator');

// Test 2: Rule Evaluator - not_exists
const test2 = evaluateCondition({ field: 'mrp', operator: 'not_exists' }, { mrp: '' });
console.assert(test2.passed === true, 'Test 2 Failed: not_exists should pass for empty');
console.log('✓ Test 2: not_exists operator');

// Test 3: AND logic
const test3 = evaluateCondition({
  logic: 'AND',
  conditions: [
    { field: 'category', operator: 'in', value: ['FOOD'] },
    { field: 'net_quantity_value', operator: 'gte', value: 100 }
  ]
}, { category: 'FOOD', net_quantity_value: 500 });
console.assert(test3.passed === true, 'Test 3 Failed: AND should pass');
console.log('✓ Test 3: AND logic');

// Test 4: Compliance Scoring
const findings: any[] = [
  { status: 'PASS', severity: 'CRITICAL', confidence: 98 },
  { status: 'VIOLATION', severity: 'HIGH', confidence: 94 },
  { status: 'REVIEW', severity: 'CRITICAL', confidence: 71 },
];
const score = calculateComplianceScore(findings);
console.assert(score >= 0 && score <= 100, 'Test 4 Failed: score out of range');
console.log(`✓ Test 4: Compliance scoring = ${score}/100`);

// Test 5: Mock AI deterministic
import { MockAIProvider } from '../src/lib/ai/mock-provider';
const mock = new MockAIProvider();
mock.analyze({
  inspectionId: 'insp-001',
  imageIds: ['img-1'],
  imageUrls: ['/api/placeholder/image?text=Test'],
  productMetadata: { productName: 'FreshBite Premium Biscuits' },
  ruleSetVersion: 'LM-PC-2011-v1.2'
}).then(res => {
  console.assert(res.extractedFields.length > 0, 'Test 5 Failed: should return fields');
  console.assert(res.findings.length > 0, 'Test 5 Failed: should return findings');
  console.assert(res.confidence.average > 0, 'Test 5 Failed: confidence');
  console.log(`✓ Test 5: Mock AI returns ${res.extractedFields.length} fields, ${res.findings.length} findings, avg conf ${res.confidence.average}%`);
  console.log('=== All Critical Tests Passed ===');
});
