/**
 * The real AI model path.
 *
 *   npx tsx tests/ai-http-provider.test.ts
 *
 * Everything else runs against MockAIProvider, which deliberately returns nothing. This
 * stands up a local HTTP server that behaves like a real vision model and points
 * AI_SERVICE_URL at it, so the production code path is actually executed: request
 * serialisation, the auth header, response parsing, metadata defaults, and error
 * handling. A stubbed fetch would prove nothing here.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Finding } from '../src/types';

/** Records what the provider actually sent, so the test can assert on the wire format. */
const received: { path: string; auth: string | null; body: unknown }[] = [];

let mode: 'ok' | 'error' | 'sparse' = 'ok';

const FULL_RESPONSE = {
  inspectionId: 'ins-1',
  runId: 'run-real-1',
  processingStatus: 'COMPLETED',
  stages: [],
  extractedFields: [
    {
      id: 'field-1',
      inspectionId: 'ins-1',
      fieldName: 'MRP',
      rawText: 'MRP Rs. 45.00',
      normalizedValue: '45.00',
      confidence: 94,
      boundingBox: { x: 10, y: 20, width: 100, height: 30 },
      source: 'AI',
    },
  ],
  findings: [],
  confidence: { average: 94, min: 94, max: 94 },
  evidenceRegions: [],
  warnings: [],
  modelMetadata: {
    provider: 'http',
    modelName: 'TestVision-1',
    modelVersion: 'v1.2.3',
    processedAt: '2026-09-13T10:00:00.000Z',
    processingTimeMs: 1200,
  },
};

const SPARSE_RESPONSE = {
  inspectionId: 'ins-1',
  runId: 'run-real-2',
  processingStatus: 'COMPLETED',
  stages: [],
  extractedFields: [],
  findings: [],
  confidence: { average: 0, min: 0, max: 0 },
};

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    received.push({
      path: req.url || '',
      auth: req.headers.authorization ?? null,
      body: raw ? JSON.parse(raw) : null,
    });

    const path = req.url || '';

    if (path.endsWith('/health')) {
      res.writeHead(mode === 'error' ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (path.endsWith('/extract-text')) {
      if (mode === 'error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('ocr failed');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: 'MRP Rs. 45.00', lines: ['MRP Rs. 45.00'] }));
      return;
    }

    if (mode === 'error') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('model overloaded');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mode === 'sparse' ? SPARSE_RESPONSE : FULL_RESPONSE));
  });
});

let passed = 0;
const failures: string[] = [];

