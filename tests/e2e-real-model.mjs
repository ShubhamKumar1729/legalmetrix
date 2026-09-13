/**
 * The real vision model, end to end.
 *
 *   node tests/e2e-real-model.mjs
 *
 * test:aimodel exercises HttpAIProvider in isolation. This drives an actual
 * inspection through POST /api/inspections/:id/analyze with AI_PROVIDER=http,
 * against a stub vision model running on a local socket, and asserts on what
 * gets stored — the part no other suite reaches.
 *
 * It boots its own app server and its own stub model, so it needs a build but
 * no other server:  NEXT_DIST_DIR=.next-e2e npm run build
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { makePng } from './helpers/png.mjs';

const APP_PORT = Number(process.env.REAL_MODEL_APP_PORT || 3200);
const BASE = `http://127.0.0.1:${APP_PORT}`;
const MODEL_VERSION = 'stub-vision-2.4.0';
const RUN_ID = 'run-stub-9f3c';
const EMAIL = 'bootstrap.admin@example.test';
const PASSWORD = 'Bootstrap-Password-123';

let passed = 0;
const failures = [];

async function step(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

/* --------------------------------------------------------------- stub model */

/** What the model actually received, so the wire contract can be asserted. */
const modelCalls = [];
let modelMode = 'ok';

function startStubModel() {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const path = req.url || '';
      modelCalls.push({
        path,
        auth: req.headers.authorization ?? null,
        body: raw ? JSON.parse(raw) : null,
      });

      if (path.endsWith('/health')) {
        res.writeHead(modelMode === 'down' ? 503 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (modelMode === 'down') {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('model unavailable');
        return;
      }

      // Echo the real image id back as evidence, proving the request carried it.
      const request = raw ? JSON.parse(raw) : {};
      const imageId = request.imageIds?.[0] || 'unknown';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          inspectionId: request.inspectionId,
          runId: RUN_ID,
          processingStatus: 'COMPLETED',
          stages: [],
          extractedFields: [
            {
              id: 'field-mrp',
              fieldName: 'mrp',
              value: 'Rs. 45.00',
              normalizedValue: '45.00',
              rawText: 'MRP Rs. 45.00 (Incl. of all taxes)',
              language: 'en',
              script: 'Latin',
              confidence: 96,
              sourceImageId: imageId,
              boundingBox: { x: 84, y: 310, width: 260, height: 42 },
              status: 'PASS',
              editable: true,
              reviewStatus: 'AI_CONFIRMED',
              ruleCode: 'LM-PC-2011-6(1)(e)',
            },
          ],
          findings: [],
          confidence: { average: 96, min: 96, max: 96 },
          evidenceRegions: [],
          warnings: ['Stub model: currency symbol inferred from context.'],
          modelMetadata: {
            provider: 'http',
            modelName: 'StubVision',
            modelVersion: MODEL_VERSION,
            processedAt: new Date().toISOString(),
            processingTimeMs: 842,
          },
        })
      );
    });
  });

  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* -------------------------------------------------------------- app server */

function startApp(modelUrl) {
  const child = spawn(
    'npx',
    ['next', 'start', '-p', String(APP_PORT), '-H', '0.0.0.0'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_DIST_DIR: '.next-e2e',
        AI_PROVIDER: 'http',
        AI_SERVICE_URL: modelUrl,
        AI_SERVICE_KEY: 'stub-model-key',
        BOOTSTRAP_ADMIN_EMAIL: EMAIL,
        BOOTSTRAP_ADMIN_PASSWORD: PASSWORD,
        AUTH_SECRET: 'real-model-test-secret',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      // Own process group: `npx` re-execs into next-server, so killing the wrapper
      // alone would leave the real server holding the port for the next run.
      detached: true,
    }
  );
  // Keep the tail: when the server never comes up this is the only evidence of why.
  child.output = '';
  const capture = (chunk) => {
    child.output = (child.output + chunk.toString()).slice(-4000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return child;
}

/** Fail immediately, with the fix, instead of timing out after 30 seconds. */
function assertBuildExists() {
  if (!existsSync('.next-e2e/BUILD_ID')) {
    throw new Error(
      'no production build in .next-e2e — run: NEXT_DIST_DIR=.next-e2e npm run build'
    );
  }
}

async function waitForApp(app) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (app.exitCode !== null) {
      throw new Error(`the app server exited (${app.exitCode}) while starting:\n${app.output}`);
    }
    try {
      const res = await fetch(`${BASE}/api/auth/status`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`the app server never became ready:\n${app.output}`);
}

/* ------------------------------------------------------------------- client */

let cookie = '';

async function call(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body && !raw) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length > 0) cookie = setCookie.map((entry) => entry.split(';')[0]).join('; ');

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { status: res.status, body: payload };
}

