/**
 * HTTPAIProvider — the "plug in your real model" adapter.
 *
 * It talks to any external AI service over HTTP using the contract in
 * MODEL_INTEGRATION.md. Your model service only needs 3 endpoints:
 *
 *   GET  {AI_SERVICE_URL}/health        → 200 when the model is up
 *   POST {AI_SERVICE_URL}/analyze       → returns AIAnalyzeResponse (or a subset; it gets normalized)
 *   POST {AI_SERVICE_URL}/extract-text  → { text, confidence, boundingBoxes } (optional)
 *
 * Configure via environment variables (.env) — no code or UI changes needed:
 *
 *   AI_PROVIDER=real
 *   AI_SERVICE_URL=https://your-model-endpoint.com
 *   AI_SERVICE_KEY=your-key
 *   AI_MODEL_VERSION=lm-vision-v2.1.0
 *   AI_TIMEOUT_MS=60000
 */
import type { AIModelProvider, AIAnalyzeRequest, AIAnalyzeResponse } from './types';

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
}

export class HTTPAIProvider implements AIModelProvider {
  name = process.env.AI_MODEL_NAME || 'LegalMetrology Vision (external)';
  version = process.env.AI_MODEL_VERSION || 'unversioned';

  get baseUrl(): string {
    return (process.env.AI_SERVICE_URL || '').replace(/\/+$/, '');
  }

  get timeoutMs(): number {
    return parseInt(process.env.AI_TIMEOUT_MS || '60000', 10) || 60000;
  }

  private assertConfigured() {
    if (!this.baseUrl) {
      throw new Error(
        'AI service URL is not configured. Set AI_SERVICE_URL (and AI_PROVIDER=real) in .env — see MODEL_INTEGRATION.md.'
      );
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    this.assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      };
      if (process.env.AI_SERVICE_KEY) {
        headers['Authorization'] = `Bearer ${process.env.AI_SERVICE_KEY}`;
      }
      return await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await this.request('/health', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
    const started = Date.now();
    const res = await this.request('/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI service returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    const data = await res.json();
    return this.normalize(data, request, started);
  }

  /**
   * Normalize whatever the model service returns into the platform contract.
   * Missing arrays become empty arrays, confidences are clamped to 0–100,
   * so the UI can never crash on a slightly-off integration response.
   */
  private normalize(data: any, request: AIAnalyzeRequest, startedAt: number): AIAnalyzeResponse {
    const conf = (data?.confidence || {}) as any;
    return {
      inspectionId: data?.inspectionId || request.inspectionId,
      runId: data?.runId || `ai-run-${Date.now()}`,
      processingStatus: ['PROCESSING', 'COMPLETED', 'FAILED'].includes(data?.processingStatus)
        ? data.processingStatus
        : 'COMPLETED',
      stages: Array.isArray(data?.stages) ? data.stages : [],
      extractedFields: Array.isArray(data?.extractedFields) ? data.extractedFields : [],
      findings: Array.isArray(data?.findings) ? data.findings : [],
      confidence: {
        average: clamp(conf.average, 0, 100, 0),
        min: clamp(conf.min, 0, 100, 0),
        max: clamp(conf.max, 0, 100, 100),
      },
      evidenceRegions: Array.isArray(data?.evidenceRegions) ? data.evidenceRegions : [],
      warnings: Array.isArray(data?.warnings) ? data.warnings : [],
      modelMetadata: {
        provider: 'real',
        modelName: data?.modelMetadata?.modelName || this.name,
        modelVersion: data?.modelMetadata?.modelVersion || this.version,
        processedAt: data?.modelMetadata?.processedAt || new Date().toISOString(),
        processingTimeMs: data?.modelMetadata?.processingTimeMs ?? Date.now() - startedAt,
      },
      ...(data?.error ? { error: data.error } : {}),
    } as AIAnalyzeResponse;
  }

  async extractText(imageUrl: string): Promise<{ text: string; confidence: number; boundingBoxes: any[] }> {
    const res = await this.request('/extract-text', {
      method: 'POST',
      body: JSON.stringify({ imageUrl }),
    });
    if (!res.ok) throw new Error(`AI extract-text failed: ${res.status}`);
    const data = await res.json();
    return {
      text: data?.text || '',
      confidence: clamp(data?.confidence, 0, 100, 0),
      boundingBoxes: Array.isArray(data?.boundingBoxes) ? data.boundingBoxes : [],
    };
  }
}

export const httpAIProvider = new HTTPAIProvider();
