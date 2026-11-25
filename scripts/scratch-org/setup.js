// 実行コマンド: node scripts/scratch-org/setup.js [--alias <alias>]
// 用途: Scratch Orgの作成、メタデータとECA反映、権限割り当て、Apexテスト、テストデータ投入を順番に行う。

const { runNodeScript, runSfWithOutput } = require('../common/run-command');
const { parseSfJson } = require('../common/target-org');
const { getCreateArgs } = require('./steps/create');
const { repoRoot, scratchOrg } = require('./internal/context');
const { runAliasCommand } = require('./internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/setup.js [--alias <alias>]';

// 指定aliasでScratch Orgを作成し、その組織の準備手順を順番に実行する。
function main({
    argv = process.argv.slice(2),
    runNodeScriptCommand = runNodeScript,
    runCreateCommand = runSfWithOutput,
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
            // 作成時に付けるaliasを表示する。
            stdout.write(`使用するScratch Org alias: ${alias}\n`);

            // 作成結果から直接ユーザー名を取得し、後続stepでaliasを再解決しない。
            const created = runCreateCommand([...getCreateArgs(alias), '--json'], repoRoot);
            // 作成に失敗した場合は後続stepを開始しない。
            if (created.status !== 0 || created.error) {
                // 作成応答に含まれる認証情報を出力せずに停止理由を通知する。
                stderr.write('エラー: Scratch Orgの作成に失敗したため、準備を停止しました。\n');
                // CLIの終了コードを保持する。
                return created.status || 1;
            }
            // JSON本文でも作成成功を確認する。
            const username = parseSfJson(created, 'Scratch Orgの作成')?.username;
            // 作成済み組織を特定できない場合はaliasへフォールバックしない。
            if (typeof username !== 'string' || !username.trim()) {
                throw new Error('Scratch Orgの作成結果にユーザー名がありません。');
            }
            // 作成した組織でmetadata反映からデータ投入まで進める。
            const steps = [
                ['メタデータの反映', 'scripts/scratch-org/steps/deploy.js'],
                ['外部クライアントアプリの反映', 'scripts/scratch-org/steps/deploy-external-client-apps.js'],
                ['Permission Setの割り当て', 'scripts/scratch-org/steps/assign-permission-set.js'],
                ['Apexテスト', 'scripts/scratch-org/steps/run-apex-tests.js'],
                ['テストデータの投入', 'scripts/scratch-org/steps/import-test-data.js']
            ];

            // 定義順を維持して各準備stepを実行する。
            for (const [label, scriptPath] of steps) {
                // 各stepの対象指定には作成結果のユーザー名を渡す。
                const status = runNodeScriptCommand(scriptPath, ['--alias', username], repoRoot);

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
    // 呼び出し元が準備途中の失敗を検知できる終了状態にする。
    process.exitCode = main();
}

// step順序と失敗時の停止を組織接続なしでテストできるようmainを公開する。
module.exports = { main };
