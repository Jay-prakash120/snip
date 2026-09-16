import chalk from 'chalk';
import { generateBashCompletion, generatePowerShellCompletion } from '../lib/completion.js';

/**
 * Handles the "completion" command.
 * Usage:
 *   snip completion bash        — output bash completion script
 *   snip completion powershell  — output PowerShell completion script
 */
export function completionCommand(shell) {
  if (!shell) {
    console.log(chalk.cyan('\n  ⚙ Tab Completion Setup\n'));
    console.log(chalk.bold('  Bash / Git Bash / Zsh:'));
    console.log(chalk.dim('    Add to your ~/.bashrc or ~/.bash_profile:'));
    console.log(chalk.white('    eval "$(snip completion bash)"\n'));
    console.log(chalk.bold('  PowerShell:'));
    console.log(chalk.dim('    Add to your $PROFILE:'));
    console.log(chalk.white('    snip completion powershell | Out-String | Invoke-Expression\n'));
    return;
  }

  const shellLower = shell.toLowerCase();

  if (shellLower === 'bash' || shellLower === 'zsh') {
    process.stdout.write(generateBashCompletion());
    return;
  }

  if (shellLower === 'powershell' || shellLower === 'pwsh') {
    process.stdout.write(generatePowerShellCompletion());
    return;
  }

  console.error(chalk.red(`\n  ✗ Unsupported shell: "${shell}"\n`));
  console.log(chalk.dim('  Supported: bash, powershell\n'));
  process.exit(1);
}
