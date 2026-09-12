import type { AIModelProvider, AIAnalyzeRequest, AIAnalyzeResponse } from './types';
import { mockAIProvider } from './mock-provider';

/**
 * AI Provider Factory
 * 
 * Architecture:
 * Frontend -> Backend API -> AI Adapter -> Provider (Mock or Real)
 * 
 * Future real model integration:
 * 1. Implement AIModelProvider interface
 * 2. Set AI_PROVIDER env var to 'real' or custom
 * 3. Configure AI_SERVICE_URL and AI_SERVICE_KEY
 * 4. No frontend changes needed
 */

export type AIProviderType = 'mock' | 'real' | 'custom';

class AIProviderRegistry {
  private providers: Map<string, AIModelProvider> = new Map();
  private defaultProvider: string = 'mock';

  constructor() {
    this.register('mock', mockAIProvider);
    this.defaultProvider = process.env.AI_PROVIDER || 'mock';
  }

  register(name: string, provider: AIModelProvider) {
    this.providers.set(name, provider);
  }

  getProvider(name?: string): AIModelProvider {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.warn(`AI provider ${providerName} not found, falling back to mock`);
      return mockAIProvider;
    }
    return provider;
  }

  async analyze(request: AIAnalyzeRequest, providerName?: string): Promise<AIAnalyzeResponse> {
    const provider = this.getProvider(providerName);
    
    try {
      const result = await provider.analyze(request);
      return result;
    } catch (error) {
      console.error(`AI Provider ${providerName} failed:`, error);
      // Fallback to mock for resilience in demo mode
      if (providerName !== 'mock' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        console.log('Falling back to mock provider');
        return mockAIProvider.analyze(request);
      }
      throw error;
    }
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const aiRegistry = new AIProviderRegistry();

// Convenience function for API routes
export async function analyzeWithAI(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
  return aiRegistry.analyze(request);
}

export { mockAIProvider };
export type { AIModelProvider };
