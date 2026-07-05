#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/scratch-org-create.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

process.chdir(repoRoot);

process.stdout.write(`Using Scratch Org alias: ${scratchOrg.alias}\n`);

// Scratch Org を作成する。
execFileSync(
    'sf',
    [
        'org',
        'create',
        'scratch',
        '--definition-file',
        scratchOrg.definitionFile,
        '--alias',
        scratchOrg.alias,
        '--duration-days',
        String(scratchOrg.durationDays)
    ],
    { stdio: 'inherit' }
);
