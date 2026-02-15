import { EmbeddingProvider, EmbeddingConfig } from './types';

interface OllamaEmbedResponse {
  embeddings: number[][];
  model: string;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;
  private dimensions: number = 768; // Default, will be updated on first call
  
  constructor(config: EmbeddingConfig) {
    this.config = config;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await this.callOllama([text], this.config.searchModel);
    return response.embeddings[0];
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.callOllama(texts, this.config.warmModel);
    return response.embeddings;
  }
  
  getDimensions(): number {
    return this.dimensions;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private async callOllama(texts: string[], model: string): Promise<OllamaEmbedResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    
    const data: OllamaEmbedResponse = await response.json();
    
    // Try to get dimensions from first embedding if available
    if (data.embeddings && data.embeddings[0]) {
      this.dimensions = data.embeddings[0].length;
    }
    
    return data;
  }
}
