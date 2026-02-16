import type { SyntaxNode, Tree } from 'tree-sitter';
import { parseFileCached } from '../ast/cache';
import { getLanguageFromExtension } from '../ast/parser';

export interface CodeUnit {
  type: 'function' | 'class' | 'method';
  name: string;
  file: string;
  line: number;
}

const TYPE_KEYWORDS = {
  typescript: {
    function: ['function_declaration', 'method_definition'],
    class: ['class_declaration'],
  },
  javascript: {
    function: ['function_declaration', 'method_definition'],
    class: ['class_declaration'],
  },
  php: {
    function: ['function_declaration', 'method_definition'],
    class: ['class_declaration'],
  },
  python: {
    function: ['function_definition', 'async_function_definition'],
    class: ['class_definition'],
  },
  rust: {
    function: ['function_item'],
    class: ['struct_item', 'impl_item'],
  },
  c: {
    function: ['function_definition'],
    class: ['struct_specifier', 'union_specifier'],
  },
  cpp: {
    function: ['function_definition'],
    class: ['class_specifier'],
  },
  go: {
    function: ['function_declaration'],
    class: ['type_specification'],
  },
  java: {
    function: ['method_declaration'],
    class: ['class_declaration'],
  },
  kotlin: {
    function: ['function_declaration'],
    class: ['class_declaration'],
  },
};

function _getNodeText(tree: Tree, _node: SyntaxNode): string {
  return tree.rootNode.text;
}

function extractUnits(tree: Tree, language: string, filePath: string): CodeUnit[] {
  const units: CodeUnit[] = [];
  const root = tree.rootNode;

  const types = TYPE_KEYWORDS[language as keyof typeof TYPE_KEYWORDS];
  if (!types) return units;

  const functionTypes = new Set(types.function);
  const classTypes = new Set(types.class);

  function walk(node: SyntaxNode) {
    if (node.type === 'class_declaration' || classTypes.has(node.type)) {
      units.push({
        type: 'class',
        name: node.childForFieldName('name')?.text || 'Anonymous',
        file: filePath,
        line: node.startPosition.row + 1,
      });
    } else if (
      node.type === 'function_declaration' ||
      node.type === 'method_definition' ||
      functionTypes.has(node.type)
    ) {
      const nameNode = node.childForFieldName('name');
      units.push({
        type: node.type === 'method_definition' ? 'method' : 'function',
        name: nameNode?.text || 'anonymous',
        file: filePath,
        line: node.startPosition.row + 1,
      });
    }

    for (const child of node.children || []) {
      walk(child);
    }
  }

  walk(root);
  return units;
}

export function analyzeFile(filePath: string): CodeUnit[] {
  const language = getLanguageFromExtension(filePath);
  if (!language) return [];

  const tree = parseFileCached(filePath);
  if (!tree) return [];

  return extractUnits(tree, language, filePath);
}

const IGNORE_DIRS = new Set(['node_modules', '.git', '.ctxq', 'dist', 'build']);

const SUPPORTED_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.php',
  '.py',
  '.rs',
  '.c',
  '.cpp',
  '.cc',
  '.cxx',
  '.go',
  '.java',
  '.kt',
  '.kts',
]);

function isIgnored(name: string): boolean {
  return IGNORE_DIRS.has(name);
}

function isSupportedFile(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.'));
  return SUPPORTED_EXT.has(ext);
}

export function analyzeDirectory(dirPath: string): CodeUnit[] {
  const { readdirSync, statSync } = require('node:fs');
  const { join } = require('node:path');
  const units: CodeUnit[] = [];

  function processEntry(fullPath: string): CodeUnit[] {
    if (!isSupportedFile(fullPath)) return [];
    return analyzeFile(fullPath);
  }

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (isIgnored(entry)) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!stat.isFile()) continue;
      units.push(...processEntry(fullPath));
    }
  }

  walk(dirPath);
  return units;
}
