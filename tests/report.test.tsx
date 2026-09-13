/**
 * Renders the real report detail page and exercises its PDF export.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/report.test.tsx
 *
 * This is the one UI path the other suites do not reach: `downloadPdf()` builds a
 * document with jsPDF and hands it to the browser. A crash here would be invisible
 * until an officer clicked the button.
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;

for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  try {
    Object.defineProperty(globalThis, key, {
      value: (window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  } catch {
    /* not configurable */
  }
}
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true });

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
for (const target of [window as unknown as typeof globalThis, globalThis]) {
  Object.defineProperty(target, 'ResizeObserver', { value: ResizeObserverStub, configurable: true });
}
Object.defineProperty(window, 'print', { configurable: true, writable: true, value: () => {} });

/**
 * jsdom has no download plumbing, so jsPDF's `save()` silently does nothing here (it
 * returns without ever creating an object URL). The page's own work — every `line()`
 * call, the findings loop, the page breaks — all happens before `save()`, so capture
 * the document at that boundary and inspect the real PDF bytes.
 */
const savedPdfs: { filename: string; bytes: Buffer }[] = [];

/* ------------------------------------------------------------- fixture */

const INSPECTION = {
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
  status: 'NON_COMPLIANT' as const,
  source: 'FIELD' as const,
  images: [
    {
      id: 'img-1',
      inspectionId: 'ins-1',
      side: 'FRONT' as const,
      url: '/api/images/img-1',
      originalName: 'front.jpg',
      size: 204800,
      mimeType: 'image/jpeg',
      width: 1280,
      height: 720,
      source: 'CAMERA' as const,
      quality: { resolution: 720, brightness: 0.52, blurScore: 0.21 },
      uploadedAt: '2026-09-13T09:00:00.000Z',
    },
  ],
  startedAt: '2026-09-13T09:00:00.000Z',
  completedAt: '2026-09-13T09:02:00.000Z',
  aiRunId: 'run-test',
  aiProvider: 'development',
  aiModelVersion: '1.0.0',
  processingTimeMs: 142,
  ruleSetVersion: 'LM-PC-2011',
  rulesEvaluated: 1,
  complianceScore: 0,
  scored: true,
  confidenceSummary: { average: 42, min: 0, max: 84, lowConfidenceCount: 1 },
  findings: [
    {
      id: 'find-1',
      inspectionId: 'ins-1',
      declarationType: 'MRP',
      title: 'MRP declaration',
      description: 'Retail sale price must be declared inclusive of all taxes.',
      detectedValue: '₹99',
      expectedValue: 'Inclusive of all taxes',
      status: 'VIOLATION' as const,
      severity: 'CRITICAL' as const,
      confidence: 0,
      ruleId: 'rule-1',
      ruleCode: 'LM-PC-2011-6(1)(e)',
      legalReference: 'Rule 6(1)(e)',
      evidence: [{ imageId: 'img-1', boundingBox: { x: 0, y: 0, width: 0, height: 0 } }],
      reviewStatus: 'HUMAN_CONFIRMED' as const,
      correctedValue: '₹99 inclusive of taxes',
      reviewerId: 'user-2',
      reviewerName: 'Test Reviewer',
      reviewerComment: 'Declaration omits the tax wording.',
      reviewedAt: '2026-09-13T09:05:00.000Z',
      createdAt: '2026-09-13T09:02:00.000Z',
    },
  ],
  extractedFields: [],
  analysisNotes: ['No vision model is connected; findings were confirmed by a reviewer.'],
  reviewStatus: 'COMPLETED' as const,
  createdAt: '2026-09-13T09:00:00.000Z',
  updatedAt: '2026-09-13T09:05:00.000Z',
};

const REPORT = {
  id: 'rep-1',
  reportNumber: 'RPT-LM-2026-000001',
  inspectionId: 'ins-1',
  inspectionNumber: 'LM-2026-000001',
  productName: 'Test Packaged Rice',
  status: 'NON_COMPLIANT' as const,
  complianceScore: 0,
  generatedBy: 'user-1',
  generatedByName: 'Test Inspector',
  summary: 'One critical violation confirmed by review.',
  createdAt: '2026-09-13T09:10:00.000Z',
};

