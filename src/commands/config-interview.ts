import type { EmbeddingConfig } from '../embeddings/types.ts';

const DEFAULTS = {
  warmModel: 'nomic-embed-text-v2-moe',
  searchModel: 'embeddinggemma',
  apiKey: '',
};

export async function runConfigInterview(
  projectPath: string,
  currentConfig: EmbeddingConfig
): Promise<Partial<EmbeddingConfig>> {
  const result: Partial<EmbeddingConfig> = {};

  if (currentConfig.provider === 'ollama' && !currentConfig.warmModel) {
    const warmModel = await promptWithDefault(
      'Enter warmModel (model for indexing, required): ',
      DEFAULTS.warmModel
    );
    result.warmModel = warmModel;
  }

  const defaultSearchModel = currentConfig.warmModel || DEFAULTS.searchModel;
  const searchModel = await promptWithDefault(
    `Enter searchModel (model for search queries, default: ${defaultSearchModel}): `,
    defaultSearchModel
  );
  if (searchModel && searchModel !== defaultSearchModel) {
    result.searchModel = searchModel;
  }

  const apiKey = await promptWithDefault(
    'Enter apiKey (optional, press Enter for none): ',
    DEFAULTS.apiKey
  );
  if (apiKey) {
    result.apiKey = apiKey;
  }

  return result;
}

async function promptWithDefault(promptText: string, defaultValue: string): Promise<string> {
  process.stdout.write(promptText);
  const stdin = Bun.file('/dev/stdin');
  const text = await stdin.text();
  const answer = text.trim();
  return answer || defaultValue;
}
