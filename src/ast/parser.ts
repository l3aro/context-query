import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Php from 'tree-sitter-php';
import { readFileSync } from 'fs';
import { join, extname } from 'path';

export type Language = 'typescript' | 'javascript' | 'php';

const LANGUAGE_MAP: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.php': 'php',
};

export function getLanguageFromExtension(filename: string): Language | null {
  const ext = extname(filename).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}

export function getParser(language: Language): Parser {
  const parser = new Parser();

  switch (language) {
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'javascript':
      parser.setLanguage(JavaScript);
      break;
    case 'php':
      parser.setLanguage(Php);
      break;
  }

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
