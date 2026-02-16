import { env, pipeline } from '@huggingface/transformers';
import type { EmbeddingConfig, EmbeddingProvider } from './types';

// Type for the feature extraction pipeline output
interface FeatureExtractionOutput {
  data: Float32Array;
  dims: number[];
}

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;
  private dimensions: number = 256;
  private extractor: Awaited<ReturnType<typeof pipeline>> | null = null;
  private readonly model = 'onnx-community/embeddinggemma-300m-ONNX';

  constructor(config: EmbeddingConfig) {
    this.config = config;
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
    const embeddings: number[][] = [];

    for (const text of texts) {
      const output = (await extractor(text, {
        pooling: 'mean',
        normalize: true,
      })) as FeatureExtractionOutput;
      embeddings.push(Array.from(output.data));
    }

    return embeddings;
  }

  getDimensions(): number {
    return this.dimensions;
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
