import test from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { inlineEditor, findWordStartLeft, findWordEndRight } from '../lib/inline-editor.js';

test('findWordStartLeft - jumps across words, punctuation, and spaces correctly', () => {
  const line = 'const myVar = calculate(x, 10);';
  assert.strictEqual(line.length, 31);

  // End of line (col 31)
  let col = line.length;
  col = findWordStartLeft(line, col); // skips ');' -> 29
  assert.strictEqual(col, 29);
  assert.strictEqual(line.slice(col, 31), ');');

  col = findWordStartLeft(line, col); // skips '10' -> 27
  assert.strictEqual(col, 27);
  assert.strictEqual(line.slice(col, 29), '10');

  col = findWordStartLeft(line, col); // skips ', ' -> 25
  assert.strictEqual(col, 25);
  assert.strictEqual(line.slice(col, 27), ', ');

  col = findWordStartLeft(line, col); // skips 'x' -> 24
  assert.strictEqual(col, 24);
  assert.strictEqual(line.slice(col, 25), 'x');

  col = findWordStartLeft(line, col); // skips '(' -> 23
  assert.strictEqual(col, 23);
  assert.strictEqual(line.slice(col, 24), '(');

  col = findWordStartLeft(line, col); // skips 'calculate' -> 14
  assert.strictEqual(col, 14);
  assert.strictEqual(line.slice(col, 23), 'calculate');

  col = findWordStartLeft(line, col); // skips '= ' -> 12
  assert.strictEqual(col, 12);
  assert.strictEqual(line.slice(col, 14), '= ');

  col = findWordStartLeft(line, col); // skips 'myVar ' -> 6
  assert.strictEqual(col, 6);
  assert.strictEqual(line.slice(col, 12), 'myVar ');

  col = findWordStartLeft(line, col); // skips 'const ' -> 0
  assert.strictEqual(col, 0);
  assert.strictEqual(line.slice(0, 6), 'const ');

  // Already at 0 stays at 0
  col = findWordStartLeft(line, 0);
  assert.strictEqual(col, 0);
});

test('findWordEndRight - jumps across words, punctuation, and spaces correctly', () => {
  const line = 'const myVar = calculate(x, 10);';

  let col = 0;
  col = findWordEndRight(line, col); // skips 'const' -> 5
  assert.strictEqual(col, 5);
  assert.strictEqual(line.slice(0, col), 'const');

  col = findWordEndRight(line, col); // skips ' myVar' -> 11
  assert.strictEqual(col, 11);
  assert.strictEqual(line.slice(5, col), ' myVar');

  col = findWordEndRight(line, col); // skips ' =' -> 13
  assert.strictEqual(col, 13);
  assert.strictEqual(line.slice(11, col), ' =');

  col = findWordEndRight(line, col); // skips ' calculate' -> 23
  assert.strictEqual(col, 23);
  assert.strictEqual(line.slice(13, col), ' calculate');

  col = findWordEndRight(line, col); // skips '(' -> 24
  assert.strictEqual(col, 24);
  assert.strictEqual(line.slice(23, col), '(');

  col = findWordEndRight(line, col); // skips 'x' -> 25
  assert.strictEqual(col, 25);
  assert.strictEqual(line.slice(24, col), 'x');

  col = findWordEndRight(line, col); // skips ',' -> 26
  assert.strictEqual(col, 26);
  assert.strictEqual(line.slice(25, col), ',');

  col = findWordEndRight(line, col); // skips ' 10' -> 29
  assert.strictEqual(col, 29);
  assert.strictEqual(line.slice(26, col), ' 10');

  col = findWordEndRight(line, col); // skips ');' -> 31
  assert.strictEqual(col, 31);
  assert.strictEqual(line.slice(29, col), ');');

  // Already at end stays at end
  col = findWordEndRight(line, line.length);
  assert.strictEqual(col, line.length);
});

function createMockTerminal() {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.resume = () => {};
  stdin.pause = () => {};

  const stdout = new PassThrough();
  stdout.rows = 24;
  stdout.columns = 80;

  function sendChar(char) {
    stdin.emit('keypress', char, { sequence: char, name: char, ctrl: false, meta: false, shift: false });
  }

  function sendKey(name, options = {}) {
    stdin.emit('keypress', options.str || '', {
      name,
      sequence: options.sequence || '',
      ctrl: !!options.ctrl,
      meta: !!options.meta,
      shift: !!options.shift,
    });
  }

  return { stdin, stdout, sendChar, sendKey };
}

