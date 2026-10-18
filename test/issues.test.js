import test from 'node:test';
import assert from 'node:assert';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import {
  highlightLine,
  highlightMarkdownLine,
  formatComment,
  getGhostSuggestion,
  detectLanguage,
} from '../lib/highlighter.js';
import { CONFIG_SCHEMA, setConfig } from '../lib/config.js';
import { listCommand } from '../commands/list.js';
import { editCommand } from '../commands/edit.js';
import {
  normalizeLabels,
  getAllSnippetWords,
  upsertSnippet,
  getSnippet,
  deleteSnippet,
  loadSnippets,
  saveSnippets,
} from '../lib/store.js';
import { inlineEditor } from '../lib/inline-editor.js';

// Enable chalk color support during test runner execution
chalk.level = 1;

// ─── Issue #2 Tests: Comment Visibility & Configurable Comment Color ───────

test('Issue #2: formatComment defaults to lighter chalk.gray instead of dim.gray', () => {
  const commentText = '# This is a visible comment';
  const formatted = formatComment(commentText);
  // Default comment should be chalk.gray(commentText)
  assert.strictEqual(formatted, chalk.gray(commentText));
  // Ensure it is NOT chalk.dim.gray
  assert.notStrictEqual(formatted, chalk.dim.gray(commentText));
});

test('Issue #2: CONFIG_SCHEMA includes comment_color with default gray and valid color options', () => {
  assert.ok(CONFIG_SCHEMA.comment_color);
  assert.strictEqual(CONFIG_SCHEMA.comment_color.default, 'gray');
  assert.ok(CONFIG_SCHEMA.comment_color.values.includes('gray'));
  assert.ok(CONFIG_SCHEMA.comment_color.values.includes('cyan'));
  assert.ok(CONFIG_SCHEMA.comment_color.values.includes('yellow'));
});

test('Issue #2: highlightLine applies formatComment on comments in python, js, bash', () => {
  const pyComment = '  # calculate tax';
  const highlightedPy = highlightLine(pyComment, 'python');
  assert.strictEqual(highlightedPy, '  ' + formatComment('# calculate tax'));

  const jsComment = 'const a = 1; // assign';
  const highlightedJs = highlightLine(jsComment, 'javascript');
  assert.ok(highlightedJs.includes(formatComment('// assign')));
});

// ─── Issue #3 Tests: Expanded Autocompletion Across All Snippets ──────────

test('Issue #3: getGhostSuggestion prioritizes buffer words then global words from other files', () => {
  const bufferWords = ['localBufferFunction'];
  const globalWords = ['globalCrossFileSnippetHelper', 'authenticateUserAccount'];

  // Buffer word should be suggested when prefix matches
  const localMatch = getGhostSuggestion('loc', 'javascript', bufferWords, globalWords);
  assert.strictEqual(localMatch, 'alBufferFunction');

  // When prefix matches global word from another snippet/file, it suggests it!
  const globalMatch = getGhostSuggestion('auth', 'javascript', bufferWords, globalWords);
  assert.strictEqual(globalMatch, 'enticateUserAccount');

  // When buffer has a match and global also has a match, buffer takes priority
  const sharedBuffer = ['calculateInterest'];
  const sharedGlobal = ['calculateTotalTax'];
  const priorityMatch = getGhostSuggestion('calc', 'javascript', sharedBuffer, sharedGlobal);
  assert.strictEqual(priorityMatch, 'ulateInterest');
});

