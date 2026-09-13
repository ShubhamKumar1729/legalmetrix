/**
 * Tests the compliance assistant's honesty contract: it answers only from stored
 * records, and says so plainly when it cannot.
 *
 *   npx tsx tests/assistant.test.ts
 *
 * No DOM is needed — this exercises the answering logic directly.
 */
import assert from 'node:assert/strict';
import { answerQuestion, NOTHING_SELECTED_PROMPT } from '../src/lib/assistant/assistant';
import type { Inspection, RegulatoryRule } from '../src/types';

const RULE: RegulatoryRule = {
  id: 'rule-1',
  ruleCode: 'LM-PC-2011-6(1)(e)',
  title: 'MRP declaration',
  description: 'Retail sale price declared inclusive of all taxes.',
  legalReference: 'Rule 6(1)(e)',
  category: 'MRP',
  applicableProductCategories: ['ALL'],
  requirementType: 'MANDATORY',
  validationLogic: { field: 'mrp', operator: 'exists' },
  severity: 'CRITICAL',
  enabled: true,
  effectiveFrom: '2011-04-01T00:00:00.000Z',
  version: '1.0.0',
  evidenceRequired: true,
  reviewRequired: true,
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'PUBLISHED',
};

function makeInspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'ins-1',
    inspectionNumber: 'LM-2026-000001',
    productName: 'Test Packaged Rice',
    brand: 'Test Brand',
    category: 'FOOD',
    manufacturer: 'Test Foods Pvt Ltd',
    barcode: '8901234567890',
    batchNumber: 'B-4471',
    inspectorId: 'user-1',
    inspectorName: 'Test Inspector',
    status: 'NON_COMPLIANT',
    source: 'FIELD',
    images: [
      {
        id: 'img-1',
        inspectionId: 'ins-1',
        side: 'FRONT',
        url: '/api/images/img-1',
        originalName: 'front.jpg',
        size: 204800,
        mimeType: 'image/jpeg',
        width: 1280,
        height: 720,
        source: 'CAMERA',
        quality: { resolution: 720 },
        uploadedAt: '2026-09-13T09:00:00.000Z',
      },
    ],
    startedAt: '2026-09-13T09:00:00.000Z',
    aiRunId: 'run-1',
    aiProvider: 'development',
    aiModelVersion: '1.0.0',
    processingTimeMs: 142,
    ruleSetVersion: 'LM-PC-2011',
    rulesEvaluated: 1,
    complianceScore: 0,
    scored: true,
    confidenceSummary: { average: 0, min: 0, max: 0, lowConfidenceCount: 1 },
    findings: [
      {
        id: 'find-1',
        inspectionId: 'ins-1',
        declarationType: 'MRP',
        title: 'MRP declaration',
        description: 'Retail sale price must be declared inclusive of all taxes.',
        detectedValue: '₹99',
        status: 'VIOLATION',
        severity: 'CRITICAL',
        confidence: 0,
        ruleId: 'rule-1',
        ruleCode: 'LM-PC-2011-6(1)(e)',
        legalReference: 'Rule 6(1)(e)',
        evidence: [],
        reviewStatus: 'HUMAN_CONFIRMED',
        reviewerName: 'Test Reviewer',
        correctedValue: '₹99 inclusive of taxes',
        reviewedAt: '2026-09-13T09:05:00.000Z',
        createdAt: '2026-09-13T09:02:00.000Z',
      },
    ],
    extractedFields: [],
    analysisNotes: [],
    reviewStatus: 'COMPLETED',
    createdAt: '2026-09-13T09:00:00.000Z',
    updatedAt: '2026-09-13T09:05:00.000Z',
    ...overrides,
  };
}

let passed = 0;
const failures: string[] = [];

