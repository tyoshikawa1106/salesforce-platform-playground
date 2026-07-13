#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/scratch-org-import-test-data.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');
const { runNoArgumentCommand } = require('./scratch-org-command');

const usage = 'Usage: node scripts/deploy/scratch-org/scratch-org-import-test-data.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // Scratch Org に標準オブジェクトのテストデータを投入する。
        execFileSync(
            process.execPath,
            [
                'scripts/setup/import-test-data.js',
                '--plan',
                scratchOrg.importPlan,
                '--target-org',
                scratchOrg.alias,
                '--default-repeat',
                '40'
            ],
            { cwd: repoRoot, stdio: 'inherit' }
        );
    }
});
