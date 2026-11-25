// 実行コマンド: node scripts/scratch-org/steps/deploy-external-client-apps.js [--alias <alias>]
// 用途: Scratch Org専用のローカルECAとOAuth設定を反映する。

const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { runSf, runSfWithOutput } = require('../../common/run-command');
const { getTargetOrgInfo, orgTypes } = require('../../common/target-org');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');
const { withRestSecretAccess } = require('../internal/eca-rest-secret-access');
const { registerProviderCredentials } = require('../internal/eca-provider-credentials');
const { hasPersonAccounts, preparePermissions } = require('../internal/rebuild-permissions');
const { prepareEcaPackage, resolvePolicyNames } = require('../internal/eca-package');

// 確認済みのScratch OrgへGit管理のECAを反映する。
function main({
    argv = process.argv.slice(2),
    runSfCommand = runSf,
    runSfQuery = runSfWithOutput,
    registerCredentials = registerProviderCredentials,
    prepareSecretAccess = withRestSecretAccess
} = {}) {
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

            // 認可先、トークン発行先、callout先を同じScratch OrgのMy Domainに限定する。
            const orgUrl = new URL(orgInfo.instanceUrl);
            // エンドポイント設定へ埋め込めるSalesforceのHTTPSオリジンだけを使用する。
            if (orgUrl.origin !== `https://${orgUrl.hostname}` || !orgUrl.hostname.endsWith('.my.salesforce.com')) {
                throw new Error('Scratch OrgのMy Domainを確認できません。');
            }

            // 作成aliasのログインユーザーが有効な標準システム管理者か確認する。
            const escapedUsername = orgInfo.username.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
            // 組織から返る一致結果だけを使い、Dev組織の実行ユーザーは参照しない。
            const adminQuery = runSfQuery(
                [
                    'data',
                    'query',
                    '--target-org',
                    orgInfo.username,
                    '--query',
                    `SELECT Username, Profile.Name FROM User WHERE Username = '${escapedUsername}' AND IsActive = true AND Profile.Name IN ('System Administrator', 'システム管理者') LIMIT 2`,
                    '--json'
                ],
                repoRoot
            );
            // 確認できないユーザーをRun Asに設定しない。
            if (adminQuery.status !== 0) throw new Error('Scratch Orgの作成ユーザーを確認できません。');
            // 作成aliasのユーザーに一意に一致する応答を要求する。
            const admin = JSON.parse(adminQuery.stdout);
            if (
                admin.status !== 0 ||
                admin.result?.records?.length !== 1 ||
                admin.result.records[0].Username !== orgInfo.username ||
                !['System Administrator', 'システム管理者'].includes(admin.result.records[0].Profile?.Name)
            ) {
                throw new Error('Scratch Orgの作成ユーザーが有効な標準システム管理者と確認できません。');
            }

            // Run Asを含むパッケージをGit管理外に作成する。
            const directory = mkdtempSync(path.join(tmpdir(), 'scratch-org-eca-'));
            try {
                // 基本設定と後段ポリシーを同じ一時ルートの別パッケージへ分ける。
                const packageDirectory = path.join(directory, 'base');
                // Git管理の定義を変換し、専用manifestの範囲を維持する。
                const conversion = runSfCommand(
                    [
                        'project',
                        'convert',
                        'source',
                        '--manifest',
                        scratchOrg.externalClientAppManifest,
                        '--output-dir',
                        packageDirectory
                    ],
                    repoRoot
                );
                // 変換に失敗したパッケージは送信しない。
                if (conversion !== 0) return conversion;

                // アプリ名やファイル名を固定せず、全定義と関連参照を検証して置換する。
                const { policyDirectory, hasPolicies } = prepareEcaPackage(packageDirectory, {
                    username: orgInfo.username,
                    adminProfileName: admin.result.records[0].Profile.Name,
                    instanceUrl: orgUrl.origin,
                    providerApps: scratchOrg.externalClientAppProviders,
                    appLabels: scratchOrg.externalClientAppLabels
                });

                // 完全な OAuth 構築でも個人取引先に必要な参照依存を補う。
                preparePermissions(packageDirectory, hasPersonAccounts(orgInfo.username, runSfQuery), false);
                // ECAと接続定義の作成後、Salesforceが生成するポリシーを更新する。
                for (const deploymentDirectory of [packageDirectory, ...(hasPolicies ? [policyDirectory] : [])]) {
                    // 後段では組織が生成したポリシーの実名を確認し、別名の新規作成を防ぐ。
                    if (deploymentDirectory === policyDirectory) {
                        // 取得結果は元のソースに上書きせず、同じ一時ルートに限定する。
                        const generatedDirectory = path.join(directory, 'generated');
                        // ポリシーtypeだけを取得し、鍵やシークレットを含むglobal設定は取得しない。
                        const retrieval = runSfCommand(
                            [
                                'project',
                                'retrieve',
                                'start',
                                '--metadata',
                                'ExtlClntAppOauthConfigurablePolicies',
                                '--target-org',
                                orgInfo.username,
                                '--target-metadata-dir',
                                generatedDirectory,
                                '--unzip',
                                '--wait',
                                String(scratchOrg.waitMinutes)
                            ],
                            repoRoot
                        );
                        // 取得失敗を無視して仮のポリシー名で更新しない。
                        if (retrieval !== 0) return retrieval;
                        // 生成結果とローカル定義を関連アプリで照合する。
                        resolvePolicyNames(policyDirectory, generatedDirectory);
                    }
                    // 一つでも失敗したら資格情報登録と後続の初期化へ進まない。
                    const deployment = runSfCommand(
                        [
                            'project',
                            'deploy',
                            'start',
                            '--metadata-dir',
                            deploymentDirectory,
                            '--target-org',
                            orgInfo.username,
                            '--test-level',
                            'NoTestRun',
                            '--wait',
                            String(scratchOrg.waitMinutes)
                        ],
                        repoRoot
                    );
                    if (deployment !== 0) return deployment;
                }
                // 資格情報は明示した関連付けに従い、同じ組織内だけで登録する。
                prepareSecretAccess({ username: orgInfo.username, directory, runSfCommand }, () =>
                    registerCredentials(orgInfo.username, scratchOrg.externalClientAppProviders, runSfQuery)
                );
                return 0;
            } finally {
                // 組織固有のユーザー名を含む一時パッケージは反映後に削除する。
                rmSync(directory, { recursive: true, force: true });
            }
        }
    });
}

// 単独実行ではデプロイの終了状態を呼び出し元へ伝える。
if (require.main === module) {
    process.exitCode = main();
}

// Salesforce CLIへの送信内容をローカルテストから確認できるようにする。
module.exports = { main };
