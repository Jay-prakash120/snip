import chalk from 'chalk';
import readline from 'readline';
import { loadSnippets, saveSnippets, deleteSnippet, getSnippet } from '../lib/store.js';

/**
 * Handles the "rm" command.
 *
 * Modes:
 *   snip rm                   → interactive mode (type indices, see live red highlighting)
 *   snip rm 1 2 3             → remove by index
 *   snip rm "replace_many()"  → remove by name
 */
export async function removeCommand(args) {
  const snippets = loadSnippets();
  const entries = Object.entries(snippets);

  if (entries.length === 0) {
    console.log(chalk.yellow('\n  No snippets to remove.\n'));
    return;
  }

  // No arguments → interactive mode
  if (!args || args.length === 0) {
    await interactiveRemove(entries, snippets);
    return;
  }

  // Determine if arguments are indices or names
  const allNumeric = args.every((a) => /^\d+$/.test(a));

  if (allNumeric) {
    // Index-based removal
    const indices = args.map(Number);
    const toDelete = [];
    const invalid = [];

    for (const idx of indices) {
      if (idx < 1 || idx > entries.length) {
        invalid.push(idx);
      } else {
        toDelete.push(entries[idx - 1][0]); // convert 1-based to name
      }
    }

    if (invalid.length > 0) {
      console.error(
        chalk.red(`\n  ✗ Invalid index(es): ${invalid.join(', ')} (valid: 1-${entries.length})\n`)
      );
    }

    if (toDelete.length === 0) {
      console.log(chalk.dim('  Nothing to remove.\n'));
      return;
    }

    // Show what will be deleted
    console.log(chalk.yellow('\n  About to delete:'));
    for (const name of toDelete) {
      console.log(chalk.red(`    ✗ ${name}`));
    }
    console.log('');

    // Confirm
    const confirmed = await promptConfirm(`Delete ${toDelete.length} snippet(s)?`);
    if (!confirmed) {
      console.log(chalk.dim('  Aborted.\n'));
      return;
    }

    for (const name of toDelete) {
      deleteSnippet(name);
    }
    console.log(chalk.green(`\n  ✓ Deleted ${toDelete.length} snippet(s)\n`));
    return;
  }

  // Name-based removal (single or multiple quoted names)
  for (const name of args) {
    const snippet = getSnippet(name);
    if (!snippet) {
      console.error(chalk.red(`\n  ✗ Snippet "${name}" not found.`));
      console.log(chalk.dim('  Run `snip ls` to see available snippets.\n'));
      continue;
    }

    const bodyPreview = Array.isArray(snippet.body)
      ? snippet.body.slice(0, 3).join('\n    ')
      : snippet.body;
    const lineCount = Array.isArray(snippet.body) ? snippet.body.length : 1;

    console.log(chalk.yellow(`\n  About to delete "${name}":`));
    console.log(chalk.dim(`    ${bodyPreview}`));
    if (lineCount > 3) {
      console.log(chalk.dim(`    ... (${lineCount - 3} more lines)`));
    }
    console.log('');

    const confirmed = await promptConfirm(`Delete "${name}"?`);
    if (!confirmed) {
      console.log(chalk.dim('  Skipped.\n'));
      continue;
    }

    deleteSnippet(name);
    console.log(chalk.green(`  ✓ Deleted "${name}"\n`));
  }
}

/**
 * Interactive remove mode with real-time visual feedback.
 * Shows the snippet table. As the user types index numbers,
 * those rows turn red in real-time. Enter confirms, Escape cancels.
 */
