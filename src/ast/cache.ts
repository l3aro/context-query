import { statSync } from 'node:fs';
import type Parser from 'tree-sitter';
import { parseFile } from './parser.ts';

type CacheEntry = {
  tree: Parser.Tree;
  mtime: number;
};

const treeCache = new Map<string, CacheEntry>();

export function parseFileCached(filePath: string): Parser.Tree | null {
  const stats = statSync(filePath);
  const cached = treeCache.get(filePath);

  if (cached && cached.mtime === stats.mtimeMs) {
    return cached.tree;
  }

  const tree = parseFile(filePath);
  if (tree) {
    treeCache.set(filePath, { tree, mtime: stats.mtimeMs });
  }

  return tree;
}
