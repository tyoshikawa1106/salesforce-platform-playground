// 実行方法: デプロイ後のPermission Set保存結果確認スクリプトから読み込む。
// 用途: 生成XMLと組織から再取得したPermission Setを意味単位で比較する。

const fs = require('node:fs');
const path = require('node:path');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { parseSfJson } = require('../../common/target-org');
const { collectionIdentifiers } = require('./permission-set-elements');
const { validatePermissionSetApiName } = require('./profile-converter');

const permissionSetFileSuffix = '.permissionset-meta.xml';

// Metadata APIが単一要素をobjectで返す差を比較前に吸収する。
function toArray(value) {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

// XML全体を検証してからPermissionSetルートだけを返す。
function parsePermissionSetXml(xml, sourceDescription) {
    const validation = XMLValidator.validate(xml);

    if (validation !== true) {
        throw new Error(`${sourceDescription}のXML形式が不正です: ${validation.err.msg}`);
    }

    const collectionNames = new Set(collectionIdentifiers.keys());
    const parser = new XMLParser({
        attributeNamePrefix: '@_',
        ignoreDeclaration: true,
        ignoreAttributes: false,
        parseTagValue: false,
        processEntities: false,
        trimValues: true,
        isArray: (name, jPath) => jPath === `PermissionSet.${name}` && collectionNames.has(name)
    });
    const parsed = parser.parse(xml);

    if (Object.keys(parsed).length !== 1 || !parsed.PermissionSet || typeof parsed.PermissionSet !== 'object') {
        throw new Error(`${sourceDescription}をPermission Set XMLとして解析できません。`);
    }

    return parsed.PermissionSet;
}

// 文字列booleanや子要素順を揃え、XML表記ではなく意味を比較できる値にする。
function normalizeValue(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .filter((key) => key !== '@_xmlns')
                .sort()
                .map((key) => [key, normalizeValue(value[key])])
        );
    }

    return String(value);
}

// Salesforceが省略値falseを明示して返すviewAllFieldsだけを無害な表記差として揃える。
function normalizeCollectionEntry(elementName, entry) {
    const normalized = normalizeValue(entry);

    if (elementName === 'objectPermissions' && normalized.viewAllFields === undefined) {
        normalized.viewAllFields = 'false';
    }

    return Object.fromEntries(
        Object.keys(normalized)
            .sort()
            .map((key) => [key, normalized[key]])
    );
}

// 識別子付きの繰り返し要素を順序非依存のMapへ変換する。
function createCollectionMap(permissionSet, elementName, identifier) {
    const entries = new Map();

    for (const entry of toArray(permissionSet[elementName])) {
        const name = entry?.[identifier];

        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error(`${elementName}.${identifier}が設定されていません。`);
        }

        if (entries.has(name)) {
            throw new Error(`${elementName}に重複した設定があります: ${name}`);
        }

        entries.set(name, normalizeCollectionEntry(elementName, entry));
    }

    return entries;
}

// 生成値、組織保存値の欠落、追加、変更を要素単位の差分へ変換する。
function comparePermissionSets(expected, actual) {
    const differences = [];
    const elementNames = new Set([
        ...Object.keys(expected).filter((key) => key !== '@_xmlns'),
        ...Object.keys(actual).filter((key) => key !== '@_xmlns')
    ]);

    for (const elementName of [...elementNames].sort()) {
        const identifier = collectionIdentifiers.get(elementName);

        if (!identifier) {
            const expectedValue = normalizeValue(expected[elementName]);
            const actualValue = normalizeValue(actual[elementName]);

            if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
                differences.push({
                    element: elementName,
                    kind:
                        expected[elementName] === undefined
                            ? 'unexpectedInOrg'
                            : actual[elementName] === undefined
                              ? 'missingInOrg'
                              : 'changed',
                    expected: expectedValue,
                    actual: actualValue
                });
            }

            continue;
        }

        const expectedEntries = createCollectionMap(expected, elementName, identifier);
        const actualEntries = createCollectionMap(actual, elementName, identifier);
        const names = new Set([...expectedEntries.keys(), ...actualEntries.keys()]);

        for (const name of [...names].sort()) {
            const expectedEntry = expectedEntries.get(name);
            const actualEntry = actualEntries.get(name);

            if (JSON.stringify(expectedEntry) === JSON.stringify(actualEntry)) {
                continue;
            }

            differences.push({
                element: elementName,
                name,
                kind:
                    expectedEntry === undefined
                        ? 'unexpectedInOrg'
                        : actualEntry === undefined
                          ? 'missingInOrg'
                          : 'changed',
                expected: expectedEntry,
                actual: actualEntry
            });
        }
    }

    return differences;
}

