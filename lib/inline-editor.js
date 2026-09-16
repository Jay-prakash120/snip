import readline from 'readline';
import chalk from 'chalk';

/**
 * A fully in-terminal multi-line editor widget.
 * Supports: typing, pasting, arrow keys, backspace, delete, Home/End.
 * Save: Ctrl+S | Exit: Escape
 *
 * @param {Object} options
 * @param {string} [options.defaultValue=''] - Pre-filled text content.
 * @param {string} [options.header=''] - Header text shown above the editor.
 * @returns {Promise<string|null>} The edited text, or null if cancelled.
 */
export function inlineEditor({ defaultValue = '', header = '' } = {}) {
  return new Promise((resolve) => {
    const lines = defaultValue ? defaultValue.split('\n') : [''];
    let cursorRow = lines.length - 1;
    let cursorCol = lines[cursorRow].length;
    let scrollOffset = 0;

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

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('keypress', onKeypress);
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
      stdout.write(chalk.dim('  ┌─ Inline Editor ─────────────────── Ctrl+S: save │ Esc: cancel ─┐\n'));

      // Visible lines
      const visibleEnd = Math.min(scrollOffset + maxVisibleLines, lines.length);
      for (let i = scrollOffset; i < scrollOffset + maxVisibleLines; i++) {
        if (i < lines.length) {
          const lineNum = chalk.dim(String(i + 1).padStart(3) + ' │ ');
          const content = lines[i];

          if (i === cursorRow) {
            // Highlight current line
            const before = content.slice(0, cursorCol);
            const cursorChar = content[cursorCol] || ' ';
            const after = content.slice(cursorCol + 1);
            stdout.write(`  ${lineNum}${before}${chalk.bgWhite.black(cursorChar)}${after}\n`);
          } else {
            stdout.write(`  ${lineNum}${content}\n`);
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
      if (!key) {
        // Raw character input (e.g., pasted text)
        if (str) {
          insertText(str);
        }
        render();
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
          if (cursorCol < lines[cursorRow].length) {
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
          // Insert 2 spaces for indent
          insertText('  ');
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

      render();
    }

    function insertText(text) {
      // Handle pasted multi-line text
      const pasteLines = text.split('\n');
      if (pasteLines.length === 1) {
        const line = lines[cursorRow];
        lines[cursorRow] = line.slice(0, cursorCol) + text + line.slice(cursorCol);
        cursorCol += text.length;
      } else {
        // Multi-line paste
        const currentLine = lines[cursorRow];
        const before = currentLine.slice(0, cursorCol);
        const after = currentLine.slice(cursorCol);

        lines[cursorRow] = before + pasteLines[0];
        for (let i = 1; i < pasteLines.length; i++) {
          lines.splice(cursorRow + i, 0, pasteLines[i]);
        }
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
