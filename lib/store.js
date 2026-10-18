import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const STORE_DIR = join(homedir(), '.snip');
const STORE_PATH = join(STORE_DIR, 'snippets.json');

/**
 * Ensures the ~/.snip directory and snippets.json file exist.
 */
function ensureStore() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({}, null, 2), 'utf-8');
  }
}

/**
 * Loads all snippets from the store.
 * @returns {Object} The snippets object keyed by prefix name.
 */
export function loadSnippets() {
  ensureStore();
  try {
    const raw = readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Saves the entire snippets object to the store.
 * @param {Object} snippets - The snippets object to persist.
 */
export function saveSnippets(snippets) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify(snippets, null, 2), 'utf-8');
}

/**
 * Retrieves a single snippet by name.
 * @param {string} name - The snippet prefix/name.
 * @returns {Object|null} The snippet object or null if not found.
 */
export function getSnippet(name) {
  const snippets = loadSnippets();
  return snippets[name] || null;
}

/**
 * Normalizes labels into an array of trimmed strings.
 * @param {string|string[]} [labels]
 * @returns {string[]}
 */
export function normalizeLabels(labels) {
  if (!labels) return [];
  if (Array.isArray(labels)) {
    return labels.map((l) => String(l).trim()).filter(Boolean);
  }
  if (typeof labels === 'string') {
    return labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Creates or updates a snippet.
 * @param {string} name - The snippet prefix/name.
 * @param {Object} snippetData - { body, description, language, labels }
 * @returns {Object} The saved snippet object.
 */
export function upsertSnippet(name, snippetData) {
  const snippets = loadSnippets();
  const now = new Date().toISOString();
  const existing = snippets[name];

  const labels = snippetData.labels !== undefined
    ? normalizeLabels(snippetData.labels)
    : (snippetData.label !== undefined ? normalizeLabels(snippetData.label) : (existing?.labels || []));

  snippets[name] = {
    prefix: name,
    body: snippetData.body,
    description: snippetData.description || existing?.description || '',
    language: snippetData.language || existing?.language || '',
    labels,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  saveSnippets(snippets);
  return snippets[name];
}

/**
 * Deletes a snippet by name.
 * @param {string} name - The snippet prefix/name.
 * @returns {boolean} True if deleted, false if not found.
 */
export function deleteSnippet(name) {
  const snippets = loadSnippets();
  if (!snippets[name]) {
    return false;
  }
  delete snippets[name];
  saveSnippets(snippets);
  return true;
}

/**
 * Returns the path to the store file.
 */
export function getStorePath() {
  return STORE_PATH;
}

/**
 * Collects all unique words from all saved snippets in the store (prefix, description, body, labels).
 * Used to expand ghost autocomplete across all snippets previously written by the user.
 * @returns {string[]}
 */
export function getAllSnippetWords() {
  try {
    const snippets = loadSnippets();
    const words = new Set();
    for (const snip of Object.values(snippets)) {
      if (snip.prefix) {
        const match = snip.prefix.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (match) match.forEach((w) => words.add(w));
      }
      if (snip.description) {
        const match = snip.description.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (match) match.forEach((w) => words.add(w));
      }
      if (Array.isArray(snip.labels)) {
        snip.labels.forEach((lbl) => {
          const match = lbl.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
          if (match) match.forEach((w) => words.add(w));
        });
      }
      const bodyStr = Array.isArray(snip.body) ? snip.body.join(' ') : (snip.body || '');
      const match = bodyStr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
      if (match) match.forEach((w) => words.add(w));
    }
    return Array.from(words);
  } catch {
    return [];
  }
}
