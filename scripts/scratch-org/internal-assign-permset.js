#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

const usage = 'Usage: node scripts/scratch-org/internal-assign-permset.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        process.chdir(repoRoot);

        // Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
        execFileSync(
            'sf',
            ['org', 'assign', 'permset', '--name', scratchOrg.permissionSet, '--target-org', scratchOrg.alias],
            {
                stdio: 'inherit'
            }
        );
    }
});
