// 実行方法: デプロイ後のPermission Set保存結果確認スクリプトから読み込む。
// 用途: 生成XMLと組織から再取得したPermission Setを意味単位で比較する。

const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const { parseSfJson } = require('../../common/target-org');
const { collectionIdentifiers } = require('./permission-set-elements');
const { validatePermissionSetApiName, validateXml, xmlEntities } = require('./profile-converter');

// 比較対象となるSalesforce DX形式の拡張子を限定する。
const permissionSetFileSuffix = '.permissionset-meta.xml';

// Metadata APIが単一要素をobjectで返す差を比較前に吸収する。
function toArray(value) {
    // 省略・単一・複数件を同じ比較処理に渡す。
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

// XML全体を検証してからPermissionSetルートだけを返す。
function parsePermissionSetXml(xml, sourceDescription) {
    // 変換元と同じ形式検証とDTD拒否を、比較する両方のXMLへ適用する。
    validateXml(xml, sourceDescription);

    // 識別子を持つ繰り返し要素を配列として解析する。
    const collectionNames = new Set(collectionIdentifiers.keys());
    // 文字参照を復号し、値の自動型変換による差分消失を防ぐ。
    const parser = new XMLParser({
        attributeNamePrefix: '@_',
        ignoreDeclaration: true,
        ignoreAttributes: false,
        parseTagValue: false,
        processEntities: true,
        htmlEntities: xmlEntities,
        trimValues: true,
        isArray: (name, jPath) => jPath === `PermissionSet.${name}` && collectionNames.has(name)
    });
    // 検証済みのXMLから比較用モデルを作る。
    const parsed = parser.parse(xml);

    // 別metadataや複数ルートを比較対象へ混入させない。
    if (Object.keys(parsed).length !== 1 || !parsed.PermissionSet || typeof parsed.PermissionSet !== 'object') {
        // 比較不能な入力を一致として報告しない。
        throw new Error(`${sourceDescription}をPermission Set XMLとして解析できません。`);
    }

    // 権限セット本体だけを意味比較へ渡す。
    return parsed.PermissionSet;
}

// 文字列booleanや子要素順を揃え、XML表記ではなく意味を比較できる値にする。
function normalizeValue(value) {
    // 繰り返し値の各子要素にも正規化を適用する。
    if (Array.isArray(value)) {
        // 配列内の値も同じ比較規則に揃える。
        return value.map(normalizeValue);
    }

    // 子要素順に依存しない比較値を組み立てる。
    if (value && typeof value === 'object') {
        // 名前空間属性を除き、キー順を統一する。
        return Object.fromEntries(
            Object.keys(value)
                .filter((key) => key !== '@_xmlns')
                .sort()
                .map((key) => [key, normalizeValue(value[key])])
        );
    }

    // 単純値を統一された文字列として比較する。
    return String(value);
}

// Salesforceが省略値falseを明示して返すviewAllFieldsだけを無害な表記差として揃える。
function normalizeCollectionEntry(elementName, entry) {
    // 任意権限の省略値補完前に子要素順を揃える。
    const normalized = normalizeValue(entry);

    // 既知の無害な省略差だけを正規化する。
    if (elementName === 'objectPermissions' && normalized.viewAllFields === undefined) {
        // 省略された全項目参照を未付与として明示する。
        normalized.viewAllFields = 'false';
    }

    // 補完後も子要素順に依存しない値を返す。
    return Object.fromEntries(
        Object.keys(normalized)
            .sort()
            .map((key) => [key, normalized[key]])
    );
}

// 識別子付きの繰り返し要素を順序非依存のMapへ変換する。
function createCollectionMap(permissionSet, elementName, identifier) {
    // 入力順によらず権限を識別できる索引を用意する。
    const entries = new Map();

    // すべての権限を固有名で対応付ける。
    for (const entry of toArray(permissionSet[elementName])) {
        // 生成値と保存値を結ぶ権限名を抽出する。
        const name = entry?.[identifier];

        // 識別不能な要素を差分比較から落とさない。
        if (typeof name !== 'string' || name.trim() === '') {
            // 欠落した識別子の修正を求めて停止する。
            throw new Error(`${elementName}.${identifier}が設定されていません。`);
        }

        // 同一名の要素を上書きして差分を隠さない。
        if (entries.has(name)) {
            // 重複する権限を示して比較を停止する。
            throw new Error(`${elementName}に重複した設定があります: ${name}`);
        }

        // 正規化済みの値を権限名に対応付ける。
        entries.set(name, normalizeCollectionEntry(elementName, entry));
    }

    // 順序非依存の比較に使う索引を返す。
    return entries;
}

// 生成値、組織保存値の欠落、追加、変更を要素単位の差分へ変換する。
function comparePermissionSets(expected, actual) {
    // 追加・欠落・変更をまとめて返す差分一覧を用意する。
    const differences = [];
    // 片方だけにある要素も比較対象に含める。
    const elementNames = new Set([
        ...Object.keys(expected).filter((key) => key !== '@_xmlns'),
        ...Object.keys(actual).filter((key) => key !== '@_xmlns')
    ]);

    // レポートの差分順を要素名で安定させる。
    for (const elementName of [...elementNames].sort()) {
        // 単一プロパティか識別子付き権限かを判定する。
        const identifier = collectionIdentifiers.get(elementName);

        // ラベルなどの単一値は要素全体を比較する。
        if (!identifier) {
            // 生成値を比較用の表記へ揃える。
            const expectedValue = normalizeValue(expected[elementName]);
            // 保存値にも生成値と同じ正規化を適用する。
            const actualValue = normalizeValue(actual[elementName]);

            // 値が異なる場合だけ差分として扱う。
            if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
                // 片側の欠落と実際の値変更を区別して記録する。
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

            // 単一値を繰り返し権限として再比較しない。
            continue;
        }

        // 生成された権限を固有名で索引化する。
        const expectedEntries = createCollectionMap(expected, elementName, identifier);
        // 保存された権限も同じ固有名で索引化する。
        const actualEntries = createCollectionMap(actual, elementName, identifier);
        // どちらか一方に存在する権限も検査する。
        const names = new Set([...expectedEntries.keys(), ...actualEntries.keys()]);

        // 権限名順で安定した差分を生成する。
        for (const name of [...names].sort()) {
            // 比較対象の生成時の許可値を取得する。
            const expectedEntry = expectedEntries.get(name);
            // 対応する保存時の許可値を取得する。
            const actualEntry = actualEntries.get(name);

            // 正規化後に同じ権限は差分へ含めない。
            if (JSON.stringify(expectedEntry) === JSON.stringify(actualEntry)) {
                // 無害な表記差の記録を避ける。
                continue;
            }

            // 権限の追加・欠落・変更を値付きで記録する。
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

    // すべての権限差分を呼び出し元へ返す。
    return differences;
}

// 生成元フォルダのPermission Set API名を検証し、安定した順序で返す。
function listPermissionSetApiNames(sourceDirectory, readdirSync = fs.readdirSync, { allowEmpty = false } = {}) {
    // 通常ファイルの権限セットだけを安定順で列挙する。
    const fileNames = readdirSync(sourceDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(permissionSetFileSuffix))
        .map((entry) => entry.name)
        .sort();

    // 生成元の空入力は拒否し、再取得側だけは欠落比較のため空集合を許可する。
    if (fileNames.length === 0 && !allowEmpty) {
        // 比較元がないことをパス付きで通知する。
        throw new Error(`比較するPermission Set XMLがありません: ${sourceDirectory}`);
    }

    // 拡張子を除いたAPI名を全件検証して返す。
    return fileNames.map((fileName) => {
        // retrieveの完全一致指定に使うAPI名を得る。
        const apiName = fileName.slice(0, -permissionSetFileSuffix.length);
        // 不正な名前をCLI引数へ渡さない。
        validatePermissionSetApiName(apiName);
        // 検証済みAPI名だけを後続操作へ渡す。
        return apiName;
    });
}

// 確認済みのDefault Target Orgから完全一致のPermission Setだけを取得するretrieve引数を作る。
function buildRetrieveArgs({ apiNames, outputDirectory, targetOrg }) {
    // 確認済み組織と生成対象の完全一致指定だけをCLIへ渡す。
    return [
        'project',
        'retrieve',
        'start',
        ...apiNames.flatMap((apiName) => ['--metadata', `PermissionSet:${apiName}`]),
        '--target-org',
        targetOrg,
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
    // 比較基準となる生成済みAPI名を検証する。
    const apiNames = listPermissionSetApiNames(sourceDirectory);
    // 生成対象から期待するファイル名集合を作る。
    const expectedFileNames = apiNames.map((apiName) => `${apiName}${permissionSetFileSuffix}`);
    // 取得先の不存在とXMLが0件のフォルダを同じ欠落結果として扱う。
    const retrievedApiNames = existsSync(retrievedDirectory)
        ? listPermissionSetApiNames(retrievedDirectory, fs.readdirSync, { allowEmpty: true })
        : [];
    // 保存結果のファイル有無を完全一致で確認する。
    const retrievedFileNames = new Set(retrievedApiNames.map((apiName) => `${apiName}${permissionSetFileSuffix}`));
    // 各権限セットの比較結果を集計する器を用意する。
    const results = [];

    // 生成したすべての権限セットを検査する。
    for (const fileName of expectedFileNames) {
        // 差分を権限セットAPI名に対応付ける。
        const apiName = fileName.slice(0, -permissionSetFileSuffix.length);
        // 比較基準となる生成XMLの場所を確定する。
        const sourcePath = path.join(sourceDirectory, fileName);
        // 対応する再取得XMLの場所を確定する。
        const retrievedPath = path.join(retrievedDirectory, fileName);

        // 再取得で返らなかった権限セットを検出する。
        if (!retrievedFileNames.has(fileName)) {
            // 権限セット全体の欠落を明示的な差分へ記録する。
            results.push({ apiName, equal: false, differences: [{ kind: 'missingPermissionSetInOrg' }] });
            // 存在しないファイルを読まず次の対象へ進む。
            continue;
        }

        // 生成XMLを構文・DTD検証後に比較用モデルへ変換する。
        const expected = parsePermissionSetXml(readFileSync(sourcePath, 'utf8'), sourcePath);
        // 再取得XMLにも同じ検証と文字参照復号を適用する。
        const actual = parsePermissionSetXml(readFileSync(retrievedPath, 'utf8'), retrievedPath);
        // 表記差を除いた実際の権限差分を取得する。
        const differences = comparePermissionSets(expected, actual);
        // 対象ごとの一致状態と詳細差分を保存する。
        results.push({ apiName, equal: differences.length === 0, differences });
    }

    // 生成対象にない再取得ファイルも検査する。
    for (const apiName of retrievedApiNames.filter((name) => !apiNames.includes(name))) {
        // 余分に返された権限セットを差分として通知する。
        results.push({ apiName, equal: false, differences: [{ kind: 'unexpectedPermissionSetInOrg' }] });
    }

    // 個別結果と整合する一致・不一致の件数を返す。
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
    targetOrg,
    timeout = 35 * 60 * 1_000
}) {
    // 限定したretrieveコマンドを指定された実行環境へ渡す。
    const result = runSfWithOutputCommand(
        buildRetrieveArgs({ apiNames, outputDirectory, targetOrg }),
        projectRoot,
        undefined,
        50 * 1024 * 1024,
        timeout
    );
    // CLIの失敗を正常な取得結果として扱わない。
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
