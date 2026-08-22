// 実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch OrgへPermission Setを割り当てる。

const { runSf } = require('../../common/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]';

// 設定ファイルで指定したPermission SetをScratch Orgの実行ユーザーへ割り当てる。
function main({ argv = process.argv.slice(2), runSfCommand = runSf } = {}) {
    // 未指定時は再現設定のaliasを使い、指定時は検証済みaliasへ限定する。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            // 設定済みPermission Setを指定Scratch Orgの実行ユーザーへ割り当てる。
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

// CLI引数の組み立てを組織接続なしでテストできるようmainを公開する。
module.exports = { main };
