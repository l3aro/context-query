import { extractCFG } from '../graph/cfg';
import { analyzeFile } from './structure';

export function runComplexity(filePath: string, functionName?: string): void {
  if (functionName) {
    const result = extractCFG(filePath, functionName);
    console.log(`complexity:${result.complexity}, blocks:${result.blockCount}`);
  } else {
    const units = analyzeFile(filePath);
    const functions = units.filter((u) => u.type === 'function' || u.type === 'method');

    for (const fn of functions) {
      const result = extractCFG(filePath, fn.name);
      console.log(`${fn.name}: complexity:${result.complexity}, blocks:${result.blockCount}`);
    }
  }
}
