// 実行コマンド: npm run sf:convert:profile
// 用途: 設定ファイルのProfile XMLから、手動deploy用Permission Set metadataを一括生成する。

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../common/approval');
const { runSfWithOutput } = require('../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../common/target-org');
const { convertProfile, parseProfileXml } = require('./internal/profile-converter');
const {
    createPermissionSetLabel,
    createTemporaryPermissionSetApiName,
    decodeProfileFileName,
    getExcludedUserLicenseReason,
    profileFileSuffix
} = require('./internal/profile-resolver');
const { getDeploymentCommand, getDryRunCommand, getVerificationCommand } = require('./internal/validation-runner');

// 実行位置に左右されずリポジトリ内の入力と出力を解決する。
const repoRoot = path.resolve(__dirname, '../..');
// 引数省略時に使うProfile選択ファイルを固定する。
const defaultConfigRelativePath = 'scripts/permissionset-conversion/profile-paths.config.txt';
// 生成物をGit管理対象外の専用領域へまとめる。
const defaultOutputRootRelativePath = 'scripts/permissionset-conversion/outputs';
// 組織情報を表示するCLIの応答待ちを制限する。
const sfCommandTimeoutMs = 120_000;

// 設定内容からコメントと空行を除き、実際のProfileパスだけを取り出す。
function parseConfiguredProfilePaths(content) {
    // 設定ファイルを行単位で処理できる入力だけを受け付ける。
    if (typeof content !== 'string') {
        // 読み取り結果の型が不正な場合は変換を始めない。
        throw new Error('Profileパス設定ファイルを文字列として読み込めませんでした。');
    }

    // BOM、空行、コメントを除いた入力パスを返す。
    return content
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'));
}

// CLIで受け付ける設定ファイル、入力directory、flagを限定する。
function parseArguments(argv) {
    // 通常実行ではファイル生成を有効にする。
    const options = { dryRun: false };
    // 値を取るオプションを実装済みの2種類へ限定する。
    const valueOptions = new Map([
        ['--config', 'configPath'],
        ['--objects-dir', 'objectsDirectory']
    ]);

    // 引数を順に消費し、値を次のオプションと混同しない。
    for (let index = 0; index < argv.length; index += 1) {
        // 判定対象のオプションを取り出す。
        const argument = argv[index];

        // ファイルを書かない確認モードを識別する。
        if (argument === '--dry-run') {
            // 以降の出力処理をdry-runへ切り替える。
            options.dryRun = true;
            // 値を取らないフラグの解析をここで完了する。
            continue;
        }

        // 接続や変換を行わないヘルプ要求を識別する。
        if (argument === '--help') {
            // 使用方法の表示だけを後続へ指示する。
            options.help = true;
            // ヘルプに値を要求しない。
            continue;
        }

        // 公開オプション名を内部設定のキーへ対応付ける。
        const optionName = valueOptions.get(argument);

        // 受け付けていない動作指定を拒否する。
        if (!optionName) {
            // 未対応の引数を利用者へ明示する。
            throw new Error(`未対応の引数です: ${argument}`);
        }

        // オプション直後の値を取得する。
        const value = argv[index + 1];

        // 値の欠落と次のオプションの取り違えを検出する。
        if (!value || value.startsWith('--')) {
            // 不足した値の指定先を通知する。
            throw new Error(`${argument}の値を指定してください。`);
        }

        // 同じオプションの上書きを防ぐ。
        if (options[optionName] !== undefined) {
            // どちらの指定を使うか推測せず重複を通知する。
            throw new Error(`${argument}は1回だけ指定してください。`);
        }

        // 検証した値だけを変換設定へ反映する。
        options[optionName] = value;
        // 消費した値を次のオプションとして再解析しない。
        index += 1;
    }

    // 検証済みの実行設定を返す。
    return options;
}

// 実行日時を出力フォルダで使用できるローカル時刻の固定形式へ変換する。
function formatRunTimestamp(runAt) {
    // 一意な出力名の基準として使える日時か判定する。
    if (!(runAt instanceof Date) || Number.isNaN(runAt.getTime())) {
        // 壊れた日時から出力先を作らない。
        throw new Error('出力フォルダへ使用する実行日時が不正です。');
    }

    // 各日時要素の桁数を揃える。
    const pad = (value, length = 2) => String(value).padStart(length, '0');

    // ローカル日時とミリ秒をフォルダ名として返す。
    return [
        `${runAt.getFullYear()}${pad(runAt.getMonth() + 1)}${pad(runAt.getDate())}`,
        `${pad(runAt.getHours())}${pad(runAt.getMinutes())}${pad(runAt.getSeconds())}-${pad(
            runAt.getMilliseconds(),
            3
        )}`
    ].join('-');
}

