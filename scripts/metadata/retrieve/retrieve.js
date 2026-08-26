// 実行コマンド: npm run sf:retrieve
// 用途: Default Target Orgから、責務別のmanifestに定義したメタデータを順番に取得する。

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { createApprovalPrompt, isApproved } = require('../../common/approval');
const { buildSfCommand, runSfWithOutput } = require('../../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, printTargetOrgInfo } = require('../../common/target-org');

// manifestとSalesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// 大きいretrieve結果を無制限に保持せず、1回分だけ64MBまで受け付ける。
const retrieveOutputMaxBuffer = 64 * 1024 * 1024;

// warningが多い場合もログを肥大化させない表示上限を固定する。
const warningDisplayLimit = 20;

// Metadata APIの1回のretrieveで扱える最大ファイル数を固定する。
const metadataApiFileLimit = 10000;

// 種別別件数を確認できる範囲とログ量の上限を両立する。
const metadataTypeDisplayLimit = 20;

// 長時間retrieveが実行中であることを定期的に表示する。
const retrieveProgressIntervalMilliseconds = 30 * 1000;

// 依存関係を保つためProfileを最初、Translationsを最後に取得する。
const manifests = [
    'manifest/retrieve-profile.xml',
    'manifest/retrieve-code.xml',
    'manifest/retrieve-shared-resources.xml',
    'manifest/retrieve-application-ui.xml',
    'manifest/retrieve-object-configuration.xml',
    'manifest/retrieve-custom-configuration.xml',
    'manifest/retrieve-automation.xml',
    'manifest/retrieve-access-sharing.xml',
    'manifest/retrieve-integration-api.xml',
    'manifest/retrieve-events-messaging.xml',
    'manifest/retrieve-ui-extensions.xml',
    'manifest/retrieve-auth-security.xml',
    'manifest/retrieve-analytics.xml',
    'manifest/retrieve-email-notification.xml',
    'manifest/retrieve-digital-experience.xml',
    'manifest/retrieve-experience-sites.xml',
    'manifest/retrieve-service.xml',
    'manifest/retrieve-mobile-offline.xml',
    'manifest/retrieve-ai-ml.xml',
    'manifest/retrieve-content-cms.xml',
    'manifest/retrieve-search-knowledge.xml',
    'manifest/retrieve-org-settings.xml',
    'manifest/retrieve-classic-ui.xml',
    'manifest/retrieve-conversation-intelligence.xml',
    'manifest/retrieve-payments.xml',
    'manifest/retrieve-platform-features.xml',
    'manifest/retrieve-translations.xml'
];

// manifestのXML文字列を、API versionとmetadata type名の集合へ変換する。
function parseManifestSource(source, manifestLabel) {
    // API versionが1件だけ定義されていることを確認する。
    const versions = [...source.matchAll(/<version>([^<]+)<\/version>/g)].map((match) => match[1]);

    // versionの欠落や重複をmanifest構成エラーとして拒否する。
    if (versions.length !== 1) {
        // 問題のあるmanifestを利用者が特定できるエラーにする。
        throw new Error(`${manifestLabel}のAPI versionを一意に確認できませんでした。`);
    }

    // manifest内のmetadata type名を重複しない集合として保持する。
    const types = new Set();

    // package.xml内のtypesブロックを順に解析する。
    for (const typeMatch of source.matchAll(/<types>([\s\S]*?)<\/types>/g)) {
        // 現在のtypesブロックからmetadata type名を取得する。
        const names = [...typeMatch[1].matchAll(/<name>([^<]+)<\/name>/g)].map((match) => match[1]);
        // 現在のtypesブロックから取得対象memberを取得する。
        const members = [...typeMatch[1].matchAll(/<members>([^<]+)<\/members>/g)].map((match) => match[1]);

        // type名またはmemberを一意に解釈できないブロックを拒否する。
        if (names.length !== 1 || members.length === 0) {
            // XMLの対象位置を推測せずmanifest全体を構成エラーにする。
            throw new Error(`${manifestLabel}に解釈できないtypes定義があります。`);
        }

        // 同じmanifest内でtypeブロックが重複すると取得範囲が不明瞭になるため拒否する。
        if (types.has(names[0])) {
            // 重複したmetadata typeを修正対象として明示する。
            throw new Error(`${manifestLabel}でmetadata typeが重複しています: ${names[0]}`);
        }

        // 構造を確認できたmetadata type名を追加する。
        types.add(names[0]);
    }

    // 取得対象がないmanifestを実行対象として扱わない。
    if (types.size === 0) {
        // 空manifestがSalesforce CLIへ渡る前に停止する。
        throw new Error(`${manifestLabel}に取得対象metadata typeがありません。`);
    }

    // 後続のversion比較とtype数集計に必要な解析結果を返す。
    return { types, version: versions[0] };
}

// 分割manifestを唯一の取得定義として、構造とAPI versionを検証する。
function validateManifestDefinitions(splitSources, expectedApiVersion) {
    // 分割manifest全体のmetadata type名を重複しない集合へ集約する。
    const metadataTypes = new Set();

    // すべての分割manifestを実行前に検証する。
    for (const { label, source } of splitSources) {
        // 現在の分割manifestを解析する。
        const definition = parseManifestSource(source, label);

        // projectと異なるAPI versionのmanifestを取得開始前に拒否する。
        if (definition.version !== expectedApiVersion) {
            // 不一致のmanifestとversionを利用者へ表示する。
            throw new Error(
                `${label}のAPI versionがsfdx-project.jsonと一致しません: ${definition.version} / ${expectedApiVersion}`
            );
        }

        // 現在のmanifestに含まれるmetadata type名を集計する。
        for (const typeName of definition.types) {
            // 関連取得のためのmanifest間重複は1 typeとして数える。
            metadataTypes.add(typeName);
        }
    }

    // 実行前表示に必要なmanifest件数、metadata type件数、API versionを返す。
    return { manifestCount: splitSources.length, typeCount: metadataTypes.size, version: expectedApiVersion };
}

// リポジトリ内の分割manifestとSalesforce project設定を読み込んで検証する。
function validateRetrieveManifestPlan() {
    // すべての分割manifestが存在することを確認する。
    for (const manifest of manifests) {
        // 1件でも不足していればretrieveを開始しない。
        if (!fs.existsSync(path.join(repoRoot, manifest))) {
            // 不足しているmanifestを利用者へ表示する。
            throw new Error(`retrieve対象のmanifestが見つかりません: ${manifest}`);
        }
    }

    // sfdx-project.jsonからこのprojectの基準API versionを取得する。
    const projectConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'sfdx-project.json'), 'utf8'));
    // 分割manifestをラベル付きXML文字列として読み込む。
    const splitSources = manifests.map((manifest) => ({
        label: manifest,
        source: fs.readFileSync(path.join(repoRoot, manifest), 'utf8')
    }));

    // 読み込んだ全分割manifestの構造とAPI versionを検証する。
    return validateManifestDefinitions(splitSources, projectConfig.sourceApiVersion);
}

