import { homedir, platform } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

/**
 * Resolves the snippets directory for a given editor on the current OS.
 */
function getEditorSnippetsDir(editor) {
  const home = homedir();
  const os = platform();

  const paths = {
    vscode: {
      win32: join(process.env.APPDATA || '', 'Code', 'User', 'snippets'),
      darwin: join(home, 'Library', 'Application Support', 'Code', 'User', 'snippets'),
      linux: join(home, '.config', 'Code', 'User', 'snippets'),
    },
    cursor: {
      win32: join(process.env.APPDATA || '', 'Cursor', 'User', 'snippets'),
      darwin: join(home, 'Library', 'Application Support', 'Cursor', 'User', 'snippets'),
      linux: join(home, '.config', 'Cursor', 'User', 'snippets'),
    },
    antigravity: {
      win32: join(process.env.APPDATA || '', 'AntigravityIDE', 'User', 'snippets'),
      darwin: join(home, 'Library', 'Application Support', 'AntigravityIDE', 'User', 'snippets'),
      linux: join(home, '.config', 'AntigravityIDE', 'User', 'snippets'),
    },
    sublime: {
      win32: join(process.env.APPDATA || '', 'Sublime Text', 'Packages', 'User'),
      darwin: join(home, 'Library', 'Application Support', 'Sublime Text', 'Packages', 'User'),
      linux: join(home, '.config', 'sublime-text', 'Packages', 'User'),
    },
  };

  const editorPaths = paths[editor];
  if (!editorPaths) return null;

  return editorPaths[os] || editorPaths.linux;
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

  const dir = getEditorSnippetsDir(editor);
  if (!dir) {
    return { success: false, path: '', message: `Unsupported editor: "${editor}".` };
  }

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (editor === 'sublime') {
      // Sublime uses individual .sublime-snippet XML files
      const exportedFiles = [];
      for (const [name, snip] of Object.entries(snippets)) {
        const xml = toSublimeSnippetXML(name, snip);
        const filename = `snip_${sanitizeFilename(name)}.sublime-snippet`;
        const filepath = join(dir, filename);
        writeFileSync(filepath, xml, 'utf-8');
        exportedFiles.push(filepath);
      }
      return {
        success: true,
        path: dir,
        message: `Exported ${exportedFiles.length} snippet(s) to ${dir}`,
      };
    } else {
      // VS Code, Cursor, Antigravity — JSON format with MERGE
      const groups = groupByLanguage(snippets);
      const exportedFiles = [];

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
        exportedFiles.push(filepath);
      }

      const fileList = exportedFiles.map((f) => `    ${f}`).join('\n');
      return {
        success: true,
        path: exportedFiles[0],
        message: `Merged ${snippetCount} snippet(s) into:\n${fileList}`,
      };
    }
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
