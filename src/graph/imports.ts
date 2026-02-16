import type Parser from 'tree-sitter';

import { getLanguageFromExtension, getParser } from '../ast/parser';

export interface ImportInfo {
  module: string;
  names: string[];
  isFrom: boolean;
  isDefault: boolean;
  aliases: Record<string, string>;
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
    const parser = getParser('typescript');
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
    const parser = getParser('javascript');
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

export async function parsePhpImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('php');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'namespace_use_declaration' || node.type === 'use_declaration') {
        let module = '';
        const names: string[] = [];

        for (const child of node.children) {
          if (child.type === 'name') {
            module = getText(child, source);
          } else if (child.type === 'use_clause') {
            const nameChild = child.children.find((c) => c.type === 'name');
            if (nameChild) {
              names.push(getText(nameChild, source));
            }
          }
        }

        if (module || names.length > 0) {
          imports.push({
            module,
            names,
            isFrom: true,
            isDefault: false,
            aliases: {},
          });
        }
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing PHP imports from ${filePath}:`, error);
    return [];
  }
}

// Python import parsing using tree-sitter
function parsePyAliasedImport(
  node: Parser.SyntaxNode,
  source: string,
): { name: string; alias: string } | null {
  let origName = '';
  let alias = '';
  for (const child of node.children) {
    if (child.type === 'dotted_name') {
      origName = getText(child, source);
    } else if (child.type === 'identifier') {
      alias = getText(child, source);
    }
  }
  return origName ? { name: origName, alias } : null;
}

function parsePyImportStatement(node: Parser.SyntaxNode, source: string): ImportInfo | null {
  let module = '';
  const names: string[] = [];
  const aliases: Record<string, string> = {};

  for (const child of node.children) {
    if (child.type === 'dotted_name') {
      module = getText(child, source);
      names.push(module);
    } else if (child.type === 'aliased_import') {
      const parsed = parsePyAliasedImport(child, source);
      if (parsed) {
        module = parsed.name;
        names.push(parsed.name);
        if (parsed.alias) {
          aliases[parsed.alias] = parsed.name;
        }
      }
    }
  }

  return module ? { module, names, isFrom: false, isDefault: false, aliases } : null;
}

function parsePyImportFromStatement(node: Parser.SyntaxNode, source: string): ImportInfo | null {
  const dottedNames = node.children.filter((c) => c.type === 'dotted_name');
  const module = dottedNames[0] ? getText(dottedNames[0], source) : '';
  if (!module) return null;

  const names: string[] = [];
  const aliases: Record<string, string> = {};
  let foundImport = false;

  for (const child of node.children) {
    if (child.type === 'import') {
      foundImport = true;
      continue;
    }
    if (!foundImport) continue;

    if (child.type === 'identifier') {
      names.push(getText(child, source));
    } else if (child.type === 'aliased_import') {
      const parsed = parsePyAliasedImport(child, source);
      if (parsed) {
        names.push(parsed.name);
        if (parsed.alias) {
          aliases[parsed.alias] = parsed.name;
        }
      }
    }
  }

  return { module, names, isFrom: true, isDefault: false, aliases };
}

export async function parsePyImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('python');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      let importInfo: ImportInfo | null = null;

      if (node.type === 'import_statement') {
        importInfo = parsePyImportStatement(node, source);
      } else if (node.type === 'import_from_statement') {
        importInfo = parsePyImportFromStatement(node, source);
      }

      if (importInfo) {
        imports.push(importInfo);
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing Python imports from ${filePath}:`, error);
    return [];
  }
}

// Rust import parsing
export async function parseRustImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('rust');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'use_declaration') {
        let module = '';
        const names: string[] = [];

        for (const child of node.children) {
          if (
            child.type === 'use_clause' ||
            child.type === 'scoped_use_list' ||
            child.type === 'use_list'
          ) {
            const path = getText(child, source);
            module = path;
            names.push(path);
          }
        }

        if (!module && node.children.length > 1) {
          const scopedList = node.children.find((c) => c.type === 'scoped_use_list');
          if (scopedList) {
            module = getText(scopedList, source);
            names.push(module);
          }
        }

        if (module) {
          imports.push({
            module,
            names,
            isFrom: true,
            isDefault: false,
            aliases: {},
          });
        }
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing Rust imports from ${filePath}:`, error);
    return [];
  }
}

export async function parseCImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('c');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'preproc_include') {
        let module = '';

        for (const child of node.children) {
          if (child.type === 'string_literal' || child.type === 'system_lib_string') {
            const text = getText(child, source);
            module = text.replace(/[<>"]/g, '');
          }
        }

        if (module) {
          imports.push({
            module,
            names: [],
            isFrom: true,
            isDefault: false,
            aliases: {},
          });
        }
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing C imports from ${filePath}:`, error);
    return [];
  }
}

