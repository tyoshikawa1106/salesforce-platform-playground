// 実行コマンド: node scripts/scratch-org/delete.js --alias <alias>
// 用途: --aliasで指定したScratch Orgを削除する。

const { runSf } = require('../internal/run-command');
const { repoRoot } = require('./internal/context');
const { runAliasCommand } = require('./internal/command');

// 削除操作では、対象aliasを引数で明示した実行だけを受け付ける。
const usage = '実行コマンド: node scripts/scratch-org/delete.js --alias <alias>';

// 明示されたaliasのScratch Orgだけを削除する。
function main({ argv = process.argv.slice(2), runSfCommand = runSf } = {}) {
    return runAliasCommand({
        aliasRequired: true,
        argv,
        usage,
        execute(alias) {
            return runSfCommand(['org', 'delete', 'scratch', '--target-org', alias], repoRoot);
        }
    });
}

// コマンドとして実行された場合だけScratch Orgを削除する。
if (require.main === module) {
    process.exitCode = main();
}

module.exports = { main };
