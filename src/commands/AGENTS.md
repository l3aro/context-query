# src/commands

CLI command implementations. Each file = one command.

## FILES

| File | Command | Key Functions |
|------|---------|---------------|
| `tree.ts` | `ctxq tree` | `buildFileTree(path)`, `printFileTree(nodes)` |
| `structure.ts` | `ctxq structure` | `analyzeDirectory(path)` |
| `calls.ts` | `ctxq calls` | `runCalls(path)` |
| `impact.ts` | `ctxq impact <fn>` | `runImpact(fn, path)` |
| `warm.ts` | `ctxq warm` | `runWarm({projectPath})` |
| `semantic.ts` | `ctxq semantic <q>` | `runSemantic({projectPath, query})` |

## ADD COMMAND

1. Create `src/commands/<name>.ts`
2. Export action function
3. Import in `src/cli.ts` and register command

## DEPENDENCIES

- `src/ast/parser.ts` - Parse code files
- `src/graph/calls.ts` - Build call graphs
- `src/embeddings/` - Generate embeddings
- `src/storage/vector.ts` - Store vectors
