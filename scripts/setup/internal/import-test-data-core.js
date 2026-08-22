// 実行方法: import-test-data.jsとテストスクリプトから読み込む。
// 用途: テストデータ投入の引数、plan、Apexソース、Salesforce CLI引数を組み立てる。

const path = require('node:path');

// 標準データセットアップで使用する既定plan。
const defaultPlan = 'scripts/setup/plans/import-test-data-plan.json';

// 値を必要とするオプションの次の引数を読み取る。
function readOptionValue(argv, index, option) {
    // 値を取るオプションの直後だけを対応する値として読む。
    const value = argv[index + 1];

    if (value === undefined || value.startsWith('-')) {
        throw new Error(`${option}には値が必要です。`);
    }

    return value;
}

// CLI引数を後続処理で扱いやすい設定へ変換する。
function parseArgs(argv) {
    // 未指定オプションを後続処理で判定しやすい既定状態へ揃える。
    const args = {
        defaultRepeat: null,
        dryRun: false,
        help: false,
        only: null,
        plan: defaultPlan,
        repeat: null
    };

    // オプション値を読み飛ばしながら、指定された順に引数を解釈する。
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--dry-run') {
            // dry-runは値を取らないflagとして有効化する。
            args.dryRun = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            // 長短どちらのhelp指定も同じ状態へ変換する。
            args.help = true;
            continue;
        }

        if (arg === '--plan') {
            // plan指定を保存し、値の位置を次のloopで再解釈しない。
            args.plan = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }

        if (arg === '--default-repeat') {
            // 数値変換後の妥当性はentry準備時に共通検証する。
            args.defaultRepeat = Number(readOptionValue(argv, index, arg));
            index += 1;
            continue;
        }

        if (arg === '--only') {
            // labelはplan読込後に実在するentryと照合する。
            args.only = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }

        if (arg === '--repeat') {
            // 選択entryへ優先適用する回数として数値化する。
            args.repeat = Number(readOptionValue(argv, index, arg));
            index += 1;
            continue;
        }

        throw new Error(`未対応の引数が指定されました: ${arg}`);
    }

    // すべての引数を解釈した設定だけを後続処理へ返す。
    return args;
}

