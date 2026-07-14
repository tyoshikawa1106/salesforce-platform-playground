#!/usr/bin/env node
// Run: node scripts/scratch-org/setup.js

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

const usage = 'Usage: node scripts/scratch-org/setup.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        const childEnv = {
            ...process.env,
            SCRATCH_ORG_ALIAS: scratchOrg.alias
        };

        process.stdout.write(`Using Scratch Org alias: ${scratchOrg.alias}\n`);

        // Scratch Org を作成する。
        execFileSync(process.execPath, ['scripts/scratch-org/internal-create.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });

        // Scratch Org 初期反映用 manifest を反映する。
        execFileSync(process.execPath, ['scripts/scratch-org/internal-deploy.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });

        // Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
        execFileSync(process.execPath, ['scripts/scratch-org/internal-assign-permset.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });

        // Scratch Org に標準オブジェクトのテストデータを投入する。
        execFileSync(process.execPath, ['scripts/scratch-org/internal-import-test-data.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });
    }
});
