import readline from 'readline';
import chalk from 'chalk';
import { highlightLine, detectLanguage, getGhostSuggestion } from './highlighter.js';

/**
 * A fully in-terminal multi-line editor widget with real-time syntax highlighting and ghost text.
 * Supports: typing, pasting, arrow keys, backspace, delete, Home/End.
 * Save: Ctrl+S | Exit: Escape | Auto-complete ghost text: Tab or Right Arrow
 *
 * @param {Object} options
 * @param {string} [options.defaultValue=''] - Pre-filled text content.
 * @param {string} [options.header=''] - Header text shown above the editor.
 * @param {string} [options.language=''] - Language for syntax highlighting (auto-detected if unset).
 * @returns {Promise<string|null>} The edited text, or null if cancelled.
 */
export function inlineEditor({ defaultValue = '', header = '', language = '' } = {}) {
  return new Promise((resolve) => {
    const lines = defaultValue ? defaultValue.split('\n') : [''];
    let cursorRow = lines.length - 1;
    let cursorCol = lines[cursorRow].length;
    let scrollOffset = 0;
    let activeGhost = '';

    // Detect language or use provided
    let activeLang = language || detectLanguage(defaultValue, header);

    const stdin = process.stdin;
    const stdout = process.stdout;

    // Compute visible height (leave room for header + footer)
    const maxVisibleLines = Math.max(stdout.rows - 6, 5);

    if (!stdin.isTTY) {
      // Fallback for non-TTY: just return default
      resolve(defaultValue);
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    readline.emitKeypressEvents(stdin);

    // Enable bracketed paste mode so terminals send pasted content wrapped in \x1b[200~ ... \x1b[201~
    stdout.write('\x1b[?2004h');

    let isPasting = false;
    let pasteBuffer = '';
    let renderTimeout = null;

    function cleanup() {
      if (renderTimeout) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
      }
      stdout.write('\x1b[?2004l\x1b[?25h'); // disable bracketed paste & restore cursor
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('keypress', onKeypress);
    }

    function scheduleRender() {
      if (isPasting) return;
      if (!renderTimeout) {
        renderTimeout = setTimeout(() => {
          renderTimeout = null;
          render();
        }, 8);
      }
    }

    function render() {
      // Adjust scroll so cursor is visible
      if (cursorRow < scrollOffset) scrollOffset = cursorRow;
      if (cursorRow >= scrollOffset + maxVisibleLines) scrollOffset = cursorRow - maxVisibleLines + 1;

      // Clear screen area: move to top of editor area and clear down
      stdout.write('\x1b[?25l'); // hide cursor

      // Move to the start position (we'll redraw from the top)
      const totalRenderLines = maxVisibleLines + 4; // header + border + footer
      stdout.write(`\x1b[${totalRenderLines}A`); // move up
      stdout.write('\x1b[0J'); // clear from cursor to end of screen

      // Header
      if (header) {
        stdout.write(chalk.cyan(`  ${header}\n`));
      }

      // Border with language badge
      const langBadge = activeLang ? chalk.magenta(` [${activeLang}]`) : '';
      stdout.write(chalk.dim('  ┌─ Inline Editor') + langBadge + chalk.dim(' ─────────────────── Ctrl+S: save │ Esc: cancel ─┐\n'));

      // Check for ghost text suggestion on current cursor position
      activeGhost = '';
      const currentContent = lines[cursorRow] || '';
      const textBeforeCursor = currentContent.slice(0, cursorCol);
      const wordMatch = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (wordMatch && cursorCol === currentContent.length) {
        const prefix = wordMatch[1];
        const bufferWords = lines.join(' ').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        activeGhost = getGhostSuggestion(prefix, activeLang, bufferWords);
      }

      // Visible lines with real-time syntax highlighting
      const visibleEnd = Math.min(scrollOffset + maxVisibleLines, lines.length);
      for (let i = scrollOffset; i < scrollOffset + maxVisibleLines; i++) {
        if (i < lines.length) {
          const lineNum = chalk.dim(String(i + 1).padStart(3) + ' │ ');
          const content = lines[i];

          if (i === cursorRow) {
            // Highlight current line with distinct cursor block and ghost text
            const before = content.slice(0, cursorCol);
            const cursorChar = content[cursorCol] || ' ';
            const after = content.slice(cursorCol + 1);
            const hlBefore = highlightLine(before, activeLang);
            const hlAfter = highlightLine(after, activeLang);

            if (activeGhost && cursorCol === content.length) {
              const cursorBlock = chalk.bgWhite.black(activeGhost[0]);
              const ghostRest = chalk.dim.gray(activeGhost.slice(1));
              stdout.write(`  ${lineNum}${hlBefore}${cursorBlock}${ghostRest}\n`);
            } else {
              stdout.write(`  ${lineNum}${hlBefore}${chalk.bgWhite.black(cursorChar)}${hlAfter}\n`);
            }
          } else {
            // Syntax-highlighted inactive line
            stdout.write(`  ${lineNum}${highlightLine(content, activeLang)}\n`);
          }
        } else {
          stdout.write(chalk.dim(`  ${'~'.padStart(3)} │\n`));
        }
      }

      // Footer
      const scrollInfo = lines.length > maxVisibleLines
        ? chalk.dim(` [${scrollOffset + 1}-${visibleEnd}/${lines.length}]`)
        : '';
      stdout.write(chalk.dim(`  └─ Ln ${cursorRow + 1}, Col ${cursorCol + 1}${scrollInfo} ${'─'.repeat(Math.max(1, 50 - scrollInfo.length))}┘\n`));

      stdout.write('\x1b[?25h'); // show cursor
    }

    function onKeypress(str, key) {
      // Bracketed paste start
      if (key && (key.name === 'paste-start' || key.sequence === '\x1b[200~')) {
        isPasting = true;
        pasteBuffer = '';
        return;
      }

      // Bracketed paste end
      if (key && (key.name === 'paste-end' || key.sequence === '\x1b[201~')) {
        isPasting = false;
        if (pasteBuffer) {
          insertText(pasteBuffer);
          pasteBuffer = '';
        }
        render();
        return;
      }

      // Buffer incoming text during bracketed paste
      if (isPasting) {
        if (str) {
          pasteBuffer += str;
        } else if (key && (key.name === 'return' || key.name === 'enter')) {
          pasteBuffer += '\n';
        }
        return;
      }

      if (!key) {
        // Raw character input (e.g., fallback paste)
        if (str) {
          insertText(str);
        }
        scheduleRender();
        return;
      }

      // Ctrl+S — save
      if (key.ctrl && key.name === 's') {
        cleanup();
        stdout.write('\n');
        resolve(lines.join('\n'));
        return;
      }

      // Escape — cancel
      if (key.name === 'escape') {
        cleanup();
        stdout.write('\n');
        resolve(null);
        return;
      }

      // Ctrl+C — also cancel
      if (key.ctrl && key.name === 'c') {
        cleanup();
        stdout.write('\n');
        resolve(null);
        return;
      }

      switch (key.name) {
        case 'return': {
          // Split current line at cursor
          const currentLine = lines[cursorRow];
          const before = currentLine.slice(0, cursorCol);
          const after = currentLine.slice(cursorCol);
          lines[cursorRow] = before;
          lines.splice(cursorRow + 1, 0, after);
          cursorRow++;
          cursorCol = 0;
          break;
        }

        case 'backspace': {
          if (cursorCol > 0) {
            const line = lines[cursorRow];
            lines[cursorRow] = line.slice(0, cursorCol - 1) + line.slice(cursorCol);
            cursorCol--;
          } else if (cursorRow > 0) {
            // Merge with previous line
            cursorCol = lines[cursorRow - 1].length;
            lines[cursorRow - 1] += lines[cursorRow];
            lines.splice(cursorRow, 1);
            cursorRow--;
          }
          break;
        }

        case 'delete': {
          const line = lines[cursorRow];
          if (cursorCol < line.length) {
            lines[cursorRow] = line.slice(0, cursorCol) + line.slice(cursorCol + 1);
          } else if (cursorRow < lines.length - 1) {
            // Merge with next line
            lines[cursorRow] += lines[cursorRow + 1];
            lines.splice(cursorRow + 1, 1);
          }
          break;
        }

        case 'up': {
          if (cursorRow > 0) {
            cursorRow--;
            cursorCol = Math.min(cursorCol, lines[cursorRow].length);
          }
          break;
        }

        case 'down': {
          if (cursorRow < lines.length - 1) {
            cursorRow++;
            cursorCol = Math.min(cursorCol, lines[cursorRow].length);
          }
          break;
        }

        case 'left': {
          if (cursorCol > 0) {
            cursorCol--;
          } else if (cursorRow > 0) {
            cursorRow--;
            cursorCol = lines[cursorRow].length;
          }
          break;
        }

        case 'right': {
          if (activeGhost && cursorCol === lines[cursorRow].length) {
            insertText(activeGhost);
          } else if (cursorCol < lines[cursorRow].length) {
            cursorCol++;
          } else if (cursorRow < lines.length - 1) {
            cursorRow++;
            cursorCol = 0;
          }
          break;
        }

        case 'home': {
          cursorCol = 0;
          break;
        }

        case 'end': {
          cursorCol = lines[cursorRow].length;
          break;
        }

        case 'tab': {
          if (activeGhost && cursorCol === lines[cursorRow].length) {
            insertText(activeGhost);
          } else {
            // Insert 2 spaces for indent
            insertText('  ');
          }
          break;
        }

        default: {
          // Regular character
          if (str && !key.ctrl && !key.meta && str.length === 1) {
            insertText(str);
          }
          break;
        }
      }

      scheduleRender();
    }

    function insertText(text) {
      // Normalize line endings
      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const pasteLines = normalized.split('\n');
      if (pasteLines.length === 1) {
        const line = lines[cursorRow];
        lines[cursorRow] = line.slice(0, cursorCol) + normalized + line.slice(cursorCol);
        cursorCol += normalized.length;
      } else {
        // Multi-line paste: single O(N) splice instead of repeated array shifts
        const currentLine = lines[cursorRow];
        const before = currentLine.slice(0, cursorCol);
        const after = currentLine.slice(cursorCol);

        lines[cursorRow] = before + pasteLines[0];
        lines.splice(cursorRow + 1, 0, ...pasteLines.slice(1));
        cursorRow += pasteLines.length - 1;
        lines[cursorRow] += after;
        cursorCol = pasteLines[pasteLines.length - 1].length;
      }
    }

    // Initial render: print blank lines first to create the rendering area
    const totalRenderLines = maxVisibleLines + 4;
    stdout.write('\n'.repeat(totalRenderLines));
    render();

    stdin.on('keypress', onKeypress);
  });
}