/* ---------------------------------------------------------------------- run */

async function main() {
  console.log(`\nLegalMetrix — real vision model, end to end (${BASE})\n`);

  try {
    const probe = await fetch(`${BASE}/api/auth/status`, { signal: AbortSignal.timeout(1500) });
    throw new Error(`port ${APP_PORT} is already serving (got ${probe.status}) — stop it or set REAL_MODEL_APP_PORT`);
  } catch (error) {
    if (error.message.startsWith('port ')) throw error;
  }

  assertBuildExists();

  const model = await startStubModel();
  const modelUrl = `http://127.0.0.1:${model.address().port}/analyze`;
  const app = startApp(modelUrl);

  const shutdown = () => {
    try {
      // Negative pid signals the whole group (npx -> sh -> next-server).
      process.kill(-app.pid, 'SIGKILL');
    } catch {
      app.kill('SIGKILL');
    }
    model.close();
  };
  process.on('exit', shutdown);

  let inspectionId = '';

  try {
    await waitForApp(app);

    await step('the administrator signs in', async () => {
      const res = await call('/api/auth/login', {
        method: 'POST',
        body: { email: EMAIL, password: PASSWORD },
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.user.email, EMAIL);
    });

    await step('a rule is published for the field the model reads', async () => {
      const res = await call('/api/rules', {
        method: 'POST',
        body: {
          ruleCode: 'LM-PC-2011-6(1)(e)-rm',
          title: 'MRP declaration',
          description: 'Retail sale price declared inclusive of all taxes',
          legalReference: 'Rule 6(1)(e)',
          category: 'MRP',
          severity: 'CRITICAL',
          validationLogic: { field: 'mrp', operator: 'exists' },
          status: 'PUBLISHED',
        },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
    });

    let image;
    await step('a real image is uploaded', async () => {
      const form = new FormData();
      form.append('image', new Blob([makePng(900, 640)], { type: 'image/png' }), 'front.png');
      form.append('side', 'FRONT');
      form.append('source', 'CAMERA');
      const res = await call('/api/images', { method: 'POST', body: form, raw: true });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      image = res.body.data;
    });

    await step('an inspection is created from it', async () => {
      const res = await call('/api/inspections', {
        method: 'POST',
        body: {
          productName: 'Real Model Commodity',
          brand: 'Real Brand',
          category: 'FOOD',
          manufacturer: 'Real Manufacturer Pvt Ltd',
          images: [
            {
              id: image.id,
              side: 'FRONT',
              originalName: image.originalName,
              size: image.size,
              width: image.width,
              height: image.height,
              source: image.source,
              quality: image.quality,
            },
          ],
          source: 'FIELD',
        },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      inspectionId = res.body.data.id;
    });

    await step('analyze calls the configured model over HTTP with bearer auth', async () => {
      modelCalls.length = 0;
      const res = await call(`/api/inspections/${inspectionId}/analyze`, { method: 'POST' });
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const analyzeCalls = modelCalls.filter((entry) => entry.path.endsWith('/analyze'));
      assert.equal(analyzeCalls.length, 1, `expected one analyze call, got ${analyzeCalls.length}`);
      assert.equal(analyzeCalls[0].auth, 'Bearer stub-model-key', 'the API key must reach the model');
      assert.equal(analyzeCalls[0].body.inspectionId, inspectionId);
      assert.deepEqual(analyzeCalls[0].body.imageIds, [image.id], 'the real image id must be sent');
      assert.ok(analyzeCalls[0].body.imageUrls.length === 1, 'image urls must be sent');
      assert.equal(analyzeCalls[0].body.productMetadata.brand, 'Real Brand');
    });

    let stored;
    await step('the inspection records which model produced the result', async () => {
      const res = await call(`/api/inspections/${inspectionId}`);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      stored = res.body.data;

      assert.equal(stored.aiProvider, 'http', 'the provider must be the real model, not development');
      assert.equal(stored.aiModelVersion, MODEL_VERSION);
      assert.equal(stored.aiRunId, RUN_ID);
      assert.equal(stored.processingTimeMs, 842);
    });

    await step("the model's extraction is stored against the real image", async () => {
      assert.equal(stored.extractedFields.length, 1, 'the extraction must be persisted');
      const field = stored.extractedFields[0];
      assert.equal(field.fieldName, 'mrp');
      assert.equal(field.value, 'Rs. 45.00');
      assert.equal(field.confidence, 96);
      assert.equal(field.sourceImageId, image.id, 'evidence must point at the uploaded image');
    });

    await step('a confident reading passes the rule instead of going to review', async () => {
      assert.equal(stored.findings.length, 1);
      const finding = stored.findings[0];
      assert.equal(finding.status, 'PASS', `expected PASS, got ${finding.status}`);
      assert.equal(finding.reviewStatus, 'AI_CONFIRMED');
      assert.equal(finding.confidence, 96, 'the model confidence must replace the 0 placeholder');
      assert.equal(finding.detectedValue, 'Rs. 45.00');
      assert.equal(finding.evidence.length, 1, 'the finding must carry model evidence');
    });

    await step('the inspection is scored compliant with nothing left for a human', async () => {
      assert.equal(stored.scored, true);
      assert.equal(stored.complianceScore, 100);
      assert.equal(stored.status, 'COMPLIANT');
      assert.equal(stored.reviewStatus, 'NOT_REQUIRED');
    });

    await step('the result does not claim to be running without a model', async () => {
      const notes = (stored.analysisNotes || []).join(' ');
      assert.ok(
        !/without a vision model/i.test(notes),
        `the development disclaimer must not appear on a real-model run: ${notes}`
      );
      assert.ok(
        notes.includes('Stub model: currency symbol inferred from context.'),
        "the model's own warnings must be surfaced"
      );
    });

    await step('a failing model leaves the inspection recoverable, not half-scored', async () => {
      modelMode = 'down';
      const draft = await call('/api/inspections', {
        method: 'POST',
        body: {
          productName: 'Failure Case Commodity',
          brand: 'Real Brand',
          category: 'FOOD',
          manufacturer: 'Real Manufacturer Pvt Ltd',
          images: [
            {
              id: image.id,
              side: 'FRONT',
              originalName: image.originalName,
              size: image.size,
              width: image.width,
              height: image.height,
              source: image.source,
              quality: image.quality,
            },
          ],
          source: 'FIELD',
        },
      });
      assert.equal(draft.status, 201, JSON.stringify(draft.body));

      const res = await call(`/api/inspections/${draft.body.data.id}/analyze`, { method: 'POST' });
      assert.equal(res.status, 500, `expected 500, got ${res.status}`);
      assert.match(res.body.error.message, /Analysis failed/, 'the error must be reported to the caller');

      const after = await call(`/api/inspections/${draft.body.data.id}`);
      assert.equal(after.body.data.status, 'DRAFT', 'a failed run must revert, not stick at PROCESSING');
      assert.match(after.body.data.analysisNotes.join(' '), /Analysis failed/);
      assert.ok(/503/.test(after.body.data.analysisNotes.join(' ')), 'the model status must be reported');
      modelMode = 'ok';
    });
  } finally {
    shutdown();
  }

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
