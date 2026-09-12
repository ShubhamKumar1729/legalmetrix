/**
 * Critical workflow tests — LegalMetrix
 * Run with: npm test
 *
 * These cover the two pure engines the whole product stands on:
 * the safe rule evaluator and compliance scoring, plus the mock AI contract.
 */
import { evaluateCondition } from '../src/lib/rules/evaluator';
import { calculateComplianceScore } from '../src/lib/rules/scoring';
import { MockAIProvider } from '../src/lib/ai/mock-provider';
import { describeLogic } from '../src/lib/ui/labels';

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ FAILED: ${name}`); failed++; }
}

console.log('=== LegalMetrix critical tests ===');

// 1. exists
check('exists passes when field present',
  evaluateCondition({ field: 'mrp', operator: 'exists' }, { mrp: '₹99' }).passed === true);

// 2. not_exists
check('not_exists passes for empty value',
  evaluateCondition({ field: 'mrp', operator: 'not_exists' }, { mrp: '' }).passed === true);

// 3. AND logic
check('AND passes when both hold',
  evaluateCondition({
    logic: 'AND',
    conditions: [
      { field: 'category', operator: 'in', value: ['FOOD'] },
      { field: 'net_quantity_value', operator: 'gte', value: 100 },
    ],
  }, { category: 'FOOD', net_quantity_value: 500 }).passed === true);

// 4. scoring stays in 0..100
const score = calculateComplianceScore([
  { status: 'PASS', severity: 'CRITICAL', confidence: 98 },
  { status: 'VIOLATION', severity: 'HIGH', confidence: 94 },
  { status: 'REVIEW', severity: 'CRITICAL', confidence: 71 },
] as any);
check(`score in range (got ${score})`, score >= 0 && score <= 100);

// 5. plain-language rule description never crashes on odd input
check('describeLogic handles nested conditions',
  describeLogic({ logic: 'AND', conditions: [{ field: 'mrp', operator: 'exists' }] }).includes('MRP'));

async function main() {
  // 6. Mock AI provider honors the integration contract
  const mock = new MockAIProvider();
  const res = await mock.analyze({
    inspectionId: 'insp-001',
    imageIds: ['img-1'],
    imageUrls: ['/api/placeholder/image?text=Test'],
    productMetadata: { productName: 'FreshBite Premium Biscuits' },
    ruleSetVersion: 'LM-PC-2011-v1.2',
  });
  check('AI response has extracted fields', res.extractedFields.length > 0);
  check('AI response has findings', res.findings.length > 0);
  check('AI response has stages (pipeline UI feed)', res.stages.length > 0);
  check('AI confidence is a sane average', res.confidence.average > 0 && res.confidence.average <= 100);
  check('AI response carries model metadata for traceability', !!res.modelMetadata.modelVersion);
  check('every finding links a rule code', res.findings.every(f => !!f.ruleCode));

  if (failed > 0) { console.error(`\n${failed} test(s) FAILED`); process.exit(1); }
  console.log('\n=== All critical tests passed ===');
}

main().catch(e => { console.error('Test run crashed:', e); process.exit(1); });