// 同じミリ秒の出力先が存在する場合も連番を付け、既存実行と重ならないフォルダを選ぶ。
function resolveRunOutputDirectory({ existsSync = fs.existsSync, projectRoot = repoRoot, runAt }) {
    // 生成物専用の親フォルダを決める。
    const outputRoot = path.resolve(projectRoot, defaultOutputRootRelativePath);
    // 同一実行で共有する日時識別子を作る。
    const timestamp = formatRunTimestamp(runAt);

    // 既存出力と重ならない候補を有限回だけ探す。
    for (let sequence = 0; sequence < 10_000; sequence += 1) {
        // 同時刻の既存出力がある場合だけ連番を付ける。
        const suffix = sequence === 0 ? '' : `-${String(sequence).padStart(4, '0')}`;
        // この試行で使用する出力先を組み立てる。
        const candidate = path.join(outputRoot, `${timestamp}${suffix}`);

        // 既存結果を上書きしない候補だけを選ぶ。
        if (!existsSync(candidate)) {
            // 空いている出力先を呼び出し元へ返す。
            return candidate;
        }
    }

    // 全候補が使用済みの場合は出力を中止する。
    throw new Error(`一意な出力フォルダを確保できませんでした: ${outputRoot}`);
}

// 設定ファイルと関連CustomField metadataの入力先を絶対pathへ揃える。
function resolveInputPaths(options, projectRoot = repoRoot) {
    // 後続の入力検証が使う絶対パスを返す。
    return {
        configPath: path.resolve(projectRoot, options.configPath ?? defaultConfigRelativePath),
        objectsDirectory: path.resolve(projectRoot, options.objectsDirectory ?? 'force-app/main/default/objects'),
        profilesDirectory: path.resolve(projectRoot, 'force-app/main/default/profiles')
    };
}

// コメントと空行を除き、リポジトリ内のProfile XMLだけを変換対象として読み込む。
function loadConfiguredProfiles({
    configPath,
    existsSync = fs.existsSync,
    profileRoot,
    projectRoot,
    readFileSync,
    statSync = fs.statSync
}) {
    // 設定ファイルの存在を読み取り前に検証する。
    if (!existsSync(configPath)) {
        // 不足している入力設定を通知する。
        throw new Error(`Profileパス設定ファイルが見つかりません: ${configPath}`);
    }

    // コメントを除いた変換対象一覧を取得する。
    const configuredPaths = parseConfiguredProfilePaths(readFileSync(configPath, 'utf8'));

    // 対象がないまま組織確認へ進まない。
    if (configuredPaths.length === 0) {
        // Profile選択が必要な設定ファイルを通知する。
        throw new Error(`変換対象のProfileパスが設定されていません: ${configPath}`);
    }

    // 同じProfileの二重変換を防ぐため既出パスを保持する。
    const resolvedPaths = new Set();

    // 各設定行を検証し、論理Profile名と実ファイルを対応付ける。
    return configuredPaths.map((configuredPath) => {
        // 別環境の絶対パスを入力として受け付けない。
        if (path.isAbsolute(configuredPath)) {
            // リポジトリ相対で指定すべき入力を通知する。
            throw new Error(`Profileパスはリポジトリルートからの相対パスで指定してください: ${configuredPath}`);
        }

        // 入力ファイルをリポジトリ基準で解決する。
        const profilePath = path.resolve(projectRoot, configuredPath);
        // 許可されたProfile領域からの位置を計算する。
        const relativeToProfileRoot = path.relative(profileRoot, profilePath);

        // Profile領域外への参照を拒否する。
        if (relativeToProfileRoot.startsWith('..') || path.isAbsolute(relativeToProfileRoot)) {
            // 許可された入力範囲を利用者へ伝える。
            throw new Error(`Profileパスはforce-app/main/default/profiles配下を指定してください: ${configuredPath}`);
        }

        // 別種メタデータの誤指定を識別する。
        if (!path.basename(profilePath).endsWith(profileFileSuffix)) {
            // Profile XMLではない指定を通知する。
            throw new Error(`Profile metadataファイルを指定してください: ${configuredPath}`);
        }

        // 未取得のProfileを読み込もうとする前に止める。
        if (!existsSync(profilePath)) {
            // 不足しているProfileパスを通知する。
            throw new Error(`設定されたProfile metadataが見つかりません: ${configuredPath}`);
        }

        // ディレクトリ等をXMLとして読ませない。
        if (!statSync(profilePath).isFile()) {
            // ファイルでない入力を通知する。
            throw new Error(`設定されたProfile metadataがファイルではありません: ${configuredPath}`);
        }

        // 表記の違いで同じProfileが重複していないか確認する。
        if (resolvedPaths.has(profilePath)) {
            // 二重変換になる設定行を通知する。
            throw new Error(`同じProfileパスが複数行に設定されています: ${configuredPath}`);
        }

        // 以降の重複検証へ入力パスを登録する。
        resolvedPaths.add(profilePath);

        // 検証済みパスと復号したmetadata名を返す。
        return {
            configuredPath,
            fullName: decodeProfileFileName(path.basename(profilePath)),
            profilePath
        };
    });
}

// 実行単位の出力フォルダとPermission Set API名から、metadataとレポートの出力先を作る。
function resolvePaths({ objectsDirectory, permissionSetApiName, profilePath, profilesDirectory, runOutputDirectory }) {
    // XMLと監査レポートを別フォルダへ対応付ける。
    return {
        objectsDirectory,
        outputPath: path.join(runOutputDirectory, 'permissionsets', `${permissionSetApiName}.permissionset-meta.xml`),
        profilePath,
        profilesDirectory,
        reportPath: path.join(runOutputDirectory, 'reports', `${permissionSetApiName}.conversion-report.json`)
    };
}

