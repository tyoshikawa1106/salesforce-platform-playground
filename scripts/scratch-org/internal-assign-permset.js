#!/usr/bin/env node

// 実行コマンド: node scripts/scratch-org/internal-assign-permset.js
// 用途: setup.jsから呼び出し、Scratch OrgへPermission Setを割り当てる。

const { runCommand } = require('../run-command');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

const usage = '実行コマンド: node scripts/scratch-org/internal-assign-permset.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // 設定ファイルで指定したPermission SetをScratch Orgの実行ユーザーへ割り当てる。
        return runCommand(
            'sf',
            ['org', 'assign', 'permset', '--name', scratchOrg.permissionSet, '--target-org', scratchOrg.alias],
            repoRoot
        );
    }
});
