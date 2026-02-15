# tests

Test suite using `bun:test`.

## STRUCTURE

```
tests/
├── *.test.ts           # Test files
└── fixtures/           # Test fixtures
    └── sample.ts       # Sample code for testing
```

## CONVENTIONS

- Filename pattern: `*.test.ts`
- Import from `bun:test`: `import { test, expect } from 'bun:test'`
- Use `describe()` blocks for grouping
- Import source modules via relative path: `import { ... } from '../src/...'`

## RUN

```bash
bun test
```

## ADD TEST

1. Create `tests/<module>.test.ts`
2. Import from `bun:test` and source from `../src/...`
3. Use `test()` and `expect()` from `bun:test`