// Salesforce CLIのwarning要素を利用者向けの1行へ変換する。
function getWarningText(warning) {
    // 文字列warningは内容を変更せず返す。
    if (typeof warning === 'string') {
        // 空文字列を後続で除外できるようtrimした値を返す。
        return warning.trim();
    }

    // オブジェクト以外の値は表示対象外にする。
    if (!warning || typeof warning !== 'object') {
        // 不正なwarning値を空文字列へ統一する。
        return '';
    }

    // Metadata APIとCLIの主なwarning項目を優先順に取得する。
    const message = warning.problem ?? warning.message ?? warning.error ?? '';
    // 対象ファイルがある場合だけwarning本文へ前置する。
    const fileName = warning.fileName ?? warning.filePath ?? '';

    // file名と本文の両方がある場合は対象を識別できる1行にする。
    return fileName && message ? `${fileName}: ${message}` : String(message || fileName).trim();
}

// 複数のCLI応答位置に現れるwarningを重複しない一覧へまとめる。
function collectWarnings(...warningGroups) {
    // 同じMetadata API warningをresultとfilesから二重表示しない集合を作る。
    const warnings = new Set();

    // warningの配列、単一値、未定義を同じ処理へ揃える。
    for (const group of warningGroups) {
        // 配列でないwarningも1件の配列として扱う。
        const entries = Array.isArray(group) ? group : group === undefined ? [] : [group];

        // 現在のwarning群を表示用文字列へ変換する。
        for (const warning of entries) {
            // warningの対象と内容を1行へ正規化する。
            const text = getWarningText(warning);

            // 内容があるwarningだけを結果へ残す。
            if (text) {
                // 重複を除外しながらwarningを追加する。
                warnings.add(text);
            }
        }
    }

    // 呼び出し元が件数と内容を扱える配列へ変換する。
    return [...warnings];
}

