// 実行方法: import-test-data.jsとテストスクリプトから読み込む。
// 用途: 準備済みのテストデータ投入entryを順番に実行し、一時Apexファイルを後始末する。

const path = require('node:path');
const { buildSfArgs, extractSfSummary } = require('./import-test-data-core');

// planのlabelを、一時Apexファイルに使用できる名前へ変換する。
function getGeneratedFileName(label) {
    // plan label中の記号を置換し、OS間で扱える一時ファイル名に揃える。
    return `${label.replace(/[^a-z0-9-]/gi, '-')}.apex`;
}

// dry-runと実投入で同じ形式の実行内容を表示する。
function printStep({ cycle, dryRun, entry, repeatCount, sfArgs, sourcePaths, writeLine }) {
    // 複数回実行時だけ現在回数を表示し、単発実行のログを簡潔に保つ。
    const cycleSuffix = repeatCount > 1 ? ` (${cycle}/${repeatCount})` : '';

    // 実行種別、入力source、実行予定コマンドを同じ順序で表示する。
    writeLine(`[${dryRun ? 'dry-run' : 'import'}] ${entry.label}${cycleSuffix}`);
    writeLine(`sources: ${sourcePaths.join(' + ')}`);
    writeLine(`sf ${sfArgs.join(' ')}`);
}

// Salesforce CLIを実行し、seed処理の要約だけを見やすく表示する。
function executeSfCommand({ entry, repoRoot, runSfCommand, sfArgs, stderr, stdout, writeLine }) {
    // 準備済み引数でSalesforce CLIを同期実行する。
    const result = runSfCommand(sfArgs, repoRoot);

    // CLIを起動できない場合も、対象entryを示して後続処理を止める。
    if (result.error) {
        throw new Error(`sfコマンドを開始できませんでした（${entry.label}）: ${result.error.message}`);
    }

    // CLIが失敗した場合は元の出力を残し、次のplan entryへ進まない。
    if (result.status !== 0) {
        stdout.write(result.stdout || '');
        stderr.write(result.stderr || '');
        throw new Error(`sfコマンドが失敗しました（${entry.label}）。`);
    }

    // anonymous Apexのデバッグログから、投入結果として必要な行だけを取り出す。
    for (const line of extractSfSummary(`${result.stdout || ''}\n${result.stderr || ''}`)) {
        writeLine(line);
    }
}

// 準備済みentryをplan順に実行し、作成した一時ファイルを必ず削除する。
function runPreparedEntries({
    dryRun,
    fileSystem,
    operatingSystem,
    preparedEntries,
    repoRoot,
    runSfCommand,
    stderr,
    stdout,
    targetOrg
}) {
    // 注入されたstdoutへ常に改行付きで表示する共通関数を用意する。
    const writeLine = (message = '') => stdout.write(`${message}\n`);
    // 実投入で初めて作成した一時ディレクトリをfinallyから参照できるよう保持する。
    let temporaryDirectory = null;

    try {
        for (const prepared of preparedEntries) {
            // entryごとに衝突しにくいApexファイル名を生成する。
            const generatedFileName = getGeneratedFileName(prepared.entry.label);
            // dry-runでは仮想名、実投入では必要になった時点で作る一時パスを使用する。
            const generatedFilePath = dryRun
                ? `<generated:${generatedFileName}>`
                : path.join(
                      (temporaryDirectory ??= fileSystem.mkdtempSync(
                          path.join(operatingSystem.tmpdir(), 'salesforce-seed-')
                      )),
                      generatedFileName
                  );

            // dry-runでは一時ファイルを作らず、生成予定のファイル名だけを表示する。
            if (!dryRun) {
                fileSystem.writeFileSync(generatedFilePath, prepared.source, 'utf8');
            }

            // 表示と実行で共有するSalesforce CLI引数を1度だけ組み立てる。
            const sfArgs = buildSfArgs(generatedFilePath, targetOrg);

            // entryごとのrepeat回数だけ、同じApexを順番に実行する。
            for (let cycle = 1; cycle <= prepared.repeatCount; cycle += 1) {
                printStep({
                    cycle,
                    dryRun,
                    entry: prepared.entry,
                    repeatCount: prepared.repeatCount,
                    sfArgs,
                    sourcePaths: prepared.sourcePaths,
                    writeLine
                });

                if (!dryRun) {
                    // 実投入時だけSalesforce CLIを呼び出し、dry-runは表示で止める。
                    executeSfCommand({
                        entry: prepared.entry,
                        repoRoot,
                        runSfCommand,
                        sfArgs,
                        stderr,
                        stdout,
                        writeLine
                    });
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

module.exports = { runPreparedEntries };
