#!/usr/bin/env bun

import { Command } from 'commander';
import { buildFileTree, printFileTree } from './commands/tree';
import { analyzeDirectory } from './commands/structure';
import { runCalls } from './commands/calls';
import { runImpact } from './commands/impact';
import { runWarm } from './commands/warm';
import { runSemantic } from './commands/semantic';

const program = new Command();

program.name('ctxq').description('Code analysis tool for LLMs').version('0.1.0');

program
  .command('tree')
  .description('Show file structure')
  .argument('[path]', 'Path to analyze', '.')
  .action((path) => {
    const nodes = buildFileTree(path);
    printFileTree(nodes);
  });

program
  .command('structure')
  .description('Show functions and classes')
  .argument('[path]', 'Path to analyze', '.')
  .action((path) => {
    const units = analyzeDirectory(path);
    for (const unit of units) {
      console.log(`${unit.type} ${unit.name} (${unit.file}:${unit.line})`);
    }
  });

program
  .command('calls')
  .description('Build call graph')
  .argument('[path]', 'Path to analyze', '.')
  .action((path) => {
    runCalls(path);
  });

program
  .command('impact')
  .description('Find callers of a function')
  .argument('<function>', 'Function name')
  .argument('[path]', 'Path to analyze', '.')
  .action((fn, path) => {
    runImpact(fn, path);
  });

program
  .command('warm')
  .description('Build semantic index')
  .argument('[path]', 'Path to analyze', '.')
  .action(async (path) => {
    await runWarm({ projectPath: path });
  });

program
  .command('semantic')
  .description('Semantic code search')
  .argument('<query>', 'Search query')
  .argument('[path]', 'Path to search', '.')
  .action(async (query, path) => {
    await runSemantic({ projectPath: path, query });
  });

program.parse();
