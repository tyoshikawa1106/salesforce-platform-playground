#!/usr/bin/env node
const { runCommand } = require('../run-command');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

// 削除操作では、対象aliasを環境変数で明示した実行だけを受け付ける。
const usage = `Usage: SCRATCH_ORG_ALIAS=<scratch-org-alias> node scripts/scratch-org/delete.js`;

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // 既定aliasのまま誤って削除しないよう、削除時は環境変数を必須とする。
        if (!process.env.SCRATCH_ORG_ALIAS) {
            process.stderr.write(
                'Error: SCRATCH_ORG_ALIAS=<scratch-org-alias> is required for destructive scratch org deletion.\n'
            );
            return 1;
        }

        // 明示されたaliasのScratch Orgだけを削除する。
        return runCommand('sf', ['org', 'delete', 'scratch', '--target-org', scratchOrg.alias], repoRoot);
    }
});
