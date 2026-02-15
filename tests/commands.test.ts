import { test, expect, describe } from 'bun:test';
import { buildFileTree, isIgnored, isSupported } from '../src/commands/tree';
import { analyzeFile } from '../src/commands/structure';

describe('tree command', () => {
  test('isIgnored returns true for node_modules', () => {
    expect(isIgnored('node_modules')).toBe(true);
  });

  test('isIgnored returns true for .git', () => {
    expect(isIgnored('.git')).toBe(true);
  });

  test('isIgnored returns false for src', () => {
    expect(isIgnored('src')).toBe(false);
  });

  test('isSupported returns true for .ts files', () => {
    expect(isSupported('file.ts')).toBe(true);
    expect(isSupported('file.tsx')).toBe(true);
  });

  test('isSupported returns true for .js files', () => {
    expect(isSupported('file.js')).toBe(true);
    expect(isSupported('file.jsx')).toBe(true);
  });

  test('isSupported returns true for .php files', () => {
    expect(isSupported('file.php')).toBe(true);
  });

  test('isSupported returns false for .py files', () => {
    expect(isSupported('file.py')).toBe(false);
  });

  test('buildFileTree returns nodes for test fixtures', () => {
    const nodes = buildFileTree('tests/fixtures');
    expect(nodes.length).toBeGreaterThan(0);
  });
});

describe('structure command', () => {
  test('analyzeFile extracts functions from TypeScript', () => {
    const units = analyzeFile('tests/fixtures/sample.ts');
    const functionNames = units.filter((u) => u.type === 'function').map((u) => u.name);

    expect(functionNames).toContain('calculateTotal');
    expect(functionNames).toContain('formatDate');
  });

  test('analyzeFile extracts classes from TypeScript', () => {
    const units = analyzeFile('tests/fixtures/sample.ts');
    const classNames = units.filter((u) => u.type === 'class').map((u) => u.name);

    expect(classNames).toContain('UserService');
  });

  test('analyzeFile extracts methods from TypeScript', () => {
    const units = analyzeFile('tests/fixtures/sample.ts');
    const methodNames = units.filter((u) => u.type === 'method').map((u) => u.name);

    expect(methodNames).toContain('constructor');
    expect(methodNames).toContain('getUser');
    expect(methodNames).toContain('createUser');
  });

  test('analyzeFile returns line numbers', () => {
    const units = analyzeFile('tests/fixtures/sample.ts');
    const userService = units.find((u) => u.name === 'UserService');

    expect(userService).toBeDefined();
    expect(userService?.line).toBe(3);
  });
});
