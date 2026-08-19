// 実行コマンド: npm run setup:data:standard -- --target-org <alias>
// 用途: import planに従って、指定したTarget Orgへ標準テストデータを投入する。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { runSfWithOutput } = require('../internal/run-command');
const { getTargetOrgInfo, isApproved, orgTypes, printTargetOrgInfo } = require('../internal/target-org');
const {
    buildSfArgs,
    defaultPlan,
    extractSfSummary,
    parseArgs,
    prepareEntries,
    readPlan
} = require('./internal/import-test-data-core');

// planとApexファイルを常にリポジトリ基準で解決する。
const repoRoot = path.resolve(__dirname, '../..');

// npm scriptから利用できるオプションと、安全な実行方法を表示する。
function printHelp() {
    process.stdout.write(`実行コマンド:
  npm run setup:data:standard:dry-run
  npm run setup:data:standard -- --target-org <alias>

オプション:
  --plan <path>           import plan JSONのパス。既定値: ${defaultPlan}
  --only <label>          指定したplan entryだけを実行する。
  --default-repeat <n>    repeat未指定のentryに適用する繰り返し回数。
  --repeat <n>            選択したentryへ適用する繰り返し回数。
  --target-org, -o        実投入先のSalesforce組織alias。
  --dry-run               ローカルファイルを検証し、実行予定のsfコマンドを表示する。

実投入では接続組織の情報と種別を表示し、承認されたSandbox、Scratch Org、Developer Editionだけへ投入します。
本番環境へのテストデータ投入は実行できません。
`);
}

// 進捗表示の改行方法を1か所へ揃える。
function writeLine(message = '') {
    process.stdout.write(`${message}\n`);
}

// dry-runと実投入で同じ形式の実行内容を表示する。
function printStep({ cycle, dryRun, entry, repeatCount, sfArgs, sourcePaths }) {
    const cycleSuffix = repeatCount > 1 ? ` (${cycle}/${repeatCount})` : '';

    writeLine(`[${dryRun ? 'dry-run' : 'import'}] ${entry.label}${cycleSuffix}`);
    writeLine(`sources: ${sourcePaths.join(' + ')}`);
    writeLine(`sf ${sfArgs.join(' ')}`);
}

// Salesforce CLIを実行し、seed処理の要約だけを見やすく表示する。
function executeSfCommand(entry, sfArgs, runSfCommand) {
    const result = runSfCommand(sfArgs, repoRoot);

    // CLIを起動できない場合も、対象entryを示して後続処理を止める。
    if (result.error) {
        throw new Error(`sfコマンドを開始できませんでした（${entry.label}）: ${result.error.message}`);
    }

    // CLIが失敗した場合は元の出力を残し、次のplan entryへ進まない。
    if (result.status !== 0) {
        process.stdout.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        throw new Error(`sfコマンドが失敗しました（${entry.label}）。`);
    }

    // anonymous Apexのデバッグログから、投入結果として必要な行だけを取り出す。
    for (const line of extractSfSummary(`${result.stdout || ''}\n${result.stderr || ''}`)) {
        writeLine(line);
    }
}

// planのlabelを、一時Apexファイルに使用できる名前へ変換する。
function getGeneratedFileName(label) {
    return `${label.replace(/[^a-z0-9-]/gi, '-')}.apex`;
}

async function run({
    argv = process.argv.slice(2),
    createPrompt,
    fileSystem = fs,
    operatingSystem = os,
    runSfCommand = runSfWithOutput
} = {}) {
    // 組織操作やファイル読込より前に、CLI引数を確定する。
    const args = parseArgs(argv);

    if (args.help) {
        printHelp();
        return;
    }

    // 実投入では対象組織の明示を必須とし、default target orgへの誤投入を防ぐ。
    if (!args.dryRun && !args.targetOrg) {
        throw new Error(
            '実投入には--target-org <alias>の指定が必要です。ローカル確認には--dry-runを使用してください。'
        );
    }

    if (!args.dryRun) {
        // 実投入前に、指定された1組織の表示情報と種別を確認する。
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand, targetOrg: args.targetOrg });

        // Salesforce CLIの認証情報から必要な接続先情報だけを表示する。
        printTargetOrgInfo(orgInfo, writeLine);

        // 表示された接続組織を実行者が承認した場合だけ安全判定へ進む。
        const prompt = createPrompt?.() ?? createInterface({ input: process.stdin, output: process.stdout });
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
    const targetOrg = args.targetOrg || '<target-org>';
    let temporaryDirectory = null;

    try {
        // planの順序を維持し、entryごとに実行可能なanonymous Apexを準備する。
        for (const prepared of preparedEntries) {
            const generatedFileName = getGeneratedFileName(prepared.entry.label);
            const generatedFilePath = args.dryRun
                ? `<generated:${generatedFileName}>`
                : path.join(
                      (temporaryDirectory ??= fileSystem.mkdtempSync(
                          path.join(operatingSystem.tmpdir(), 'salesforce-seed-')
                      )),
                      generatedFileName
                  );

            // dry-runでは一時ファイルを作らず、生成予定のファイル名だけを表示する。
            if (!args.dryRun) {
                fileSystem.writeFileSync(generatedFilePath, prepared.source, 'utf8');
            }

            const sfArgs = buildSfArgs(generatedFilePath, targetOrg);

            // entryごとのrepeat回数だけ、同じApexを順番に実行する。
            for (let cycle = 1; cycle <= prepared.repeatCount; cycle += 1) {
                printStep({
                    cycle,
                    dryRun: args.dryRun,
                    entry: prepared.entry,
                    repeatCount: prepared.repeatCount,
                    sfArgs,
                    sourcePaths: prepared.sourcePaths
                });

                // dry-runでは実行予定を表示するだけで、Salesforce CLIを呼び出さない。
                if (!args.dryRun) {
                    executeSfCommand(prepared.entry, sfArgs, runSfCommand);
                }
            }
        }
    } finally {
        // 成功・失敗にかかわらず、合成したanonymous Apexをローカルに残さない。
        if (temporaryDirectory) {
            fileSystem.rmSync(temporaryDirectory, { force: true, recursive: true });
        }
    }
}

// 利用者が修正すべき内容だけを簡潔に表示し、CLIへ失敗を返す。
if (require.main === module) {
    run().catch((error) => {
        process.stderr.write(`エラー: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = { run };
