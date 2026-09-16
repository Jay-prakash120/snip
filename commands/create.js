import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { getSnippet, upsertSnippet } from '../lib/store.js';
import { promptBody } from '../lib/prompt-body.js';

/**
 * Handles the "create snippet" flow.
 * Usage: snip "prefix" [-m "description"] [--lang "python"]
 */
export async function createCommand(name, options) {
  if (!name || name.trim() === '') {
    console.error(chalk.red('\n  ✗ Error: Snippet name is required.\n'));
    console.log(chalk.dim('  Usage: snip "my_snippet" [-m "description"] [--lang "python"]\n'));
    process.exit(1);
  }

  // Check if snippet already exists
  const existing = getSnippet(name);
  if (existing) {
    console.log(chalk.yellow(`\n  ⚠ Snippet "${name}" already exists.\n`));
    const overwrite = await confirm({
      message: 'Overwrite it?',
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.dim('  Aborted.\n'));
      return;
    }
  }

  // Prompt for body
  console.log(chalk.cyan(`\n  Creating snippet: ${chalk.bold(name)}`));
  if (options.message) {
    console.log(chalk.dim(`  Description: ${options.message}`));
  }
  if (options.lang) {
    console.log(chalk.dim(`  Language: ${options.lang}`));
  }
  console.log('');

  const bodyText = await promptBody({
    header: `Creating: ${name}`,
  });

  if (bodyText === null) {
    console.log(chalk.dim('\n  Aborted.\n'));
    return;
  }

  // Clean up the body
  const lines = bodyText.split('\n');

  if (lines.length === 0 || lines.every((l) => l.trim() === '')) {
    console.error(chalk.red('\n  ✗ Error: Snippet body cannot be empty.\n'));
    process.exit(1);
  }

  // Save the snippet
  const snippet = upsertSnippet(name, {
    body: lines,
    description: options.message || '',
    language: options.lang || '',
  });

  console.log(chalk.green(`\n  ✓ Saved "${name}"`));
  if (snippet.description) {
    console.log(chalk.dim(`    ${snippet.description}`));
  }
  if (snippet.language) {
    console.log(chalk.dim(`    Language: ${snippet.language}`));
  }
  console.log(chalk.dim(`    ${lines.length} line(s)\n`));
}
