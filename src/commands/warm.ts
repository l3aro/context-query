import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { loadConfig } from '../config';
import { createEmbeddingProvider, MockEmbeddingProvider } from '../embeddings';
import { createVectorStore, VectorStore } from '../storage/vector';
import { analyzeDirectory, type CodeUnit } from './structure';

export interface WarmOptions {
  projectPath: string;
  provider?: 'ollama' | 'mock';
  warmModel?: string;
}

export async function runWarm(options: WarmOptions): Promise<void> {
  const { projectPath, warmModel: cliWarmModel } = options;

  // Load config at start
  const config = loadConfig(projectPath);

  // Determine effective warmModel: CLI flag > config.warmModel > default
  const effectiveWarmModel = cliWarmModel || config.embeddings.warmModel;

  console.log(`# Building semantic index for: ${projectPath}`);
  console.log('');

  // Create embedding provider with full config (including apiKey)
  const embeddingProvider = createEmbeddingProvider({
    ...config.embeddings,
    warmModel: cliWarmModel || config.embeddings.warmModel || 'nomic-embed-text-v2-moe',
  });

  console.log(`Using provider: ${embeddingProvider.constructor.name}`);

  // Check availability
  const available = await embeddingProvider.isAvailable();
  if (!available) {
    console.log('Warning: Embedding provider not available, using mock');
  }

  // Analyze project
  console.log('Analyzing code...');
  const units = analyzeDirectory(projectPath);

  if (units.length === 0) {
    console.log('No code units found.');
    return;
  }

  console.log(`Found ${units.length} code units`);

  // Create vector store
  const vectorStore = createVectorStore(projectPath);
  await vectorStore.initialize(embeddingProvider.getDimensions());

  console.log('Generating embeddings...');

  // Build text for embedding
  const entries = [];
  for (const unit of units) {
    // Try to get the actual code
    let content = `${unit.type} ${unit.name}`;
    try {
      const fileContent = readFileSync(join(process.cwd(), unit.file), 'utf-8');
      const lines = fileContent.split('\n');
      // Get surrounding context (5 lines before and after)
      const start = Math.max(0, unit.line - 6);
      const end = Math.min(lines.length, unit.line + 5);
      content = lines.slice(start, end).join('\n');
    } catch {
      // Use basic info if we can't read file
    }

    entries.push({
      id: `${unit.file}:${unit.line}:${unit.name}`,
      content,
      file: unit.file,
      line: unit.line,
      type: unit.type,
      embedding: [], // Will be filled by provider
    });
  }

  // Generate embeddings in batches
  const BATCH_SIZE = 10;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const texts = batch.map((e) => e.content);

    const embeddings = await embeddingProvider.embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      entries[i + j].embedding = embeddings[j];
    }

    const progress = Math.min(i + BATCH_SIZE, entries.length);
    console.log(`  Embedded ${progress}/${entries.length}...`);
  }

  // Store in vector DB
  console.log('Storing in vector database...');
  await vectorStore.insert(entries);

  console.log('');
  console.log(`✓ Indexed ${entries.length} code units`);
  console.log(`✓ Stored in ${projectPath}/.ctxq/vectors.db`);

  vectorStore.close();
}
