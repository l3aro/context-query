import { MockEmbeddingProvider } from './mock';
import { OllamaEmbeddingProvider } from './ollama';
import type { EmbeddingConfig, EmbeddingProvider } from './types';
import { DEFAULT_CONFIG } from './types';

export type { EmbeddingProvider, EmbeddingConfig };
export { DEFAULT_CONFIG };
export { MockEmbeddingProvider } from './mock';
export { OllamaEmbeddingProvider } from './ollama';

export function createEmbeddingProvider(config?: Partial<EmbeddingConfig>): EmbeddingProvider {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  switch (finalConfig.provider) {
    case 'ollama':
      return new OllamaEmbeddingProvider(finalConfig);
    default:
      return new MockEmbeddingProvider();
  }
}
