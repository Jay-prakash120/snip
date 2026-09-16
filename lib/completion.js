import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadSnippets } from './store.js';
import { SUPPORTED_EDITORS } from './exporters.js';

/**
 * Generates shell completion script for bash/zsh (Git Bash on Windows).
 */
export function generateBashCompletion() {
  return `#!/bin/bash
# snip CLI tab completion
# Add to your ~/.bashrc or ~/.bash_profile:
#   eval "$(snip completion bash)"

_snip_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local commands="cat edit ls rm export config completion"
  local editors="${SUPPORTED_EDITORS.join(' ')}"

  # Fast direct reading of snippet names from ~/.snip/snippets.json without launching Node
  _snip_get_snippets() {
    local file="\${HOME}/.snip/snippets.json"
    [[ ! -f "\$file" ]] && return

    local is_quoted=0
    local prefix="\$cur"
    if [[ "\$cur" =~ ^[\\\"\\'] ]]; then
      is_quoted=1
      prefix="\${cur:1}"
    fi

    local line key
    while IFS= read -r line; do
      case "\$line" in
        *'": {'*)
          key="\${line#*\\\"}"
          key="\${key%%\\\"*}"
          if [[ -n "\$key" && "\$key" == "\$prefix"* ]]; then
            if [[ \$is_quoted -eq 1 ]]; then
              COMPREPLY+=("\$key")
            else
              # Escape () and special characters for bash so execution doesn't throw syntax error
              COMPREPLY+=("\$(printf '%q' "\$key")")
            fi
          fi
          ;;
      esac
    done < "\$file"
  }

  # First argument: subcommand or snippet name
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    local cmd_matches
    cmd_matches=$(compgen -W "\${commands}" -- "\${cur}")
    if [[ -n "$cmd_matches" ]]; then
      while IFS= read -r c; do
        [[ -n "$c" ]] && COMPREPLY+=("$c")
      done <<< "$cmd_matches"
    fi
    _snip_get_snippets
    return 0
  fi

  # Subcommand-specific completion
  case "\${COMP_WORDS[1]}" in
    cat|edit)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        _snip_get_snippets
      fi
      return 0
      ;;
    rm)
      _snip_get_snippets
      return 0
      ;;
    export)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "\${editors}" -- "\${cur}") )
      fi
      return 0
      ;;
    config)
      case "\${prev}" in
        config)
          COMPREPLY=( $(compgen -W "get set" -- "\${cur}") )
          ;;
        set)
          COMPREPLY=( $(compgen -W "editor" -- "\${cur}") )
          ;;
        editor)
          COMPREPLY=( $(compgen -W "external inline" -- "\${cur}") )
          ;;
      esac
      return 0
      ;;
    completion)
      case "\${prev}" in
        completion)
          COMPREPLY=( $(compgen -W "bash powershell install" -- "\${cur}") )
          ;;
      esac
      return 0
      ;;
  esac
}

complete -F _snip_completions snip
`;
}

/**
 * Generates PowerShell completion script.
 */
export function generatePowerShellCompletion() {
  return `# snip CLI tab completion for PowerShell
# Add to your $PROFILE:
#   snip completion powershell | Out-String | Invoke-Expression

Register-ArgumentCompleter -Native -CommandName snip -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commands = @('cat', 'edit', 'ls', 'rm', 'export', 'config', 'completion')
  $editors = @(${SUPPORTED_EDITORS.map((e) => `'${e}'`).join(', ')})
  $tokens = $commandAst.ToString().Trim() -split '\\s+'

  $quoteChar = if ($wordToComplete -match '^["'']') { $wordToComplete[0] } else { '' }
  $cleanWord = $wordToComplete.Trim('"''')

  function Get-SnippetCompletions($filter) {
    try {
      $file = "$HOME\\.snip\\snippets.json"
      $names = @()
      if ([System.IO.File]::Exists($file)) {
        $content = [System.IO.File]::ReadAllText($file)
        $matches = [regex]::Matches($content, '"([^"]+)":\\s*\\{')
        foreach ($m in $matches) {
          $names += $m.Groups[1].Value
        }
      } else {
        $names = (snip --completions list 2>$null) -split '\\n' | Where-Object { $_ }
      }
      foreach ($name in $names) {
        if ($name -like "$filter*") {
          $val = if ($quoteChar) { "$quoteChar$name$quoteChar" } elseif ($name -match '[()\\s$]') { "'$name'" } else { $name }
          [System.Management.Automation.CompletionResult]::new($val, $name, 'ParameterValue', $name)
        }
      }
    } catch {}
  }

  if ($tokens.Count -eq 1 -or ($tokens.Count -eq 2 -and $wordToComplete)) {
    # Subcommands
    $commands | Where-Object { $_ -like "$cleanWord*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
    # Snippet names
    Get-SnippetCompletions $cleanWord
  }
  elseif ($tokens[1] -in @('cat', 'edit', 'rm')) {
    Get-SnippetCompletions $cleanWord
  }
  elseif ($tokens[1] -eq 'export') {
    $editors | Where-Object { $_ -like "$cleanWord*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
  elseif ($tokens[1] -eq 'config') {
    @('set', 'get') | Where-Object { $_ -like "$cleanWord*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
  elseif ($tokens[1] -eq 'completion') {
    @('bash', 'powershell', 'install') | Where-Object { $_ -like "$cleanWord*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
}
`;
}

/**
 * Returns a newline-separated list of snippet names (for shell completion scripts to call).
 */
export function listSnippetNames() {
  const snippets = loadSnippets();
  return Object.keys(snippets).join('\n');
}

/**
 * Automatically installs completion into shell configuration files.
 */
export function installCompletion(targetShell) {
  const home = os.homedir();
  const results = [];

  const installBash = () => {
    const bashrc = path.join(home, '.bashrc');
    const line = 'eval "$(snip completion bash)"';
    let content = '';
    if (fs.existsSync(bashrc)) {
      content = fs.readFileSync(bashrc, 'utf-8');
    }
    if (content.includes('snip completion bash')) {
      results.push({ shell: 'Bash', file: bashrc, status: 'already_installed' });
    } else {
      const addition = `\n# snip CLI tab completion\n${line}\n`;
      fs.appendFileSync(bashrc, addition, 'utf-8');
      results.push({ shell: 'Bash', file: bashrc, status: 'installed' });
    }
  };

  const installPowerShell = () => {
    // PowerShell profile locations (PowerShell 7 vs Windows PowerShell 5.1)
    const candidates = [
      path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
      path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    ];
    const targetFile = candidates[0];
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const line = 'snip completion powershell | Out-String | Invoke-Expression';
    let content = '';
    if (fs.existsSync(targetFile)) {
      content = fs.readFileSync(targetFile, 'utf-8');
    }
    if (content.includes('snip completion powershell')) {
      results.push({ shell: 'PowerShell', file: targetFile, status: 'already_installed' });
    } else {
      const addition = `\n# snip CLI tab completion\n${line}\n`;
      fs.appendFileSync(targetFile, addition, 'utf-8');
      results.push({ shell: 'PowerShell', file: targetFile, status: 'installed' });
    }
  };

  if (targetShell === 'bash') {
    installBash();
  } else if (targetShell === 'powershell' || targetShell === 'pwsh') {
    installPowerShell();
  } else {
    // Install for both so the user gets autocompletion everywhere
    installBash();
    installPowerShell();
  }

  return results;
}

