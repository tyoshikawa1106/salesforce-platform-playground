#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/scratch-org-deploy.js

const { execSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

process.chdir(repoRoot);

// Scratch Org 初期反映用 manifest を反映する。
execSync(`sf project deploy start --manifest ${scratchOrg.manifest} --target-org ${scratchOrg.alias} --wait ${scratchOrg.waitMinutes}`, { stdio: 'inherit' });