// 既存ファイルを暗黙に上書きしないよう、全出力先を作成前に確認する。
function validateOutputTargets({ existsSync, outputPath, protectedPaths = [], reportPath, writePermissionSet = true }) {
    // XMLとレポートが互いを上書きしないか確認する。
    if (path.resolve(outputPath) === path.resolve(reportPath)) {
        // 出力形式の異なるファイルには別の保存先を要求する。
        throw new Error('Permission Set XMLと変換レポートには異なる出力先を指定してください。');
    }

    // 生成可否に応じて実際に書き込むファイルだけを検証する。
    const targetPaths = writePermissionSet ? [outputPath, reportPath] : [reportPath];
    // 入力ファイルの表記差による上書き漏れを防ぐ。
    const protectedPathSet = new Set(protectedPaths.map((protectedPath) => path.resolve(protectedPath)));

    // すべての出力が入力を上書きしないか検証する。
    for (const targetPath of targetPaths) {
        // 保護対象と一致する出力先を検出する。
        if (protectedPathSet.has(path.resolve(targetPath))) {
            // 入力を破壊する保存先を拒否する。
            throw new Error(`入力ファイルを出力先として上書きできません: ${targetPath}`);
        }
    }

    // 生成失敗時に古いXMLが成功結果に見える状態を防ぐ。
    if (!writePermissionSet && existsSync(outputPath)) {
        // 古いXMLの存在と整理が必要な場所を通知する。
        throw new Error(
            `変換できないProfileに対する既存のPermission Set XMLが残っています。手動で退避または削除してから再実行してください: ${outputPath}`
        );
    }

    // 今回の出力先に残っているファイルを集める。
    const existingPaths = targetPaths.filter((targetPath) => existsSync(targetPath));

    // 既存結果がある場合は出力を中止する。
    if (existingPaths.length > 0) {
        // 衝突する既存ファイルを通知する。
        throw new Error(`一意な出力先に既存ファイルがあります: ${existingPaths.join(', ')}`);
    }
}

// 複数Profileの出力先重複と既存ファイルを、書き込み開始前にまとめて検証する。
function validateConversionPlans({ existsSync, plans }) {
    // バッチ内の全Profileを上書き保護対象にする。
    const protectedPaths = plans.map(({ paths }) => paths.profilePath);
    // バッチ内の出力先衝突を検出するための集合を用意する。
    const plannedTargets = new Set();

    // 全Profileの保存先を実際の書き込み前に検証する。
    for (const { conversion, paths } of plans) {
        // 生成を止めたProfileではレポートだけを出力対象にする。
        const targets = conversion.canWrite ? [paths.outputPath, paths.reportPath] : [paths.reportPath];

        // XMLとレポートの保存先を個別に照合する。
        for (const targetPath of targets) {
            // 表記差を除いて保存先を比較する。
            const resolvedTarget = path.resolve(targetPath);

            // 別Profileが同じ出力先を使う指定を検出する。
            if (plannedTargets.has(resolvedTarget)) {
                // バッチ内の上書きが起こる保存先を拒否する。
                throw new Error(`複数のProfileが同じ出力先を使用します: ${targetPath}`);
            }

            // 次のProfileの衝突検証へ保存先を登録する。
            plannedTargets.add(resolvedTarget);
        }

        // 入力保護と既存ファイル保護も各Profileへ適用する。
        validateOutputTargets({
            existsSync,
            outputPath: paths.outputPath,
            protectedPaths,
            reportPath: paths.reportPath,
            writePermissionSet: conversion.canWrite
        });
    }
}

// ロールバック対象の既存ファイルを順に削除し、削除できなかった例外だけを返す。
function cleanupOutputPaths({ existsSync, paths, unlinkSync }) {
    // 後始末で発生した例外を漏れなく集める。
    const rollbackErrors = [];

    // 今回の出力として指定されたパスだけを後始末する。
    for (const targetPath of paths) {
        // 1件の削除失敗で残りの後始末を中断しない。
        try {
            // すでに消えている出力の削除を要求しない。
            if (existsSync(targetPath)) {
                // 今回生成した対象ファイルを取り除く。
                unlinkSync(targetPath);
            }
        } catch (error) {
            // 削除できなかった理由を集計する。
            rollbackErrors.push(error);
        }
    }

    // 呼び出し元が復旧成否を判断できる例外一覧を返す。
    return rollbackErrors;
}

