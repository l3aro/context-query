import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config';
import { createEmbeddingProvider } from '../embeddings';
import { extractDFG } from '../graph/dfg';
import { createVectorStore } from '../storage/vector';
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
