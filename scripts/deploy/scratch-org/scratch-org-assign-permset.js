#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/scratch-org-assign-permset.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');
const { runNoArgumentCommand } = require('./scratch-org-command');

const usage = 'Usage: node scripts/deploy/scratch-org/scratch-org-assign-permset.js';

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
