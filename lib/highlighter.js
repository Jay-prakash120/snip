import chalk from 'chalk';

/**
 * Supported language identifiers and their aliases.
 */
export const LANGUAGE_ALIASES = {
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'typescript',
  py: 'python',
  python: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  json: 'json',
  sql: 'sql',
  html: 'html',
  xml: 'xml',
  css: 'css',
  go: 'go',
  rust: 'rust',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
};

/**
 * Language-specific keywords and comment prefixes.
 */
export const LANGUAGE_DEFINITIONS = {
  python: {
    commentPrefixes: ['#'],
    keywords: new Set([
      'def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while', 'import',
      'from', 'as', 'in', 'is', 'not', 'and', 'or', 'pass', 'lambda', 'yield',
      'raise', 'try', 'except', 'finally', 'with', 'async', 'await', 'global',
      'nonlocal', 'assert', 'del',
    ]),
    builtins: new Set([
      'True', 'False', 'None', 'self', 'cls', 'print', 'len', 'range', 'str',
      'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'super', 'isinstance',
      'enumerate', 'zip', 'map', 'filter', 'any', 'all', 'open', 'type',
    ]),
  },
  javascript: {
    commentPrefixes: ['//'],
    keywords: new Set([
      'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'break', 'continue', 'default', 'import', 'export',
      'from', 'as', 'class', 'extends', 'super', 'new', 'this', 'async', 'await',
      'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
      'void', 'delete', 'yield',
    ]),
    builtins: new Set([
      'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'console', 'document',
      'window', 'process', 'global', 'Object', 'Array', 'String', 'Number', 'Boolean',
      'Function', 'Promise', 'Map', 'Set', 'JSON', 'Math', 'RegExp', 'Error',
    ]),
  },
  typescript: {
    commentPrefixes: ['//'],
    keywords: new Set([
      'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'break', 'continue', 'default', 'import', 'export',
      'from', 'as', 'class', 'extends', 'super', 'new', 'this', 'async', 'await',
      'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
      'interface', 'type', 'enum', 'namespace', 'implements', 'declare', 'abstract',
      'readonly', 'as', 'keyof', 'is',
    ]),
    builtins: new Set([
      'true', 'false', 'null', 'undefined', 'any', 'unknown', 'never', 'void',
      'string', 'number', 'boolean', 'symbol', 'console', 'Promise', 'Array', 'Object',
    ]),
  },
  bash: {
    commentPrefixes: ['#'],
    keywords: new Set([
      'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done',
      'case', 'esac', 'in', 'function', 'select', 'return', 'exit', 'export',
      'source', 'alias', 'local', 'declare', 'read',
    ]),
    builtins: new Set([
      'echo', 'cat', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'grep',
      'sed', 'awk', 'find', 'curl', 'chmod', 'sudo', 'true', 'false',
    ]),
  },
  sql: {
    commentPrefixes: ['--'],
    keywords: new Set([
      'select', 'from', 'where', 'and', 'or', 'insert', 'into', 'values', 'update',
      'set', 'delete', 'create', 'table', 'drop', 'alter', 'join', 'left', 'right',
      'inner', 'outer', 'on', 'group', 'by', 'order', 'asc', 'desc', 'having',
      'limit', 'offset', 'as', 'distinct', 'union', 'all', 'case', 'when', 'then',
      'end', 'like', 'in', 'not', 'null', 'is', 'primary', 'key', 'foreign',
    ]),
    builtins: new Set([
      'count', 'sum', 'avg', 'min', 'max', 'coalesce', 'now', 'current_timestamp',
    ]),
  },
  json: {
    commentPrefixes: [],
    keywords: new Set(),
    builtins: new Set(['true', 'false', 'null']),
  },
};

// Fallback generic definitions for other languages
const GENERIC_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'return', 'function', 'class', 'import', 'export',
  'public', 'private', 'protected', 'static', 'final', 'const', 'var', 'let',
  'new', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue',
  'default', 'package', 'type', 'struct', 'interface', 'fn', 'mut', 'impl', 'pub',
]);

