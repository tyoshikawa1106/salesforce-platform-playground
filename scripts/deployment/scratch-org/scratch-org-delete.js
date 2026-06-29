#!/usr/bin/env node
// Run: node scripts/deployment/scratch-org/scratch-org-delete.js

const { execSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

process.chdir(repoRoot);

// 定義ファイルで指定した alias の Scratch Org を削除する。
execSync(`sf org delete scratch --target-org ${scratchOrg.alias}`, { stdio: 'inherit' });
