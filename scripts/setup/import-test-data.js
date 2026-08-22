// 実行コマンド: npm run setup:data
// 用途: import planに従って、Default Target Orgへ標準テストデータを投入する。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../internal/approval');
const { runSfWithOutput } = require('../internal/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../internal/target-org');
const { defaultPlan, parseArgs, prepareEntries, readPlan } = require('./internal/import-test-data-core');
const { runPreparedEntries } = require('./internal/import-test-data-runner');

// planとApexファイルを常にリポジトリ基準で解決する。
const repoRoot = path.resolve(__dirname, '../..');

// npm scriptから利用できるオプションと、安全な実行方法を表示する。
function printHelp(stdout = process.stdout) {
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

    if (args.help) {
        printHelp(stdout);
        return;
    }

    const writeLine = (message = '') => stdout.write(`${message}\n`);

    let targetOrg = '<default-target-org>';

    if (!args.dryRun) {
        // 通常実行はDefault Target Org、Scratch Orgセットアップは作成済みaliasだけを内部的に使用する。
        targetOrg = internalTargetOrg ?? getDefaultTargetOrg({ repoRoot, runSfCommand });

        // 実投入前に、確定した1組織の表示情報と種別を確認する。
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand, targetOrg });

        // Salesforce CLIの認証情報から必要な接続先情報だけを表示する。
        printTargetOrgInfo(orgInfo, writeLine);

        // 表示された接続組織を実行者が承認した場合だけ安全判定へ進む。
        const prompt = createApprovalPrompt(createPrompt);
        let targetAnswer;

        try {
            targetAnswer = await prompt.question('この接続組織で続行しますか？ [y/N]: ');
        } finally {
            prompt.close();
        }

        if (!isApproved(targetAnswer)) {
            writeLine('テストデータ投入を中止しました。');
            return;
        }

        // 本番相当の組織には、確認済みでもテストデータを投入しない。
        if (orgInfo.type === orgTypes.PRODUCTION) {
            throw new Error('本番環境へのテストデータ投入は許可されていません。');
        }
    }

    // planと参照するApexファイルを先に検証し、実行途中の構成エラーを避ける。
    const plan = readPlan({
        fileSystem,
        planPath: args.plan,
        repoRoot
    });
    const preparedEntries = prepareEntries({
        args,
        fileSystem,
        plan,
        repoRoot
    });
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
    run().catch((error) => {
        process.stderr.write(`エラー: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = { run };
