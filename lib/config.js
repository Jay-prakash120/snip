import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const CONFIG_DIR = join(homedir(), '.snip');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

/**
 * Default configuration values.
 */
const DEFAULTS = {
  editor: 'external', // 'external' ($EDITOR) or 'inline' (in-terminal widget)
};

/**
 * Valid config keys and their allowed values.
 */
export const CONFIG_SCHEMA = {
  editor: {
    description: 'Editor mode for snippet body input',
    values: ['external', 'inline'],
    default: 'external',
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
