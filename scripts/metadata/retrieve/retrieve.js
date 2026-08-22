// 実行コマンド: npm run sf:retrieve
// 用途: Default Target Orgから、責務別のmanifestに定義したメタデータを順番に取得する。

const fs = require('node:fs');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../../internal/approval');
const { runSf } = require('../../internal/run-command');

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

// manifestの確認後、承認された組織からメタデータを取得する。
async function main({ argv = process.argv.slice(2), createPrompt, runSfCommand = runSf } = {}) {
    // このスクリプトは引数を受け付けない。
    if (argv.length !== 0) {
        console.error('エラー: このスクリプトは引数を受け付けません。');
        console.error('実行コマンド: npm run sf:retrieve');
        return 1;
    }

    // retrieveを始める前に、すべてのmanifestが存在することを確認する。
    for (const manifest of manifests) {
        // manifestがなければ、組織へ接続せず終了する。
        if (!fs.existsSync(path.join(repoRoot, manifest))) {
            console.error(`エラー: retrieve対象のmanifestが見つかりません: ${manifest}`);
            return 1;
        }
    }

    // retrieve対象のDefault Target Orgを表示する。
    if (runSfCommand(['config', 'get', 'target-org'], repoRoot) !== 0) {
        return 1;
    }

    // retrieveを開始するかターミナルで確認する。
    const prompt = createApprovalPrompt(createPrompt);
    let answer;

    try {
        answer = await prompt.question('この組織からメタデータを取得しますか？ [y/N]: ');
    } finally {
        prompt.close();
    }

    // yまたはY以外の場合はretrieveを中止する。
    if (!isApproved(answer)) {
        console.log('メタデータの取得を中止しました。');
        return 0;
    }

    // manifestの定義順にメタデータを取得する。
    for (const [index, manifest] of manifests.entries()) {
        console.log(`[${index + 1}/${manifests.length}] ${path.basename(manifest)} を取得します。`);

        // 失敗した場合は後続のretrieveを実行しない。
        if (runSfCommand(['project', 'retrieve', 'start', '--manifest', manifest], repoRoot) !== 0) {
            return 1;
        }
    }

    // 全manifestのretrieve完了を表示する。
    console.log('すべてのメタデータ取得が完了しました。');
    return 0;
}

// retrieveを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    main()
        .then((status) => {
            // mainの結果を終了コードに設定する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 確認入力を処理できない場合も、原因だけを簡潔に表示する。
            console.error(`エラー: retrieveを開始できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

// テストスクリプトからmanifest一覧を参照できるようにする。
module.exports = { main, manifests };
