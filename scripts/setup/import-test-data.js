// 実行コマンド: npm run setup:data
// 用途: import planに従って、Default Target Orgへ標準テストデータを投入する。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../common/approval');
const { runSfWithOutput } = require('../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../common/target-org');
const { defaultPlan, parseArgs, prepareEntries, readPlan } = require('./internal/import-test-data-core');
const { runPreparedEntries } = require('./internal/import-test-data-runner');

// planとApexファイルを常にリポジトリ基準で解決する。
const repoRoot = path.resolve(__dirname, '../..');

// npm scriptから利用できるオプションと、安全な実行方法を表示する。
function printHelp(stdout = process.stdout) {
    // 利用可能なコマンド、安全制約、各オプションを1つの案内として表示する。
    stdout.write(`実行コマンド:
  npm run setup:data:dry-run
  npm run setup:data

オプション:
  --plan <path>           import plan JSONのパス。既定値: ${defaultPlan}
  --only <label>          指定したplan entryだけを実行する。
  --default-repeat <n>    repeat未指定のentryに適用する繰り返し回数。
  --repeat <n>            選択したentryへ適用する繰り返し回数。
  --dry-run               ローカルファイルを検証し、実行予定のsfコマンドを表示する。

実投入ではDefault Target Orgの情報と種別を表示し、承認されたSandbox、Scratch Org、Developer Editionだけへ投入します。
本番環境へのテストデータ投入は実行できません。
`);
}

// 引数とplanをローカル検証し、組織安全判定後にentry実行を制御する。
async function run({
    argv = process.argv.slice(2),
    createPrompt,
    fileSystem = fs,
    operatingSystem = os,
    runSfCommand = runSfWithOutput,
    stderr = process.stderr,
    stdout = process.stdout,
    targetOrg: internalTargetOrg
} = {}) {
    // 組織操作やファイル読込より前に、CLI引数を確定する。
    const args = parseArgs(argv);

    // help要求では後続の組織確認やplan読込を行わない。
    if (args.help) {
        // helpでは組織情報やplanを読み込まず、使用方法だけを表示する。
        printHelp(stdout);
        // help表示を成功扱いにし、呼び出し元へ不要なエラーを出さない。
        return;
    }

    // 注入されたstdoutへ常に改行付きで表示する共通関数を用意する。
    const writeLine = (message = '') => stdout.write(`${message}\n`);

    // planと参照するApexファイルを組織接続前に検証し、ローカル構成エラーを先に報告する。
    const plan = readPlan({
        fileSystem,
        planPath: args.plan,
        repoRoot
    });
    // 選択entryのApexソースと繰り返し回数も、実行承認を求める前に確定する。
    const preparedEntries = prepareEntries({
        args,
        fileSystem,
        plan,
        repoRoot
    });

    // dry-runでは組織設定を読まないため、表示専用のtarget org名を使用する。
    let targetOrg = '<default-target-org>';

    // 実投入時だけ接続先の確定と利用者承認を行う。
    if (!args.dryRun) {
        // 通常実行はDefault Target Org、Scratch Orgセットアップは作成済みaliasだけを内部的に使用する。
        targetOrg = internalTargetOrg ?? getDefaultTargetOrg({ repoRoot, runSfCommand });

        // 実投入前に、確定した1組織の表示情報と種別を確認する。
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand, targetOrg });

        // Salesforce CLIの認証情報から必要な接続先情報だけを表示する。
        printTargetOrgInfo(orgInfo, writeLine);

        // 本番相当の組織には承認を求めず、禁止条件として直ちに停止する。
        if (orgInfo.type === orgTypes.PRODUCTION) {
            throw new Error('本番環境へのテストデータ投入は許可されていません。');
        }

        // 表示された接続組織を実行者が承認した場合だけ実投入へ進む。
        const prompt = createApprovalPrompt(createPrompt);
        // finallyで確実にpromptを閉じられるよう回答を外側で保持する。
        let targetAnswer;

        // 回答取得中の例外でもpromptを閉じられるようfinallyで管理する。
        try {
            // 表示済みの組織へ投入してよいか明示回答を受け取る。
            targetAnswer = await prompt.question('この接続組織で続行しますか？ [y/N]: ');
        } finally {
            // readlineがプロセス終了を妨げないよう入力を閉じる。
            prompt.close();
        }

        // 明示承認以外では組織へデータを投入しない。
        if (!isApproved(targetAnswer)) {
            // 承認されなかったことを操作結果として明示する。
            writeLine('テストデータ投入を中止しました。');
            // 中止を失敗扱いせず、組織操作を行わない状態を維持する。
            return;
        }
    }
    // 検証済みentryだけをdry-runまたは実投入処理へ渡す。
    runPreparedEntries({
        dryRun: args.dryRun,
        fileSystem,
        operatingSystem,
        preparedEntries,
        repoRoot,
        runSfCommand,
        stderr,
        stdout,
        targetOrg
    });
}

// 利用者が修正すべき内容だけを簡潔に表示し、CLIへ失敗を返す。
if (require.main === module) {
    // Promise rejectionを利用者向けメッセージと失敗終了へ変換する。
    run().catch((error) => {
        // 利用者が修正すべき原因をスタックトレースなしで表示する。
        process.stderr.write(`エラー: ${error.message}\n`);
        // npmへデータ投入処理の失敗を通知する。
        process.exitCode = 1;
    });
}

// dry-runと安全判定を依存差し替えでテストできるようrunを公開する。
module.exports = { run };
