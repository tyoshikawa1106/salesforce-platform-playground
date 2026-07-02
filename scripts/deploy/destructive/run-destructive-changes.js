#!/usr/bin/env node
// Run: node scripts/deploy/destructive/run-destructive-changes.js --target-org <alias> --dry-run
// Run: node scripts/deploy/destructive/run-destructive-changes.js --target-org <alias>

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const destructiveChanges = 'manifest/destructiveChanges.xml';

function readOption(name, shortName) {
    const args = process.argv.slice(2);
    const index = args.findIndex((arg) => arg === name || arg === shortName);
    return index === -1 ? null : args[index + 1];
}

function hasFlag(name) {
    return process.argv.slice(2).includes(name);
}

if (hasFlag('--help') || hasFlag('-h')) {
    process.stdout.write(`Usage:
  node scripts/deploy/destructive/run-destructive-changes.js --target-org <alias> --dry-run
  node scripts/deploy/destructive/run-destructive-changes.js --target-org <alias>

Options:
  --target-org, -o  Salesforce org alias or username.
  --wait            Wait time in minutes. Default: 30.
  --dry-run         Validate the destructive change without deleting.
`);
    process.exit(0);
}

const targetOrg = readOption('--target-org', '-o');
const waitMinutes = readOption('--wait', '-w') ?? '30';

if (!targetOrg) {
    process.stderr.write('Error: --target-org <alias> is required.\n');
    process.exit(1);
}

// destructiveChanges.xml に書いた ApexClass を削除する。
const sfArgs = [
    'project',
    'deploy',
    'start',
    '--post-destructive-changes',
    destructiveChanges,
    '--target-org',
    targetOrg,
    '--wait',
    waitMinutes
];

if (hasFlag('--dry-run')) {
    sfArgs.push('--dry-run');
}

execFileSync('sf', sfArgs, { cwd: repoRoot, stdio: 'inherit' });
