import { env, pipeline } from '@huggingface/transformers';
import type { EmbeddingConfig, EmbeddingProvider } from './types';

// Type for the feature extraction pipeline output
interface FeatureExtractionOutput {
  data: Float32Array;
  dims: number[];
}

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number = 768;
  private extractor: Awaited<ReturnType<typeof pipeline>> | null = null;
  private readonly model = 'onnx-community/embeddinggemma-300m-ONNX';

  constructor(_config: EmbeddingConfig) {
    // WebGPU backend for Bun compatibility
    if (env.backends?.onnx?.wasm) {
      (env.backends.onnx.wasm as { enabled: boolean }).enabled = false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = (await extractor(text, {
      pooling: 'mean',
      normalize: true,
    })) as FeatureExtractionOutput;
    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const extractor = await this.getExtractor();

    const processText = async (text: string): Promise<number[]> => {
      const output = (await extractor(text, {
        pooling: 'mean',
        normalize: true,
      })) as FeatureExtractionOutput;
      return Array.from(output.data);
    };

    const CONCURRENCY = 8;
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const embeddings = await Promise.all(batch.map((t) => processText(t)));
      results.push(...embeddings);
    }

    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to load the pipeline - if it succeeds, the provider is available
      await this.getExtractor();
      return true;
    } catch {
      return false;
    }
  }

  private async getExtractor(): Promise<Awaited<ReturnType<typeof pipeline>>> {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', this.model);
    }
    return this.extractor;
  }
}
