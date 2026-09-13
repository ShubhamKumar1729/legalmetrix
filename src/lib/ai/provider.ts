import type { AIModelProvider } from './types';
import { mockAIProvider } from './mock-provider';
import { httpAIProvider } from './http-provider';

/**
 * AI provider registry.
 *
 *   Frontend -> API route -> analyzeWithAI() -> registered provider
 *
 * `development` (default) runs the pipeline without a model. Set AI_PROVIDER=http with
 * AI_SERVICE_URL to run the real vision model — no other code changes are needed.
 */
class AIProviderRegistry {
  private providers = new Map<string, AIModelProvider>();
  private defaultProvider: string;

  constructor() {
    this.register('development', mockAIProvider);
    this.register('http', httpAIProvider);
    const configured = (process.env.AI_PROVIDER || 'development').trim().toLowerCase();
    this.defaultProvider = configured === 'mock' ? 'development' : configured;
  }

  register(name: string, provider: AIModelProvider) {
    this.providers.set(name, provider);
  }

  list(): { name: string; version: string; development: boolean }[] {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      version: provider.version,
      development: provider.isDevelopmentProvider === true,
    }));
  }

  get(name?: string): AIModelProvider {
    const key = (name || this.defaultProvider).toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      console.warn(`[ai] unknown provider "${key}" — falling back to the development provider`);
      return mockAIProvider;
    }
    return provider;
  }

  isDevelopmentProvider(name?: string): boolean {
    return this.get(name).isDevelopmentProvider === true;
  }
}

export const aiRegistry = new AIProviderRegistry();

export function currentAIProvider(): AIModelProvider {
  return aiRegistry.get();
}

export function isDevelopmentAI(): boolean {
  return aiRegistry.isDevelopmentProvider();
}

export { mockAIProvider, httpAIProvider };
export type { AIModelProvider };
