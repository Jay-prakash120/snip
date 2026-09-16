import chalk from 'chalk';
import { loadSnippets } from '../lib/store.js';

/**
 * Handles the "ls" command — lists all snippets in a table.
 * Usage: snip ls
 */
export function listCommand() {
  const snippets = loadSnippets();
  const entries = Object.entries(snippets);

  if (entries.length === 0) {
    console.log(chalk.yellow('\n  No snippets yet.\n'));
    console.log(chalk.dim('  Create one with: snip "my_snippet"\n'));
    return;
  }

  // Check if any snippet has a language set
  const hasLang = entries.some(([, snip]) => snip.language);

  // Column widths
  const numWidth = 4;
  const prefixWidth = Math.min(
    Math.max(...entries.map(([name]) => name.length), 6) + 2,
    30
  );
  const langWidth = hasLang ? 12 : 0;
  const descWidth = hasLang ? 30 : 38;
  const dateWidth = 12;

  const hPad = (text, width) => {
    const len = text.length;
    return text + ' '.repeat(Math.max(0, width - len));
  };

  const truncate = (text, maxLen) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  };

  // Build borders
  let topBorder = `  ┌${'─'.repeat(numWidth)}┬${'─'.repeat(prefixWidth)}┬`;
  let midBorder = `  ├${'─'.repeat(numWidth)}┼${'─'.repeat(prefixWidth)}┼`;
  let botBorder = `  └${'─'.repeat(numWidth)}┴${'─'.repeat(prefixWidth)}┴`;

  if (hasLang) {
    topBorder += `${'─'.repeat(langWidth)}┬`;
    midBorder += `${'─'.repeat(langWidth)}┼`;
    botBorder += `${'─'.repeat(langWidth)}┴`;
  }

  topBorder += `${'─'.repeat(descWidth)}┬${'─'.repeat(dateWidth)}┐`;
  midBorder += `${'─'.repeat(descWidth)}┼${'─'.repeat(dateWidth)}┤`;
  botBorder += `${'─'.repeat(descWidth)}┴${'─'.repeat(dateWidth)}┘`;

  console.log('');
  console.log(chalk.dim(topBorder));

  // Header
  let header =
    chalk.dim('  │') +
    chalk.bold(hPad(' # ', numWidth)) +
    chalk.dim('│') +
    chalk.bold(hPad(' Prefix', prefixWidth)) +
    chalk.dim('│');

  if (hasLang) {
    header += chalk.bold(hPad(' Lang', langWidth)) + chalk.dim('│');
  }

  header +=
    chalk.bold(hPad(' Description', descWidth)) +
    chalk.dim('│') +
    chalk.bold(hPad(' Created', dateWidth)) +
    chalk.dim('│');
  console.log(header);
  console.log(chalk.dim(midBorder));

  // Rows
  entries.forEach(([name, snip], index) => {
    const num = ` ${(index + 1).toString().padStart(2)} `;
    const prefix = ` ${truncate(name, prefixWidth - 2)}`;
    const desc = ` ${truncate(snip.description || '—', descWidth - 2)}`;
    const date = ` ${formatShortDate(snip.createdAt)}`;

    let row =
      chalk.dim('  │') +
      chalk.dim(hPad(num, numWidth)) +
      chalk.dim('│') +
      chalk.cyan(hPad(prefix, prefixWidth)) +
      chalk.dim('│');

    if (hasLang) {
      const lang = ` ${truncate(snip.language || '—', langWidth - 2)}`;
      row += chalk.magenta(hPad(lang, langWidth)) + chalk.dim('│');
    }

    row +=
      hPad(desc, descWidth) +
      chalk.dim('│') +
      chalk.dim(hPad(date, dateWidth)) +
      chalk.dim('│');
    console.log(row);
  });

  console.log(chalk.dim(botBorder));
  console.log(chalk.dim(`  ${entries.length} snippet(s) total\n`));
}

/**
 * Formats a date to a short display string.
 */
function formatShortDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
