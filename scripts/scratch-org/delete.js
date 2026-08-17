// 実行コマンド: node scripts/scratch-org/delete.js --alias <alias>
// 用途: --aliasで指定したScratch Orgを削除する。

const { runCommand } = require('../internal/run-command');
const { repoRoot } = require('./internal/context');
const { runAliasCommand } = require('./internal/command');

// 削除操作では、対象aliasを引数で明示した実行だけを受け付ける。
const usage = '実行コマンド: node scripts/scratch-org/delete.js --alias <alias>';

process.exitCode = runAliasCommand({
    aliasRequired: true,
    argv: process.argv.slice(2),
    usage,
    execute(alias) {
        // 明示されたaliasのScratch Orgだけを削除する。
        return runCommand('sf', ['org', 'delete', 'scratch', '--target-org', alias], repoRoot);
    }
});
