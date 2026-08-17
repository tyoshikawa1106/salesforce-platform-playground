// 実行コマンド: node scripts/scratch-org/setup.js [--alias <alias>]
// 用途: Scratch Orgの作成、メタデータ反映、権限割り当て、テストデータ投入を順番に行う。

const { runCommand } = require('../internal/run-command');
const { repoRoot, scratchOrg } = require('./internal/context');
const { runAliasCommand } = require('./internal/command');

const usage = '実行コマンド: node scripts/scratch-org/setup.js [--alias <alias>]';

process.exitCode = runAliasCommand({
    argv: process.argv.slice(2),
    defaultAlias: scratchOrg.alias,
    usage,
    execute(alias) {
        // 実行開始時に、全ステップが使用するaliasを明示する。
        process.stdout.write(`使用するScratch Org alias: ${alias}\n`);

        // 作成、metadata反映、権限割り当て、テストデータ投入を順番に実行する。
        const steps = [
            ['Scratch Orgの作成', 'scripts/scratch-org/steps/create.js'],
            ['メタデータの反映', 'scripts/scratch-org/steps/deploy.js'],
            ['Permission Setの割り当て', 'scripts/scratch-org/steps/assign-permission-set.js'],
            ['テストデータの投入', 'scripts/scratch-org/steps/import-test-data.js']
        ];

        for (const [label, scriptPath] of steps) {
            // すべての子スクリプトへ同じaliasをNode.js引数として渡す。
            const status = runCommand(process.execPath, [scriptPath, '--alias', alias], repoRoot);

            // 失敗したステップを表示し、後続処理を実行しない。
            if (status !== 0) {
                process.stderr.write(`エラー: ${label}に失敗したため、Scratch Orgの準備を停止しました。\n`);
                return status;
            }
        }

        return 0;
    }
});
