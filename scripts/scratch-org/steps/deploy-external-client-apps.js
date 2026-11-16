// 実行コマンド: node scripts/scratch-org/steps/deploy-external-client-apps.js [--alias <alias>]
// 用途: Scratch Org専用のローカルECAとOAuth設定を反映する。

const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { XMLBuilder, XMLParser } = require('fast-xml-parser');
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
                    `SELECT Username FROM User WHERE Username = '${escapedUsername}' AND IsActive = true AND Profile.Name = 'System Administrator' LIMIT 2`,
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
                admin.result.records[0].Username !== orgInfo.username
            ) {
                throw new Error('Scratch Orgの作成ユーザーが有効な標準システム管理者と確認できません。');
            }

            // Run Asを含むパッケージをGit管理外に作成する。
            const directory = mkdtempSync(path.join(tmpdir(), 'scratch-org-eca-'));
            try {
                // Git管理の定義を変換し、専用manifestの範囲を維持する。
                const conversion = runSfCommand(
                    [
                        'project',
                        'convert',
                        'source',
                        '--manifest',
                        scratchOrg.externalClientAppManifest,
                        '--output-dir',
                        directory
                    ],
                    repoRoot
                );
                // 変換に失敗したパッケージは送信しない。
                if (conversion !== 0) return conversion;

                // 管理・組織内接続の3件について、組織ごとのURLを一時パッケージだけに反映する。
                for (const name of ['ExternalClientAppManager', 'InternalSalesforceApi', 'SalesforceApiIntegration']) {
                    // 反映するURLのファイル種別を限定し、認証情報には触れない。
                    const files = [
                        `externalAuthIdentityProviders/${name}.externalAuthIdentityProvider`,
                        `namedCredentials/${name}.namedCredential`,
                        `extlClntAppGlobalOauthSets/${name}.ecaGlblOauth`
                    ];
                    // 在庫のDev組織URLを使わず、定義上のプレースホルダーだけを置換する。
                    for (const file of files) {
                        // 変換後の実ファイルを読んで、未置換のままの反映を防ぐ。
                        const filepath = path.join(directory, file);
                        // 各型のURLに共通のプレースホルダーが入っていることを検証する。
                        const xml = readFileSync(filepath, 'utf8');
                        if (!xml.includes('https://scratch-org.example.invalid')) {
                            throw new Error('Scratch Orgの接続先URLを設定できません。');
                        }
                        // SalesforceのHTTPSオリジンで接続先を設定する。
                        writeFileSync(filepath, xml.replaceAll('https://scratch-org.example.invalid', orgUrl.origin));
                    }
                }

                // 組織ごとのRun Asは、作成対象の一時ポリシーだけに設定する。
                const policyPath = path.join(
                    directory,
                    'extlClntAppOauthPolicies',
                    'HerokuPlaygroundIntegration.ecaOauthPlcy'
                );
                // 名前空間と値の文字列表現を維持して読み込む。
                const parser = new XMLParser({
                    ignoreAttributes: false,
                    parseTagValue: false,
                    ignoreDeclaration: false
                });
                const packagePolicy = parser.parse(readFileSync(policyPath, 'utf8'));
                // Client Credentials Flowを使うアプリに作成ユーザーを指定する。
                const { '@_xmlns': namespace, ...fields } = packagePolicy.ExtlClntAppOauthConfigurablePolicies;
                packagePolicy.ExtlClntAppOauthConfigurablePolicies = {
                    '@_xmlns': namespace,
                    ...fields,
                    clientCredentialsFlowUser: orgInfo.username
                };
                // XMLエスケープを適用して一時ポリシーを保存する。
                const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
                writeFileSync(policyPath, builder.build(packagePolicy));

                // 検証済みのScratch Orgに、全ECAと組織固有のRun Asをまとめて反映する。
                return runSfCommand(
                    [
                        'project',
                        'deploy',
                        'start',
                        '--metadata-dir',
                        directory,
                        '--single-package',
                        '--target-org',
                        orgInfo.username,
                        '--test-level',
                        'NoTestRun',
                        '--wait',
                        String(scratchOrg.waitMinutes)
                    ],
                    repoRoot
                );
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
