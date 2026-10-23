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
            // ポリシーを含む初期反映より先に、反映実行者用の最小権限だけを用意する。
            const permissionStatus = runSfCommand(
                [
                    'project',
                    'deploy',
                    'start',
                    '--metadata',
                    `PermissionSet:${scratchOrg.deploymentPermissionSet}`,
                    '--target-org',
                    orgInfo.username,
                    '--test-level',
                    'NoTestRun',
                    '--wait',
                    String(scratchOrg.waitMinutes)
                ],
                repoRoot
            );
            // 権限セットの反映に失敗した状態では、割り当てや本体反映へ進まない。
            if (permissionStatus !== 0) return permissionStatus;
            // 再実行で重複割り当てエラーにならないよう、実行者への割り当てを確認する。
            const assignmentQuery = runSfQuery(
                [
                    'data',
                    'query',
                    '--target-org',
                    orgInfo.username,
                    '--query',
                    `SELECT Id FROM PermissionSetAssignment WHERE Assignee.Username = '${orgInfo.username.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}' AND PermissionSet.Name = '${scratchOrg.deploymentPermissionSet}'`,
                    '--json'
                ],
                repoRoot
            );
            // 確認できない状態では権限割り当てや本体反映へ進まない。
            if (assignmentQuery.status !== 0) throw new Error('反映実行者の権限割り当てを確認できません。');
            // CLIの応答を解析し、件数とレコードが矛盾する応答も拒否する。
            const assignmentResponse = JSON.parse(assignmentQuery.stdout);
            // 割り当ては実行者と権限セットの組み合わせで一意になる。
            if (
                assignmentResponse.status !== 0 ||
                ![0, 1].includes(assignmentResponse.result?.totalSize) ||
                !Array.isArray(assignmentResponse.result.records) ||
                assignmentResponse.result.records.length !== assignmentResponse.result.totalSize ||
                !assignmentResponse.result.records.every(
                    (record) => typeof record.Id === 'string' && record.Id.length > 0
                )
            ) {
                // 不完全な応答を割り当て済みまたは未割り当てと解釈しない。
                throw new Error('反映実行者の権限割り当て応答が不正です。');
            }
            // 未割り当ての場合だけ、検証済みの反映実行ユーザーへ付与する。
            if (assignmentResponse.result.totalSize === 0) {
                // 利用者向けのアプリ権限とは分け、検証済みの反映実行ユーザーだけへ付与する。
                const assignmentStatus = runSfCommand(
                    [
                        'org',
                        'assign',
                        'permset',
                        '--name',
                        scratchOrg.deploymentPermissionSet,
                        '--target-org',
                        orgInfo.username,
                        '--json'
                    ],
                    repoRoot
                );
                // 必須権限を用意できなければ、同じ権限不足で本体反映を失敗させない。
                if (assignmentStatus !== 0) return assignmentStatus;
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
