import { loadConfig, saveConfig, type Config } from '../config';
import { runFullConfigInterview } from './config-interview';

export async function runConfig(projectPath: string): Promise<void> {
  // 1. Load current config via loadConfig(projectPath)
  const config = loadConfig(projectPath);

  // 2. Display config in readable format (key: value, one per line)
  console.log('\n# Current Configuration');
  console.log(`provider: ${config.embeddings.provider}`);
  console.log(`baseUrl: ${config.embeddings.baseUrl}`);
  console.log(`warmModel: ${config.embeddings.warmModel}`);
  console.log(`searchModel: ${config.embeddings.searchModel}`);
  console.log(`apiKey: ${config.embeddings.apiKey || '(none)'}`);

  // 3. Prompt "Edit config? (y/n): "
  const edit = await promptYesNo('Edit config? (y/n): ');

  if (!edit) {
    console.log('No changes made.');
    return;
  }

  // 4. Run full interview
  const newConfig = await runFullConfigInterview(config.embeddings);

  // 5. Display new config
  console.log('\n# New Configuration');
  console.log(`provider: ${newConfig.provider}`);
  console.log(`baseUrl: ${newConfig.baseUrl}`);
  console.log(`warmModel: ${newConfig.warmModel}`);
  console.log(`searchModel: ${newConfig.searchModel}`);
  console.log(`apiKey: ${newConfig.apiKey || '(none)'}`);

  // 6. Prompt "Save? (y/n): "
  const save = await promptYesNo('Save? (y/n): ');

  if (!save) {
    console.log('Changes discarded.');
    return;
  }

  // 7. Save via saveConfig(projectPath, { embeddings: newConfig })
  saveConfig(projectPath, { embeddings: newConfig });
  console.log('Configuration saved.');
}

// Helper function for yes/no prompts
async function promptYesNo(promptText: string): Promise<boolean> {
  process.stdout.write(promptText);
  const stdin = Bun.file('/dev/stdin');
  const text = await stdin.text();
  const answer = text.trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}