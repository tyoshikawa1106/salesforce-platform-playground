// 実行コマンド: npm run sf:test:apex
// 用途: Default Target Orgを確認し、ローカルApexテストを全件実行する。

const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runSf, runSfWithOutput } = require('../internal/run-command');
const {
    getDefaultTargetOrg,
    getTargetOrgInfo,
    isApproved,
    orgTypes,
    printTargetOrgInfo
} = require('../internal/target-org');

// Salesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../..');

// 接続先の承認後、管理パッケージを除くApexテストを開始する。
async function main({
    argv = process.argv.slice(2),
    createPrompt,
    runSfCommand = runSf,
    runSfWithOutputCommand = runSfWithOutput
} = {}) {
    // このスクリプトは引数を受け付けない。
    if (argv.length !== 0) {
        console.error('エラー: 対象組織はDefault Target Orgから取得するため、引数は指定できません。');
        console.error('実行コマンド: npm run sf:test:apex');
        return 1;
    }

    // テスト対象のDefault Target Orgと、認証済み組織情報を取得する。
    const targetOrg = getDefaultTargetOrg({ repoRoot, runSfCommand: runSfWithOutputCommand });
    const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfWithOutputCommand, targetOrg });

    // 実行者が接続先を確認できるよう、必要な組織情報だけを表示する。
    printTargetOrgInfo(orgInfo);

    // 確認入力に使用するインターフェースを作成する。
    const prompt = createPrompt?.() ?? createInterface({ input: process.stdin, output: process.stdout });

    try {
        const targetAnswer = await prompt.question('この接続組織でApexテストを実行しますか？ [y/N]: ');

        // yまたはY以外の場合は組織へ接続せず終了する。
        if (!isApproved(targetAnswer)) {
            console.log('Apexテストの実行を中止しました。');
            return 0;
        }

        // 本番環境では、Apexテストを開始する前に環境別の最終確認を行う。
        if (orgInfo.type === orgTypes.PRODUCTION) {
            const environmentAnswer = await prompt.question(
                `${orgInfo.typeLabel}です。Apexテストを実行してよろしいですか？ [y/N]: `
            );

            if (!isApproved(environmentAnswer)) {
                console.log('Apexテストの実行を中止しました。');
                return 0;
            }
        }
    } finally {
        prompt.close();
    }

    // 管理パッケージを除くローカルApexテストをカバレッジ付きで実行する。
    return runSfCommand(
        [
            'apex',
            'run',
            'test',
            '--test-level',
            'RunLocalTests',
            '--code-coverage',
            '--result-format',
            'human',
            '--target-org',
            targetOrg,
            '--wait',
            '120'
        ],
        repoRoot
    );
}

// Apexテストを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    main()
        .then((status) => {
            // mainの結果を終了コードに設定する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 組織確認に失敗した場合は、Apexテストを開始しない。
            console.error(`エラー: Apexテストを開始できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = { main };
