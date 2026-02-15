export interface EmbeddingProvider {
  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;
  
  /**
   * Generate embeddings for multiple texts
   */
  embedBatch(texts: string[]): Promise<number[][]>;
  
  /**
   * Get the dimension of embeddings this provider produces
   */
  getDimensions(): number;
  
  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>;
}

export interface EmbeddingConfig {
  provider: 'ollama' | 'mock';
  warmModel: string;   // Model for indexing
  searchModel: string; // Model for search queries
  baseUrl: string;     // Ollama base URL
  apiKey?: string;     // Optional API key
}

export const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'mock',
  warmModel: 'nomic-embed-text-v2-moe',
  searchModel: 'embeddinggemma',
  baseUrl: 'http://localhost:11434',
};
