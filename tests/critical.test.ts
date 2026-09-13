/**
 * Unit tests for the compliance pipeline.
 * Run with: npm test
 *
 * These exercise the real modules used by the API routes — the rule evaluator, the
 * scoring/outcome logic, the AI/rule finding merge, image validation and the rule engine
 * against an empty rule store.
 */
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

import { evaluateCondition, evaluateRule } from '../src/lib/rules/evaluator';
import { calculateComplianceScore, computeOutcome } from '../src/lib/rules/scoring';
import { mergeFindings } from '../src/lib/ai/merge-findings';
import { inspectImage, ImageValidationError } from '../src/lib/images/inspect';
import { ruleEngine } from '../src/lib/rules/engine';
import { db } from '../src/lib/db/repository';
import type { Finding } from '../src/types';

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ✓ ${name}`);
    })
    .catch((error: Error) => {
      failures.push(`${name}: ${error.message}`);
      console.log(`  ✗ ${name}\n      ${error.message}`);
    });
}

/* ------------------------------------------------------------------ PNG fixture */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function makePng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + 1 + x * 3;
      raw[offset] = (x * 7) % 256;
      raw[offset + 1] = (y * 11) % 256;
      raw[offset + 2] = 140;
    }
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: overrides.id || 'f1',
    inspectionId: 'i1',
    declarationType: 'MRP',
    title: overrides.title || 'MRP Declaration',
    description: '',
    status: 'PASS',
    severity: 'CRITICAL',
    confidence: 95,
    ruleId: 'r1',
    ruleCode: overrides.ruleCode || 'LM-PC-2011-6(1)(e)',
    legalReference: '',
    evidence: [],
    reviewStatus: 'AI_CONFIRMED',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Finding;
}

async function main() {
  console.log('\nLegalMetrix — pipeline tests\n');

  await test('rule evaluator: exists / not_exists', () => {
    assert.equal(evaluateCondition({ field: 'mrp', operator: 'exists' }, { mrp: '₹99' }).passed, true);
    assert.equal(evaluateCondition({ field: 'mrp', operator: 'exists' }, { mrp: '' }).passed, false);
    assert.equal(evaluateCondition({ field: 'mrp', operator: 'not_exists' }, {}).passed, true);
  });

  await test('rule evaluator: AND / OR / NOT', () => {
    const and = evaluateCondition(
      {
        logic: 'AND',
        conditions: [
          { field: 'category', operator: 'in', value: ['FOOD'] },
          { field: 'net_quantity_value', operator: 'gte', value: 100 },
        ],
      },
      { category: 'FOOD', net_quantity_value: 500 }
    );
    assert.equal(and.passed, true);

    const or = evaluateCondition(
      { logic: 'OR', conditions: [{ field: 'a', operator: 'exists' }, { field: 'b', operator: 'exists' }] },
      { b: 'x' }
    );
    assert.equal(or.passed, true);

    const not = evaluateCondition({ logic: 'NOT', conditions: [{ field: 'a', operator: 'exists' }] }, {});
    assert.equal(not.passed, true);
  });

  await test('scoring: violations reduce the score, empty findings score nothing', () => {
    const findings = [
      finding({ id: 'a', status: 'PASS', severity: 'CRITICAL', confidence: 98 }),
      finding({ id: 'b', status: 'VIOLATION', severity: 'HIGH', confidence: 94 }),
      finding({ id: 'c', status: 'REVIEW', severity: 'CRITICAL', confidence: 71 }),
    ];
    const score = calculateComplianceScore(findings);
    assert.ok(score !== null && score > 0 && score < 100, `expected a partial score, got ${score}`);
    assert.equal(calculateComplianceScore([]), null);
  });

  await test('outcome: violations dominate, pending findings force review', () => {
    const violation = computeOutcome([finding({ status: 'VIOLATION' })]);
    assert.equal(violation.status, 'NON_COMPLIANT');
    assert.equal(violation.violations, 1);

    const review = computeOutcome([finding({ status: 'REVIEW', reviewStatus: 'PENDING' })]);
    assert.equal(review.status, 'REVIEW_REQUIRED');
    assert.equal(review.reviewStatus, 'PENDING');

    const clean = computeOutcome([finding({ status: 'PASS' })]);
    assert.equal(clean.status, 'COMPLIANT');
    assert.equal(clean.score, 100);
  });

  await test('merge: a confident model finding overrides the rule finding', () => {
    const ruleFindings = [
      finding({ id: 'r1', ruleCode: 'MRP', status: 'REVIEW', confidence: 0, reviewStatus: 'PENDING' }),
    ];
    const modelFindings = [
      finding({ id: 'm1', ruleCode: 'MRP', status: 'VIOLATION', confidence: 97, detectedValue: 'missing' }),
    ];
    const merged = mergeFindings(ruleFindings, modelFindings, 75);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].status, 'VIOLATION');
    assert.equal(merged[0].detectedValue, 'missing');
  });

  await test('merge: an unconfident model finding does not override the rule decision', () => {
    const ruleFindings = [finding({ id: 'r1', ruleCode: 'MRP', status: 'REVIEW', confidence: 0 })];
    const modelFindings = [finding({ id: 'm1', ruleCode: 'MRP', status: 'VIOLATION', confidence: 40 })];
    const merged = mergeFindings(ruleFindings, modelFindings, 75);
    assert.equal(merged[0].status, 'REVIEW');
  });

  await test('image validation: reads real dimensions from a PNG header', () => {
    const metadata = inspectImage(makePng(640, 480));
    assert.equal(metadata.mimeType, 'image/png');
    assert.equal(metadata.width, 640);
    assert.equal(metadata.height, 480);
  });

  await test('image validation: rejects non-image bytes', () => {
    assert.throws(
      () => inspectImage(Buffer.from('this is definitely not an image file at all'.repeat(10))),
      (error: unknown) => error instanceof ImageValidationError && error.code === 'UNSUPPORTED_FORMAT'
    );
  });

  await test('image validation: rejects a truncated PNG', () => {
    const truncated = makePng(640, 480).subarray(0, 200);
    assert.throws(
      () => inspectImage(truncated),
      (error: unknown) => error instanceof ImageValidationError && error.code === 'TRUNCATED_IMAGE'
    );
  });

  await test('image validation: rejects a low-resolution image', () => {
    assert.throws(
      () => inspectImage(makePng(120, 120)),
      (error: unknown) => error instanceof ImageValidationError && error.code === 'LOW_RESOLUTION'
    );
  });

  await test('rule engine: an empty rule store produces no findings and says so', async () => {
    const result = await ruleEngine.evaluate({
      inspectionId: 'test-inspection',
      extractedFields: [],
      productMetadata: { productName: 'Test', brand: 'Test', category: 'FOOD', manufacturer: 'Test' },
    });
    assert.equal(result.findings.length, 0);
    assert.equal(result.evaluatedRules, 0);
    assert.equal(result.complianceScore, 0);
    assert.ok(result.notes.length > 0, 'expected an explanatory note');
  });

  await test('rule engine: a published rule with no extraction routes to human review', async () => {
    const rule = await db.rules.create({
      ruleCode: 'TEST-RULE-1',
      title: 'MRP must be declared',
      description: 'MRP inclusive of all taxes',
      legalReference: 'Rule 6(1)(e)',
      category: 'MRP',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'mrp', operator: 'exists' },
      severity: 'CRITICAL',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.0',
      evidenceRequired: true,
      reviewRequired: false,
      createdBy: 'tester',
      updatedBy: 'tester',
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // No extracted fields (the development provider reads nothing): must not assert a violation.
    const uncertain = await ruleEngine.evaluate({
      inspectionId: 'test-inspection-2',
      extractedFields: [],
      productMetadata: { productName: 'Test', brand: 'Test', category: 'FOOD', manufacturer: 'Test' },
    });
    assert.equal(uncertain.evaluatedRules, 1);
    assert.equal(uncertain.findings[0].status, 'REVIEW');
    assert.equal(uncertain.findings[0].reviewStatus, 'PENDING');

    // A confident extraction that satisfies the rule passes.
    const satisfied = await ruleEngine.evaluate({
      inspectionId: 'test-inspection-3',
      extractedFields: [
        {
          id: 'ef-1',
          fieldName: 'mrp',
          value: '₹99',
          normalizedValue: '99',
          rawText: 'MRP ₹99',
          language: 'en',
          script: 'Latin',
          confidence: 97,
          sourceImageId: 'img-1',
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
          status: 'PASS',
          editable: true,
          reviewStatus: 'AI_CONFIRMED',
        },
      ],
      productMetadata: { productName: 'Test', brand: 'Test', category: 'FOOD', manufacturer: 'Test' },
    });
    assert.equal(satisfied.findings[0].status, 'PASS');
    assert.equal(satisfied.complianceScore, 100);

    await db.rules.remove(rule.id);
  });

  await test('evaluateRule wraps evaluateCondition with a traceable reason', () => {
    const result = evaluateRule({ field: 'mrp', operator: 'exists' }, { mrp: '₹99' });
    assert.equal(result.passed, true);
    assert.equal(result.evaluatedConditions.length, 1);
    assert.ok(result.reason.length > 0);
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
