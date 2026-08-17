#!/usr/bin/env node
const { runCommand } = require('../run-command');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

// setup.jsから呼び出すPermission Set割り当てステップ。
const usage = 'Usage: node scripts/scratch-org/internal-assign-permset.js';

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
