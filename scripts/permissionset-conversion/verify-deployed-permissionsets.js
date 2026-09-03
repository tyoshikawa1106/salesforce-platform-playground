// 実行コマンド: npm run sf:verify:permissionsets -- --source-dir <生成フォルダ>/permissionsets
// 用途: 手動deploy後のPermission Setを再取得し、生成XMLとの意味的な差分を検出する。

const fs = require('node:fs');
const path = require('node:path');
const { runSfWithOutput } = require('../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, printTargetOrgInfo } = require('../common/target-org');
const {
    comparePermissionSetDirectories,
    listPermissionSetApiNames,
    retrievePermissionSets
} = require('./internal/permission-set-verifier');

const repoRoot = path.resolve(__dirname, '../..');
const outputsRootRelativePath = 'scripts/permissionset-conversion/outputs';

// 保存結果確認で受け付ける生成フォルダだけを解析する。
function parseArguments(argv) {
    const options = {};
    const valueOptions = new Map([['--source-dir', 'sourceDirectory']]);

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];

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

// outputs配下の実行単位にあるpermissionsetsフォルダだけを比較元として受け付ける。
function resolveSourceDirectory({
    existsSync = fs.existsSync,
    projectRoot = repoRoot,
    sourceDirectory,
    statSync = fs.statSync
}) {
    if (typeof sourceDirectory !== 'string' || sourceDirectory.trim() === '') {
        throw new Error('--source-dirを指定してください。');
    }

    const resolved = path.resolve(projectRoot, sourceDirectory);
    const outputsRoot = path.resolve(projectRoot, outputsRootRelativePath);
    const relative = path.relative(outputsRoot, resolved);

    if (
        relative === '' ||
        relative === '..' ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative) ||
        path.basename(resolved) !== 'permissionsets' ||
        relative.split(path.sep).length !== 2
    ) {
        throw new Error('--source-dirはoutputs/<実行日時>/permissionsetsを指定してください。');
    }

    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
        throw new Error(`Permission Set生成フォルダが見つかりません: ${resolved}`);
    }

    return resolved;
}

// 同じ実行結果内に上書きしない日時別の検証フォルダを確保する。
function resolveVerificationDirectory({ existsSync = fs.existsSync, now = () => new Date(), sourceDirectory }) {
    const runDirectory = path.dirname(sourceDirectory);
    const timestamp = now()
        .toISOString()
        .replace(/[-:TZ.]/gu, '')
        .slice(0, 17);
    const verificationRoot = path.join(runDirectory, 'verification');

    for (let sequence = 0; sequence < 10_000; sequence += 1) {
        const suffix = sequence === 0 ? '' : `-${String(sequence).padStart(4, '0')}`;
        const candidate = path.join(verificationRoot, `${timestamp}${suffix}`);

        if (!existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(`一意な保存結果確認フォルダを確保できませんでした: ${verificationRoot}`);
}

// 比較差分の先頭を画面へ出し、全件はJSONレポートへ委ねる。
function printDifferences(comparison, writeLine) {
    const differences = comparison.results.flatMap((result) =>
        result.differences.map((difference) => ({ apiName: result.apiName, ...difference }))
    );

    for (const difference of differences.slice(0, 20)) {
        const element = difference.element ? `.${difference.element}` : '';
        const name = difference.name ? `.${difference.name}` : '';
        writeLine(`・${difference.apiName}${element}${name}: ${difference.kind}`);
    }

    if (differences.length > 20) {
        writeLine(`・ほか${differences.length - 20}件は保存結果確認レポートを確認してください。`);
    }
}

// CLI実行時の標準依存をテスト差し替え値と一箇所で合成する。
function resolveMainDependencies(overrides) {
    return {
        argv: process.argv.slice(2),
        existsSync: fs.existsSync,
        mkdirSync: fs.mkdirSync,
        now: () => new Date(),
        projectRoot: repoRoot,
        runSfWithOutputCommand: runSfWithOutput,
        statSync: fs.statSync,
        writeFileSync: fs.writeFileSync,
        writeLine: console.log,
        ...overrides
    };
}

// 指定組織から対象Permission Setだけを取得し、生成値との比較結果を保存する。
async function main(overrides = {}) {
    const {
        argv,
        existsSync,
        mkdirSync,
        now,
        projectRoot,
        runSfWithOutputCommand,
        statSync,
        writeFileSync,
        writeLine
    } = resolveMainDependencies(overrides);
    const options = parseArguments(argv);

    if (options.help) {
        writeLine('npm run sf:verify:permissionsets -- --source-dir <生成フォルダ>/permissionsets');
        return 0;
    }

    const sourceDirectory = resolveSourceDirectory({
        existsSync,
        projectRoot,
        sourceDirectory: options.sourceDirectory,
        statSync
    });
    const apiNames = listPermissionSetApiNames(sourceDirectory);
    const targetOrg = getDefaultTargetOrg({ repoRoot: projectRoot, runSfCommand: runSfWithOutputCommand });
    const orgInfo = getTargetOrgInfo({
        repoRoot: projectRoot,
        runSfCommand: runSfWithOutputCommand,
        targetOrg
    });
    printTargetOrgInfo(orgInfo, writeLine);
    const verificationDirectory = resolveVerificationDirectory({ existsSync, now, sourceDirectory });
    const retrievedDirectory = path.join(verificationDirectory, 'retrieved');
    mkdirSync(verificationDirectory, { recursive: true });
    writeLine(`Permission Set保存結果確認対象: ${sourceDirectory}`);
    writeLine(`再取得対象: ${apiNames.length}件`);
    retrievePermissionSets({
        apiNames,
        outputDirectory: retrievedDirectory,
        projectRoot,
        runSfWithOutputCommand
    });
    const comparison = comparePermissionSetDirectories({
        retrievedDirectory: path.join(retrievedDirectory, 'permissionsets'),
        sourceDirectory
    });
    const checkedAt = now().toISOString();
    const report = {
        schemaVersion: 1,
        checkedAt,
        sourceDirectory: path.relative(projectRoot, sourceDirectory).split(path.sep).join('/'),
        targetOrg,
        summary: {
            permissionSets: comparison.permissionSets,
            equal: comparison.equal,
            different: comparison.different,
            differences: comparison.differences
        },
        results: comparison.results
    };
    const reportPath = path.join(verificationDirectory, 'comparison-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    writeLine(
        `保存結果確認: 一致${comparison.equal}件、差異あり${comparison.different}件、差分${comparison.differences}件`
    );

    if (comparison.different > 0) {
        printDifferences(comparison, writeLine);
    }

    writeLine(`保存結果確認レポート: ${reportPath}`);
    return comparison.different === 0 ? 0 : 1;
}

if (require.main === module) {
    main()
        .then((status) => {
            process.exitCode = status;
        })
        .catch((error) => {
            console.error(`エラー: Permission Setの保存結果を確認できませんでした: ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = {
    main,
    parseArguments,
    printDifferences,
    resolveSourceDirectory,
    resolveVerificationDirectory
};