// 全内容を一時ファイルへ書いた後に排他的に公開し、途中失敗時は今回の出力だけを戻す。
function writeOutputDefinitions({
    closeSync = fs.closeSync,
    existsSync = fs.existsSync,
    linkSync = fs.linkSync,
    mkdirSync = fs.mkdirSync,
    openSync = fs.openSync,
    outputDefinitions,
    randomUUID = crypto.randomUUID,
    unlinkSync = fs.unlinkSync,
    writeFileSync = fs.writeFileSync
}) {
    // この書き込みだけが使用する一時名を作る。
    const transactionId = randomUUID();
    // 配置先と一時ファイルを対応付ける。
    const transactionalOutputs = outputDefinitions.map(({ content, targetPath }) => ({
        content,
        targetPath,
        temporaryPath: `${targetPath}.tmp-${transactionId}`
    }));
    // 失敗時に戻す配置済みファイルを追跡する。
    const installedOutputs = [];
    // 作成に成功した一時ファイルだけを後始末の対象にする。
    const createdTemporaryPaths = [];

    // 生成対象ごとの親フォルダを準備する。
    for (const { targetPath } of transactionalOutputs) {
        // 既存フォルダを保持したまま不足分だけを作る。
        mkdirSync(path.dirname(targetPath), { recursive: true });
    }

    // 書き込み失敗をバッチ単位で回復できるようにする。
    try {
        // 配置前に全出力を一時ファイルへ保存する。
        for (const { content, temporaryPath } of transactionalOutputs) {
            // 名前の競合時は既存ファイルへ触れず、作成できたファイルだけを所有する。
            const descriptor = openSync(temporaryPath, 'wx');
            // 部分書き込みで失敗したファイルも回収する。
            createdTemporaryPaths.push(temporaryPath);
            // 書き込みの成否にかかわらず開いたファイルを閉じる。
            try {
                // 自分が作成したファイル記述子へ全内容を書き込む。
                writeFileSync(descriptor, content, { encoding: 'utf8' });
            } finally {
                // 完成した内容を公開する前に記述子を解放する。
                closeSync(descriptor);
            }
        }

        // 書き込み中に出力先が使われ始めていないか再確認する。
        const newlyExistingPaths = transactionalOutputs
            .map(({ targetPath }) => targetPath)
            .filter((targetPath) => existsSync(targetPath));

        // 新たな衝突があれば配置せず中止する。
        if (newlyExistingPaths.length > 0) {
            // 途中で生じた出力先競合を通知する。
            throw new Error(`出力先が処理中に作成されました: ${newlyExistingPaths.join(', ')}`);
        }

        // 完成した一時ファイルを同じディレクトリ内の最終パスへ公開する。
        for (const output of transactionalOutputs) {
            // ハードリンク作成は既存パスを置換しないため、存在確認後の競合も拒否する。
            linkSync(output.temporaryPath, output.targetPath);
            // 後続の配置失敗に備えて完了済み出力を記録する。
            installedOutputs.push(output);
        }
        // 全配置が成功したら一時名だけを削除し、最終パスの内容を残す。
        for (const temporaryPath of createdTemporaryPaths) {
            // 最終パスと同じ内容を参照する一時リンクを取り除く。
            unlinkSync(temporaryPath);
        }
    } catch (error) {
        // 配置済み出力と残った一時ファイルの両方を後始末する。
        const rollbackErrors = [
            ...cleanupOutputPaths({
                existsSync,
                paths: [...installedOutputs].reverse().map(({ targetPath }) => targetPath),
                unlinkSync
            }),
            ...cleanupOutputPaths({
                existsSync,
                paths: createdTemporaryPaths,
                unlinkSync
            })
        ];

        // 復旧まで失敗した場合は元エラーと区別する。
        if (rollbackErrors.length > 0) {
            // 元の出力失敗と後始末失敗をまとめて通知する。
            throw new AggregateError([error, ...rollbackErrors], '出力失敗後のロールバックに失敗しました。');
        }

        // 復旧成功時も元の書き込み失敗を呼び出し元へ返す。
        throw error;
    }
}

// 単一ProfileのXMLとレポートを同一トランザクションで出力する。
function writeConversionOutputs({
    closeSync = fs.closeSync,
    existsSync = fs.existsSync,
    linkSync = fs.linkSync,
    mkdirSync = fs.mkdirSync,
    openSync = fs.openSync,
    outputPath,
    permissionSetXml,
    protectedPaths = [],
    randomUUID = crypto.randomUUID,
    report,
    reportPath,
    unlinkSync = fs.unlinkSync,
    writePermissionSet = true,
    writeFileSync = fs.writeFileSync
}) {
    // 単一Profileでも既存出力と入力の保護を適用する。
    validateOutputTargets({
        existsSync,
        outputPath,
        protectedPaths,
        reportPath,
        writePermissionSet
    });

    // XMLとレポートをまとめて保存する。
    writeOutputDefinitions({
        closeSync,
        existsSync,
        linkSync,
        mkdirSync,
        openSync,
        outputDefinitions: [
            ...(writePermissionSet ? [{ content: permissionSetXml, targetPath: outputPath }] : []),
            { content: `${JSON.stringify(report, null, 2)}\n`, targetPath: reportPath }
        ],
        randomUUID,
        unlinkSync,
        writeFileSync
    });
}

// 複数Profileの全XMLとレポートを一括し、どれか1件の失敗時は全出力を元へ戻す。
function writeConversionPlans({
    closeSync = fs.closeSync,
    existsSync = fs.existsSync,
    linkSync = fs.linkSync,
    mkdirSync = fs.mkdirSync,
    openSync = fs.openSync,
    plans,
    randomUUID = crypto.randomUUID,
    unlinkSync = fs.unlinkSync,
    writeFileSync = fs.writeFileSync
}) {
    // バッチ全体の保存先を先に検証する。
    validateConversionPlans({ existsSync, plans });
    // 生成可否に合ったXMLとレポートの保存内容を集める。
    const outputDefinitions = [
        ...plans.flatMap(({ conversion, paths }) => [
            ...(conversion.canWrite ? [{ content: conversion.permissionSetXml, targetPath: paths.outputPath }] : []),
            { content: `${JSON.stringify(conversion.report, null, 2)}\n`, targetPath: paths.reportPath }
        ])
    ];

    // バッチ全体へ同一の書き込み・復旧処理を適用する。
    writeOutputDefinitions({
        closeSync,
        existsSync,
        linkSync,
        mkdirSync,
        openSync,
        outputDefinitions,
        randomUUID,
        unlinkSync,
        writeFileSync
    });
}

