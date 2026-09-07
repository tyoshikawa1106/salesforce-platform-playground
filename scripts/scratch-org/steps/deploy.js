// 実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ初期メタデータを反映する。

const { runSf, runSfWithOutput } = require('../../common/run-command');
// 保存済み組織情報を使い再構築先の種別を確認する。
const { getTargetOrgInfo, orgTypes } = require('../../common/target-org');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]';

// Scratch Org再現用に限定したmanifestを、作成済みのaliasへ反映する。
function main({ argv = process.argv.slice(2), runSfCommand = runSf, runSfQuery = runSfWithOutput } = {}) {
    // 未指定時は再現設定のaliasを使い、指定時は検証済みaliasへ限定する。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            // aliasの名前ではなくCLIの組織分類で対象を確定する。
            const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfQuery, targetOrg: alias });
            // 非Scratch組織や判定不能の組織へ再構築manifestを送らない。
            if (orgInfo.type !== orgTypes.SCRATCH) {
                // 再構築対象外の組織ではdeploy前に停止する。
                throw new Error('再構築用deployはScratch Orgだけに実行できます。');
            }
            // 再構築専用manifestを指定Scratch OrgへRunLocalTests付きで反映する。
            return runSfCommand(
                [
                    'project',
                    'deploy',
                    'start',
                    '--manifest',
                    scratchOrg.manifest,
                    '--target-org',
                    orgInfo.username,
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
