import { describe, expect, test } from 'bun:test';
import {
  createEmbeddingProvider,
  DEFAULT_CONFIG,
  MockEmbeddingProvider,
} from '../src/embeddings/index';

describe('embeddings', () => {
  test('createEmbeddingProvider returns MockEmbeddingProvider by default', () => {
    const provider = createEmbeddingProvider();
    expect(provider.constructor.name).toBe('MockEmbeddingProvider');
  });

  test('MockEmbeddingProvider returns 768-dim embeddings', async () => {
    const provider = new MockEmbeddingProvider();
    expect(provider.getDimensions()).toBe(768);

    const embedding = await provider.embed('test');
    expect(embedding).toHaveLength(768);
  });

  test('MockEmbeddingProvider returns consistent embeddings for same text', async () => {
    const provider = new MockEmbeddingProvider();

    const emb1 = await provider.embed('hello world');
    const emb2 = await provider.embed('hello world');

    // Should be very close (deterministic)
    for (let i = 0; i < emb1.length; i++) {
      expect(emb1[i]).toBeCloseTo(emb2[i], 5);
    }
  });

  test('MockEmbeddingProvider is always available', async () => {
    const provider = new MockEmbeddingProvider();
    expect(await provider.isAvailable()).toBe(true);
  });

  test('DEFAULT_CONFIG has correct values', () => {
    expect(DEFAULT_CONFIG.provider).toBe('mock');
    expect(DEFAULT_CONFIG.warmModel).toBe('nomic-embed-text-v2-moe');
    expect(DEFAULT_CONFIG.searchModel).toBe('embeddinggemma');
    expect(DEFAULT_CONFIG.baseUrl).toBe('http://localhost:11434');
  });
});
