import type { EmbeddingProvider } from './types';

// Mock provider for development without Ollama credentials
export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number;
  private modelName: string;

  constructor(dimensions: number = 768, modelName: string = 'mock') {
    this.dimensions = dimensions;
    this.modelName = modelName;
  }

  async embed(text: string): Promise<number[]> {
    // Generate deterministic random vector based on text hash
    const hash = this.hashString(text);
    const random = this.seededRandom(hash);

    // Generate normalized random vector
    const vector: number[] = [];
    let sum = 0;

    for (let i = 0; i < this.dimensions; i++) {
      const val = random() * 2 - 1; // -1 to 1
      vector.push(val);
      sum += val * val;
    }

    // Normalize
    const magnitude = Math.sqrt(sum);
    return vector.map((v) => v / magnitude);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const hash = this.hashString(text);
      const random = this.seededRandom(hash);

      let sum = 0;
      const vector: number[] = [];
      for (let i = 0; i < this.dimensions; i++) {
        const val = random() * 2 - 1;
        vector.push(val);
        sum += val * val;
      }

      const magnitude = Math.sqrt(sum);
      results.push(vector.map((v) => v / magnitude));
    }
    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.modelName;
  }

  async isAvailable(): Promise<boolean> {
    // Mock is always available
    return true;
  }

  // Simple string hash for deterministic vectors
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Seeded random number generator
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }
}
