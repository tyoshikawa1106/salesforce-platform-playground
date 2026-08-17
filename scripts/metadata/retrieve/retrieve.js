// 実行コマンド: npm run sf:retrieve
// 用途: Default Target Orgから、責務別のmanifestに定義したメタデータを順番に取得する。

const fs = require('node:fs');
const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runCommand } = require('../../run-command');

// manifestとSalesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// Profileを最初、Translationsを最後に取得する。
const manifests = [
    'manifest/retrieve-profile.xml',
    'manifest/retrieve-code.xml',
    'manifest/retrieve-shared-resources.xml',
    'manifest/retrieve-application-ui.xml',
    'manifest/retrieve-object-configuration.xml',
    'manifest/retrieve-custom-configuration.xml',
    'manifest/retrieve-automation.xml',
    'manifest/retrieve-access-sharing.xml',
    'manifest/retrieve-integration-api.xml',
    'manifest/retrieve-events-messaging.xml',
    'manifest/retrieve-ui-extensions.xml',
    'manifest/retrieve-auth-security.xml',
    'manifest/retrieve-analytics.xml',
    'manifest/retrieve-email-notification.xml',
    'manifest/retrieve-digital-experience.xml',
    'manifest/retrieve-experience-sites.xml',
    'manifest/retrieve-service.xml',
    'manifest/retrieve-mobile-offline.xml',
    'manifest/retrieve-ai-ml.xml',
    'manifest/retrieve-content-cms.xml',
    'manifest/retrieve-search-knowledge.xml',
    'manifest/retrieve-org-settings.xml',
    'manifest/retrieve-classic-ui.xml',
    'manifest/retrieve-conversation-intelligence.xml',
    'manifest/retrieve-payments.xml',
    'manifest/retrieve-platform-features.xml',
    'manifest/retrieve-translations.xml'
];

// Salesforce CLIをリポジトリルートで実行する。
function runSf(args) {
    return runCommand('sf', args, repoRoot);
}

// manifestの確認後、承認された組織からメタデータを取得する。
async function main() {
    // このスクリプトは引数を受け付けない。
    if (process.argv.length !== 2) {
        console.error('Usage: node scripts/metadata/retrieve/retrieve.js');
        return 1;
    }

    // retrieveを始める前に、すべてのmanifestが存在することを確認する。
    for (const manifest of manifests) {
        // manifestがなければ、組織へ接続せず終了する。
        if (!fs.existsSync(path.join(repoRoot, manifest))) {
            console.error(`retrieve対象のmanifestがありません: ${manifest}`);
            return 1;
        }
    }

    // retrieve対象のDefault Target Orgを表示する。
    if (runSf(['config', 'get', 'target-org']) !== 0) {
        return 1;
    }

    // retrieveを開始するかターミナルで確認する。
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question('この組織からメタデータを取得しますか？ [y/N]: ');
    prompt.close();

    // yまたはY以外の場合はretrieveを中止する。
    if (answer !== 'y' && answer !== 'Y') {
        console.log('メタデータの取得を中止しました。');
        return 0;
    }

    // manifestの定義順にメタデータを取得する。
    for (const [index, manifest] of manifests.entries()) {
        console.log(`[${index + 1}/${manifests.length}] ${path.basename(manifest)} を取得します。`);

        // 失敗した場合は後続のretrieveを実行しない。
        if (runSf(['project', 'retrieve', 'start', '--manifest', manifest]) !== 0) {
            return 1;
        }
    }

    // 全manifestのretrieve完了を表示する。
    console.log('すべてのメタデータ取得が完了しました。');
    return 0;
}

// retrieveを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    main().then((status) => {
        // mainの結果を終了コードに設定する。
        process.exitCode = status;
    });
}

// テストスクリプトからmanifest一覧を参照できるようにする。
module.exports = { manifests };