export async function parseCppImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('cpp');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'preproc_include') {
        let module = '';

        for (const child of node.children) {
          if (child.type === 'string_literal' || child.type === 'system_lib_string') {
            const text = getText(child, source);
            module = text.replace(/[<>"]/g, '');
          }
        }

        if (module) {
          imports.push({
            module,
            names: [],
            isFrom: true,
            isDefault: false,
            aliases: {},
          });
        }
      } else if (node.type === 'using_declaration') {
        const names: string[] = [];

        for (const child of node.children) {
          if (child.type === 'identifier') {
            names.push(getText(child, source));
          }
        }

        if (names.length > 0) {
          imports.push({
            module: '',
            names,
            isFrom: false,
            isDefault: false,
            aliases: {},
          });
        }
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing C++ imports from ${filePath}:`, error);
    return [];
  }
}

function parseGoStringLiteral(node: Parser.SyntaxNode, source: string): string {
  if (node.type === 'interpreted_string_literal' || node.type === 'raw_string_literal') {
    return getText(node, source).replace(/"/g, '');
  }
  return '';
}

function parseGoImportSpec(
  spec: Parser.SyntaxNode,
  source: string,
): { path: string; alias: string } | null {
  let path = '';
  let alias = '';

  for (const child of spec.children) {
    if (child.type === 'interpreted_string_literal' || child.type === 'raw_string_literal') {
      path = getText(child, source).replace(/"/g, '');
    } else if (child.type === 'package_identifier' || child.type === 'identifier') {
      alias = getText(child, source);
    }
  }

  return path ? { path, alias } : null;
}

function handleGoSingleImport(
  child: Parser.SyntaxNode,
  source: string,
): { path: string; alias: string } | null {
  const parsed = parseGoImportSpec(child, source);
  return parsed;
}

function handleGoImportList(child: Parser.SyntaxNode, source: string): string[] {
  const paths: string[] = [];
  for (const spec of child.children) {
    if (spec.type !== 'import_spec') continue;
    const parsed = parseGoImportSpec(spec, source);
    if (parsed) paths.push(parsed.path);
  }
  return paths;
}

function parseGoImportDeclaration(node: Parser.SyntaxNode, source: string): ImportInfo | null {
  let module = '';
  const names: string[] = [];
  const aliases: Record<string, string> = {};

  for (const child of node.children) {
    if (child.type === 'import_spec') {
      const parsed = handleGoSingleImport(child, source);
      if (parsed) {
        module = parsed.path;
        if (parsed.alias) aliases[parsed.alias] = parsed.path;
      }
      continue;
    }

    if (child.type === 'import_spec_list') {
      const paths = handleGoImportList(child, source);
      names.push(...paths);
      continue;
    }

    const str = parseGoStringLiteral(child, source);
    if (str) module = str;
  }

  return module || names.length > 0
    ? { module, names, isFrom: true, isDefault: false, aliases }
    : null;
}

export async function parseGoImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('go');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type !== 'import_declaration') {
        for (const child of node.children) {
          walkTree(child);
        }
        return;
      }

      const importInfo = parseGoImportDeclaration(node, source);
      if (importInfo) {
        imports.push(importInfo);
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing Go imports from ${filePath}:`, error);
    return [];
  }
}

export async function parseJavaImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('java');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'import_declaration') {
        let module = '';
        const names: string[] = [];

        for (const child of node.children) {
          if (child.type === 'scoped_identifier') {
            module = getText(child, source);
            names.push(module);
          } else if (child.type === 'asterisk') {
            names.push('*');
          }
        }

        if (module) {
          imports.push({
            module,
            names,
            isFrom: true,
            isDefault: false,
            aliases: {},
          });
        }
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing Java imports from ${filePath}:`, error);
    return [];
  }
}

export async function parseKotlinImports(filePath: string): Promise<ImportInfo[]> {
  try {
    const source = await Bun.file(filePath).text();
    const parser = getParser('kotlin');
    const tree = parser.parse(source);
    const imports: ImportInfo[] = [];

    function walkTree(node: Parser.SyntaxNode) {
      if (node.type === 'import_header') {
        let module = '';

        for (const child of node.children) {
          if (
            child.type === 'identifier' ||
            child.type === 'simple_identifier' ||
            child.type === 'scoped_identifier'
          ) {
            const text = getText(child, source);
            if (!module) {
              module = text;
            }
          }
        }

        if (module) {
          imports.push({
            module,
            names: [module],
            isFrom: true,
            isDefault: false,
            aliases: {},
          });
        }
      }

      for (const child of node.children) {
        walkTree(child);
      }
    }

    walkTree(tree.rootNode);
    return imports;
  } catch (error) {
    console.error(`Error parsing Kotlin imports from ${filePath}:`, error);
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
  if (lang === 'php') {
    return await parsePhpImports(filePath);
  }
  if (lang === 'python' || lang === 'py') {
    return await parsePyImports(filePath);
  }
  if (lang === 'rust') {
    return await parseRustImports(filePath);
  }
  if (lang === 'c') {
    return await parseCImports(filePath);
  }
  if (lang === 'cpp') {
    return await parseCppImports(filePath);
  }
  if (lang === 'go') {
    return await parseGoImports(filePath);
  }
  if (lang === 'java') {
    return await parseJavaImports(filePath);
  }
  if (lang === 'kotlin') {
    return await parseKotlinImports(filePath);
  }

  console.warn(`Unsupported file type: ${filePath}`);
  return [];
}