const AUDIT_TRAIL = [
  {
    id: 'log-1',
    userId: 'user-1',
    userName: 'Test Inspector',
    role: 'INSPECTOR',
    action: 'INSPECTION_CREATED',
    resource: 'INSPECTION',
    resourceId: 'ins-1',
    ip: '127.0.0.1',
    timestamp: '2026-09-13T09:00:00.000Z',
  },
  {
    id: 'log-2',
    userId: 'user-2',
    userName: 'Test Reviewer',
    role: 'REVIEWER',
    action: 'FINDING_REVIEWED',
    resource: 'FINDING',
    resourceId: 'find-1',
    oldValue: { status: 'REVIEW' },
    newValue: { status: 'VIOLATION' },
    ip: '127.0.0.1',
    timestamp: '2026-09-13T09:05:00.000Z',
  },
  {
    id: 'log-3',
    userId: 'user-1',
    userName: 'Test Inspector',
    role: 'INSPECTOR',
    action: 'REPORT_GENERATED',
    resource: 'REPORT',
    resourceId: 'rep-1',
    ip: '127.0.0.1',
    timestamp: '2026-09-13T09:10:00.000Z',
  },
];

let payload: unknown = { report: REPORT, inspection: INSPECTION, auditTrail: AUDIT_TRAIL };

