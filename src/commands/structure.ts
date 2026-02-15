import type { SyntaxNode, Tree } from 'tree-sitter';
import { getLanguageFromExtension, parseFile } from '../ast/parser';

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

  const tree = parseFile(filePath);
  if (!tree) return [];

  return extractUnits(tree, language, filePath);
}

export function analyzeDirectory(dirPath: string): CodeUnit[] {
  const { readdirSync, statSync } = require('node:fs');
  const { join } = require('node:path');
  const units: CodeUnit[] = [];

  const IGNORE_DIRS = new Set(['node_modules', '.git', '.ctxq', 'dist', 'build']);
  const SUPPORTED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.php']);

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry)) continue;

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (stat.isFile()) {
          const ext = entry.substring(entry.lastIndexOf('.'));
          if (SUPPORTED_EXT.has(ext)) {
            const fileUnits = analyzeFile(fullPath);
            units.push(...fileUnits);
          }
        }
      }
    } catch (_e) {
      // Skip inaccessible directories
    }
  }

  walk(dirPath);
  return units;
}