// 変換件数、スキップと確認事項を、生成ファイルを開かなくても確認できるよう表示する。
function printSummary({ canWrite, options, paths, report, writeLine }) {
    // 個別Profileの結果表示の開始を明示する。
    writeLine('ProfileからPermission Setへの変換結果');
    // 結果を元Profileへ対応付ける。
    writeLine(`・Profile Metadata Name: ${report.source.profile}`);
    // 設定画面で使用する権限セットラベルを伝える。
    writeLine(`・Permission Set Label: ${report.permissionSet.label}`);
    // 元Profileのライセンスを表示する。
    writeLine(`・User License: ${report.source.userLicense}`);
    // 生成した権限セットのライセンスを表示する。
    writeLine(`・Permission Set License: ${report.permissionSet.license}`);
    // 後続の検証で使用する仮API名を伝える。
    writeLine(`・Permission Set（仮API名）: ${report.permissionSet.apiName}`);
    // 変換した権限の明細件数を表示する。
    writeLine(`・converted: ${report.summary.converted}件`);
    // Profile側にある設定の件数を表示する。
    writeLine(`・retainedInProfile: ${report.summary.retainedInProfile}件`);
    // 無効設定として省略した件数を表示する。
    writeLine(`・skippedDisabled: ${report.summary.skippedDisabled}件`);
    // 未対応設定のスキップ件数を表示する。
    writeLine(`・skippedUnsupported: ${report.summary.skippedUnsupported}件`);
    // 組織での確認事項の件数を表示する。
    writeLine(`・requiresValidation: ${report.summary.requiresValidation}件`);
    // 生成を止める問題の件数を表示する。
    writeLine(`・unsupportedUnknown: ${report.summary.unsupportedUnknown}件`);
    // 生成後に確認する事項を表示する。
    printReviewEntries('requiresValidation', report.requiresValidation, writeLine);
    // 省略した未対応設定を利用者に伝える。
    printReviewEntries('skippedUnsupported', report.skippedUnsupported, writeLine);
    // 生成を止める具体的な理由を表示する。
    printReviewEntries('unsupportedUnknown', report.unsupportedUnknown, writeLine);

    // スキップと生成失敗を区別する。
    if (!canWrite) {
        // ファイルを作らない確認モードの失敗表示を選ぶ。
        if (options.dryRun) {
            // dry-runでも生成不可であることを伝える。
            writeLine('・結果: 未対応または不正な設定があるため、dry-runで書き込み不可');
        } else {
            // 生成を止めた理由を確認できる保存先を伝える。
            writeLine(`・変換レポート: ${paths.reportPath}`);
            // 不完全なXMLを出力しなかったことを明示する。
            writeLine('・結果: 未対応または不正な設定があるため、Permission Set XMLは生成していません。');
        }

        // 生成失敗を成功表示へ進めない。
        return;
    }

    // dry-runであることと実際の生成を区別する。
    if (options.dryRun) {
        // 通常実行時のXML保存先を予告する。
        writeLine(`・Permission Set XML出力予定: ${paths.outputPath}`);
        // 通常実行時のレポート保存先を予告する。
        writeLine(`・変換レポート出力予定: ${paths.reportPath}`);
        // ファイル未生成とスキップの有無を伝える。
        writeLine(
            report.summary.skippedUnsupported > 0
                ? '・結果: 変換可能・スキップあり（dry-runのためファイルを生成していません）。'
                : '・結果: dry-runのためファイルを生成していません。'
        );
    } else {
        // 生成されたXMLの保存先を表示する。
        writeLine(`・Permission Set XML: ${paths.outputPath}`);
        // 生成されたレポートの保存先を表示する。
        writeLine(`・変換レポート: ${paths.reportPath}`);
        // スキップのある生成を全設定の変換成功と区別する。
        writeLine(
            report.summary.skippedUnsupported > 0
                ? '・結果: 生成成功・スキップあり。'
                : '・結果: Permission Set metadataを生成しました。'
        );
    }
}

// 画面出力が過大にならない範囲で、確認事項と書き込み阻止理由を表示する。
function printReviewEntries(category, entries, writeLine) {
    // 端末表示を先頭20件へ抑える。
    const visibleEntries = entries.slice(0, 20);

    // 表示対象の明細だけを端末へ出す。
    for (const entry of visibleEntries) {
        // 設定の識別子と対応する理由を表示する。
        writeLine(`・${category}: ${entry.sourceElement}.${entry.name} - ${entry.message}`);
    }

    // 表示しきれない明細があるか判定する。
    if (entries.length > visibleEntries.length) {
        // 省略した明細件数とレポートの参照を案内する。
        writeLine(`・${category}: ほか${entries.length - visibleEntries.length}件は変換レポートを確認してください。`);
    }
}

// 変換前にobjects directoryの存在と種別を確認する。
function validateInputDirectory({ existsSync, inputPaths, statSync }) {
    // 項目定義の入力フォルダが存在するか確認する。
    if (!existsSync(inputPaths.objectsDirectory)) {
        // 不足する項目定義フォルダを通知する。
        throw new Error(`objects directoryが見つかりません: ${inputPaths.objectsDirectory}`);
    }

    // 通常ファイル等を項目定義フォルダとして使わない。
    if (!statSync(inputPaths.objectsDirectory).isDirectory()) {
        // 入力フォルダの種別誤りを通知する。
        throw new Error(`objects directoryがディレクトリではありません: ${inputPaths.objectsDirectory}`);
    }
}

