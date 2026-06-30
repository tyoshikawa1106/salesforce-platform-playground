#!/usr/bin/env node
// Run: node scripts/deployment/scratch-org/scratch-org-import-test-data.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

// Scratch Org に標準オブジェクトのテストデータを投入する。
execFileSync(process.execPath, ['scripts/setup/import-test-data.js', '--plan', scratchOrg.importPlan, '--target-org', scratchOrg.alias, '--default-repeat', '40'], { cwd: repoRoot, stdio: 'inherit' });
