// 実行コマンド: npm run sf:convert:profile
// 用途: 設定ファイルのProfile XMLから、手動deploy用Permission Set metadataを一括生成する。

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { convertProfile, parseProfileXml } = require('./internal/profile-converter');
const {
    createPermissionSetApiName,
    createPermissionSetLabel,
    decodeProfileFileName,
    profileFileSuffix
} = require('./internal/profile-resolver');
const {
    getDeploymentCommand,
    getProductionValidationCommand,
    getSandboxValidationCommand,
    getVerificationCommand
} = require('./internal/validation-runner');

const repoRoot = path.resolve(__dirname, '../..');
const defaultConfigRelativePath = 'scripts/permissionset-conversion/profile-paths.config.txt';
const defaultOutputRootRelativePath = 'scripts/permissionset-conversion/outputs';

// 設定内容からコメントと空行を除き、実際のProfileパスだけを取り出す。
function parseConfiguredProfilePaths(content) {
    if (typeof content !== 'string') {
        throw new Error('Profileパス設定ファイルを文字列として読み込めませんでした。');
    }

    return content
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'));
}

// CLIで受け付ける設定ファイル、入力directory、flagを限定する。
function parseArguments(argv) {
    const options = { dryRun: false };
    const valueOptions = new Map([
        ['--config', 'configPath'],
        ['--objects-dir', 'objectsDirectory']
    ]);

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];

        if (argument === '--dry-run') {
            options.dryRun = true;
            continue;
        }

        if (argument === '--help') {
            options.help = true;
            continue;
        }

        const optionName = valueOptions.get(argument);

        if (!optionName) {
            throw new Error(`未対応の引数です: ${argument}`);
        }

        const value = argv[index + 1];

        if (!value || value.startsWith('--')) {
            throw new Error(`${argument}の値を指定してください。`);
        }

        if (options[optionName] !== undefined) {
            throw new Error(`${argument}は1回だけ指定してください。`);
        }

        options[optionName] = value;
        index += 1;
    }

    return options;
}

