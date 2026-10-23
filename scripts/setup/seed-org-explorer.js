// 実行コマンド: npm run setup:org-explorer [-- --dry-run | --verify]
// 用途: Scratch Orgへ組織エクスプローラーの合成デモデータを再現する。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runSfWithOutput } = require('../common/run-command');
const { createApprovalPrompt, isApproved } = require('../common/approval');
const {
    getDefaultTargetOrg,
    getTargetOrgInfo,
    orgTypes,
    parseSfJson,
    printTargetOrgInfo
} = require('../common/target-org');
const {
    buildSources,
    readDefinition,
    settingFields,
    userFields,
    verifyRecords
} = require('./internal/org-explorer-demo');

// コマンドの入力と作業ディレクトリを固定する。
const repoRoot = path.resolve(__dirname, '../..');
// 利用可能な実行モードをnpmコマンドで案内する。
const usage = 'npm run setup:org-explorer [-- --dry-run | --verify]';

// 実行モードだけを受け付け、接続先の引数指定は許可しない。
function parseArgs(argv) {
    // helpは単独指定の場合だけ受け付ける。
    if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
    // 通常実行を既定とし、接続先はCLI設定から別途確定する。
    const options = { dryRun: false, verify: false };
    // 未知・重複オプションを照会前に検出する。
    for (const arg of argv) {
        // ローカル検証と保存済みデータの照合を区別する。
        if (arg === '--dry-run' && !options.dryRun) {
            // 組織へ接続しない実行モードを保持する。
            options.dryRun = true;
        } else if (arg === '--verify' && !options.verify) {
            // データを変更しない照合モードを保持する。
            options.verify = true;
        } else {
            // 接続先の上書きや確認の省略を含む未対応指定を拒否する。
            throw new Error(`未対応または重複した引数です: ${arg}`);
        }
    }
    // 接続を伴わない検証と組織上の照合を同時に実行させない。
    if (options.dryRun && options.verify) throw new Error(`実行方法: ${usage}`);
    // 呼び出し元へ検証済みの実行モードを渡す。
    return options;
}

// 成功した照会で全件を取得できた場合だけ照合に使用する。
function queryRecords(query, targetOrg, runSfCommand) {
    // CLIの結果を検証してから取得データを使用する。
    const result = parseSfJson(
        runSfCommand(['data', 'query', '--query', query, '--target-org', targetOrg, '--json'], repoRoot),
        'デモデータの照会'
    );
    // 途中までの取得を完全な照合データとして使用しない。
    if (
        !result ||
        !Array.isArray(result.records) ||
        result.done !== true ||
        result.totalSize !== result.records.length
    ) {
        // 途中までの取得を全件照合として扱わない。
        throw new Error('照会結果が不完全です。');
    }
    // 完了を確認したレコード集合だけを返す。
    return result.records;
}

// 作成対象と既存データの同じ項目を保存前後で読み取る。
function readOrgRecords(plan, targetOrg, runSfCommand) {
    // 定義にある英語API名だけを照合し、共通プレフィックスに依存しない。
    const roleCondition = plan.roles
        .flatMap((row) => [row.key, row.previousKey].filter(Boolean))
        .map((key) => `DeveloperName = '${key}'`)
        .join(' OR ');
    // 定義された識別名だけを対象にロールを再取得する。
    const roles = queryRecords(
        `SELECT Id, DeveloperName, Name, ParentRoleId FROM UserRole WHERE ${roleCondition}`,
        targetOrg,
        runSfCommand
    );
    // 保存後に照合するユーザー項目と関連先を固定する。
    const fields = [
        'Id',
        ...userFields,
        ...settingFields,
        'UserRoleId',
        'ManagerId',
        'IsActive',
        'Profile.Name',
        'Profile.UserLicense.Name'
    ];
    // デモ専用のメール識別条件でユーザーを再取得する。
    const users = queryRecords(
        `SELECT ${fields.join(', ')} FROM User WHERE Email LIKE 'orgexplorer.seed.%@example.com'`,
        targetOrg,
        runSfCommand
    );
    // 保存前後を比較できるように元レコードを返す。
    return { roles, users };
}