test('inlineEditor - undo and redo (Ctrl+Z and Ctrl+Y / Ctrl+Shift+Z)', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'hello',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Type " world"
  for (const ch of ' world') {
    term.sendChar(ch);
  }

  // Ctrl+Z to undo "world"
  term.sendKey('z', { ctrl: true, sequence: '\x1a' });

  // Ctrl+Z to undo space
  term.sendKey('z', { ctrl: true, sequence: '\x1a' });

  // Ctrl+Y to redo space
  term.sendKey('y', { ctrl: true, sequence: '\x19' });

  // Ctrl+Shift+Z to redo "world"
  term.sendKey('z', { ctrl: true, shift: true });

  // Save with Ctrl+S
  term.sendKey('s', { ctrl: true });

  const result = await editorPromise;
  assert.strictEqual(result, 'hello world');
});

test('inlineEditor - word navigation with Ctrl+Left and Ctrl+Right', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'one two three',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Cursor starts at end of "one two three" (col 13)
  // Jump back one word -> before "three" (col 8)
  term.sendKey('left', { ctrl: true });

  // Insert "2.5 "
  for (const ch of '2.5 ') {
    term.sendChar(ch);
  }

  // Save with Ctrl+S
  term.sendKey('s', { ctrl: true });

  const result = await editorPromise;
  assert.strictEqual(result, 'one two 2.5 three');
});

test('inlineEditor - Ctrl+Home and Ctrl+End document jumping', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'Line 1\nLine 2\nLine 3',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Cursor starts at Line 3 col 6.
  // Jump to first position at first line with Ctrl+Home
  term.sendKey('home', { ctrl: true });

  // Type "Header: " at the very beginning
  for (const ch of 'Header: ') {
    term.sendChar(ch);
  }

  // Jump to end position at last line with Ctrl+End
  term.sendKey('end', { ctrl: true });

  // Type " :Footer" at the very end
  for (const ch of ' :Footer') {
    term.sendChar(ch);
  }

  // Save with Ctrl+S
  term.sendKey('s', { ctrl: true });

  const result = await editorPromise;
  assert.strictEqual(result, 'Header: Line 1\nLine 2\nLine 3 :Footer');
});

test('inlineEditor - Home and End current line navigation', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'Line 1\nLine 2\nLine 3',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Cursor starts at Line 3 col 6.
  // Move up to Line 2
  term.sendKey('up');

  // Home moves to start of current line (Line 2 col 0)
  term.sendKey('home');
  term.sendChar('*');

  // End moves to end of current line (Line 2)
  term.sendKey('end');
  term.sendChar('*');

  // Save with Ctrl+S
  term.sendKey('s', { ctrl: true });

  const result = await editorPromise;
  assert.strictEqual(result, 'Line 1\n*Line 2*\nLine 3');
});

test('inlineEditor - Escape cancels and returns null', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'initial',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  term.sendKey('escape');
  const result = await editorPromise;
  assert.strictEqual(result, null);
});

test('inlineEditor - multi-line Ctrl+Left and Ctrl+Right word jumping across lines', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'first line\nsecond line',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Starts at Line 2 col 11
  term.sendKey('left', { ctrl: true }); // before "line" (col 7)
  term.sendKey('left', { ctrl: true }); // before "second" (col 0)
  term.sendKey('left', { ctrl: true }); // end of line 1 (row 0, col 10)
  term.sendKey('left', { ctrl: true }); // before "line" on line 1 (col 6)

  term.sendChar('+');

  term.sendKey('s', { ctrl: true });
  const result = await editorPromise;
  assert.strictEqual(result, 'first +line\nsecond line');
});

test('inlineEditor - word deletion with Ctrl+W and Ctrl+Delete', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'apple banana cherry',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Starts at end of "apple banana cherry"
  // Ctrl+W deletes "cherry"
  term.sendKey('w', { ctrl: true });

  // Ctrl+Left jumps before "banana"
  term.sendKey('left', { ctrl: true });

  // Ctrl+Delete deletes "banana"
  term.sendKey('delete', { ctrl: true });

  // Save with Ctrl+S
  term.sendKey('s', { ctrl: true });

  const result = await editorPromise;
  assert.strictEqual(result, 'apple  ');
});

test('inlineEditor - undo and redo of line split (Enter) and deletion', async () => {
  const term = createMockTerminal();

  const editorPromise = inlineEditor({
    defaultValue: 'abc def',
    stdin: term.stdin,
    stdout: term.stdout,
  });

  // Move cursor before "def"
  term.sendKey('left', { ctrl: true });

  // Split line with return
  term.sendKey('return');

  // Undo line split
  term.sendKey('z', { ctrl: true });

  // Redo line split
  term.sendKey('y', { ctrl: true });

  term.sendKey('s', { ctrl: true });
  const result = await editorPromise;
  assert.strictEqual(result, 'abc \ndef');
});

