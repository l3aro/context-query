import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.ctxq',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'vendor',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.php',
  '.py',
  '.rs',
  '.c',
  '.cpp',
  '.cc',
  '.cxx',
  '.go',
  '.java',
  '.kt',
  '.kts',
]);

export function isIgnored(name: string): boolean {
  return IGNORE_DIRS.has(name);
}

export function isSupported(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.has(ext.toLowerCase()) || ext === '';
}

export function buildFileTree(rootPath: string, relativePath: string = ''): FileNode[] {
  const nodes: FileNode[] = [];

  try {
    const fullPath = join(rootPath, relativePath);
    const entries = readdirSync(fullPath);

    for (const entry of entries) {
      if (isIgnored(entry)) continue;

      const entryPath = join(relativePath, entry);
      const fullEntryPath = join(rootPath, entry);

      try {
        const stat = lstatSync(fullEntryPath);

        if (stat.isDirectory()) {
          const children = buildFileTree(rootPath, entryPath);
          // Only include directories that have supported files
          if (children.length > 0) {
            nodes.push({
              name: entry,
              path: entryPath,
              isDirectory: true,
              children,
            });
          }
        } else if (stat.isFile() && isSupported(entry)) {
          nodes.push({
            name: entry,
            path: entryPath,
            isDirectory: false,
          });
        }
      } catch (_e) {
        // Skip files we can't access
      }
    }
  } catch (_e) {
    // Directory doesn't exist or can't be read
  }

  // Sort: directories first, then files, alphabetically
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function printFileTree(nodes: FileNode[], prefix: string = ''): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;

    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';

    if (node.isDirectory) {
      console.log(`${prefix}${connector}${node.name}/`);
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      if (node.children) {
        printFileTree(node.children, newPrefix);
      }
    } else {
      console.log(`${prefix}${connector}${node.name}`);
    }
  }
}
