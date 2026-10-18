import readline from 'readline';
import chalk from 'chalk';
import { highlightLine, detectLanguage, getGhostSuggestion } from './highlighter.js';

/**
 * Finds the index of the start of the word to the left of the given column.
 * Handles whitespace runs, word characters, and punctuation/symbols.
 *
 * @param {string} line
 * @param {number} col
 * @returns {number}
 */
export function findWordStartLeft(line, col) {
  let i = col;
  if (i <= 0) return 0;
  if (i > line.length) i = line.length;

  // Step 1: Skip any whitespace immediately to the left
  while (i > 0 && /\s/.test(line[i - 1])) {
    i--;
  }
  if (i === 0) return 0;

  // Step 2: Skip word characters or punctuation/symbol characters
  if (/\w/.test(line[i - 1])) {
    while (i > 0 && /\w/.test(line[i - 1])) {
      i--;
    }
  } else {
    while (i > 0 && !/\w/.test(line[i - 1]) && !/\s/.test(line[i - 1])) {
      i--;
    }
  }

  return i;
}

/**
 * Finds the index of the end of the word to the right of the given column.
 * Handles whitespace runs, word characters, and punctuation/symbols.
 *
 * @param {string} line
 * @param {number} col
 * @returns {number}
 */
export function findWordEndRight(line, col) {
  let i = col;
  const len = line.length;
  if (i >= len) return len;
  if (i < 0) i = 0;

  // Step 1: Skip any whitespace immediately to the right
  while (i < len && /\s/.test(line[i])) {
    i++;
  }
  if (i >= len) return len;

  // Step 2: Skip word characters or punctuation/symbol characters
  if (/\w/.test(line[i])) {
    while (i < len && /\w/.test(line[i])) {
      i++;
    }
  } else {
    while (i < len && !/\w/.test(line[i]) && !/\s/.test(line[i])) {
      i++;
    }
  }

  return i;
}

/**
 * A fully in-terminal multi-line editor widget with real-time syntax highlighting and ghost text.
 * Supports: typing, pasting, arrow keys, backspace, delete, Home/End.
 * Shortcuts:
 *   - Ctrl+S: Save & finish
 *   - Esc / Ctrl+C: Cancel
 *   - Ctrl+Z: Undo | Ctrl+Y (or Ctrl+Shift+Z): Redo
 *   - Ctrl+Left / Ctrl+Right: Word jump navigation
 *   - Ctrl+Home / Ctrl+End: Document start / end jump
 *   - Home / End: Line start / end jump
 *   - Tab / Right Arrow: Auto-complete ghost text
 *
 * @param {Object} options
 * @param {string} [options.defaultValue=''] - Pre-filled text content.
 * @param {string} [options.header=''] - Header text shown above the editor.
 * @param {string} [options.language=''] - Language for syntax highlighting (auto-detected if unset).
 * @param {import('stream').Readable} [options.stdin] - Custom stdin stream (for testing).
 * @param {import('stream').Writable} [options.stdout] - Custom stdout stream (for testing).
 * @returns {Promise<string|null>} The edited text, or null if cancelled.
 */