// repeat回数として使用する値が正の整数であることを確認する。
function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${label}には正の整数を指定してください。`);
    }
}

// planから指定された相対パスを、リポジトリ外へ出ない絶対パスに変換する。
function resolveInsideRepo(repoRoot, relativePath) {
    // path.resolveへ渡す前に、plan由来の値を空でない文字列へ限定する。
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
        throw new Error('リポジトリからの相対パスを空でない文字列として指定してください。');
    }

    // 正規化した絶対パスとリポジトリからの相対位置を求める。
    const absolutePath = path.resolve(repoRoot, relativePath);
    const relative = path.relative(repoRoot, absolutePath);

    // ../や絶対パスによってリポジトリ外を参照するplanを拒否する。
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`リポジトリ内のパスを指定してください: ${relativePath}`);
    }

    return absolutePath;
}

// import planを読み込み、処理に必要な最小構造を確認する。
function readPlan({ fileSystem, planPath, repoRoot }) {
    // plan自体もリポジトリ内に限定してからJSONとして読み込む。
    const absolutePlanPath = resolveInsideRepo(repoRoot, planPath);
    const plan = JSON.parse(fileSystem.readFileSync(absolutePlanPath, 'utf8'));

    if (!Array.isArray(plan.imports) || plan.imports.length === 0) {
        throw new Error('import planのimportsには1件以上のentryが必要です。');
    }

    // --onlyでentryを特定できるよう、labelの重複を許可しない。
    const labels = plan.imports.map((entry) => entry.label).filter(Boolean);
    if (new Set(labels).size !== labels.length) {
        throw new Error('import planのentry labelは重複できません。');
    }

    return plan;
}

// --onlyが指定された場合は、該当するplan entryだけを実行対象にする。
function getSelectedEntries(plan, only) {
    // --only未指定時はplan順を保ち、指定時は完全一致するlabelへ絞る。
    const entries = only ? plan.imports.filter((entry) => entry.label === only) : plan.imports;

    if (entries.length === 0) {
        throw new Error(`--only ${only}に一致するimport plan entryがありません。`);
    }

    return entries;
}

// entryが単独実行か、共通preambleとの合成対象かを判定する。
function getSourcePaths(plan, entry) {
    // 実行内容を特定する3項目が揃っているかをまとめて確認する。
    const requiredKeys = ['label', 'operation', 'file'];
    const missingKeys = requiredKeys.filter((key) => !entry[key]);

    if (missingKeys.length > 0) {
        throw new Error(`plan entryに必須項目がありません: ${missingKeys.join(', ')}`);
    }

    if (entry.operation !== 'apex') {
        throw new Error(`${entry.label}に未対応のoperationが指定されています: ${entry.operation}`);
    }

    // standaloneはファイル単体、それ以外はpreambleを先頭に結合する。
    if (entry.standalone) {
        return [entry.file];
    }

    if (!plan.preamble) {
        throw new Error(`import planに${entry.label}用のpreambleを指定してください。`);
    }

    return [plan.preamble, entry.file];
}

// plan entryが参照するApexを読み込み、実行用の1つのソースへ合成する。
function readApexSource({ entry, fileSystem, plan, repoRoot }) {
    // standalone指定に応じて、合成するApexファイルの順序を確定する。
    const sourcePaths = getSourcePaths(plan, entry);
    // 各ファイルを検証してから、末尾空白を除いたソースだけを保持する。
    const sourceParts = sourcePaths.map((sourcePath) => {
        const absolutePath = resolveInsideRepo(repoRoot, sourcePath);

        if (!fileSystem.existsSync(absolutePath)) {
            throw new Error(`${entry.label}が参照するApexファイルが見つかりません: ${sourcePath}`);
        }

        // 空ファイルを実行対象に含めず、planまたはファイルの修正を促す。
        const content = fileSystem.readFileSync(absolutePath, 'utf8').trim();

        if (content.length === 0) {
            throw new Error(`Apexファイルを空にはできません: ${sourcePath}`);
        }

        return content;
    });

    // ファイル間に空行を入れ、anonymous Apexとして1つのソースへ合成する。
    return {
        source: `${sourceParts.join('\n\n')}\n`,
        sourcePaths
    };
}

// 合成したanonymous Apexを指定組織で実行するSalesforce CLI引数を作る。
function buildSfArgs(absoluteFilePath, targetOrg) {
    // anonymous Apexファイルと対象組織を明示した引数配列を返す。
    return ['apex', 'run', '--file', absoluteFilePath, '--target-org', targetOrg];
}

// Salesforce CLIの出力から、seed処理が明示的に出力した集計行だけを抽出する。
function extractSfSummary(output) {
    return output
        .split(/\r?\n/)
        .filter((line) => /USER_DEBUG\|.*\|(DEBUG)\|(Seed run key|Created records|Skipped records):/.test(line))
        .map((line) => line.replace(/^.*\|DEBUG\|/, ''));
}

// 選択されたentryを検証し、ソースとrepeat回数を実行可能な形へ揃える。
function prepareEntries({ args, fileSystem, plan, repoRoot }) {
    // CLI指定、plan指定、既定値の順で共通repeat回数を決定する。
    const defaultRepeat = args.defaultRepeat ?? plan.repeat ?? 1;

    assertPositiveInteger(defaultRepeat, '既定の繰り返し回数');

    return getSelectedEntries(plan, args.only).map((entry) => {
        // --repeatは個別entryやplanのrepeat指定より優先する。
        const repeatCount = args.repeat ?? entry.repeat ?? defaultRepeat;

        assertPositiveInteger(repeatCount, `${entry.label}の繰り返し回数`);
        // 各entryへ検証済み回数と合成済みApexを対応付ける。
        return {
            entry,
            repeatCount,
            ...readApexSource({ entry, fileSystem, plan, repoRoot })
        };
    });
}

module.exports = {
    buildSfArgs,
    defaultPlan,
    extractSfSummary,
    getSourcePaths,
    parseArgs,
    prepareEntries,
    readPlan,
    resolveInsideRepo
};
