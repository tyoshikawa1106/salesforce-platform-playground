#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/run-destructive-scratch-org.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

process.chdir(repoRoot);

if (!process.env.SCRATCH_ORG_ALIAS) {
    process.stderr.write(
        'Error: SCRATCH_ORG_ALIAS=<scratch-org-alias> is required for destructive scratch org deletion.\n'
    );
    process.exit(1);
}

// 定義ファイルで指定した alias の Scratch Org を削除する。
execFileSync('sf', ['org', 'delete', 'scratch', '--target-org', scratchOrg.alias], { stdio: 'inherit' });