test('Issue #3: inlineEditor accepts globalWords and auto-completes cross-snippet words', async () => {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.resume = () => {};
  stdin.pause = () => {};

  const stdout = new PassThrough();
  stdout.rows = 24;
  stdout.columns = 80;

  const editorPromise = inlineEditor({
    defaultValue: '',
    language: 'javascript',
    globalWords: ['renderUserProfileDashboard'],
    stdin,
    stdout,
  });

  // Type 'ren'
  for (const ch of 'ren') {
    stdin.emit('keypress', ch, { name: ch, ctrl: false, meta: false, shift: false });
  }

  // Press Tab to complete ghost suggestion 'derUserProfileDashboard'
  stdin.emit('keypress', '\t', { name: 'tab', ctrl: false, meta: false, shift: false });

  // Save with Ctrl+S
  stdin.emit('keypress', 's', { name: 's', ctrl: true, meta: false, shift: false });

  const result = await editorPromise;
  assert.strictEqual(result, 'renderUserProfileDashboard');
});

// ─── Issue #5 Tests: Markdown Handling in Text Editor ──────────────────────

test('Issue #5: highlightLine for markdown treats ### as heading, NOT as python comment', () => {
  // Heading declaration with ###
  const headingOnly = highlightLine('###', 'markdown');
  assert.strictEqual(headingOnly, chalk.cyan.bold('###'));
  assert.notStrictEqual(headingOnly, formatComment('###'));

  // Heading with text
  const headingWithText = highlightLine('### Section Title', 'markdown');
  assert.strictEqual(headingWithText, chalk.cyan.bold('###') + chalk.bold.white(' Section Title'));
  assert.notStrictEqual(headingWithText, formatComment('### Section Title'));
});

test('Issue #5: highlightMarkdownLine handles headers, blockquotes, lists, code, and comments', () => {
  // H1
  assert.strictEqual(highlightMarkdownLine('# H1'), chalk.cyan.bold('#') + chalk.bold.white(' H1'));
  // H2
  assert.strictEqual(highlightMarkdownLine('## H2'), chalk.cyan.bold('##') + chalk.bold.white(' H2'));

  // Fenced code block
  assert.strictEqual(highlightMarkdownLine('```python'), chalk.magenta('```python'));

  // Horizontal rule
  assert.strictEqual(highlightMarkdownLine('---'), chalk.dim('---'));

  // Blockquote
  const bq = highlightMarkdownLine('> quoted text');
  assert.strictEqual(bq, chalk.dim('> ') + chalk.italic('quoted text'));

  // HTML comment
  const htmlComment = highlightMarkdownLine('<!-- comment -->');
  assert.strictEqual(htmlComment, formatComment('<!-- comment -->'));

  // Unordered list bullet
  const listItem = highlightMarkdownLine('- item');
  assert.strictEqual(listItem, chalk.yellow('- ') + 'item');

  // Task list
  const taskItem = highlightMarkdownLine('- [ ] unfinished task');
  assert.strictEqual(taskItem, chalk.greenBright('- [ ] ') + 'unfinished task');
});

test('Issue #5: detectLanguage detects markdown from headers and fenced blocks', () => {
  assert.strictEqual(detectLanguage('### My Heading\nSome content', 'notes'), 'markdown');
  assert.strictEqual(detectLanguage('```js\nconst x = 1;\n```', 'snippet'), 'markdown');
  assert.strictEqual(detectLanguage('const x = 1;', 'README.md'), 'markdown');
});

// ─── Issue #6 Tests: Labels like gh CLI ────────────────────────────────────

test('Issue #6: normalizeLabels parses strings and arrays correctly', () => {
  assert.deepStrictEqual(normalizeLabels('Todo'), ['Todo']);
  assert.deepStrictEqual(normalizeLabels('Todo, Bug, Urgent'), ['Todo', 'Bug', 'Urgent']);
  assert.deepStrictEqual(normalizeLabels(['Todo', ' Bug ']), ['Todo', 'Bug']);
  assert.deepStrictEqual(normalizeLabels(null), []);
  assert.deepStrictEqual(normalizeLabels(''), []);
});

