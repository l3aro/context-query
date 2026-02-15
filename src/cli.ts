#!/usr/bin/env bun

import { Command } from 'commander';
import { runCalls } from './commands/calls';
import { runComplexity } from './commands/complexity';
import { runConfig } from './commands/config';
import { runDfg } from './commands/dfg';
import { runImpact } from './commands/impact';
import { runSemantic } from './commands/semantic';
import { analyzeDirectory } from './commands/structure';
import { buildFileTree, printFileTree } from './commands/tree';
import { runWarm } from './commands/warm';

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
  .command('complexity')
  .description('Calculate cyclomatic complexity')
  .argument('<file>', 'File to analyze')
  .argument('[function]', 'Function name (optional)')
  .action((file, fn) => {
    runComplexity(file, fn);
  });

program
  .command('dfg')
  .description('Show data flow graph for a function')
  .argument('<file>', 'Source file')
  .argument('<function>', 'Function name')
  .action((file, fn) => {
    runDfg(file, fn);
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

program
  .command('config')
  .description('View and edit configuration')
  .argument('[path]', 'Path to project', '.')
  .action(async (path) => {
    await runConfig(path);
  });

program.parse();
