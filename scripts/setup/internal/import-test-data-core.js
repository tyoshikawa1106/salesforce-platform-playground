// 実行方法: import-test-data.jsとテストスクリプトから読み込む。
// 用途: テストデータ投入の引数、plan、Apexソース、Salesforce CLI引数を組み立てる。

const path = require('node:path');

// 標準データセットアップで使用する既定plan。
const defaultPlan = 'scripts/setup/plans/import-test-data-plan.json';

// 値を必要とするオプションの次の引数を読み取る。
function readOptionValue(argv, index, option) {
    // 値を取るオプションの直後だけを対応する値として読む。
    const value = argv[index + 1];

    // 値の欠落や次のオプション名を値として受け付けない。
    if (value === undefined || value.startsWith('-')) {
        // 不足しているオプション名を含めて利用者へ通知する。
        throw new Error(`${option}には値が必要です。`);
    }

    // 検証済みの文字列を呼び出し元へ返す。
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
        // 現在位置の引数を各オプション判定へ使用する。
        const arg = argv[index];

        // dry-run flagを組織操作なしの検証モードへ変換する。
        if (arg === '--dry-run') {
            // dry-runは値を取らないflagとして有効化する。
            args.dryRun = true;
            // 値なしflagとして確定したため、他のオプション判定を重ねない。
            continue;
        }

        // 長短どちらのhelp flagも同じ案内表示へ変換する。
        if (arg === '--help' || arg === '-h') {
            // 長短どちらのhelp指定も同じ状態へ変換する。
            args.help = true;
            // help要求を通常のオプション値として再解釈しない。
            continue;
        }

        // --planだけが既定planの参照先を置き換えられるよう分岐する。
        if (arg === '--plan') {
            // plan指定を保存し、値の位置を次のloopで再解釈しない。
            args.plan = readOptionValue(argv, index, arg);
            // planのパスを独立した引数として再解釈しない。
            index += 1;
            // 確定済みのplan指定に他のオプション判定を重ねない。
            continue;
        }

        // entry固有値がない場合の回数だけを上書きできるよう分岐する。
        if (arg === '--default-repeat') {
            // 数値変換後の妥当性はentry準備時に共通検証する。
            args.defaultRepeat = Number(readOptionValue(argv, index, arg));
            // 回数の値を未対応引数として誤検出しない。
            index += 1;
            // 確定済みの既定回数に他のオプション判定を重ねない。
            continue;
        }

        // plan全体ではなく指定labelだけを選べるよう分岐する。
        if (arg === '--only') {
            // labelはplan読込後に実在するentryと照合する。
            args.only = readOptionValue(argv, index, arg);
            // labelの値を独立した引数として再解釈しない。
            index += 1;
            // 確定済みの対象指定に他のオプション判定を重ねない。
            continue;
        }

        // 選択entryの回数を最優先で上書きできるよう分岐する。
        if (arg === '--repeat') {
            // 選択entryへ優先適用する回数として数値化する。
            args.repeat = Number(readOptionValue(argv, index, arg));
            // 回数の値を未対応引数として誤検出しない。
            index += 1;
            // 確定済みの個別回数に他のオプション判定を重ねない。
            continue;
        }

        // 対応していない引数を無視せず実行前に拒否する。
        throw new Error(`未対応の引数が指定されました: ${arg}`);
    }

    // すべての引数を解釈した設定だけを後続処理へ返す。
    return args;
}

// repeat回数として使用する値が正の整数であることを確認する。
function assertPositiveInteger(value, label) {
    // 0、負数、小数、NaNを繰り返し回数として受け付けない。
    if (!Number.isInteger(value) || value < 1) {
        // 対象設定名を含めて修正すべき値の条件を通知する。
        throw new Error(`${label}には正の整数を指定してください。`);
    }
}

// planから指定された相対パスを、リポジトリ外へ出ない絶対パスに変換する。
function resolveInsideRepo(repoRoot, relativePath) {
    // path.resolveへ渡す前に、plan由来の値を空でない文字列へ限定する。
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
        // 空値や文字列以外をリポジトリルートとして誤解釈しない。
        throw new Error('リポジトリからの相対パスを空でない文字列として指定してください。');
    }

    // 正規化した絶対パスとリポジトリからの相対位置を求める。
    const absolutePath = path.resolve(repoRoot, relativePath);
    // 正規化後の位置がrepoRoot配下かを判定する相対パスを求める。
    const relative = path.relative(repoRoot, absolutePath);

    // ../や絶対パスによってリポジトリ外を参照するplanを拒否する。
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        // リポジトリ外のファイルを読み込む前に安全側で停止する。
        throw new Error(`リポジトリ内のパスを指定してください: ${relativePath}`);
    }

    // リポジトリ内と確認できた絶対パスだけを返す。
    return absolutePath;
}

