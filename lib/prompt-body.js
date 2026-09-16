import { editor } from '@inquirer/prompts';
import { loadConfig } from './config.js';
import { inlineEditor } from './inline-editor.js';

/**
 * Prompts the user for a multi-line snippet body, respecting the configured editor mode.
 *
 * @param {Object} options
 * @param {string} [options.defaultValue=''] - Pre-filled content.
 * @param {string} [options.header=''] - Header for inline mode.
 * @param {string} [options.language=''] - Language for syntax highlighting.
 * @returns {Promise<string|null>} The body text, or null if cancelled.
 */
export async function promptBody({ defaultValue = '', header = '', language = '' } = {}) {
  const config = loadConfig();

  if (config.editor === 'inline') {
    const result = await inlineEditor({ defaultValue, header, language });
    return result; // null if cancelled
  }

  // External editor mode ($EDITOR)
  try {
    const placeholder = '# Paste your snippet body here, then save & close the editor.';
    const result = await editor({
      message: 'body:',
      default: defaultValue || placeholder,
      waitForUseInput: false,
    });

    // Strip placeholder if user didn't change it
    if (!defaultValue) {
      const lines = result.split('\n').filter((l) => l.trim() !== placeholder);
      return lines.join('\n');
    }

    return result;
  } catch {
    return null;
  }
}
