import type { SyntaxNode, Tree } from 'tree-sitter';
import { parseFileCached } from '../ast/cache';
import { getLanguageFromExtension } from '../ast/parser';

export interface CallGraph {
  [caller: string]: string[]; // caller -> callees
}

export interface FileCallInfo {
  file: string;
  defines: string[]; // functions/classes defined here
  calls: string[]; // functions called here
}

const DEFINE_TYPES: Record<string, { functions: string[]; classes: string[] }> = {
  typescript: {
    functions: ['function_declaration', 'method_definition', 'arrow_function'],
    classes: ['class_declaration'],
  },
  javascript: {
    functions: ['function_declaration', 'method_definition', 'arrow_function'],
    classes: ['class_declaration'],
  },
  php: {
    functions: ['function_declaration', 'method_definition'],
    classes: ['class_declaration'],
  },
  python: {
    functions: ['function_definition', 'async_function_definition'],
    classes: ['class_definition'],
  },
  rust: {
    functions: ['function_item'],
    classes: ['struct_item', 'impl_item'],
  },
  c: {
    functions: ['function_definition'],
    classes: ['struct_specifier'],
  },
  cpp: {
    functions: ['function_definition'],
    classes: ['class_specifier'],
  },
  go: {
    functions: ['function_declaration'],
    classes: ['type_specification'],
  },
  java: {
    functions: ['method_declaration'],
    classes: ['class_declaration'],
  },
  kotlin: {
    functions: ['function_declaration'],
    classes: ['class_declaration'],
  },
};

const CALL_TYPES: Record<string, string[]> = {
  typescript: ['call_expression', 'member_expression'],
  javascript: ['call_expression', 'member_expression'],
  php: ['call_expression', 'member_call_expression'],
  python: ['call', 'attribute'],
  rust: ['call_expression', 'field_expression'],
  c: ['call_expression'],
  cpp: ['call_expression'],
  go: ['call_expression'],
  java: ['method_invocation'],
  kotlin: ['call_expression'],
};

function extractCalls(tree: Tree, language: string): string[] {
  const calls: string[] = [];
  const callTypes = new Set(CALL_TYPES[language] ?? ['call_expression']);

  function walk(node: SyntaxNode) {
    if (callTypes.has(node.type)) {
      const funcNode =
        node.childForFieldName('function') ||
        node.childForFieldName('name') ||
        node.childForFieldName('method');
      if (funcNode) {
        calls.push(funcNode.text);
      } else if (node.type === 'call' && node.childForFieldName('function')) {
        const func = node.childForFieldName('function');
        if (func) calls.push(func.text);
      }
    }

    if (
      (node.type === 'member_expression' ||
        node.type === 'field_expression' ||
        node.type === 'attribute') &&
      node.childForFieldName('property')
    ) {
      const prop = node.childForFieldName('property');
      if (prop) {
        calls.push(prop.text);
      }
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return [...new Set(calls)]; // Deduplicate
}

function extractDefines(tree: Tree, language: string): string[] {
  const defines: string[] = [];
  const types = DEFINE_TYPES[language];

  if (!types) return defines;

  const functionTypes = new Set(types.functions);
  const classTypes = new Set(types.classes);

  function walk(node: SyntaxNode) {
    if (functionTypes.has(node.type)) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        defines.push(nameNode.text);
      }
    }

    if (classTypes.has(node.type)) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        defines.push(nameNode.text);
      }
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return defines;
}

export function analyzeCalls(filePath: string): FileCallInfo {
  const language = getLanguageFromExtension(filePath);
  if (!language) {
    return { file: filePath, defines: [], calls: [] };
  }

  const tree = parseFileCached(filePath);
  if (!tree) {
    return { file: filePath, defines: [], calls: [] };
  }

  return {
    file: filePath,
    defines: extractDefines(tree, language),
    calls: extractCalls(tree, language),
  };
}

export function buildCallGraph(dirPath: string): CallGraph {
  const { readdirSync, statSync } = require('node:fs');
  const { join } = require('node:path');

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

  const graph: CallGraph = {};
  const fileInfos: FileCallInfo[] = [];

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
            const info = analyzeCalls(fullPath);
            fileInfos.push(info);
          }
        }
      }
    } catch (_e) {
      // Skip inaccessible
    }
  }

  walk(dirPath);

  // Build call graph
  for (const info of fileInfos) {
    for (const def of info.defines) {
      if (!graph[def]) {
        graph[def] = [];
      }
    }

    // For each call, add to caller's list
    for (const call of info.calls) {
      // We need to track which function is making the call
      // For now, we'll add global calls
      if (!graph.__global) {
        graph.__global = [];
      }
      if (!graph.__global.includes(call)) {
        graph.__global.push(call);
      }
    }
  }

  return graph;
}
