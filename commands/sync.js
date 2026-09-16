import chalk from 'chalk';
import { loadSnippets } from '../lib/store.js';
import {
  getAutoExportEditors,
  toggleAutoExportEditor,
  setAutoExportEditors,
} from '../lib/config.js';
import {
  SUPPORTED_EDITORS,
  exportToEditor,
  getEditorSnippetsDirs,
} from '../lib/exporters.js';

/**
 * Handles the "sync" command (alias: auto-export).
 * Usage:
 *   snip sync              — show current auto-sync status across all editors
 *   snip sync <editor>     — toggle auto-sync for an editor (e.g. snip sync antigravity)
 *   snip sync all          — enable auto-sync for all supported editors
 *   snip sync none         — disable auto-sync completely
 */
export function syncCommand(editor) {
  // If no argument: print status of all editors
  if (!editor) {
    showSyncStatus();
    return;
  }

  const target = editor.trim().toLowerCase();

  if (target === 'all') {
    const list = setAutoExportEditors(SUPPORTED_EDITORS);
    const snippets = loadSnippets();
    console.log(chalk.green('\n  ✓ Auto-sync enabled for ALL supported editors:'));
    for (const ed of list) {
      exportToEditor(ed, snippets);
      const dirs = getEditorSnippetsDirs(ed);
      console.log(chalk.cyan(`    ● ${ed.padEnd(12)} `) + chalk.dim(dirs.join(', ') || ''));
    }
    console.log(chalk.dim('\n  Any snippet changes will now auto-sync to all editors.\n'));
    return;
  }

  if (target === 'none' || target === 'off') {
    setAutoExportEditors([]);
    console.log(chalk.yellow('\n  ⚠ Auto-sync disabled for all editors.\n'));
    return;
  }

  if (!SUPPORTED_EDITORS.includes(target)) {
    console.error(chalk.red(`\n  ✗ Unknown editor: "${editor}"`));
    console.log(chalk.dim(`  Supported editors: ${SUPPORTED_EDITORS.join(', ')}, all, none\n`));
    return;
  }

  const { enabled, editors } = toggleAutoExportEditor(target);
  const snippets = loadSnippets();

  if (enabled) {
    exportToEditor(target, snippets);
    const dirs = getEditorSnippetsDirs(target);
    console.log(chalk.green(`\n  ✓ Auto-sync ENABLED for "${target}"`));
    console.log(chalk.dim(`    Merged ${Object.keys(snippets).length} snippet(s) to: ${dirs.join(', ')}`));
    console.log(chalk.dim(`    Active sync editors: ${editors.join(', ')}\n`));
  } else {
    console.log(chalk.yellow(`\n  ✓ Auto-sync DISABLED for "${target}"`));
    console.log(chalk.dim(`    Active sync editors: ${editors.length > 0 ? editors.join(', ') : 'none'}\n`));
  }
}

function showSyncStatus() {
  const active = getAutoExportEditors();
  const snippets = loadSnippets();
  const count = Object.keys(snippets).length;

  console.log(chalk.cyan('\n  ⚡ Snippet Auto-Sync Status:'));
  console.log(chalk.dim(`  Canonical store: ~/.snip/snippets.json (${count} snippet(s))\n`));

  for (const ed of SUPPORTED_EDITORS) {
    const isEnabled = active.includes(ed);
    const dirs = getEditorSnippetsDirs(ed);
    const icon = isEnabled ? chalk.green('●') : chalk.dim('○');
    const badge = isEnabled ? chalk.green.bold('[active]  ') : chalk.dim('[inactive]');
    const edName = chalk.bold(ed.padEnd(12));
    const pathStr = dirs.length > 0 ? chalk.dim(dirs[0]) : chalk.dim('(directory not detected)');

    console.log(`    ${icon} ${edName} ${badge}  ${pathStr}`);
    if (dirs.length > 1) {
      for (let i = 1; i < dirs.length; i++) {
        console.log(`      ${' '.repeat(12)}             ${chalk.dim(dirs[i])}`);
      }
    }
  }

  console.log('');
  console.log(chalk.dim('  Commands:'));
  console.log(chalk.dim('    snip sync <editor>  — toggle an editor (e.g. snip sync antigravity)'));
  console.log(chalk.dim('    snip sync all       — enable auto-sync for all supported editors'));
  console.log(chalk.dim('    snip sync none      — disable auto-sync\n'));
}
