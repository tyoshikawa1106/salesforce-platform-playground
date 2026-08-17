#!/usr/bin/env node

// 実行コマンド: node scripts/scratch-org/internal-import-test-data.js
// 用途: setup.jsから呼び出し、Scratch Orgへ標準テストデータを投入する。

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

const usage = '実行コマンド: node scripts/scratch-org/internal-import-test-data.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // 共通のデータ投入スクリプトを、Scratch Org用planと件数設定で実行する。
        execFileSync(
            process.execPath,
            [
                'scripts/setup/import-test-data.js',
                '--plan',
                scratchOrg.importPlan,
                '--target-org',
                scratchOrg.alias,
                '--default-repeat',
                '40'
            ],
            { cwd: repoRoot, stdio: 'inherit' }
        );
    }
});