// CLIの終了コードとApex本文の両方を確認し、診断に必要な失敗理由だけを返す。
function readApexResult(commandResult) {
    // 解析前のCLI応答を成功結果と混同させない。
    let envelope;
    // 解析や実行の失敗を利用者向けの結果へ変換する。
    try {
        // CLIの応答形式を確認する。
        envelope = JSON.parse(commandResult.stdout || '{}');
    } catch {
        // 解析不能な応答を成功として扱わない。
        throw new Error('Apex実行結果のJSONを解析できません。');
    }
    // CLIの成功・失敗応答で異なる格納先に対応する。
    const result = envelope.result ?? envelope.data;
    // CLIの終了状態とApexの実行状態を両方確認する。
    if (
        commandResult.error ||
        commandResult.status !== 0 ||
        envelope.status !== 0 ||
        result?.success !== true ||
        result?.compiled !== true
    ) {
        // 失敗の診断に必要な理由だけを選ぶ。
        const reason =
            result?.compileProblem ??
            result?.exceptionMessage ??
            envelope.message ??
            commandResult.error?.message ??
            '結果不明';
        // 失敗理由を保持して投入処理を停止する。
        throw new Error(`Apexの実行に失敗しました: ${reason}`);
    }
    // コンパイルと実行の両方が成功した結果だけを返す。
    return result;
}

