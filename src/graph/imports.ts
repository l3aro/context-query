import { extname } from 'node:path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';

export interface ImportInfo {
  module: string;
  names: string[];
  isFrom: boolean;
  isDefault: boolean;
  aliases: Record<string, string>;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
};

function getLanguageFromExtension(filename: string): string | null {
  const ext = extname(filename).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}

function getTsParser(): Parser {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  return parser;
}

function getJsParser(): Parser {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  return parser;
}

function getText(node: Parser.SyntaxNode, source: string): string {
  return source.substring(node.startIndex, node.endIndex);
}

function parseImportSpecifier(
  specifierNode: Parser.SyntaxNode,
  source: string,
  names: string[],
  aliases: Record<string, string>,
): void {
  let origName: string | null = null;
  let alias: string | null = null;

  for (const specChild of specifierNode.children) {
    if (specChild.type !== 'identifier') continue;

    if (origName === null) {
      origName = getText(specChild, source);
    } else {
      alias = getText(specChild, source);
    }
  }

  if (!origName) return;

  names.push(origName);
  if (alias) {
    aliases[alias] = origName;
  }
}

function parseNamedImports(
  namedImportsNode: Parser.SyntaxNode,
  source: string,
  names: string[],
  aliases: Record<string, string>,
): void {
  for (const named of namedImportsNode.children) {
    if (named.type === 'import_specifier') {
      parseImportSpecifier(named, source, names, aliases);
    }
  }
}

function parseNamespaceImport(
  namespaceNode: Parser.SyntaxNode,
  source: string,
  names: string[],
  aliases: Record<string, string>,
): void {
  for (const nsChild of namespaceNode.children) {
    if (nsChild.type !== 'identifier') continue;

    const alias = getText(nsChild, source);
    aliases[alias] = '*';
    names.push('*');
  }
}

function parseImportClause(
  clauseNode: Parser.SyntaxNode,
  source: string,
  names: string[],
  aliases: Record<string, string>,
): boolean {
  let isDefault = false;

  for (const clauseChild of clauseNode.children) {
    if (clauseChild.type === 'identifier') {
      // Default import: import Foo from "module"
      isDefault = true;
      names.push(getText(clauseChild, source));
    } else if (clauseChild.type === 'named_imports') {
      // Named imports: import { foo, bar as baz } from "module"
      parseNamedImports(clauseChild, source, names, aliases);
    } else if (clauseChild.type === 'namespace_import') {
      // Namespace import: import * as foo from "module"
      parseNamespaceImport(clauseChild, source, names, aliases);
    }
  }

  return isDefault;
}

function parseTsImportNode(node: Parser.SyntaxNode, source: string): ImportInfo | null {
  let module = '';
  const names: string[] = [];
  let isDefault = false;
  const aliases: Record<string, string> = {};

  for (const child of node.children) {
    const childText = getText(child, source);

    if (child.type === 'string') {
      // Module path - strip quotes
      module = childText.slice(1, -1);
    } else if (child.type === 'import_clause') {
      isDefault = parseImportClause(child, source, names, aliases);
    }
  }

  if (!module) return null;

  return {
    module,
    names,
    isFrom: true,
    isDefault,
    aliases,
  };
}

function parseJsImportNode(node: Parser.SyntaxNode, source: string): ImportInfo | null {
  let module = '';
  const names: string[] = [];
  let isDefault = false;
  const aliases: Record<string, string> = {};

  for (const child of node.children) {
    const childText = getText(child, source);

    if (child.type === 'string') {
      module = childText.slice(1, -1);
    } else if (child.type === 'import_clause') {
      isDefault = parseImportClause(child, source, names, aliases);
    }
  }

  if (!module) return null;

  return {
    module,
    names,
    isFrom: true,
    isDefault,
    aliases,
  };
}

export async function parseTsImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getTsParser();
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'import_statement') {
        const importInfo = parseTsImportNode(node, source);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing TypeScript imports from ${filePath}:`, error);
    return [];
  }
}

export async function parseJsImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getJsParser();
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'import_statement') {
        const importInfo = parseJsImportNode(node, source);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing JavaScript imports from ${filePath}:`, error);
    return [];
  }
}

