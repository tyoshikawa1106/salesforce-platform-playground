// 実行コマンド: node scripts/scratch-org/steps/deploy-external-client-apps.js [--alias <alias>]
// 用途: Scratch Org専用のローカルECAとOAuth設定を反映する。

const { runSf, runSfWithOutput } = require('../../common/run-command');
const { getTargetOrgInfo, orgTypes } = require('../../common/target-org');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// 確認済みのScratch OrgへGit管理のECAを反映する。
function main({ argv = process.argv.slice(2), runSfCommand = runSf, runSfQuery = runSfWithOutput } = {}) {
    // aliasの検証とエラー処理には他の準備ステップと同じ規則を使う。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage: '実行コマンド: node scripts/scratch-org/steps/deploy-external-client-apps.js [--alias <alias>]',
        execute(alias) {
            // aliasの文字列だけで判断せず、CLIの情報で組織種別を確認する。
            const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfQuery, targetOrg: alias });
            // 本番やSandboxなどへの反映を防ぐ。
            if (orgInfo.type !== orgTypes.SCRATCH) {
                throw new Error('外部クライアントアプリの再現はScratch Orgだけに実行できます。');
            }

            // 専用manifestで範囲を限定し、確認済みユーザーを接続先に指定する。
            return runSfCommand(
                [
                    'project',
                    'deploy',
                    'start',
                    '--manifest',
                    scratchOrg.externalClientAppManifest,
                    '--target-org',
                    orgInfo.username,
                    '--test-level',
                    'NoTestRun',
                    '--wait',
                    String(scratchOrg.waitMinutes)
                ],
                repoRoot
            );
        }
    });
}

// 単独実行ではデプロイの終了状態を呼び出し元へ伝える。
if (require.main === module) {
    process.exitCode = main();
}

// Salesforce CLIへの送信内容をローカルテストから確認できるようにする。
module.exports = { main };
