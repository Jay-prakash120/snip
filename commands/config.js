import chalk from 'chalk';
import { loadConfig, setConfig, CONFIG_SCHEMA } from '../lib/config.js';

/**
 * Handles the "config" command.
 * Usage:
 *   snip config                 — show all config
 *   snip config set <key> <val> — set a config value
 *   snip config get <key>       — get a config value
 */
export function configCommand(action, args) {
  // No action = show all config
  if (!action) {
    showAllConfig();
    return;
  }

  if (action === 'set') {
    const [key, value] = args;
    if (!key || value === undefined) {
      console.error(chalk.red('\n  ✗ Usage: snip config set <key> <value>\n'));
      showAvailableKeys();
      process.exit(1);
    }

    const schema = CONFIG_SCHEMA[key];
    if (!schema) {
      console.error(chalk.red(`\n  ✗ Unknown config key: "${key}"\n`));
      showAvailableKeys();
      process.exit(1);
    }

    if (schema.values && !schema.values.includes(value)) {
      console.error(chalk.red(`\n  ✗ Invalid value "${value}" for "${key}"\n`));
      console.log(chalk.dim(`  Allowed values: ${schema.values.join(', ')}\n`));
      process.exit(1);
    }

    setConfig(key, value);
    console.log(chalk.green(`\n  ✓ Set ${chalk.bold(key)} = ${chalk.bold(value)}\n`));
    return;
  }

  if (action === 'get') {
    const [key] = args;
    if (!key) {
      console.error(chalk.red('\n  ✗ Usage: snip config get <key>\n'));
      showAvailableKeys();
      process.exit(1);
    }

    const schema = CONFIG_SCHEMA[key];
    if (!schema) {
      console.error(chalk.red(`\n  ✗ Unknown config key: "${key}"\n`));
      showAvailableKeys();
      process.exit(1);
    }

    const config = loadConfig();
    console.log(chalk.cyan(`\n  ${key} = ${chalk.bold(config[key] || schema.default)}\n`));
    return;
  }

  console.error(chalk.red(`\n  ✗ Unknown config action: "${action}"\n`));
  console.log(chalk.dim('  Usage: snip config [set <key> <value> | get <key>]\n'));
  process.exit(1);
}

function showAllConfig() {
  const config = loadConfig();
  console.log(chalk.cyan('\n  ⚙ Current configuration:\n'));
  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    const val = config[key] || schema.default;
    console.log(`  ${chalk.bold(key)} = ${chalk.white(val)}`);
    console.log(chalk.dim(`    ${schema.description}`));
    console.log(chalk.dim(`    Options: ${schema.values.join(', ')} (default: ${schema.default})\n`));
  }
}

function showAvailableKeys() {
  console.log(chalk.dim('  Available keys:'));
  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    console.log(chalk.dim(`    ${key} — ${schema.description} [${schema.values.join('|')}]`));
  }
  console.log('');
}