const GENERIC_BUILTINS = new Set([
  'true', 'false', 'null', 'nil', 'True', 'False', 'None', 'undefined', 'this', 'self',
]);

/**
 * Detects the language of a code snippet using hints, name extensions, and syntax patterns.
 *
 * @param {string} code - The code content.
 * @param {string} [nameHint=''] - The snippet name or prefix (e.g. "replace_many()", "script.py").
 * @param {string} [explicitLang=''] - An explicitly specified language from options or storage.
 * @returns {string} Normalized language identifier (e.g. "python", "javascript", "bash").
 */
export function detectLanguage(code = '', nameHint = '', explicitLang = '') {
  if (explicitLang && explicitLang.trim()) {
    const norm = explicitLang.toLowerCase().trim();
    return LANGUAGE_ALIASES[norm] || norm;
  }

  // Check file extension in name
  const extMatch = nameHint.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    if (LANGUAGE_ALIASES[ext]) {
      return LANGUAGE_ALIASES[ext];
    }
  }

  // Content heuristics
  const sample = code.slice(0, 1000);

  // Shell shebang
  if (sample.startsWith('#!/') || sample.includes('#!/bin/bash') || sample.includes('#!/bin/sh')) {
    return 'bash';
  }

  // Python patterns
  if (
    /^\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(|^\s*class\s+[a-zA-Z_].*:|^\s*import\s+[a-zA-Z_]|^\s*from\s+[a-zA-Z_].*import|\belif\b|\bself\b/m.test(
      sample
    )
  ) {
    return 'python';
  }

  // JSON
  const trimmed = sample.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      // not strict json
    }
  }

  // SQL
  if (/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+.*\s+SET)\b/i.test(sample)) {
    return 'sql';
  }

  // HTML / XML
  if (/<(!DOCTYPE\s+html|[a-zA-Z][a-zA-Z0-9]*(\s+[^>]*)?>)/i.test(sample)) {
    return 'html';
  }

  // JavaScript / TypeScript patterns
  if (
    /\b(const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=|\bfunction\s+[a-zA-Z_$]|\bimport\s+.*\s+from\s+['"]|=>|console\.(log|error|warn)\(/m.test(
      sample
    )
  ) {
    if (/\b(interface|type\s+[A-Z]|:\s*(string|number|boolean|any))\b/.test(sample)) {
      return 'typescript';
    }
    return 'javascript';
  }

  // Default to javascript if parentheses function call pattern (very common for snippets)
  if (nameHint.includes('(') && nameHint.includes(')')) {
    if (sample.includes('def ') || sample.includes(':')) {
      return 'python';
    }
    return 'javascript';
  }

  return 'javascript';
}

/**
 * Highlights a single line of code with ANSI color escape codes.
 *
 * @param {string} line - Single line of code.
 * @param {string} [lang='javascript'] - Language identifier.
 * @returns {string} ANSI-highlighted line.
 */
