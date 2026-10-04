// 用途: 最新レコードを取得する2つのCLIの入力・組織確認・進捗・保存を共通管理する。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { createCsvSpool } = require('./csv-spool');
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
            object: { type: 'string', default: 'Account' },
            // 実行ディレクトリに依存せず、スクリプト付属の項目設定を使う。
            fields: { type: 'string', default: path.resolve(__dirname, '../config/fields.txt') },
            output: { type: 'string' },
            'check-auth': { type: 'boolean', default: false },
            ...(mode === 'records' ? { 'record-limit': { type: 'string', default: '2000' } } : {}),
            'fields-per-query': { type: 'string' },
            help: { type: 'boolean', default: false }
        }
    });
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
        object: values.object,
        fields: values.fields,
        output: values.output,
        checkAuth: values['check-auth'],
        help: values.help,
        recordLimit: mode === 'record-fields-preview' ? 1 : Number(values['record-limit']),
        fieldsPerQuery: values['fields-per-query'] === undefined ? undefined : Number(values['fields-per-query'])
    };
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
    // CLIが非0で返した構造化エラーも解析する。
    try {
        // stdout以外の出力は値や接続情報を含み得るため利用しない。
        body = JSON.parse(response.stdout || '{}') || {};
    } catch {
        // 不正なJSONはCLI失敗として後段で停止する。
        body = {};
    }
    // プロセスとJSONの両方が成功した場合だけ結果を採用する。
    if (!response.error && response.status === 0 && body.status === 0 && body.result !== undefined) {
        // トークンを返すCLIコマンドはこの入口から呼び出さない。
        return body.result;
    }
    // 検索固有のエラーは、固定した識別子だけを表示する。
    const queryCodes = [
        'INVALID_FIELD',
        'MALFORMED_QUERY',
        'INVALID_QUERY_FILTER_OPERATOR',
        'FUNCTIONALITY_NOT_ENABLED'
    ];
    // OSの既知のエラーコードを、表示可能な固定の識別子へ対応付ける。
    const processCodes = new Map([
        ['ENOBUFS', 'BUFFER_LIMIT'],
        ['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'BUFFER_LIMIT'],
        ['ENOENT', 'CLI_NOT_FOUND'],
        ['EACCES', 'CLI_ACCESS_DENIED'],
        ['EPERM', 'CLI_ACCESS_DENIED'],
        ['ETIMEDOUT', 'CLI_TIMEOUT']
    ]);
    // 認証に関する既知の識別子だけを判定し、メッセージから推測しない。
    const authCodes = new Set([
        'INVALID_SESSION_ID',
        'NamedOrgNotFoundError',
        'NoAuthorizationError',
        'AuthInfoCreationError'
    ]);
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
    } else if (authCodes.has(body.name)) {
        // 認証失敗時は再試行せず、対象指定と既存認証の確認を促す。
        code = 'AUTH_FAILED';
    } else if (queryCodes.includes(body.name)) {
        // 検索固有の診断を表示して、未完成のCSVの保存を防ぐ。
        code = body.name;
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
        ['CLI_TIMEOUT', 'CLIの応答待ちが制限時間を超えました。ネットワークと組織の稼働状況を確認してください。'],
        ['AUTH_FAILED', '対象組織の認証を利用できません。--target-orgの指定と既存認証の状態を確認してください。'],
        [
            'BUFFER_LIMIT',
            mode === 'record-fields-preview'
                ? 'CLIの応答がサイズ上限を超えました。--fields-per-queryを小さくするか、項目ファイルの対象項目を減らしてください。'
                : 'CLIの応答がサイズ上限を超えました。必要に応じて--record-limitや--fields-per-queryを小さくしてください。'
        ]
    ]);
    // エラー識別子以外のCLI本文をログやCSVへ含めない。
    const error = new Error(
        `Salesforce CLIに失敗しました (${code})。${guidance.get(code) || '接続・権限・CLIの状態を確認してください。'}`
    );
    // どのCLIエラーも全体失敗として扱い、呼び出し元で識別できるようにする。
    Object.assign(error, { code });
    // 不完全なレコードを正常な出力として扱わず停止する。
    throw error;
}

