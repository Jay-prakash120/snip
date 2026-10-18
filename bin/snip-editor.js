#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { inlineEditor } from '../lib/inline-editor.js';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Error: No file specified.');
  process.exit(1);
}

let initialContent = '';
if (existsSync(filePath)) {
  try {
    initialContent = readFileSync(filePath, 'utf-8');
  } catch {
    initialContent = '';
  }
}

try {
  const result = await inlineEditor({
    defaultValue: initialContent,
    header: `Editing: ${filePath}`,
  });

  if (result === null) {
    // User pressed Escape / Ctrl+C
    process.exit(1);
  }

  writeFileSync(filePath, result, 'utf-8');
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
