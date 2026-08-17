const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runCommand } = require('../../run-command');

// どのディレクトリから起動しても、manifestとCLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');
// dry-runと実削除で同じdestructive manifestを使用する。
const destructiveManifest = 'manifest/destructiveChanges.xml';

// すべてのSalesforce CLI操作を同じリポジトリルートから実行する。
function runSf(args) {
    return runCommand('sf', args, repoRoot);
}

async function main() {
    // 誤ったオプションを指定した状態で組織へ接続しない。
    if (process.argv.length !== 2) {
        console.error('Usage: node scripts/metadata/destructive/destructive.js');
        return 1;
    }

    // 削除処理へ進む前にdefault target orgを表示し、実行者が対象組織を確認できるようにする。
    if (runSf(['config', 'get', 'target-org']) !== 0) {
        return 1;
    }

    // dry-runと実削除の確認を同じ対話セッションで順番に受け付ける。
    const prompt = createInterface({ input: process.stdin, output: process.stdout });

    try {
        // 最初の承認があるまでは、組織に対するdeploy処理を実行しない。
        const dryRunAnswer = await prompt.question('この組織のメタデータ削除をdry-runしますか？ [y/N]: ');

        if (dryRunAnswer !== 'y' && dryRunAnswer !== 'Y') {
            console.log('メタデータ削除のdry-runを中止しました。');
            return 0;
        }

        // dry-runと実削除でscopeが変わらないよう、共通の引数を一度だけ定義する。
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
        if (runSf([...deployArgs, '--dry-run']) !== 0) {
            return 1;
        }

        // dry-run成功後も自動では削除せず、実行者から改めて承認を得る。
        const deleteAnswer = await prompt.question('dry-runが成功しました。実際にメタデータを削除しますか？ [y/N]: ');

        if (deleteAnswer !== 'y' && deleteAnswer !== 'Y') {
            console.log('メタデータの削除を中止しました。');
            return 0;
        }

        // 二段階の確認を通過した場合だけ、実際のdestructive deployを実行する。
        return runSf(deployArgs);
    } finally {
        // 中止やCLI失敗を含むすべての終了経路で、標準入力を解放する。
        prompt.close();
    }
}

// モジュールとして読み込まれた場合に、削除処理を開始しない。
if (require.main === module) {
    main().then((status) => {
        process.exitCode = status;
    });
}
