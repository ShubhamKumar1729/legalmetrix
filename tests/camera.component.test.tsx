/**
 * Exercises the real CameraCapture component in a DOM.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/camera.component.test.tsx
 *
 * `navigator.mediaDevices` is stubbed, so this proves the component's own logic —
 * permission handling, preview, capture, retake, use photo, every failure state and
 * stream cleanup. It cannot prove anything about physical camera hardware.
 */
import assert from 'node:assert/strict';
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
    /* some window properties are not configurable */
  }
}
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true });

/* ------------------------------------------------------------------ stubs */

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;

Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', { get: () => FRAME_WIDTH, configurable: true });
Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', { get: () => FRAME_HEIGHT, configurable: true });
window.HTMLMediaElement.prototype.play = function play() {
  return Promise.resolve();
};
window.HTMLMediaElement.prototype.load = function load() {};

const drawCalls: string[] = [];
(window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = function getContext() {
  return {
    drawImage: () => {
      drawCalls.push('drawImage');
    },
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
  // Use the Node global Blob so `URL.createObjectURL` accepts it.
  callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: type || 'image/jpeg' }));
};

let objectUrlCount = 0;
const revokedUrls: string[] = [];
// Add the object-URL API to the existing URL constructor rather than replacing it,
// because other machinery (tsx's module resolver) depends on `new URL(...)`.
const createObjectURL = () => `blob:mock/${(objectUrlCount += 1)}`;
const revokeObjectURL = (url: string) => {
  revokedUrls.push(url);
};
for (const target of [URL, window.URL as unknown as typeof URL]) {
  Object.defineProperty(target, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(target, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
}

/** jsdom has no image decoder; make `new Image()` resolve immediately. */
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
Object.defineProperty(globalThis, 'Image', { value: FakeImage, configurable: true });
Object.defineProperty(window, 'Image', { value: FakeImage, configurable: true });

/* --------------------------------------------------- fake camera devices */

interface TrackOptions {
  torch?: boolean;
  facingMode?: 'environment' | 'user';
}

const stoppedTracks: string[] = [];

function makeTrack(id: string, options: TrackOptions = {}) {
  return {
    kind: 'video',
    id,
    readyState: 'live',
    enabled: true,
    muted: false,
    label: `camera-${id}`,
    stop: () => {
      stoppedTracks.push(id);
    },
    getCapabilities: () => ({
      facingMode: [options.facingMode || 'environment'],
      ...(options.torch ? { torch: true } : {}),
    }),
    getSettings: () => ({ facingMode: options.facingMode || 'environment' }),
    applyConstraints: async () => undefined,
  };
}

function makeStream(tracks: ReturnType<typeof makeTrack>[]) {
  return {
    id: `stream-${tracks.map((t) => t.id).join('-')}`,
    active: true,
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
    getAudioTracks: () => [],
    addTrack: () => undefined,
    removeTrack: () => undefined,
  };
}

interface CameraHarness {
  mode: 'ok' | 'denied' | 'notfound' | 'busy' | 'overconstrained-then-ok' | 'missing-api';
  devices: { kind: string; deviceId: string }[];
  torch: boolean;
  constraintLog: unknown[];
}

const harness: CameraHarness = {
  mode: 'ok',
  devices: [
    { kind: 'videoinput', deviceId: 'cam-1' },
    { kind: 'audioinput', deviceId: 'mic-1' },
  ],
  torch: false,
  constraintLog: [],
};

function installMediaDevices() {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async (constraints: unknown) => {
        harness.constraintLog.push(constraints);
        const rejectionName: Record<string, string> = {
          denied: 'NotAllowedError',
          notfound: 'NotFoundError',
          busy: 'NotReadableError',
        };
        const name = rejectionName[harness.mode];
        if (name) throw new window.DOMException('blocked in test', name);
        if (harness.mode === 'overconstrained-then-ok' && harness.constraintLog.length === 1) {
          throw new window.DOMException('constraints not met', 'OverconstrainedError');
        }
        return makeStream([makeTrack(`track-${harness.constraintLog.length}`, { torch: harness.torch })]) as unknown as MediaStream;
      },
      enumerateDevices: async () => harness.devices as unknown as MediaDeviceInfo[],
    },
  });
}

function removeMediaDevices() {
  Object.defineProperty(window.navigator, 'mediaDevices', { configurable: true, value: undefined });
}

/* -------------------------------------------------------------- harness */

