# snip

A git-inspired CLI tool to create, manage, and export code snippets — no more manually editing JSON files.

## Install

```bash
npm install -g @piceofsilicon/snip
```

## Usage

### Interactive Shell (Real-Time Ghost Text)

Run `snip` with no arguments to launch the interactive shell:

```bash
snip
# or: snip shell
```

- Real-time dimmed gray ghost suggestions as you type commands, flags, and snippet names
- Press **Tab** or **→** to accept ghost text
- **Up / Down** arrows to navigate command history
- Type `exit` or press **Ctrl+C** to leave

### Create a snippet

```bash
snip "replace_many()"
snip "replace_many()" -m "a python function to handle multiple replace at a time"
```

An editor opens — paste your snippet body, save & close.

### View a snippet

```bash
snip cat "replace_many()"
```

### Edit a snippet

```bash
snip edit "replace_many()"
snip edit "replace_many()" -m "updated description"
```

### List all snippets

```bash
snip ls
```

### Remove a snippet

```bash
snip rm "replace_many()"
```

### Interactive Shell (Ghost Auto-Suggestions)

Just run `snip` to enter the interactive shell:

```bash
snip
```

Features:
- Real-time ghost text auto-suggestions as you type.
- Press <kbd>Tab</kbd> or <kbd>→</kbd> to accept suggestions.
- History navigation with <kbd>↑</kbd> and <kbd>↓</kbd>.
- Type `exit` or press <kbd>Ctrl+C</kbd> to leave.

### Edit a snippet

```bash
# Edit snippet body in the inline editor
snip edit "my_snippet"

# Edit metadata only (language scope / description) without opening editor
snip edit "my_snippet" -l "python"
snip edit "my_snippet" -m "Updated description"
snip edit "my_snippet" -l "js" -m "New desc"

# Edit both metadata and body
snip edit "my_snippet" -l "ts" -b
```

### Standalone File Editor (`snip-editor`)

Edit any local file directly using the in-terminal editor:

```bash
snip-editor path/to/file.js
```

### Inline Editor Keyboard Shortcuts

When editing snippets inside the terminal inline editor:

| Shortcut | Description |
| --- | --- |
| <kbd>Ctrl+S</kbd> | Save and finish |
| <kbd>Esc</kbd> / <kbd>Ctrl+C</kbd> | Cancel editing |
| <kbd>Ctrl+Z</kbd> | Undo last change |
| <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd> | Redo change |
| <kbd>Ctrl+←</kbd> / <kbd>Ctrl+→</kbd> | Jump backward / forward word by word |
| <kbd>Ctrl+Home</kbd> | Jump to first position at first line |
| <kbd>Ctrl+End</kbd> | Jump to end position at last line |
| <kbd>Home</kbd> / <kbd>End</kbd> | Jump to beginning / end of current line |
| <kbd>Ctrl+W</kbd> / <kbd>Ctrl+Backspace</kbd> | Delete previous word |
| <kbd>Ctrl+Delete</kbd> | Delete next word |
| <kbd>Tab</kbd> / <kbd>→</kbd> | Accept ghost text suggestion or indent |

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

