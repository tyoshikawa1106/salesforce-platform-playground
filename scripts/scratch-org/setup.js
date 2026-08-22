// 実行コマンド: node scripts/scratch-org/setup.js [--alias <alias>]
// 用途: Scratch Orgの作成、メタデータ反映、権限割り当て、テストデータ投入を順番に行う。

const { runNodeScript } = require('../common/run-command');
const { repoRoot, scratchOrg } = require('./internal/context');
const { runAliasCommand } = require('./internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/setup.js [--alias <alias>]';

// 指定されたaliasでScratch Orgの準備手順を順番に実行する。
function main({
    argv = process.argv.slice(2),
    runNodeScriptCommand = runNodeScript,
    stderr = process.stderr,
    stdout = process.stdout
} = {}) {
    // aliasの決定、help、例外表示は全Scratch Orgコマンドと同じ規則を使用する。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        stderr,
        stdout,
        usage,
        execute(alias) {
            // 実行開始時に、全ステップが使用するaliasを明示する。
            stdout.write(`使用するScratch Org alias: ${alias}\n`);

            // 作成、metadata反映、権限割り当て、テストデータ投入を順番に実行する。
            const steps = [
                ['Scratch Orgの作成', 'scripts/scratch-org/steps/create.js'],
                ['メタデータの反映', 'scripts/scratch-org/steps/deploy.js'],
                ['Permission Setの割り当て', 'scripts/scratch-org/steps/assign-permission-set.js'],
                ['テストデータの投入', 'scripts/scratch-org/steps/import-test-data.js']
            ];

            // 定義順を維持して各準備stepを実行する。
            for (const [label, scriptPath] of steps) {
                // すべての子スクリプトへ同じaliasをNode.js引数として渡す。
                const status = runNodeScriptCommand(scriptPath, ['--alias', alias], repoRoot);

                // 失敗したステップを表示し、後続処理を実行しない。
                if (status !== 0) {
                    // 停止したstep名を利用者へ表示する。
                    stderr.write(`エラー: ${label}に失敗したため、Scratch Orgの準備を停止しました。\n`);
                    // 子スクリプトの失敗コードをそのまま呼び出し元へ返す。
                    return status;
                }
            }

            // 全stepが成功した場合だけ準備完了として0を返す。
            return 0;
        }
    });
}

// コマンドとして実行された場合だけScratch Orgの準備を開始する。
if (require.main === module) {
    // 引数検証と全stepの結果をshellへ終了コードとして返す。
    process.exitCode = main();
}

// step順序と失敗時の停止を組織接続なしでテストできるようmainを公開する。
module.exports = { main };
