import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { extractCFG } from '../src/graph/cfg';

describe('CFG complexity analysis', () => {
  const tempDir = '/tmp/cfg-test';

  beforeAll(() => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(tempDir)) {
      rmdirSync(tempDir, { recursive: true });
    }
  });

  function createTempFile(name: string, content: string): string {
    const filePath = join(tempDir, name);
    writeFileSync(filePath, content);
    return filePath;
  }

  test('linear function has complexity 1 and blockCount 2', () => {
    const code = `function test() { return 1; }`;
    const filePath = createTempFile('linear.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(1);
    expect(result.blockCount).toBe(2);
    unlinkSync(filePath);
  });

  test('if statement has complexity 2 and blockCount 3', () => {
    const code = `function test(x: number) { if (x) { return 1; } return 0; }`;
    const filePath = createTempFile('if.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    expect(result.blockCount).toBe(3);
    unlinkSync(filePath);
  });

  test('if-else statement has complexity 2', () => {
    const code = `function test(x: number): number { if (x > 0) { return 1; } else { return 0; } }`;
    const filePath = createTempFile('ifelse.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('while loop has complexity 2 and blockCount 3', () => {
    const code = `function test() { while (true) { console.log('loop'); } }`;
    const filePath = createTempFile('while.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    expect(result.blockCount).toBe(3);
    unlinkSync(filePath);
  });

  test('for loop has complexity 2', () => {
    const code = `function test() { for (let i = 0; i < 10; i++) { console.log(i); } }`;
    const filePath = createTempFile('for.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('nested if statements have complexity 3', () => {
    const code = `function test(x: number, y: number) { if (x) { if (y) { return 1; } } return 0; }`;
    const filePath = createTempFile('nested-if.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(3);
    unlinkSync(filePath);
  });

  test('nested while loops have complexity 3', () => {
    const code = `function test() { while (true) { while (false) { break; } } }`;
    const filePath = createTempFile('nested-while.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(3);
    unlinkSync(filePath);
  });

  test('if with while inside has complexity 3', () => {
    const code = `function test(x: number) { if (x) { while (true) { break; } } }`;
    const filePath = createTempFile('if-while.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(3);
    unlinkSync(filePath);
  });

  test('complex nested function has complexity 4+', () => {
    const code = `function test(a: number, b: number, c: number) { if (a) { if (b) { while (c) { break; } } } }`;
    const filePath = createTempFile('complex.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(4);
    unlinkSync(filePath);
  });

  test('returns 0 for non-existent function', () => {
    const code = `function test() { return 1; }`;
    const filePath = createTempFile('notfound.ts', code);
    const result = extractCFG(filePath, 'nonExistent');

    expect(result.complexity).toBe(0);
    expect(result.blockCount).toBe(0);
    unlinkSync(filePath);
  });

  test('handles ternary operator as decision point', () => {
    const code = `function test(x: number): number { if (x > 0 ? true : false) { return 1; } return 0; }`;
    const filePath = createTempFile('ternary.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('handles logical AND operator', () => {
    const code = `function test(a: boolean, b: boolean): boolean { return a && b; }`;
    const filePath = createTempFile('and.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('handles logical OR operator', () => {
    const code = `function test(a: boolean, b: boolean): boolean { return a || b; }`;
    const filePath = createTempFile('or.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('handles switch statement', () => {
    const code = `function test(x: number): number { switch(x) { case 1: return 1; case 2: return 2; default: return 0; } }`;
    const filePath = createTempFile('switch.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('handles function with block body', () => {
    const code = `function test(x: number): number { if (x > 0) { return 1; } return 0; }`;
    const filePath = createTempFile('block.ts', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('handles JavaScript file', () => {
    const code = `function test(x) { if (x) { return 1; } return 0; }`;
    const filePath = createTempFile('js-if.js', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(2);
    unlinkSync(filePath);
  });

  test('returns 0 for unsupported file type', () => {
    const code = 'def test(): return 1';
    const filePath = createTempFile('python.py', code);
    const result = extractCFG(filePath, 'test');

    expect(result.complexity).toBe(0);
    expect(result.blockCount).toBe(0);
    unlinkSync(filePath);
  });
});
