# SKILLS.md - Context Query (ctxq) Usage Guide

## Overview

ctxq is a code analysis tool for LLMs that provides:
- **Tree-sitter parsing** for TypeScript, JavaScript, and PHP
- **Semantic embeddings** via Ollama for codebase search
- **Call graph analysis** to find function dependencies
- **Vector storage** using SQLite + sqlite-vec

## Prerequisites

- Bun runtime installed
- For semantic search: Ollama running with embedding model (`ollama serve`)

## CLI Commands

### 1. File Structure (tree)

Show directory structure:

```bash
bun run src/cli.ts tree [path]
```

Output:
```
src/
├── cli.ts
├── config.ts
├── commands/
│   ├── tree.ts
│   ├── structure.ts
│   └── ...
```

### 2. Code Structure (structure)

List all functions and classes:

```bash
bun run src/cli.ts structure [path]
```

Output:
```
function buildFileTree (src/commands/tree.ts:4)
class Command (src/cli.ts:11)
function parseFile (src/ast/parser.ts:41)
```

### 3. Call Graph (calls)

Build function call relationships:

```bash
bun run src/cli.ts calls [path]
```

### 4. Impact Analysis (impact)

Find all functions that call a specific function:

```bash
bun run src/cli.ts impact <functionName> [path]
```

Example:
```bash
bun run src/cli.ts impact parseFile
```

Output:
```
# Impact: Who uses "parseFile"

function analyzeDirectory (src/commands/structure.ts:31)
function runCalls (src/commands/calls.ts:45)
```

### 5. Semantic Index (warm)

Build semantic embedding index for code:

```bash
bun run src/cli.ts warm [path]
```

This:
- Parses all code files
- Generates embeddings for each function/class
- Stores in `.ctxq/vectors.db`

Options:
- `--provider ollama|mock` - Embedding provider (default: mock)
- `--warmModel <name>` - Ollama embedding model

### 6. Semantic Search (semantic)

Search code semantically using embeddings:

```bash
bun run src/cli.ts semantic "<query>" [path]
```

Example:
```bash
bun run src/cli.ts semantic "authentication middleware"
```

Returns functions/classes related to the query semantically.

### 7. Configuration (config)

View/edit configuration:

```bash
bun run src/cli.ts config [path]
```

Config stored in `.ctxq/config.json`.

## Programmatic API

### Embedding Provider

```typescript
import { createEmbeddingProvider, MockEmbeddingProvider, OllamaEmbeddingProvider } from './embeddings/index.ts';

// Create provider
const provider = createEmbeddingProvider({
  provider: 'ollama',  // or 'mock'
  model: 'nomic-embed-text-v2-moe',
  apiKey: 'optional',
});

// Check availability
const available = await provider.isAvailable();

// Generate single embedding
const embedding = await provider.embed('your text here');

// Generate batch embeddings
const embeddings = await provider.embedBatch(['text1', 'text2', 'text3']);

// Get dimensions
const dimensions = provider.getDimensions();
```

### AST Parsing

```typescript
import { parseFile, getLanguageFromExtension } from './ast/parser.ts';

// Parse a file
const tree = parseFile('src/cli.ts');

// Get language from extension
const lang = getLanguageFromExtension('src/cli.ts');  // 'typescript'
```

Supported languages: `.ts`, `.tsx`, `.js`, `.jsx`, `.php`

### Code Structure Analysis

```typescript
import { analyzeDirectory } from './commands/structure.ts';

const units = analyzeDirectory('./src');

for (const unit of units) {
  console.log(`${unit.type} ${unit.name} (${unit.file}:${unit.line})`);
}

// Unit types: 'function', 'class', 'method', 'interface'
```

### Vector Store

```typescript
import { createVectorStore } from './storage/vector.ts';

const store = createVectorStore('./my-project');
await store.initialize(1024);  // embedding dimensions

// Insert entries
await store.insert([
  {
    id: 'src/cli.ts:1:main',
    content: 'function main() {...}',
    file: 'src/cli.ts',
    line: 1,
    type: 'function',
    embedding: [0.1, 0.2, ...],  // 1024 dims
  },
]);

// Semantic search
const results = await store.semanticSearch('authentication', 5);

// Results: [{ id, content, file, line, type, similarity }]
```

## Semantic Search Workflow

### Step 1: Build Index

```bash
# Option A: Use mock embeddings (no Ollama needed)
bun run src/cli.ts warm

# Option B: Use Ollama embeddings
bun run src/cli.ts warm --provider ollama --warmModel nomic-embed-text-v2-moe
```

### Step 2: Search

```bash
bun run src/cli.ts semantic "user authentication" .
```

## Call Graph Workflow

### Build Graph

```bash
bun run src/cli.ts calls .
```

### Find Impact

```bash
bun run src/cli.ts impact validateToken .
```

## Configuration

Config file: `.ctxq/config.json`

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

## Common Patterns

### When to Use Each Command

| Task | Command |
|------|---------|
| Explore codebase structure | `ctxq tree` |
| Find specific function | `ctxq structure` + grep |
| Understand function dependencies | `ctxq calls` then `ctxq impact <fn>` |
| Search by functionality (not keywords) | `ctxq warm` then `ctxq semantic` |
| Find where function is called | `ctxq impact <functionName>` |

### Performance Tips

1. **Mock provider** for development - no API needed
2. **Batch embeddings** - use `embedBatch()` not loop of `embed()`
3. **Incremental warm** - currently rebuilds entire index

## Troubleshooting

### "Embedding provider not available"

- Ensure Ollama is running: `ollama serve`
- Or use mock provider: `--provider mock`

### "No code units found"

- Check path is correct
- Ensure files are .ts, .js, or .php

### "Vector store not initialized"

- Run `ctxq warm` first to build index

### Parse errors

- tree-sitter may fail on syntax errors
- Check file syntax is valid

## Quick Reference

```bash
# Quick start
bun run src/cli.ts tree
bun run src/cli.ts structure
bun run src/cli.ts warm
bun run src/cli.ts semantic "search query"

# Programmatic
import { createEmbeddingProvider } from './embeddings/index.ts';
import { analyzeDirectory } from './commands/structure.ts';
import { createVectorStore } from './storage/vector.ts';
```

## Related Documentation

- [AGENTS.md](AGENTS.md) - Architecture and design details
- [README.md](../README.md) - Project overview
