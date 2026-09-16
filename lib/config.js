import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const CONFIG_DIR = join(homedir(), '.snip');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

/**
 * Default configuration values.
 */
const DEFAULTS = {
  editor: 'inline', // 'inline' (in-terminal widget) or 'external' ($EDITOR)
  auto_export: ['vscode', 'antigravity'], // array of editors to automatically sync
};

/**
 * Valid config keys and their allowed values.
 */
export const CONFIG_SCHEMA = {
  editor: {
    description: 'Editor mode for snippet body input',
    values: ['inline', 'external'],
    default: 'inline',
  },
  auto_export: {
    description: 'List of editors to automatically sync snippets to',
    values: ['vscode', 'cursor', 'sublime', 'antigravity', 'all', 'none'],
    default: ['vscode', 'antigravity'],
  },
};

/**
 * Loads the config from ~/.snip/config.json, merged with defaults.
 * @returns {Object} The config object.
 */
export function loadConfig() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const saved = JSON.parse(raw);
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Saves a config key-value pair.
 * @param {string} key
 * @param {string} value
 */
export function setConfig(key, value) {
  const config = loadConfig();
  config[key] = value;
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Gets a single config value.
 * @param {string} key
 * @returns {string|undefined}
 */
export function getConfig(key) {
  const config = loadConfig();
  return config[key];
}

/**
 * Returns the normalized array of editor names configured for auto-export.
 * @returns {string[]}
 */
export function getAutoExportEditors() {
  const config = loadConfig();
  const val = config.auto_export;
  if (!val || val === 'none' || (Array.isArray(val) && val.length === 0)) {
    return [];
  }
  if (val === 'all') {
    return ['vscode', 'antigravity', 'cursor', 'sublime'];
  }
  if (Array.isArray(val)) {
    return val.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return ['vscode', 'antigravity'];
}

/**
 * Sets the auto-export editors list.
 * @param {string[]|string} editors
 * @returns {string[]}
 */
export function setAutoExportEditors(editors) {
  let list;
  if (typeof editors === 'string') {
    if (editors === 'all') {
      list = ['vscode', 'antigravity', 'cursor', 'sublime'];
    } else if (editors === 'none' || editors === 'off') {
      list = [];
    } else {
      list = editors.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
  } else if (Array.isArray(editors)) {
    list = editors.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  } else {
    list = [];
  }
  setConfig('auto_export', list);
  return list;
}

/**
 * Toggles an editor on or off in the auto-export list.
 * @param {string} editor
 * @returns {{ enabled: boolean, editors: string[] }}
 */
export function toggleAutoExportEditor(editor) {
  const current = getAutoExportEditors();
  const lower = editor.trim().toLowerCase();
  let updated;
  let enabled;

  if (lower === 'all') {
    updated = ['vscode', 'antigravity', 'cursor', 'sublime'];
    enabled = true;
  } else if (lower === 'none' || lower === 'off') {
    updated = [];
    enabled = false;
  } else if (current.includes(lower)) {
    updated = current.filter((e) => e !== lower);
    enabled = false;
  } else {
    updated = [...current, lower];
    enabled = true;
  }

  setConfig('auto_export', updated);
  return { enabled, editors: updated };
}
