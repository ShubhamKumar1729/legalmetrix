/**
 * Exercises the real ImageManager in a DOM.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/imagemanager.component.test.tsx
 *
 * Covers the acceptance criteria nothing else reached: attaching MULTIPLE images to one
 * inspection, and proving that the camera and the file upload produce the SAME
 * normalized record through the same POST /api/images.
 *
 * fetch and the image decoder are stubbed, so this proves the component's own logic —
 * accumulation, per-image side labelling, reordering, removal, the 10-image cap and
 * rejection of unusable files. It cannot prove real decoding or real camera hardware.
 */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';
import type { DraftImage } from '../src/components/inspection/image-manager';

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
    /* some window properties are not configurable */
  }
}
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true });

/* ------------------------------------------------------------------ stubs */

const IMG_W = 800;
const IMG_H = 600;

// Allocate only the region asked for — measureImageQuality downscales to 640px, and a
// fixed full-frame buffer would scan far more pixels than requested and exhaust memory.
(window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = function getContext() {
  return {
    drawImage: () => undefined,
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
const createObjectURL = () => `blob:mock/${(objectUrlCount += 1)}`;
const revokeObjectURL = () => undefined;
for (const target of [URL, window.URL as unknown as typeof URL]) {
  Object.defineProperty(target, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(target, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
}

/** jsdom has no image decoder; make `new Image()` resolve immediately. */
class FakeImage {
  naturalWidth = IMG_W;
  naturalHeight = IMG_H;
  width = IMG_W;
  height = IMG_H;
  decoding = 'sync';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}
Object.defineProperty(globalThis, 'Image', { value: FakeImage, configurable: true });
Object.defineProperty(window, 'Image', { value: FakeImage, configurable: true });

/* ------------------------------------------------------------- fetch stub */

interface UploadCall {
  side: string;
  source: string;
  name: string;
  quality: string | null;
}

const calls: UploadCall[] = [];
/** What the server handed back, so the two paths can be compared as stored records. */
const stored: Record<string, unknown>[] = [];
let imageCounter = 0;
let uploadFails = false;

async function mockFetch(input: unknown, init?: { method?: string; body?: unknown }) {
  const url = String(input);
  const method = init?.method || 'GET';

  if (url === '/api/images' && method === 'POST') {
    const form = init?.body as FormData;
    const file = form.get('image') as File;
    calls.push({
      side: String(form.get('side')),
      source: String(form.get('source')),
      name: file?.name ?? '',
      quality: form.get('quality') ? String(form.get('quality')) : null,
    });

    if (uploadFails) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'The image is 14.0 MB. The maximum size is 10 MB.' },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    imageCounter += 1;
    const record = {
          id: `img-${imageCounter}`,
          side: form.get('side'),
          url: `/api/images/img-${imageCounter}`,
          originalName: file?.name ?? `image-${imageCounter}`,
          size: 184320,
          mimeType: 'image/jpeg',
          width: IMG_W,
          height: IMG_H,
          source: form.get('source'),
          quality: { resolution: IMG_H, brightness: 0.52, blurScore: 0.21 },
      uploadedAt: new Date().toISOString(),
    };
    stored.push(record);
    return new Response(JSON.stringify({ success: true, data: record }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

/* ------------------------------------------------- camera devices (minimal) */

function makeTrack() {
  return {
    kind: 'video',
    id: 'cam-1',
    readyState: 'live',
    enabled: true,
    muted: false,
    label: 'camera-1',
    stop: () => undefined,
    getCapabilities: () => ({ facingMode: ['environment'] }),
    getSettings: () => ({ facingMode: 'environment' }),
    applyConstraints: async () => undefined,
  };
}

Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', { get: () => IMG_W, configurable: true });
Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', { get: () => IMG_H, configurable: true });
window.HTMLMediaElement.prototype.play = function play() {
  return Promise.resolve();
};
window.HTMLMediaElement.prototype.load = function load() {};

function installMediaDevices() {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        const track = makeTrack();
        return {
          id: 'stream-1',
          active: true,
          getTracks: () => [track],
          getVideoTracks: () => [track],
          getAudioTracks: () => [],
          addTrack: () => undefined,
          removeTrack: () => undefined,
        };
      },
      enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'cam-1' }],
    },
  });
}

/* ------------------------------------------------------------- file helper */

function makeFile(name: string, type: string, size?: number) {
  const file = new window.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size, configurable: true });
  }
  return file;
}

function makeFileList(files: File[]) {
  const list: Record<string, unknown> = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterator() {
      yield* files;
    },
  };
  files.forEach((file, index) => {
    list[index] = file;
  });
  return list as unknown as FileList;
}

/* ---------------------------------------------------------------- harness */