function step(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(error as Error).message}`);
  }
}

console.log('\nLegalMetrix — compliance assistant test\n');

step('with no inspection selected it asks rather than guessing', () => {
  const reply = answerQuestion('what failed?', { inspection: null, rules: [] });
  assert.equal(reply.answer, NOTHING_SELECTED_PROMPT);
  assert.equal(NOTHING_SELECTED_PROMPT, 'Which inspection would you like me to look at?');
  assert.equal(reply.answered, false, 'it must not claim to have answered');
  assert.deepEqual(reply.groundedIn, [], 'nothing may be cited when there is no record');
});

step('an empty question is not answered', () => {
  const reply = answerQuestion('   ', { inspection: makeInspection(), rules: [RULE] });
  assert.equal(reply.answered, false);
});

step('violations are reported from the stored findings', () => {
  const reply = answerQuestion('What failed this inspection?', { inspection: makeInspection(), rules: [RULE] });
  assert.equal(reply.answered, true);
  assert.ok(reply.answer.includes('1 confirmed violation'), reply.answer);
  assert.ok(reply.answer.includes('LM-PC-2011-6(1)(e)'), 'the rule code must be cited');
  assert.ok(reply.answer.includes('Rule 6(1)(e)'), 'the legal reference must be cited');
  assert.ok(reply.answer.includes('₹99'), 'the detected value must come from the record');
  assert.ok(reply.groundedIn.includes('LM-2026-000001'), 'the answer must name its source');
});

step('an inspection with no violations says so, and flags pending reviews', () => {
  const inspection = makeInspection({
    status: 'REVIEW_REQUIRED',
    findings: makeInspection().findings.map((finding) => ({ ...finding, status: 'REVIEW' as const, reviewStatus: 'PENDING' as const })),
  });
  const reply = answerQuestion('Any violations?', { inspection, rules: [RULE] });
  assert.ok(reply.answer.includes('No confirmed violations'), reply.answer);
  assert.ok(reply.answer.includes('awaiting review'), 'it must not imply the inspection is clean');
});

step('review questions list only findings that are actually pending', () => {
  const settled = answerQuestion('What needs review?', { inspection: makeInspection(), rules: [RULE] });
  assert.ok(settled.answer.includes('Nothing on LM-2026-000001 is awaiting review'), settled.answer);

  const pending = makeInspection({
    findings: makeInspection().findings.map((finding) => ({ ...finding, reviewStatus: 'PENDING' as const })),
  });
  const reply = answerQuestion('What needs review?', { inspection: pending, rules: [RULE] });
  assert.ok(reply.answer.includes('1 finding(s) on LM-2026-000001 need a decision'), reply.answer);
});

step('an unscored inspection is reported as unscored, never as a number', () => {
  const inspection = makeInspection({
    scored: false,
    complianceScore: 0,
    analysisNotes: ['No regulatory rules are configured yet, so compliance could not be evaluated.'],
  });
  const reply = answerQuestion('What is the compliance score?', { inspection, rules: [] });
  assert.ok(reply.answer.includes('no compliance score'), reply.answer);
  assert.ok(reply.answer.includes('No regulatory rules are configured'), 'the stored reason must be given');
  assert.ok(!/\d+\/100/.test(reply.answer), 'it must not present 0/100 as if it were a real score');
});

step('a scored inspection reports the stored score', () => {
  const reply = answerQuestion('What was the result?', { inspection: makeInspection(), rules: [RULE] });
  assert.ok(reply.answer.includes('0/100'), reply.answer);
  assert.ok(reply.answer.includes('1 evaluated rule'), reply.answer);
});

step('rule questions cite the rules that were actually applied', () => {
  const reply = answerQuestion('Which rules apply?', { inspection: makeInspection(), rules: [RULE] });
  assert.ok(reply.answer.includes('LM-PC-2011-6(1)(e)'));
  assert.ok(reply.answer.includes('Rule 6(1)(e)'));
  assert.ok(reply.answer.includes('critical severity'), 'severity must come from the stored rule');
});

step('an inspection with no rules evaluated says so', () => {
  const inspection = makeInspection({ findings: [], rulesEvaluated: 0 });
  const reply = answerQuestion('Which rules apply?', { inspection, rules: [] });
  assert.ok(reply.answer.includes('No rules were evaluated'), reply.answer);
  assert.ok(reply.answer.includes('No rules are published yet'), reply.answer);
});

step('image questions report the real attachments', () => {
  const reply = answerQuestion('How many images were captured?', { inspection: makeInspection(), rules: [] });
  assert.ok(reply.answer.includes('1 image(s)'), reply.answer);
  assert.ok(reply.answer.includes('front (camera)'), reply.answer);

  const none = answerQuestion('How many images?', { inspection: makeInspection({ images: [] }), rules: [] });
  assert.ok(none.answer.includes('no images attached'), none.answer);
});

step('people questions name the recorded inspector and reviewer', () => {
  const reply = answerQuestion('Who reviewed this?', { inspection: makeInspection(), rules: [] });
  assert.ok(reply.answer.includes('Test Inspector'), reply.answer);
  assert.ok(reply.answer.includes('Test Reviewer'), reply.answer);

  const unreviewed = makeInspection({
    findings: makeInspection().findings.map(({ reviewerName, ...finding }) => finding),
  });
  const none = answerQuestion('Who reviewed this?', { inspection: unreviewed, rules: [] });
  assert.ok(none.answer.includes('No reviewer has acted on it yet'), none.answer);
});

step('model questions report the recorded run, and its absence', () => {
  const reply = answerQuestion('Which AI model was used?', { inspection: makeInspection(), rules: [] });
  assert.ok(reply.answer.includes('development'), reply.answer);
  assert.ok(reply.answer.includes('142 ms'), reply.answer);

  const noRun = makeInspection({ aiProvider: undefined, aiModelVersion: undefined, processingTimeMs: undefined });
  const none = answerQuestion('Which AI model was used?', { inspection: noRun, rules: [] });
  assert.ok(none.answer.includes('No AI run is recorded'), none.answer);
});

step('a question outside the stored record is refused, not invented', () => {
  const reply = answerQuestion('What will the court decide?', { inspection: makeInspection(), rules: [RULE] });
  assert.equal(reply.answered, false, 'it must not claim to have answered');
  assert.ok(reply.answer.includes('I can only answer from what is stored'), reply.answer);
  assert.ok(reply.answer.includes('What will the court decide?'), 'it must echo what it could not answer');
});

step('an off-topic question about another product is not answered from this record', () => {
  const reply = answerQuestion('How does the weather affect this?', { inspection: makeInspection(), rules: [RULE] });
  assert.equal(reply.answered, false);
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}
process.exit(0);
