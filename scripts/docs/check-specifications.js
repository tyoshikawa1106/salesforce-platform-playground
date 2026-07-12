const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(process.env.SPECIFICATIONS_CHECK_PROJECT_ROOT || path.resolve(__dirname, '../..'));
const metadataRoot = path.join(projectRoot, 'force-app/main/default');
const specificationsRoot = path.join(projectRoot, 'docs/specifications');
const specificationsIndex = path.join(specificationsRoot, 'index.md');
const issues = [];

const MAIN_HEADINGS = [
    '概要',
    '目的・利用場面',
    '対象メタデータ',
    '入力',
    '処理内容',
    '出力・更新対象',
    '権限・実行条件',
    'エラー処理',
    '関連コンポーネント',
    'テスト・確認観点',
    '制約・注意事項'
];
const DETAIL_HEADINGS = MAIN_HEADINGS.filter(
    (heading) => !['目的・利用場面', '対象メタデータ', '関連コンポーネント'].includes(heading)
);
const INDEX_TYPES = ['Flow', 'LWC', 'Aura', 'Visualforce', 'Apex Trigger', 'Apex Batch', 'Apex Scheduler'];

function exists(directory) {
    return fs.existsSync(directory);
}

function listEntries(directory) {
    return exists(directory) ? fs.readdirSync(directory, { withFileTypes: true }) : [];
}

function listFiles(directory, suffix) {
    return listEntries(directory)
        .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
        .map((entry) => path.join(directory, entry.name))
        .sort();
}

function listDirectories(directory) {
    return listEntries(directory)
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(directory, entry.name))
        .sort();
}

function read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function relative(filePath) {
    return path.relative(projectRoot, filePath);
}

function withoutSuffix(filePath, suffix) {
    return path.basename(filePath, suffix);
}

function collectHeadings(filePath) {
    const headings = [];
    let inFence = false;

    read(filePath)
        .split('\n')
        .forEach((line) => {
            if (line.trimStart().startsWith('```')) {
                inFence = !inFence;
                return;
            }

            if (!inFence && line.startsWith('## ')) {
                headings.push(line.slice(3).trim());
            }
        });

    return headings;
}

function collectSection(filePath, heading) {
    const lines = read(filePath).split('\n');
    const startIndex = lines.findIndex((line) => line === `## ${heading}`);

    if (startIndex < 0) {
        return '';
    }

    const sectionLines = [];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        if (lines[index].startsWith('## ')) {
            break;
        }
        sectionLines.push(lines[index]);
    }

    return sectionLines.join('\n');
}

function validateHeadings(filePath, expectedHeadings, specificationType) {
    const headings = collectHeadings(filePath);

    if (JSON.stringify(headings) !== JSON.stringify(expectedHeadings)) {
        issues.push(
            `${relative(filePath)}: ${specificationType}の見出しを規定順にしてください。` +
                ` 期待値=${expectedHeadings.join(' > ')} 実際=${headings.join(' > ')}`
        );
    }
}

function parseIndexRows() {
    const rows = [];
    const rowPattern = new RegExp(
        `^\\|\\s*(${INDEX_TYPES.join('|')})\\s*\\|[^|]*\\|\\s*\`([^\`]+)\`\\s*\\|\\s*\\[[^\\]]+\\]\\(([^)]+)\\)\\s*\\|$`
    );

    read(specificationsIndex)
        .split('\n')
        .forEach((line, index) => {
            const match = line.match(rowPattern);

            if (!match) {
                return;
            }

            const specPath = path.resolve(path.dirname(specificationsIndex), match[3]);
            rows.push({
                type: match[1],
                apiName: match[2],
                specPath,
                line: index + 1
            });
        });

    return rows;
}

function collectApexImplementations(interfacePattern) {
    return listFiles(path.join(metadataRoot, 'classes'), '.cls')
        .filter((filePath) => interfacePattern.test(read(filePath)))
        .map((filePath) => withoutSuffix(filePath, '.cls'));
}

function collectAuraBundles() {
    return listDirectories(path.join(metadataRoot, 'aura'))
        .filter((directory) => listFiles(directory, '.cmp').length > 0)
        .map((directory) => path.basename(directory));
}

function collectLwcBundles() {
    return listDirectories(path.join(metadataRoot, 'lwc'))
        .filter((directory) => path.basename(directory) !== '__tests__')
        .map((directory) => path.basename(directory));
}

