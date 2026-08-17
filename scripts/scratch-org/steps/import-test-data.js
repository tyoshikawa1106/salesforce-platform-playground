// 実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ標準テストデータを投入する。

const { runNodeScript } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]';

process.exitCode = runAliasCommand({
    argv: process.argv.slice(2),
    defaultAlias: scratchOrg.alias,
    usage,
    execute(alias) {
        // 共通のデータ投入スクリプトを、Scratch Org用planと件数設定で実行する。
        return runNodeScript(
            'scripts/setup/import-test-data.js',
            ['--plan', scratchOrg.importPlan, '--target-org', alias, '--default-repeat', '40'],
            repoRoot
        );
    }
});