async function mockFetch(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body = url.includes('/api/reports/') ? payload : {};
  return new Response(JSON.stringify({ success: true, data: body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

// `useParams` needs the App Router context; supply the route parameter directly.
/**
 * jsdom has no download plumbing: jsPDF's `save()` resolves to nothing here, and
 * `save` lives on each instance rather than on the prototype, so it cannot be patched
 * in place. Intercept the module and give the page a subclass whose `save()` hands us
 * the finished document. Everything the page itself does — the layout, the findings
 * loop, the page breaks — runs for real before that point.
 */
const { jsPDF: RealJsPDF } = Module.createRequire(import.meta.url)('jspdf') as {
  jsPDF: new (...args: unknown[]) => { output: (type: string) => ArrayBuffer; save: (name: string) => unknown };
};

/**
 * jsPDF's constructor returns its own internal API object, so subclassing it would
 * silently discard any override. Build a real document and swap `save` on the instance
 * instead — the returned object is what `new` hands back.
 */
type JsPdfDoc = { output: (type: string) => ArrayBuffer; save: (name: string) => unknown };
function ObservableJsPDF(this: unknown, ...args: unknown[]) {
  const doc = new RealJsPDF(...args) as JsPdfDoc;
  doc.save = (filename: string) => {
    savedPdfs.push({ filename, bytes: Buffer.from(doc.output('arraybuffer')) });
  };
  return doc;
}

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function load(request: string, ...rest: unknown[]) {
  if (request === 'next/navigation') {
    return {
      useParams: () => ({ reportId: 'rep-1' }),
      usePathname: () => '/app/reports/rep-1',
      useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
    };
  }
  if (request === 'jspdf') {
    return { jsPDF: ObservableJsPDF, default: { jsPDF: ObservableJsPDF } };
  }
  return originalLoad.call(this, request, ...rest);
};

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

function body() {
  return document.body.textContent || '';
}

async function main() {
  const { render, screen, waitFor, cleanup, fireEvent } = await import('@testing-library/react');

  async function renderReport() {
    cleanup();
    savedPdfs.length = 0;
    const page = (await import('../src/app/app/reports/[reportId]/page')).default;
    render(React.createElement(page));
    await screen.findByText('Compliance Inspection Report', undefined, { timeout: 8000 });
  }

  console.log('\nLegalMetrix — report page and PDF export test (jsdom)\n');

  await step('the report page renders the real inspection it belongs to', async () => {
    await renderReport();
    const text = body();
    assert.ok(text.includes(REPORT.reportNumber), 'the report number must be shown');
    assert.ok(text.includes(INSPECTION.inspectionNumber), 'the inspection number must be shown');
    assert.ok(text.includes(INSPECTION.productName), 'the product name must be shown');
    assert.ok(text.includes(INSPECTION.brand), 'the brand must be shown');
    assert.ok(text.includes('Rule set'), 'the rule set version must be shown');
    assert.ok(text.includes(INSPECTION.ruleSetVersion));
    assert.ok(text.includes('0/100'), 'the compliance score must be shown');
  });

  await step('findings are rendered with rule, severity, confidence and review', async () => {
    await renderReport();
    const text = body();
    assert.ok(text.includes('MRP declaration'), 'the finding title must be shown');
    assert.ok(text.includes('LM-PC-2011-6(1)(e)'), 'the rule code must be shown');
    assert.ok(text.includes('Confidence 0%'), 'confidence must be shown, including zero');
    assert.ok(text.includes('Detected: ₹99'), 'the detected value must be shown');
    assert.ok(text.includes('Corrected: ₹99 inclusive of taxes'), 'the corrected value must be shown');
    assert.ok(text.includes('Reviewed by Test Reviewer'), 'the reviewer must be credited');
  });

  await step('the audit trail is displayed', async () => {
    await renderReport();
    const text = body();
    assert.ok(text.includes('Audit trail'));
    // The page renders the action with underscores as spaces, lower-cased.
    assert.ok(text.includes('inspection created'), 'INSPECTION_CREATED must be rendered readably');
    assert.ok(text.includes('finding reviewed'), 'FINDING_REVIEWED must be rendered readably');
    assert.ok(text.includes('report generated'), 'REPORT_GENERATED must be rendered readably');
    assert.ok(text.includes('Test Reviewer'), 'the acting user must be named');
    assert.ok(!text.includes('—  ·'), 'audit timestamps must not render as empty');
  });

  await step('the analysis note explains why findings needed a human', async () => {
    await renderReport();
    assert.ok(body().includes('No vision model is connected; findings were confirmed by a reviewer.'));
  });

  await step('Download PDF builds a real PDF document', async () => {
    await renderReport();
    const button = screen.getByText('Download PDF').closest('button') as HTMLButtonElement;
    assert.ok(button && !button.disabled, 'the export button must be enabled once the report is loaded');
    fireEvent.click(button);

    await waitFor(() => assert.ok(savedPdfs.length > 0, 'the page must produce a PDF'), { timeout: 8000 });
    assert.equal(savedPdfs.length, 1, 'exactly one PDF should be produced per click');

    const { filename, bytes } = savedPdfs[0];
    assert.equal(filename, `${REPORT.reportNumber}.pdf`, 'the file must be named after the report');
    assert.ok(bytes.length > 1000, `the PDF should have real content, got ${bytes.length} bytes`);
    assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', 'the file must start with the PDF magic header');
    assert.ok(bytes.subarray(-1024).toString('latin1').includes('%%EOF'), 'the PDF must be terminated correctly');
  });

  await step('the PDF carries the inspection facts', async () => {
    await renderReport();
    fireEvent.click(screen.getByText('Download PDF').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.ok(savedPdfs.length > 0), { timeout: 8000 });
    // jsPDF writes text uncompressed, but escapes ( and ) inside string literals, so
    // unescape before comparing against the values the page was given.
    const text = savedPdfs[0].bytes.toString('latin1').replace(/\\([()\\])/g, '$1');
    assert.ok(text.includes('Compliance Inspection Report'), 'the PDF must contain its title');
    assert.ok(text.includes(INSPECTION.productName), 'the PDF must name the product');
    assert.ok(text.includes(INSPECTION.inspectionNumber), 'the PDF must carry the inspection number');
    assert.ok(text.includes('LM-PC-2011-6(1)(e)'), 'the PDF must cite the violated rule');
    assert.ok(text.includes('Test Reviewer'), 'the PDF must credit the reviewer who confirmed the finding');
  });

  await step('a report whose inspection is missing says so instead of exporting', async () => {
    payload = { report: REPORT, inspection: null, auditTrail: [] };
    await renderReport();
    assert.ok(body().includes('The inspection record for this report is no longer available.'));
    const button = screen.getByText('Download PDF').closest('button') as HTMLButtonElement;
    assert.ok(button.disabled, 'export must be disabled when there is no inspection to export');
    payload = { report: REPORT, inspection: INSPECTION, auditTrail: AUDIT_TRAIL };
  });

  await step('a missing report shows an empty state rather than crashing', async () => {
    cleanup();
    payload = null;
    const page = (await import('../src/app/app/reports/[reportId]/page')).default;
    render(React.createElement(page));
    await screen.findByText('Report not found', undefined, { timeout: 8000 });
    assert.ok(body().includes('This report could not be located.'));
    payload = { report: REPORT, inspection: INSPECTION, auditTrail: AUDIT_TRAIL };
  });

  (Module as unknown as { _load: Function })._load = originalLoad;

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
