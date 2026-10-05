// 用途: 最新レコードを取得する2つのCLIの入力・組織確認・進捗・保存を共通管理する。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { clearLine, cursorTo } = require('node:readline');
const { createCsvSpool } = require('./csv-spool');
const { openCheckpoint } = require('./checkpoint');
const { CLI_TIMEOUT_MS, QUERY_ERROR_CODES } = require('./error-definitions');
const { createQueryClient } = require('./query-client');
const { runSfWithOutputAsync } = require('../../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, printTargetOrgInfo, orgTypes } = require('../../common/target-org');
const { createApprovalPrompt, isApproved } = require('../../common/approval');
const { collectRecords, parseFields, validateDescribe, RECORD_TYPE_ID_PATTERN } = require('./collector');

// 入力と実行上限を集約し、未知のオプションや余分な引数を拒否する。
function parseOptions(args, mode = 'records') {
    // CLIの標準パーサーで値の欠落と未知の指定を検出する。
    const { values } = parseArgs({
        args,
        options: {
            'target-org': { type: 'string' },
            'record-type-id': { type: 'string' },
            'created-before': { type: 'string' },
            object: { type: 'string', default: 'Account' },
            // 実行ディレクトリに依存せず、スクリプト付属の項目設定を使う。
            fields: { type: 'string', default: path.resolve(__dirname, '../config/fields.txt') },
            output: { type: 'string' },
            resume: { type: 'boolean', default: false },
            'check-auth': { type: 'boolean', default: false },
            ...(mode === 'records' ? { 'record-limit': { type: 'string', default: '2000' } } : {}),
            'fields-per-query': { type: 'string' },
            help: { type: 'boolean', default: false }
        }
    });
    // 再開先を曖昧にせず、元の出力名を明示してもらう。
    if (values.resume && (!values.output || values['check-auth'])) {
        // 接続確認だけの実行では再開データへ触れない。
        throw new Error('--resumeには元の--outputを指定してください。--check-authとは併用できません。');
    }
    // SOQLのオブジェクト位置には単一のAPI名だけを許可する。
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(values.object)) {
        // 入力を直接SOQLの式として実行しない。
        throw new Error('--objectにはオブジェクトAPI名を指定してください。');
    }
    // レコードタイプIDをSOQLへ安全に渡せる形式に限定する。
    if (values['record-type-id'] !== undefined && !RECORD_TYPE_ID_PATTERN.test(values['record-type-id'])) {
        // 空文字・式・異なる種類のIDを組織への接続前に拒否する。
        throw new Error('--record-type-idには012で始まる15桁または18桁のレコードタイプIDを指定してください。');
    }
    // 日付だけを受け付け、OSや接続ユーザーのタイムゾーンに依存させない。
    const beforeDate = values['created-before'];
    // 存在しない日付の自動繰り上がりを拒否する。
    if (
        beforeDate !== undefined &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(beforeDate) ||
            Number(beforeDate.slice(0, 4)) < 1700 ||
            !Number.isFinite(Date.parse(`${beforeDate}T00:00:00Z`)) ||
            new Date(`${beforeDate}T00:00:00Z`).toISOString().slice(0, 10) !== beforeDate)
    )
        throw new Error(
            '--created-beforeには1700年以降の実在する日付をYYYY-MM-DD形式で指定してください（日本時間・当日を含まない）。'
        );
    // 件数は整数だけを許可し、極端なレスポンスサイズを防ぐ。
    for (const [key, maximum] of [
        ...(mode === 'records' ? [['record-limit', 10000]] : []),
        ...(values['fields-per-query'] !== undefined ? [['fields-per-query', 10000]] : [])
    ]) {
        // 科学表記、負数、無限値、部分的な数値変換を拒否する。
        if (!/^\d+$/.test(values[key]) || Number(values[key]) < 1 || Number(values[key]) > maximum) {
            // 利用者が修正できる許容範囲を示す。
            throw new Error(`--${key}は1〜${maximum}の整数で指定してください。`);
        }
    }
    // 内部処理には検証済みの数値と統一したキー名を渡す。
    return {
        targetOrg: values['target-org'],
        recordTypeId: values['record-type-id'],
        // 日本時間の午前0時をSOQLへ渡せるUTC境界へ変換する。
        createdBefore: beforeDate === undefined ? undefined : new Date(`${beforeDate}T00:00:00+09:00`).toISOString(),
        createdBeforeDate: beforeDate,
        object: values.object,
        fields: values.fields,
        output: values.output,
        resume: values.resume,
        checkAuth: values['check-auth'],
        help: values.help,
        recordLimit: mode === 'record-fields-preview' ? 1 : Number(values['record-limit']),
        fieldsPerQuery: values['fields-per-query'] === undefined ? undefined : Number(values['fields-per-query'])
    };
}

