import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

export interface VectorEntry {
  id: string;
  content: string;
  file: string;
  line: number;
  type: string; // function, class, method
  embedding: number[];
}

export interface SearchResult {
  id: string;
  content: string;
  file: string;
  line: number;
  type: string;
  score: number;
}

// Simple in-memory vector store with JSON persistence
export class VectorStore {
  private entries: VectorEntry[] = [];
  private dbPath: string;
  private dimensions: number = 768;
  
  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }
  
  async initialize(dimensions: number = 768): Promise<void> {
    this.dimensions = dimensions;
    
    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    // Try to load existing data
    this.load();
    
    console.log(`Vector store initialized with ${this.entries.length} entries`);
  }
  
  private load(): void {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.entries = parsed.entries || [];
        this.dimensions = parsed.dimensions || 768;
      }
    } catch (e) {
      // Start fresh
      this.entries = [];
    }
  }
  
  private save(): void {
    try {
      writeFileSync(this.dbPath, JSON.stringify({
        entries: this.entries,
        dimensions: this.dimensions,
      }, null, 2));
    } catch (e) {
      console.error('Failed to save vector store:', e);
    }
  }
  
  async insert(newEntries: VectorEntry[]): Promise<void> {
    // Remove existing entries with same ID
    const existingIds = new Set(newEntries.map(e => e.id));
    this.entries = this.entries.filter(e => !existingIds.has(e.id));
    
    // Add new entries
    this.entries.push(...newEntries);
    
    // Save to disk
    this.save();
  }
  
  async search(queryEmbedding: number[], k: number = 10): Promise<SearchResult[]> {
    // Compute cosine similarity for each entry
    const results = this.entries.map(entry => {
      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      return {
        id: entry.id,
        content: entry.content,
        file: entry.file,
        line: entry.line,
        type: entry.type,
        score: 1 - score, // Convert similarity to distance
      };
    });
    
    // Sort by score (lower is better = more similar)
    results.sort((a, b) => a.score - b.score);
    
    return results.slice(0, k);
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async clear(): Promise<void> {
    this.entries = [];
    this.save();
  }
  
  close(): void {
    // Nothing to close for in-memory store
  }
}

export function createVectorStore(projectPath: string): VectorStore {
  const ctxqDir = join(projectPath, '.ctxq');
  return new VectorStore(join(ctxqDir, 'vectors.json'));
}