// 投入前の実行確認と、一時ファイルの確実な削除を入口で管理する。
async function main({
    argv = process.argv.slice(2),
    runSfCommand = (args, cwd) => runSfWithOutput(args, cwd, undefined, 4 * 1024 * 1024, 120000),
    createPrompt,
    stdout = process.stdout,
    stderr = process.stderr,
    targetOrg: internalTargetOrg
} = {}) {
    // 作成した一時ファイルを成功・失敗のどちらでも削除できるよう保持する。
    let temporaryDirectory;
    // 確認情報と集計を同じ出力先へ改行付きで表示する。
    const writeLine = (line) => stdout.write(`${line}\n`);
    // 解析や実行の失敗を利用者向けの結果へ変換する。
    try {
        // 接続処理より先に実行モードを確定する。
        const options = parseArgs(argv);
        // helpでは定義の検証や組織確認を行わない。
        if (options.help) {
            // 利用可能な実行モードを表示する。
            writeLine(usage);
            // 後続処理を行わず正常終了する。
            return 0;
        }
        // ローカル定義の検証は接続組織の確認より先に完了する。
        const { plan, template } = readDefinition();
        // 組織へ接続しない定義検証を分離する。
        if (options.dryRun) {
            // 実投入と同じ合成経路を組織に接続せず検証する。
            const sources = buildSources(plan, template, '00D000000000001');
            // 接続先は未解決であることと変更を行わないことを表示する。
            writeLine(
                `[dry-run] target-org=<default-target-org> / Apex ${sources.length}回 / 最大 ${Math.max(...sources.map((source) => Buffer.byteLength(source)))} bytes / 組織接続・データ変更なし`
            );
            // 後続処理を行わず正常終了する。
            return 0;
        }
        // 通常はtarget-orgを取得し、Scratch Org準備処理だけが確認済み接続先を内部で引き継ぐ。
        const configuredTargetOrg = internalTargetOrg ?? getDefaultTargetOrg({ repoRoot, runSfCommand });
        // 既存の組織判定を再利用し、Scratch以外の全環境を拒否する。
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand, targetOrg: configuredTargetOrg });
        // 実行確認の前に接続組織と種別を表示する。
        printTargetOrgInfo(orgInfo, writeLine);
        // 本番・Sandbox・通常のDeveloper Editionでは確認入力より前に停止する。
        if (orgInfo.type !== orgTypes.SCRATCH) throw new Error('\nこのスクリプトはScratch Orgでのみ実行可能です。');
        // 確認後のalias差し替えに影響されないよう、検証済みの接続ユーザーへ固定する。
        const targetOrg = orgInfo.username;
        // 既存データの不変性を確認する比較元を保持する。
        let baseline;
        // 保存済みデータの照合では投入処理へ進まない。
        if (!options.verify) {
            // データ変更前に接続先への明示承認を求める。
            const prompt = createApprovalPrompt(createPrompt);
            // 入力結果を確認終了後の投入判断へ渡す。
            let answer;
            // 入力中に失敗しても確認画面を確実に閉じる。
            try {
                // 表示したスクラッチ組織への投入可否を確認する。
                answer = await prompt.question('テスト用のロールとユーザーのデータを作成しますか？ (y/N): ');
            } finally {
                // 確認終了後に標準入力を解放する。
                prompt.close();
            }
            // yまたはY以外の回答では変更処理を行わない。
            if (!isApproved(answer)) {
                // 投入しなかったことを利用者へ通知する。
                writeLine('投入を中止しました。');
                // 取消を成功終了として扱い、DMLへ進まない。
                return 0;
            }
            // 作成前の状態を保持し、スキップしたデータへの変更を検出する。
            baseline = readOrgRecords(plan, targetOrg, runSfCommand);
            // 実行中の接続先取り違えをサーバー上でも検出するためIDを取得する。
            const organizations = queryRecords('SELECT Id FROM Organization', targetOrg, runSfCommand);
            // 組織IDを一意に確認できない場合は投入しない。
            if (organizations.length !== 1) throw new Error('対象組織IDを一意に取得できません。');
            // 確認した組織IDを含む投入コードを合成する。
            const sources = buildSources(plan, template, organizations[0].Id);
            // 投入専用の一時ディレクトリを作成する。
            temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'org-explorer-seed-'));
            // 組織固有情報を含むコードを一時領域へ限定する。
            const apexPath = path.join(temporaryDirectory, 'seed.apex');
            // 分割した要求全体の作成件数を集計する。
            let rolesCreated = 0;
            // 作成済みユーザーを次の要求から参照できるよう、直列で投入する。
            let usersCreated = 0;
            // サイズ検証済みの要求だけを順に実行する。
            for (const source of sources) {
                // 一時コードを所有者だけが読み書きできる権限で保存する。
                fs.writeFileSync(apexPath, source, { encoding: 'utf8', mode: 0o600 });
                // 確定した接続ユーザーへだけ投入し、実行結果を確認する。
                const result = readApexResult(
                    runSfCommand(['apex', 'run', '--file', apexPath, '--target-org', targetOrg, '--json'], repoRoot)
                );
                // 実行ログから個人情報を含まない作成件数だけを取り出す。
                const summary = result.logs?.match(
                    /ORG_EXPLORER_SEED rolesCreated=(\d+) rolesSkipped=\d+ usersCreated=(\d+) usersSkipped=\d+/
                );
                // 集計を確認できない場合は成功と通知しない。
                if (!summary)
                    throw new Error('投入結果の集計を確認できません。再実行前に--verifyで状態を確認してください。');
                // 作成件数を要求全体で一度だけ表示する。
                rolesCreated += Number(summary[1]);
                // 先行要求で作成したユーザーを重複計上しない。
                usersCreated += Number(summary[2]);
            }
            // スキップ数は分割実行回数ではなく、全定義に対する差分で表示する。
            writeLine(
                `ORG_EXPLORER_SEED rolesCreated=${rolesCreated} rolesSkipped=${plan.roles.length - rolesCreated} usersCreated=${usersCreated} usersSkipped=${plan.users.length - usersCreated}`
            );
        }
        // 実行成功の表示だけに頼らず、保存された項目と関係を照合する。
        const records = readOrgRecords(plan, targetOrg, runSfCommand);
        // 新規は定義と照合し、既存は変更されていないことを確認する。
        const counts = verifyRecords(plan, records.roles, records.users, baseline);
        // 保存内容の照合が完了した件数を表示する。
        writeLine(`処理成功: ロール ${counts.roles}件 / ユーザー ${counts.users}件`);
        // 実行モードに応じた全処理が成功したことを返す。
        return 0;
    } catch (error) {
        // 利用者が原因を確認できるよう失敗理由を表示する。
        stderr.write(`${error.message}\n`);
        // 処理の失敗を呼び出し元へ通知する。
        return 1;
    } finally {
        // 中断・失敗時も組織IDを含む一時Apexを残さない。
        if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

// 直接実行時だけ処理を開始し、テストからの読込では実行しない。
if (require.main === module) {
    // 非同期処理が確定した終了状態を受け取る。
    main().then((code) => {
        // npmへ処理の成否を伝える。
        process.exitCode = code;
    });
}

module.exports = { main, parseArgs, queryRecords, readApexResult, readOrgRecords };