// Metadata APIのfilePropertiesを配列へ揃える。
function normalizeFileProperties(fileProperties) {
    // 複数件の標準応答はそのまま利用する。
    if (Array.isArray(fileProperties)) {
        return fileProperties;
    }

    // 1件だけオブジェクトで返る応答も同じ集計へ含める。
    if (fileProperties && typeof fileProperties === 'object') {
        return [fileProperties];
    }

    // 未返却または不正な値はAPI件数を確認できない状態として空配列にする。
    return [];
}

// Metadata APIファイルをmetadata type別の件数へ集計する。
function countMetadataApiFilesByType(fileProperties) {
    // type名ごとの件数を重複なく保持する。
    const counts = new Map();

    // 取得対象を大きくしているmetadata typeを特定できるよう1件ずつ数える。
    for (const fileProperty of fileProperties) {
        // type欠落も全体件数との不一致を隠さず種別不明として集計する。
        const type =
            typeof fileProperty?.type === 'string' && fileProperty.type.trim() ? fileProperty.type.trim() : '種別不明';
        // 現在のtype件数を1件増やす。
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    // 件数の多い順、同数ならtype名順にして実行ごとの表示順を安定させる。
    return [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

// 1回のSalesforce CLI retrieve結果を完全性判定用の小さい集計へ変換する。
function parseRetrieveCommandResult(commandResult) {
    // 出力上限超過は大量JSONを処理し続けず明示的な失敗にする。
    if (commandResult?.error?.code === 'ENOBUFS') {
        // 上限値と対処判断を利用者へ伝えられる結果を返す。
        return {
            outcome: 'failure',
            error: `Salesforce CLIのJSON出力が${retrieveOutputMaxBuffer / 1024 / 1024}MB上限を超えました。`,
            warnings: []
        };
    }

    // CLI起動自体の失敗をMetadata API応答と区別する。
    if (commandResult?.error) {
        // OSエラーを失わず後続manifestを停止できる結果へ変換する。
        return {
            outcome: 'failure',
            error: `Salesforce CLIを開始できませんでした: ${commandResult.error.message}`,
            warnings: []
        };
    }

    // Salesforce CLIのJSON標準出力を解析する。
    let payload;

    // 空出力や非JSON出力も成功として扱わない。
    try {
        // JSON応答全体をCLIのstatusとretrieve resultへ変換する。
        payload = JSON.parse(commandResult?.stdout || '');
    } catch (error) {
        // 解析不能な応答から取得成功を推測せず停止する。
        return {
            outcome: 'failure',
            error: `Salesforce CLIのJSONを解析できませんでした: ${error.message}`,
            warnings: []
        };
    }

    // CLI最上位とretrieve resultのwarning候補を先に集約する。
    const result = payload.result;
    // JSON失敗応答でもwarningを報告できるよう最上位から収集する。
    const topLevelWarnings = collectWarnings(payload.warnings);

    // processまたはCLI JSONが非0ならretrieve失敗として扱う。
    if (commandResult.status !== 0 || payload.status !== 0) {
        // CLIが返した主原因を優先し、不明な場合だけ終了コードを表示する。
        const errorMessage =
            payload.message ?? `Salesforce CLIが終了コード${commandResult.status ?? '不明'}を返しました。`;
        // warningを保持した失敗結果を返す。
        return { outcome: 'failure', error: errorMessage, warnings: topLevelWarnings };
    }

    // 成功statusでもresultがない応答を不完全として拒否する。
    if (!result || typeof result !== 'object') {
        // 取得件数を検証できないJSONを成功扱いしない。
        return {
            outcome: 'failure',
            error: 'Salesforce CLIのretrieve resultがありません。',
            warnings: topLevelWarnings
        };
    }

    // 対応済みのCLI応答形式に取得ファイル一覧があることを確認する。
    const hasFileResults = Array.isArray(result.files) || Array.isArray(result.inboundFiles);

    // 未知の成功応答を0件取得として扱わず停止する。
    if (!hasFileResults) {
        // CLI version差などで完全性を判定できないことを明示する。
        return {
            outcome: 'failure',
            error: 'Salesforce CLIのretrieveファイル結果を確認できませんでした。',
            warnings: collectWarnings(topLevelWarnings, result.warnings, result.messages)
        };
    }

    // CLI version差を吸収し、filesまたは標準的なinboundFilesを取得結果一覧として扱う。
    const files = Array.isArray(result.files) ? result.files : result.inboundFiles;
    // failure状態のfile responseをwarningとして検出する。
    const failedFiles = files.filter((file) => file?.state === 'Failed' || file?.problemType === 'Error');
    // Metadata APIの取得対象不足やfile失敗を、CLI自体の案内warningと分けて保持する。
    const retrieveWarnings = collectWarnings(result.warnings, result.messages, failedFiles);
    // 表示用にはCLI warningと取得warningを重複しない一覧へ統合する。
    const warnings = collectWarnings(topLevelWarnings, retrieveWarnings);
    // failure以外のfile responseだけを取得件数へ含める。
    const retrievedFiles = files.filter((file) => file?.state !== 'Failed' && file?.problemType !== 'Error');
    // 同じcomponentのsourceとmeta XMLを1件へまとめる集合を作る。
    const components = new Set();

    // 取得成功したfile responseからcomponent識別子を作る。
    for (const file of retrievedFiles) {
        // typeとfullNameがある通常応答をcomponent単位へまとめる。
        if (file?.type && file?.fullName) {
            // sourceとmeta XMLの重複を除外するキーを追加する。
            components.add(`${file.type}\u0000${file.fullName}`);
        }
    }

    // filePropertiesが返った場合だけMetadata API側のファイル件数を確定する。
    const hasFileProperties = result.fileProperties !== undefined && result.fileProperties !== null;
    // 単一オブジェクトと配列の両方を同じ件数集計へ揃える。
    const fileProperties = normalizeFileProperties(result.fileProperties);
    // source変換後のfilesとは別に、Metadata API上限判定に使う件数を保持する。
    const apiFileCount = hasFileProperties ? fileProperties.length : undefined;
    // 上限に近づいた原因を追加API呼び出しなしでmetadata type別に集計する。
    const metadataTypeCounts = countMetadataApiFilesByType(fileProperties);
    // 10,000件ちょうども取得完了と断定せず、manifest分割が必要な結果として扱う。
    const apiFileLimitReached = apiFileCount !== undefined && apiFileCount >= metadataApiFileLimit;

    // 完了していないMetadata API jobを成功扱いしない。
    const completed = result.done !== false && (result.status === undefined || result.status === 'Succeeded');
    // APIが明示した失敗と未完了状態をまとめて判定する。
    const apiSucceeded = result.success !== false && completed;

    // jobが失敗または未完了ならwarningの有無にかかわらず後続を停止する。
    if (!apiSucceeded) {
        // Metadata API statusと取得済み件数を原因調査用に保持する。
        return {
            outcome: 'failure',
            error: `Metadata API retrieveが完了していません: ${result.status ?? 'status不明'}`,
            warnings,
            componentCount: components.size,
            fileCount: retrievedFiles.length,
            apiFileCount,
            metadataTypeCounts,
            status: result.status
        };
    }

    // 後続manifestを継続しながら最後に報告する要確認理由を作る。
    const attentionReasons = [];

    // Metadata APIの取得warningは個別componentの未取得候補として最終結果へ残す。
    if (retrieveWarnings.length !== 0) {
        // CLI案内warningだけでは一括retrieve全体を要確認にしない。
        attentionReasons.push(`取得warning ${retrieveWarnings.length}件を記録しました。`);
    }

    // API上限到達時は成功statusでも完全取得と断定しない。
    if (apiFileLimitReached) {
        // 分割が必要なmanifestを最終集計から特定できる理由を保持する。
        attentionReasons.push(
            `Metadata APIの取得ファイル数が上限${metadataApiFileLimit.toLocaleString('ja-JP')}件に達しました。`
        );
    }

    // 取得詳細を保持せず、表示と最終判定に必要な集計だけを返す。
    return {
        outcome: attentionReasons.length === 0 ? 'success' : 'partial',
        warnings,
        attentionReasons,
        componentCount: components.size,
        fileCount: retrievedFiles.length,
        apiFileCount,
        metadataTypeCounts,
        status: result.status ?? 'Succeeded'
    };
}

// retrieve専用のJSON出力上限を指定してSalesforce CLIを非同期実行する。
function runRetrieveWithOutput(args, workingDirectory, execFileCommand = execFile) {
    // event loopを止めず、実行中の経過時間を表示できるPromiseを返す。
    return new Promise((resolve) => {
        // OS別コマンドの組み立てと子プロセス起動を同じ失敗形式へ揃える。
        try {
            // shellを介さない安全なSalesforce CLIコマンドを組み立てる。
            const sfCommand = buildSfCommand(args);
            // 1 manifest分のJSONだけを64MB上限で保持する。
            execFileCommand(
                sfCommand.command,
                sfCommand.args,
                { cwd: workingDirectory, encoding: 'utf8', maxBuffer: retrieveOutputMaxBuffer },
                (error, stdout = '', stderr = '') => {
                    // 出力上限超過を既存の完全性エラーへ変換する。
                    if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
                        resolve({
                            error: Object.assign(error, { code: 'ENOBUFS' }),
                            status: null,
                            stdout,
                            stderr
                        });
                        return;
                    }

                    // 数値終了コードがあるCLIエラーはJSON本文から原因を解析できる形で返す。
                    if (error && typeof error.code === 'number') {
                        resolve({ status: error.code, stdout, stderr });
                        return;
                    }

                    // 起動失敗と成功をspawnSync互換の結果形式へ揃える。
                    resolve({ error: error || undefined, status: error ? null : 0, stdout, stderr });
                }
            );
        } catch (error) {
            // 起動前の例外も呼び出し元の共通エラー判定へ渡す。
            resolve({ error, status: null, stdout: '', stderr: '' });
        }
    });
}

// 1 manifestの取得結果と所要時間を利用者へ表示する。
function printRetrieveSummary(summary, elapsedMilliseconds) {
    // 秒単位の所要時間を小数1桁へ揃える。
    const elapsedSeconds = (elapsedMilliseconds / 1000).toFixed(1);
    // 成功、継続可能な要確認、停止が必要な失敗をmanifest処理直後に表示する。
    const resultLabels = { success: '成功', partial: '要確認', failure: '失敗' };
    console.log(`・結果: ${resultLabels[summary.outcome] ?? '失敗'}`);
    // 応答形式を確認できた場合だけcomponent件数を表示する。
    if (summary.componentCount !== undefined) {
        // sourceとmeta XMLをまとめたcomponent件数を表示する。
        console.log(`・取得component: ${summary.componentCount}件`);
    }
    // 応答形式を確認できた場合だけfile件数を表示する。
    if (summary.fileCount !== undefined) {
        // Salesforce CLIが返した取得成功file件数を表示する。
        console.log(`・取得ファイル: ${summary.fileCount}件`);
    }
    // Metadata API上限判定に使用した変換前のファイル件数を表示する。
    if (summary.apiFileCount !== undefined) {
        // source形式の取得ファイル数と混同しない名称にする。
        console.log(`・API取得ファイル: ${summary.apiFileCount}件`);
    }

    // 件数の多いmetadata typeから表示上限まで内訳を表示する。
    for (const { type, count } of (summary.metadataTypeCounts ?? []).slice(0, metadataTypeDisplayLimit)) {
        // 10,000件に近づいた主因をmanifest実行結果だけで確認できる形式にする。
        console.log(`・APIファイル種別: ${type} ${count}件`);
    }

    // 表示を省略したmetadata typeは種別数と合計ファイル数を示す。
    if ((summary.metadataTypeCounts?.length ?? 0) > metadataTypeDisplayLimit) {
        // 省略された内訳もAPIファイル総数と照合できるよう件数を合計する。
        const omittedCounts = summary.metadataTypeCounts.slice(metadataTypeDisplayLimit);
        const omittedFileCount = omittedCounts.reduce((total, entry) => total + entry.count, 0);
        console.log(`・APIファイル種別: 他${omittedCounts.length}種別（${omittedFileCount}件）を省略しました。`);
    }
    // 追加API呼び出しなしで実測した所要時間を表示する。
    console.log(`・所要時間: ${elapsedSeconds}秒`);

    // warningの先頭だけを取得漏れ候補として表示する。
    for (const warning of summary.warnings.slice(0, warningDisplayLimit)) {
        // 後から対象manifestのwarningを特定できる形式へ揃える。
        console.error(`・warning: ${warning}`);
    }

    // 表示上限を超えたwarningは省略件数だけを表示する。
    if (summary.warnings.length > warningDisplayLimit) {
        // 完全性判定には全warningを使用したことが分かる形で省略を示す。
        console.error(`・warning: 他${summary.warnings.length - warningDisplayLimit}件を省略しました。`);
    }

    // 後続を継続しつつ最終的に確認が必要な理由を表示する。
    for (const reason of summary.attentionReasons ?? []) {
        // hard errorと区別して、継続可能な注意事項として表示する。
        console.error(`・注意: ${reason}`);
    }

    // 失敗理由がある場合だけ最後に表示する。
    if (summary.error) {
        // 後続を止めた理由を利用者へ明示する。
        console.error(`・エラー: ${summary.error}`);
    }
}

// manifestの確認後、承認された組織からメタデータを取得する。
async function main({
    argv = process.argv.slice(2),
    createPrompt,
    clearIntervalCommand = clearInterval,
    now = Date.now,
    runRetrieveCommand = runRetrieveWithOutput,
    runSfWithOutputCommand = runSfWithOutput,
    setIntervalCommand = setInterval
} = {}) {
    // このスクリプトは引数を受け付けない。
    if (argv.length !== 0) {
        // 引数指定が安全契約外であることを表示する。
        console.error('エラー: このスクリプトは引数を受け付けません。');
        // 正しいnpm scriptを利用者へ案内する。
        console.error('実行コマンド: npm run sf:retrieve');
        // Salesforce CLIを呼び出さず失敗終了を返す。
        return 1;
    }

    // orgへ接続する前に、すべての分割manifestの構造とAPI versionを確認する。
    let manifestPlan;

    // ファイル不足、構造不正、version差を同じ構成エラーとして扱う。
    try {
        // 現在のリポジトリにあるretrieve計画をローカルだけで検証する。
        manifestPlan = validateRetrieveManifestPlan();
    } catch (error) {
        // 不完全なmanifestで一部retrieveを開始しない。
        console.error(`エラー: retrieve manifestの確認に失敗しました: ${error.message}`);
        // orgへ接続していない構成失敗として1を返す。
        return 1;
    }

    // 検証したmanifest件数、metadata type件数、API versionを利用者へ表示する。
    console.log(
        `retrieve manifest確認: ${manifestPlan.manifestCount} manifests / ${manifestPlan.typeCount} metadata types / API ${manifestPlan.version}`
    );

    // retrieve対象のDefault Target Orgを確定し、認証済み組織情報を表示する。
    const targetOrg = getDefaultTargetOrg({ repoRoot, runSfCommand: runSfWithOutputCommand });
    // aliasまたはusernameに一致する1組織の表示情報と種別を確定する。
    const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfWithOutputCommand, targetOrg });
    // 利用者が接続先を確認できる最小項目を表示する。
    printTargetOrgInfo(orgInfo);

    // retrieveを開始するかターミナルで確認する。
    const prompt = createApprovalPrompt(createPrompt);
    // prompt終了後にも承認結果を参照できるよう回答を保持する。
    let answer;

    // 入力成功または例外のどちらでもpromptを閉じる。
    try {
        // 表示済みの組織から取得してよいか明示回答を受け取る。
        answer = await prompt.question('この組織からメタデータを取得しますか？ [y/N]: ');
    } finally {
        // readlineがプロセス終了を妨げないよう入力を閉じる。
        prompt.close();
    }

    // yまたはY以外の場合はretrieveを中止する。
    if (!isApproved(answer)) {
        // 承認されなかったことを操作結果として明示する。
        console.log('メタデータの取得を中止しました。');
        // 正常な利用者中止として0を返す。
        return 0;
    }

    // 最後まで実行した後に要確認manifestをまとめて報告する。
    const partialResults = [];

    // manifestの定義順にメタデータを取得する。
    for (const [index, manifest] of manifests.entries()) {
        // 失敗時に停止位置を特定できるよう、処理前に対象manifestを明示する。
        console.log(`[${index + 1}/${manifests.length}] ${path.basename(manifest)} を取得します。`);
        // 追加API呼び出しなしでmanifest単位の所要時間を測定する。
        const startedAt = now();
        // 長時間処理中もフリーズではないことが分かる定期表示を開始する。
        const progressTimer = setIntervalCommand(() => {
            // 現在のmanifest開始からの経過時間を小数1桁で表示する。
            const elapsedSeconds = (Math.max(0, now() - startedAt) / 1000).toFixed(1);
            console.log(`・実行中: ${elapsedSeconds}秒経過`);
        }, retrieveProgressIntervalMilliseconds);
        // 定期表示だけがNode.jsの終了を妨げないよう、実タイマーでは参照を外す。
        progressTimer?.unref?.();

        // JSON応答を取得して終了コード以外のwarningと件数も確認する。
        let commandResult;

        // 成功、失敗、例外のいずれでも定期表示を確実に停止する。
        try {
            // 非同期retrieveを待ちながら30秒ごとの進捗表示を動かす。
            commandResult = await runRetrieveCommand(
                ['project', 'retrieve', 'start', '--manifest', manifest, '--target-org', targetOrg, '--json'],
                repoRoot
            );
        } finally {
            // 次のmanifestへ進む前に現在の定期表示を解除する。
            clearIntervalCommand(progressTimer);
        }
        // 現在のmanifest処理だけの経過時間を確定する。
        const elapsedMilliseconds = Math.max(0, now() - startedAt);
        // 大きいfile一覧を小さい集計へ変換し、次のmanifest前に参照を解放する。
        const summary = parseRetrieveCommandResult(commandResult);
        // 成否、件数、warning、所要時間をmanifest直後に表示する。
        printRetrieveSummary(summary, elapsedMilliseconds);

        // CLI失敗、未完了、解析不能など継続できない異常だけ後続を停止する。
        if (summary.outcome === 'failure') {
            // hard failureの発生位置を保ったまま失敗終了する。
            return 1;
        }

        // warningまたはAPI上限到達は後続を止めず最終集計へ残す。
        if (summary.outcome === 'partial') {
            // manifest名と要確認理由だけを保持し、大きい取得結果は解放する。
            partialResults.push({ manifest: path.basename(manifest), summary });
        }
    }

    // warningやAPI上限到達があっても全manifestを実行したことを明示する。
    if (partialResults.length !== 0) {
        // 完全取得と誤認しない最終見出しを表示する。
        console.error('すべてのmanifestを実行しましたが、要確認の取得結果があります。');

        // 要確認manifestと理由を最後にまとめて表示する。
        for (const { manifest, summary } of partialResults) {
            // warning件数とAPI上限到達を1 manifest単位で確認できるようにする。
            console.error(`・${manifest}: ${summary.attentionReasons.join(' / ')}`);
        }

        // npmやCIへ完全性を確認できない結果として通知する。
        return 1;
    }

    // 途中で失敗や要確認結果がなく全manifestを処理できたことを明示する。
    console.log('すべてのメタデータ取得が完了しました。');
    // 全取得成功を呼び出し元へ返す。
    return 0;
}

// retrieveを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    // Promiseの完了を待ち、mainが決定した成否をプロセスへ反映する。
    main()
        .then((status) => {
            // npmが中止・成功・失敗を区別できるようmainの結果を反映する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 確認入力を処理できない場合も、原因だけを簡潔に表示する。
            console.error(`エラー: retrieveを開始できませんでした: ${error.message}`);
            // npmへ実行失敗を通知する。
            process.exitCode = 1;
        });
}

// テストスクリプトからmanifest一覧を参照できるようにする。
module.exports = {
    main,
    manifests,
    metadataApiFileLimit,
    parseManifestSource,
    parseRetrieveCommandResult,
    retrieveProgressIntervalMilliseconds,
    retrieveOutputMaxBuffer,
    runRetrieveWithOutput,
    validateManifestDefinitions,
    validateRetrieveManifestPlan
};
