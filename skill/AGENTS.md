# AGENTS.md - Context Query (ctxq) Architecture

## Project Overview

**Name:** Context Query (ctxq)
**Repository:** github.com/l3aro/project-context-query
**Language:** TypeScript (Bun runtime)
**License:** MIT
**Purpose:** Code analysis tool for LLMs with tree-sitter parsing and semantic embeddings

## Core Functionality

### Primary Capabilities

- **Tree-sitter Parsing:** Extract functions, classes, methods from TypeScript, JavaScript, PHP
- **Semantic Embeddings:** Generate code embeddings via Ollama for semantic search
- **Vector Storage:** Store and search embeddings using SQLite + sqlite-vec
- **Call Graph:** Analyze function call relationships
- **Impact Analysis:** Find all callers of a specific function

### Key Components

1. **CLI Layer** (`src/cli.ts`) - Commander.js-based command interface
2. **Commands** (`src/commands/`) - Individual command implementations
3. **Embeddings** (`src/embeddings/`) - Ollama and mock providers
4. **Storage** (`src/storage/vector.ts`) - Vector database (sqlite-vec)
5. **AST** (`src/ast/parser.ts`) - Tree-sitter wrapper
6. **Graph** (`src/graph/`) - Call graph analysis

## Architecture

```
src/
├── cli.ts              # Entry point - Commander instance
├── config.ts           # Config management (.ctxq/config.json)
├── commands/
│   ├── tree.ts        # buildFileTree(path) → FileNode[]
│   ├── structure.ts    # analyzeDirectory(path) → CodeUnit[]
│   ├── calls.ts       # runCalls(path) - build call graph
│   ├── impact.ts       # runImpact(fn, path) - find callers
│   ├── warm.ts        # runWarm({projectPath}) - build index
│   ├── semantic.ts    # runSemantic({projectPath, query})
│   └── config.ts      # runConfig(path)
├── embeddings/
│   ├── index.ts       # createEmbeddingProvider(config)
│   ├── types.ts       # EmbeddingProvider interface
│   ├── ollama.ts      # OllamaEmbeddingProvider
│   └── mock.ts        # MockEmbeddingProvider (dev)
├── storage/
│   └── vector.ts      # createVectorStore(path) → VectorStore
├── graph/
│   └── calls.ts       # buildCallGraph(path)
└── ast/
    └── parser.ts      # parseFile(path), parseCode(code, lang)
```

## Key APIs

### EmbeddingProvider Interface

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
  isAvailable(): Promise<boolean>;
}
```

### CodeUnit Type

```typescript
interface CodeUnit {
  name: string;
  type: 'function' | 'class' | 'method' | 'interface';
  file: string;
  line: number;
}
```

### VectorStore Interface

```typescript
interface VectorStore {
  initialize(dimensions: number): Promise<void>;
  insert(entries: VectorEntry[]): Promise<void>;
  semanticSearch(query: string, limit: number): Promise<SearchResult[]>;
  close(): void;
}
```

## Supported Languages

| Extension | Language    | Parser              |
| --------- | ----------- | ------------------- |
| .ts       | TypeScript  | tree-sitter-typescript |
| .tsx      | TypeScript  | tree-sitter-typescript |
| .js       | JavaScript  | tree-sitter-javascript |
| .jsx      | JavaScript  | tree-sitter-javascript |
| .php      | PHP         | tree-sitter-php     |

## Configuration

### Config File Location

`<project>/.ctxq/config.json`

### Config Schema

```typescript
interface Config {
  embeddings: {
    provider: 'ollama' | 'mock';
    model: string;
    warmModel: string;
    apiKey?: string;
    baseURL: string;  // Ollama URL
  };
}
```

### Default Values

```json
{
  "embeddings": {
    "provider": "mock",
    "model": "nomic-embed-text-v2-moe",
    "warmModel": "nomic-embed-text-v2-moe",
    "apiKey": "",
    "baseURL": "http://localhost:11434"
  }
}
```

## Conventions

- **Runtime:** Bun (NOT Node.js)
- **ESM:** All imports use `.ts` extensions explicitly
- **Formatter:** Biome (2-space indent, single quotes)
- **Tests:** `bun test` with `bun:test`

## Anti-patterns (DO NOT USE)

- `express` - Use `Bun.serve()` instead
- `better-sqlite3` - Use `bun:sqlite` or `sqlite-vec`
- `node:fs` - Use `Bun.file()` instead
- `dotenv` - Bun auto-loads `.env`

## Technical Details

### Embedding Flow

1. `analyzeDirectory()` extracts CodeUnit[] from files
2. For each unit, generate embedding via provider
3. Store in sqlite-vec with metadata (file, line, type)
4. Semantic search queries vector store

### Call Graph Flow

1. Parse all files to extract functions/methods
2. Build graph of call relationships
3. `impact` command finds all units that reference target

### Mock Provider

- Deterministic embeddings for development
- No Ollama required
- Useful for testing without API calls

## Dependencies

| Package | Purpose |
|---------|---------|
| commander | CLI framework |
| tree-sitter | AST parsing |
| tree-sitter-typescript | TS/JS grammar |
| tree-sitter-php | PHP grammar |
| ollama | Embedding API client |
| sqlite-vec | Vector storage |

## Development

```bash
# Install dependencies
bun install

# Run CLI
bun run src/cli.ts <command>

# Test
bun test

# Format
bun run format

# Lint
bun run lint
```

## Limitations

- Tree-sitter may fail on syntax errors
- Call graph is basic (no cross-file scope tracking)
- Impact analysis is simplified (name matching only)
- Embedding quality depends on Ollama model

## Key Insights for AI Agents

### When to Suggest ctxq

- User wants semantic search over codebase
- Need to find function callers/dependencies
- Explore code structure (functions, classes)
- Build vector index for LLM context

### When NOT to Suggest

- Need full IDE features (use LSP instead)
- Real-time code completion
- Refactoring tools

### Integration Patterns

1. **CLI-only:** `bun run src/cli.ts <command>`
2. **Programmatic:** Import and call functions directly
3. **Embed in pipeline:** Use semantic search for RAG context

### Environment

- Requires Bun runtime
- Semantic search needs Ollama running
- Config stored in `.ctxq/` directory
