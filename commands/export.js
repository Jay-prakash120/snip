import chalk from 'chalk';
import { loadSnippets } from '../lib/store.js';
import { exportToEditor, SUPPORTED_EDITORS } from '../lib/exporters.js';

/**
 * Handles the "export" command — exports snippets to a specific editor.
 * Usage: snip export <vscode|cursor|sublime|antigravity>
 */
export function exportCommand(editorName) {
  if (!editorName || editorName.trim() === '') {
    console.error(chalk.red('\n  ✗ Error: Editor name is required.\n'));
    console.log(chalk.dim(`  Supported editors: ${SUPPORTED_EDITORS.join(', ')}`));
    console.log(chalk.dim('  Usage: snip export vscode\n'));
    process.exit(1);
  }

  const editor = editorName.toLowerCase().trim();

  if (!SUPPORTED_EDITORS.includes(editor)) {
    console.error(chalk.red(`\n  ✗ Unsupported editor: "${editorName}"\n`));
    console.log(chalk.dim(`  Supported editors: ${SUPPORTED_EDITORS.join(', ')}\n`));
    process.exit(1);
  }

  const snippets = loadSnippets();
  const result = exportToEditor(editor, snippets);

  if (result.success) {
    console.log(chalk.green(`\n  ✓ ${result.message}\n`));
    console.log(chalk.dim(`  Restart ${editorName} to pick up the new snippets.\n`));
  } else {
    console.error(chalk.red(`\n  ✗ ${result.message}\n`));
    process.exit(1);
  }
}
