// 実行方法: ApexまたはFlowテストの実行入口から読み込む。
// 用途: Default Target Orgの確認、本番環境の追加確認、組織テスト開始を共通化する。

const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../../common/approval');
const { runSf, runSfWithOutput } = require('../../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../../common/target-org');
const { runAndMonitorTests, sfCommandTimeoutMs } = require('./test-runner');
const { parseSfJson } = require('./test-progress');

// Salesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// 対象組織でApexテストの並列実行が有効かをTooling APIから確認する。
function isParallelApexTestingEnabled({ runSfWithOutputCommand, targetOrg }) {
    // 並列実行を無効化する組織設定だけを取得する。
    const query = 'SELECT IsDisableParallelApexTestingEnabled FROM ApexSettings';
    // Salesforce CLIの成功JSONからTooling APIのquery結果を取り出す。
    const result = parseSfJson(
        runSfWithOutputCommand(
            ['data', 'query', '--use-tooling-api', '--query', query, '--target-org', targetOrg, '--json'],
            repoRoot
        ),
        'Apexテストの並列実行設定の取得'
    );

    // ApexSettingsを1件に特定できない応答から現在値を推測しない。
    if (!result || !Array.isArray(result.records) || result.records.length !== 1) {
        // 通知の正否を判断できない理由を呼び出し元へ返す。
        throw new Error('Apexテストの並列実行設定を一意に取得できませんでした。');
    }

    // API名どおりの「並列実行を無効化する」設定値を取得する。
    const setting = result.records[0].IsDisableParallelApexTestingEnabled;

    // 予期しない型を真偽値として読み替えない。
    if (typeof setting !== 'boolean') {
        // 設定取得失敗として通知処理へ渡す。
        throw new Error('Apexテストの並列実行設定を判定できませんでした。');
    }

    // Disable設定を反転し、利用者向けの「並列実行が有効」判定として返す。
    return !setting;
}

// テスト種別ごとの表示と識別子だけを受け取り、共通の実行処理を作成する。
function createOrgTestMain({ testLabel, testType, usage }) {
    // 呼び出し元のテスト種別を閉じ込めた非同期mainを返す。
    return async function main({
        argv = process.argv.slice(2),
        createPrompt,
        runSfCommand = runSf,
        runSfWithOutputCommand = runSfWithOutput,
        runTestCommand = runAndMonitorTests,
        writeLine = console.log,
        writeError = console.error
    } = {}) {
        // 対象組織はDefault Target Orgに固定し、別組織を示す引数を許可しない。
        if (argv.length !== 0) {
            // 引数指定が安全契約外であることを表示する。
            console.error('エラー: 対象組織はDefault Target Orgから取得するため、引数は指定できません。');
            // 対象テスト種別の正しい実行コマンドを案内する。
            console.error(`実行コマンド: ${usage}`);
            // Salesforce CLIを呼び出さず失敗終了を返す。
            return 1;
        }

        // 組織確認用CLIも停止し続けないよう、テスト実行と同じ2分上限を適用する。
        const runOrgInfoCommand = (args, workingDirectory) =>
            runSfWithOutputCommand(args, workingDirectory, undefined, undefined, sfCommandTimeoutMs);

        // テスト対象のDefault Target Orgと、認証済み組織情報を取得する。
        const targetOrg = getDefaultTargetOrg({ repoRoot, runSfCommand: runOrgInfoCommand });
        // aliasまたはusernameに一致する1組織の表示情報と種別を確定する。
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runOrgInfoCommand, targetOrg });

        // 実行者が接続先を確認できるよう、必要な組織情報だけを表示する。
        printTargetOrgInfo(orgInfo);

        // Apexでは既存の承認前に並列実行状態を知らせ、利用者が判断できるようにする。
        if (testType === 'apex') {
            try {
                if (isParallelApexTestingEnabled({ runSfWithOutputCommand: runOrgInfoCommand, targetOrg })) {
                    writeLine('注意: 対象組織ではApexテストの並列実行オプションが有効です。');
                }
            } catch (error) {
                // 通知用の設定確認はテスト開始を妨げず、確認できなかった事実だけを残す。
                writeError(
                    `注意: Apexテストの並列実行設定を確認できませんでした。テストは続行できます: ${error.message}`
                );
            }
        }

        // 接続先と環境別確認を同じ入力セッションで受け付ける。
        const prompt = createApprovalPrompt(createPrompt);

        // 承認入力中の例外でもpromptを閉じられるようfinallyで管理する。
        try {
            // 表示済みの組織で対象テストを開始してよいか明示確認する。
            const targetAnswer = await prompt.question(`この接続組織で${testLabel}テストを実行しますか？ [y/N]: `);

            // yまたはY以外の場合は組織テストを開始せず終了する。
            if (!isApproved(targetAnswer)) {
                // 接続先が承認されなかったことをテスト種別付きで明示する。
                console.log(`${testLabel}テストの実行を中止しました。`);
                // 正常な利用者中止として0を返す。
                return 0;
            }

            // 本番環境では、組織テストを開始する前に環境別の最終確認を行う。
            if (orgInfo.type === orgTypes.PRODUCTION) {
                // 本番環境であることを含む別の質問で、誤操作を再確認する。
                const environmentAnswer = await prompt.question(
                    `${orgInfo.typeLabel}です。${testLabel}テストを実行してよろしいですか？ [y/N]: `
                );

                // 本番環境での明示承認がない場合はテストを開始しない。
                if (!isApproved(environmentAnswer)) {
                    // 本番環境の承認がなかったことをテスト種別付きで明示する。
                    console.log(`${testLabel}テストの実行を中止しました。`);
                    // 正常な利用者中止として0を返す。
                    return 0;
                }
            }
        } finally {
            // 承認、中止、入力例外のすべてでreadlineを終了する。
            prompt.close();
        }

        // 指定された組織テストを開始し、完了まで進捗と結果を表示する。
        return runTestCommand({
            repoRoot,
            runSfCommand,
            targetOrg,
            testType
        });
    };
}

// コマンド実行時の終了コードとエラー表示をテスト種別にかかわらず揃える。
function startOrgTest(main, testLabel) {
    // 非同期mainの結果をCLIの終了コードへ反映する。
    main()
        .then((status) => {
            // テスト処理が返した終了コードをnpmへ伝える。
            process.exitCode = status;
        })
        .catch((error) => {
            // 予期しない例外はテスト種別を添えて利用者へ表示する。
            console.error(`エラー: ${testLabel}テストを開始できませんでした: ${error.message}`);
            // npmへ組織テスト開始の失敗を通知する。
            process.exitCode = 1;
        });
}

module.exports = { createOrgTestMain, isParallelApexTestingEnabled, startOrgTest };
