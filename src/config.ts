import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { EmbeddingConfig } from '../embeddings/types';

export interface Config {
  embeddings: EmbeddingConfig;
}

export const DEFAULT_CONFIG: Config = {
  embeddings: {
    provider: 'mock',
    warmModel: 'nomic-embed-text-v2-moe',
    searchModel: 'embeddinggemma',
    baseUrl: 'http://localhost:11434',
  },
};

export function loadConfig(projectPath: string): Config {
  const configPath = join(projectPath, '.ctxq', 'config.json');

  // Return default if no config exists
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(projectPath: string, config: Config): void {
  const configDir = join(projectPath, '.ctxq');

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const configPath = join(configDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
