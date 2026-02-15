import { parseFile, getLanguageFromExtension } from '../ast/parser';

export interface CallGraph {
  [caller: string]: string[]; // caller -> callees
}

export interface FileCallInfo {
  file: string;
  defines: string[];  // functions/classes defined here
  calls: string[];    // functions called here
}

const CALL_TYPES = new Set([
  'call_expression',
  'identifier',
  'member_call_expression',
]);

function extractCalls(tree: any): string[] {
  const calls: string[] = [];
  
  function walk(node: any) {
    // Check if this is a function call
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function');
      if (funcNode) {
        calls.push(funcNode.text);
      }
    }
    
    // Also capture member calls like obj.method()
    if (node.type === 'member_expression' && node.childForFieldName('property')) {
      const prop = node.childForFieldName('property');
      if (prop) {
        calls.push(prop.text);
      }
    }
    
    for (const child of node.children || []) {
      walk(child);
    }
  }
  
  walk(tree.rootNode);
  return [...new Set(calls)]; // Deduplicate
}

function extractDefines(tree: any, language: string): string[] {
  const defines: string[] = [];
  
  const functionTypes = new Set([
    'function_declaration',
    'method_definition',
    'arrow_function',
  ]);
  
  function walk(node: any) {
    if (functionTypes.has(node.type)) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        defines.push(nameNode.text);
      }
    }
    
    if (node.type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        defines.push(nameNode.text);
      }
    }
    
    for (const child of node.children || []) {
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
  
  const tree = parseFile(filePath);
  if (!tree) {
    return { file: filePath, defines: [], calls: [] };
  }
  
  return {
    file: filePath,
    defines: extractDefines(tree, language),
    calls: extractCalls(tree),
  };
}

export function buildCallGraph(dirPath: string): CallGraph {
  const { readdirSync, statSync } = require('fs');
  const { join } = require('path');
  
  const IGNORE_DIRS = new Set(['node_modules', '.git', '.ctxq', 'dist', 'build']);
  const SUPPORTED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.php']);
  
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
    } catch (e) {
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
      if (!graph['__global']) {
        graph['__global'] = [];
      }
      if (!graph['__global'].includes(call)) {
        graph['__global'].push(call);
      }
    }
  }
  
  return graph;
}
