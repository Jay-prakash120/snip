import chalk from 'chalk';
import { generateBashCompletion, generatePowerShellCompletion, installCompletion } from '../lib/completion.js';

/**
 * Handles the "completion" command.
 * Usage:
 *   snip completion bash            — output bash completion script
 *   snip completion powershell      — output PowerShell completion script
 *   snip completion install [shell] — auto-install completion into shell profile
 */
export function completionCommand(shell, target) {
  if (!shell) {
    console.log(chalk.cyan('\n  ⚙ Tab Completion Setup\n'));
    console.log(chalk.bold('  Fast automatic setup:'));
    console.log(chalk.green('    snip completion install\n'));
    console.log(chalk.bold('  Or manual setup:'));
    console.log(chalk.bold('  Bash / Git Bash:'));
    console.log(chalk.dim('    Add to your ~/.bashrc:'));
    console.log(chalk.white('    eval "$(snip completion bash)"\n'));
    console.log(chalk.bold('  PowerShell:'));
    console.log(chalk.dim('    Add to your $PROFILE:'));
    console.log(chalk.white('    snip completion powershell | Out-String | Invoke-Expression\n'));
    return;
  }

  const shellLower = shell.toLowerCase();

  if (shellLower === 'install') {
    const targetShell = target ? target.toLowerCase() : null;
    const results = installCompletion(targetShell);
    console.log(chalk.cyan('\n  ⚙ Tab Completion Installation\n'));
    for (const res of results) {
      if (res.status === 'installed') {
        console.log(chalk.green(`  ✔ Installed completion for ${chalk.bold(res.shell)} into:`));
        console.log(chalk.dim(`    ${res.file}`));
      } else {
        console.log(chalk.yellow(`  ℹ Completion for ${chalk.bold(res.shell)} is already configured in:`));
        console.log(chalk.dim(`    ${res.file}`));
      }
    }
    console.log(chalk.cyan('\n  To activate in your current terminal session:'));
    console.log(chalk.white('    • Git Bash:   ') + chalk.green('source ~/.bashrc') + chalk.dim('  (or eval "$(snip completion bash)")'));
    console.log(chalk.white('    • PowerShell: ') + chalk.green('. $PROFILE') + chalk.dim('  (or restart terminal)\n'));
    return;
  }

  if (shellLower === 'bash' || shellLower === 'zsh') {
    process.stdout.write(generateBashCompletion());
    return;
  }

  if (shellLower === 'powershell' || shellLower === 'pwsh') {
    process.stdout.write(generatePowerShellCompletion());
    return;
  }

  console.error(chalk.red(`\n  ✗ Unsupported shell: "${shell}"\n`));
  console.log(chalk.dim('  Supported: bash, powershell, install\n'));
  process.exit(1);
}