async function main() {
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { ImageManager } = await import('../src/components/inspection/image-manager');

  /** ImageManager is controlled, so the parent must own the list to test accumulation. */
  function Harness({ maxImages, initial = [] }: { maxImages?: number; initial?: DraftImage[] }) {
    const [images, setImages] = useState<DraftImage[]>(initial);
    return (
      <div>
        <ImageManager images={images} onChange={setImages} maxImages={maxImages} />
        <span data-testid="count">{images.length}</span>
        <span data-testid="ids">{images.map((image) => image.id).join(',')}</span>
        <span data-testid="sides">{images.map((image) => image.side).join(',')}</span>
        <span data-testid="sources">{images.map((image) => image.source).join(',')}</span>
      </div>
    );
  }

  let passed = 0;
  const failures: string[] = [];

  async function step(name: string, fn: () => Promise<void> | void) {
    cleanup();
    calls.length = 0;
    stored.length = 0;
    imageCounter = 0;
    uploadFails = false;
    installMediaDevices();
    try {
      await fn();
      passed += 1;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failures.push(`${name}: ${(error as Error).message}`);
      console.log(`  ✗ ${name}\n      ${(error as Error).message}`);
    }
  }

  const count = () => screen.getByTestId('count').textContent;
  const ids = () => screen.getByTestId('ids').textContent;
  const sides = () => screen.getByTestId('sides').textContent;
  const sources = () => screen.getByTestId('sources').textContent;

  async function uploadFiles(files: File[]) {
    // `calls` accumulates for the whole step, so wait on the delta, not the total.
    const before = calls.length;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: makeFileList(files), configurable: true });
    fireEvent.change(input);
    await waitFor(() => assert.equal(calls.length - before, files.length), { timeout: 8000 });
  }

  console.log('\nLegalMetrix — image manager test (jsdom)\n');

  await step('an inspection with no images explains how to add some', async () => {
    render(<Harness />);
    assert.ok(screen.getByText('No images yet'));
    assert.equal(count(), '0');
    assert.ok(screen.getByText(/0 of 10 added/), 'the counter must show progress');
  });

  await step('several files selected at once all attach to the same inspection', async () => {
    render(<Harness />);
    await uploadFiles([
      makeFile('front.png', 'image/png'),
      makeFile('back.png', 'image/png'),
      makeFile('side.jpg', 'image/jpeg'),
    ]);

    assert.equal(count(), '3', 'all three uploads must be attached');
    assert.equal(ids(), 'img-1,img-2,img-3', 'each must keep its own stored id');
    assert.equal(calls.length, 3, 'each file must be validated and stored separately');
    assert.deepEqual(
      calls.map((call) => call.name),
      ['front.png', 'back.png', 'side.jpg']
    );
  });

  await step('images can be added one at a time and accumulate', async () => {
    render(<Harness />);
    await uploadFiles([makeFile('front.png', 'image/png')]);
    assert.equal(count(), '1');

    await uploadFiles([makeFile('back.png', 'image/png')]);
    await waitFor(() => assert.equal(count(), '2'), { timeout: 8000 });
    assert.equal(ids(), 'img-1,img-2', 'the second upload must append, not replace');
  });

  await step('every upload is validated and stored through POST /api/images', async () => {
    render(<Harness />);
    await uploadFiles([makeFile('front.png', 'image/png'), makeFile('back.png', 'image/png')]);

    for (const call of calls) {
      assert.equal(call.side, 'FRONT', 'the selected side must be sent');
      assert.equal(call.source, 'UPLOAD', 'the origin must be recorded');
      assert.ok(call.quality, 'measured quality must be sent with the file');
      const quality = JSON.parse(call.quality as string);
      assert.equal(quality.width, IMG_W);
      assert.equal(typeof quality.blurScore, 'number');
    }
  });

  await step('the camera and an upload produce the same normalized record', async () => {
    render(<Harness />);

    // Camera path.
    fireEvent.click(screen.getByText('Capture from Camera').closest('button') as HTMLButtonElement);
    await screen.findByText('Fill the frame with the package label, then capture.', undefined, { timeout: 8000 });
    fireEvent.click(screen.getByText('Capture').closest('button') as HTMLButtonElement);
    await screen.findByText('Use Photo', undefined, { timeout: 8000 });
    fireEvent.click(screen.getByText('Use Photo').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(calls.length, 1), { timeout: 8000 });

    // Upload path.
    await uploadFiles([makeFile('uploaded.png', 'image/png')]);

    assert.equal(calls.length, 2, 'both paths must reach the same endpoint');
    assert.equal(calls[0].source, 'CAMERA');
    assert.equal(calls[1].source, 'UPLOAD');
    // Both must carry the selected side and a measured quality payload. The camera
    // reports brightness/blurScore; an upload adds the pixel dimensions it measured.
    assert.equal(calls[0].side, calls[1].side, 'both must carry the selected side');
    for (const call of calls) {
      const quality = JSON.parse(call.quality as string);
      assert.equal(typeof quality.brightness, 'number');
      assert.equal(typeof quality.blurScore, 'number');
    }

    // What matters downstream is that both produce the SAME normalized record.
    assert.equal(stored.length, 2, 'both paths must return a stored record');
    assert.deepEqual(
      Object.keys(stored[0]).sort(),
      Object.keys(stored[1]).sort(),
      'camera and upload must yield an identically shaped stored record'
    );
    assert.equal(stored[0].source, 'CAMERA');
    assert.equal(stored[1].source, 'UPLOAD', 'only the origin may differ');
    for (const record of stored) {
      assert.match(String(record.url), /^\/api\/images\//, 'both get an inspection image id/url');
      assert.equal(record.width, IMG_W);
      assert.equal(record.height, IMG_H);
    }

    await waitFor(() => assert.equal(count(), '2'), { timeout: 8000 });
    assert.equal(sources(), 'CAMERA,UPLOAD', 'both kinds sit side by side on one inspection');
  });

  await step('each image can be labelled with a different side', async () => {
    render(<Harness />);
    await uploadFiles([makeFile('a.png', 'image/png'), makeFile('b.png', 'image/png')]);

    const selectors = Array.from(document.querySelectorAll('select[aria-label="Image position"]'));
    assert.equal(selectors.length, 2, 'one side control per image');

    fireEvent.change(selectors[1], { target: { value: 'BACK' } });
    await waitFor(() => assert.equal(sides(), 'FRONT,BACK'), { timeout: 8000 });

    // The pending side applies to the NEXT upload, not retroactively.
    fireEvent.change(screen.getByLabelText('What is this image of?'), { target: { value: 'TOP' } });
    await uploadFiles([makeFile('c.png', 'image/png')]);
    await waitFor(() => assert.equal(sides(), 'FRONT,BACK,TOP'), { timeout: 8000 });
  });

  await step('images can be reordered', async () => {
    render(<Harness />);
    await uploadFiles([makeFile('a.png', 'image/png'), makeFile('b.png', 'image/png')]);
    assert.equal(ids(), 'img-1,img-2');

    const later = screen.getAllByLabelText('Move later');
    fireEvent.click(later[0]);
    await waitFor(() => assert.equal(ids(), 'img-2,img-1'), { timeout: 8000 });

    const earlier = screen.getAllByLabelText('Move earlier');
    fireEvent.click(earlier[1]);
    await waitFor(() => assert.equal(ids(), 'img-1,img-2'), { timeout: 8000 });
  });

  await step('an image can be removed without disturbing the others', async () => {
    render(<Harness />);
    await uploadFiles([
      makeFile('a.png', 'image/png'),
      makeFile('b.png', 'image/png'),
      makeFile('c.png', 'image/png'),
    ]);
    assert.equal(count(), '3');

    fireEvent.click(screen.getAllByText('Remove')[1].closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(count(), '2'), { timeout: 8000 });
    assert.equal(ids(), 'img-1,img-3', 'only the chosen image is dropped');
  });

  await step('a non-image file is refused with a useful message', async () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: makeFileList([makeFile('label.pdf', 'application/pdf')]),
      configurable: true,
    });
    fireEvent.change(input);

    await screen.findByText('"label.pdf" is not a JPEG, PNG or WEBP image.', undefined, { timeout: 8000 });
    assert.equal(count(), '0', 'nothing may be attached');
    assert.equal(calls.length, 0, 'an unusable file must never reach the server');
  });

  await step('an oversized file is refused before it is uploaded', async () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: makeFileList([makeFile('huge.png', 'image/png', 14 * 1024 * 1024)]),
      configurable: true,
    });
    fireEvent.change(input);

    await screen.findByText('"huge.png" is larger than 10 MB.', undefined, { timeout: 8000 });
    assert.equal(count(), '0');
    assert.equal(calls.length, 0, 'the size check must run client-side');
  });

  await step('one bad file does not stop the good ones', async () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: makeFileList([makeFile('notes.txt', 'text/plain'), makeFile('front.png', 'image/png')]),
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => assert.equal(count(), '1'), { timeout: 8000 });
    await screen.findByText('"notes.txt" is not a JPEG, PNG or WEBP image.', undefined, { timeout: 8000 });
    assert.equal(calls.length, 1, 'only the valid image is uploaded');
  });

  await step('a rejected upload is reported and attaches nothing', async () => {
    render(<Harness />);
    uploadFails = true;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: makeFileList([makeFile('front.png', 'image/png')]),
      configurable: true,
    });
    fireEvent.change(input);

    await screen.findByText(/The maximum size is 10 MB/, undefined, { timeout: 8000 });
    assert.equal(count(), '0', 'a failed upload must not appear as attached');
  });

  await step('the ten-image cap is enforced and communicated', async () => {
    render(<Harness maxImages={2} />);
    await uploadFiles([makeFile('a.png', 'image/png'), makeFile('b.png', 'image/png')]);
    assert.equal(count(), '2');

    assert.ok(screen.getByText(/2 of 2 added/), 'the counter must show the cap');
    const camera = screen.getByText('Capture from Camera').closest('button') as HTMLButtonElement;
    const upload = screen.getByText('Upload Images').closest('button') as HTMLButtonElement;
    assert.ok(camera.disabled, 'the camera must be disabled at the cap');
    assert.ok(upload.disabled, 'upload must be disabled at the cap');
  });

  cleanup();

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
