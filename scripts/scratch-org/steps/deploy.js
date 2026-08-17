// 実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ初期メタデータを反映する。

const { runSf } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]';

// Scratch Org再現用に限定したmanifestを、作成済みのaliasへ反映する。
function main({ argv = process.argv.slice(2), runSfCommand = runSf } = {}) {
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            return runSfCommand(
                [
                    'project',
                    'deploy',
                    'start',
                    '--manifest',
                    scratchOrg.manifest,
                    '--target-org',
                    alias,
                    '--wait',
                    String(scratchOrg.waitMinutes)
                ],
                repoRoot
            );
        }
    });
}

// コマンドとして実行された場合だけメタデータを反映する。
if (require.main === module) {
    process.exitCode = main();
}

module.exports = { main };
