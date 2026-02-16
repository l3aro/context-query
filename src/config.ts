import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EmbeddingConfig } from './embeddings/types';

export interface Config {
  embeddings: EmbeddingConfig;
  providerDefaults?: {
    huggingface?: {
      warmModel: string;
      searchModel: string;
      baseUrl: string;
    };
  };
}

export const DEFAULT_CONFIG: Config = {
  embeddings: {
    provider: 'mock',
    warmModel: 'nomic-embed-text-v2-moe',
    searchModel: 'embeddinggemma',
    baseUrl: 'http://localhost:11434',
  },
  providerDefaults: {
    huggingface: {
      warmModel: 'onnx-community/embeddinggemma-300m-ONNX',
      searchModel: 'onnx-community/embeddinggemma-300m-ONNX',
      baseUrl: 'https://api-inference.huggingface.co',
    },
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
    // Deep merge: spread DEFAULT_CONFIG, then spread parsed (overriding defaults)
    return {
      ...DEFAULT_CONFIG,
      embeddings: {
        ...DEFAULT_CONFIG.embeddings,
        ...parsed.embeddings,
      },
    };
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
