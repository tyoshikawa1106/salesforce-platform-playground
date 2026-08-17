// 実行コマンド: node scripts/scratch-org/setup.js
// 用途: Scratch Orgの作成、メタデータ反映、権限割り当て、テストデータ投入を順番に行う。

const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('./internal/context');
const { runNoArgumentCommand } = require('./internal/command');

const usage = '実行コマンド: node scripts/scratch-org/setup.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // すべての子スクリプトへ同じaliasを渡し、処理対象が途中で変わらないようにする。
        const childEnv = {
            ...process.env,
            SCRATCH_ORG_ALIAS: scratchOrg.alias
        };

        // 実行開始時に、全ステップが使用するaliasを明示する。
        process.stdout.write(`使用するScratch Org alias: ${scratchOrg.alias}\n`);

        // 1. 設定ファイルからScratch Orgを作成する。
        execFileSync(process.execPath, ['scripts/scratch-org/steps/create.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });

        // 2. 再現用manifestに限定してmetadataを反映する。
        execFileSync(process.execPath, ['scripts/scratch-org/steps/deploy.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });

        // 3. playground機能の利用に必要なPermission Setを割り当てる。
        execFileSync(process.execPath, ['scripts/scratch-org/steps/assign-permission-set.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });

        // 4. 画面確認に使用する標準オブジェクトのテストデータを投入する。
        execFileSync(process.execPath, ['scripts/scratch-org/steps/import-test-data.js'], {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'inherit'
        });
    }
});
