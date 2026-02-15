import { createEmbeddingProvider } from '../embeddings';
import { createVectorStore } from '../storage/vector';

export interface SemanticOptions {
  projectPath: string;
  query: string;
  provider?: 'ollama' | 'mock';
  searchModel?: string;
  limit?: number;
}

export async function runSemantic(options: SemanticOptions): Promise<void> {
  const {
    projectPath,
    query,
    provider = 'mock',
    searchModel = 'embeddinggemma',
    limit = 10,
  } = options;

  console.log(`# Semantic search: "${query}"`);
  console.log('');

  // Create embedding provider
  const embeddingProvider = createEmbeddingProvider({
    provider,
    searchModel,
  });

  // Check availability
  const available = await embeddingProvider.isAvailable();
  if (!available) {
    console.log('Warning: Embedding provider not available, using mock');
  }

  // Create vector store
  const vectorStore = createVectorStore(projectPath);

  try {
    await vectorStore.initialize(embeddingProvider.getDimensions());
  } catch (e) {
    console.log('Error: Vector store not initialized. Run "ctxq warm" first.');
    return;
  }

  // Generate query embedding
  console.log('Generating query embedding...');
  const queryEmbedding = await embeddingProvider.embed(query);

  // Search
  console.log('Searching...');
  const results = await vectorStore.search(queryEmbedding, limit);

  if (results.length === 0) {
    console.log('No results found. Try running "ctxq warm" first.');
    return;
  }

  console.log('');
  console.log(`## Results (${results.length} found):`);
  console.log('');

  for (const result of results) {
    console.log(`### ${result.type} ${result.id.split(':').pop()}`);
    console.log(`File: ${result.file}:${result.line}`);
    console.log(`Score: ${(1 - result.score).toFixed(3)}`);
    console.log('');
    console.log('```');
    // Show first few lines of content
    const lines = result.content.split('\n').slice(0, 10);
    console.log(lines.join('\n'));
    console.log('```');
    console.log('');
  }

  vectorStore.close();
}