// 実行日時を出力フォルダで使用できるローカル時刻の固定形式へ変換する。
function formatRunTimestamp(runAt) {
    if (!(runAt instanceof Date) || Number.isNaN(runAt.getTime())) {
        throw new Error('出力フォルダへ使用する実行日時が不正です。');
    }

    const pad = (value, length = 2) => String(value).padStart(length, '0');

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
    const outputRoot = path.resolve(projectRoot, defaultOutputRootRelativePath);
    const timestamp = formatRunTimestamp(runAt);

    for (let sequence = 0; sequence < 10_000; sequence += 1) {
        const suffix = sequence === 0 ? '' : `-${String(sequence).padStart(4, '0')}`;
        const candidate = path.join(outputRoot, `${timestamp}${suffix}`);

        if (!existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(`一意な出力フォルダを確保できませんでした: ${outputRoot}`);
}

// 設定ファイルと関連CustomField metadataの入力先を絶対pathへ揃える。
function resolveInputPaths(options, projectRoot = repoRoot) {
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
    if (!existsSync(configPath)) {
        throw new Error(`Profileパス設定ファイルが見つかりません: ${configPath}`);
    }

    const configuredPaths = parseConfiguredProfilePaths(readFileSync(configPath, 'utf8'));

    if (configuredPaths.length === 0) {
        throw new Error(`変換対象のProfileパスが設定されていません: ${configPath}`);
    }

    const resolvedPaths = new Set();

    return configuredPaths.map((configuredPath) => {
        if (path.isAbsolute(configuredPath)) {
            throw new Error(`Profileパスはリポジトリルートからの相対パスで指定してください: ${configuredPath}`);
        }

        const profilePath = path.resolve(projectRoot, configuredPath);
        const relativeToProfileRoot = path.relative(profileRoot, profilePath);

        if (relativeToProfileRoot.startsWith('..') || path.isAbsolute(relativeToProfileRoot)) {
            throw new Error(`Profileパスはforce-app/main/default/profiles配下を指定してください: ${configuredPath}`);
        }

        if (!path.basename(profilePath).endsWith(profileFileSuffix)) {
            throw new Error(`Profile metadataファイルを指定してください: ${configuredPath}`);
        }

        if (!existsSync(profilePath)) {
            throw new Error(`設定されたProfile metadataが見つかりません: ${configuredPath}`);
        }

        if (!statSync(profilePath).isFile()) {
            throw new Error(`設定されたProfile metadataがファイルではありません: ${configuredPath}`);
        }

        if (resolvedPaths.has(profilePath)) {
            throw new Error(`同じProfileパスが複数行に設定されています: ${configuredPath}`);
        }

        resolvedPaths.add(profilePath);

        return {
            configuredPath,
            fullName: decodeProfileFileName(path.basename(profilePath)),
            profilePath
        };
    });
}

// 実行単位の出力フォルダとPermission Set API名から、metadataとレポートの出力先を作る。
function resolvePaths({ objectsDirectory, permissionSetApiName, profilePath, profilesDirectory, runOutputDirectory }) {
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
    if (path.resolve(outputPath) === path.resolve(reportPath)) {
        throw new Error('Permission Set XMLと変換レポートには異なる出力先を指定してください。');
    }

    const targetPaths = writePermissionSet ? [outputPath, reportPath] : [reportPath];
    const protectedPathSet = new Set(protectedPaths.map((protectedPath) => path.resolve(protectedPath)));

    for (const targetPath of targetPaths) {
        if (protectedPathSet.has(path.resolve(targetPath))) {
            throw new Error(`入力ファイルを出力先として上書きできません: ${targetPath}`);
        }
    }

    if (!writePermissionSet && existsSync(outputPath)) {
        throw new Error(
            `変換できないProfileに対する既存のPermission Set XMLが残っています。手動で退避または削除してから再実行してください: ${outputPath}`
        );
    }

    const existingPaths = targetPaths.filter((targetPath) => existsSync(targetPath));

    if (existingPaths.length > 0) {
        throw new Error(`一意な出力先に既存ファイルがあります: ${existingPaths.join(', ')}`);
    }
}

// 複数Profileの出力先重複と既存ファイルを、書き込み開始前にまとめて検証する。
function validateConversionPlans({ existsSync, plans }) {
    const protectedPaths = plans.map(({ paths }) => paths.profilePath);
    const plannedTargets = new Set();

    for (const { conversion, paths } of plans) {
        const targets = conversion.canWrite ? [paths.outputPath, paths.reportPath] : [paths.reportPath];

        for (const targetPath of targets) {
            const resolvedTarget = path.resolve(targetPath);

            if (plannedTargets.has(resolvedTarget)) {
                throw new Error(`複数のProfileが同じ出力先を使用します: ${targetPath}`);
            }

            plannedTargets.add(resolvedTarget);
        }

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
    const rollbackErrors = [];

    for (const targetPath of paths) {
        try {
            if (existsSync(targetPath)) {
                unlinkSync(targetPath);
            }
        } catch (error) {
            rollbackErrors.push(error);
        }
    }

    return rollbackErrors;
}

// 複数Profileを含む全内容を一時ファイルへ書いた後に置換し、途中失敗時は元の出力へ戻す。
function writeOutputDefinitions({
    existsSync = fs.existsSync,
    mkdirSync = fs.mkdirSync,
    outputDefinitions,
    randomUUID = crypto.randomUUID,
    renameSync = fs.renameSync,
    unlinkSync = fs.unlinkSync,
    writeFileSync = fs.writeFileSync
}) {
    const transactionId = randomUUID();
    const transactionalOutputs = outputDefinitions.map(({ content, targetPath }) => ({
        content,
        targetPath,
        temporaryPath: `${targetPath}.tmp-${transactionId}`
    }));
    const installedOutputs = [];

    for (const { targetPath } of transactionalOutputs) {
        mkdirSync(path.dirname(targetPath), { recursive: true });
    }

    try {
        for (const { content, temporaryPath } of transactionalOutputs) {
            writeFileSync(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
        }

        const newlyExistingPaths = transactionalOutputs
            .map(({ targetPath }) => targetPath)
            .filter((targetPath) => existsSync(targetPath));

        if (newlyExistingPaths.length > 0) {
            throw new Error(`出力先が処理中に作成されました: ${newlyExistingPaths.join(', ')}`);
        }

        for (const output of transactionalOutputs) {
            renameSync(output.temporaryPath, output.targetPath);
            installedOutputs.push(output);
        }
    } catch (error) {
        const rollbackErrors = [
            ...cleanupOutputPaths({
                existsSync,
                paths: [...installedOutputs].reverse().map(({ targetPath }) => targetPath),
                unlinkSync
            }),
            ...cleanupOutputPaths({
                existsSync,
                paths: transactionalOutputs.map(({ temporaryPath }) => temporaryPath),
                unlinkSync
            })
        ];

        if (rollbackErrors.length > 0) {
            throw new AggregateError([error, ...rollbackErrors], '出力失敗後のロールバックに失敗しました。');
        }

        throw error;
    }
}

// 単一ProfileのXMLとレポートを同一トランザクションで出力する。
function writeConversionOutputs({
    existsSync = fs.existsSync,
    mkdirSync = fs.mkdirSync,
    outputPath,
    permissionSetXml,
    protectedPaths = [],
    randomUUID = crypto.randomUUID,
    renameSync = fs.renameSync,
    report,
    reportPath,
    unlinkSync = fs.unlinkSync,
    writePermissionSet = true,
    writeFileSync = fs.writeFileSync
}) {
    validateOutputTargets({
        existsSync,
        outputPath,
        protectedPaths,
        reportPath,
        writePermissionSet
    });

    writeOutputDefinitions({
        existsSync,
        mkdirSync,
        outputDefinitions: [
            ...(writePermissionSet ? [{ content: permissionSetXml, targetPath: outputPath }] : []),
            { content: `${JSON.stringify(report, null, 2)}\n`, targetPath: reportPath }
        ],
        randomUUID,
        renameSync,
        unlinkSync,
        writeFileSync
    });
}

// 複数Profileの全XMLとレポートを一括し、どれか1件の失敗時は全出力を元へ戻す。
function writeConversionPlans({
    existsSync = fs.existsSync,
    mkdirSync = fs.mkdirSync,
    plans,
    randomUUID = crypto.randomUUID,
    renameSync = fs.renameSync,
    unlinkSync = fs.unlinkSync,
    writeFileSync = fs.writeFileSync
}) {
    validateConversionPlans({ existsSync, plans });
    const outputDefinitions = [
        ...plans.flatMap(({ conversion, paths }) => [
            ...(conversion.canWrite ? [{ content: conversion.permissionSetXml, targetPath: paths.outputPath }] : []),
            { content: `${JSON.stringify(conversion.report, null, 2)}\n`, targetPath: paths.reportPath }
        ])
    ];

    writeOutputDefinitions({
        existsSync,
        mkdirSync,
        outputDefinitions,
        randomUUID,
        renameSync,
        unlinkSync,
        writeFileSync
    });
}

// 変換件数と未検証事項を、生成ファイルを開かなくても確認できるよう表示する。
function printSummary({ canWrite, options, paths, report, writeLine }) {
    writeLine('ProfileからPermission Setへの変換結果');
    writeLine(`・Profile Metadata Name: ${report.source.profile}`);
    writeLine(`・Permission Set Label: ${report.permissionSet.label}`);
    writeLine(`・User License: ${report.source.userLicense}`);
    writeLine(`・Permission Set License: ${report.permissionSet.license}`);
    writeLine(`・Permission Set: ${report.permissionSet.apiName}`);
    writeLine(`・converted: ${report.summary.converted}件`);
    writeLine(`・retainedInProfile: ${report.summary.retainedInProfile}件`);
    writeLine(`・skippedDisabled: ${report.summary.skippedDisabled}件`);
    writeLine(`・requiresValidation: ${report.summary.requiresValidation}件`);
    writeLine(`・unsupportedUnknown: ${report.summary.unsupportedUnknown}件`);
    printReviewEntries('requiresValidation', report.requiresValidation, writeLine);
    printReviewEntries('unsupportedUnknown', report.unsupportedUnknown, writeLine);

    if (!canWrite) {
        if (options.dryRun) {
            writeLine('・結果: 未対応または不正な設定があるため、dry-runで書き込み不可');
        } else {
            writeLine(`・変換レポート: ${paths.reportPath}`);
            writeLine('・結果: 未対応または不正な設定があるため、Permission Set XMLは生成していません。');
        }

        return;
    }

    if (options.dryRun) {
        writeLine(`・Permission Set XML出力予定: ${paths.outputPath}`);
        writeLine(`・変換レポート出力予定: ${paths.reportPath}`);
        writeLine('・結果: dry-runのためファイルを生成していません。');
    } else {
        writeLine(`・Permission Set XML: ${paths.outputPath}`);
        writeLine(`・変換レポート: ${paths.reportPath}`);
        writeLine('・結果: Permission Set metadataを生成しました。');
    }
}

// 画面出力が過大にならない範囲で、確認事項と書き込み阻止理由を表示する。
function printReviewEntries(category, entries, writeLine) {
    const visibleEntries = entries.slice(0, 20);

    for (const entry of visibleEntries) {
        writeLine(`・${category}: ${entry.sourceElement}.${entry.name} - ${entry.message}`);
    }

    if (entries.length > visibleEntries.length) {
        writeLine(`・${category}: ほか${entries.length - visibleEntries.length}件は変換レポートを確認してください。`);
    }
}

// 変換前にobjects directoryの存在と種別を確認する。
function validateInputDirectory({ existsSync, inputPaths, statSync }) {
    if (!existsSync(inputPaths.objectsDirectory)) {
        throw new Error(`objects directoryが見つかりません: ${inputPaths.objectsDirectory}`);
    }

    if (!statSync(inputPaths.objectsDirectory).isDirectory()) {
        throw new Error(`objects directoryがディレクトリではありません: ${inputPaths.objectsDirectory}`);
    }
}

// 実行対象の設定、件数、出力先を画面へ表示する。
function printRunConfiguration({ configuredProfiles, inputPaths, runOutputDirectory, writeLine }) {
    writeLine(`Profileパス設定: ${inputPaths.configPath}`);
    writeLine(`変換対象: ${configuredProfiles.length}件`);
    writeLine(`出力先: ${runOutputDirectory}`);
}

// Profile XMLを一度解析し、最終変換で再利用する入力と出力パスを準備する。
function prepareProfileConversions({ existsSync, inputPaths, profiles, readFileSync, runOutputDirectory }) {
    return profiles.map((profile) => {
        const permissionSetApiName = createPermissionSetApiName(profile.fullName);
        const paths = resolvePaths({
            ...inputPaths,
            permissionSetApiName,
            profilePath: profile.profilePath,
            runOutputDirectory
        });
        const profileXml = readFileSync(paths.profilePath, 'utf8');
        const profileModel = parseProfileXml(profileXml);
        return {
            profileModel,
            conversionInput: {
                existsSync,
                objectsDirectory: paths.objectsDirectory,
                permissionSetApiName,
                permissionSetLabel: createPermissionSetLabel(profile.fullName),
                profileFullName: profile.fullName,
                profileModel,
                profilePath: profile.configuredPath,
                profileXml,
                readFileSync
            },
            paths
        };
    });
}

// 解析済みのローカルProfileと関連metadataだけを使用して変換結果を作る。
function createConversionPlans({ preparedProfiles }) {
    return preparedProfiles.map(({ conversionInput, paths }) => ({
        conversion: convertProfile(conversionInput),
        paths
    }));
}

// 変換中は組織へ接続せず、利用者が後から検証、デプロイ、保存結果確認するコマンドを表示する。
function printManualCommands({ projectRoot, sourceDirectory, writeLine }) {
    writeLine('');
    writeLine('Production／Developer Editionのvalidateコマンド:');
    writeLine(getProductionValidationCommand({ projectRoot, sourceDirectory }));
    writeLine('');
    writeLine('Sandbox／Scratch Orgのdry-runコマンド:');
    writeLine(getSandboxValidationCommand({ projectRoot, sourceDirectory }));
    writeLine('');
    writeLine('Permission Setのデプロイコマンド:');
    writeLine(getDeploymentCommand({ projectRoot, sourceDirectory }));
    writeLine('');
    writeLine('デプロイ後の保存結果確認コマンド:');
    writeLine(getVerificationCommand({ projectRoot, sourceDirectory }));
    writeLine('※<alias>を対象組織のSalesforce CLI aliasへ置き換えてください。');
    writeLine('※この変換スクリプトはSalesforce組織へ接続しません。');
}

// 全変換結果を必要に応じて書き込み、画面表示して要修正件数を返す。
function processConversionPlans({ existsSync, mkdirSync, options, plans, writeFileSync, writeLine }) {
    if (!options.dryRun) {
        writeConversionPlans({ existsSync, mkdirSync, plans, writeFileSync });
    }

    for (const { conversion, paths } of plans) {
        printSummary({ canWrite: conversion.canWrite, options, paths, report: conversion.report, writeLine });
    }

    const failedCount = plans.filter(({ conversion }) => !conversion.canWrite).length;
    writeLine(`Permission Set metadata生成結果: 生成${plans.length - failedCount}件、要修正${failedCount}件`);
    return failedCount;
}

// CLI実行時の標準依存をテスト差し替え値と一箇所で合成する。
function resolveMainDependencies(overrides) {
    return {
        argv: process.argv.slice(2),
        existsSync: fs.existsSync,
        mkdirSync: fs.mkdirSync,
        now: () => new Date(),
        projectRoot: repoRoot,
        readFileSync: fs.readFileSync,
        statSync: fs.statSync,
        writeFileSync: fs.writeFileSync,
        writeLine: console.log,
        ...overrides
    };
}

// ローカルProfile XMLだけを読み、組織へ接続せずPermission Set候補を生成する。
async function main(overrides = {}) {
    const { argv, existsSync, mkdirSync, now, projectRoot, readFileSync, statSync, writeFileSync, writeLine } =
        resolveMainDependencies(overrides);
    const options = parseArguments(argv);

    if (options.help) {
        writeLine('使用方法: npm run sf:convert:profile -- [--config <file>] [--objects-dir <directory>] [--dry-run]');
        return 0;
    }

    const inputPaths = resolveInputPaths(options, projectRoot);
    const runOutputDirectory = resolveRunOutputDirectory({ existsSync, projectRoot, runAt: now() });
    const configuredProfiles = loadConfiguredProfiles({
        configPath: inputPaths.configPath,
        existsSync,
        profileRoot: inputPaths.profilesDirectory,
        projectRoot,
        readFileSync,
        statSync
    });
    validateInputDirectory({ existsSync, inputPaths, statSync });
    printRunConfiguration({ configuredProfiles, inputPaths, runOutputDirectory, writeLine });

    const preparedProfiles = prepareProfileConversions({
        existsSync,
        inputPaths,
        profiles: configuredProfiles,
        readFileSync,
        runOutputDirectory
    });
    const plans = createConversionPlans({ preparedProfiles });
    const failedCount = processConversionPlans({
        existsSync,
        mkdirSync,
        options,
        plans,
        writeFileSync,
        writeLine
    });

    if (options.dryRun || failedCount > 0) {
        if (failedCount > 0) {
            writeLine('Permission Setを生成できないProfileがあるため、後続コマンドは表示しません。');
        }

        return failedCount === 0 ? 0 : 1;
    }

    const permissionSetsDirectory = path.join(runOutputDirectory, 'permissionsets');
    printManualCommands({ projectRoot, sourceDirectory: permissionSetsDirectory, writeLine });
    return 0;
}

if (require.main === module) {
    main()
        .then((status) => {
            process.exitCode = status;
        })
        .catch((error) => {
            console.error(`エラー: ProfileをPermission Setへ変換できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = {
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