// 実行対象の設定、件数、出力先を画面へ表示する。
function printRunConfiguration({ configuredProfiles, inputPaths, runOutputDirectory, writeLine }) {
    // 実行時に使用するProfile選択ファイルを示す。
    writeLine(`Profileパス設定: ${inputPaths.configPath}`);
    // 変換対象の総件数を示す。
    writeLine(`変換対象: ${configuredProfiles.length}件`);
    // 今回だけの出力先を示す。
    writeLine(`出力先: ${runOutputDirectory}`);
}

// Default Target Orgの表示後に通常確認と本番環境の追加確認を行う。
async function confirmRun({ configuredProfileCount, createPrompt, options, orgInfo, writeLine }) {
    // テストまたは端末の確認入力を共通のpromptへ揃える。
    const prompt = createApprovalPrompt(createPrompt);
    // dry-runと通常生成で実際に行うローカル処理を明示する。
    const requestedOperation = options.dryRun
        ? `${configuredProfileCount}件のローカルProfile XMLの変換結果をdry-runで確認`
        : `${configuredProfileCount}件のローカルProfile XMLからPermission Set metadataを生成`;

    // 承認入力中に失敗しても入力リソースを解放する。
    try {
        // 表示済みの接続組織を確認した利用者だけが処理を続行できるようにする。
        const targetAnswer = await prompt.question(`この接続組織を確認し、${requestedOperation}しますか？ [y/N]: `);

        // yまたはY以外ではローカル生成も開始しない。
        if (!isApproved(targetAnswer)) {
            // 利用者の中止を画面へ反映する。
            writeLine('ProfileからPermission Setへの変換を中止しました。');
            // 承認がない変換を開始させない。
            return false;
        }

        // 本番環境以外は通常確認だけで処理を続行する。
        if (orgInfo.type !== orgTypes.PRODUCTION) {
            // 本番以外は通常承認だけで続行する。
            return true;
        }

        // 本番環境であることを明示した別の質問で誤操作を再確認する。
        const environmentAnswer = await prompt.question(
            `${orgInfo.typeLabel}です。${requestedOperation}してよろしいですか？ [y/N]: `
        );

        // 本番環境の追加確認がない場合も生成を開始しない。
        if (!isApproved(environmentAnswer)) {
            // 本番環境の追加確認での中止を通知する。
            writeLine('ProfileからPermission Setへの変換を中止しました。');
            // 追加承認がない本番環境では続行しない。
            return false;
        }

        // 両方の確認を通過した本番環境だけ処理を許可する。
        return true;
    } finally {
        // 承認、中止、入力例外のすべてでreadlineを終了する。
        prompt.close();
    }
}

// Profile XMLを一度解析し、最終変換で再利用する入力と出力パスを準備する。
function prepareProfileConversions({ existsSync, inputPaths, profiles, readFileSync, runOutputDirectory }) {
    // フォルダと仮API名で同じ実行識別子を使う。
    const runIdentifier = path.basename(runOutputDirectory);
    // ライセンスで対象外となったProfileを記録する。
    const excludedProfiles = [];
    // 変換可能なProfileの入力と出力先を集める。
    const preparedProfiles = [];

    // 入力順を保って各Profileの変換準備を行う。
    for (const profile of profiles) {
        // 命名と変換で共有するProfile XMLを入力ファイルから一度だけ読み込む。
        const profileXml = readFileSync(profile.profilePath, 'utf8');
        // 元ProfileのUser Licenseを含む解析結果を仮API名の生成前に確定する。
        const profileModel = parseProfileXml(profileXml);
        // 元XMLのライセンスを除外と命名の両方で使う。
        const userLicense = profileModel.profile.userLicense;

        // 本スクリプトの変換対象外ライセンスをProfile単位で記録する。
        const excludedReason = getExcludedUserLicenseReason(userLicense);

        // Profile単位の対象外を通常変換と分離する。
        if (excludedReason !== undefined) {
            // 対象外のProfileと理由を画面表示用に保存する。
            excludedProfiles.push({
                profileFullName: profile.fullName,
                profilePath: profile.configuredPath,
                reason: excludedReason,
                userLicense
            });
            // 対象外ProfileへXMLの生成計画を作らない。
            continue;
        }

        // 生成対象だけに連番を付ける。
        const sequence = preparedProfiles.length + 1;
        // User License、実行日時、Profile連番から衝突しない仮API名を作る。
        const permissionSetApiName = createTemporaryPermissionSetApiName({
            runIdentifier,
            sequence,
            userLicense
        });
        // 仮API名に一致する保存先を解決する。
        const paths = resolvePaths({
            ...inputPaths,
            permissionSetApiName,
            profilePath: profile.profilePath,
            runOutputDirectory
        });
        // 解析済み入力を後続へ渡して重複読み取りを避ける。
        preparedProfiles.push({
            profileModel,
            conversionInput: {
                existsSync,
                objectsDirectory: paths.objectsDirectory,
                permissionSetApiName,
                permissionSetLabel: createPermissionSetLabel({
                    profileFullName: profile.fullName,
                    runIdentifier,
                    sequence
                }),
                profileFullName: profile.fullName,
                profileModel,
                profilePath: profile.configuredPath,
                profileXml,
                readFileSync
            },
            paths
        });
    }

    // 対象外一覧と変換準備済み一覧を返す。
    return { excludedProfiles, preparedProfiles };
}

