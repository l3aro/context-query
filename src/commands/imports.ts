import { parseImports } from '../graph/imports';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await Bun.file(filePath).text();
    return true;
  } catch {
    return false;
  }
}

export async function runImports(filePath: string, language?: string): Promise<void> {
  if (!(await fileExists(filePath))) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const imports = await parseImports(filePath, language);
  console.log(JSON.stringify({ file: filePath, imports }, null, 2));
}
