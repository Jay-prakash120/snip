import { homedir, platform } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { loadConfig, getAutoExportEditors } from './config.js';
import { loadSnippets } from './store.js';

/**
 * Resolves all candidate snippets directories for a given editor on the current OS.
 * Returns array of existing directories (or the primary fallback directory).
 */
export function getEditorSnippetsDirs(editor) {
  const home = homedir();
  const os = platform();

  const paths = {
    vscode: {
      win32: [join(process.env.APPDATA || '', 'Code', 'User', 'snippets')],
      darwin: [join(home, 'Library', 'Application Support', 'Code', 'User', 'snippets')],
      linux: [join(home, '.config', 'Code', 'User', 'snippets')],
    },
    cursor: {
      win32: [join(process.env.APPDATA || '', 'Cursor', 'User', 'snippets')],
      darwin: [join(home, 'Library', 'Application Support', 'Cursor', 'User', 'snippets')],
      linux: [join(home, '.config', 'Cursor', 'User', 'snippets')],
    },
    antigravity: {
      win32: [
        join(process.env.APPDATA || '', 'Antigravity', 'User', 'snippets'),
        join(process.env.APPDATA || '', 'Antigravity IDE', 'User', 'snippets'),
        join(process.env.APPDATA || '', 'AntigravityIDE', 'User', 'snippets'),
      ],
      darwin: [
        join(home, 'Library', 'Application Support', 'Antigravity', 'User', 'snippets'),
        join(home, 'Library', 'Application Support', 'Antigravity IDE', 'User', 'snippets'),
        join(home, 'Library', 'Application Support', 'AntigravityIDE', 'User', 'snippets'),
      ],
      linux: [
        join(home, '.config', 'Antigravity', 'User', 'snippets'),
        join(home, '.config', 'Antigravity IDE', 'User', 'snippets'),
        join(home, '.config', 'AntigravityIDE', 'User', 'snippets'),
      ],
    },
    sublime: {
      win32: [join(process.env.APPDATA || '', 'Sublime Text', 'Packages', 'User')],
      darwin: [join(home, 'Library', 'Application Support', 'Sublime Text', 'Packages', 'User')],
      linux: [join(home, '.config', 'sublime-text', 'Packages', 'User')],
    },
  };

  const editorPaths = paths[editor];
  if (!editorPaths) return [];

  const candidates = editorPaths[os] || editorPaths.linux || [];
  const existing = candidates.filter((d) => existsSync(d));
  return existing.length > 0 ? existing : (candidates[0] ? [candidates[0]] : []);
}

/**
 * Resolves the primary snippets directory for a given editor.
 */
export function getEditorSnippetsDir(editor) {
  const dirs = getEditorSnippetsDirs(editor);
  return dirs.length > 0 ? dirs[0] : null;
}

/**
 * Converts a single snippet to VS Code / Cursor / Antigravity JSON entry.
 */
function toVSCodeEntry(snip) {
  return {
    prefix: snip.prefix,
    body: snip.body,
    ...(snip.description && { description: snip.description }),
    ...(snip.language && { scope: snip.language }),
  };
}

/**
 * Reads and parses an existing JSON snippets file for merging.
 * @returns {Object} Existing snippets or empty object.
 */
function readExistingJSON(filepath) {
  if (!existsSync(filepath)) return {};
  try {
    const raw = readFileSync(filepath, 'utf-8');
    // Strip single-line comments (VS Code snippet files support them)
    const stripped = raw.replace(/\/\/.*$/gm, '');
    return JSON.parse(stripped);
  } catch {
    return {};
  }
}

/**
 * Converts a single snippet to Sublime Text .sublime-snippet XML format.
 */
function toSublimeSnippetXML(name, snip) {
  const bodyContent = Array.isArray(snip.body) ? snip.body.join('\n') : snip.body;
  // Escape CDATA end sequence in body if present
  const safeBody = bodyContent.replace(/]]>/g, ']]]]><![CDATA[>');
  const scopeTag = snip.language
    ? `\n    <scope>source.${snip.language}</scope>`
    : '';
  return `<snippet>
    <content><![CDATA[
${safeBody}
]]></content>
    <tabTrigger>${snip.prefix}</tabTrigger>
    <description>${snip.description || name}</description>${scopeTag}
</snippet>`;
}

/**
 * Sanitizes a filename by removing characters that are invalid on most file systems.
 */
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*()]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Groups snippets by language. Ungrouped snippets go under 'global'.
 */
function groupByLanguage(snippets) {
  const groups = {};
  for (const [name, snip] of Object.entries(snippets)) {
    const lang = snip.language || 'global';
    if (!groups[lang]) groups[lang] = {};
    groups[lang][name] = snip;
  }
  return groups;
}

