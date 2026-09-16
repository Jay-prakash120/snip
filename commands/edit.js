import chalk from 'chalk';
import { getSnippet, upsertSnippet } from '../lib/store.js';
import { promptBody } from '../lib/prompt-body.js';
import { autoExportIfEnabled } from '../lib/exporters.js';

/**
 * Handles the "edit" command — opens snippet body in configured editor for modification.
 * Usage: snip edit "prefix" [-m "new description"] [--lang "python"]
 */
export async function editCommand(name, options) {
  if (!name || name.trim() === '') {
    console.error(chalk.red('\n  ✗ Error: Snippet name is required.\n'));
    console.log(chalk.dim('  Usage: snip edit "my_snippet" [-m "new description"] [--lang "python"]\n'));
    process.exit(1);
  }

  const snippet = getSnippet(name);
  if (!snippet) {
    console.error(chalk.red(`\n  ✗ Snippet "${name}" not found.\n`));
    console.log(chalk.dim('  Run `snip ls` to see available snippets.\n'));
    process.exit(1);
  }

  const currentBody = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
  const descChanged = options.message !== undefined;
  const langChanged = options.lang !== undefined;
  const wantsBodyEdit = options.body === true || (!descChanged && !langChanged);

  let newLines = Array.isArray(snippet.body) ? [...snippet.body] : [snippet.body];
  let bodyChanged = false;

  if (wantsBodyEdit) {
    console.log(chalk.cyan(`\n  Editing snippet: ${chalk.bold(name)}\n`));

    const newBodyText = await promptBody({
      defaultValue: currentBody,
      header: `Editing: ${name}`,
      language: options.lang || snippet.language || '',
    });

    if (newBodyText === null) {
      console.log(chalk.dim('\n  Aborted.\n'));
      return;
    }

    newLines = newBodyText.split('\n');

    if (newLines.length === 0 || newLines.every((l) => l.trim() === '')) {
      console.error(chalk.red('\n  ✗ Error: Snippet body cannot be empty.\n'));
      process.exit(1);
    }

    bodyChanged = currentBody !== newBodyText;
  }

  if (!bodyChanged && !descChanged && !langChanged) {
    console.log(chalk.yellow('\n  No changes detected.\n'));
    return;
  }

  const updatedSnippet = upsertSnippet(name, {
    body: newLines,
    description: descChanged ? options.message : snippet.description,
    language: langChanged ? options.lang : snippet.language,
  });

  console.log(chalk.green(`\n  ✓ Updated "${name}"`));

  if (bodyChanged) {
    const oldCount = currentBody.split('\n').length;
    const newCount = newLines.length;
    const diff = newCount - oldCount;
    const diffStr =
      diff > 0 ? chalk.green(`+${diff} lines`) : diff < 0 ? chalk.red(`${diff} lines`) : 'same length';
    console.log(chalk.dim(`    Body: ${oldCount} → ${newCount} lines (${diffStr})`));
  }
  if (descChanged) {
    console.log(chalk.dim(`    Description: "${updatedSnippet.description}"`));
  }
  if (langChanged) {
    console.log(chalk.dim(`    Language: "${updatedSnippet.language}"`));
  }

  const sync = autoExportIfEnabled();
  if (sync && sync.success && sync.editors?.length > 0) {
    console.log(chalk.dim(`    ↻ Auto-synced to ${sync.editors.join(', ')}`));
  }
  console.log('');
}
