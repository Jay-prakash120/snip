# snip

A git-inspired CLI tool to create, manage, and export code snippets — no more manually editing JSON files.

## Install

```bash
npm install -g .
```

## Usage

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

### Export to your editor

```bash
snip export vscode
snip export cursor
snip export sublime
snip export antigravity
```

## Storage

Snippets are stored in `~/.snip/snippets.json`.

## License

ISC
