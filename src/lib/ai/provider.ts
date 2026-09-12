/**
 * AI Provider Registry — the ONE place the platform asks for AI analysis.
 *
 *   Frontend → API route → aiRegistry → provider (mock | real) → your model
 *
 * Switching to a real model is a pure config change:
 *   AI_PROVIDER=real  +  AI_SERVICE_URL / AI_SERVICE_KEY / AI_MODEL_VERSION
 *
 * - 'mock' (default): deterministic results, no network — safe for demos/tests.
 * - 'real'  : HTTP adapter in http-provider.ts following MODEL_INTEGRATION.md.
 * - Custom providers: call aiRegistry.register('my-model', new MyProvider())
 *   at module load (e.g. from this file) and set AI_PROVIDER=my-model.
 *
 * Resilience: a failing real provider is retried once, then in demo mode
 * falls back to the mock so the UI never dead-ends (documented in MODEL_INTEGRATION.md).
 */
import type { AIModelProvider, AIAnalyzeRequest, AIAnalyzeResponse } from './types';
import { mockAIProvider } from './mock-provider';
import { httpAIProvider } from './http-provider';

export type AIProviderType = 'mock' | 'real' | 'custom';

class AIProviderRegistry {
  private providers: Map<string, AIModelProvider> = new Map();
  private defaultProvider: string = 'mock';

  constructor() {
    this.register('mock', mockAIProvider);
    this.register('real', httpAIProvider);
    this.defaultProvider = process.env.AI_PROVIDER || 'mock';
  }

  register(name: string, provider: AIModelProvider) {
    this.providers.set(name, provider);
  }

  getProvider(name?: string): AIModelProvider {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.warn(`AI provider "${providerName}" not found, falling back to mock`);
      return mockAIProvider;
    }
    return provider;
  }

  getProviderName(): string {
    return this.providers.has(this.defaultProvider) ? this.defaultProvider : 'mock';
  }

  async analyze(request: AIAnalyzeRequest, providerName?: string): Promise<AIAnalyzeResponse> {
    const name = providerName || this.getProviderName();
    const provider = this.getProvider(name);

    // One retry for transient model-service failures (timeout / 5xx)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await provider.analyze(request);
      } catch (error) {
        console.error(`AI provider "${name}" failed (attempt ${attempt + 1}):`, error);
        if (name !== 'mock' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
          console.log('Falling back to mock provider so the demo flow can continue.');
          return mockAIProvider.analyze(request);
        }
        if (attempt === 1) throw error;
      }
    }
    throw new Error('AI analysis failed');
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /** Status snapshot for /api/ai/status and the admin Settings page. */
  getStatus() {
    const name = this.getProviderName();
    const provider = this.getProvider(name);
    return {
      activeProvider: name,
      availableProviders: this.listProviders(),
      modelName: provider.name,
      modelVersion: provider.version,
      serviceUrlConfigured: name !== 'real' ? true : !!process.env.AI_SERVICE_URL,
      serviceUrl: process.env.AI_SERVICE_URL ? `${process.env.AI_SERVICE_URL}` : null,
      timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '60000', 10),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.getProvider().healthCheck();
    } catch {
      return false;
    }
  }
}

export const aiRegistry = new AIProviderRegistry();

// Convenience function for API routes
export async function analyzeWithAI(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
  return aiRegistry.analyze(request);
}

export { mockAIProvider, httpAIProvider };
export type { AIModelProvider };
