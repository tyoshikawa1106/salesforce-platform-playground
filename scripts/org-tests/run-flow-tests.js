// 実行コマンド: npm run sf:test:flow
// 用途: Default Target Orgを確認し、ローカルFlowテストを全件開始する。

const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runSf, runSfWithOutput } = require('../internal/run-command');
const { runAndMonitorTests } = require('./internal/test-runner');
const {
    getDefaultTargetOrg,
    getTargetOrgInfo,
    isApproved,
    orgTypes,
    printTargetOrgInfo
} = require('../internal/target-org');

// Salesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../..');

// 接続先の承認後、管理パッケージを除くFlowテストを開始する。
async function main({
    argv = process.argv.slice(2),
    createPrompt,
    runSfCommand = runSf,
    runSfWithOutputCommand = runSfWithOutput,
    runTestCommand = runAndMonitorTests
} = {}) {
    // このスクリプトは引数を受け付けない。
    if (argv.length !== 0) {
        console.error('エラー: 対象組織はDefault Target Orgから取得するため、引数は指定できません。');
        console.error('実行コマンド: npm run sf:test:flow');
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
        const targetAnswer = await prompt.question('この接続組織でFlowテストを実行しますか？ [y/N]: ');

        // yまたはY以外の場合は組織へ接続せず終了する。
        if (!isApproved(targetAnswer)) {
            console.log('Flowテストの実行を中止しました。');
            return 0;
        }

        // 本番環境では、Flowテストを開始する前に環境別の最終確認を行う。
        if (orgInfo.type === orgTypes.PRODUCTION) {
            const environmentAnswer = await prompt.question(
                `${orgInfo.typeLabel}です。Flowテストを実行してよろしいですか？ [y/N]: `
            );

            if (!isApproved(environmentAnswer)) {
                console.log('Flowテストの実行を中止しました。');
                return 0;
            }
        }
    } finally {
        prompt.close();
    }

    // ローカルFlowテストを開始し、完了まで進捗と結果を表示する。
    return runTestCommand({
        repoRoot,
        runSfCommand,
        runSfWithOutputCommand,
        targetOrg,
        testType: 'flow'
    });
}

// Flowテストを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    main()
        .then((status) => {
            // mainの結果を終了コードに設定する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 組織確認に失敗した場合は、Flowテストを開始しない。
            console.error(`エラー: Flowテストを開始できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = { main };