// 既定値も明示し、別の端末でも同じ条件で再開できるコマンドにする。
function buildResumeCommand(options, mode, targetOrg, output, cwd, platform = process.platform) {
    // macOS/LinuxはPOSIX shell、WindowsはPowerShellの文字列規則で引用する。
    const quote = (value) => "'" + String(value).replace(/'/g, platform === 'win32' ? "''" : "'\\''") + "'";
    // 再開に必要な接続先・項目ファイル・出力を省略しない。
    const args = [
        '--target-org',
        targetOrg,
        '--object',
        options.object,
        '--fields',
        path.relative(cwd, path.resolve(cwd, options.fields)),
        '--output',
        path.relative(cwd, output)
    ];
    // 指定した絞り込み条件は再開時も引き継ぐ。
    if (options.recordTypeId) args.push('--record-type-id', options.recordTypeId);
    // 人が入力した日付をそのままCLI引数へ戻す。
    if (options.createdBeforeDate) args.push('--created-before', options.createdBeforeDate);
    // 横型の取得件数は既定値も固定する。
    if (mode === 'records') args.push('--record-limit', String(options.recordLimit));
    // 手動分割を指定していた場合は同じ設定で再開する。
    if (options.fieldsPerQuery) args.push('--fields-per-query', String(options.fieldsPerQuery));
    // 値だけを引用し、引数名は読みやすい表示を維持する。
    return `npm run sf:export:${mode} -- ${args.map((value, index) => (index % 2 ? quote(value) : value)).join(' ')} --resume`;
}

// 入力ファイルの障害を、修正方法が分かる診断へ変換する。
function readFieldNames(filePath) {
    // 読み込みの失敗と、読み込んだAPI名の検証を分ける。
    let content;
    // OSが返すエラー本文を表示せず、既知の原因だけを案内する。
    try {
        // ディレクトリのreadFile動作がOSで異なるため、先に種類を確認する。
        if (fs.statSync(filePath).isDirectory()) {
            // 読み取り時のディレクトリエラーと同じ診断へ揃える。
            throw Object.assign(new Error(), { code: 'EISDIR' });
        }
        // BOM・改行・API名の検証に使う文字列を読み込む。
        content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        // 診断文を固定し、OS由来のパスや追加情報を出力しない。
        const messages = new Map([
            [
                'ENOENT',
                '項目ファイルが見つかりません。scripts/record-export/config/fields.txtを用意するか、--fieldsでファイルの場所を指定してください。'
            ],
            ['ENOTDIR', '項目ファイルのパスが不正です。途中のフォルダー名と--fieldsの指定を確認してください。'],
            [
                'EISDIR',
                '項目ファイルにディレクトリが指定されています。--fieldsにはテキストファイルを指定してください。'
            ],
            [
                'EACCES',
                '項目ファイルを読み取る権限がありません。ファイルと親フォルダーの読み取り・アクセス権限を確認してください。'
            ],
            [
                'EPERM',
                '項目ファイルへのアクセスが許可されていません。ファイルの権限とOSのアクセス制限を確認してください。'
            ]
        ]);
        // 未知の原因は推測せず、入力ファイルの確認を促す。
        throw new Error(
            messages.get(error.code) ||
                '項目ファイルを読み込めませんでした。--fieldsの指定とファイルの状態を確認してください。'
        );
    }
    // 内容が不正な場合は、項目形式の既存の診断を維持する。
    return parseFields(content);
}

// CLIの生のエラー本文や認証情報を出力せず、安全な識別子へ変換する。
function parseCliResponse(response, mode) {
    // JSON解析失敗も元の応答を表示せず扱う。
    let body;
    // 空出力と不正JSONを区別し、本文を表示せず応答状態を記録する。
    let jsonState = response.stdout?.trim() ? 'JSON' : '空';
    // CLIが非0で返した構造化エラーも解析する。
    try {
        // stdout以外の出力は値や接続情報を含み得るため利用しない。
        body = JSON.parse(response.stdout || '{}') || {};
    } catch {
        // 不正なJSONはCLI失敗として後段で停止する。
        body = {};
        // CLIの形式違いを接続エラーと決めつけない。
        jsonState = '不正JSON';
    }
    // プロセスとJSONの両方が成功した場合だけ結果を採用する。
    if (!response.error && response.status === 0 && body.status === 0 && body.result !== undefined) {
        // トークンを返すCLIコマンドはこの入口から呼び出さない。
        return body.result;
    }
    // 検索固有のエラーは、固定した識別子だけを表示する。
    const queryCodes = [...QUERY_ERROR_CODES, 'FUNCTIONALITY_NOT_ENABLED'];
    // OSの既知のエラーコードを、表示可能な固定の識別子へ対応付ける。
    const processCodes = new Map([
        ['ENOBUFS', 'BUFFER_LIMIT'],
        ['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'BUFFER_LIMIT'],
        ['ENOENT', 'CLI_NOT_FOUND'],
        ['EACCES', 'CLI_ACCESS_DENIED'],
        ['EPERM', 'CLI_ACCESS_DENIED'],
        ['ETIMEDOUT', 'NETWORK_TIMEOUT'],
        ['ESOCKETTIMEDOUT', 'NETWORK_TIMEOUT'],
        ['ECONNRESET', 'NETWORK_ERROR'],
        ['ECONNREFUSED', 'NETWORK_ERROR'],
        ['ENOTFOUND', 'NETWORK_ERROR'],
        ['EAI_AGAIN', 'NETWORK_ERROR']
    ]);
    // 認証に関する既知の識別子だけを判定し、メッセージから推測しない。
    const authCodes = new Set([
        'INVALID_SESSION_ID',
        'NamedOrgNotFoundError',
        'NoAuthorizationError',
        'AuthInfoCreationError'
    ]);
    // ストリーム受信開始後の例外は、成功JSONとは別の標準エラーへ出る場合がある。
    const stderrCode = /(?:^|\n)\s*(?:code|errorCode):\s*['"]([A-Z][A-Z0-9_]+)['"]/m.exec(response.stderr || '')?.[1];
    // 自由文は転記せず、既知の通信コードだけを採用する。
    const streamCode = processCodes.has(stderrCode) ? stderrCode : undefined;
    // CLIが例外を包んだ場合も、自由文ではなく構造化された原因コードを確認する。
    const causes = [body, body.cause, body.cause?.cause];
    // 外側から順に既知の通信コードだけを採用する。
    const transportCode = causes
        .flatMap((cause) => [cause?.code, cause?.name])
        .find((value) => processCodes.has(value));
    // 通常JSON受信でHTTP失敗が返った場合は、応答本文の固定コードだけを取り出す。
    const apiCode = Array.isArray(body.result?.body) ? body.result.body[0]?.errorCode : undefined;
    // OS側の失敗がある場合は、途中までのJSONより優先する。
    let code = 'CLI_FAILED';
    // 子プロセスを起動・完了できなかった原因を分類する。
    if (response.error) {
        // 未知のOSエラーは全体失敗を維持する。
        code = processCodes.get(response.error.code) || 'CLI_FAILED';
        // execFileは既定の時間切れをSIGTERMによる強制終了として返す。
        if (code === 'CLI_FAILED' && response.error.killed && response.error.signal === 'SIGTERM') {
            // タイマーで終了した非同期呼び出しも既存の診断へ揃える。
            code = 'CLI_TIMEOUT';
        }
    } else if (response.status !== 0 && streamCode) {
        // CLIの非正常終了が確認できた場合だけ標準エラーの通信コードを使う。
        code = processCodes.get(streamCode);
    } else if (transportCode) {
        // CLI自身が返した通信エラーも、親プロセスの待ち時間制限と区別する。
        code = processCodes.get(transportCode);
    } else if (authCodes.has(body.name) || apiCode === 'INVALID_SESSION_ID') {
        // 認証失敗時は再試行せず、対象指定と既存認証の確認を促す。
        code = 'AUTH_FAILED';
    } else if (
        queryCodes.includes(body.name) ||
        queryCodes.includes(body.errorCode) ||
        queryCodes.includes(body.code) ||
        queryCodes.includes(apiCode)
    ) {
        // 検索固有の診断を表示して、未完成のCSVの保存を防ぐ。
        code = [body.name, body.errorCode, body.code, apiCode].find((candidate) => queryCodes.includes(candidate));
    }
    // 判別した原因に対して、認証操作を自動実行せず確認先を案内する。
    const guidance = new Map([
        [
            'CLI_NOT_FOUND',
            'CLIの起動に必要な実行ファイルが見つかりません。Salesforce CLIの導入状況とPATH、実行ディレクトリを確認してください。'
        ],
        [
            'CLI_ACCESS_DENIED',
            'CLIを起動する権限がありません。実行ファイルと実行ディレクトリの権限を確認してください。'
        ],
        ['CLI_TIMEOUT', `スクリプトのCLI待機上限（${CLI_TIMEOUT_MS / 1000}秒）を超えたため停止しました。`],
        [
            'NETWORK_TIMEOUT',
            `CLIの通信待ちがタイムアウトしました。スクリプトの${CLI_TIMEOUT_MS / 1000}秒制限とは別のエラーです。`
        ],
        ['NETWORK_ERROR', 'CLIの通信に失敗しました。ネットワーク・プロキシの状態を確認してください。'],
        [
            'QUERY_TIMEOUT',
            'Salesforce側で検索がタイムアウトしました。対象項目の検索条件・クエリプランを確認してください。'
        ],
        ['REQUEST_RUNNING_TOO_LONG', 'Salesforce側で処理時間の上限を超えました。検索条件を確認してください。'],
        ['REQUEST_LIMIT_EXCEEDED', 'SalesforceのAPI利用上限に達しました。利用状況を確認してください。'],
        ['AUTH_FAILED', '対象組織の認証を利用できません。--target-orgの指定と既存認証の状態を確認してください。'],
        [
            'BUFFER_LIMIT',
            mode === 'record-fields-preview'
                ? 'CLIの応答がサイズ上限を超えました。--fields-per-queryを小さくするか、項目ファイルの対象項目を減らしてください。'
                : 'CLIの応答がサイズ上限を超えました。必要に応じて--record-limitや--fields-per-queryを小さくしてください。'
        ]
    ]);
    // メッセージ本文やURLを除き、構造化された短い識別子だけを残す。
    const identifiers = [body.name, body.code, body.errorCode, response.error?.code, streamCode, transportCode].filter(
        (value) => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value)
    );
    // 未分類でも終了コードとCLI識別子から調査できるようにする。
    const details = [
        `終了コード: ${Number.isInteger(response.status) ? response.status : '情報なし'}`,
        `応答形式: ${jsonState}`,
        `標準エラー: ${response.stderr ? 'あり（本文非表示）' : 'なし'}`,
        ...(identifiers.length ? [] : ['識別子: 情報なし']),
        ...[...new Set(identifiers)].map((value) => `識別子: ${value}`),
        ['SIGTERM', 'SIGKILL', 'SIGINT'].includes(response.signal || response.error?.signal)
            ? `シグナル: ${response.signal || response.error.signal}`
            : ''
    ]
        .filter(Boolean)
        .join(' / ');
    // エラー識別子以外のCLI本文をログやCSVへ含めない。
    const error = new Error(
        `Salesforce CLIに失敗しました (${code})。${guidance.get(code) || 'CLIの失敗原因を特定できません。以下の診断情報を確認してください。'}${details ? ` / ${details}` : ''}`
    );
    // 呼び出し元が停止と補完スキップを区別できるよう原因を付与する。
    Object.assign(error, { code, diagnostic: details });
    // 不完全なレコードを正常な出力として扱わず停止する。
    throw error;
}

// Describeと検索のCLI呼び出しに、上限と共通の診断を適用する。
async function callSf(args, cwd, runner = runSfWithOutputAsync, mode = 'records', controls = {}) {
    // システム時計の変更に影響されない経過時間を測る。
    const started = performance.now();
    // 生本文を含めない診断へ変換してから経過時間を付ける。
    const timeout = Math.min(
        CLI_TIMEOUT_MS,
        controls.deadline === undefined ? CLI_TIMEOUT_MS : Math.ceil(controls.deadline - started)
    );
    // ページ送りや再分割で待機期限を延長しない。
    if (timeout <= 0) throw Object.assign(new Error('補完の待機上限に達しました。'), { code: 'SUPPLEMENT_TIMEOUT' });
    // CLIの終了を待ってから次の問い合わせへ進み、一時応答ファイルを競合させない。
    const response = await runner([...args, '--json'], cwd, undefined, 64 * 1024 * 1024, timeout);
    // 成功時には追加ログを出さない。
    try {
        // 各呼び出しに応答サイズと待ち時間の上限を設定する。
        return parseCliResponse(response, mode);
    } catch (error) {
        // 補完専用の短い期限を共通の2分制限と混同しない。
        if (error.code === 'CLI_TIMEOUT' && controls.deadline !== undefined) {
            // 具体的な待機上限は呼び出し側の進捗表示に合わせる。
            error.code = 'SUPPLEMENT_TIMEOUT';
            // 既定の2分制限を示す本文は置き換える。
            error.message = '補完の待機上限に達しました (SUPPLEMENT_TIMEOUT)。';
        }
        // 処理段階と経過時間を通知する。
        error.message += ` / 処理: ${args[0] === 'api' ? 'レコード検索' : args[0] === 'sobject' ? '項目定義の取得' : 'CLI呼び出し'} / CLI経過: ${((performance.now() - started) / 1000).toFixed(1)}秒`;
        // コードは維持して、分割や停止の既存判定へ渡す。
        throw error;
    }
}

// 入力検証、接続確認、収集、保存の順序を制御する。
async function main(
    args = process.argv.slice(2),
    {
        mode = 'records',
        cwd = process.cwd(),
        runner = runSfWithOutputAsync,
        writeLine = console.log,
        createPrompt,
        progressOutput = writeLine === console.log ? process.stdout : undefined
    } = {}
) {
    // 端末上の一時表示だけを追跡し、ログファイルには結果のみ残す。
    let pendingLine = false;
    // 確定表示や例外終了の前に、補完中の一行を消す。
    function clearProgress() {
        // 一時表示がなければ端末制御文字を送らない。
        if (!pendingLine) return;
        // 改行していない一時行の先頭へ戻る。
        cursorTo(progressOutput, 0);
        // 前の表示が長くても末尾を残さない。
        clearLine(progressOutput, 0);
        // 次の確定表示は通常の一行として扱う。
        pendingLine = false;
    }
    // 項目の結果は、処理中表示と同じ行で確定する。
    function writeResult(message) {
        // 検索エラーや再分割の案内でも一時表示を残さない。
        clearProgress();
        // 既存の出力先へ結果を一度だけ書く。
        writeLine(message);
    }
    // 補完中の項目はTTYだけで改行せず表示する。
    function updateLine(message) {
        // リダイレクト・非対話端末では結果行だけを記録する。
        if (!progressOutput?.isTTY) return;
        // 前の一時表示を置き換える。
        clearProgress();
        // 半角API名は1桁、日本語の状態表示は2桁として端末幅に収める。
        const maxWidth = Math.max(0, (progressOutput.columns || 80) - 1);
        // 表示幅を超える文字だけを切り詰め、折り返しによる二行表示を防ぐ。
        let width = 0;
        // 確定結果は省略せず、一時表示だけを端末幅に合わせる。
        let text = '';
        // API名と固定文言だけからなる進捗行を文字単位で確認する。
        for (const character of message) {
            // タブは次の8桁境界、日本語は2桁として折り返しを防ぐ。
            const size = character === '\t' ? 8 - (width % 8) : character.codePointAt(0) <= 0x7f ? 1 : 2;
            // 端末末尾で折り返す前に止める。
            if (width + size > maxWidth) break;
            // 表示できる部分だけを残す。
            text += character;
            // 次の文字の開始位置を更新する。
            width += size;
        }
        // 結果が返るまで同じ行に残し、タイマーは使わない。
        progressOutput.write(text);
        // 次の結果または例外で消せるようにする。
        pendingLine = true;
    }
    // 不正なオプションはCLIを起動する前に拒否する。
    const options = { ...parseOptions(args, mode), mode };
    // ヘルプは入力ファイルや認証を必要としない。
    if (options.help) {
        // オプションと認証確認だけを行う使い方を案内する。
        writeLine(
            `npm run sf:export:${mode} -- [--target-org ALIAS] [--object Account] [--fields scripts/record-export/config/fields.txt] [--record-type-id ID] [--created-before YYYY-MM-DD] ${mode === 'records' ? '[--record-limit 2000] ' : ''}[--fields-per-query NUMBER] [--output export-out/${mode}.csv] [--check-auth] [--resume]`
        );
        // ヘルプ表示は正常終了する。
        return 0;
    }
    // 認証確認専用モードでは項目ファイルを要求しない。
    const names = options.checkAuth ? [] : readFieldNames(path.resolve(cwd, options.fields));
    // 出力は既定でGit管理対象外のexport-outへ保存し、実行ごとに分ける。
    const output = path.resolve(cwd, options.output || `export-out/${mode}-${Date.now()}.csv`);
    // 途中CSVと再開記録を完成CSVと明確に分ける。
    const partialOutput = output.endsWith('.csv') ? `${output.slice(0, -4)}.partial.csv` : `${output}.partial.csv`;
    // 元の出力名から再開フォルダを一意に決める。
    const checkpointDirectory = `${output}.resume`;
    // 初回は他の実行の途中結果を上書きしない。
    if (!options.resume && !options.checkAuth && (fs.existsSync(partialOutput) || fs.existsSync(checkpointDirectory)))
        throw new Error('途中結果が存在します。元の条件に--resumeを追加するか、別の--outputを指定してください。');
    // 既存の出力や入力ファイルを上書きしない。
    if (!options.checkAuth && fs.existsSync(output)) {
        // 誤上書きを避け、別の出力名を指定してもらう。
        throw new Error('出力ファイルが既に存在します。別の--outputを指定してください。');
    }
    // 組織情報取得の失敗も、Describe・検索と同じ診断へ揃える。
    const runOrgCommand = async (command, directory) => {
        // 組織一覧と設定取得で、それぞれ必要な応答上限を維持する。
        const limit = command[0] === 'config' ? 1024 * 1024 : 16 * 1024 * 1024;
        // 共通の組織判定へ生のエラー応答を渡す前に検証する。
        const response = await runner(command, directory, undefined, limit, CLI_TIMEOUT_MS);
        // 生本文を表示しない共通診断で、失敗時はここで停止する。
        parseCliResponse(response, mode);
        // 成功した応答だけを既存の組織判定へ渡す。
        return response;
    };
    // 明示指定がなければ、この実行ディレクトリのdefault target orgを使う。
    let targetOrg = options.targetOrg;
    // 設定の取得を待ってから、共通処理で既定組織を検証する。
    if (!targetOrg) {
        // 非同期で取得した応答だけを同期の共通判定へ渡す。
        const configResponse = await runOrgCommand(['config', 'get', 'target-org', '--json'], cwd);
        // 既定組織の有無・一意性の判定は共通実装を使用する。
        targetOrg = getDefaultTargetOrg({ repoRoot: cwd, runSfCommand: () => configResponse });
    }
    // 既存の組織一覧を取得し、API接続の確認はDescribeで行う。
    const orgResponse = await runOrgCommand(['org', 'list', '--json', '--skip-connection-status'], cwd);
    // 取得済み一覧を共通の組織種別・一意性の判定へ渡す。
    const orgInfo = getTargetOrgInfo({ repoRoot: cwd, targetOrg, runSfCommand: () => orgResponse });
    // 既存の共通表示を使ってalias・username・URL・種別を利用者へ示す。
    printTargetOrgInfo(orgInfo, writeLine);
    // 確認中にaliasが変更されても、表示した実行ユーザーへ接続する。
    const resolvedTargetOrg = orgInfo.username;
    // 接続組織の表示と実行条件の表示を区切る。
    writeLine('');
    // 操作対象と明示的なレコードタイプの絞り込みだけを表示する。
    writeLine(
        `対象: ${options.object} / ${options.recordTypeId ? `レコードタイプID: ${options.recordTypeId}` : '参照可能な全レコード（レコードタイプ指定なし）'}`
    );
    // 補完元も同じレコードタイプへ限定することを確認入力前に知らせる。
    if (options.recordTypeId) {
        // 無条件の補完によるレコードタイプ混在を防ぐ仕様を明示する。
        writeLine('取得対象とプレビューの補完元を、指定したレコードタイプだけに限定します。');
    }
    // 確認前に日付境界とタイムゾーンを明示する。
    if (options.createdBefore) writeLine(`作成日: ${options.createdBeforeDate}より前（日本時間・当日を含まない）`);
    // 接続確認専用ではデータの取得承認を求めない。
    if (!options.checkAuth) {
        // 件数・補完の有無・用途を一行で確認できるようにする。
        writeLine(
            mode === 'record-fields-preview'
                ? '取得: 最新1件＋可能な空欄を補完 / デモ用値・縦型'
                : `取得: 最新から最大${options.recordLimit}件・補完なし / 実データ・横型`
        );
        // 項目ファイルと出力先を確認してから取得を開始できるようにする。
        writeLine(
            `項目ファイル: ${path.relative(cwd, path.resolve(cwd, options.fields))} / 指定項目数: ${names.length}`
        );
        // 実行時に作成するCSVの保存先を示す。
        writeLine(`出力先: ${path.relative(cwd, output)}`);
        // 出力先の表示と確認入力の間を空ける。
        writeLine('');
        // 共通の確認入力を使い、明示的なyまたはYだけを受け付ける。
        const prompt = createApprovalPrompt(createPrompt);
        // 中止や入力エラーでも端末の入力待ちを終了する。
        try {
            // Describeとレコード検索を始める前に、接続先と取得条件の確認を求める。
            const answer = await prompt.question('この接続組織と条件で項目値を取得しますか？ [y/N]: ');
            // Enterや否認では問い合わせとCSV生成を行わない。
            if (!isApproved(answer)) {
                // 利用者による中止を完了と区別して表示する。
                writeLine('項目値の取得を中止しました。');
                // 既存スクリプトと同じく正常な中止として返す。
                return 0;
            }
            // 本番環境では既存スクリプトと同様に追加確認する。
            if (orgInfo.type === orgTypes.PRODUCTION) {
                // 本番データをローカルへ保存する操作であることを明示する。
                const productionAnswer = await prompt.question(
                    '本番環境のデータをCSVへ保存します。実行してよろしいですか？ [y/N]: '
                );
                // 追加確認がない場合もデータ取得を開始しない。
                if (!isApproved(productionAnswer)) {
                    // 本番確認での中止を表示する。
                    writeLine('項目値の取得を中止しました。');
                    // 正常な中止として終了する。
                    return 0;
                }
            }
        } finally {
            // 承認・中止・例外のすべてで入力資源を解放する。
            prompt.close();
        }
    }
    // 一時ファイルからSOQLを渡し、Windowsのシェル記号解釈を避ける。
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-record-export-'));
    // CSV断片は出力先と同じファイルシステムへ保存する。
    let spoolDirectory;
    // 正常終了した場合だけ再開データを片付ける。
    let completed = false;
    // エラー時もロックを解除し、再開記録は保持する。
    let checkpoint;
    // 補完で続行したCLI失敗も、進捗に埋もれない終了時の診断として保持する。
    const cliFailures = new Map();
    // 成功・失敗を問わず一時ファイルを削除する。
    try {
        // Describeの成功により実際のAPI接続と対象オブジェクトへのアクセスを確認する。
        const describe = await callSf(
            ['sobject', 'describe', '--sobject', options.object, '--target-org', resolvedTargetOrg],
            cwd,
            runner,
            mode
        );
        // 定義・指定項目・検索条件を一度だけ検証し、正規化した項目を収集処理へ渡す。
        const fields = validateDescribe(describe, names, options);
        // 接続先の秘密情報を含めずに成功を知らせる。
        writeLine(`接続確認成功: ${describe.name} Describe取得済み`);
        // 接続確認だけの場合はレコードを検索しない。
        if (options.checkAuth) {
            // 認証成功を終了コードで返す。
            return 0;
        }
        // 応答完了を待ってページごとに検証する読み取り専用クライアントを用意する。
        const query = createQueryClient(
            temporaryDirectory,
            resolvedTargetOrg,
            async (command, controls) => {
                // 取得処理と同じ例外を返し、再試行やスキップの順序を変えない。
                try {
                    // レコード値や応答本文は診断へ保持しない。
                    return await callSf(command, cwd, runner, mode, controls);
                } catch (error) {
                    // この入口で安全化した診断だけを集計し、同一の失敗を大量表示しない。
                    if (error.diagnostic) {
                        // コードと終了状態が同じ失敗は一行へまとめる。
                        const detail = `${error.code} / ${error.diagnostic}`;
                        // 最終表示では発生回数も通知する。
                        cliFailures.set(detail, (cliFailures.get(detail) || 0) + 1);
                    }
                    // 値なしへ変換せず、既存の失敗処理へ渡す。
                    throw error;
                }
            },
            describe.urls?.sobject
        );
        // 一時CSVは公開先と同じ親ディレクトリへ置く。
        fs.mkdirSync(path.dirname(output), { recursive: true });
        // 既存認証の一覧から組織IDを照合し、別組織での再開を拒否する。
        const orgList = parseCliResponse(orgResponse, mode);
        // 同じusernameに対応する組織IDだけを使用する。
        const identities = [
            ...(orgList.nonScratchOrgs || []),
            ...(orgList.scratchOrgs || []),
            ...(orgList.sandboxes || [])
        ];
        // 再開データには認証トークンを含めない。
        const orgId = identities.find((org) => org.username === resolvedTargetOrg)?.orgId;
        // 識別できない組織で再開可能なデータを作らない。
        if (!orgId) throw new Error('再開用データの接続組織を識別できません。');
        // 取得結果に関係する条件だけを固定し、分割サイズは再開時に調整できる。
        checkpoint = openCheckpoint(
            checkpointDirectory,
            {
                version: 1,
                orgId,
                username: resolvedTargetOrg,
                object: options.object,
                mode,
                recordTypeId: options.recordTypeId || null,
                recordLimit: options.recordLimit,
                // 未指定では従来の再開記録と互換性を保つ。
                ...(options.createdBefore ? { createdBefore: options.createdBefore } : {}),
                fields: fields.map((field) => ({
                    name: field.name,
                    label: field.label,
                    type: field.type,
                    filterable: !!field.filterable,
                    invalid: !!field.invalid
                }))
            },
            options.resume
        );
        // 完成前のデータを利用者の指定ファイル名で公開しない。
        spoolDirectory = fs.mkdtempSync(path.join(path.dirname(output), '.record-export-'));
        // 値をメモリに蓄積せず、ID別に順次保存する。
        const spool = createCsvSpool(spoolDirectory, fields, mode, partialOutput);
        // 再開済み範囲も含め、補完スキップ件数を重複なく集計する。
        const skipped = new Set();
        // 保留の空欄と縮小サイズだけを復元し、完了済みの実値はメモリへ溜めない。
        const resumePending = new Map();
        // 保存済み断片からCSVを再構築し、前回の未確定書き込みは利用しない。
        await checkpoint.replay(async (...args) => {
            // 保存済みのスキップを正常な空欄として数え直さない。
            for (const [name, status] of args[5] || []) if (status.startsWith('SKIPPED_')) skipped.add(name);
            // 再試行で置換済みの項目は保留から外す。
            for (const field of args[1]) {
                // チェックポイントの最新の状態だけを採用する。
                resumePending.delete(field.name);
                // 未完了の保留は元の空欄と再試行サイズを保持する。
                if (args[5]?.get(field.name)?.startsWith('PENDING_RETRY_'))
                    resumePending.set(field.name, {
                        field,
                        value: args[2][field.name],
                        retryBatchSize: args[6].retryBatchSize
                    });
            }
            // 取得済みの値を再検索せずにそのまま保存する。
            await spool.append(...args);
            // 横型は完成したレコードだけを途中CSVへ表示する。
            if (mode === 'records') spool.publishPartial((checkpoint.selected || []).map((row) => row.Id));
        });
        // 復元できた場合だけ途中CSVを公開し、以降は順次追記する。
        spool.activatePartial();
        // 中断した場合にも利用者が再開元を識別できるようにする。
        writeLine(`途中保存: ${path.relative(cwd, partialOutput)}`);
        // 保存済み項目を再取得しないための位置と固定対象を渡す。
        options.resumeSelected = checkpoint.selected;
        // このMapは保存完了時に更新される。
        options.resumeOffsets = checkpoint.offsets;
        // 基準値の取得を終えている保留項目も最後の再試行へ渡す。
        options.resumePending = resumePending;
        // 再試行範囲ごとに途中CSVの行をまとめて更新する。
        options.onRetryBatch = () => spool.publishPartial(checkpoint.selected.map((row) => row.Id));
        // 対象IDを最初の値取得より前に確定する。
        options.onSelected = checkpoint.select;
        // 対象選択・適応分割・補完を共通の照合処理で実行する。
        const result = await collectRecords(
            describe,
            fields,
            options,
            query,
            writeResult,
            async (...args) => {
                // 再開可能な断片を先に確定し、CSV書き込みエラーでも値を保持する。
                checkpoint.append(...args);
                // 保存成功後にだけ今回のスキップを集計する。
                for (const [name, status] of args[5] || []) if (status.startsWith('SKIPPED_')) skipped.add(name);
                // 既存の項目順検証を通してCSVを追記する。
                await spool.append(...args);
                // 全項目が揃った横型の行を順に公開する。
                if (!args[6]?.replace) spool.publishPartial(checkpoint.selected.map((row) => row.Id));
            },
            updateLine
        );
        // 未確認項目の空セルも含め、指定位置がすべて揃ってから公開する。
        spool.finish(result.ids, output);
        // 完成CSVの公開後だけ、途中データを削除してよい状態にする。
        completed = true;
        // 対象なしと成功件数を区別し、レコードの実値は表示しない。
        writeLine(
            result.recordCount
                ? `${skipped.size ? '処理完了（補完スキップあり）' : '取得完了'}: ${result.recordCount}レコード / ${result.fields.length}項目`
                : '対象レコードがありません。ヘッダーのみ出力しました。'
        );
        // 保存場所を利用者へ伝える。
        writeLine(`出力: ${path.relative(cwd, output)}`);
        // 保存できても未確認項目があれば完全成功とは区別する。
        const invalidCount = fields.filter((field) => field.invalid).length;
        // 修正対象数を表示し、正常な空欄と取得できなかった空欄を区別する。
        if (invalidCount)
            writeLine(`項目エラー: ${invalidCount}項目を空欄で出力しました。API名と項目参照権限を確認してください。`);
        // 補完を断念した項目も含めて全行を書き終えたことを知らせる。
        if (skipped.size)
            writeLine(
                `補完スキップ: ${skipped.size}項目。CSVのStatusに理由を記録しました。全項目の処理と保存は完了しています。`
            );
        // 保存完了と全項目取得成功を区別し、未取得があれば警告終了とする。
        return invalidCount || skipped.size ? 1 : 0;
    } finally {
        // 検索失敗時も一時表示を消し、後続のエラー表示を独立させる。
        clearProgress();
        // 通常終了・補完スキップ・中断のいずれでも診断を改行付きで残す。
        for (const [detail, count] of cliFailures) writeLine(`CLI失敗の診断（${count}回）: ${detail}`);
        // 認証失敗時にもSOQLの一時ファイルを残さない。
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        // 中断後も再開記録と途中CSVは保持し、ロックだけ解放する。
        if (checkpoint) {
            // 完成品の公開成功時だけ保存途中のファイルを片付ける。
            if (completed) {
                // 実行中ロックを残したまま削除し、後片付け中の再開を防ぐ。
                fs.rmSync(checkpointDirectory, { recursive: true, force: true });
                // 完成ファイルとの取り違えを防ぐ。
                fs.rmSync(partialOutput, { force: true });
            } else {
                // 異常終了ではロックだけを外し、再開データを保持する。
                checkpoint.close();
                // 元の条件を維持して再開する操作を案内する。
                writeLine('途中結果を保持しました。再開コマンド:');
                // 再開条件を手作業で組み直さず実行できるようにする。
                writeLine(buildResumeCommand(options, mode, resolvedTargetOrg, output, cwd));
            }
        }
        // CSV作成用の作業領域は再開記録と別なので削除できる。
        if (spoolDirectory) fs.rmSync(spoolDirectory, { recursive: true, force: true });
    }
}

module.exports = { main, parseOptions, callSf, buildResumeCommand };
