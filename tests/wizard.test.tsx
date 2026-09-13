/**
 * Drives the whole inspection wizard in a DOM: product → images → analysis → result →
 * report, capturing the package through the real CameraCapture component.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/wizard.test.tsx
 *
 * The API is stubbed, so this proves the wizard's own logic — validation, step
 * progression, how it submits images, and what it does with the analysis outcome.
 * The API contracts themselves are covered by tests/e2e.mjs.
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { Inspection } from '../src/types';
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

/* --------------------------------------------------- media and canvas */

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;

Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', { get: () => FRAME_WIDTH, configurable: true });
Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', { get: () => FRAME_HEIGHT, configurable: true });
window.HTMLMediaElement.prototype.play = function play() {
  return Promise.resolve();
};
window.HTMLMediaElement.prototype.load = function load() {};

(window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = function getContext() {
  return {
    drawImage: () => undefined,
    // Allocate only the region asked for — measureImageQuality downscales to 640px,
    // and returning a full-frame buffer here would scan 4x the pixels and exhaust memory.
    getImageData: (x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(Math.max(1, w * h * 4));
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (i / 4) % 256;
        data[i + 1] = 128;
        data[i + 2] = 200;
        data[i + 3] = 255;
      }
      return { data, width: w, height: h, x, y };
    },
    fillRect: () => undefined,
    clearRect: () => undefined,
  };
};
(window.HTMLCanvasElement.prototype as unknown as {
  toBlob: (callback: (blob: Blob | null) => void, type?: string) => void;
}).toBlob = function toBlob(callback: (blob: Blob | null) => void, type?: string) {
  callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: type || 'image/jpeg' }));
};

let objectUrlCount = 0;
for (const target of [URL, window.URL as unknown as typeof URL]) {
  Object.defineProperty(target, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => `blob:mock/${(objectUrlCount += 1)}`,
  });
  Object.defineProperty(target, 'revokeObjectURL', { configurable: true, writable: true, value: () => undefined });
}

class FakeImage {
  naturalWidth = FRAME_WIDTH;
  naturalHeight = FRAME_HEIGHT;
  width = FRAME_WIDTH;
  height = FRAME_HEIGHT;
  decoding = 'sync';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}
for (const target of [globalThis, window as unknown as typeof globalThis]) {
  Object.defineProperty(target, 'Image', { value: FakeImage, configurable: true });
}

const stoppedTracks: string[] = [];
function makeTrack(id: string) {
  return {
    kind: 'video',
    id,
    readyState: 'live',
    enabled: true,
    stop: () => {
      stoppedTracks.push(id);
    },
    getCapabilities: () => ({ facingMode: ['environment'] }),
    getSettings: () => ({ facingMode: 'environment' }),
    applyConstraints: async () => undefined,
  };
}
Object.defineProperty(window.navigator, 'mediaDevices', {
  configurable: true,
  value: {
    getUserMedia: async () => {
      const track = makeTrack(`track-${stoppedTracks.length + 1}`);
      return {
        id: 'stream-1',
        active: true,
        getTracks: () => [track],
        getVideoTracks: () => [track],
        getAudioTracks: () => [],
      } as unknown as MediaStream;
    },
    enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'cam-1' }] as unknown as MediaDeviceInfo[],
  },
});

/* ------------------------------------------------------------- API mock */

