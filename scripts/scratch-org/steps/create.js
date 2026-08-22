// 実行コマンド: node scripts/scratch-org/steps/create.js [--alias <alias>]
// 用途: setup.jsから呼び出し、設定ファイルに従ってScratch Orgを作成する。

const { runSf } = require('../../common/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/create.js [--alias <alias>]';

// 設定ファイルのdefinition、alias、有効日数を使用してScratch Orgを作成する。
function main({ argv = process.argv.slice(2), runSfCommand = runSf, stdout = process.stdout } = {}) {
    // 未指定時は再現設定のaliasを使い、指定時は検証済みaliasへ限定する。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        stdout,
        usage,
        execute(alias) {
            // 実行対象をログに残し、後続ステップと同じaliasであることを確認できるようにする。
            stdout.write(`使用するScratch Org alias: ${alias}\n`);

            // 再現設定のdefinitionと有効日数を明示してScratch Orgを作成する。
            return runSfCommand(
                [
                    'org',
                    'create',
                    'scratch',
                    '--definition-file',
                    scratchOrg.definitionFile,
                    '--alias',
                    alias,
                    '--duration-days',
                    String(scratchOrg.durationDays)
                ],
                repoRoot
            );
        }
    });
}

// コマンドとして実行された場合だけScratch Orgを作成する。
if (require.main === module) {
    // 引数検証と作成結果をshellへ終了コードとして返す。
    process.exitCode = main();
}

// CLI引数の組み立てを組織接続なしでテストできるようmainを公開する。
module.exports = { main };
