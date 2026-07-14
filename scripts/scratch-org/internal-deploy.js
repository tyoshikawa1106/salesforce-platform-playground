#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

const usage = 'Usage: node scripts/scratch-org/internal-deploy.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        process.chdir(repoRoot);

        // Scratch Org 初期反映用 manifest を反映する。
        execFileSync(
            'sf',
            [
                'project',
                'deploy',
                'start',
                '--manifest',
                scratchOrg.manifest,
                '--target-org',
                scratchOrg.alias,
                '--wait',
                String(scratchOrg.waitMinutes)
            ],
            { stdio: 'inherit' }
        );
    }
});
