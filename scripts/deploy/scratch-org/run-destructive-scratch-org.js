#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/run-destructive-scratch-org.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');
const { runNoArgumentCommand } = require('./scratch-org-command');

const usage = `Usage: SCRATCH_ORG_ALIAS=<scratch-org-alias> node scripts/deploy/scratch-org/run-destructive-scratch-org.js`;

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        process.chdir(repoRoot);

        if (!process.env.SCRATCH_ORG_ALIAS) {
            process.stderr.write(
                'Error: SCRATCH_ORG_ALIAS=<scratch-org-alias> is required for destructive scratch org deletion.\n'
            );
            return 1;
        }

        // 定義ファイルで指定した alias の Scratch Org を削除する。
        execFileSync('sf', ['org', 'delete', 'scratch', '--target-org', scratchOrg.alias], { stdio: 'inherit' });
        return 0;
    }
});
