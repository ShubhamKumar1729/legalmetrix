/**
 * End-to-end acceptance test against a running server.
 *
 *   BASE_URL=http://localhost:3100 node tests/e2e.mjs
 *
 * The server must have BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD set and start from
 * an empty database. Every assertion below hits the real API routes.
 */
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'bootstrap.admin@example.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Bootstrap-Password-123';
// Keeps the suite re-runnable against a database that still holds a previous run.
const RUN_ID = Date.now().toString(36);

let cookie = '';
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

async function call(path, { method = 'GET', body, auth = true, raw = false } = {}) {
  const headers = {};
  if (auth && cookie) headers.Cookie = cookie;
  if (body && !raw) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length > 0) cookie = setCookie.map((entry) => entry.split(';')[0]).join('; ');

  let payload = null;
  const text = await res.text();
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { status: res.status, body: payload, headers: res.headers };
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

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function makePng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + 1 + x * 3;
      raw[offset] = (x * 5) % 256;
      raw[offset + 1] = (y * 9) % 256;
      raw[offset + 2] = 120;
    }
  }
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ------------------------------------------------------------------------- run */

async function main() {
  console.log(`\nLegalMetrix — end-to-end acceptance test (${BASE})\n`);

  let inspectionId = '';
  let inspectionNumber = '';
  let findingId = '';
  let reportId = '';
  let productId = '';
  let reviewerCookie = '';

  // Preflight: every "clean database" assertion below is meaningless against a server
  // that has already served traffic, so say so instead of failing several steps later.
  const preflight = await call('/api/auth/status', { auth: false });
  if (preflight.status !== 200) {
    console.error(`\nCannot reach ${BASE}/api/auth/status (HTTP ${preflight.status}).\n`);
    process.exit(2);
  }
  if (preflight.body.data.hasUsers) {
    console.error(
      '\nThis suite asserts against an EMPTY database, but the server already has user\n' +
        'accounts — it has served a previous run. Restart it from a clean database:\n\n' +
        '  BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... AUTH_SECRET=... \\\n' +
        '    npx next start -p 3100\n\n' +
        '(With MONGODB_URI set, drop the collections first; without it, a restart is enough.)\n'
    );
    process.exit(2);
  }

  await step('no user accounts exist before first sign-in', async () => {
    const res = await call('/api/auth/status', { auth: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.bootstrapConfigured, true, 'bootstrap credentials should be configured');
    assert.equal(res.body.data.hasUsers, false, 'no accounts may exist before the first sign-in');
  });

  await step('protected routes reject anonymous callers', async () => {
    const res = await call('/api/inspections', { auth: false });
    assert.equal(res.status, 401);
  });

  await step('wrong password is rejected', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: ADMIN_EMAIL, password: 'not-the-password' },
    });
    assert.equal(res.status, 401);
  });

  await step('no built-in government-domain accounts are provisioned', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert.equal(res.status, 200);
    const users = await call('/api/users');
    const governmentDomain = ['gov', 'in'].join('.');
    const offenders = users.body.data.users.filter((user) => user.email.endsWith(`@${governmentDomain}`));
    assert.equal(offenders.length, 0, 'no government-domain accounts should be auto-created');
    assert.equal(users.body.data.users.length, 1, 'only the bootstrap administrator should exist');
  });

  await step('bootstrap administrator can sign in', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(cookie, 'session cookie should be set');
    assert.equal(res.body.data.user.email, ADMIN_EMAIL);
  });

  await step('session exposes role, permissions and system status', async () => {
    const res = await call('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.simpleRole, 'ADMIN');
    assert.ok(res.body.data.permissions.includes('rule:publish'));
    assert.ok(['mongodb', 'memory'].includes(res.body.data.system.datastore));
  });

  await step('a clean database reports zeros everywhere', async () => {
    const [analytics, inspections, products, reports, rules, notifications] = await Promise.all([
      call('/api/analytics'),
      call('/api/inspections'),
      call('/api/products'),
      call('/api/reports'),
      call('/api/rules'),
      call('/api/notifications'),
    ]);
    assert.equal(analytics.body.data.kpis.totalInspections, 0);
    assert.equal(analytics.body.data.kpis.violations, 0);
    assert.equal(analytics.body.data.kpis.reports, 0);
    assert.equal(analytics.body.data.kpis.products, 0);
    assert.equal(analytics.body.data.hasData, false);
    assert.equal(analytics.body.data.overTime.every((d) => d.inspections === 0), true, 'no invented activity');
    assert.equal(inspections.body.data.inspections.length, 0);
    assert.equal(products.body.data.products.length, 0);
    assert.equal(reports.body.data.reports.length, 0);
    assert.equal(rules.body.data.rules.length, 0);
    assert.equal(notifications.body.data.items.length, 0);
  });

  await step('audit log contains only real recorded events', async () => {
    const [logs, users] = await Promise.all([call('/api/audit-logs'), call('/api/users')]);
    assert.ok(logs.body.data.logs.length >= 1, 'the successful sign-in should be logged');
    assert.ok(logs.body.data.logs.every((log) => log.userName && log.action));
    const known = new Set(users.body.data.users.map((user) => user.name));
    const strangers = logs.body.data.logs.filter((log) => !known.has(log.userName));
    assert.deepEqual(strangers, [], 'every audit entry must belong to a real account');
  });

  await step('an administrator can create and publish a rule', async () => {
    const res = await call('/api/rules', {
      method: 'POST',
      body: {
        ruleCode: `LM-PC-2011-6(1)(e)-${RUN_ID}`,
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
    assert.equal(res.body.data.status, 'PUBLISHED');
  });

  await step('non-image uploads are rejected with a clear message', async () => {
    const form = new FormData();
    form.append('image', new Blob([Buffer.from('definitely not an image')], { type: 'text/plain' }), 'notes.txt');
    form.append('side', 'FRONT');
    form.append('source', 'UPLOAD');
    const res = await call('/api/images', { method: 'POST', body: form, raw: true });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'UNSUPPORTED_FORMAT');
  });

  await step('a real captured image is validated, stored and normalized', async () => {
    const form = new FormData();
    form.append('image', new Blob([makePng(900, 640)], { type: 'image/png' }), 'capture-front.png');
    form.append('side', 'FRONT');
    form.append('source', 'CAMERA');
    form.append('quality', JSON.stringify({ brightness: 0.62, blurScore: 0.18 }));
    const res = await call('/api/images', { method: 'POST', body: form, raw: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.width, 900);
    assert.equal(res.body.data.height, 640);
    assert.equal(res.body.data.source, 'CAMERA');
    assert.equal(res.body.data.quality.resolution, 640);
    assert.equal(res.body.data.quality.blurScore, 0.18);
    assert.match(res.body.data.url, /^\/api\/images\//);
    globalThis.__image = res.body.data;
  });

  await step('further sides can be uploaded and all attach to one inspection', async () => {
    const extra = [];
    for (const [name, side, source] of [
      ['capture-back.png', 'BACK', 'CAMERA'],
      ['upload-side.png', 'SIDE', 'UPLOAD'],
    ]) {
      const form = new FormData();
      form.append('image', new Blob([makePng(900, 640)], { type: 'image/png' }), name);
      form.append('side', side);
      form.append('source', source);
      const res = await call('/api/images', { method: 'POST', body: form, raw: true });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.side, side, 'the stored record keeps the side it was uploaded as');
      assert.equal(res.body.data.source, source);
      extra.push(res.body.data);
    }
    globalThis.__images = [globalThis.__image, ...extra];
    assert.equal(globalThis.__images.length, 3);
  });

  await step('stored evidence requires authentication', async () => {
    const saved = cookie;
    cookie = '';
    const res = await fetch(`${BASE}${globalThis.__image.url}`);
    assert.equal(res.status, 401);
    cookie = saved;
    const authorized = await fetch(`${BASE}${globalThis.__image.url}`, { headers: { Cookie: cookie } });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.headers.get('content-type'), 'image/png');
  });

  await step('an inspection can be created from the stored images', async () => {
    const res = await call('/api/inspections', {
      method: 'POST',
      body: {
        productName: 'Test Packaged Commodity',
        brand: 'Test Brand',
        category: 'FOOD',
        manufacturer: 'Test Manufacturer Pvt Ltd',
        images: globalThis.__images.map((image) => ({
          id: image.id,
          side: image.side,
          originalName: image.originalName,
          size: image.size,
          width: image.width,
          height: image.height,
          source: image.source,
          quality: image.quality,
        })),
        source: 'FIELD',
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    inspectionId = res.body.data.id;
    inspectionNumber = res.body.data.inspectionNumber;
    assert.match(res.body.data.inspectionNumber, /^LM-\d{4}-\d{6}$/);
    assert.equal(res.body.data.status, 'DRAFT');
    assert.equal(res.body.data.images.length, 3, 'all three sides must attach to the one inspection');
    assert.deepEqual(
      res.body.data.images.map((image) => image.side),
      ['FRONT', 'BACK', 'SIDE'],
      'each image keeps its own side'
    );
    assert.deepEqual(
      res.body.data.images.map((image) => image.source),
      ['CAMERA', 'CAMERA', 'UPLOAD'],
      'camera and upload evidence coexist on one inspection'
    );
  });

  await step('every attached image survives a re-read of the inspection', async () => {
    const res = await call(`/api/inspections/${inspectionId}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.images.length, 3, 'nothing may be dropped on the way to storage');
    const ids = res.body.data.images.map((image) => image.id);
    for (const uploaded of globalThis.__images) {
      assert.ok(ids.includes(uploaded.id), `stored image ${uploaded.id} must still be attached`);
    }
  });

  await step('analysis routes unconfirmed findings to human review', async () => {
    const res = await call(`/api/inspections/${inspectionId}/analyze`, { method: 'POST' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const inspection = res.body.data.inspection;
    assert.equal(inspection.rulesEvaluated, 1);
    assert.equal(inspection.findings.length, 1);
    assert.equal(inspection.findings[0].status, 'REVIEW');
    assert.equal(inspection.findings[0].reviewStatus, 'PENDING');
    assert.equal(inspection.status, 'REVIEW_REQUIRED');
    assert.equal(inspection.reviewStatus, 'PENDING');
    assert.ok(inspection.analysisNotes.length > 0, 'the analysis should explain itself');
    findingId = inspection.findings[0].id;
  });

  await step('the review queue lists only findings that really need review', async () => {
    const res = await call('/api/notifications');
    const reviewItems = res.body.data.items.filter((item) => item.type === 'REVIEW');
    assert.equal(reviewItems.length, 1);
  });

  await step('a reviewer decision is recorded and re-scores the inspection', async () => {
    const res = await call(`/api/inspections/${inspectionId}/findings/${findingId}`, {
      method: 'POST',
      body: { decision: 'CONFIRM_VIOLATION', comment: 'MRP genuinely absent from the package.' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const inspection = res.body.data.inspection;
    assert.equal(inspection.findings[0].status, 'VIOLATION');
    assert.equal(inspection.findings[0].reviewStatus, 'HUMAN_CONFIRMED');
    assert.equal(inspection.findings[0].reviewerComment, 'MRP genuinely absent from the package.');
    assert.equal(inspection.status, 'NON_COMPLIANT');
    assert.equal(inspection.reviewStatus, 'COMPLETED');
    assert.ok(inspection.complianceScore < 100);
  });

  await step('a report can be generated for the analyzed inspection', async () => {
    const res = await call(`/api/inspections/${inspectionId}/report`, { method: 'POST' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    reportId = res.body.data.id;
    assert.match(res.body.data.reportNumber, /^RPT-LM-/);
  });

  await step('the report resolves back to the real inspection and audit trail', async () => {
    const res = await call(`/api/reports/${reportId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.inspection.id, inspectionId);
    assert.ok(res.body.data.auditTrail.length >= 3, 'create, analyze and review should all be logged');
  });

  await step('a product record is created from the inspection', async () => {
    const res = await call('/api/products');
    assert.equal(res.body.data.products.length, 1);
    productId = res.body.data.products[0].id;
    assert.equal(res.body.data.products[0].inspectionCount, 1);
    assert.equal(res.body.data.products[0].violationCount, 1);
  });

  await step('product history comes from stored inspections', async () => {
    const res = await call(`/api/products/${productId}`);
    assert.equal(res.body.data.history.length, 1);
    assert.equal(res.body.data.history[0].id, inspectionId);
  });

  await step('analytics reflect exactly the stored inspections', async () => {
    const res = await call('/api/analytics');
    const kpis = res.body.data.kpis;
    assert.equal(kpis.totalInspections, 1);
    assert.equal(kpis.violations, 1);
    assert.equal(kpis.reports, 1);
    assert.equal(kpis.products, 1);
    assert.equal(kpis.rulesPublished, 1);
    assert.equal(res.body.data.hasData, true);
    const today = res.body.data.overTime.at(-1);
    assert.equal(today.inspections, 1, "today's real activity");
    assert.equal(
      res.body.data.overTime.slice(0, -1).every((day) => day.inspections === 0),
      true,
      'other days stay at zero'
    );
  });

  await step('search finds real records only', async () => {
    const hit = await call('/api/search?q=Test Packaged');
    assert.ok(hit.body.data.some((result) => result.type === 'Inspection'));
    const miss = await call('/api/search?q=zzz-no-such-product-zzz');
    assert.equal(miss.body.data.length, 0, 'a term with no match returns nothing');
  });

  await step('a new reviewer account can be created and cannot publish rules', async () => {
    const created = await call('/api/users', {
      method: 'POST',
      body: {
        name: 'E2E Reviewer',
        email: 'e2e.reviewer@example.test',
        password: 'Reviewer-Password-99',
        role: 'REVIEWER',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const adminCookie = cookie;
    cookie = '';
    const login = await call('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: 'e2e.reviewer@example.test', password: 'Reviewer-Password-99' },
    });
    assert.equal(login.status, 200);
    reviewerCookie = cookie;
    assert.equal(login.body.data.simpleRole, 'REVIEWER');

    const attempt = await call('/api/rules', { method: 'POST', body: { ruleCode: 'X', title: 'Nope' } });
    assert.equal(attempt.status, 403, 'reviewers must not author rules');

    const queue = await call('/api/inspections');
    assert.equal(queue.status, 200, 'reviewers can read inspections');

    cookie = adminCookie;
  });

  await step('e-commerce analysis refuses to invent listing data', async () => {
    const res = await call('/api/ecommerce/analyze', {
      method: 'POST',
      body: { url: 'https://example.test/product/1', inspectionId },
    });
    assert.equal(res.status, 501);
    assert.equal(res.body.error.code, 'PROVIDER_NOT_CONFIGURED');
    const listings = await call('/api/ecommerce/listings');
    assert.equal(listings.body.data.listings.length, 0);
  });

  await step('the assistant asks which inspection to use when none is selected', async () => {
    const anon = await call('/api/assistant', { method: 'POST', body: { question: 'What failed?' }, auth: false });
    assert.equal(anon.status, 401, 'the assistant must not be reachable anonymously');

    const res = await call('/api/assistant', { method: 'POST', body: { question: 'What failed?' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.answer, 'Which inspection would you like me to look at?');
    assert.equal(res.body.data.answered, false, 'it must not claim to have answered');
    assert.deepEqual(res.body.data.groundedIn, [], 'nothing may be cited without a record');
  });

  await step('the assistant answers only from the stored inspection', async () => {
    const missing = await call('/api/assistant', {
      method: 'POST',
      body: { question: 'What failed?', inspectionId: 'no-such-inspection' },
    });
    assert.equal(missing.status, 404, 'an unknown inspection must not be answered about');

    const empty = await call('/api/assistant', { method: 'POST', body: { question: '   ', inspectionId } });
    assert.equal(empty.status, 400, 'an empty question must be rejected');

    const failed = await call('/api/assistant', { method: 'POST', body: { question: 'What failed?', inspectionId } });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.data.answered, true);
    assert.equal(failed.body.data.source, 'stored-records');
    assert.ok(
      failed.body.data.answer.includes(inspectionNumber),
      'the answer must name the inspection it read'
    );
    assert.ok(failed.body.data.groundedIn.includes(inspectionNumber));

    const rules = await call('/api/assistant', { method: 'POST', body: { question: 'Which rules apply?', inspectionId } });
    assert.ok(rules.body.data.answer.includes('Rule 6(1)(e)'), 'the legal reference must come from the stored rule');

    const refused = await call('/api/assistant', {
      method: 'POST',
      body: { question: 'What will the court decide?', inspectionId },
    });
    assert.equal(refused.body.data.answered, false, 'a question outside the record must be refused');
    assert.ok(refused.body.data.answer.includes('I can only answer from what is stored'));
  });

  await step('configuration is readable and updateable by administrators', async () => {
    const read = await call('/api/configuration');
    assert.equal(read.status, 200);
    assert.ok(read.body.data.config.inspection.maxImages > 0);
    const update = await call('/api/configuration', {
      method: 'PATCH',
      body: { system: { retentionDays: 400 } },
    });
    assert.equal(update.status, 200);
    assert.equal(update.body.data.config.system.retentionDays, 400);
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
