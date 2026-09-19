import readline from 'readline';
import chalk from 'chalk';
import { loadSnippets } from './store.js';
import { SUPPORTED_EDITORS } from './exporters.js';
import { catCommand } from '../commands/cat.js';
import { editCommand } from '../commands/edit.js';
import { listCommand } from '../commands/list.js';
import { removeCommand } from '../commands/remove.js';
import { exportCommand } from '../commands/export.js';
import { configCommand } from '../commands/config.js';
import { completionCommand } from '../commands/completion.js';
import { createCommand } from '../commands/create.js';
import { syncCommand } from '../commands/sync.js';

export class ReplExitError extends Error {
  constructor(code) {
    super(`Command exited with code ${code}`);
    this.name = 'ReplExitError';
    this.code = code;
    this.isReplExit = true;
  }
}

export const replExitHandler = (code = 0) => {
  throw new ReplExitError(code);
};

export const COMMANDS = [
  'create',
  'add',
  'new',
  'cat',
  'edit',
  'ls',
  'rm',
  'sync',
  'export',
  'config',
  'completion',
  'help',
  'clear',
  'cls',
  'exit',
  'quit',
];

/**
 * Parses a command line string into an array of arguments, preserving quoted strings.
 */
export function parseArgs(line) {
  const args = [];
  let current = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (/\s/.test(char) && !inDoubleQuote && !inSingleQuote) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

/**
 * Prints the list of available commands in the shell.
 */
export function printHelp() {
  console.log(chalk.cyan('\n  Available Commands:'));
  console.log('    ' + chalk.bold('create <name>') + chalk.dim('   Create a new snippet (alias: add, new)'));
  console.log('    ' + chalk.bold('ls') + chalk.dim('              List all saved snippets'));
  console.log('    ' + chalk.bold('cat <name>') + chalk.dim('       Display a snippet with syntax highlighting'));
  console.log('    ' + chalk.bold('edit <name>') + chalk.dim('      Edit snippet in inline editor'));
  console.log('    ' + chalk.bold('rm [name|index]') + chalk.dim(' Delete snippets (interactive if no args)'));
  console.log('    ' + chalk.bold('sync [editor]') + chalk.dim('   Toggle auto-sync across editors (antigravity, vscode, all)'));
  console.log('    ' + chalk.bold('export <editor>') + chalk.dim('  Export to vscode, cursor, sublime, antigravity'));
  console.log('    ' + chalk.bold('config') + chalk.dim('          View or update configuration'));
  console.log('    ' + chalk.bold('clear / cls') + chalk.dim('     Clear the screen'));
  console.log('    ' + chalk.bold('exit / quit') + chalk.dim('     Exit the interactive shell\n'));
}

/**
 * Calculates ghost text suggestion based on current command input.
 */
export function getCommandGhostSuggestion(input) {
  if (!input) {
    return 'ls';
  }

  // Handle optional leading "snip " prefix inside shell
  const trimmedLeading = input.trimStart();
  const isSnipPrefix = /^snip\s+/i.test(trimmedLeading);
  const effectiveInput = isSnipPrefix ? trimmedLeading.replace(/^snip\s+/i, '') : input;

  // Tokens by whitespace, tracking trailing space
  const hasTrailingSpace = /\s$/.test(effectiveInput);
  const rawTokens = effectiveInput.trim().split(/\s+/).filter(Boolean);

  // If typing first token (the subcommand)
  if (rawTokens.length === 1 && !hasTrailingSpace) {
    const prefix = rawTokens[0].toLowerCase();
    const match = COMMANDS.find((cmd) => cmd.startsWith(prefix) && cmd !== prefix);
    if (match) {
      return match.slice(prefix.length);
    }
    return '';
  }

  const cmd = rawTokens[0]?.toLowerCase();

  // If command is create, add, or new -> suggest snippet name placeholder
  if (cmd === 'create' || cmd === 'add' || cmd === 'new') {
    if (rawTokens.length === 1 && hasTrailingSpace) {
      return '"my_snippet"';
    }
    return '';
  }

  // If command is cat, edit, or rm -> suggest snippet names
  if (cmd === 'cat' || cmd === 'edit' || cmd === 'rm') {
    const snippets = Object.keys(loadSnippets());
    if (snippets.length === 0) return '';

    // If typing after command: e.g. "cat " or "cat re" or "cat \"re"
    const lastToken = hasTrailingSpace ? '' : rawTokens[rawTokens.length - 1];
    const isQuoted = lastToken.startsWith('"') || lastToken.startsWith("'");
    const cleanPrefix = lastToken.replace(/^["']/, '').toLowerCase();

    for (const name of snippets) {
      if (name.toLowerCase().startsWith(cleanPrefix)) {
        const remaining = name.slice(cleanPrefix.length);
        if (remaining.length > 0) {
          return isQuoted ? `${remaining}"` : (name.includes(' ') || name.includes('(') ? `"${name}"` : remaining);
        }
      }
    }
    return '';
  }

  // If command is export -> suggest editors
  if (cmd === 'export') {
    const lastToken = hasTrailingSpace ? '' : rawTokens[rawTokens.length - 1];
    const prefix = lastToken.toLowerCase();
    const match = SUPPORTED_EDITORS.find((ed) => ed.startsWith(prefix) && ed !== prefix);
    if (match) {
      return match.slice(prefix.length);
    }
    return '';
  }

  // If command is config -> suggest get / set
  if (cmd === 'config') {
    if (rawTokens.length === 1 && hasTrailingSpace) {
      return 'get editor';
    }
    if (rawTokens.length === 2 && !hasTrailingSpace) {
      const p = rawTokens[1].toLowerCase();
      if ('get'.startsWith(p)) return 'get'.slice(p.length) + ' editor';
      if ('set'.startsWith(p)) return 'set'.slice(p.length) + ' editor inline';
    }
    if (rawTokens.length === 2 && hasTrailingSpace && rawTokens[1] === 'set') {
      return 'editor inline';
    }
    if (rawTokens.length === 3 && rawTokens[1] === 'set' && !hasTrailingSpace) {
      const p = rawTokens[2].toLowerCase();
      if ('editor'.startsWith(p)) return 'editor'.slice(p.length) + ' inline';
    }
    if (rawTokens.length === 3 && rawTokens[1] === 'set' && hasTrailingSpace && rawTokens[2] === 'editor') {
      return 'inline';
    }
    return '';
  }

  // If command is completion -> suggest install / bash / powershell
  if (cmd === 'completion') {
    const completions = ['install', 'bash', 'powershell'];
    const lastToken = hasTrailingSpace ? '' : rawTokens[rawTokens.length - 1];
    const prefix = lastToken.toLowerCase();
    const match = completions.find((c) => c.startsWith(prefix) && c !== prefix);
    if (match) {
      return match.slice(prefix.length);
    }
    return '';
  }

  // If command is sync -> suggest editors, all, none
  if (cmd === 'sync' || cmd === 'auto-export') {
    const syncOptions = ['antigravity', 'vscode', 'cursor', 'sublime', 'all', 'none'];
    if (rawTokens.length === 1 && hasTrailingSpace) {
      return 'antigravity';
    }
    const lastToken = hasTrailingSpace ? '' : rawTokens[rawTokens.length - 1];
    const prefix = lastToken.toLowerCase();
    const match = syncOptions.find((o) => o.startsWith(prefix) && o !== prefix);
    if (match) {
      return match.slice(prefix.length);
    }
    return '';
  }

  return '';
}

/**
 * Executes a single command line inside the REPL context.
 * Never exits the process on errors or invalid commands.
 */
export async function executeReplCommand(line, { onExit, onClear } = {}) {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  const rawArgs = parseArgs(trimmed);
  let args = rawArgs;
  // If user typed "snip <command>", strip the leading "snip"
  if (args[0]?.toLowerCase() === 'snip') {
    args = args.slice(1);
  }
  if (args.length === 0) {
    return;
  }

  const command = args[0]?.toLowerCase();
  const rest = args.slice(1);

  if (command === 'exit' || command === 'quit') {
    if (onExit) onExit();
    return;
  }

  if (command === 'clear' || command === 'cls') {
    if (onClear) {
      onClear();
    } else {
      console.clear();
    }
    return;
  }

  if (command === 'help') {
    printHelp();
    return;
  }

  const originalExit = process.exit;
  let exitOverridden = false;
  if (process.exit !== replExitHandler) {
    process.exit = replExitHandler;
    exitOverridden = true;
  }

  try {
    switch (command) {
      case 'ls':
        listCommand();
        break;
      case 'cat':
        if (!rest[0]) {
          console.error(chalk.red('\n  ✗ Error: Snippet name is required.\n'));
          console.log(chalk.dim('  Usage: cat <name>\n'));
          break;
        }
        catCommand(rest[0]);
        break;
      case 'edit': {
        const name = rest[0];
        if (!name) {
          console.error(chalk.red('\n  ✗ Error: Snippet name is required.\n'));
          console.log(chalk.dim('  Usage: edit <name> [-m "description"] [--lang "language"] [-b]\n'));
          break;
        }
        const msgIdx = rest.indexOf('-m') !== -1 ? rest.indexOf('-m') : rest.indexOf('--message');
        const langIdx = rest.indexOf('-l') !== -1 ? rest.indexOf('-l') : rest.indexOf('--lang');
        const bodyIdx = rest.indexOf('-b') !== -1 ? rest.indexOf('-b') : rest.indexOf('--body');
        const options = {
          message: msgIdx !== -1 ? rest[msgIdx + 1] : undefined,
          lang: langIdx !== -1 ? rest[langIdx + 1] : undefined,
          body: bodyIdx !== -1,
        };
        await editCommand(name, options);
        break;
      }
      case 'create':
      case 'new':
      case 'add': {
        const name = rest[0];
        if (!name) {
          console.error(chalk.red('\n  ✗ Error: Snippet name is required.\n'));
          console.log(chalk.dim('  Usage: create <name> [-m "description"] [--lang "language"]\n'));
          break;
        }
        const msgIdx = rest.indexOf('-m') !== -1 ? rest.indexOf('-m') : rest.indexOf('--message');
        const langIdx = rest.indexOf('-l') !== -1 ? rest.indexOf('-l') : rest.indexOf('--lang');
        const options = {
          message: msgIdx !== -1 ? rest[msgIdx + 1] : undefined,
          lang: langIdx !== -1 ? rest[langIdx + 1] : undefined,
        };
        await createCommand(name, options);
        break;
      }
      case 'rm':
        await removeCommand(rest);
        break;
      case 'sync':
      case 'auto-export':
        syncCommand(rest[0]);
        break;
      case 'export':
        if (!rest[0]) {
          console.error(chalk.red('\n  ✗ Error: Editor name is required.\n'));
          console.log(chalk.dim(`  Supported editors: ${SUPPORTED_EDITORS.join(', ')}`));
          console.log(chalk.dim('  Usage: export <editor>\n'));
          break;
        }
        exportCommand(rest[0]);
        break;
      case 'config':
        configCommand(rest[0], rest.slice(1));
        break;
      case 'completion':
        completionCommand(rest[0], rest[1]);
        break;
      default:
        console.log(chalk.red(`\n  ✗ Unknown command: "${args[0]}"`));
        console.log(chalk.dim('  Type "help" to view available commands.\n'));
        break;
    }
  } catch (err) {
    if (err?.isReplExit) {
      // Command invoked process.exit() after printing its error.
    } else {
      console.error(chalk.red(`  ✗ Error: ${err.message}`));
    }
  } finally {
    if (exitOverridden) {
      process.exit = originalExit;
    }
    process.exitCode = 0;
  }
}

/**
 * Starts the Snip interactive command REPL with real-time ghost text suggestions.
 */
export function startRepl() {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY) {
      resolve();
      return;
    }

    console.log(chalk.cyan('\n  ⚡ snip interactive shell'));
    console.log(chalk.dim('  Type commands with real-time ghost suggestions. (Tab or → to complete, Ctrl+C to exit)\n'));

    let input = '';
    let cursorCol = 0;
    let ghost = '';
    const history = [];
    let historyIndex = -1;
    let isTerminated = false;

    const originalExit = process.exit;
    process.exit = replExitHandler;

    stdin.setRawMode(true);
    stdin.resume();
    readline.emitKeypressEvents(stdin);
    stdin.on('keypress', onKeypress);

    const promptText = chalk.cyan.bold('snip') + chalk.dim(' › ');
    const promptLen = 7; // visible length of 'snip › '

    function exitShell() {
      if (isTerminated) return;
      isTerminated = true;
      process.exit = originalExit;
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('keypress', onKeypress);
      stdout.write('\n');
      console.log(chalk.dim('  Goodbye!\n'));
      resolve();
    }

    function pauseListeners() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('keypress', onKeypress);
    }

    function redraw() {
      // Calculate ghost text
      ghost = '';
      if (cursorCol === input.length) {
        ghost = getCommandGhostSuggestion(input);
      }

      // Render line: carriage return, clear line, draw prompt + input + ghost
      stdout.write('\r\x1b[K');
      stdout.write(promptText + input);
      if (ghost) {
        stdout.write(chalk.dim.gray(ghost));
      }

      // Reposition terminal cursor at cursorCol
      const targetCol = promptLen + cursorCol;
      stdout.write(`\r\x1b[${targetCol}C`);
    }

    async function executeCommand(line) {
      pauseListeners();
      stdout.write('\n');

      const trimmed = line.trim();
      if (!trimmed) {
        resumeRepl();
        return;
      }

      // Add to history
      if (history[history.length - 1] !== trimmed) {
        history.push(trimmed);
      }
      historyIndex = -1;

      await executeReplCommand(trimmed, {
        onExit: exitShell,
        onClear: () => console.clear(),
      });

      if (!isTerminated) {
        resumeRepl();
      }
    }

    function resumeRepl() {
      input = '';
      cursorCol = 0;
      ghost = '';
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('keypress', onKeypress);
      redraw();
    }

    function onKeypress(str, key) {
      if (!key) {
        if (str) {
          input = input.slice(0, cursorCol) + str + input.slice(cursorCol);
          cursorCol += str.length;
        }
        redraw();
        return;
      }

      // Exit shortcuts: Ctrl+C, Ctrl+D
      if ((key.ctrl && key.name === 'c') || (key.ctrl && key.name === 'd')) {
        exitShell();
        return;
      }

      // Enter — execute command
      if (key.name === 'return') {
        executeCommand(input);
        return;
      }

      // Tab or Right Arrow — accept ghost text if at end of input
      if (key.name === 'tab' || (key.name === 'right' && cursorCol === input.length)) {
        if (ghost && cursorCol === input.length) {
          input += ghost;
          cursorCol = input.length;
          redraw();
          return;
        }
      }

      // Tab or Right Arrow — accept ghost text if at end of input
      if (key.name === 'tab' || (key.name === 'right' && cursorCol === input.length)) {
        if (ghost && cursorCol === input.length) {
          input += ghost;
          cursorCol = input.length;
          redraw();
          return;
        }
      }

      switch (key.name) {
        case 'backspace': {
          if (cursorCol > 0) {
            input = input.slice(0, cursorCol - 1) + input.slice(cursorCol);
            cursorCol--;
          }
          break;
        }

        case 'delete': {
          if (cursorCol < input.length) {
            input = input.slice(0, cursorCol) + input.slice(cursorCol + 1);
          }
          break;
        }

        case 'left': {
          if (cursorCol > 0) {
            cursorCol--;
          }
          break;
        }

        case 'right': {
          if (cursorCol < input.length) {
            cursorCol++;
          }
          break;
        }

        case 'home': {
          cursorCol = 0;
          break;
        }

        case 'end': {
          cursorCol = input.length;
          break;
        }

        case 'up': {
          // History previous
          if (history.length > 0) {
            if (historyIndex === -1) {
              historyIndex = history.length - 1;
            } else if (historyIndex > 0) {
              historyIndex--;
            }
            input = history[historyIndex];
            cursorCol = input.length;
          }
          break;
        }

        case 'down': {
          // History next
          if (historyIndex !== -1) {
            if (historyIndex < history.length - 1) {
              historyIndex++;
              input = history[historyIndex];
            } else {
              historyIndex = -1;
              input = '';
            }
            cursorCol = input.length;
          }
          break;
        }

        default: {
          if (str && !key.ctrl && !key.meta && str.length === 1) {
            input = input.slice(0, cursorCol) + str + input.slice(cursorCol);
            cursorCol++;
          }
          break;
        }
      }

      redraw();
    }

    // Initial render
    redraw();
  });
}