// 解析済みのローカルProfileと関連metadataだけを使用して変換結果を作る。
function createConversionPlans({ preparedProfiles }) {
    // ローカル入力だけで各Profileの変換内容を確定する。
    return preparedProfiles.map(({ conversionInput, paths }) => ({
        conversion: convertProfile(conversionInput),
        paths
    }));
}

// 利用者が後からDefault Target Orgを検証、デプロイ、保存結果確認するコマンドを表示する。
function printManualCommands({ projectRoot, sourceDirectory, writeLine }) {
    // 変換結果と後続コマンドの表示を区切る。
    writeLine('');
    // 保存しない組織検証のコマンドを案内する。
    writeLine('Permission Setのdry-runコマンド:');
    // 生成したXMLだけを対象とするdry-run例を表示する。
    writeLine(getDryRunCommand({ projectRoot, sourceDirectory }));
    // dry-runと実保存の案内を区切る。
    writeLine('');
    // 実保存するコマンドであることを明示する。
    writeLine('Permission Setのデプロイコマンド:');
    // 生成したXMLだけを対象とするdeploy例を表示する。
    writeLine(getDeploymentCommand({ projectRoot, sourceDirectory }));
    // 保存結果確認の案内を区切る。
    writeLine('');
    // 保存後の検証工程を案内する。
    writeLine('デプロイ後の保存結果確認コマンド:');
    // 同じ生成フォルダを比較するコマンドを表示する。
    writeLine(getVerificationCommand({ projectRoot, sourceDirectory }));
    // コマンド例と共通の注意書きを空行で区切る。
    writeLine('');
    // 後続コマンドが使う接続先の決定方法を伝える。
    writeLine('※各コマンドはSalesforce CLIのDefault Target Orgを対象にします。');
    // 接続情報と変換内容の独立性を説明する。
    writeLine('※接続組織の情報はPermission Setの変換内容に使用していません。');
    // 生成時のAPI名が仮名であることを伝える。
    writeLine('※生成したPermission SetのAPI名は仮名です。');
    // 保存結果確認後に行う命名操作を案内する。
    writeLine('※保存結果確認後に、Salesforce設定画面の「プロパティを編集」から最終API名へ変更してください。');
}

// 全変換結果を必要に応じて書き込み、画面表示して要修正件数を返す。
function processConversionPlans({ excludedProfiles, existsSync, mkdirSync, options, plans, writeFileSync, writeLine }) {
    // 通常実行で生成計画がある場合だけファイルを書く。
    if (!options.dryRun && plans.length > 0) {
        // 全Profileの出力を一括して保存する。
        writeConversionPlans({ existsSync, mkdirSync, plans, writeFileSync });
    }

    // すべてのProfileについて結果を表示する。
    for (const { conversion, paths } of plans) {
        // スキップ・失敗・成功を個別に通知する。
        printSummary({ canWrite: conversion.canWrite, options, paths, report: conversion.report, writeLine });
    }

    // 生成対象外のProfileも結果一覧から漏らさない。
    for (const excludedProfile of excludedProfiles) {
        // Profile単位の対象外であることを表示する。
        writeLine('ProfileからPermission Setへの変換対象外');
        // 対象外の元Profileを特定する。
        writeLine(`・Profile Metadata Name: ${excludedProfile.profileFullName}`);
        // 対象外の入力ファイルを特定する。
        writeLine(`・Profile Path: ${excludedProfile.profilePath}`);
        // 除外判断の基準となるライセンスを表示する。
        writeLine(`・User License: ${excludedProfile.userLicense}`);
        // 対象外となった理由を表示する。
        writeLine(`・理由: ${excludedProfile.reason}`);
    }

    // スキップだけのProfileを失敗件数へ含めない。
    const failedCount = plans.filter(({ conversion }) => !conversion.canWrite).length;
    // 生成可能なProfileの件数を求める。
    const generatedCount = plans.length - failedCount;
    // 生成、対象外、要修正を区別した総計を表示する。
    writeLine(
        `Permission Set metadata生成結果: 生成${generatedCount}件、対象外${excludedProfiles.length}件、要修正${failedCount}件`
    );
    // 後続コマンドの表示可否と終了コードの判断材料を返す。
    return { failedCount, generatedCount };
}

// CLI実行時の標準依存をテスト差し替え値と一箇所で合成する。
function resolveMainDependencies(overrides) {
    // 通常依存を保ちつつテスト用依存を差し替え可能にする。
    return {
        argv: process.argv.slice(2),
        createPrompt: undefined,
        existsSync: fs.existsSync,
        mkdirSync: fs.mkdirSync,
        now: () => new Date(),
        projectRoot: repoRoot,
        readFileSync: fs.readFileSync,
        runSfWithOutputCommand: runSfWithOutput,
        statSync: fs.statSync,
        writeFileSync: fs.writeFileSync,
        writeLine: console.log,
        ...overrides
    };
}

