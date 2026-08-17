#!/usr/bin/env node

// 実行方法: SCRATCH_ORG_ALIAS環境変数を設定して、node scripts/scratch-org/delete.jsを実行する。
// 用途: 環境変数で指定したScratch Orgを削除する。

const { runCommand } = require('../run-command');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

// 削除操作では、対象aliasを環境変数で明示した実行だけを受け付ける。
const usage = '実行方法: SCRATCH_ORG_ALIAS環境変数を設定して、node scripts/scratch-org/delete.jsを実行してください。';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // 既定aliasのまま誤って削除しないよう、削除時は環境変数を必須とする。
        if (!process.env.SCRATCH_ORG_ALIAS) {
            process.stderr.write('エラー: Scratch Orgを削除するには、SCRATCH_ORG_ALIAS環境変数の指定が必要です。\n');
            return 1;
        }

        // 明示されたaliasのScratch Orgだけを削除する。
        return runCommand('sf', ['org', 'delete', 'scratch', '--target-org', scratchOrg.alias], repoRoot);
    }
});
