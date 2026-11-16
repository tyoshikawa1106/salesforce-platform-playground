// 実行コマンド: node scripts/scratch-org/steps/deploy-external-client-apps.js [--alias <alias>]
// 用途: Scratch Org専用のローカルECAとOAuth設定を反映する。

const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { XMLBuilder } = require('fast-xml-parser');
const { runSf, runSfWithOutput } = require('../../common/run-command');
const { getTargetOrgInfo, orgTypes } = require('../../common/target-org');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');
const { sourceApiVersion } = require('../../../sfdx-project.json');

// XML生成時にSalesforceの名前空間を設定し、設定値をエスケープする。
const xml = new XMLBuilder({ ignoreAttributes: false, format: true });
const namespace = { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata' };

// 定義済みのアプリを、組織固有値を含まないMetadata API形式に変換する。
function writePackage(directory, apps) {
    // typeと格納先を対応づけ、manifestの対象を同じ定義から生成する。
    const components = [
        [
            'ExternalClientApplication',
            'externalClientApps',
            'eca',
            (app) => ({ contactEmail: 'scratch-org@example.invalid', distributionState: 'Local', label: app.label })
        ],
        [
            'ExtlClntAppGlobalOauthSettings',
            'extlClntAppGlobalOauthSets',
            'ecaGlblOauth',
            (app) => ({
                externalClientApplication: app.apiName,
                isClientCredentialsFlowEnabled: false,
                isConsumerSecretOptional: false,
                isPkceRequired: true,
                label: app.label
            })
        ],
        [
            'ExtlClntAppOauthSettings',
            'extlClntAppOauthSettings',
            'ecaOauth',
            (app) => ({
                commaSeparatedOauthScopes: app.scopes.join(', '),
                externalClientApplication: app.apiName,
                label: app.label
            })
        ]
    ];

    // 各typeのファイルを一時ディレクトリに出力する。
    const types = components.map(([name, folder, extension, fields]) => {
        // Metadata API形式のtype別ディレクトリを作成する。
        const componentDir = path.join(directory, folder);
        mkdirSync(componentDir);

        // 設定で明示されたアプリ以外のメタデータは参照しない。
        const members = apps.map((app) => {
            // 名前は実行前に検証済みで、出力先を一時ディレクトリ内に限定する。
            writeFileSync(
                path.join(componentDir, `${app.apiName}.${extension}`),
                xml.build({ [name]: { ...namespace, ...fields(app) } })
            );
            // manifestには出力したコンポーネントだけを含める。
            return app.apiName;
        });
        // ワイルドカードを使わず、各typeの名前を列挙する。
        return { members, name };
    });

    // 生成先を単一パッケージとしてデプロイできるようにする。
    writeFileSync(
        path.join(directory, 'package.xml'),
        xml.build({ Package: { ...namespace, types, version: sourceApiVersion } })
    );
}

// 指定されたScratch Orgだけに検証用ECAを反映する。
function main({
    argv = process.argv.slice(2),
    apps = scratchOrg.externalClientApps,
    runSfCommand = runSf,
    runSfQuery = runSfWithOutput
} = {}) {
    // aliasの検証とエラー処理には他の準備ステップと同じ規則を使う。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage: '実行コマンド: node scripts/scratch-org/steps/deploy-external-client-apps.js [--alias <alias>]',
        execute(alias) {
            // API名、重複、必須項目を検査し、不正な設定で組織を更新しない。
            if (
                !Array.isArray(apps) ||
                !apps.every(
                    (app) =>
                        typeof app?.apiName === 'string' &&
                        /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(app.apiName) &&
                        typeof app.label === 'string' &&
                        app.label.trim().length > 0 &&
                        Array.isArray(app.scopes) &&
                        app.scopes.length > 0 &&
                        app.scopes.every((scope) => typeof scope === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(scope))
                ) ||
                new Set(apps.map((app) => app.apiName.toLowerCase())).size !== apps.length
            ) {
                throw new Error('外部クライアントアプリの設定が不正です。');
            }
            // 定義が空ならCLIを呼び出さずに正常終了する。
            if (apps.length === 0) return 0;

            // aliasの文字列だけで判断せず、CLIの情報で組織種別を確認する。
            const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfQuery, targetOrg: alias });
            // 本番やSandboxなどへの反映を防ぐ。
            if (orgInfo.type !== orgTypes.SCRATCH) {
                throw new Error('外部クライアントアプリの再現はScratch Orgだけに実行できます。');
            }

            // 生成物は作業ツリーの外に置き、終了時に削除する。
            const directory = mkdtempSync(path.join(tmpdir(), 'scratch-org-eca-'));
            try {
                // アプリのヘッダーとOAuth設定を同じパッケージにまとめる。
                writePackage(directory, apps);
                // 検証済みユーザーを指定し、aliasの再解決を避ける。
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
                // 成否にかかわらず、この実行で生成した一時パッケージだけを削除する。
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