export function inlineEditor({ defaultValue = '', header = '', language = '', stdin: customStdin, stdout: customStdout } = {}) {
  return new Promise((resolve) => {
    const lines = defaultValue ? defaultValue.split('\n') : [''];
    let cursorRow = lines.length - 1;
    let cursorCol = lines[cursorRow].length;
    let scrollOffset = 0;
    let activeGhost = '';

    // Detect language or use provided
    let activeLang = language || detectLanguage(defaultValue, header);

    const stdin = customStdin || process.stdin;
    const stdout = customStdout || process.stdout;

    // Compute visible height (leave room for header + footer)
    const maxVisibleLines = Math.max((stdout.rows || 24) - 6, 5);

    if (!stdin.isTTY) {
      // Fallback for non-TTY: just return default
      resolve(defaultValue);
      return;
    }

    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    if (typeof stdin.resume === 'function') {
      stdin.resume();
    }
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
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
      if (typeof stdin.pause === 'function') {
        stdin.pause();
      }
      stdin.removeListener('keypress', onKeypress);
    }

    // Undo / Redo history state
    const undoStack = [];
    const redoStack = [];
    const MAX_UNDO = 300;
    let lastActionType = null;
    let lastActionTime = 0;
    let lastCharType = null;

    function pushUndoSnapshot(actionType, force = false) {
      const now = Date.now();
      const shouldGroup =
        !force &&
        lastActionType === actionType &&
        now - lastActionTime < 800 &&
        (actionType === 'typing' || actionType === 'backspace' || actionType === 'delete');

      if (!shouldGroup) {
        if (undoStack.length >= MAX_UNDO) {
          undoStack.shift();
        }
        undoStack.push({
          lines: [...lines],
          cursorRow,
          cursorCol,
        });
        redoStack.length = 0;
      }

      lastActionType = actionType;
      lastActionTime = now;
    }

    function undo() {
      if (undoStack.length === 0) return;

      redoStack.push({
        lines: [...lines],
        cursorRow,
        cursorCol,
      });

      const snapshot = undoStack.pop();
      lines.length = 0;
      lines.push(...snapshot.lines);
      cursorRow = Math.min(Math.max(0, snapshot.cursorRow), lines.length - 1);
      cursorCol = Math.min(Math.max(0, snapshot.cursorCol), lines[cursorRow].length);

      lastActionType = null;
      lastCharType = null;
    }

    function redo() {
      if (redoStack.length === 0) return;

      undoStack.push({
        lines: [...lines],
        cursorRow,
        cursorCol,
      });

      const snapshot = redoStack.pop();
      lines.length = 0;
      lines.push(...snapshot.lines);
      cursorRow = Math.min(Math.max(0, snapshot.cursorRow), lines.length - 1);
      cursorCol = Math.min(Math.max(0, snapshot.cursorCol), lines[cursorRow].length);

      lastActionType = null;
      lastCharType = null;
    }

    function moveWordBackward() {
      if (cursorCol > 0) {
        cursorCol = findWordStartLeft(lines[cursorRow], cursorCol);
      } else if (cursorRow > 0) {
        cursorRow--;
        cursorCol = lines[cursorRow].length;
      }
    }

    function moveWordForward() {
      if (cursorCol < lines[cursorRow].length) {
        cursorCol = findWordEndRight(lines[cursorRow], cursorCol);
      } else if (cursorRow < lines.length - 1) {
        cursorRow++;
        cursorCol = 0;
      }
    }

    function deleteWordBackward() {
      if (cursorCol === 0 && cursorRow === 0) return;
      pushUndoSnapshot('delete_word', true);
      if (cursorCol > 0) {
        const targetCol = findWordStartLeft(lines[cursorRow], cursorCol);
        lines[cursorRow] = lines[cursorRow].slice(0, targetCol) + lines[cursorRow].slice(cursorCol);
        cursorCol = targetCol;
      } else if (cursorRow > 0) {
        cursorCol = lines[cursorRow - 1].length;
        lines[cursorRow - 1] += lines[cursorRow];
        lines.splice(cursorRow, 1);
        cursorRow--;
      }
      lastActionType = null;
      lastCharType = null;
    }

    function deleteWordForward() {
      if (cursorCol === lines[cursorRow].length && cursorRow === lines.length - 1) return;
      pushUndoSnapshot('delete_word', true);
      if (cursorCol < lines[cursorRow].length) {
        const targetCol = findWordEndRight(lines[cursorRow], cursorCol);
        lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + lines[cursorRow].slice(targetCol);
      } else if (cursorRow < lines.length - 1) {
        lines[cursorRow] += lines[cursorRow + 1];
        lines.splice(cursorRow + 1, 1);
      }
      lastActionType = null;
      lastCharType = null;
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

      // Border with language badge and keyboard hints
      const langBadge = activeLang ? chalk.magenta(` [${activeLang}]`) : '';
      const helpText = ' Ctrl+S: save │ Ctrl+Z: undo │ Esc: cancel ';
      const badgeLen = activeLang ? activeLang.length + 3 : 0;
      const dashes = Math.max(2, 54 - badgeLen - helpText.length);
      stdout.write(chalk.dim('  ┌─ Inline Editor') + langBadge + chalk.dim(` ${'─'.repeat(dashes)}${helpText}─┐\n`));

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
          pushUndoSnapshot('paste', true);
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
          pushUndoSnapshot('paste', true);
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

      // Ctrl+Z — Undo
      if ((key.ctrl && key.name === 'z' && !key.shift) || key.sequence === '\x1a') {
        undo();
        scheduleRender();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z — Redo
      if ((key.ctrl && key.name === 'y') || (key.ctrl && key.shift && key.name === 'z') || key.sequence === '\x19') {
        redo();
        scheduleRender();
        return;
      }

      // Ctrl+W or Ctrl+Backspace — delete word backward
      if ((key.ctrl && key.name === 'w') || ((key.ctrl || key.meta) && key.name === 'backspace')) {
        deleteWordBackward();
        scheduleRender();
        return;
      }

      // Ctrl+Delete — delete word forward
      if ((key.ctrl || key.meta) && key.name === 'delete') {
        deleteWordForward();
        scheduleRender();
        return;
      }

      // Alt+B / Alt+F — word jump backward / forward (Emacs / terminal style)
      if (key.meta && key.name === 'b') {
        lastActionType = null;
        lastCharType = null;
        moveWordBackward();
        scheduleRender();
        return;
      }
      if (key.meta && key.name === 'f') {
        lastActionType = null;
        lastCharType = null;
        moveWordForward();
        scheduleRender();
        return;
      }

      switch (key.name) {
        case 'return':
        case 'enter': {
          lastActionType = null;
          lastCharType = null;
          pushUndoSnapshot('return', true);
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
          if (cursorCol > 0 || cursorRow > 0) {
            pushUndoSnapshot('backspace');
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
          }
          break;
        }

        case 'delete': {
          const line = lines[cursorRow];
          if (cursorCol < line.length || cursorRow < lines.length - 1) {
            pushUndoSnapshot('delete');
            if (cursorCol < line.length) {
              lines[cursorRow] = line.slice(0, cursorCol) + line.slice(cursorCol + 1);
            } else if (cursorRow < lines.length - 1) {
              // Merge with next line
              lines[cursorRow] += lines[cursorRow + 1];
              lines.splice(cursorRow + 1, 1);
            }
          }
          break;
        }

        case 'up': {
          lastActionType = null;
          lastCharType = null;
          if (cursorRow > 0) {
            cursorRow--;
            cursorCol = Math.min(cursorCol, lines[cursorRow].length);
          }
          break;
        }

        case 'down': {
          lastActionType = null;
          lastCharType = null;
          if (cursorRow < lines.length - 1) {
            cursorRow++;
            cursorCol = Math.min(cursorCol, lines[cursorRow].length);
          }
          break;
        }

        case 'pageup': {
          lastActionType = null;
          lastCharType = null;
          cursorRow = Math.max(0, cursorRow - maxVisibleLines);
          cursorCol = Math.min(cursorCol, lines[cursorRow].length);
          break;
        }

        case 'pagedown': {
          lastActionType = null;
          lastCharType = null;
          cursorRow = Math.min(lines.length - 1, cursorRow + maxVisibleLines);
          cursorCol = Math.min(cursorCol, lines[cursorRow].length);
          break;
        }

        case 'left': {
          lastActionType = null;
          lastCharType = null;
          if (key.ctrl || key.meta) {
            moveWordBackward();
          } else {
            if (cursorCol > 0) {
              cursorCol--;
            } else if (cursorRow > 0) {
              cursorRow--;
              cursorCol = lines[cursorRow].length;
            }
          }
          break;
        }

        case 'right': {
          lastActionType = null;
          lastCharType = null;
          if (key.ctrl || key.meta) {
            moveWordForward();
          } else if (activeGhost && cursorCol === lines[cursorRow].length) {
            pushUndoSnapshot('ghost', true);
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
          lastActionType = null;
          lastCharType = null;
          if (key.ctrl || key.meta) {
            cursorRow = 0;
            cursorCol = 0;
          } else {
            cursorCol = 0;
          }
          break;
        }

        case 'end': {
          lastActionType = null;
          lastCharType = null;
          if (key.ctrl || key.meta) {
            cursorRow = lines.length - 1;
            cursorCol = lines[cursorRow].length;
          } else {
            cursorCol = lines[cursorRow].length;
          }
          break;
        }

        case 'tab': {
          if (activeGhost && cursorCol === lines[cursorRow].length) {
            pushUndoSnapshot('ghost', true);
            insertText(activeGhost);
          } else {
            // Insert 2 spaces for indent
            pushUndoSnapshot('tab', true);
            insertText('  ');
          }
          break;
        }

        default: {
          // Regular character
          if (str && !key.ctrl && !key.meta && str.length === 1) {
            const charType = /\s/.test(str) ? 'space' : 'char';
            const force = lastCharType !== null && lastCharType !== charType;
            lastCharType = charType;
            pushUndoSnapshot('typing', force);
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
