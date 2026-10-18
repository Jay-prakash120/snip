# snip

A git-inspired CLI tool to create, manage, and export code snippets — no more manually editing JSON files.

## Install

```bash
npm install -g @piceofsilicon/snip
```

## Usage

### Interactive Shell (REPL)

Run `snip` with no arguments to launch the interactive shell with real-time dimmed ghost suggestions:

```bash
snip
# or: snip shell
```

- Real-time dimmed gray ghost suggestions as you type commands, flags, and snippet names
- Press <kbd>Tab</kbd> or <kbd>→</kbd> to accept ghost suggestions
- <kbd>Ctrl+←</kbd> / <kbd>Ctrl+→</kbd> to jump word by word
- <kbd>Ctrl+W</kbd> / <kbd>Ctrl+Backspace</kbd> to delete word backward
- <kbd>↑</kbd> / <kbd>↓</kbd> arrows to navigate command history
- Type `exit` or press <kbd>Ctrl+C</kbd> to leave

### Snippet Management

```bash
# Create a new snippet (opens the inline editor)
snip "replace_many()"
snip "replace_many()" -m "a python function to handle multiple replace at a time"

# Display a snippet with syntax highlighting
snip cat "replace_many()"

# List all saved snippets
snip ls

# Remove a snippet
snip rm "replace_many()"

# Edit snippet body in the inline editor
snip edit "my_snippet"

# Edit metadata only without opening the editor
snip edit "my_snippet" -l "python" -m "Updated description"

# Edit both metadata and snippet body
snip edit "my_snippet" -l "ts" -b
```

### Standalone File Editor (`snip-editor`)

Edit any local file directly in your terminal using the inline editor:

```bash
snip-editor path/to/file.js
```

### Keyboard Shortcuts & Editor Features

The inline editor widget includes a rich set of IDE-like keyboard shortcuts for fast, efficient terminal text editing:

#### 1. History & Undo/Redo
| Shortcut | Action | Description |
| --- | --- | --- |
| <kbd>Ctrl+Z</kbd> | **Undo** | Reverts the last change (typing burst, line split, paste, or deletion) |
| <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd> | **Redo** | Re-applies the previously undone change |

#### 2. Word & Document Navigation
| Shortcut | Action | Description |
| --- | --- | --- |
| <kbd>Ctrl+←</kbd> / <kbd>Ctrl+→</kbd> | **Word Jump** | Jump backward / forward whole words across tokens and lines (also <kbd>Alt+B</kbd> / <kbd>Alt+F</kbd>) |
| <kbd>Ctrl+Home</kbd> | **First Position** | Jump directly to the first character of the very first line |
| <kbd>Ctrl+End</kbd> | **Last Position** | Jump directly to the end of the very last line |
| <kbd>Home</kbd> | **Line Start** | Jump to the beginning of the current line |
| <kbd>End</kbd> | **Line End** | Jump to the end of the current line |
| <kbd>PageUp</kbd> / <kbd>PageDown</kbd> | **Page Jump** | Scroll and move cursor one screen up or down |
| <kbd>↑</kbd> / <kbd>↓</kbd> / <kbd>←</kbd> / <kbd>→</kbd> | **Caret Movement** | Move cursor line-by-line or letter-by-letter |

#### 3. Quick Deletion
| Shortcut | Action | Description |
| --- | --- | --- |
| <kbd>Ctrl+W</kbd> / <kbd>Ctrl+Backspace</kbd> | **Delete Word Left** | Delete the entire word or punctuation run to the left |
| <kbd>Ctrl+Delete</kbd> | **Delete Word Right** | Delete the entire word or punctuation run to the right |
| <kbd>Backspace</kbd> | **Delete Character Left** | Delete previous character (merges lines at column 0) |
| <kbd>Delete</kbd> | **Delete Character Right** | Delete next character (merges with line below at line end) |

#### 4. Completion & Control
| Shortcut | Action | Description |
| --- | --- | --- |
| <kbd>Tab</kbd> or <kbd>→</kbd> | **Autocomplete / Indent** | Accept ghost text suggestion at end of line, or insert 2 spaces |
| <kbd>Ctrl+S</kbd> | **Save** | Save changes and exit editor |
| <kbd>Esc</kbd> / <kbd>Ctrl+C</kbd> | **Cancel** | Discard changes and exit without saving |

### Multi-Editor Auto-Sync (`snip sync`)

All snippets are automatically mirrored across your editors simultaneously. You don't have to worry about whether a snippet is only for VS Code or Antigravity — they share the exact same snippets!

```bash
# View current auto-sync status across all editors
snip sync

# Toggle an editor on or off
snip sync antigravity    # Toggle Antigravity IDE
snip sync vscode         # Toggle VS Code
snip sync cursor         # Toggle Cursor

# Enable auto-sync for all supported editors at once
snip sync all

# Disable auto-sync
snip sync none
```

Whenever you create (`snip <name>`), edit (`snip edit <name>`), or delete (`snip rm ...`), all active editors are updated automatically!

### Manual Export

```bash
# Export all snippets on-demand
snip export vscode
snip export antigravity
snip export cursor
snip export sublime
```

### Configuration

```bash
# View configuration
snip config

# Change editor mode (default is inline)
snip config set editor inline    # In-terminal editor with syntax highlighting & instant paste
snip config set editor external  # External editor ($EDITOR / Notepad / VS Code)
```

### Tab Auto-Completion

```bash
# Install tab completion for your shell automatically
snip completion install
```

## Storage

- Snippets: `~/.snip/snippets.json`
- Configuration: `~/.snip/config.json`
- VS Code snippets: `%APPDATA%\Code\User\snippets\snip.code-snippets`
- Antigravity snippets: `%APPDATA%\Antigravity\User\snippets\snip.code-snippets`

## Publishing & Releases

### Automated Publishing (CI/CD)
Whenever you push changes to `master`:
```bash
git push origin master
```
GitHub Actions automatically:
1. Runs the test suite (`npm test`).
2. Checks the latest published version on npm.
3. Automatically bumps the patch version if needed (e.g. `1.0.2` ➔ `1.0.3`).
4. Signs and publishes the package to npm with cryptographic provenance.
5. Commits the updated version back to `master` and creates a [GitHub Release](https://github.com/Jay-prakash120/snip/releases).

### Renewing npm Token (Every 90 Days)
If your npm token expires in 90 days:
1. Open **[npmjs.com/settings/piceofsilicon/tokens](https://www.npmjs.com/settings/piceofsilicon/tokens)**.
2. Generate a new token (**Classic Token** ➔ **Automation**).
3. Update your GitHub secret via CLI in one command:
   ```bash
   gh secret set NPM_TOKEN -b "<paste_your_new_token_here>"
   ```

### (Optional) Tokenless Trusted Publishing (OIDC)
If you ever want to stop managing tokens and never worry about 90-day expirations:
1. Open **[npmjs.com/package/@piceofsilicon/snip/access](https://www.npmjs.com/package/@piceofsilicon/snip/access)**.
2. Under **Trusted Publishers**, click **Add publisher** ➔ **GitHub Actions**:
   - **Owner:** `Jay-prakash120`
   - **Repository:** `snip`
   - **Workflow:** `publish.yml`
3. Once added, you can delete the secret (`gh secret delete NPM_TOKEN`) and publishing will work forever without tokens.

## License

ISC

