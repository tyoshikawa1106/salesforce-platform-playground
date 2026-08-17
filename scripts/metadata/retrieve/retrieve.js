const fs = require('node:fs');
const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runCommand } = require('../../run-command');

// どのディレクトリから起動しても、manifestとCLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// Profileを先頭、Translationsを末尾にして、責務別manifestを安全な順序で取得する。
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

// すべてのSalesforce CLI操作を同じリポジトリルートから実行する。
function runSf(args) {
    return runCommand('sf', args, repoRoot);
}

async function main() {
    // 誤ったオプションを指定した状態で組織へ接続しない。
    if (process.argv.length !== 2) {
        console.error('Usage: node scripts/metadata/retrieve/retrieve.js');
        return 1;
    }

    // 途中まで取得してからmanifest不足に気づくことがないよう、実行前に全件を確認する。
    for (const manifest of manifests) {
        if (!fs.existsSync(path.join(repoRoot, manifest))) {
            console.error(`retrieve対象のmanifestがありません: ${manifest}`);
            return 1;
        }
    }

    // 取得を始める前にdefault target orgを表示し、実行者が対象組織を確認できるようにする。
    if (runSf(['config', 'get', 'target-org']) !== 0) {
        return 1;
    }

    // 明示的に承認された場合だけ、組織からのretrieveへ進む。
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question('この組織からメタデータを取得しますか？ [y/N]: ');
    prompt.close();

    if (answer !== 'y' && answer !== 'Y') {
        console.log('メタデータの取得を中止しました。');
        return 0;
    }

    // 定義順に1件ずつ取得し、失敗した時点で後続manifestの処理を止める。
    for (const [index, manifest] of manifests.entries()) {
        console.log(`[${index + 1}/${manifests.length}] ${path.basename(manifest)} を取得します。`);

        if (runSf(['project', 'retrieve', 'start', '--manifest', manifest]) !== 0) {
            return 1;
        }
    }

    console.log('すべてのメタデータ取得が完了しました。');
    return 0;
}

// テストから読み込まれた場合は処理を開始せず、manifest一覧だけを公開する。
if (require.main === module) {
    main().then((status) => {
        process.exitCode = status;
    });
}

module.exports = { manifests };
