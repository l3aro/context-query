import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import Cpp from 'tree-sitter-cpp';
import Go from 'tree-sitter-go';
import Java from 'tree-sitter-java';
import JavaScript from 'tree-sitter-javascript';
import Php from 'tree-sitter-php';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import TypeScript from 'tree-sitter-typescript';

// Kotlin binding has a broken path in bun - load directly
const KOTLIN_NODE_PATH = join(
  process.cwd(),
  'node_modules/@tree-sitter-grammars/tree-sitter-kotlin/prebuilds/linux-x64/@tree-sitter-grammars+tree-sitter-kotlin.node',
);
const Kotlin = require(KOTLIN_NODE_PATH);

export type Language =
  | 'typescript'
  | 'javascript'
  | 'php'
  | 'python'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'go'
  | 'java'
  | 'kotlin';

const LANGUAGE_MAP: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.php': 'php',
  '.py': 'python',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
};

const parserCache = new Map<Language, Parser>();

export function getLanguageFromExtension(filename: string): Language | null {
  const ext = extname(filename).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}

export function getParser(language: Language): Parser {
  const cached = parserCache.get(language);
  if (cached) return cached;

  const parser = new Parser();

  switch (language) {
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'javascript':
      parser.setLanguage(JavaScript);
      break;
    case 'php':
      parser.setLanguage(Php.php);
      break;
    case 'python':
      parser.setLanguage(Python);
      break;
    case 'rust':
      parser.setLanguage(Rust);
      break;
    case 'c':
      parser.setLanguage(C);
      break;
    case 'cpp':
      parser.setLanguage(Cpp);
      break;
    case 'go':
      parser.setLanguage(Go);
      break;
    case 'java':
      parser.setLanguage(Java);
      break;
    case 'kotlin':
      parser.setLanguage(Kotlin);
      break;
  }

  parserCache.set(language, parser);
  return parser;
}

export function parseFile(filePath: string): Parser.Tree | null {
  const language = getLanguageFromExtension(filePath);
  if (!language) return null;

  try {
    const code = readFileSync(filePath, 'utf-8');
    const parser = getParser(language);
    return parser.parse(code);
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

export function parseCode(code: string, language: Language): Parser.Tree {
  const parser = getParser(language);
  return parser.parse(code);
}
