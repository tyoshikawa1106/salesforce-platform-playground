// 実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch OrgへPermission Setを割り当てる。

const { runSf } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]';

// 設定ファイルで指定したPermission SetをScratch Orgの実行ユーザーへ割り当てる。
function main({ argv = process.argv.slice(2), runSfCommand = runSf } = {}) {
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            return runSfCommand(
                ['org', 'assign', 'permset', '--name', scratchOrg.permissionSet, '--target-org', alias],
                repoRoot
            );
        }
    });
}

// コマンドとして実行された場合だけPermission Setを割り当てる。
if (require.main === module) {
    process.exitCode = main();
}

module.exports = { main };