const INSPECTION = {
  id: 'ins-1',
  inspectionNumber: 'LM-2026-000001',
  productName: 'Test Packaged Rice',
  brand: '',
  category: 'FOOD',
  manufacturer: 'Test Foods Pvt Ltd',
  inspectorId: 'user-1',
  inspectorName: 'Test Inspector',
  status: 'REVIEW_REQUIRED' as const,
  source: 'FIELD' as const,
  images: [],
  startedAt: '2026-09-13T09:00:00.000Z',
  ruleSetVersion: 'LM-PC-2011',
  rulesEvaluated: 1,
  complianceScore: 0,
  scored: false,
  confidenceSummary: { average: 0, min: 0, max: 0, lowConfidenceCount: 1 },
  findings: [
    {
      id: 'find-1',
      inspectionId: 'ins-1',
      declarationType: 'MRP',
      title: 'MRP declaration',
      description: 'Retail sale price must be declared.',
      status: 'REVIEW' as const,
      severity: 'CRITICAL' as const,
      confidence: 0,
      ruleId: 'rule-1',
      ruleCode: 'LM-PC-2011-6(1)(e)',
      legalReference: 'Rule 6(1)(e)',
      evidence: [],
      reviewStatus: 'PENDING' as const,
      createdAt: '2026-09-13T09:02:00.000Z',
    },
  ],
  extractedFields: [],
  analysisNotes: ['No vision model is connected, so every rule needs human confirmation.'],
  reviewStatus: 'PENDING' as const,
  createdAt: '2026-09-13T09:00:00.000Z',
  updatedAt: '2026-09-13T09:02:00.000Z',
};

const REPORT = {
  id: 'rep-1',
  reportNumber: 'RPT-LM-2026-000001',
  inspectionId: 'ins-1',
  inspectionNumber: 'LM-2026-000001',
  productName: 'Test Packaged Rice',
  status: 'REVIEW_REQUIRED' as const,
  complianceScore: 0,
  generatedBy: 'user-1',
  generatedByName: 'Test Inspector',
  summary: 'One finding awaits review.',
  createdAt: '2026-09-13T09:10:00.000Z',
};

interface Call {
  method: string;
  url: string;
  body?: unknown;
}
const calls: Call[] = [];
let imageCounter = 0;
let analyzeFails = false;
/** What POST /api/inspections/:id/analyze returns; swapped to replay a resolved inspection. */
let analyzeResult: Inspection = INSPECTION;

