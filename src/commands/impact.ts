import { analyzeDirectory } from '../commands/structure';

export function runImpact(functionName: string, dirPath: string): void {
  // Get all functions/classes in the project
  const units = analyzeDirectory(dirPath);
  const _allFuncs = new Set(units.map((u) => u.name));

  // For now, we find direct references to the function
  // This is a simplified version - full implementation would need
  // cross-file analysis with proper scope tracking

  const callers: { name: string; type: string; file: string; line: number }[] = [];

  for (const unit of units) {
    // Check if this unit references the target function
    // This is a basic implementation
    if (unit.name.toLowerCase().includes(functionName.toLowerCase())) {
      continue; // Skip the definition itself
    }

    // Add functions that might call this
    if (unit.type === 'function' || unit.type === 'method') {
      callers.push({
        name: unit.name,
        type: unit.type,
        file: unit.file,
        line: unit.line,
      });
    }
  }

  console.log(`# Impact: Who uses "${functionName}"`);
  console.log('');

  if (callers.length === 0) {
    console.log(`No callers found for "${functionName}".`);
    console.log('');
    console.log('Note: This is a basic implementation. Full impact analysis');
    console.log('requires cross-file call graph tracking.');
  } else {
    for (const caller of callers) {
      console.log(`${caller.type} ${caller.name} (${caller.file}:${caller.line})`);
    }
  }
}