// Python import parsing using regex patterns
// Handles: import x, import x as y, from x import y, from x import (y, z)

function parsePyImportLine(line: string): ImportInfo | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
  if (fromMatch?.[1] && fromMatch[2]) {
    const module = fromMatch[1];
    const importsStr: string = fromMatch[2];
    const names: string[] = [];
    const aliases: Record<string, string> = {};

    const importParts = importsStr.split(',').map((s) => s.trim());

    for (const part of importParts) {
      const asMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch?.[1] && asMatch[2]) {
        names.push(asMatch[1]);
        aliases[asMatch[2]] = asMatch[1];
      } else if (part) {
        names.push(part);
      }
    }

    return {
      module,
      names,
      isFrom: true,
      isDefault: false,
      aliases,
    };
  }

  const importMatch = trimmed.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/);
  if (importMatch?.[1]) {
    const module = importMatch[1];
    const alias = importMatch[2];

    return {
      module,
      names: [],
      isFrom: false,
      isDefault: false,
      aliases: alias ? { [alias]: module } : {},
    };
  }

  return null;
}

export async function parsePyImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const imports: ImportInfo[] = [];
    const lines = source.split('\n');

    let inParenBlock = false;
    let currentModule = '';
    let currentNames: string[] = [];
    let currentAliases: Record<string, string> = {};

    for (const line of lines) {
      if (line.includes('from') && line.includes('import') && line.includes('(')) {
        const fromMatch = line.match(/^from\s+([\w.]+)\s+import\s+\(/);
        if (fromMatch?.[1]) {
          inParenBlock = true;
          currentModule = fromMatch[1];
          currentNames = [];
          currentAliases = {};
          continue;
        }
      }

      if (inParenBlock) {
        if (line.includes(')')) {
          const namePart = line.replace(')', '').replace(',', '').trim();
          if (namePart) {
            const asMatch = namePart.match(/^(\w+)\s+as\s+(\w+)$/);
            if (asMatch?.[1] && asMatch[2]) {
              currentNames.push(asMatch[1]);
              currentAliases[asMatch[2]] = asMatch[1];
            } else if (namePart) {
              currentNames.push(namePart);
            }
          }
          imports.push({
            module: currentModule,
            names: currentNames,
            isFrom: true,
            isDefault: false,
            aliases: currentAliases,
          });
          inParenBlock = false;
          currentModule = '';
          currentNames = [];
          currentAliases = {};
        } else {
          const namePart = line.trim().replace(',', '');
          if (namePart && !namePart.startsWith('#')) {
            const asMatch = namePart.match(/^(\w+)\s+as\s+(\w+)$/);
            if (asMatch?.[1] && asMatch[2]) {
              currentNames.push(asMatch[1]);
              currentAliases[asMatch[2]] = asMatch[1];
            } else if (namePart) {
              currentNames.push(namePart);
            }
          }
        }
        continue;
      }

      if (line.includes('from') && line.includes('import') && !line.includes('(')) {
        const importInfo = parsePyImportLine(line);
        if (importInfo) {
          imports.push(importInfo);
        }
      } else if (line.trim().startsWith('import ')) {
        const importInfo = parsePyImportLine(line);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
    }

    return imports;
  } catch (error) {
    console.error(`Error parsing Python imports from ${filePath}:`, error);
    return [];
  }
}

export async function parseImports(filePath: string, language?: string): Promise<ImportInfo[]> {
  const lang = language || getLanguageFromExtension(filePath);

  if (lang === 'typescript') {
    return await parseTsImports(filePath);
  }
  if (lang === 'javascript') {
    return await parseJsImports(filePath);
  }
  if (lang === 'python' || lang === 'py') {
    return await parsePyImports(filePath);
  }

  // Try to auto-detect
  const detected = getLanguageFromExtension(filePath);
  if (detected === 'typescript') {
    return await parseTsImports(filePath);
  }
  if (detected === 'javascript') {
    return await parseJsImports(filePath);
  }
  if (detected === 'python') {
    return await parsePyImports(filePath);
  }

  console.warn(`Unsupported file type: ${filePath}`);
  return [];
}
