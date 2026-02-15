# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-15
**Commit:** 4af61ff
**Branch:** main

## OVERVIEW

Code analysis CLI tool for LLMs. Parses code with tree-sitter, builds semantic embeddings via Ollama, enables semantic search over codebase.

## STRUCTURE

```
./
├── src/
│   ├── cli.ts           # Entry point (ctxq bin)
│   ├── config.ts        # Config management
│   ├── commands/        # CLI commands (tree, structure, calls, impact, warm, semantic)
│   ├── embeddings/      # Ollama + mock providers
│   ├── storage/         # Vector store
│   ├── graph/           # Call graph
│   └── ast/             # Tree-sitter parser
└── tests/               # Test files
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add CLI command | `src/commands/` | Export from `src/cli.ts` |
| Embedding provider | `src/embeddings/` | Implement `EmbeddingProvider` interface |
| Config | `src/config.ts` | `.ctxq/config.json` |
| AST parsing | `src/ast/parser.ts` | Tree-sitter (TS, JS, PHP) |
| Vector storage | `src/storage/vector.ts` | SQLite + sqlite-vec |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `program` | Command | `src/cli.ts:11` | Commander instance |
| `buildFileTree` | function | `src/commands/tree.ts` | File tree builder |
| `analyzeDirectory` | function | `src/commands/structure.ts` | AST function extraction |
| `createEmbeddingProvider` | function | `src/embeddings/index.ts` | Factory |
| `parseFile` | function | `src/ast/parser.ts` | Tree-sitter wrapper |

## CONVENTIONS

- **Runtime**: Bun (NOT Node.js)
- **ESM**: All imports use `.ts` extensions explicitly
- **Formatter**: Biome (2-space, single quotes)
- **Tests**: `bun test` with `bun:test`

## ANTI-PATTERNS (THIS PROJECT)

- DO NOT use `express` - use `Bun.serve()`
- DO NOT use `better-sqlite3` - use `bun:sqlite` or `sqlite-vec`
- DO NOT use `node:fs` - prefer `Bun.file()`
- DO NOT use `dotenv` - Bun auto-loads `.env`

## COMMANDS

```bash
bun run src/cli.ts tree           # Show file structure
bun run src/cli.ts structure      # List functions/classes
bun run src/cli.ts calls          # Build call graph
bun run src/cli.ts impact <fn>    # Find callers
bun run src/cli.ts warm           # Build semantic index
bun run src/cli.ts semantic <q>   # Semantic search
```

## NOTES

- Default embedding provider is `MockEmbeddingProvider` (no API key needed)
- Config stored in `<project>/.ctxq/config.json`
- No `.env` required - uses defaults from `src/config.ts`