test('Issue #6: upsertSnippet persists and retrieves labels', () => {
  const originalStore = loadSnippets();
  try {
    const testSnippetName = '__test_label_snippet__';
    const created = upsertSnippet(testSnippetName, {
      body: ['console.log("labeled");'],
      description: 'Snippet with labels',
      language: 'javascript',
      labels: ['Todo', 'Review'],
    });

    assert.deepStrictEqual(created.labels, ['Todo', 'Review']);

    const fetched = getSnippet(testSnippetName);
    assert.deepStrictEqual(fetched.labels, ['Todo', 'Review']);

    // Updating description should preserve labels
    const updated = upsertSnippet(testSnippetName, {
      body: ['console.log("labeled");'],
      description: 'Updated description',
    });
    assert.deepStrictEqual(updated.labels, ['Todo', 'Review']);

    // Updating label replaces labels
    const relabeled = upsertSnippet(testSnippetName, {
      body: ['console.log("labeled");'],
      label: 'Done',
    });
    assert.deepStrictEqual(relabeled.labels, ['Done']);

    deleteSnippet(testSnippetName);
  } finally {
    saveSnippets(originalStore);
  }
});

test('Issue #6: getAllSnippetWords includes words from labels', () => {
  const originalStore = loadSnippets();
  try {
    const testSnippetName = '__test_words_snippet__';
    upsertSnippet(testSnippetName, {
      body: ['function runProcess() {}'],
      description: 'processor test',
      labels: ['HighPriorityTask'],
    });

    const allWords = getAllSnippetWords();
    assert.ok(allWords.includes('HighPriorityTask'));
    assert.ok(allWords.includes('runProcess'));

    deleteSnippet(testSnippetName);
  } finally {
    saveSnippets(originalStore);
  }
});

test('Issue #2: formatComment dynamically respects updated comment_color config', () => {
  const commentText = '// dynamic comment test';
  setConfig('comment_color', 'cyan');
  assert.strictEqual(formatComment(commentText), chalk.cyan(commentText));

  setConfig('comment_color', 'yellow');
  assert.strictEqual(formatComment(commentText), chalk.yellow(commentText));

  // Reset to default
  setConfig('comment_color', 'gray');
  assert.strictEqual(formatComment(commentText), chalk.gray(commentText));
});

test('Issue #6: editCommand updates labels without prompting for body', async () => {
  const originalStore = loadSnippets();
  try {
    const testSnippetName = '__test_edit_labels__';
    upsertSnippet(testSnippetName, {
      body: ['const secret = 42;'],
      description: 'secret code',
      labels: ['Draft'],
    });

    // Run editCommand with only label updated
    await editCommand(testSnippetName, {
      label: 'Production, Secure',
    });

    const updated = getSnippet(testSnippetName);
    assert.deepStrictEqual(updated.labels, ['Production', 'Secure']);
    assert.deepStrictEqual(updated.body, ['const secret = 42;']);

    deleteSnippet(testSnippetName);
  } finally {
    saveSnippets(originalStore);
  }
});

test('Issue #6: listCommand filters snippets by label correctly', () => {
  const originalStore = loadSnippets();
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  try {
    saveSnippets({
      snipA: { prefix: 'snipA', body: ['a'], labels: ['Todo', 'Urgent'], createdAt: new Date().toISOString() },
      snipB: { prefix: 'snipB', body: ['b'], labels: ['Done'], createdAt: new Date().toISOString() },
    });

    // Test list with matching label
    logs.length = 0;
    listCommand({ label: 'Todo' });
    const outputTodo = logs.join('\n');
    assert.ok(outputTodo.includes('snipA'));
    assert.ok(!outputTodo.includes('snipB'));
    assert.ok(outputTodo.includes('Todo, Urgent'));

    // Test list with non-matching label
    logs.length = 0;
    listCommand({ label: 'NonExistent' });
    const outputNone = logs.join('\n');
    assert.ok(outputNone.includes('No snippets found with label "NonExistent"'));
  } finally {
    console.log = originalLog;
    saveSnippets(originalStore);
  }
});

