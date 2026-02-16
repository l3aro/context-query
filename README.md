# context-query

Code analysis CLI tool for LLMs. Parses code with tree-sitter, builds semantic embeddings via Ollama, enables semantic search over codebase.

## Install

```bash
# Global install (after npm publish)
npm install -g context-query
ctxq --help

# Or use without install
bunx context-query --help
```

## Usage

```bash
# Build file tree
ctxq tree

# List functions/classes in a directory
ctxq structure

# Build call graph
ctxq calls

# Find callers of a function
ctxq impact <function-name>

# Build semantic index
ctxq warm

# Semantic search
ctxq semantic <query>
```

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run start -- tree
# or
bunx context-query tree

# Format & lint
bun run format
bun run lint

# Build for publish
bun run build

# Test
bun test
```

## Commands

| Command | Description |
|---------|-------------|
| `tree` | Show file structure |
| `structure` | List functions/classes |
| `calls` | Build call graph |
| `impact <fn>` | Find callers |
| `warm` | Build semantic index |
| `semantic <q>` | Semantic search |

## Configuration

Config stored in `.ctxq/config.json`

- Default embedding provider: `MockEmbeddingProvider` (no API key needed)
- Uses Ollama when configured
