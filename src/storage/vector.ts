import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as sqliteVec from 'sqlite-vec';

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

// SQLite vector store using sqlite-vec
export class VectorStore {
  private db: Database | null = null;
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

    // Open database
    this.db = new Database(this.dbPath);

    // Load sqlite-vec extension
    sqliteVec.load(this.db);

    // Create virtual table if not exists
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vectors USING vec0(
        id TEXT PRIMARY KEY,
        content TEXT,
        file TEXT,
        line INTEGER,
        type TEXT,
        embedding float[${this.dimensions}]
      );
    `);

    // Get count for logging
    const count = this.db.query('SELECT COUNT(*) as count FROM vectors').get() as {
      count: number;
    };
    console.log(`Vector store initialized with ${count.count} entries`);
  }

  async insert(newEntries: VectorEntry[]): Promise<void> {
    if (!this.db) {
      throw new Error('Vector store not initialized');
    }

    // Use transaction for batch insert (much faster)
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO vectors (id, content, file, line, type, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const entry of newEntries) {
        // Convert embedding to Uint8Array for sqlite-vec
        const embeddingBuffer = new Uint8Array(new Float32Array(entry.embedding).buffer);
        insertStmt.run(
          entry.id,
          entry.content,
          entry.file,
          entry.line,
          entry.type,
          embeddingBuffer,
        );
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async search(queryEmbedding: number[], k: number = 10): Promise<SearchResult[]> {
    if (!this.db) {
      throw new Error('Vector store not initialized');
    }

    // Convert query embedding to Uint8Array for sqlite-vec
    const queryBuffer = new Uint8Array(new Float32Array(queryEmbedding).buffer);

    // Use vec_search for similarity search
    const rows = this.db
      .query(
        `
        SELECT id, content, file, line, type, distance 
        FROM vectors 
        WHERE embedding MATCH ? 
        ORDER BY distance 
        LIMIT ?
      `,
      )
      .all(queryBuffer, k) as Array<{
      id: string;
      content: string;
      file: string;
      line: number;
      type: string;
      distance: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      file: row.file,
      line: row.line,
      type: row.type,
      score: row.distance, // distance is already the distance metric
    }));
  }

  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Vector store not initialized');
    }

    this.db.exec('DELETE FROM vectors');
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export function createVectorStore(projectPath: string): VectorStore {
  const ctxqDir = join(projectPath, '.ctxq');
  return new VectorStore(join(ctxqDir, 'vectors.db'));
}
