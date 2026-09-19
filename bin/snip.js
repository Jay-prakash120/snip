#!/usr/bin/env node

import { readFileSync } from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { createCommand } from '../commands/create.js';
import { catCommand } from '../commands/cat.js';
import { editCommand } from '../commands/edit.js';
import { listCommand } from '../commands/list.js';
import { removeCommand } from '../commands/remove.js';
import { exportCommand } from '../commands/export.js';
import { configCommand } from '../commands/config.js';
import { completionCommand } from '../commands/completion.js';
import { syncCommand } from '../commands/sync.js';
import { listSnippetNames } from '../lib/completion.js';
import { SUPPORTED_EDITORS } from '../lib/exporters.js';
import { startRepl } from '../lib/repl.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);

// ─── Hidden: shell completion helper ───────────────────────────────────────
// Called by tab completion scripts to get dynamic snippet names.
// Must run before Commander parses to avoid conflicts.
if (process.argv.includes('--completions')) {
  const action = process.argv[process.argv.indexOf('--completions') + 1];
  if (action === 'list') {
    process.stdout.write(listSnippetNames());
    process.exit(0);
  }
}

const program = new Command();

program
  .name('snip')
  .description('A git-inspired CLI tool to create, manage, and export code snippets')
  .version(pkg.version, '-v, --version');

// ─── Default command: launch shell (if no args) or create a snippet ───────
program
  .argument('[name]', 'snippet prefix/name')
  .option('-m, --message <description>', 'description for the snippet')
  .option('-l, --lang <language>', 'language scope (e.g. python, javascript)')
  .action(async (name, options, command) => {
    // If no name and no subcommand was matched:
    // In interactive TTY, toggle/start the snip shell; in non-TTY, show help
    if (!name) {
      if (process.stdin.isTTY) {
        await startRepl();
      } else {
        program.help();
      }
      return;
    }
    const mergedOptions = { ...program.opts(), ...options };
    await createCommand(name, mergedOptions);
  });

// ─── create: create a snippet ──────────────────────────────────────────────
program
  .command('create <name>')
  .description('Create a new snippet')
  .option('-m, --message <description>', 'description for the snippet')
  .option('-l, --lang <language>', 'language scope (e.g. python, javascript)')
  .action(async (name, options) => {
    const mergedOptions = { ...program.opts(), ...options };
    await createCommand(name, mergedOptions);
  });

// ─── cat: view a snippet ───────────────────────────────────────────────────
program
  .command('cat <name>')
  .description('Display a snippet\'s details')
  .action((name) => {
    catCommand(name);
  });

// ─── edit: edit a snippet ──────────────────────────────────────────────────
program
  .command('edit <name>')
  .description('Edit an existing snippet')
  .option('-m, --message <description>', 'update the description')
  .option('-l, --lang <language>', 'update the language scope')
  .option('-b, --body', 'open the editor to modify snippet body')
  .action(async (name, options) => {
    const mergedOptions = { ...program.opts(), ...options };
    await editCommand(name, mergedOptions);
  });

// ─── ls: list all snippets ─────────────────────────────────────────────────
program
  .command('ls')
  .description('List all saved snippets')
  .action(() => {
    listCommand();
  });

// ─── rm: remove snippets ──────────────────────────────────────────────────
program
  .command('rm [names...]')
  .description('Delete snippet(s) by name, index, or interactively')
  .action(async (names) => {
    await removeCommand(names);
  });

// ─── export: export snippets to an editor ──────────────────────────────────
program
  .command('export <editor>')
  .description(`Export snippets to an editor (${SUPPORTED_EDITORS.join(', ')})`)
  .action((editor) => {
    exportCommand(editor);
  });

// ─── sync: multi-editor auto-export toggle ──────────────────────────────────
program
  .command('sync [editor]')
  .alias('auto-export')
  .description(`View or toggle automatic sync across editors (${SUPPORTED_EDITORS.join(', ')}, all, none)`)
  .action((editor) => {
    syncCommand(editor);
  });

// ─── config: manage configuration ─────────────────────────────────────────
program
  .command('config [action] [args...]')
  .description('View or modify snip configuration')
  .action((action, args) => {
    configCommand(action, args);
  });

// ─── completion: shell tab completion ──────────────────────────────────────
program
  .command('completion [shell] [target]')
  .description('Output shell completion script (bash, powershell) or install automatically')
  .action((shell, target) => {
    completionCommand(shell, target);
  });

// ─── shell: interactive shell with real-time ghost text ────────────────────
program
  .command('shell')
  .alias('repl')
  .description('Start interactive shell with real-time ghost text suggestions')
  .action(async () => {
    await startRepl();
  });

// ─── Error handling ────────────────────────────────────────────────────────
program.showHelpAfterError(chalk.dim('(run `snip --help` for usage)'));

program.parse(process.argv);