async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const method = (init?.method || 'GET').toUpperCase();
  calls.push({ method, url: path, body: init?.body });

  const ok = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  const fail = (status: number, message: string, code = 'ERROR') =>
    new Response(JSON.stringify({ success: false, error: { code, message } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (path === '/api/images' && method === 'POST') {
    imageCounter += 1;
    return ok({
      id: `img-${imageCounter}`,
      side: 'FRONT',
      url: `/api/images/img-${imageCounter}`,
      originalName: `capture-${imageCounter}.jpg`,
      size: 184320,
      mimeType: 'image/jpeg',
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      source: 'CAMERA',
      quality: { resolution: FRAME_HEIGHT, brightness: 0.52, blurScore: 0.21 },
      uploadedAt: new Date().toISOString(),
    });
  }
  if (path === '/api/inspections' && method === 'POST') return ok(INSPECTION);
  if (path.endsWith('/analyze') && method === 'POST') {
    if (analyzeFails) return fail(500, 'The vision service did not respond.', 'ANALYSIS_FAILED');
    return ok({ inspection: analyzeResult });
  }
  if (path.endsWith('/report') && method === 'POST') return ok(REPORT);
  return ok({});
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

// The wizard only needs a router it can navigate with.
const navigated: string[] = [];
const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function load(request: string, ...rest: unknown[]) {
  if (request === 'next/navigation') {
    return {
      useRouter: () => ({
        push: (to: string) => {
          navigated.push(to);
        },
        replace: (to: string) => {
          navigated.push(to);
        },
        refresh: () => undefined,
      }),
      usePathname: () => '/app/inspections/new',
      useParams: () => ({}),
    };
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

function currentStep() {
  // The active step is the one rendered in bold.
  const active = Array.from(document.querySelectorAll('ol li span.text-sm')).find((node) =>
    node.className.includes('font-semibold')
  );
  return active?.textContent?.trim();
}

async function main() {
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');

  async function renderWizard() {
    cleanup();
    calls.length = 0;
    navigated.length = 0;
    imageCounter = 0;
    analyzeFails = false;
    analyzeResult = INSPECTION;
    const page = (await import('../src/app/app/inspections/new/page')).default;
    render(React.createElement(page));
    await screen.findByText('New Inspection', undefined, { timeout: 8000 });
  }

  async function fillProductForm() {
    fireEvent.change(screen.getByLabelText(/product name/i), { target: { value: 'Test Packaged Rice' } });
    fireEvent.change(screen.getByLabelText(/manufacturer/i), { target: { value: 'Test Foods Pvt Ltd' } });
  }

  async function goToImages() {
    fireEvent.click(screen.getByText('Continue').closest('button') as HTMLButtonElement);
    await screen.findByText('Capture package images', undefined, { timeout: 8000 });
  }

  async function capturePhoto() {
    fireEvent.click(screen.getByText('Capture from Camera').closest('button') as HTMLButtonElement);
    await screen.findByText('Fill the frame with the package label, then capture.', undefined, { timeout: 8000 });
    fireEvent.click(screen.getByText('Capture').closest('button') as HTMLButtonElement);
    await screen.findByText('Use Photo', undefined, { timeout: 8000 });
    fireEvent.click(screen.getByText('Use Photo').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.ok(calls.some((call) => call.url === '/api/images'), 'the capture must be uploaded'), {
      timeout: 8000,
    });
  }

  /** Replays the flow with a different analysis outcome. */
  async function rerenderWithInspection(inspection: Inspection) {
    await renderWizard();
    // Set after renderWizard(), which resets the mock back to the default inspection.
    analyzeResult = inspection;
    await fillProductForm();
    await goToImages();
    await capturePhoto();
    fireEvent.click(screen.getByText('Analyze Product').closest('button') as HTMLButtonElement);
    await screen.findByText('Compliance score', undefined, { timeout: 8000 });
  }

  console.log('\nLegalMetrix — inspection wizard test (jsdom)\n');

  await step('the wizard shows all five steps up front', async () => {
    await renderWizard();
    assert.equal(currentStep(), 'Product', 'it must start on step 1');
    const labels = Array.from(document.querySelectorAll('ol li')).map((li) => li.textContent?.trim());
    assert.equal(labels.length, 5, `five steps must be listed, found ${labels.length}`);
    for (const label of ['Product', 'Images', 'Analysis', 'Result', 'Report']) {
      assert.ok(labels.join('|').includes(label), `the "${label}" step must be visible`);
    }
  });

  await step('the product step refuses an incomplete form', async () => {
    await renderWizard();
    fireEvent.click(screen.getByText('Continue').closest('button') as HTMLButtonElement);
    await screen.findByText('Product name is required.', undefined, { timeout: 8000 });
    assert.equal(currentStep(), 'Product', 'it must not advance');

    fireEvent.change(screen.getByLabelText(/product name/i), { target: { value: 'Test Packaged Rice' } });
    fireEvent.click(screen.getByText('Continue').closest('button') as HTMLButtonElement);
    await screen.findByText('Manufacturer, packer or importer is required.', undefined, { timeout: 8000 });
    assert.equal(currentStep(), 'Product', 'it must still not advance');
    assert.equal(calls.length, 0, 'nothing should be sent to the server yet');
  });

  await step('a complete form advances to the image step', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    assert.equal(currentStep(), 'Images');
    assert.ok(screen.getByText('Analyze Product'), 'the image step must offer analysis');
  });

  await step('analysis is blocked until an image is attached', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    const analyze = screen.getByText('Analyze Product').closest('button') as HTMLButtonElement;
    assert.ok(analyze.disabled, 'Analyze must be disabled with no images');
    assert.equal(calls.length, 0, 'no inspection may be created without an image');
  });

  await step('a camera capture is uploaded and enables analysis', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    await capturePhoto();

    const upload = calls.find((call) => call.url === '/api/images');
    assert.ok(upload, 'the capture must be POSTed to /api/images');
    assert.equal(upload.method, 'POST');

    await waitFor(() => {
      const analyze = screen.getByText('Analyze Product').closest('button') as HTMLButtonElement;
      assert.ok(!analyze.disabled, 'Analyze must be enabled once an image is attached');
    }, { timeout: 8000 });
  });

  await step('the camera is closed after the photo is used', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    await capturePhoto();
    await waitFor(() => assert.ok(stoppedTracks.length >= 1, 'the camera track must be stopped'), { timeout: 8000 });
  });

  await step('analyzing shows progress, then the compliance result', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    await capturePhoto();

    fireEvent.click(screen.getByText('Analyze Product').closest('button') as HTMLButtonElement);

    // Step 3 is transient; wait for the result.
    await screen.findByText('Compliance score', undefined, { timeout: 8000 });
    assert.equal(currentStep(), 'Result', 'it must land on the Result step');

    const inspectionCall = calls.find((call) => call.url === '/api/inspections' && call.method === 'POST');
    assert.ok(inspectionCall, 'the inspection must be created');
    const analyzeCall = calls.find((call) => call.url.endsWith('/analyze'));
    assert.ok(analyzeCall, 'the inspection must be analyzed');

    const text = body();
    assert.ok(text.includes('LM-PC-2011-6(1)(e)'), 'the flagged rule must be shown');
    assert.ok(text.includes('No vision model is connected'), 'the analysis note must be shown');
  });

  await step('the result routes unconfirmed findings to review', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    await capturePhoto();
    fireEvent.click(screen.getByText('Analyze Product').closest('button') as HTMLButtonElement);
    await screen.findByText('Compliance score', undefined, { timeout: 8000 });

    const text = body();
    assert.ok(/review/i.test(text), 'the result must tell the officer a review is needed');
    // An unscored inspection must not present a fabricated percentage.
    assert.ok(!/\b\d{1,3}%\s*compliant/i.test(text), 'no invented compliance percentage');
  });

  await step('an unconfirmed finding routes to review instead of a report', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    await capturePhoto();
    fireEvent.click(screen.getByText('Analyze Product').closest('button') as HTMLButtonElement);
    await screen.findByText('Compliance score', undefined, { timeout: 8000 });

    // The fixture inspection carries a PENDING finding, so a report must NOT be offered
    // until a human has confirmed it.
    assert.equal(screen.queryByText('Generate Report'), null, 'no report while a finding is unconfirmed');
    const review = screen.getByText('Review Findings').closest('button') as HTMLButtonElement;
    assert.ok(review, 'the officer must be sent to review first');

    fireEvent.click(review);
    await waitFor(() => assert.equal(navigated.length, 1), { timeout: 8000 });
    assert.equal(navigated[0], `/app/inspections/${INSPECTION.id}?review=1`, 'it must deep-link to the review queue');
  });

  await step('a fully resolved inspection can generate a report', async () => {
    // Once the finding is confirmed there is nothing left for a human to do.
    const resolved = {
      ...INSPECTION,
      status: 'NON_COMPLIANT' as const,
      scored: true,
      complianceScore: 0,
      reviewStatus: 'COMPLETED' as const,
      findings: INSPECTION.findings.map((finding) => ({
        ...finding,
        status: 'VIOLATION' as const,
        reviewStatus: 'HUMAN_CONFIRMED' as const,
        reviewerName: 'Test Reviewer',
      })),
    };
    await rerenderWithInspection(resolved);

    assert.equal(screen.queryByText('Review Findings'), null, 'review is finished');
    fireEvent.click(screen.getByText('Generate Report').closest('button') as HTMLButtonElement);
    await screen.findByText('Report generated', undefined, { timeout: 8000 });
    assert.equal(currentStep(), 'Report');
    assert.ok(body().includes(REPORT.reportNumber), 'the new report number must be shown');
    assert.ok(calls.some((call) => call.url.endsWith('/report')), 'the report must be POSTed');
  });

  await step('a failed analysis returns the officer to the images with the reason', async () => {
    await renderWizard();
    await fillProductForm();
    await goToImages();
    analyzeFails = true;
    await capturePhoto();
    fireEvent.click(screen.getByText('Analyze Product').closest('button') as HTMLButtonElement);

    await screen.findByText('The vision service did not respond.', undefined, { timeout: 8000 });
    assert.equal(currentStep(), 'Images', 'the officer must be returned to the images, not stranded');
    assert.ok(body().includes('Analyze Product'), 'they must be able to try again');
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
