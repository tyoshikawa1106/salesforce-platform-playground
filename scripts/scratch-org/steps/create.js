// 実行コマンド: node scripts/scratch-org/steps/create.js [--alias <alias>]
// 用途: 設定ファイルに従ってScratch Orgを単独作成し、一括セットアップにも同じ作成引数を提供する。

const { runSf } = require('../../common/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/create.js [--alias <alias>]';

// 単独作成と一括セットアップが同じ定義・alias・有効日数を使用する。
function getCreateArgs(alias) {
    // デフォルト組織を変更せず、作成先に指定のaliasを付ける。
    return [
        'org',
        'create',
        'scratch',
        '--definition-file',
        scratchOrg.definitionFile,
        '--alias',
        alias,
        '--duration-days',
        String(scratchOrg.durationDays)
    ];
}

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
            return runSfCommand(getCreateArgs(alias), repoRoot);
        }
    });
}

// コマンドとして実行された場合だけScratch Orgを作成する。
if (require.main === module) {
    // setup.jsが引数エラーと作成失敗を検知できる終了状態にする。
    process.exitCode = main();
}

// CLI引数の組み立てを組織接続なしでテストできるようmainを公開する。
module.exports = { main, getCreateArgs };
