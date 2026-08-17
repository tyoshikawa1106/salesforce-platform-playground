// 実行コマンド: npm run sf:destructive
// 用途: Default Target Orgのメタデータ削除をdry-runし、承認後に実行する。

const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runSf } = require('../../internal/run-command');

// manifestとSalesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// dry-runと実削除で同じdestructive manifestを使用する。
const destructiveManifest = 'manifest/destructiveChanges.xml';

// dry-runの成功後、再承認された場合だけメタデータを削除する。
async function main({ argv = process.argv.slice(2), createPrompt, runSfCommand = runSf } = {}) {
    // このスクリプトは引数を受け付けない。
    if (argv.length !== 0) {
        console.error('エラー: このスクリプトは引数を受け付けません。');
        console.error('実行コマンド: npm run sf:destructive');
        return 1;
    }

    // 削除対象のDefault Target Orgを表示する。
    if (runSfCommand(['config', 'get', 'target-org'], repoRoot) !== 0) {
        return 1;
    }

    // dry-runと実削除の確認入力を受け付ける。
    const prompt = createPrompt?.() ?? createInterface({ input: process.stdin, output: process.stdout });

    try {
        // dry-runを開始するか確認する。
        const dryRunAnswer = await prompt.question('この組織のメタデータ削除をdry-runしますか？ [y/N]: ');

        // yまたはY以外の場合はdry-runを中止する。
        if (dryRunAnswer !== 'y' && dryRunAnswer !== 'Y') {
            console.log('メタデータ削除のdry-runを中止しました。');
            return 0;
        }

        // dry-runと実削除で同じmanifestを使用する。
        const deployArgs = [
            'project',
            'deploy',
            'start',
            '--post-destructive-changes',
            destructiveManifest,
            '--wait',
            '30'
        ];

        // dry-runが失敗した場合は、実削除の確認を出さずに終了する。
        if (runSfCommand([...deployArgs, '--dry-run'], repoRoot) !== 0) {
            return 1;
        }

        // dry-run成功後、実際に削除するか確認する。
        const deleteAnswer = await prompt.question('dry-runが成功しました。実際にメタデータを削除しますか？ [y/N]: ');

        // yまたはY以外の場合は実削除を中止する。
        if (deleteAnswer !== 'y' && deleteAnswer !== 'Y') {
            console.log('メタデータの削除を中止しました。');
            return 0;
        }

        // 承認されたmanifestの削除を実行する。
        return runSfCommand(deployArgs, repoRoot);
    } finally {
        // 中止やCLI失敗の場合も確認入力を終了する。
        prompt.close();
    }
}

// destructive deployを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    main()
        .then((status) => {
            // mainの結果を終了コードに設定する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 確認入力を処理できない場合も、原因だけを簡潔に表示する。
            console.error(`エラー: destructive deployを開始できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = { main };