function collectExpectedMetadata() {
    return new Map([
        [
            'Flow',
            listFiles(path.join(metadataRoot, 'flows'), '.flow-meta.xml').map((filePath) =>
                withoutSuffix(filePath, '.flow-meta.xml')
            )
        ],
        ['LWC', collectLwcBundles()],
        ['Aura', collectAuraBundles()],
        [
            'Visualforce',
            listFiles(path.join(metadataRoot, 'pages'), '.page').map((filePath) => withoutSuffix(filePath, '.page'))
        ],
        [
            'Apex Trigger',
            listFiles(path.join(metadataRoot, 'triggers'), '.trigger').map((filePath) =>
                withoutSuffix(filePath, '.trigger')
            )
        ],
        ['Apex Batch', collectApexImplementations(/\bimplements\s+[^\n{]*(?:Database\.)?Batchable\b/)],
        ['Apex Scheduler', collectApexImplementations(/\bimplements\s+[^\n{]*Schedulable\b/)]
    ]);
}

function validateIndexRows(indexRows) {
    const keys = new Set();

    indexRows.forEach((row) => {
        const key = `${row.type}:${row.apiName}`;

        if (keys.has(key)) {
            issues.push(`docs/specifications/index.md:${row.line}: 索引の登録が重複しています: ${key}`);
        }
        keys.add(key);

        if (!exists(row.specPath)) {
            issues.push(`docs/specifications/index.md:${row.line}: 主仕様書がありません: ${relative(row.specPath)}`);
            return;
        }

        if (!collectSection(row.specPath, '対象メタデータ').includes(`\`${row.apiName}\``)) {
            issues.push(
                `${relative(row.specPath)}: 「対象メタデータ」に索引のAPI名 \`${row.apiName}\` を記載してください。`
            );
        }

        validateHeadings(row.specPath, MAIN_HEADINGS, '主仕様書');
    });
}

function validateMetadataCoverage(indexRows, expectedMetadata) {
    const rowsByType = new Map(
        INDEX_TYPES.map((type) => [
            type,
            new Set(indexRows.filter((row) => row.type === type).map((row) => row.apiName))
        ])
    );
    const mainMetadataSections = indexRows
        .filter((row) => exists(row.specPath))
        .map((row) => collectSection(row.specPath, '対象メタデータ'))
        .join('\n');

    expectedMetadata.forEach((apiNames, type) => {
        const indexedApiNames = rowsByType.get(type);

        apiNames.forEach((apiName) => {
            if (indexedApiNames.has(apiName)) {
                return;
            }

            if (type === 'LWC' && mainMetadataSections.includes(`\`${apiName}\``)) {
                return;
            }

            issues.push(
                `${type} ${apiName}: 主仕様書を索引へ登録するか、内部LWCとして利用する主仕様書に記載してください。`
            );
        });

        indexedApiNames.forEach((apiName) => {
            if (!apiNames.includes(apiName)) {
                issues.push(`docs/specifications/index.md: 実装が存在しない${type}を登録しています: ${apiName}`);
            }
        });
    });
}

function validateSpecificationFiles(indexRows) {
    const indexedMainSpecifications = new Set(
        indexRows.filter((row) => exists(row.specPath)).map((row) => row.specPath)
    );
    const allMainSpecifications = [];
    const allSpecificationFiles = [];

    function visit(directory) {
        listEntries(directory).forEach((entry) => {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                visit(entryPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                allSpecificationFiles.push(entryPath);
                if (entry.name === 'index.md' && entryPath !== specificationsIndex) {
                    allMainSpecifications.push(entryPath);
                }
            }
        });
    }

    visit(specificationsRoot);

    allMainSpecifications.forEach((filePath) => {
        if (!indexedMainSpecifications.has(filePath)) {
            issues.push(`${relative(filePath)}: docs/specifications/index.md に登録してください。`);
        }
    });

    indexedMainSpecifications.forEach((mainSpecPath) => {
        const mainSpecText = read(mainSpecPath);

        listFiles(path.dirname(mainSpecPath), '.md')
            .filter((filePath) => filePath !== mainSpecPath)
            .forEach((detailSpecPath) => {
                validateHeadings(detailSpecPath, DETAIL_HEADINGS, '詳細仕様');

                const expectedLink = `](${path.basename(detailSpecPath)})`;
                if (!mainSpecText.includes(expectedLink)) {
                    issues.push(
                        `${relative(detailSpecPath)}: 主仕様書 ${relative(mainSpecPath)} からリンクしてください。`
                    );
                }
            });
    });

    const classifiedFiles = new Set([specificationsIndex, ...indexedMainSpecifications]);
    indexedMainSpecifications.forEach((mainSpecPath) => {
        listFiles(path.dirname(mainSpecPath), '.md')
            .filter((filePath) => filePath !== mainSpecPath)
            .forEach((filePath) => classifiedFiles.add(filePath));
    });

    allSpecificationFiles.forEach((filePath) => {
        if (!classifiedFiles.has(filePath)) {
            issues.push(`${relative(filePath)}: 主仕様書または主仕様書と同じディレクトリの詳細仕様にしてください。`);
        }
    });
}

const indexRows = parseIndexRows();
const expectedMetadata = collectExpectedMetadata();

validateIndexRows(indexRows);
validateMetadataCoverage(indexRows, expectedMetadata);
validateSpecificationFiles(indexRows);

if (issues.length > 0) {
    console.error(`Specifications check failed with ${issues.length} issue(s):`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
} else {
    const metadataCount = [...expectedMetadata.values()].reduce((total, apiNames) => total + apiNames.length, 0);
    console.log(
        `Specifications check passed: ${indexRows.length} main specifications, ` +
            `${metadataCount} managed metadata entries.`
    );
}