export function highlightLine(line, lang = 'javascript') {
  if (!line || line.length === 0) return line;

  const normalizedLang = LANGUAGE_ALIASES[lang.toLowerCase()] || lang.toLowerCase();
  const def = LANGUAGE_DEFINITIONS[normalizedLang] || {
    commentPrefixes: ['//', '#'],
    keywords: GENERIC_KEYWORDS,
    builtins: GENERIC_BUILTINS,
  };

  let result = '';
  let i = 0;
  const len = line.length;

  while (i < len) {
    // 1. Check for single-line comments
    let isComment = false;
    for (const prefix of def.commentPrefixes) {
      if (line.startsWith(prefix, i)) {
        // Everything from here to end of line is comment
        result += chalk.dim.gray(line.slice(i));
        return result;
      }
    }

    const char = line[i];

    // 2. Strings: double quotes, single quotes, template backticks
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let str = quote;
      i++;
      let escaped = false;
      while (i < len) {
        const c = line[i];
        str += c;
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      result += chalk.green(str);
      continue;
    }

    // 3. Numbers (decimals, hex, floats)
    if (/\d/.test(char) && (i === 0 || /[^a-zA-Z0-9_$]/.test(line[i - 1]))) {
      let num = '';
      while (i < len && /[0-9a-fA-FxX.eE+-]/.test(line[i])) {
        // Stop at operators if not part of exponential notation
        if ((line[i] === '+' || line[i] === '-') && !/[eE]/.test(line[i - 1])) {
          break;
        }
        num += line[i];
        i++;
      }
      result += chalk.yellow(num);
      continue;
    }

    // 4. Identifiers, keywords, and function calls
    if (/[a-zA-Z_$]/.test(char)) {
      let ident = '';
      const startIdx = i;
      while (i < len && /[a-zA-Z0-9_$]/.test(line[i])) {
        ident += line[i];
        i++;
      }

      // Check if this identifier is immediately followed by a '(' (function call)
      let lookahead = i;
      while (lookahead < len && /\s/.test(line[lookahead])) lookahead++;
      const isCall = lookahead < len && line[lookahead] === '(';

      const lowerIdent = normalizedLang === 'sql' ? ident.toLowerCase() : ident;

      if (def.keywords.has(lowerIdent)) {
        // Keyword
        result += chalk.cyan.bold(ident);
      } else if (def.builtins && def.builtins.has(lowerIdent)) {
        // Built-in / Type / Boolean / Constant
        result += chalk.magentaBright(ident);
      } else if (isCall) {
        // Function invocation
        result += chalk.blueBright.bold(ident);
      } else {
        // Regular variable / property / identifier
        result += chalk.white(ident);
      }
      continue;
    }

    // 5. Operators and punctuation
    if (/[\(\)\[\]\{\};,.]/.test(char)) {
      result += chalk.dim(char);
      i++;
      continue;
    }

    if (/[=+\-*/%&|^~<>!?:@]/.test(char)) {
      result += chalk.cyan(char);
      i++;
      continue;
    }

    // 6. Whitespace and other characters
    result += char;
    i++;
  }

  return result;
}

/**
 * Highlights a full multi-line snippet string.
 *
 * @param {string} text - Multi-line code.
 * @param {string} [lang='javascript'] - Language identifier.
 * @returns {string} ANSI-highlighted text.
 */
export function highlightText(text, lang = 'javascript') {
  if (!text) return text;
  const lines = text.split('\n');
  return lines.map((l) => highlightLine(l, lang)).join('\n');
}

/**
 * Gets a ghost text suggestion for a prefix given a language and optional buffer words.
 *
 * @param {string} prefix - The current word being typed.
 * @param {string} [lang='javascript'] - The language identifier.
 * @param {Iterable<string>} [bufferWords] - Words already present in the file.
 * @returns {string} The suggested suffix (e.g. 'ction' for prefix 'fun'), or empty string.
 */
export function getGhostSuggestion(prefix, lang = 'javascript', bufferWords = []) {
  if (!prefix || prefix.length < 2) return '';

  const normalizedLang = LANGUAGE_ALIASES[lang.toLowerCase()] || lang.toLowerCase();
  const def = LANGUAGE_DEFINITIONS[normalizedLang];

  const seen = new Set();
  const candidates = [];

  const addCandidate = (c) => {
    if (!seen.has(c)) {
      seen.add(c);
      candidates.push(c);
    }
  };

  if (def) {
    if (def.keywords) def.keywords.forEach(addCandidate);
    if (def.builtins) def.builtins.forEach(addCandidate);
  }
  GENERIC_KEYWORDS.forEach(addCandidate);
  GENERIC_BUILTINS.forEach(addCandidate);

  if (bufferWords) {
    for (const w of bufferWords) {
      if (w && w.length > prefix.length) addCandidate(w);
    }
  }

  for (const candidate of candidates) {
    if (candidate.startsWith(prefix) && candidate.length > prefix.length) {
      return candidate.slice(prefix.length);
    }
  }

  return '';
}
