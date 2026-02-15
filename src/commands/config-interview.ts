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

export async function runFullConfigInterview(currentConfig: EmbeddingConfig): Promise<EmbeddingConfig> {
  const providerDefault = currentConfig.provider;
  const providerInput = await promptWithDefault(
    `Choose provider (ollama/mock) [default: ${providerDefault}]: `,
    providerDefault
  );
  const provider = providerInput as 'ollama' | 'mock';

  let baseUrl = currentConfig.baseUrl;
  if (provider === 'ollama') {
    const baseUrlDefault = currentConfig.baseUrl || 'http://localhost:11434';
    baseUrl = await promptWithDefault(
      `Enter Ollama base URL [default: ${baseUrlDefault}]: `,
      baseUrlDefault
    );
  }

  const defaultWarm = currentConfig.warmModel || DEFAULTS.warmModel;
  const warmModel = await promptWithDefault(
    `Enter warmModel (indexing model) [default: ${defaultWarm}]: `,
    defaultWarm
  );

  const defaultSearch = currentConfig.searchModel || warmModel;
  const searchModel = await promptWithDefault(
    `Enter searchModel (query model) [default: ${defaultSearch}]: `,
    defaultSearch
  );

  const defaultApiKey = currentConfig.apiKey ?? DEFAULTS.apiKey;
  const apiKey = await promptWithDefault(
    'Enter API key (press Enter for none): ',
    defaultApiKey
  );

  return {
    provider,
    baseUrl,
    warmModel,
    searchModel,
    apiKey,
  };
}

async function promptWithDefault(promptText: string, defaultValue: string): Promise<string> {
  process.stdout.write(promptText);
  const stdin = Bun.file('/dev/stdin');
  const text = await stdin.text();
  const answer = text.trim();
  return answer || defaultValue;
}