async function step(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(error as Error).message}`);
  }
}

async function main() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  process.env.AI_SERVICE_URL = `${base}/analyze`;
  process.env.AI_SERVICE_KEY = 'test-key-123';

  // Imported after the env vars are set, since the provider reads them lazily.
  const { HttpAIProvider } = await import('../src/lib/ai/http-provider');
  const provider = new HttpAIProvider();

  console.log('\nLegalMetrix — real AI model path test\n');

  await step('analyze posts the request to the configured endpoint with bearer auth', async () => {
    received.length = 0;
    const request = {
      inspectionId: 'ins-1',
      images: [{ id: 'img-1', url: '/api/images/img-1', side: 'FRONT', source: 'CAMERA' }],
      ruleSetVersion: 'LM-PC-2011',
    } as never;

    const response = await provider.analyze(request);

    assert.equal(received.length, 1, 'exactly one request must reach the model');
    assert.equal(received[0].path, '/analyze', `wrong path: ${received[0].path}`);
    assert.equal(received[0].auth, 'Bearer test-key-123', 'the API key must be sent as a bearer token');
    assert.deepEqual(received[0].body, request, 'the request payload must be forwarded verbatim');

    assert.equal(response.runId, 'run-real-1');
    assert.equal(response.processingStatus, 'COMPLETED');
    assert.equal(response.extractedFields.length, 1);
    assert.equal(response.extractedFields[0].rawText, 'MRP Rs. 45.00');
    assert.equal(response.extractedFields[0].confidence, 94);
    assert.equal(response.modelMetadata?.modelVersion, 'v1.2.3');
    assert.equal(response.modelMetadata?.processingTimeMs, 1200);
  });

  await step('a confident model finding overrides the rule engine placeholder', async () => {
    const { mergeFindings } = await import('../src/lib/ai/merge-findings');

    // What the rule engine produces with no extraction to work from: confidence 0, REVIEW.
    const ruleFindings: Finding[] = [
      {
        id: 'f-1',
        inspectionId: 'ins-1',
        declarationType: 'MRP',
        title: 'MRP declaration',
        description: 'Retail sale price must be declared.',
        status: 'REVIEW',
        severity: 'CRITICAL',
        confidence: 0,
        ruleId: 'rule-1',
        ruleCode: 'LM-PC-2011-6(1)(e)',
        legalReference: 'Rule 6(1)(e)',
        evidence: [],
        reviewStatus: 'PENDING',
        createdAt: '2026-09-13T10:00:00.000Z',
      },
    ];

    // The same rule, answered by a real model that is confident in its reading.
    const modelFindings: Finding[] = [
      { ...ruleFindings[0], confidence: 94, detectedValue: '45.00' },
    ];

    const merged = mergeFindings(ruleFindings, modelFindings, 90);
    assert.equal(merged.length, 1, 'the merge must not duplicate or drop the finding');
    assert.equal(merged[0].confidence, 94, 'the confident model value must replace the 0 placeholder');
    assert.equal(merged[0].detectedValue, '45.00');
  });

  await step('a low-confidence model reading does not override the rule engine', async () => {
    const { mergeFindings } = await import('../src/lib/ai/merge-findings');

    const ruleFindings: Finding[] = [
      {
        id: 'f-1',
        inspectionId: 'ins-1',
        declarationType: 'MRP',
        title: 'MRP declaration',
        description: 'Retail sale price must be declared.',
        status: 'REVIEW',
        severity: 'CRITICAL',
        confidence: 0,
        ruleId: 'rule-1',
        ruleCode: 'LM-PC-2011-6(1)(e)',
        legalReference: 'Rule 6(1)(e)',
        evidence: [],
        reviewStatus: 'PENDING',
        createdAt: '2026-09-13T10:00:00.000Z',
      },
    ];
    const modelFindings: Finding[] = [{ ...ruleFindings[0], confidence: 40 }];

    // Below the threshold the model is guessing, so the finding must stay for a human.
    const merged = mergeFindings(ruleFindings, modelFindings, 90);
    assert.equal(merged[0].reviewStatus, 'PENDING', 'an uncertain reading must still go to review');
  });

  await step('the real extraction survives alongside the development placeholder', async () => {
    received.length = 0;
    const realResult = await provider.analyze({ inspectionId: 'ins-1', images: [] } as never);
    assert.equal(realResult.extractedFields.length, 1);
    assert.equal(realResult.extractedFields[0].normalizedValue, '45.00');
    assert.equal(realResult.runId, 'run-real-1');
  });

  await step('missing metadata fields are defaulted rather than left undefined', async () => {
    mode = 'sparse';
    received.length = 0;
    const response = await provider.analyze({ inspectionId: 'ins-1', images: [] } as never);
    assert.ok(Array.isArray(response.evidenceRegions), 'evidenceRegions must default to an array');
    assert.ok(Array.isArray(response.warnings), 'warnings must default to an array');
    assert.ok(response.modelMetadata, 'modelMetadata must be synthesised when the model omits it');
    assert.equal(response.modelMetadata?.provider, 'http');
    assert.ok(response.modelMetadata?.processedAt, 'processedAt must be filled in');
    mode = 'ok';
  });

  await step('a failing model surfaces its status and body instead of throwing it away', async () => {
    mode = 'error';
    await assert.rejects(
      () => provider.analyze({ inspectionId: 'ins-1', images: [] } as never),
      (error: Error) => {
        assert.match(error.message, /503/, 'the status code must be reported');
        assert.match(error.message, /model overloaded/, 'the model\'s message must be preserved');
        return true;
      },
      'a 503 from the model must reject'
    );
    mode = 'ok';
  });

  await step('an unconfigured provider refuses rather than guessing', async () => {
    const url = process.env.AI_SERVICE_URL;
    delete process.env.AI_SERVICE_URL;
    try {
      await assert.rejects(
        () => provider.analyze({ inspectionId: 'ins-1', images: [] } as never),
        /AI_SERVICE_URL is not configured/,
        'it must name the missing variable'
      );
    } finally {
      process.env.AI_SERVICE_URL = url;
    }
  });

  await step('healthCheck reports the model honestly', async () => {
    assert.equal(await provider.healthCheck(), true, 'a reachable model must report healthy');

    const url = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1/analyze';
    try {
      assert.equal(await provider.healthCheck(), false, 'an unreachable model must report unhealthy');
    } finally {
      process.env.AI_SERVICE_URL = url;
    }
  });

  await step('extractText posts the image url to the sibling /extract-text route', async () => {
    received.length = 0;
    const result = (await provider.extractText('/api/images/img-1')) as { text: string };
    assert.equal(received.length, 1);
    assert.equal(received[0].path, '/extract-text', `wrong path: ${received[0].path}`);
    assert.equal(received[0].auth, 'Bearer test-key-123', 'the API key must be sent here too');
    assert.deepEqual(received[0].body, { imageUrl: '/api/images/img-1' });
    assert.equal(result.text, 'MRP Rs. 45.00');
  });

  await step('extractText reports a failed model run', async () => {
    mode = 'error';
    try {
      await assert.rejects(
        () => provider.extractText('/api/images/img-1'),
        /500/,
        'the status must be reported'
      );
    } finally {
      mode = 'ok';
    }
  });

  await step('healthCheck probes /health, not the analyze endpoint', async () => {
    received.length = 0;
    await provider.healthCheck();
    assert.equal(received.length, 1);
    assert.equal(received[0].path, '/health', `wrong path: ${received[0].path}`);
    assert.equal(received[0].body, null, 'a health probe must not carry a body');
  });

  await step('the registry resolves the http provider and does not call it development', async () => {
    const { aiRegistry } = await import('../src/lib/ai/provider');
    const http = aiRegistry.get('http');
    assert.equal(http.constructor.name, 'HttpAIProvider');
    assert.equal(aiRegistry.isDevelopmentProvider('http'), false, 'it must not be flagged as development');

    // And the mock provider must still be flagged, so the UI can label a run as a placeholder.
    assert.equal(aiRegistry.isDevelopmentProvider('development'), true);
  });

  await step('AI_PROVIDER=mock is treated as the development placeholder', async () => {
    const { aiRegistry } = await import('../src/lib/ai/provider');
    assert.equal(aiRegistry.get('mock').constructor.name, 'MockAIProvider');
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