// 生成元フォルダのPermission Set API名を検証し、安定した順序で返す。
function listPermissionSetApiNames(sourceDirectory, readdirSync = fs.readdirSync) {
    const fileNames = readdirSync(sourceDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(permissionSetFileSuffix))
        .map((entry) => entry.name)
        .sort();

    if (fileNames.length === 0) {
        throw new Error(`比較するPermission Set XMLがありません: ${sourceDirectory}`);
    }

    return fileNames.map((fileName) => {
        const apiName = fileName.slice(0, -permissionSetFileSuffix.length);
        validatePermissionSetApiName(apiName);
        return apiName;
    });
}

// Default Target Orgから完全一致のPermission Setだけを取得するretrieve引数を作る。
function buildRetrieveArgs({ apiNames, outputDirectory }) {
    return [
        'project',
        'retrieve',
        'start',
        ...apiNames.flatMap((apiName) => ['--metadata', `PermissionSet:${apiName}`]),
        '--output-dir',
        outputDirectory,
        '--wait',
        '30',
        '--json'
    ];
}

// 生成フォルダと再取得フォルダのファイル集合および内容を一括比較する。
function comparePermissionSetDirectories({
    existsSync = fs.existsSync,
    readFileSync = fs.readFileSync,
    retrievedDirectory,
    sourceDirectory
}) {
    const apiNames = listPermissionSetApiNames(sourceDirectory);
    const expectedFileNames = apiNames.map((apiName) => `${apiName}${permissionSetFileSuffix}`);
    const retrievedApiNames = existsSync(retrievedDirectory) ? listPermissionSetApiNames(retrievedDirectory) : [];
    const retrievedFileNames = new Set(retrievedApiNames.map((apiName) => `${apiName}${permissionSetFileSuffix}`));
    const results = [];

    for (const fileName of expectedFileNames) {
        const apiName = fileName.slice(0, -permissionSetFileSuffix.length);
        const sourcePath = path.join(sourceDirectory, fileName);
        const retrievedPath = path.join(retrievedDirectory, fileName);

        if (!retrievedFileNames.has(fileName)) {
            results.push({ apiName, equal: false, differences: [{ kind: 'missingPermissionSetInOrg' }] });
            continue;
        }

        const expected = parsePermissionSetXml(readFileSync(sourcePath, 'utf8'), sourcePath);
        const actual = parsePermissionSetXml(readFileSync(retrievedPath, 'utf8'), retrievedPath);
        const differences = comparePermissionSets(expected, actual);
        results.push({ apiName, equal: differences.length === 0, differences });
    }

    for (const apiName of retrievedApiNames.filter((name) => !apiNames.includes(name))) {
        results.push({ apiName, equal: false, differences: [{ kind: 'unexpectedPermissionSetInOrg' }] });
    }

    return {
        permissionSets: results.length,
        equal: results.filter((result) => result.equal).length,
        different: results.filter((result) => !result.equal).length,
        differences: results.reduce((count, result) => count + result.differences.length, 0),
        results
    };
}

// exact-name retrieveを実行し、Salesforce CLIが成功したことを確認する。
function retrievePermissionSets({
    apiNames,
    outputDirectory,
    projectRoot,
    runSfWithOutputCommand,
    timeout = 35 * 60 * 1_000
}) {
    const result = runSfWithOutputCommand(
        buildRetrieveArgs({ apiNames, outputDirectory }),
        projectRoot,
        undefined,
        50 * 1024 * 1024,
        timeout
    );
    parseSfJson(result, 'デプロイ済みPermission Setの取得');
}

module.exports = {
    buildRetrieveArgs,
    comparePermissionSetDirectories,
    comparePermissionSets,
    listPermissionSetApiNames,
    parsePermissionSetXml,
    retrievePermissionSets
};
