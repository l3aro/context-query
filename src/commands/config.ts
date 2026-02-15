import readline from 'readline';
import { loadConfig, saveConfig } from '../config';
import { runFullConfigInterview } from './config-interview.ts';

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, promptText: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(promptText, resolve);
  });
}

export async function runConfig(projectPath: string): Promise<void> {
  const config = loadConfig(projectPath);
  const rl = createReadline();

  try {
    console.log('\n# Current Configuration');
    console.log(`provider: ${config.embeddings.provider}`);
    console.log(`baseUrl: ${config.embeddings.baseUrl}`);
    console.log(`warmModel: ${config.embeddings.warmModel}`);
    console.log(`searchModel: ${config.embeddings.searchModel}`);
    console.log(`apiKey: ${config.embeddings.apiKey || '(none)'}`);

    const editAnswer = await question(rl, 'Edit config? (y/n): ');
    const edit = editAnswer.toLowerCase() === 'y' || editAnswer.toLowerCase() === 'yes';

    if (!edit) {
      console.log('No changes made.');
      return;
    }

    const newConfig = await runFullConfigInterview(config.embeddings, (p) => question(rl, p));

    console.log('\n# New Configuration');
    console.log(`provider: ${newConfig.provider}`);
    console.log(`baseUrl: ${newConfig.baseUrl}`);
    console.log(`warmModel: ${newConfig.warmModel}`);
    console.log(`searchModel: ${newConfig.searchModel}`);
    console.log(`apiKey: ${newConfig.apiKey || '(none)'}`);

    const saveAnswer = await question(rl, 'Save? (y/n): ');
    const save = saveAnswer.toLowerCase() === 'y' || saveAnswer.toLowerCase() === 'yes';

    if (!save) {
      console.log('Changes discarded.');
      return;
    }

    saveConfig(projectPath, { embeddings: newConfig });
    console.log('Configuration saved.');
  } finally {
    rl.close();
  }
}
