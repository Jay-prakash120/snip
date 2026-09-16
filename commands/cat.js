import chalk from 'chalk';
import { getSnippet } from '../lib/store.js';

/**
 * Handles the "cat" command — displays snippet details in a pretty box.
 * Usage: snip cat "prefix"
 */
export function catCommand(name) {
  if (!name || name.trim() === '') {
    console.error(chalk.red('\n  ✗ Error: Snippet name is required.\n'));
    console.log(chalk.dim('  Usage: snip cat "my_snippet"\n'));
    process.exit(1);
  }

  const snippet = getSnippet(name);
  if (!snippet) {
    console.error(chalk.red(`\n  ✗ Snippet "${name}" not found.\n`));
    console.log(chalk.dim('  Run `snip ls` to see available snippets.\n'));
    process.exit(1);
  }

  const body = Array.isArray(snippet.body) ? snippet.body : [snippet.body];
  const description = snippet.description || '';

  const language = snippet.language || '';

  // Calculate box width
  const allLines = [
    name,
    description,
    ...body,
    `Created:  ${formatDate(snippet.createdAt)}`,
    `Modified: ${formatDate(snippet.updatedAt)}`,
    language ? `Language: ${language}` : '',
  ];
  const maxLen = Math.max(...allLines.map((l) => stripAnsi(l).length), 40);
  const width = maxLen + 4;

  // Box drawing
  const hLine = '─'.repeat(width);
  const pad = (text, w = width) => {
    const stripped = stripAnsi(text);
    const padding = w - stripped.length;
    return text + ' '.repeat(Math.max(0, padding));
  };

  console.log('');
  console.log(chalk.dim(`  ╭${hLine}╮`));

  // Title
  console.log(chalk.dim('  │') + '  ' + chalk.bold.cyan(pad(name, width - 2)) + chalk.dim('│'));

  // Description
  if (description) {
    console.log(
      chalk.dim('  │') + '  ' + chalk.italic.dim(pad(description, width - 2)) + chalk.dim('│')
    );
  }

  // Separator
  console.log(chalk.dim(`  ├${hLine}┤`));

  // Body
  for (const line of body) {
    console.log(
      chalk.dim('  │') + '  ' + chalk.white(pad(line, width - 2)) + chalk.dim('│')
    );
  }

  // Separator
  console.log(chalk.dim(`  ├${hLine}┤`));

  // Metadata
  if (language) {
    const langLine = `Language: ${language}`;
    console.log(
      chalk.dim('  │') + '  ' + chalk.magenta(pad(langLine, width - 2)) + chalk.dim('│')
    );
  }
  const created = `Created:  ${formatDate(snippet.createdAt)}`;
  const modified = `Modified: ${formatDate(snippet.updatedAt)}`;
  console.log(
    chalk.dim('  │') + '  ' + chalk.dim(pad(created, width - 2)) + chalk.dim('│')
  );
  console.log(
    chalk.dim('  │') + '  ' + chalk.dim(pad(modified, width - 2)) + chalk.dim('│')
  );

  console.log(chalk.dim(`  ╰${hLine}╯`));
  console.log('');
}

/**
 * Formats an ISO date string into a human-readable format.
 */
function formatDate(isoStr) {
  if (!isoStr) return 'unknown';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Strips ANSI escape codes from a string for accurate length calculation.
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
