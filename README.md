# snip

A git-inspired CLI tool to create, manage, and export code snippets — no more manually editing JSON files.

## Install

```bash
npm install -g .
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

## License

ISC

