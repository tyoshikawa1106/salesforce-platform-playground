#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/scratch-org-create.js

const { execSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

process.chdir(repoRoot);

// Scratch Org を作成する。
execSync(`sf org create scratch --definition-file ${scratchOrg.definitionFile} --alias ${scratchOrg.alias} --duration-days ${scratchOrg.durationDays}`, { stdio: 'inherit' });
