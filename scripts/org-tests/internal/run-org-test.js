// 実行方法: ApexまたはFlowテストの実行入口から読み込む。
// 用途: Default Target Orgの確認、本番環境の追加確認、組織テスト開始を共通化する。

const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../../internal/approval');
const { runSf, runSfWithOutput } = require('../../internal/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../../internal/target-org');
const { runAndMonitorTests } = require('./test-runner');

// Salesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// テスト種別ごとの表示と識別子だけを受け取り、共通の実行処理を作成する。
function createOrgTestMain({ testLabel, testType, usage }) {
    return async function main({
        argv = process.argv.slice(2),
        createPrompt,
        runSfCommand = runSf,
        runSfWithOutputCommand = runSfWithOutput,
        runTestCommand = runAndMonitorTests
    } = {}) {
        // 対象組織はDefault Target Orgに固定し、別組織を示す引数を許可しない。
        if (argv.length !== 0) {
            console.error('エラー: 対象組織はDefault Target Orgから取得するため、引数は指定できません。');
            console.error(`実行コマンド: ${usage}`);
            return 1;
        }

        // テスト対象のDefault Target Orgと、認証済み組織情報を取得する。
        const targetOrg = getDefaultTargetOrg({ repoRoot, runSfCommand: runSfWithOutputCommand });
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfWithOutputCommand, targetOrg });

        // 実行者が接続先を確認できるよう、必要な組織情報だけを表示する。
        printTargetOrgInfo(orgInfo);

        const prompt = createApprovalPrompt(createPrompt);

        try {
            const targetAnswer = await prompt.question(`この接続組織で${testLabel}テストを実行しますか？ [y/N]: `);

            // yまたはY以外の場合は組織へ接続せず終了する。
            if (!isApproved(targetAnswer)) {
                console.log(`${testLabel}テストの実行を中止しました。`);
                return 0;
            }

            // 本番環境では、組織テストを開始する前に環境別の最終確認を行う。
            if (orgInfo.type === orgTypes.PRODUCTION) {
                const environmentAnswer = await prompt.question(
                    `${orgInfo.typeLabel}です。${testLabel}テストを実行してよろしいですか？ [y/N]: `
                );

                if (!isApproved(environmentAnswer)) {
                    console.log(`${testLabel}テストの実行を中止しました。`);
                    return 0;
                }
            }
        } finally {
            prompt.close();
        }

        // 指定された組織テストを開始し、完了まで進捗と結果を表示する。
        return runTestCommand({
            repoRoot,
            runSfCommand,
            runSfWithOutputCommand,
            targetOrg,
            testType
        });
    };
}

// コマンド実行時の終了コードとエラー表示をテスト種別にかかわらず揃える。
function startOrgTest(main, testLabel) {
    main()
        .then((status) => {
            process.exitCode = status;
        })
        .catch((error) => {
            console.error(`エラー: ${testLabel}テストを開始できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = { createOrgTestMain, startOrgTest };
