#!/usr/bin/env node
// Run: node scripts/deployment/scratch-org/rebuild-scratch-org.js

const { execFileSync } = require('node:child_process');
const { repoRoot } = require('./scratch-org-context');

// Scratch Org を作成する。
execFileSync(process.execPath, ['scripts/deployment/scratch-org/scratch-org-create.js'], { cwd: repoRoot, stdio: 'inherit' });

// Scratch Org 初期反映用 manifest を反映する。
execFileSync(process.execPath, ['scripts/deployment/scratch-org/scratch-org-deploy.js'], { cwd: repoRoot, stdio: 'inherit' });

// Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
execFileSync(process.execPath, ['scripts/deployment/scratch-org/scratch-org-assign-permset.js'], { cwd: repoRoot, stdio: 'inherit' });

// Scratch Org に標準オブジェクトのテストデータを投入する。
execFileSync(process.execPath, ['scripts/deployment/scratch-org/scratch-org-import-test-data.js'], { cwd: repoRoot, stdio: 'inherit' });
