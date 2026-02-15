# src/embeddings

Embedding providers for semantic search.

## FILES

| File | Purpose |
|------|---------|
| `index.ts` | Factory: `createEmbeddingProvider(config?)` |
| `types.ts` | `EmbeddingProvider` interface, `EmbeddingConfig` |
| `ollama.ts` | `OllamaEmbeddingProvider` - real embeddings |
| `mock.ts` | `MockEmbeddingProvider` - deterministic for dev |

## USAGE

```ts
import { createEmbeddingProvider } from './embeddings/index.ts';

const provider = createEmbeddingProvider({
  provider: 'ollama',  // or 'mock'
  model: 'nomic-embed-text',
});
```

## ADD PROVIDER

1. Implement `EmbeddingProvider` interface from `types.ts`
2. Export class from new file
3. Add to `createEmbeddingProvider` factory in `index.ts`
