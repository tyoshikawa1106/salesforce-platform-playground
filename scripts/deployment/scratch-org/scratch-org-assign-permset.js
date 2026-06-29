#!/usr/bin/env node
// Run: node scripts/deployment/scratch-org/scratch-org-assign-permset.js

const { execSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

process.chdir(repoRoot);

// Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
execSync(`sf org assign permset --name ${scratchOrg.permissionSet} --target-org ${scratchOrg.alias}`, { stdio: 'inherit' });
