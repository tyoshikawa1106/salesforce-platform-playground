#!/usr/bin/env node
const { runCommand } = require('../run-command');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

// setup.jsから呼び出す初期metadata反映ステップ。
const usage = 'Usage: node scripts/scratch-org/internal-deploy.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // Scratch Org再現用に限定したmanifestを、作成済みのaliasへ反映する。
        return runCommand(
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
            repoRoot
        );
    }
});