/**
 * Exports all snippets to the specified editor with MERGE behavior.
 * Existing snippets in the editor that weren't created by snip are preserved.
 * Supports editors that have multiple install directories (e.g. Antigravity IDE variants).
 *
 * @param {'vscode'|'cursor'|'sublime'|'antigravity'} editor
 * @param {Object} snippets - The snippets object from the store.
 * @returns {{ success: boolean, path: string, message: string }}
 */
export function exportToEditor(editor, snippets) {
  const snippetCount = Object.keys(snippets).length;
  if (snippetCount === 0) {
    return { success: false, path: '', message: 'No snippets to export.' };
  }

  const dirs = getEditorSnippetsDirs(editor);
  if (!dirs || dirs.length === 0) {
    return { success: false, path: '', message: `Unsupported editor: "${editor}".` };
  }

  try {
    const exportedDirs = [];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (editor === 'sublime') {
        // Sublime uses individual .sublime-snippet XML files
        for (const [name, snip] of Object.entries(snippets)) {
          const xml = toSublimeSnippetXML(name, snip);
          const filename = `snip_${sanitizeFilename(name)}.sublime-snippet`;
          const filepath = join(dir, filename);
          writeFileSync(filepath, xml, 'utf-8');
        }
        exportedDirs.push(dir);
      } else {
        // VS Code, Cursor, Antigravity — JSON format with MERGE
        const groups = groupByLanguage(snippets);

        for (const [lang, langSnippets] of Object.entries(groups)) {
          const filename =
            lang === 'global'
              ? 'snip.code-snippets'
              : `snip-${lang}.code-snippets`;
          const filepath = join(dir, filename);

          // Read existing file and merge
          const existing = readExistingJSON(filepath);
          const newData = {};
          for (const [name, snip] of Object.entries(langSnippets)) {
            newData[name] = toVSCodeEntry(snip);
          }

          // Merge: existing entries NOT in our snippet store are preserved
          const merged = { ...existing, ...newData };
          writeFileSync(filepath, JSON.stringify(merged, null, 2), 'utf-8');
        }
        exportedDirs.push(dir);
      }
    }

    return {
      success: true,
      path: exportedDirs[0],
      message: `Merged ${snippetCount} snippet(s) into ${editor} (${exportedDirs.join(', ')})`,
    };
  } catch (err) {
    return {
      success: false,
      path: '',
      message: `Export failed: ${err.message}`,
    };
  }
}

/**
 * List of supported editors for validation.
 */
export const SUPPORTED_EDITORS = ['vscode', 'cursor', 'sublime', 'antigravity'];

/**
 * Automatically exports snippets to all configured editors if auto_export is enabled.
 * Reads config via getAutoExportEditors().
 * @returns {{ success: boolean, editors: string[], message: string } | null}
 */
export function autoExportIfEnabled() {
  const editors = getAutoExportEditors();
  if (!editors || editors.length === 0) {
    return null;
  }
  const snippets = loadSnippets();
  if (Object.keys(snippets).length === 0) {
    return null;
  }

  const exported = [];
  for (const ed of editors) {
    const res = exportToEditor(ed, snippets);
    if (res.success) {
      exported.push(ed);
    }
  }

  return {
    success: exported.length > 0,
    editors: exported,
    message: `Auto-synced to ${exported.join(', ')}`,
  };
}

/**
 * Removes snippets from all configured editors' snippets files upon deletion.
 * @param {string|string[]} names - Snippet name or array of snippet names.
 * @returns {{ success: boolean, editors: string[] } | null}
 */
export function removeSnippetFromEditor(names) {
  const editors = getAutoExportEditors();
  if (!editors || editors.length === 0) {
    return null;
  }

  const nameList = Array.isArray(names) ? names : [names];
  if (nameList.length === 0) return null;

  const modifiedEditors = [];

  for (const ed of editors) {
    const dirs = getEditorSnippetsDirs(ed);
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;

      try {
        if (ed === 'sublime') {
          for (const name of nameList) {
            const filename = `snip_${sanitizeFilename(name)}.sublime-snippet`;
            const filepath = join(dir, filename);
            if (existsSync(filepath)) {
              unlinkSync(filepath);
            }
          }
        } else {
          // vscode, cursor, antigravity
          const files = readdirSync(dir).filter(
            (f) => f.startsWith('snip') && f.endsWith('.code-snippets')
          );
          for (const f of files) {
            const filepath = join(dir, f);
            const existing = readExistingJSON(filepath);
            let modified = false;
            for (const name of nameList) {
              if (existing && existing[name] !== undefined) {
                delete existing[name];
                modified = true;
              }
            }
            if (modified) {
              writeFileSync(filepath, JSON.stringify(existing, null, 2), 'utf-8');
            }
          }
        }
        if (!modifiedEditors.includes(ed)) {
          modifiedEditors.push(ed);
        }
      } catch {}
    }
  }

  return { success: modifiedEditors.length > 0, editors: modifiedEditors };
}
