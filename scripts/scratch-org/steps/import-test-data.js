// 実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ標準テストデータを投入する。

const { runNodeScript } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]';

// 共通のデータ投入スクリプトをScratch Org用の設定で実行する。
function main({ argv = process.argv.slice(2), runNodeScriptCommand = runNodeScript } = {}) {
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            return runNodeScriptCommand(
                'scripts/setup/import-test-data.js',
                ['--plan', scratchOrg.importPlan, '--target-org', alias, '--default-repeat', '40'],
                repoRoot
            );
        }
    });
}

// コマンドとして実行された場合だけテストデータを投入する。
if (require.main === module) {
    process.exitCode = main();
}

module.exports = { main };
