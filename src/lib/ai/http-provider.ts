import type { AIAnalyzeRequest, AIAnalyzeResponse, AIModelProvider } from './types';
import type { BoundingBox } from '@/types';

/**
 * HTTP AI provider — the integration point for the real vision model.
 *
 * Enabled by setting:
 *   AI_PROVIDER=http
 *   AI_SERVICE_URL=https://your-model-host/analyze
 *   AI_SERVICE_KEY=...            (optional, sent as Authorization: Bearer)
 *
 * The service receives the AIAnalyzeRequest payload and must return AIAnalyzeResponse.
 * Nothing else in the application changes when this provider is switched on.
 */
export class HttpAIProvider implements AIModelProvider {
  name = 'Remote Vision Model';
  version = process.env.AI_MODEL_VERSION || 'remote';

  private get endpoint(): string {
    return (process.env.AI_SERVICE_URL || '').trim();
  }

  /**
   * AI_SERVICE_URL points at the analyze route, so the sibling routes hang off the
   * same base: `https://host/analyze` -> `https://host/health`,
   * `https://host/extract-text`. Deriving them in one place keeps the routes
   * consistent; stripping them separately let /extract-text land under /analyze.
   */
  private sibling(route: string): string {
    return this.endpoint.replace(/\/analyze\/?$/, '').replace(/\/$/, '') + route;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.endpoint) return false;
    try {
      const res = await fetch(this.sibling('/health'), {
        method: 'GET',
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.AI_SERVICE_KEY) headers.Authorization = `Bearer ${process.env.AI_SERVICE_KEY}`;
    return headers;
  }

  async extractText(imageUrl: string) {
    if (!this.endpoint) throw new Error('AI_SERVICE_URL is not configured');
    const res = await fetch(this.sibling('/extract-text'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ imageUrl }),
    });
    if (!res.ok) throw new Error(`Text extraction failed (${res.status})`);
    return res.json();
  }

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
    if (!this.endpoint) {
      throw new Error('AI_SERVICE_URL is not configured — set it to enable the remote vision model.');
    }
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw new Error(`Vision model returned ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = (await res.json()) as AIAnalyzeResponse;
    return {
      ...data,
      evidenceRegions: data.evidenceRegions || [],
      warnings: data.warnings || [],
      modelMetadata: {
        provider: 'http',
        modelName: data.modelMetadata?.modelName || this.name,
        modelVersion: data.modelMetadata?.modelVersion || this.version,
        processedAt: data.modelMetadata?.processedAt || new Date().toISOString(),
        processingTimeMs: data.modelMetadata?.processingTimeMs || 0,
      },
    };
  }
}

export const httpAIProvider = new HttpAIProvider();
