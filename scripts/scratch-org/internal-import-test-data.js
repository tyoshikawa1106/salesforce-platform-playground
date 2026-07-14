#!/usr/bin/env node
// Internal: called by scripts/scratch-org/setup.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

const usage = 'Usage: node scripts/scratch-org/internal-import-test-data.js';

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
