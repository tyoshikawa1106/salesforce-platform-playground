// 実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ初期メタデータを反映する。

const { runSf } = require('../../common/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]';

// Scratch Org再現用に限定したmanifestを、作成済みのaliasへ反映する。
function main({ argv = process.argv.slice(2), runSfCommand = runSf } = {}) {
    // 未指定時は再現設定のaliasを使い、指定時は検証済みaliasへ限定する。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            // 再構築専用manifestを指定Scratch OrgへRunLocalTests付きで反映する。
            return runSfCommand(
                [
                    'project',
                    'deploy',
                    'start',
                    '--manifest',
                    scratchOrg.manifest,
                    '--target-org',
                    alias,
                    '--test-level',
                    'RunLocalTests',
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
    // setup.jsが引数エラーとdeploy失敗を検知できる終了状態にする。
    process.exitCode = main();
}

// CLI引数の組み立てを組織接続なしでテストできるようmainを公開する。
module.exports = { main };
