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
  local cur prev commands snippets
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="cat edit ls rm export config completion"
  editors="${SUPPORTED_EDITORS.join(' ')}"

  # Complete subcommands
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    # First arg: subcommand or snippet name
    snippets=$(snip --completions list 2>/dev/null)
    COMPREPLY=( $(compgen -W "\${commands} \${snippets}" -- "\${cur}") )
    return 0
  fi

  # Complete based on subcommand
  case "\${prev}" in
    cat|edit|rm)
      snippets=$(snip --completions list 2>/dev/null)
      COMPREPLY=( $(compgen -W "\${snippets}" -- "\${cur}") )
      return 0
      ;;
    export)
      COMPREPLY=( $(compgen -W "\${editors}" -- "\${cur}") )
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "set get" -- "\${cur}") )
      return 0
      ;;
    set)
      COMPREPLY=( $(compgen -W "editor" -- "\${cur}") )
      return 0
      ;;
    editor)
      COMPREPLY=( $(compgen -W "external inline" -- "\${cur}") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash powershell" -- "\${cur}") )
      return 0
      ;;
  esac

  # Default: complete with snippet names for rm (which accepts variadic args)
  if [[ "\${COMP_WORDS[1]}" == "rm" ]]; then
    snippets=$(snip --completions list 2>/dev/null)
    COMPREPLY=( $(compgen -W "\${snippets}" -- "\${cur}") )
    return 0
  fi
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

Register-ArgumentCompleter -CommandName snip -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commands = @('cat', 'edit', 'ls', 'rm', 'export', 'config', 'completion')
  $editors = @(${SUPPORTED_EDITORS.map((e) => `'${e}'`).join(', ')})
  $tokens = $commandAst.ToString().Trim() -split '\\s+'

  # Get snippet names
  $snippets = @()
  try {
    $snippets = (snip --completions list 2>$null) -split '\\n' | Where-Object { $_ }
  } catch {}

  if ($tokens.Count -eq 1 -or ($tokens.Count -eq 2 -and $wordToComplete)) {
    # Completing first argument: subcommands + snippet names
    ($commands + $snippets) | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
  elseif ($tokens[1] -in @('cat', 'edit', 'rm')) {
    # Completing snippet name
    $snippets | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
  elseif ($tokens[1] -eq 'export') {
    $editors | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
  elseif ($tokens[1] -eq 'config') {
    @('set', 'get') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
  elseif ($tokens[1] -eq 'completion') {
    @('bash', 'powershell') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
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
