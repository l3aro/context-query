import type { EmbeddingConfig } from '../embeddings/types.ts';

const DEFAULTS = {
  warmModel: 'nomic-embed-text-v2-moe',
  searchModel: 'embeddinggemma',
  apiKey: '',
};

export async function runFullConfigInterview(
  currentConfig: EmbeddingConfig,
  question: (prompt: string) => Promise<string>,
): Promise<EmbeddingConfig> {
  const providerDefault = currentConfig.provider;
  const providerInput = await question(
    `Choose provider (ollama/mock) [default: ${providerDefault}]: `,
  );
  const provider = providerInput as 'ollama' | 'mock';

  let baseUrl = currentConfig.baseUrl;
  if (provider === 'ollama') {
    const baseUrlDefault = currentConfig.baseUrl || 'http://localhost:11434';
    baseUrl =
      (await question(`Enter Ollama base URL [default: ${baseUrlDefault}]: `)) || baseUrlDefault;
  }

  const defaultWarm = currentConfig.warmModel || DEFAULTS.warmModel;
  const warmModel =
    (await question(`Enter warmModel (indexing model) [default: ${defaultWarm}]: `)) || defaultWarm;

  const defaultSearch = currentConfig.searchModel || warmModel;
  const searchModel =
    (await question(`Enter searchModel (query model) [default: ${defaultSearch}]: `)) ||
    defaultSearch;

  const defaultApiKey = currentConfig.apiKey ?? DEFAULTS.apiKey;
  const apiKey = (await question('Enter API key (press Enter for none): ')) || defaultApiKey;

  return {
    provider,
    baseUrl,
    warmModel,
    searchModel,
    apiKey,
  };
}