async function interactiveRemove(entries, snippets) {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY) {
    console.error(chalk.red('\n  ✗ Interactive mode requires a TTY terminal.\n'));
    process.exit(1);
  }

  let selectedIndices = new Set();
  let inputBuffer = '';

  const numWidth = 4;
  const prefixWidth = Math.min(Math.max(...entries.map(([name]) => name.length), 6) + 2, 30);
  const descWidth = 38;
  const dateWidth = 12;

  const hPad = (text, width) => {
    const len = text.length;
    return text + ' '.repeat(Math.max(0, width - len));
  };

  const truncate = (text, maxLen) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  };

  const topBorder = `  ┌${'─'.repeat(numWidth)}┬${'─'.repeat(prefixWidth)}┬${'─'.repeat(descWidth)}┬${'─'.repeat(dateWidth)}┐`;
  const midBorder = `  ├${'─'.repeat(numWidth)}┼${'─'.repeat(prefixWidth)}┼${'─'.repeat(descWidth)}┼${'─'.repeat(dateWidth)}┤`;
  const botBorder = `  └${'─'.repeat(numWidth)}┴${'─'.repeat(prefixWidth)}┴${'─'.repeat(descWidth)}┴${'─'.repeat(dateWidth)}┘`;

  function formatShortDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Total lines we'll render (header + border*3 + entries + footer + input)
  const totalLines = entries.length + 7;

  function render() {
    // Move cursor up and clear
    stdout.write(`\x1b[${totalLines}A`);
    stdout.write('\x1b[0J');

    stdout.write(
      chalk.cyan('\n  Select snippets to remove ') +
        chalk.dim('(type indices, Enter to confirm, Esc to cancel)\n')
    );
    stdout.write(chalk.dim(topBorder) + '\n');

    // Header
    const header =
      chalk.dim('  │') +
      chalk.bold(hPad(' # ', numWidth)) +
      chalk.dim('│') +
      chalk.bold(hPad(' Prefix', prefixWidth)) +
      chalk.dim('│') +
      chalk.bold(hPad(' Description', descWidth)) +
      chalk.dim('│') +
      chalk.bold(hPad(' Created', dateWidth)) +
      chalk.dim('│');
    stdout.write(header + '\n');
    stdout.write(chalk.dim(midBorder) + '\n');

    // Rows
    entries.forEach(([name, snip], index) => {
      const idx = index + 1;
      const isSelected = selectedIndices.has(idx);
      const colorFn = isSelected ? chalk.red.strikethrough : (t) => t;
      const numColorFn = isSelected ? chalk.red.bold : chalk.dim;
      const prefixColorFn = isSelected ? chalk.red.strikethrough : chalk.cyan;
      const marker = isSelected ? '✗' : ' ';

      const num = `${marker}${idx.toString().padStart(2)} `;
      const prefix = ` ${truncate(name, prefixWidth - 2)}`;
      const desc = ` ${truncate(snip.description || '—', descWidth - 2)}`;
      const date = ` ${formatShortDate(snip.createdAt)}`;

      const row =
        chalk.dim('  │') +
        numColorFn(hPad(num, numWidth)) +
        chalk.dim('│') +
        prefixColorFn(hPad(prefix, prefixWidth)) +
        chalk.dim('│') +
        colorFn(hPad(desc, descWidth)) +
        chalk.dim('│') +
        (isSelected ? chalk.red : chalk.dim)(hPad(date, dateWidth)) +
        chalk.dim('│');
      stdout.write(row + '\n');
    });

    stdout.write(chalk.dim(botBorder) + '\n');

    // Input line
    const selectedCount = selectedIndices.size;
    const status =
      selectedCount > 0
        ? chalk.red(` (${selectedCount} selected for deletion)`)
        : '';
    stdout.write(`  ${chalk.bold('>')} ${inputBuffer}${chalk.dim('_')}${status}\n`);
  }

  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    readline.emitKeypressEvents(stdin);

    // Print initial blank lines to create render area
    stdout.write('\n'.repeat(totalLines));
    render();

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('keypress', onKeypress);
    }

    function onKeypress(str, key) {
      if (!key) return;

      // Escape — cancel
      if (key.name === 'escape') {
        cleanup();
        stdout.write(chalk.dim('\n  Aborted.\n\n'));
        resolve();
        return;
      }

      // Ctrl+C — cancel
      if (key.ctrl && key.name === 'c') {
        cleanup();
        stdout.write(chalk.dim('\n  Aborted.\n\n'));
        resolve();
        return;
      }

      // Enter — confirm
      if (key.name === 'return') {
        cleanup();
        if (selectedIndices.size === 0) {
          stdout.write(chalk.dim('\n  No snippets selected.\n\n'));
          resolve();
          return;
        }

        // Delete selected
        const toDelete = [...selectedIndices].sort((a, b) => a - b).map((i) => entries[i - 1][0]);
        for (const name of toDelete) {
          deleteSnippet(name);
        }
        stdout.write(chalk.green(`\n  ✓ Deleted ${toDelete.length} snippet(s):\n`));
        for (const name of toDelete) {
          stdout.write(chalk.dim(`    - ${name}\n`));
        }
        stdout.write('\n');
        resolve();
        return;
      }

      // Backspace — remove last character from input buffer
      if (key.name === 'backspace') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          parseInput();
          render();
        }
        return;
      }

      // Space or comma — separator, parse current number
      if (str === ' ' || str === ',') {
        inputBuffer += str;
        parseInput();
        render();
        return;
      }

      // Digit — add to input buffer
      if (str && /\d/.test(str)) {
        inputBuffer += str;
        parseInput();
        render();
        return;
      }
    }

    function parseInput() {
      // Parse the input buffer to extract indices
      selectedIndices = new Set();
      const parts = inputBuffer.split(/[\s,]+/).filter(Boolean);
      for (const part of parts) {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= entries.length) {
          selectedIndices.add(num);
        }
      }
    }

    stdin.on('keypress', onKeypress);
  });
}

/**
 * Simple Y/N confirm using readline (non-raw).
 */
function promptConfirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(chalk.yellow(`  ${message} `) + chalk.dim('(y/N) '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