// Describeと検索のCLI呼び出しに、上限と共通の診断を適用する。
async function callSf(args, cwd, runner = runSfWithOutputAsync, mode = 'records') {
    // 各呼び出しに応答サイズと待ち時間の上限を設定する。
    return parseCliResponse(await runner([...args, '--json'], cwd, undefined, 64 * 1024 * 1024, 120000), mode);
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
        now = Date.now,
        setIntervalCommand = setInterval,
        clearIntervalCommand = clearInterval
    } = {}
) {
    // 不正なオプションはCLIを起動する前に拒否する。
    const options = { ...parseOptions(args, mode), mode };
    // ヘルプは入力ファイルや認証を必要としない。
    if (options.help) {
        // オプションと認証確認だけを行う使い方を案内する。
        writeLine(
            `npm run sf:export:${mode} -- [--target-org ALIAS] [--object Account] [--fields scripts/record-export/config/fields.txt] [--record-type-id ID] ${mode === 'records' ? '[--record-limit 2000] ' : ''}[--fields-per-query NUMBER] [--output export-out/${mode}.csv] [--check-auth]`
        );
        // ヘルプ表示は正常終了する。
        return 0;
    }
    // 認証確認専用モードでは項目ファイルを要求しない。
    const names = options.checkAuth ? [] : readFieldNames(path.resolve(cwd, options.fields));
    // 出力は既定でGit管理対象外のexport-outへ保存し、実行ごとに分ける。
    const output = path.resolve(cwd, options.output || `export-out/${mode}-${Date.now()}.csv`);
    // 既存の出力や入力ファイルを上書きしない。
    if (!options.checkAuth && fs.existsSync(output)) {
        // 誤上書きを避け、別の出力名を指定してもらう。
        throw new Error('出力ファイルが既に存在します。別の--outputを指定してください。');
    }
    // CLIの待機中もイベントループを動かし、追加APIを呼ばず定期表示する。
    async function runWithProgress(command, directory, execCommand, maxBuffer, timeout) {
        // 現在のCLI呼び出しの開始から経過時間を計測する。
        const startedAt = now();
        // 値や認証情報を表示せず、待機中の処理だけを識別する。
        const operation = {
            config: '組織設定の確認',
            org: '接続組織の確認',
            sobject: '項目定義の取得',
            data: '項目値の検索',
            api: '項目値の検索'
        }[command[0]];
        // リトリーブと同じ30秒間隔で、現在の処理の継続を知らせる。
        const timer = setIntervalCommand(() => {
            // 経過時間と現在日時を同じ時点から算出する。
            const checkedAt = now();
            // システム時刻が戻った場合も負の経過時間を出さない。
            const elapsed = (Math.max(0, checkedAt - startedAt) / 1000).toFixed(1);
            // 日時は実行環境のローカル時刻で表示する。
            writeLine(
                `・実行中: ${operation}｜${elapsed}秒経過｜${new Date(checkedAt).toLocaleString('ja-JP', { hour12: false })}`
            );
        }, 30000);
        // 定期表示だけでプロセスが終了できなくなることを防ぐ。
        timer?.unref?.();
        // 成功・失敗・起動時の例外すべてで定期表示を終了する。
        try {
            // 逐次実行を維持し、応答待ちの間だけ他のイベントを処理する。
            return await runner(command, directory, execCommand, maxBuffer, timeout);
        } finally {
            // 次の処理や確認入力へ移る前にタイマーを解除する。
            clearIntervalCommand(timer);
        }
    }
    // 組織情報取得の失敗も、Describe・検索と同じ診断へ揃える。
    const runOrgCommand = async (command, directory) => {
        // 組織一覧と設定取得で、それぞれ必要な応答上限を維持する。
        const limit = command[0] === 'config' ? 1024 * 1024 : 16 * 1024 * 1024;
        // 共通の組織判定へ生のエラー応答を渡す前に検証する。
        const response = await runWithProgress(command, directory, undefined, limit, 120000);
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
    // 一覧取得中も定期表示を継続し、組織への接続確認はDescribeで行う。
    const orgResponse = await runOrgCommand(['org', 'list', '--json', '--skip-connection-status'], cwd);
    // 取得済み一覧を共通の組織種別・一意性の判定へ渡す。
    const orgInfo = getTargetOrgInfo({ repoRoot: cwd, targetOrg, runSfCommand: () => orgResponse });
    // 既存の共通表示を使ってalias・username・URL・種別を利用者へ示す。
    printTargetOrgInfo(orgInfo, writeLine);
    // 確認中にaliasが変更されても、表示した実行ユーザーへ接続する。
    const resolvedTargetOrg = orgInfo.username;
    // 操作対象と明示的なレコードタイプの絞り込みだけを表示する。
    writeLine(
        `対象: ${options.object} / ${options.recordTypeId ? `レコードタイプID: ${options.recordTypeId}` : '参照可能な全レコード（レコードタイプ指定なし）'}`
    );
    // 補完元も同じレコードタイプへ限定することを確認入力前に知らせる。
    if (options.recordTypeId) {
        // 無条件の補完によるレコードタイプ混在を防ぐ仕様を明示する。
        writeLine('取得対象とプレビューの補完元を、指定したレコードタイプだけに限定します。');
    }
    // 接続確認専用ではデータの取得承認を求めない。
    if (!options.checkAuth) {
        // 項目ファイルと出力先を確認してから取得を開始できるようにする。
        writeLine(`項目ファイル: ${path.resolve(cwd, options.fields)} / 指定項目数: ${names.length}`);
        // 取得件数と並び順の既定動作を明示する。
        writeLine(
            `取得: 最新から最大${options.recordLimit}件 / ${options.fieldsPerQuery ? `${options.fieldsPerQuery}項目ずつ（手動上限）` : '全指定項目・制限時に自動分割'} / 出力: ${mode === 'record-fields-preview' ? 'レコードフィールドプレビュー（縦型）' : '横型'}`
        );
        // 形式によって補完の有無が異なることを、承認前に明示する。
        writeLine(
            mode === 'record-fields-preview'
                ? 'レコードフィールドプレビュー（デモ用値・縦型）: 最新1件を基準に、空欄は非NULL条件で検索可能な項目だけ最新の非NULL値で補完します。検索不可の項目は元の値を保持します。項目の行は指定ファイル順です。'
                : '横型: 各レコードの実際の値を出力します。空欄は補完しません。項目の列は指定ファイル順です。'
        );
        // 実行時に作成するCSVの保存先を示す。
        writeLine(`出力先: ${output}`);
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
    // 成功・失敗を問わず一時ファイルを削除する。
    try {
        // Describeの成功により実際のAPI接続と対象オブジェクトへのアクセスを確認する。
        const describe = await callSf(
            ['sobject', 'describe', '--sobject', options.object, '--target-org', resolvedTargetOrg],
            cwd,
            runWithProgress,
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
        // APIの応答を一時ファイルへ直接受信する読み取り専用クライアントを用意する。
        const query = createQueryClient(
            temporaryDirectory,
            resolvedTargetOrg,
            (command) => callSf(command, cwd, runWithProgress, mode),
            describe.urls?.sobject
        );
        // 一時CSVは公開先と同じ親ディレクトリへ置く。
        fs.mkdirSync(path.dirname(output), { recursive: true });
        // 完成前のデータを利用者の指定ファイル名で公開しない。
        spoolDirectory = fs.mkdtempSync(path.join(path.dirname(output), '.record-export-'));
        // 値をメモリに蓄積せず、ID別に順次保存する。
        const spool = createCsvSpool(spoolDirectory, fields, mode);
        // 対象選択・適応分割・補完を共通の照合処理で実行する。
        const result = await collectRecords(describe, fields, options, query, writeLine, spool.append);
        // 全項目と全レコードが揃った場合だけ完成ファイルを公開する。
        spool.finish(result.ids, output);
        // 対象なしと成功件数を区別し、レコードの実値は表示しない。
        writeLine(
            result.recordCount
                ? `取得完了: ${result.recordCount}レコード / ${result.fields.length}項目`
                : '対象レコードがありません。ヘッダーのみ出力しました。'
        );
        // 保存場所を利用者へ伝える。
        writeLine(`出力: ${output}`);
        // 全レコード・全項目の取得と保存が完了した場合だけ成功を返す。
        return 0;
    } finally {
        // 認証失敗時にもSOQLの一時ファイルを残さない。
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        // 未完成または公開済みの一時CSVも通常終了・例外時に片付ける。
        if (spoolDirectory) fs.rmSync(spoolDirectory, { recursive: true, force: true });
    }
}

module.exports = { main, parseOptions, callSf };
