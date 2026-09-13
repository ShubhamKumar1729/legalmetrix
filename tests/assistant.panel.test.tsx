/**
 * Renders the real AssistantPanel and checks it never presents an answer of its own.
 *
 *   npx tsx --tsconfig tests/tsconfig.json tests/assistant.panel.test.tsx
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
    /* not configurable */
  }
}
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true });

// jsdom does not implement Element.scrollTo; every real browser does.
Object.defineProperty(window.Element.prototype, 'scrollTo', { configurable: true, writable: true, value: () => undefined });

/* ------------------------------------------------------------- API mock */

interface Call {
  url: string;
  body: unknown;
}
const calls: Call[] = [];
let nextReply: unknown = null;
let failNext = false;

async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push({ url: url.replace(/^https?:\/\/[^/]+/, ''), body: init?.body ? JSON.parse(String(init.body)) : undefined });

  if (failNext) {
    return new Response(JSON.stringify({ success: false, error: { message: 'The assistant is unavailable.' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ success: true, data: nextReply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, configurable: true, writable: true });
Object.defineProperty(window, 'fetch', { value: mockFetch, configurable: true, writable: true });

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
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { AssistantPanel } = await import('../src/components/assistant/assistant-panel');

  function mount(inspectionId?: string) {
    cleanup();
    calls.length = 0;
    failNext = false;
    render(React.createElement(AssistantPanel, inspectionId ? { inspectionId } : {}));
  }

  async function ask(text: string) {
    const input = screen.getByLabelText('Ask the assistant') as HTMLInputElement;
    fireEvent.change(input, { target: { value: text } });
    fireEvent.click(screen.getByText('Ask').closest('button') as HTMLButtonElement);
  }

  console.log('\nLegalMetrix — assistant panel test (jsdom)\n');

  await step('with no inspection it invites a selection instead of answering', () => {
    mount();
    assert.ok(body().includes('Which inspection would you like me to look at?'));
    assert.equal(calls.length, 0, 'nothing is fetched before the officer asks');
  });

  await step('it states plainly that there is no language model', () => {
    mount('ins-1');
    assert.ok(body().includes('There is no language model here'));
    assert.ok(body().includes('rather than guess'));
  });

  await step('the Ask button is disabled until there is a question', () => {
    mount('ins-1');
    const button = screen.getByText('Ask').closest('button') as HTMLButtonElement;
    assert.ok(button.disabled, 'an empty question must not be sendable');
  });

  await step('asking sends the question and the inspection id, and shows the reply', async () => {
    mount('ins-1');
    nextReply = {
      question: 'What failed?',
      answer: 'LM-2026-000001 has 1 confirmed violation(s).',
      groundedIn: ['LM-2026-000001'],
      answered: true,
      inspectionId: 'ins-1',
      needsInspection: false,
      source: 'stored-records',
    };
    await ask('What failed?');

    await screen.findByText(/confirmed violation/, undefined, { timeout: 8000 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/assistant');
    assert.deepEqual(calls[0].body, { question: 'What failed?', inspectionId: 'ins-1' });
    assert.ok(body().includes('From stored records: LM-2026-000001'), 'the source must be shown');
  });

  await step('a suggestion chip asks a real question', async () => {
    mount('ins-1');
    nextReply = {
      question: 'What needs review?',
      answer: 'Nothing is awaiting review.',
      groundedIn: ['LM-2026-000001'],
      answered: true,
      inspectionId: 'ins-1',
      needsInspection: false,
      source: 'stored-records',
    };
    fireEvent.click(screen.getByText('What needs review?').closest('button') as HTMLButtonElement);
    await screen.findByText(/Nothing is awaiting review/, undefined, { timeout: 8000 });
    assert.equal(calls.length, 1, 'the chip must send exactly one request');
    assert.equal((calls[0].body as { question: string }).question, 'What needs review?');
  });

  await step('a refusal is shown as a refusal, not as an answer', async () => {
    mount('ins-1');
    nextReply = {
      question: 'What will the court decide?',
      answer: 'I can only answer from what is stored for LM-2026-000001.',
      groundedIn: ['LM-2026-000001'],
      answered: false,
      inspectionId: 'ins-1',
      needsInspection: false,
      source: 'stored-records',
    };
    await ask('What will the court decide?');
    await screen.findByText(/I can only answer from what is stored/, undefined, { timeout: 8000 });
  });

  await step('a failed request reports the error and keeps the question', async () => {
    mount('ins-1');
    failNext = true;
    await ask('What failed?');
    await screen.findByText('The assistant is unavailable.', undefined, { timeout: 8000 });
    const input = screen.getByLabelText('Ask the assistant') as HTMLInputElement;
    assert.equal(input.value, 'What failed?', 'the officer should not have to retype the question');
  });

  await step('the thread keeps the question and answer in order', async () => {
    mount('ins-1');
    nextReply = {
      question: 'Who inspected this?',
      answer: 'LM-2026-000001 was inspected by Test Inspector.',
      groundedIn: ['LM-2026-000001'],
      answered: true,
      inspectionId: 'ins-1',
      needsInspection: false,
      source: 'stored-records',
    };
    await ask('Who inspected this?');
    await screen.findByText(/inspected by Test Inspector/, undefined, { timeout: 8000 });
    const text = body();
    assert.ok(text.indexOf('Who inspected this?') < text.indexOf('inspected by Test Inspector'), 'question precedes answer');
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

void main();