async function main() {
  const { render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react');
  const { CameraCapture } = await import('../src/components/camera/camera-capture');

  type Used = Parameters<NonNullable<React.ComponentProps<typeof CameraCapture>['onUsePhoto']>>[0];

  let passed = 0;
  const failures: string[] = [];

  async function step(name: string, fn: () => Promise<void> | void) {
    cleanup();
    harness.mode = 'ok';
    harness.torch = false;
    harness.constraintLog = [];
    harness.devices = [{ kind: 'videoinput', deviceId: 'cam-1' }];
    stoppedTracks.length = 0;
    revokedUrls.length = 0;
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

  function mountCamera() {
    const used: Used[] = [];
    let closed = 0;
    let uploadInstead = 0;
    render(
      React.createElement(CameraCapture, {
        onUsePhoto: (image: Used) => used.push(image),
        onClose: () => {
          closed += 1;
        },
        onUploadInstead: () => {
          uploadInstead += 1;
        },
      })
    );
    return { used, closed: () => closed, uploadInstead: () => uploadInstead };
  }

  async function waitLive() {
    await screen.findByText('Fill the frame with the package label, then capture.', undefined, { timeout: 5000 });
  }

  async function captureFrame() {
    fireEvent.click(screen.getByText('Capture').closest('button') as HTMLButtonElement);
    await screen.findByText('Check the capture is readable before using it.', undefined, { timeout: 5000 });
  }

  console.log('\nLegalMetrix — camera component test (jsdom)\n');

  await step('permission is requested and the live preview opens', async () => {
    mountCamera();
    await waitLive();
    assert.equal(harness.constraintLog.length, 1, 'getUserMedia should have been called exactly once');
    assert.ok(screen.getByText('Position the package inside the frame.'), 'the framing guide must be shown');
    const video = document.querySelector('video');
    assert.ok(video, 'a video element must be rendered');
    assert.ok(video.srcObject, 'the stream must be attached to the video element');
    assert.ok(!video.className.includes('hidden'), 'the preview must be visible while live');
  });

  await step('the first request prefers the rear camera at high resolution', async () => {
    mountCamera();
    await waitLive();
    const first = harness.constraintLog[0] as { video: { facingMode: { ideal: string }; width: { ideal: number } } };
    assert.equal(first.video.facingMode.ideal, 'environment');
    assert.equal(first.video.width.ideal, 1920);
  });

  await step('a capture produces a reviewable frame', async () => {
    mountCamera();
    await waitLive();
    await captureFrame();
    assert.ok(screen.getByText('Retake'));
    assert.ok(screen.getByText('Use Photo'));
    assert.ok(screen.getByText(`${FRAME_WIDTH} × ${FRAME_HEIGHT}`), 'the capture dimensions are shown');
    assert.ok(drawCalls.length > 0, 'the frame must be drawn to a canvas');
    const preview = document.querySelector('img[alt="Captured package"]') as HTMLImageElement;
    assert.ok(preview, 'the captured frame must be shown back to the officer');
    assert.ok(preview.src.startsWith('blob:'));
  });

  await step('retake returns to the live preview and frees the previous frame', async () => {
    mountCamera();
    await waitLive();
    await captureFrame();
    fireEvent.click(screen.getByText('Retake').closest('button') as HTMLButtonElement);
    await waitLive();
    assert.equal(document.querySelector('img[alt="Captured package"]'), null, 'the review image is cleared');
    assert.ok(revokedUrls.length >= 1, 'the blob URL of the discarded capture is revoked');
  });

  await step('use photo hands a real JPEG blob back to the inspection', async () => {
    const { used } = mountCamera();
    await waitLive();
    await captureFrame();
    fireEvent.click(screen.getByText('Use Photo').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(used.length, 1));
    const [image] = used;
    assert.equal(image.blob.type, 'image/jpeg', 'captures must be normalised to JPEG');
    assert.ok(image.blob.size > 0, 'the blob must contain bytes');
    assert.equal(image.width, FRAME_WIDTH);
    assert.equal(image.height, FRAME_HEIGHT);
    assert.ok(Number.isFinite(image.quality.brightness), 'brightness must be measured from real pixels');
    assert.ok(Number.isFinite(image.quality.blurScore), 'blur must be measured from real pixels');
    assert.ok(!Number.isNaN(Date.parse(image.capturedAt)), 'the capture time must be recorded');
  });

  await step('the camera returns to live after a photo is used, ready for the next side', async () => {
    const { used } = mountCamera();
    await waitLive();
    await captureFrame();
    fireEvent.click(screen.getByText('Use Photo').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(used.length, 1));
    await waitLive();
    await captureFrame();
    fireEvent.click(screen.getByText('Use Photo').closest('button') as HTMLButtonElement);
    await waitFor(() => assert.equal(used.length, 2));
  });

  await step('closing the camera stops every track', async () => {
    const { closed } = mountCamera();
    await waitLive();
    fireEvent.click(document.querySelector('button[aria-label="Close camera"]') as HTMLButtonElement);
    await waitFor(() => assert.equal(closed(), 1));
    assert.equal(stoppedTracks.length, 1, 'the media track must be stopped');
  });

  await step('unmounting stops every track', async () => {
    mountCamera();
    await waitLive();
    cleanup();
    assert.ok(stoppedTracks.length >= 1, 'no camera may be left running after unmount');
  });

  await step('a denied permission is reported with an upload path', async () => {
    harness.mode = 'denied';
    const { uploadInstead } = mountCamera();
    await screen.findByText('Camera access was denied.', undefined, { timeout: 5000 });
    assert.ok(screen.getByText('Allow camera access in your browser settings, or upload a photo instead.'));
    fireEvent.click(screen.getByText('Upload Image Instead').closest('button') as HTMLButtonElement);
    assert.equal(uploadInstead(), 1, 'the officer must be offered the upload fallback');
  });

  await step('a missing camera is reported with an upload path', async () => {
    harness.mode = 'notfound';
    mountCamera();
    await screen.findByText('Camera is not available on this device.', undefined, { timeout: 5000 });
    assert.ok(screen.getByText('You can still add package photos from your device.'));
    assert.ok(screen.getByText('Upload Image'), 'the footer fallback button must be present');
  });

  await step('a camera held by another application is reported', async () => {
    harness.mode = 'busy';
    mountCamera();
    await screen.findByText('The camera is already in use by another application.', undefined, { timeout: 5000 });
  });

  await step('over-constrained requests fall back to looser constraints', async () => {
    harness.mode = 'overconstrained-then-ok';
    mountCamera();
    await waitLive();
    assert.equal(harness.constraintLog.length, 2, 'a second, looser request should have been made');
    const second = harness.constraintLog[1] as { video: { facingMode: { ideal: string }; width?: unknown } };
    assert.equal(second.video.width, undefined, 'the retry drops the resolution constraint');
    assert.equal(second.video.facingMode.ideal, 'environment');
  });

  await step('a browser without a camera API explains itself', async () => {
    removeMediaDevices();
    mountCamera();
    await screen.findByText('This browser does not expose a camera API.', undefined, { timeout: 5000 });
  });

  await step('the switch-camera control appears only with more than one camera', async () => {
    mountCamera();
    await waitLive();
    assert.equal(document.querySelector('button[aria-label="Switch camera"]'), null, 'hidden for a single camera');
    cleanup();
    harness.devices = [
      { kind: 'videoinput', deviceId: 'cam-1' },
      { kind: 'videoinput', deviceId: 'cam-2' },
    ];
    installMediaDevices();
    mountCamera();
    await waitLive();
    assert.ok(document.querySelector('button[aria-label="Switch camera"]'), 'shown when a second camera exists');
  });

  await step('switching camera restarts the stream with the front camera', async () => {
    harness.devices = [
      { kind: 'videoinput', deviceId: 'cam-1' },
      { kind: 'videoinput', deviceId: 'cam-2' },
    ];
    installMediaDevices();
    mountCamera();
    await waitLive();
    await act(async () => {
      fireEvent.click(document.querySelector('button[aria-label="Switch camera"]') as HTMLButtonElement);
    });
    await waitFor(() => assert.ok(harness.constraintLog.length >= 2));
    const last = harness.constraintLog[harness.constraintLog.length - 1] as { video: { facingMode: { ideal: string } } };
    assert.equal(last.video.facingMode.ideal, 'user');
  });

  await step('flash controls are only offered when the device really supports them', async () => {
    mountCamera();
    await waitLive();
    assert.equal(document.querySelector('button[aria-label="Turn flash on"]'), null, 'no torch, no control');
    cleanup();
    harness.torch = true;
    installMediaDevices();
    mountCamera();
    await waitLive();
    const torch = document.querySelector('button[aria-label="Turn flash on"]') as HTMLButtonElement;
    assert.ok(torch, 'the control appears only when getCapabilities() reports torch');
    await act(async () => {
      fireEvent.click(torch);
    });
    await waitFor(() => assert.ok(document.querySelector('button[aria-label="Turn flash off"]')));
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
