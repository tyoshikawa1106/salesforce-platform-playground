// 実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch OrgへPermission Setを割り当てる。

const { runCommand } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]';

process.exitCode = runAliasCommand({
    argv: process.argv.slice(2),
    defaultAlias: scratchOrg.alias,
    usage,
    execute(alias) {
        // 設定ファイルで指定したPermission SetをScratch Orgの実行ユーザーへ割り当てる。
        return runCommand(
            'sf',
            ['org', 'assign', 'permset', '--name', scratchOrg.permissionSet, '--target-org', alias],
            repoRoot
        );
    }
});
