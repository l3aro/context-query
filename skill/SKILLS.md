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
- `--provider ollama|huggingface|mock` - Embedding provider (default: mock)
- `--warmModel <name>` - Embedding model name

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

Options:
- `--provider ollama|huggingface|mock` - Embedding provider

### 7. Configuration (config)

View/edit configuration:

```bash
bun run src/cli.ts config [path]
```

Config stored in `.ctxq/config.json`.

### 8. Complexity Analysis (complexity)

Calculate cyclomatic complexity for functions:

```bash
bun run src/cli.ts complexity <file> [functionName]
```

Examples:
```bash
# All functions in file
bun run src/cli.ts complexity src/cli.ts

# Specific function
bun run src/cli.ts complexity src/cli.ts parse
```

Output:
```
parseFile: complexity:3, blocks:4
buildFileTree: complexity:2, blocks:2
```

### 9. Data Flow Graph (dfg)

Extract data flow graph for a function:

```bash
bun run src/cli.ts dfg <file> <functionName>
```

Example:
```bash
bun run src/cli.ts dfg src/cli.ts parse
```

Returns:
- Variables used in the function
- Variable references (definition and usage locations)
- Data flow edges (how data flows between definitions and uses)

### 10. Program Slicing (slice)

Find code that affects or is affected by a specific line:

```bash
bun run src/cli.ts slice <file> <function> <line> [options]
```

Options:
- `--direction backward|forward` - Slice direction (default: backward)
- `--var <variable>` - Trace specific variable only
- `--lang <language>` - Language (auto-detected from extension)

Examples:
```bash
# Backward slice - what affects line 42
bun run src/cli.ts slice src/cli.ts parse 42

# Forward slice - what is affected by line 42
bun run src/cli.ts slice src/cli.ts parse 42 --direction forward

# Trace specific variable
bun run src/cli.ts slice src/cli.ts parse 42 --var config
```

Backward slice finds all statements that could affect the target line.
Forward slice finds all statements that could be affected by the target line.

### 11. Import Analysis (imports)

Parse imports from a source file:

```bash
bun run src/cli.ts imports <file> [--lang <language>]
```

Example:
```bash
bun run src/cli.ts imports src/cli.ts
```

Returns:
```json
{
  "file": "src/cli.ts",
  "imports": [
    { "name": "Command", "type": "default", "source": "commander" },
    { "name": "runCalls", "type": "named", "source": "./commands/calls" }
  ]
}
```

## Programmatic API

### Embedding Provider

```typescript
import { createEmbeddingProvider, MockEmbeddingProvider, OllamaEmbeddingProvider, HuggingFaceEmbeddingProvider } from './embeddings/index.ts';

// Create provider - supports 'ollama', 'huggingface', or 'mock'
const provider = createEmbeddingProvider({
  provider: 'ollama',  // or 'huggingface', 'mock'
  model: 'nomic-embed-text-v2-moe',
  apiKey: 'optional',  // Required for HuggingFace
  baseURL: 'http://localhost:11434',  // For Ollama
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

## Complexity Analysis

### Calculate Complexity

```bash
# All functions in a file
bun run src/cli.ts complexity src/commands/structure.ts

# Specific function
bun run src/cli.ts complexity src/commands/structure.ts analyzeDirectory
```

### Understanding Complexity

Cyclomatic complexity measures the number of linearly independent paths through code:

| Complexity | Risk Level |
|------------|------------|
| 1-10 | Low - simple, well-structured |
| 11-20 | Moderate - more complex |
| 21+ | High - consider refactoring |

## Data Flow Analysis

### Data Flow Graph (DFG)

Shows how data moves through a function:

```bash
bun run src/cli.ts dfg src/cli.ts parse
```

Returns:
- Variables defined and used
- Data flow edges (definition → use relationships)

### Program Slicing

Backward slice: Find statements that affect a target line
```bash
bun run src/cli.ts slice src/cli.ts parse 42
```

Forward slice: Find statements affected by a target line
```bash
bun run src/cli.ts slice src/cli.ts parse 42 --direction forward
```

Variable-specific slice: Trace a specific variable
```bash
bun run src/cli.ts slice src/cli.ts parse 42 --var config
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

### Provider Options

| Provider | Description | API Key Required |
|----------|-------------|-----------------|
| `mock` | Deterministic embeddings for development | No |
| `ollama` | Local Ollama server | No |
| `huggingface` | Local ONNX model (WebGPU) | No |

## Common Patterns

### When to Use Each Command

| Task | Command |
|------|---------|
| Explore codebase structure | `ctxq tree` |
| Find specific function | `ctxq structure` + grep |
| Understand function dependencies | `ctxq calls` then `ctxq impact <fn>` |
| Search by functionality (not keywords) | `ctxq warm` then `ctxq semantic` |
| Find where function is called | `ctxq impact <functionName>` |
| Measure code complexity | `ctxq complexity <file>` |
| Trace variable data flow | `ctxq dfg <file> <fn>` |
| Find code affecting a line | `ctxq slice <file> <fn> <line>` |

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
bun run src/cli.ts complexity src/cli.ts
bun run src/cli.ts dfg src/cli.ts parse
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