// 接続組織を確認した後、ローカルProfile XMLだけからPermission Set候補を生成する。
async function main(overrides = {}) {
    // 実行に必要な依存を一箇所で確定する。
    const {
        argv,
        createPrompt,
        existsSync,
        mkdirSync,
        now,
        projectRoot,
        readFileSync,
        runSfWithOutputCommand,
        statSync,
        writeFileSync,
        writeLine
    } = resolveMainDependencies(overrides);
    // 組織へ接続する前にCLI引数を検証する。
    const options = parseArguments(argv);

    // ヘルプでは入力検証や組織接続を開始しない。
    if (options.help) {
        // 対応している引数を案内する。
        writeLine('使用方法: npm run sf:convert:profile -- [--config <file>] [--objects-dir <directory>] [--dry-run]');
        // ヘルプの表示を正常終了として返す。
        return 0;
    }

    // 入力ファイル群の基準パスを解決する。
    const inputPaths = resolveInputPaths(options, projectRoot);
    // 今回の出力先を既存実行と分離する。
    const runOutputDirectory = resolveRunOutputDirectory({ existsSync, projectRoot, runAt: now() });
    // 入力Profileの範囲と存在を先に検証する。
    const configuredProfiles = loadConfiguredProfiles({
        configPath: inputPaths.configPath,
        existsSync,
        profileRoot: inputPaths.profilesDirectory,
        projectRoot,
        readFileSync,
        statSync
    });
    // 項目定義の入力が読み取り可能なディレクトリか確認する。
    validateInputDirectory({ existsSync, inputPaths, statSync });
    // 承認前に変換範囲と出力先を示す。
    printRunConfiguration({ configuredProfiles, inputPaths, runOutputDirectory, writeLine });

    // 組織確認用CLIが停止し続けないよう共通の時間上限を適用する。
    const runOrgInfoCommand = (args, workingDirectory) =>
        runSfWithOutputCommand(args, workingDirectory, undefined, undefined, sfCommandTimeoutMs);
    // CLI設定から引数指定のないDefault Target Orgを取得する。
    const targetOrg = getDefaultTargetOrg({ repoRoot: projectRoot, runSfCommand: runOrgInfoCommand });
    // 認証済み組織一覧から接続組織の表示情報と種別を確定する。
    const orgInfo = getTargetOrgInfo({ repoRoot: projectRoot, runSfCommand: runOrgInfoCommand, targetOrg });

    // 変換前に接続組織を利用者へ表示する。
    printTargetOrgInfo(orgInfo, writeLine);
    // 通常確認と必要な本番環境の追加確認を実行する。
    const approved = await confirmRun({
        configuredProfileCount: configuredProfiles.length,
        createPrompt,
        options,
        orgInfo,
        writeLine
    });

    // 利用者が承認しなかった場合はファイルを生成せず正常終了する。
    if (!approved) {
        // 利用者による中止をエラー扱いしない。
        return 0;
    }

    // 組織情報を渡さず、ローカルProfileと関連metadataだけを変換入力にする。
    const { excludedProfiles, preparedProfiles } = prepareProfileConversions({
        existsSync,
        inputPaths,
        profiles: configuredProfiles,
        readFileSync,
        runOutputDirectory
    });
    // 準備済みのローカル入力から生成内容を作る。
    const plans = createConversionPlans({ preparedProfiles });
    // 必要なファイル生成と結果表示をまとめて実行する。
    const { failedCount, generatedCount } = processConversionPlans({
        excludedProfiles,
        existsSync,
        mkdirSync,
        options,
        plans,
        writeFileSync,
        writeLine
    });

    // 後続コマンドを出すべきでない状態を判定する。
    if (options.dryRun || failedCount > 0 || generatedCount === 0) {
        // 生成失敗が原因の場合だけその理由を通知する。
        if (failedCount > 0) {
            // 不完全なバッチに対する後続操作の案内を出さない。
            writeLine('Permission Setを生成できないProfileがあるため、後続コマンドは表示しません。');
        }

        // スキップは成功とし、生成失敗だけを非0終了にする。
        return failedCount === 0 ? 0 : 1;
    }

    // 今回の権限セットだけを後続操作のscopeにする。
    const permissionSetsDirectory = path.join(runOutputDirectory, 'permissionsets');
    // dry-run、deploy、保存結果確認を別操作として案内する。
    printManualCommands({ projectRoot, sourceDirectory: permissionSetsDirectory, writeLine });
    // ファイル生成の正常終了を返す。
    return 0;
}

// テストから読み込むだけでは変換を開始しない。
if (require.main === module) {
    // CLIとして起動された場合だけ変換を実行する。
    main()
        .then((status) => {
            // 変換結果の終了コードをプロセスへ反映する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 処理失敗の理由を端末へ通知する。
            console.error(`エラー: ProfileをPermission Setへ変換できませんでした: ${error.message}`);
            // 例外終了を呼び出し元へ伝える。
            process.exitCode = 1;
        });
}

module.exports = {
    confirmRun,
    defaultConfigRelativePath,
    defaultOutputRootRelativePath,
    formatRunTimestamp,
    loadConfiguredProfiles,
    main,
    parseArguments,
    parseConfiguredProfilePaths,
    printReviewEntries,
    resolveInputPaths,
    resolvePaths,
    resolveRunOutputDirectory,
    validateConversionPlans,
    validateOutputTargets,
    writeConversionOutputs,
    writeConversionPlans
};