// import planを読み込み、処理に必要な最小構造を確認する。
function readPlan({ fileSystem, planPath, repoRoot }) {
    // plan自体もリポジトリ内に限定してからJSONとして読み込む。
    const absolutePlanPath = resolveInsideRepo(repoRoot, planPath);
    // UTF-8のplanを実行定義オブジェクトへ変換する。
    const plan = JSON.parse(fileSystem.readFileSync(absolutePlanPath, 'utf8'));

    // 実行対象が1件以上あるimports配列だけを受け付ける。
    if (!Array.isArray(plan.imports) || plan.imports.length === 0) {
        // 空または不正なplanで組織操作を開始しない。
        throw new Error('import planのimportsには1件以上のentryが必要です。');
    }

    // --onlyでentryを特定できるよう、labelの重複を許可しない。
    const labels = plan.imports.map((entry) => entry.label).filter(Boolean);
    // Set化後に件数が減る場合は同じlabelが複数存在すると判定する。
    if (new Set(labels).size !== labels.length) {
        // --onlyの対象が曖昧になるplanを拒否する。
        throw new Error('import planのentry labelは重複できません。');
    }

    // 最小構造を検証したplanをentry準備へ返す。
    return plan;
}

// --onlyが指定された場合は、該当するplan entryだけを実行対象にする。
function getSelectedEntries(plan, only) {
    // --only未指定時はplan順を保ち、指定時は完全一致するlabelへ絞る。
    const entries = only ? plan.imports.filter((entry) => entry.label === only) : plan.imports;

    // --only指定時に一致するentryがあることを確認する。
    if (entries.length === 0) {
        // 指定labelを含めてplan修正または引数修正を促す。
        throw new Error(`--only ${only}に一致するimport plan entryがありません。`);
    }

    // plan順を維持した選択entryを返す。
    return entries;
}

// entryが単独実行か、共通preambleとの合成対象かを判定する。
function getSourcePaths(plan, entry) {
    // 実行内容を特定する3項目が揃っているかをまとめて確認する。
    const requiredKeys = ['label', 'operation', 'file'];
    // 値がない必須keyだけをエラー表示用に収集する。
    const missingKeys = requiredKeys.filter((key) => !entry[key]);

    // 必須keyが1件でも欠けるentryを実行対象にしない。
    if (missingKeys.length > 0) {
        // 不足keyをまとめて表示しplan修正を促す。
        throw new Error(`plan entryに必須項目がありません: ${missingKeys.join(', ')}`);
    }

    // 現在対応するanonymous Apex以外のoperationを拒否する。
    if (entry.operation !== 'apex') {
        // entry labelと未対応値を含めて設定誤りを明示する。
        throw new Error(`${entry.label}に未対応のoperationが指定されています: ${entry.operation}`);
    }

    // standaloneはファイル単体、それ以外はpreambleを先頭に結合する。
    if (entry.standalone) {
        // 単独実行entryでは固有Apexファイルだけを返す。
        return [entry.file];
    }

    // 合成対象entryには共通preamble指定を必須にする。
    if (!plan.preamble) {
        // 対象entryを含めて不足しているplan設定を通知する。
        throw new Error(`import planに${entry.label}用のpreambleを指定してください。`);
    }

    // 共通preamble、entry固有Apexの実行順でパスを返す。
    return [plan.preamble, entry.file];
}

// plan entryが参照するApexを読み込み、実行用の1つのソースへ合成する。
function readApexSource({ entry, fileSystem, plan, repoRoot }) {
    // standalone指定に応じて、合成するApexファイルの順序を確定する。
    const sourcePaths = getSourcePaths(plan, entry);
    // 各ファイルを検証してから、末尾空白を除いたソースだけを保持する。
    const sourceParts = sourcePaths.map((sourcePath) => {
        // plan記載のパスをリポジトリ内の絶対パスへ変換する。
        const absolutePath = resolveInsideRepo(repoRoot, sourcePath);

        // planが参照するすべてのApexファイルの存在を確認する。
        if (!fileSystem.existsSync(absolutePath)) {
            // 不足ファイルと対象entryを含めてplan修正を促す。
            throw new Error(`${entry.label}が参照するApexファイルが見つかりません: ${sourcePath}`);
        }

        // 空ファイルを実行対象に含めず、planまたはファイルの修正を促す。
        const content = fileSystem.readFileSync(absolutePath, 'utf8').trim();

        // 空白を除いたApex本文が1文字以上あることを確認する。
        if (content.length === 0) {
            // 空ファイルのパスを含めて実行前に停止する。
            throw new Error(`Apexファイルを空にはできません: ${sourcePath}`);
        }

        // 検証済みのApex本文を合成対象として返す。
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
    // Salesforce CLI出力を行へ分割し、seed処理のDEBUG集計だけを返す。
    return output
        .split(/\r?\n/)
        .filter((line) => /USER_DEBUG\|.*\|(DEBUG)\|(Seed run key|Created records|Skipped records):/.test(line))
        .map((line) => line.replace(/^.*\|DEBUG\|/, ''));
}

// 選択されたentryを検証し、ソースとrepeat回数を実行可能な形へ揃える。
function prepareEntries({ args, fileSystem, plan, repoRoot }) {
    // CLI指定、plan指定、既定値の順で共通repeat回数を決定する。
    const defaultRepeat = args.defaultRepeat ?? plan.repeat ?? 1;

    // 共通既定回数を各entryへ適用する前に検証する。
    assertPositiveInteger(defaultRepeat, '既定の繰り返し回数');

    // 選択した各entryを実行順のまま準備済みオブジェクトへ変換する。
    return getSelectedEntries(plan, args.only).map((entry) => {
        // --repeatは個別entryやplanのrepeat指定より優先する。
        const repeatCount = args.repeat ?? entry.repeat ?? defaultRepeat;

        // entryへ適用する最終的な繰り返し回数を検証する。
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
