import { buildCallGraph } from '../graph/calls';

export function runCalls(dirPath: string): void {
  const graph = buildCallGraph(dirPath);

  console.log('# Call Graph');
  console.log('');

  for (const [func, calls] of Object.entries(graph)) {
    if (calls.length > 0) {
      console.log(`${func} calls:`);
      for (const call of calls) {
        console.log(`  - ${call}`);
      }
    }
  }

  if (Object.keys(graph).length === 0) {
    console.log('No call relationships found.');
  }
}
