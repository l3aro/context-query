import { backwardSlice, extractPDG, forwardSlice } from '../graph/pdg';

export interface SliceOptions {
  file: string;
  function: string;
  line: number;
  direction?: 'backward' | 'forward';
  variable?: string;
  language?: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await Bun.file(filePath).text();
    return true;
  } catch {
    return false;
  }
}

export async function runSlice(options: SliceOptions): Promise<void> {
  const { file, function: funcName, line, direction = 'backward', variable } = options;

  if (!(await fileExists(file))) {
    console.error(`Error: File not found: ${file}`);
    process.exit(1);
  }

  const pdg = extractPDG(file, funcName);
  if (!pdg) {
    console.error(`Function "${funcName}" not found in ${file}`);
    process.exit(1);
  }

  const sliceLines =
    direction === 'backward'
      ? backwardSlice(pdg, line, variable)
      : forwardSlice(pdg, line, variable);

  let sourceLines: string[] = [];
  try {
    const source = await Bun.file(file).text();
    sourceLines = source.split('\n');
  } catch (error) {
    console.warn(`Warning: Could not read source file: ${error}`);
  }

  const result = {
    function: funcName,
    targetLine: line,
    direction,
    variable: variable || null,
    sliceLines: sliceLines.sort((a, b) => a - b),
    code: sliceLines.map((l) => ({
      line: l,
      content: sourceLines[l - 1] || '',
    })),
  };

  console.log(JSON.stringify(result, null, 2));
}
