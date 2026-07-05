#!/usr/bin/env node
// Run: node scripts/deploy/scratch-org/run-constructive-scratch-org.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./scratch-org-context');

const childEnv = {
    ...process.env,
    SCRATCH_ORG_ALIAS: scratchOrg.alias
};

process.stdout.write(`Using Scratch Org alias: ${scratchOrg.alias}\n`);

// Scratch Org を作成する。
execFileSync(process.execPath, ['scripts/deploy/scratch-org/scratch-org-create.js'], {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit'
});

// Scratch Org 初期反映用 manifest を反映する。
execFileSync(process.execPath, ['scripts/deploy/scratch-org/scratch-org-deploy.js'], {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit'
});

// Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
execFileSync(process.execPath, ['scripts/deploy/scratch-org/scratch-org-assign-permset.js'], {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit'
});

// Scratch Org に標準オブジェクトのテストデータを投入する。
execFileSync(process.execPath, ['scripts/deploy/scratch-org/scratch-org-import-test-data.js'], {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit'
});
