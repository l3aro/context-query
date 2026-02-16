import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config';
import { createEmbeddingProvider } from '../embeddings';
import { extractDFG } from '../graph/dfg';
import { createVectorStore, type VectorEntry } from '../storage/vector';
import { analyzeDirectory } from './structure';

export interface WarmOptions {
  projectPath: string;
  provider?: 'ollama' | 'mock' | 'huggingface';
  warmModel?: string;
}

export async function runWarm(options: WarmOptions): Promise<void> {
  const { projectPath, warmModel: cliWarmModel, provider: cliProvider } = options;
  const configPath = join(projectPath, '.ctxq', 'config.json');
  const configExists = existsSync(configPath);

  const timers: Record<string, number> = {};
  const start = () => {
    timers[`_${Date.now()}`] = Date.now();
  };
  const lap = (name: string) => {
    const keys = Object.keys(timers).filter((k) => k.startsWith('_'));
    const last = keys[keys.length - 1];
    if (last) {
      const elapsed = (Date.now() - timers[last]) / 1000;
      console.log(`  [${elapsed.toFixed(2)}s] ${name}`);
      delete timers[last];
    }
  };

  start();

  // No config file and no CLI provider - run interview
  if (!configExists && !cliProvider) {
    console.log('# Welcome to context-query!');
    console.log('');
    console.log("No config found. Let's set up your embedding provider.");
    console.log('');
    console.log('Available providers:');
    console.log('  1. mock    - No setup needed (for development)');
    console.log('  2. ollama  - Requires Ollama running locally');
    console.log('  3. huggingface - Downloads model (~300MB) on first use');
    console.log('');
    console.log('Run with: ctxq warm . --provider <choice>');
    console.log('Example: ctxq warm . --provider mock');
    return;
  }

  // Load config at start
  const config = loadConfig(projectPath);
  lap('Load config');

  // Determine effective provider: CLI flag > config > default
  const effectiveProvider = cliProvider || config.embeddings.provider || 'mock';

  console.log(`# Building semantic index for: ${projectPath}`);
  console.log('');

  // Create embedding provider with full config (including apiKey)
  const embeddingProvider = createEmbeddingProvider({
    ...config.embeddings,
    provider: effectiveProvider,
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
  start();
  const units = analyzeDirectory(projectPath);
  lap('Analyze code');

  if (units.length === 0) {
    console.log('No code units found.');
    return;
  }

  console.log(`Found ${units.length} code units`);

  start();

  // Create vector store
  const vectorStore = createVectorStore(projectPath);
  await vectorStore.initialize(
    embeddingProvider.getDimensions(),
    embeddingProvider.getModel?.() || effectiveProvider,
  );

  console.log('Generating embeddings...');

  // Build text for embedding
  const entries: VectorEntry[] = [];
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

      // Extract DFG summary for function-type units
      if (unit.type === 'function' || unit.type === 'method') {
        const dfgInfo = extractDFG(unit.file, unit.name);
        const varCount = dfgInfo.varRefs.length;
        const edgeCount = dfgInfo.dataflowEdges.length;
        content += `\n\nvars:${varCount}, def-use chains:${edgeCount}`;
      }
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

  lap('Build entries');

  start();

  const BATCH_SIZE = 64;
  const CONCURRENCY = 6;

  const hashContent = (content: string): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(16);
  };

  const chunks: VectorEntry[][] = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    chunks.push(entries.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  let cacheHits = 0;
  const processChunk = async (chunk: VectorEntry[]): Promise<void> => {
    const textsToEmbed: { index: number; text: string; hash: string }[] = [];

    for (let j = 0; j < chunk.length; j++) {
      const entry = chunk[j];
      if (!entry) continue;
      const contentHash = hashContent(entry.content);
      const cached = await vectorStore.getCachedEmbedding(contentHash);
      if (cached) {
        entry.embedding = cached;
        cacheHits++;
      } else {
        textsToEmbed.push({ index: j, text: entry.content, hash: contentHash });
      }
    }

    if (textsToEmbed.length > 0) {
      const texts = textsToEmbed.map((t) => t.text);
      const embeddings = await embeddingProvider.embedBatch(texts);

      for (let k = 0; k < textsToEmbed.length; k++) {
        const t = textsToEmbed[k];
        const embedding = embeddings[k];
        const targetEntry = chunk[t?.index ?? -1];
        if (!t || !embedding || !targetEntry) continue;
        targetEntry.embedding = embedding;
        await vectorStore.cacheEmbedding(t.hash, embedding);
      }
    }

    processed += chunk.length;
    console.log(`  Embedded ${processed}/${entries.length} (cache: ${cacheHits})...`);
  };

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const chunkGroup = chunks.slice(i, i + CONCURRENCY);
    await Promise.all(chunkGroup.map((chunk) => processChunk(chunk)));
  }

  console.log(`  Cache hits: ${cacheHits}/${entries.length}`);

  lap('Generate embeddings');

  // Deduplicate entries by ID (some functions may appear multiple times)
  const uniqueEntries = Array.from(new Map(entries.map((e) => [e.id, e])).values());

  if (uniqueEntries.length < entries.length) {
    console.log(`  Deduplicated ${entries.length - uniqueEntries.length} duplicate entries`);
  }

  // Store in vector DB
  console.log('Storing in vector database...');
  start();
  await vectorStore.clear();
  await vectorStore.insert(uniqueEntries);
  lap('Store in vector DB');

  console.log('');
  console.log(`✓ Indexed ${uniqueEntries.length} code units`);
  console.log(`✓ Stored in ${projectPath}/.ctxq/vectors.db`);

  vectorStore.close();
}
