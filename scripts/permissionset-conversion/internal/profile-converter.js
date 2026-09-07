// 用途: Profile XMLの付与権限をPermission Setへ変換し、変換結果を分類したレポートを返す。

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { XMLBuilder, XMLParser, XMLValidator } = require('fast-xml-parser');

// 入出力XMLをSalesforce Metadata APIの名前空間へ限定する。
const metadataNamespace = 'http://soap.sforce.com/2006/04/metadata';

// 数値文字参照の復号を有効にしつつ、名前付き参照はXML標準の5種類だけへ限定する。
const xmlEntities = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };

// ProfileからPermission Setへ同じ構造で移せる有効化形式の要素を定義する。
const enabledAccessDefinitions = [
    {
        source: 'agentAccesses',
        target: 'agentAccesses',
        identifier: 'agentName',
        targetOrder: ['agentName', 'enabled']
    },
    {
        source: 'classAccesses',
        target: 'classAccesses',
        identifier: 'apexClass',
        targetOrder: ['apexClass', 'enabled']
    },
    {
        source: 'customMetadataTypeAccesses',
        target: 'customMetadataTypeAccesses',
        identifier: 'name',
        targetOrder: ['enabled', 'name']
    },
    {
        source: 'customPermissions',
        target: 'customPermissions',
        identifier: 'name',
        targetOrder: ['enabled', 'name']
    },
    {
        source: 'customSettingAccesses',
        target: 'customSettingAccesses',
        identifier: 'name',
        targetOrder: ['enabled', 'name']
    },
    {
        source: 'externalDataSourceAccesses',
        target: 'externalDataSourceAccesses',
        identifier: 'externalDataSource',
        targetOrder: ['enabled', 'externalDataSource']
    },
    {
        source: 'flowAccesses',
        target: 'flowAccesses',
        identifier: 'flow',
        targetOrder: ['enabled', 'flow']
    },
    {
        source: 'genComputingSummaryDefAccesses',
        target: 'genComputingSummaryDefAccesses',
        identifier: 'configName',
        targetOrder: ['configName', 'enabled']
    },
    {
        source: 'servicePresenceStatusAccesses',
        target: 'servicePresenceStatusAccesses',
        identifier: 'servicePresenceStatus',
        targetOrder: ['enabled', 'servicePresenceStatus']
    },
    {
        source: 'userPermissions',
        target: 'userPermissions',
        identifier: 'name',
        targetOrder: ['enabled', 'name']
    }
];

// Permission Setへ移せずProfileに残すことが確認できている要素を定義する。
const retainedProfileElements = new Map([
    ['categoryGroupVisibilities', 'データカテゴリグループの可視性はProfileに残します。'],
    ['description', 'Profileの説明は権限ではないため、移行元Profileに残します。'],
    ['layoutAssignments', 'ページレイアウト割り当てはProfileで管理します。'],
    ['loginFlows', 'ログインフロー割り当てはProfileで管理します。'],
    ['loginHours', 'ログイン時間はProfileで管理します。'],
    ['loginIpRanges', 'ログインIP範囲はProfileで管理します。'],
    ['profileActionOverrides', 'Profile固有のアクションオーバーライドはProfileに残します。']
]);

// Permission SetのAssigned Appsを現在の組織でdry-runできたUser Licenseを定義する。
const userLicensesWithAssignedApps = new Set([
    'Analytics Cloud Integration User',
    'Force.com - App Subscription',
    'Force.com - Free',
    'Gold Partner',
    'Identity',
    'Partner App Subscription',
    'Partner Community',
    'Partner Community Login',
    'Salesforce',
    'Salesforce Integration',
    'Salesforce Platform',
    'Silver Partner'
]);

// 既知の同等ライセンスだけを、確認済みライセンスと同じ方針へ関連付ける。
const equivalentAssignedAppsUserLicenses = new Map([['Salesforce Platform Login', 'Salesforce Platform']]);

// Permission SetのAssigned Appsを許可しない、または対応元と同等のUser Licenseを定義する。
const userLicensesWithoutAssignedApps = new Set([
    'Authenticated Website',
    'Chatter External',
    'Chatter Free',
    'Customer Community',
    'Customer Community Login',
    'Customer Community Plus',
    'Customer Community Plus Login',
    'Customer Portal Manager Custom',
    'Customer Portal Manager Standard',
    'External Apps',
    'External Apps Login',
    'External Identity',
    'High Volume Customer Portal',
    'Overage Authenticated Website',
    'Overage Customer Portal Manager Custom',
    'Overage Customer Portal Manager Standard',
    'Overage High Volume Customer Portal',
    'Work.com Only'
]);

// API 67.0のdry-runで権限種別の制約を確認したChatterライセンスだけへ適用する。
const chatterUserLicenses = new Set(['Chatter External', 'Chatter Free']);
// システム権限は一括除外せず、単独指定でも拒否された3権限だけを除く。
const chatterUnsupportedUserPermissions = new Set(['AssignTopics', 'CreateTopics', 'EditTopics']);
// ライセンスが許可しない権限種別を、Profile側の要素名で識別する。
const chatterUnsupportedSections = new Set(['applicationVisibilities', 'fieldPermissions', 'tabVisibilities']);

// Chatterの既知のライセンス制約に該当する付与だけを省略し、元の設定を記録する。
function reportChatterLicenseRestriction(report, sourceElement, name, value) {
    // 他のChatter製品や通常ライセンスへ制約を拡大しない。
    if (!chatterUserLicenses.has(report.source.userLicense)) {
        // 通常の変換規則を継続する。
        return false;
    }
    // 権限種別または正確なシステム権限名で、確認済みの非対応だけを判定する。
    const unsupported =
        chatterUnsupportedSections.has(sourceElement) ||
        (sourceElement === 'userPermissions' && chatterUnsupportedUserPermissions.has(name));
    // 制約対象でない権限はそのまま変換する。
    if (!unsupported) {
        // 未知の権限をライセンス名だけで除外しない。
        return false;
    }
    // 生成XMLに含まれない付与を、変換成功件数と分けて監査可能にする。
    addReportEntry(
        report,
        'skippedUnsupported',
        sourceElement,
        name,
        `${report.source.userLicense}のライセンス制約により、この権限はPermission Setへ出力しません。`,
        {
            action: 'omitted',
            reason: 'userLicenseDoesNotAllowPermission',
            userLicense: report.source.userLicense,
            value
        }
    );
    // 呼び出し元でこの付与だけを出力候補から除く。
    return true;
}

// User Licenseを確認済みのAssigned Apps方針へ分類する。
function getAssignedAppsLicensePolicy(userLicense) {
    // 非対応と確認できるライセンスはアプリケーション表示権限をProfileへ残す。
    if (userLicensesWithoutAssignedApps.has(userLicense)) {
        // 残置対象であることを後続の分類処理へ伝える。
        return { status: 'unsupported' };
    }

    // 公式Helpで同等と確認できる新しいライセンス名を検証済みの基準名へ揃える。
    const validatedUserLicense = equivalentAssignedAppsUserLicenses.get(userLicense) ?? userLicense;

    // 検証済み一覧にないライセンスを対応扱いせず、後続処理でfail closedにする。
    if (!userLicensesWithAssignedApps.has(validatedUserLicense)) {
        // 未検証のライセンスで権限を推測生成しない。
        return { status: 'unknown' };
    }

    // アプリ数上限は契約やアプリ種別に依存するため、対応可否だけを返す。
    return {
        status: 'supported',
        validatedUserLicense
    };
}

// Profile XMLのオブジェクト権限名をPermission SetのMetadata API順に定義する。
const leadingObjectPermissionNames = ['allowCreate', 'allowDelete', 'allowEdit', 'allowRead', 'modifyAllRecords'];
// object識別子より後に配置する必須権限を定義する。
const trailingObjectPermissionNames = ['viewAllRecords'];
// 省略できない権限を補完処理の対象へまとめる。
const requiredObjectPermissionNames = [...leadingObjectPermissionNames, ...trailingObjectPermissionNames];
// API versionにより省略可能な権限を区別する。
const optionalObjectPermissionNames = ['viewAllFields'];
// 入力検査と有効権限の判定に共通の集合を使う。
const objectPermissionNames = [...requiredObjectPermissionNames, ...optionalObjectPermissionNames];

// Setupでは自動調整されるがMetadata APIでは明示が必要なUser Permission依存を定義する。
const userPermissionObjectDependencies = [
    {
        objectApiName: 'Document',
        requiredPermissions: ['allowRead'],
        userPermissionName: 'EditHtmlTemplates'
    },
    {
        objectApiName: 'Document',
        requiredPermissions: ['allowCreate', 'allowDelete', 'allowEdit', 'allowRead'],
        userPermissionName: 'EditPublicDocuments'
    },
    {
        objectApiName: 'Document',
        requiredPermissions: ['allowRead', 'viewAllRecords'],
        userPermissionName: 'ViewAllData'
    }
];

// Metadata APIで子オブジェクト権限が要求する親オブジェクト権限を定義する。
const objectPermissionObjectDependencies = [
    {
        objectApiName: 'Account',
        requiredPermissions: ['allowRead'],
        sourceObjectApiName: 'Entitlement',
        sourcePermissions: ['allowRead']
    }
];

// Metadata API 67.0のProfile直下で、変換、残置、または制御情報として扱う要素を定義する。
const supportedProfileElements = new Set([
    '@_xmlns',
    'applicationVisibilities',
    'custom',
    'fieldPermissions',
    'objectPermissions',
    'pageAccesses',
    'recordTypeVisibilities',
    'tabVisibilities',
    'userLicense',
    ...retainedProfileElements.keys(),
    ...enabledAccessDefinitions.map(({ source }) => source)
]);

// XML値の型を固定し、文字列のfalseをtruthyとして扱わない。
function parseBoolean(value, context) {
    // 明示的な許可値だけを有効として扱う。
    if (value === true || value === 'true') {
        // 呼び出し元が文字列の真偽を誤判定しない形にする。
        return true;
    }

    // 明示的な無効値を許可値から分離する。
    if (value === false || value === 'false') {
        // 拒否権限ではなく未付与として後続へ渡す。
        return false;
    }

    // 未知の表記から権限の有効状態を推測しない。
    throw new Error(`${context}はtrueまたはfalseである必要があります。`);
}

// Metadata APIが単一要素をobject、複数要素をarrayで返す差を吸収する。
function toArray(value) {
    // 未取得のセクションを空の対象集合として扱う。
    if (value === undefined) {
        // 省略された設定を新規権限へ変換しない。
        return [];
    }

    // 単一件と複数件を同じ変換経路に揃える。
    return Array.isArray(value) ? value : [value];
}

// 変換対象名を空値やobjectのまま処理しない。
function requireIdentifier(entry, identifier, context) {
    // 権限の対応付けに必要な識別子を取り出す。
    const value = entry?.[identifier];

    // 空値や複合要素をAPI名として採用しない。
    if (typeof value !== 'string' || value.trim() === '') {
        // 修正が必要な権限と識別子を示して停止する。
        throw new Error(`${context}.${identifier}が設定されていません。`);
    }

    // 周辺空白による重複判定のすり抜けを防ぐ。
    return value.trim();
}

// 同一権限が複数回出力されるとdeploy結果が不定になるため事前に拒否する。
function assertUniqueIdentifier(entries, identifier, context) {
    // 既出の権限名を比較できる状態を用意する。
    const identifiers = new Set();

    // 全入力を走査して重複権限を検出する。
    for (const entry of entries) {
        // 比較前に空値と周辺空白を処理する。
        const value = requireIdentifier(entry, identifier, context);

        // 同一権限の異なる設定を上書きで隠さない。
        if (identifiers.has(value)) {
            // 競合するAPI名を示して変換を停止する。
            throw new Error(`${context}に重複した設定があります: ${value}`);
        }

        // 後続要素と照合できるよう既出名を保存する。
        identifiers.add(value);
    }
}

// API名の順に並べ、入力XMLの順序に依存しない安定した生成結果にする。
function sortByIdentifier(entries, identifier) {
    // 元配列を変更せず、生成順をAPI名で安定させる。
    return [...entries].sort((left, right) => String(left[identifier]).localeCompare(String(right[identifier]), 'en'));
}

// Salesforceのmetadata API名として安全なPermission Set名だけを許可する。
function validatePermissionSetApiName(apiName) {
    // ファイル名とmetadata名に使えない文字を拒否する。
    if (typeof apiName !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(apiName)) {
        // 入力名の修正に必要な形式を利用者へ示す。
        throw new Error('Permission Set API名は英字で始まる英数字とアンダースコアで指定してください。');
    }

    // Salesforceが拒否するアンダースコアの配置を検出する。
    if (apiName.endsWith('_') || apiName.includes('__')) {
        // 生成後のdeploy失敗を入力段階で防ぐ。
        throw new Error('Permission Set API名の末尾または連続するアンダースコアは使用できません。');
    }

    // Metadata APIの名前長制約を超える入力を拒否する。
    if (apiName.length > 80) {
        // 名前を黙って切り詰めず利用者へ修正を求める。
        throw new Error('Permission Set API名は80文字以内で指定してください。');
    }
}

// 不正なXMLを部分的なオブジェクトとして解釈せず、解析前に入力全体を検証する。
function validateXml(xml, context) {
    // 空入力から不完全な変換結果を作らない。
    if (typeof xml !== 'string' || xml.trim() === '') {
        // 問題の入力種別を明示して停止する。
        throw new Error(`${context}が空です。`);
    }

    // 解析前に文書全体のXML構文を確認する。
    const validation = XMLValidator.validate(xml);

    // 構文エラーがある入力は部分的にも変換しない。
    if (validation !== true) {
        // XML検証の詳細を残して入力修正につなげる。
        throw new Error(`${context}のXML形式が不正です: ${validation.err.msg}`);
    }

    // コメント、CDATA、処理命令内の文字列を除き、実際のDTD宣言だけを見つける。
    const declarations = xml.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE\b/gu) ?? [];
    // 独自・外部エンティティを展開せず、XML標準の文字参照だけを扱う。
    if (declarations.includes('<!DOCTYPE')) {
        // Profile、関連項目、再取得XMLのすべてで同じ安全境界を適用する。
        throw new Error(`${context}のDOCTYPE宣言は使用できません。`);
    }
}

// Profileの項目API名から、同じsource treeにあるCustomField metadataを特定する。
function getFieldMetadataPath(objectsDirectory, fieldApiName) {
    // ディレクトリ区切りや複数の区切りを含む値をSalesforceの項目API名として扱わない。
    if (typeof fieldApiName !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/u.test(fieldApiName)) {
        // 不正な項目名をファイルパスへ展開しない。
        throw new Error(`fieldPermissions.fieldの形式が不正です: ${fieldApiName}`);
    }

    // 検証済みの完全修飾名をオブジェクト名と項目名へ分ける。
    const [objectApiName, fieldName] = fieldApiName.split('.');
    // 相対表記を残さず参照境界の起点を確定する。
    const resolvedObjectsDirectory = path.resolve(objectsDirectory);
    // 対象CustomField metadataを起点からの絶対パスとして解決する。
    const metadataPath = path.resolve(resolvedObjectsDirectory, objectApiName, 'fields', `${fieldName}.field-meta.xml`);
    // API名検証後も参照先がobjectsディレクトリ配下に留まることを確認する。
    const relativeMetadataPath = path.relative(resolvedObjectsDirectory, metadataPath);

    // 実装変更でAPI名検証が緩んでも入力ディレクトリ外のファイルを参照しない。
    if (
        relativeMetadataPath === '..' ||
        relativeMetadataPath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeMetadataPath)
    ) {
        // 許可したsource tree以外の参照を停止する。
        throw new Error(`fieldPermissions.fieldの参照先がobjectsディレクトリ外です: ${fieldApiName}`);
    }

    // 検証済みのCustomField metadataパスを返す。
    return metadataPath;
}

// 項目metadataを読み、Permission Setへ出力できない必須・数式・主従項目を判定する。
function inspectFieldMetadata({ fieldApiName, objectsDirectory, existsSync, readFileSync, parser }) {
    // 項目の型判定に使うローカルmetadataを特定する。
    const metadataPath = getFieldMetadataPath(objectsDirectory, fieldApiName);

    // 未取得項目は型を推測せず、元Profileの権限を維持できる状態を返す。
    if (!existsSync(metadataPath)) {
        // 不足しているmetadataの場所をレポートへ伝える。
        return { found: false, metadataPath };
    }

    // 組織へ接続せず取得済みの項目定義を読む。
    const fieldXml = readFileSync(metadataPath, 'utf8');
    // 関連項目にも構文検証とDTD拒否を適用する。
    validateXml(fieldXml, `CustomField metadata ${metadataPath}`);
    // Profileと同じ文字参照方針で項目定義を解析する。
    const parsed = parser.parse(fieldXml);
    // 項目以外のmetadataを型判定へ混入させない。
    const field = parsed?.CustomField;

    // 項目ルートがないXMLを検出する。
    if (!field || typeof field !== 'object') {
        // 誤った参照先を示して変換を停止する。
        throw new Error(`CustomField XMLとして解析できません: ${metadataPath}`);
    }

    // 別の名前空間の定義をSalesforce項目として扱わない。
    if (field['@_xmlns'] !== metadataNamespace) {
        // 名前空間の異常を参照先付きで通知する。
        throw new Error(`CustomField XMLのnamespaceが不正です: ${metadataPath}`);
    }

    // 数式と積み上げ集計を編集不可の項目として扱う。
    const localFormula = field.formula !== undefined || field.summaryForeignKey !== undefined;
    // 権限セットへ出力できない主従項目を識別する。
    const localMasterDetail = field.type === 'MasterDetail';
    // 入力に明示された必須制約だけを採用する。
    const localRequired = field.required === true || field.required === 'true';
    // 変換側へ判定根拠と項目特性をまとめて渡す。
    return {
        found: true,
        metadataPath,
        formula: localFormula,
        masterDetail: localMasterDetail,
        required: !localFormula && localRequired,
        source: 'localMetadata'
    };
}

// 変換レポートへ同じ形式の明細を追加する。
function addReportEntry(report, category, sourceElement, name, message, details = {}) {
    // すべての分類結果を同じ監査形式で記録する。
    report[category].push({ sourceElement, name, message, ...details });
}

// 未対応の子要素だけをスキップとして記録し、対応済みの設定は変換を続ける。
function reportUnknownEntryKeys(report, sourceElement, name, entry, allowedKeys) {
    // 既知のセクションでも未対応の子要素を探す。
    for (const key of Object.keys(entry)) {
        // 未対応値を黙って省略しない。
        if (!allowedKeys.has(key)) {
            // XMLへ出力しない設定を、元の値とともに追跡できるようにする。
            addReportEntry(
                report,
                'skippedUnsupported',
                sourceElement,
                name,
                `未対応の子要素をスキップしました: ${key}`,
                {
                    childElement: key,
                    value: entry[key]
                }
            );
        }
    }
}

// Profile XMLを一度だけ検証・解析し、入力抽出と最終変換で共有できるモデルを返す。
function parseProfileXml(profileXml) {
    // 不正XMLとDTDを解析前に拒否する。
    validateXml(profileXml, 'Profile');
    // 文字参照だけを復号し、権限の真偽値とAPI名は文字列で保持する。
    const parser = new XMLParser({
        attributeNamePrefix: '@_',
        ignoreDeclaration: true,
        ignoreAttributes: false,
        parseAttributeValue: false,
        parseTagValue: false,
        processEntities: true,
        htmlEntities: xmlEntities,
        trimValues: true
    });
    // 検証済みXMLから変換用のモデルを作る。
    const parsed = parser.parse(profileXml);
    // 変換対象のProfileルートを取り出す。
    const profile = parsed?.Profile;

    // 複数ルートから一部だけ選択する誤変換を防ぐ。
    if (Object.keys(parsed).length !== 1) {
        // Profileだけの入力へ修正するよう通知する。
        throw new Error('Profile XMLのルート要素はProfileだけを指定してください。');
    }

    // Profileとして設定を持たない入力を拒否する。
    if (!profile || typeof profile !== 'object') {
        // 不完全な入力から権限セットを生成しない。
        throw new Error('Profile XMLとして解析できません。');
    }

    // Metadata API以外のXMLを変換対象にしない。
    if (profile['@_xmlns'] !== metadataNamespace) {
        // 実際の名前空間を示して修正を促す。
        throw new Error(`Profile XMLのnamespaceが不正です: ${profile['@_xmlns'] ?? '未設定'}`);
    }

    // CLIの名前解決と最終変換で解析結果を共有する。
    return { parser, profile };
}

// 変換に必要なラベルと入力directoryを一箇所で検証する。
function validateConversionInput({ objectsDirectory, permissionSetLabel }) {
    // 表示名のない権限セットを作らない。
    if (typeof permissionSetLabel !== 'string' || permissionSetLabel.trim() === '') {
        // 必須のラベル入力を利用者へ通知する。
        throw new Error('Permission Setラベルを指定してください。');
    }

    // ラベルの上限を変換開始前に検査する。
    if (permissionSetLabel.trim().length > 80) {
        // 黙って短縮せず入力エラーとして扱う。
        throw new Error('Permission Setラベルは80文字以内で指定してください。');
    }

    // 項目特性を確認するsource treeの起点を必須にする。
    if (!objectsDirectory) {
        // 未指定のパスから項目情報を推測しない。
        throw new Error('項目metadataを確認するobjects directoryを指定してください。');
    }
}

// Profileと生成先の識別情報から、全変換処理で共有する監査レポートを初期化する。
function createConversionReport({
    permissionSetApiName,
    permissionSetDescription,
    permissionSetLabel,
    profileName,
    profilePath,
    profileXml,
    userLicense
}) {
    // 入力と出力の対応、各要素の分類を追跡できるレポートを初期化する。
    return {
        schemaVersion: 3,
        source: {
            profile: profileName,
            profilePath,
            sha256: crypto.createHash('sha256').update(profileXml).digest('hex'),
            userLicense
        },
        permissionSet: {
            apiName: permissionSetApiName,
            description: permissionSetDescription,
            label: permissionSetLabel.trim(),
            license: userLicense
        },
        converted: [],
        retainedInProfile: [],
        skippedDisabled: [],
        skippedUnsupported: [],
        requiresValidation: [],
        unsupportedUnknown: []
    };
}

// 未対応のProfile直下要素をスキップとして記録し、対応済み権限の生成は続ける。
function reportUnknownProfileElements(profile, report) {
    // Profile直下のすべての要素を対応一覧と照合する。
    for (const elementName of Object.keys(profile)) {
        // 将来のAPI要素を認識せず破棄することを防ぐ。
        if (!supportedProfileElements.has(elementName)) {
            // 出力しない要素とその値をレポートへ残す。
            addReportEntry(
                report,
                'skippedUnsupported',
                elementName,
                elementName,
                '未対応のProfile要素をスキップしました。',
                { value: profile[elementName] }
            );
        }
    }
}

// アプリケーションの利用権限を変換し、Profile固有のデフォルト指定を分離する。
function convertApplicationVisibilitySection(profile, report) {
    // 単一アプリと複数アプリを同じ分類処理へ渡す。
    const applications = toArray(profile.applicationVisibilities);
    // 同じアプリの競合設定を変換前に拒否する。
    assertUniqueIdentifier(applications, 'application', 'applicationVisibilities');
    // 移行可能な表示権限だけを蓄積する。
    const converted = [];
    // 元Profileのライセンスを互換性判定の根拠にする。
    const userLicense = report.source.userLicense;
    // ライセンス名を推測で許可せず、確認済み方針だけを使用する。
    const licensePolicy = getAssignedAppsLicensePolicy(userLicense);
    // ライセンス判定とレポート分類で共有できるよう、アプリケーション設定を先に正規化する。
    const parsedApplications = applications.map((application) => {
        // レポートと出力の両方で検証済みアプリ名を使う。
        const name = requireIdentifier(application, 'application', 'applicationVisibilities');
        // 未対応のアプリ設定を黙って破棄しない。
        reportUnknownEntryKeys(
            report,
            'applicationVisibilities',
            name,
            application,
            new Set(['application', 'default', 'visible'])
        );
        // 必須booleanを変換判断前に検証する。
        const isDefault = parseBoolean(application.default, `applicationVisibilities.${name}.default`);
        // 文字列falseを誤って表示権限へ変換しない。
        const visible = parseBoolean(application.visible, `applicationVisibilities.${name}.visible`);
        // 解析済み値をレポート分類とXML生成で再利用する。
        return { isDefault, name, visible, value: application };
    });
    // 未確認ライセンスでも移行対象がなければ停止しないよう、表示アプリの有無を確認する。
    const visibleApplicationCount = parsedApplications.filter(({ visible }) => visible).length;
    // 対応可否だけで変換し、標準アプリを含む総件数から契約上限を推測しない。
    const canAssignApplications = licensePolicy.status === 'supported';
    // ライセンス理由で残した設定の有無を集計する。
    let retainedByUserLicense = false;

    // 表示アプリがある場合だけ、未知ライセンスを実際の変換阻止理由として記録する。
    if (visibleApplicationCount > 0 && licensePolicy.status === 'unknown') {
        // 未検証のライセンスでXMLを書かないための停止理由を残す。
        addReportEntry(
            report,
            'unsupportedUnknown',
            'applicationVisibilities',
            userLicense,
            'このUser LicenseはAssigned Appsの変換対応一覧に含まれていないため、Permission Set XMLを生成しません。',
            { reason: 'userLicenseAssignedAppsCompatibilityUnknown', userLicense }
        );
    }

    // 解析済みのアプリ設定を移行・無効・残置へ分類する。
    for (const { isDefault, name, visible, value } of parsedApplications) {
        // Chatterの表示権限は制約理由と元の値をスキップ明細へ記録する。
        const skippedByLicense =
            visible && reportChatterLicenseRestriction(report, 'applicationVisibilities', name, value);
        // 対応ライセンスの明示的な表示権限だけを移行する。
        if (visible && canAssignApplications) {
            // Profile固有のdefaultを含めず表示権限だけを保持する。
            converted.push({ application: name, visible: 'true' });
            // 移行したアプリを監査レポートへ記録する。
            addReportEntry(
                report,
                'converted',
                'applicationVisibilities',
                name,
                '表示可能な割り当てアプリケーションを変換しました。',
                { targetElement: 'applicationVisibilities' }
            );
            // 非表示設定を拒否権限として生成しない。
        } else if (!visible) {
            // 非表示アプリを省略した根拠を残す。
            addReportEntry(
                report,
                'skippedDisabled',
                'applicationVisibilities',
                name,
                'visible=falseは拒否権限ではないため出力しません。'
            );
        } else if (!skippedByLicense) {
            // 後続レポートにProfile残置の確認を追加できるよう記録する。
            retainedByUserLicense = true;
            // 非対応と未確認のライセンスをレポートから区別できる理由へ分類する。
            const reason =
                licensePolicy.status === 'unsupported'
                    ? 'userLicenseDoesNotAllowAssignedApps'
                    : 'userLicenseAssignedAppsCompatibilityUnknown';
            // 移行されない表示権限と理由を利用者へ伝える。
            addReportEntry(
                report,
                'retainedInProfile',
                'applicationVisibilities',
                name,
                'このUser LicenseのAssigned Appsは変換対象外です。',
                { action: 'omitted', reason, userLicense }
            );
        }

        // 利用権限と独立したデフォルト指定を取り扱う。
        if (isDefault) {
            // 権限セットで表現できないデフォルト設定の所在を残す。
            addReportEntry(
                report,
                'retainedInProfile',
                'applicationVisibilities',
                name,
                'デフォルトアプリケーション指定はProfileに残します。'
            );
        }
    }

    // ライセンス理由で省略したアプリがある場合だけ残置確認を促す。
    if (retainedByUserLicense) {
        // 非対応ライセンスと、書き込みを止めた未確認条件を確認手順から区別する。
        const reason =
            licensePolicy.status === 'unsupported'
                ? 'userLicenseDoesNotAllowAssignedApps'
                : 'userLicenseAssignedAppsCompatibilityUnknown';
        // 移行後も必要なProfile設定の確認を引き継ぐ。
        addReportEntry(
            report,
            'requiresValidation',
            'applicationVisibilities',
            userLicense,
            licensePolicy.status === 'unsupported'
                ? 'このライセンスでは、権限セットの「割り当てアプリケーション」が許可されないため、アプリへのアクセス設定をXMLに含めていません。'
                : '割り当てアプリケーションはPermission Set XMLに含めません。',
            { action: 'confirmProfileRetention', reason }
        );
    }

    // 移行対象がある場合だけ安定順のセクションを返す。
    return converted.length > 0 ? sortByIdentifier(converted, 'application') : undefined;
}

// enabled形式の各Profile権限を共通規則で変換し、Permission Setのセクションごとに返す。
function convertEnabledAccessSections(profile, report) {
    // 変換先要素ごとに付与権限をまとめる。
    const convertedSections = {};

    // 同じenabled形式の各権限を共通規則で処理する。
    for (const definition of enabledAccessDefinitions) {
        // 単一件の権限も配列として検査する。
        const entries = toArray(profile[definition.source]);
        // 同一名の競合を先に検出する。
        assertUniqueIdentifier(entries, definition.identifier, definition.source);
        // 有効な権限だけを対象セクションへ蓄積する。
        const convertedEntries = [];

        // 入力の各権限を明示されたenabled値で分類する。
        for (const entry of entries) {
            // 監査と出力に必要なAPI名を検証する。
            const name = requireIdentifier(entry, definition.identifier, definition.source);
            // 既知形式へ追加された未知の設定を検知する。
            reportUnknownEntryKeys(report, definition.source, name, entry, new Set([definition.identifier, 'enabled']));
            // 許可状態を推測せずXMLの明示値で確定する。
            const enabled = parseBoolean(entry.enabled, `${definition.source}.${name}.enabled`);

            // 無効権限は権限セットの拒否設定にしない。
            if (!enabled) {
                // 省略した権限の理由を監査用に残す。
                addReportEntry(
                    report,
                    'skippedDisabled',
                    definition.source,
                    name,
                    'enabled=falseは拒否権限ではないため出力しません。'
                );
                // 無効な設定が出力候補へ入ることを防ぐ。
                continue;
            }

            // 有効な設定のうち、ライセンスが許可しない権限だけを省略する。
            if (reportChatterLicenseRestriction(report, definition.source, name, entry)) {
                // 省略対象を変換済みとして二重計上しない。
                continue;
            }

            // Metadata APIが要求する子要素順で許可値を組み立てる。
            const convertedEntry = Object.fromEntries(
                definition.targetOrder.map((key) => [key, key === 'enabled' ? 'true' : name])
            );
            // 変換済みの許可値をセクションへ追加する。
            convertedEntries.push(convertedEntry);
            // 入力権限と出力セクションの対応を記録する。
            addReportEntry(report, 'converted', definition.source, name, '有効なアクセス権を変換しました。', {
                targetElement: definition.target
            });
        }

        // 対象がないセクションを空要素として生成しない。
        if (convertedEntries.length > 0) {
            // 出力をAPI名順にして入力順の影響を除く。
            convertedSections[definition.target] = sortByIdentifier(convertedEntries, definition.identifier);
        }
    }

    // 後続のXML組み立てへセクション別の結果を渡す。
    return convertedSections;
}

// API専用Profileでは利用できないVisualforceページアクセスを移行対象から分離する。
function convertPageAccessSection({ apiUserOnly, profile, report }) {
    // Profile XMLに記載されたVisualforceページアクセスを正規化する。
    const entries = toArray(profile.pageAccesses);
    // 同じVisualforceページが重複する不正入力を拒否する。
    assertUniqueIdentifier(entries, 'apexPage', 'pageAccesses');
    // Permission Setへ出力できるVisualforceページアクセスを蓄積する。
    const convertedEntries = [];

    // 各Visualforceページを有効状態とAPI専用制約に従って分類する。
    for (const entry of entries) {
        // 監査レポートと出力で共有するVisualforceページ名を取得する。
        const name = requireIdentifier(entry, 'apexPage', 'pageAccesses');
        // 将来追加された未知の子要素を黙って破棄しない。
        reportUnknownEntryKeys(report, 'pageAccesses', name, entry, new Set(['apexPage', 'enabled']));
        // 文字列とbooleanの差を吸収して有効状態を確定する。
        const enabled = parseBoolean(entry.enabled, `pageAccesses.${name}.enabled`);

        // 無効なアクセス権はPermission Setの拒否権限として扱わない。
        if (!enabled) {
            // 移行しない理由を監査レポートへ記録する。
            addReportEntry(
                report,
                'skippedDisabled',
                'pageAccesses',
                name,
                'enabled=falseは拒否権限ではないため出力しません。'
            );
            // 無効なページを移行候補へ含めない。
            continue;
        }

        // ApiUserOnlyが有効ならVisualforceを利用できないためProfile側へ残す。
        if (apiUserOnly) {
            // ライセンス名ではなくProfile XMLのAPI専用設定を根拠として記録する。
            addReportEntry(
                report,
                'retainedInProfile',
                'pageAccesses',
                name,
                'ApiUserOnly=trueのProfileではVisualforceページアクセスを利用できないためPermission Setへ出力しません。',
                { action: 'omitted', reason: 'apiUserOnly' }
            );
            // API専用Profileのページ権限を出力しない。
            continue;
        }

        // 通常Profileの有効なVisualforceページアクセスは値を変えずに出力する。
        convertedEntries.push({ apexPage: name, enabled: 'true' });
        // 正常変換した要素を監査レポートへ記録する。
        addReportEntry(report, 'converted', 'pageAccesses', name, '有効なアクセス権を変換しました。', {
            targetElement: 'pageAccesses'
        });
    }

    // API名順の安定した出力を返し、対象がなければセクション自体を省略する。
    return convertedEntries.length > 0 ? sortByIdentifier(convertedEntries, 'apexPage') : undefined;
}

// 参照不可の項目権限を拒否権限または矛盾した入力として分類する。
function reportUnreadableFieldPermission({ editable, fieldApiName, report }) {
    // 参照不可なのに編集可能な矛盾を検出する。
    if (editable) {
        // 矛盾したFLSを推測補正せず停止理由にする。
        addReportEntry(
            report,
            'unsupportedUnknown',
            'fieldPermissions',
            fieldApiName,
            'editable=trueかつreadable=falseの項目権限は変換できません。'
        );
        // 矛盾した設定を単なる未付与として記録しない。
        return;
    }

    // 参照も編集も不可の項目を省略理由付きで記録する。
    addReportEntry(
        report,
        'skippedDisabled',
        'fieldPermissions',
        fieldApiName,
        'readable=falseは拒否権限ではないため出力しません。'
    );
}

// Permission Setへ出力できない項目種別を判定し、理由を監査レポートへ記録する。
function reportIneligibleFieldPermission({ fieldApiName, fieldMetadata, report }) {
    // 主従項目のFLSを権限セットへ出力しない。
    if (fieldMetadata.found && fieldMetadata.masterDetail) {
        // 主従項目の省略を利用者が確認できるようにする。
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '主従関係項目はPermission SetのfieldPermissionsへ出力しません。',
            { action: 'omitted', reason: 'masterDetail' }
        );
        // この項目を出力対象から外すよう呼び出し元へ伝える。
        return true;
    }

    // スキーマ必須の項目をFLSから除外する。
    if (fieldMetadata.found && fieldMetadata.required) {
        // 必須項目を省略した理由と確認事項を残す。
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '必須項目はPermission SetのfieldPermissionsへ出力しません。',
            { action: 'omitted', reason: 'required' }
        );
        // 必須項目のFLS出力を止める。
        return true;
    }

    // 定義の未取得だけでは通知・除外せず、出力不可の条件がない項目の変換を続ける。
    return false;
}

// 単一の項目権限をローカルmetadataで検証し、出力可能な権限だけを返す。
function convertFieldPermission({ existsSync, fieldPermission, objectsDirectory, parser, readFileSync, report }) {
    // パス検証とレポートで共有する完全修飾項目名を得る。
    const fieldApiName = requireIdentifier(fieldPermission, 'field', 'fieldPermissions');
    // 未知のFLS属性を出力から黙って落とさない。
    reportUnknownEntryKeys(
        report,
        'fieldPermissions',
        fieldApiName,
        fieldPermission,
        new Set(['editable', 'field', 'readable'])
    );
    // 省略された参照権限を未付与として正規化する。
    const readable = parseBoolean(fieldPermission.readable ?? false, `fieldPermissions.${fieldApiName}.readable`);
    // 編集権限は必須の明示値として検証する。
    const editable = parseBoolean(fieldPermission.editable, `fieldPermissions.${fieldApiName}.editable`);

    // 参照不可の項目は許可値の生成から分離する。
    if (!readable) {
        // 参照不可設定が矛盾か未付与かを記録する。
        reportUnreadableFieldPermission({ editable, fieldApiName, report });
        // 参照権限のない項目を出力しない。
        return undefined;
    }

    // 入力の矛盾を検証した後、ライセンスが許可しないFLSを記録して省略する。
    if (reportChatterLicenseRestriction(report, 'fieldPermissions', fieldApiName, fieldPermission)) {
        // 出力しないFLSのためにローカル項目定義を読み込まない。
        return undefined;
    }

    // 取得済みmetadataから必須・主従・数式の制約を確認する。
    const fieldMetadata = inspectFieldMetadata({
        fieldApiName,
        objectsDirectory,
        existsSync,
        readFileSync,
        parser
    });

    // 型に応じたFLS除外条件を適用する。
    if (reportIneligibleFieldPermission({ fieldApiName, fieldMetadata, report })) {
        // 出力できない項目の権限候補を残さない。
        return undefined;
    }

    // 数式項目だけ編集権限を無効へ正規化する。
    const convertedEditable = fieldMetadata.formula && editable ? false : editable;

    // 入力の編集値を変更した場合は監査対象にする。
    if (fieldMetadata.formula && editable) {
        // 数式項目の補正を利用者が追跡できるよう残す。
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '数式項目のeditableをfalseへ正規化しました。',
            { action: 'normalized' }
        );
    }

    // 移行した項目と出力要素の対応を記録する。
    addReportEntry(report, 'converted', 'fieldPermissions', fieldApiName, '参照可能な項目権限を変換しました。', {
        targetElement: 'fieldPermissions'
    });
    // 参照可能な項目のFLSをXML用の文字列値で返す。
    return { editable: String(convertedEditable), field: fieldApiName, readable: 'true' };
}

// Profileの項目権限を一括変換し、出力対象がある場合だけPermission Setセクションを返す。
function convertFieldPermissionSection(context) {
    // すべてのFLSを単一件と複数件の差なく検査する。
    const fieldPermissions = toArray(context.profile.fieldPermissions);
    // 同じ項目の競合する権限を先に拒否する。
    assertUniqueIdentifier(fieldPermissions, 'field', 'fieldPermissions');
    // 型判定を適用して出力対象のFLSだけを集める。
    const converted = fieldPermissions
        .map((fieldPermission) => convertFieldPermission({ ...context, fieldPermission }))
        .filter(Boolean);
    // FLSが存在する場合だけ安定順のセクションを返す。
    return converted.length > 0 ? sortByIdentifier(converted, 'field') : undefined;
}

// Profile XMLのオブジェクト権限を、Permission Setで必要なboolean値へ揃える。
function normalizeObjectPermission({ objectApiName, objectPermission, report }) {
    // 未知のオブジェクト権限を黙って捨てない。
    reportUnknownEntryKeys(
        report,
        'objectPermissions',
        objectApiName,
        objectPermission,
        new Set(['object', ...objectPermissionNames])
    );

    // 判定用のboolean権限を名前ごとに保持する。
    const values = {};

    // 省略値を含め対応するすべての権限を確認する。
    for (const permissionName of objectPermissionNames) {
        // 元Profileに明示された値を判定の根拠にする。
        const profileValue = objectPermission?.[permissionName];
        // 省略は未付与とし、それ以外は厳密にbooleanを検証する。
        const profileEnabled =
            profileValue === undefined
                ? false
                : parseBoolean(profileValue, `objectPermissions.${objectApiName}.${permissionName}`);

        // 正規化済みの権限を付与有無の判定へ渡す。
        values[permissionName] = profileEnabled;
    }

    // XML組み立てと依存補完で使う権限集合を返す。
    return values;
}

// Profile XMLから正規化したオブジェクト権限をMetadata APIの子要素順へ変換する。
function buildObjectPermissionEntry({ objectApiName, profileObjectPermission, values }) {
    // 必須の権限は未付与でもfalseを明示する。
    const normalizedValues = Object.fromEntries(
        requiredObjectPermissionNames.map((permissionName) => [permissionName, String(values[permissionName])])
    );

    // 任意権限は有効値か入力に存在する場合だけ出力する。
    if (values.viewAllFields || profileObjectPermission?.viewAllFields !== undefined) {
        // 全項目参照の入力値をXML文字列へ揃える。
        normalizedValues.viewAllFields = String(values.viewAllFields);
    }

    // Metadata API順に権限要素を配置する器を用意する。
    const normalized = {};

    // object名より前の必須権限を先に配置する。
    for (const permissionName of leadingObjectPermissionNames) {
        // 正規化した権限をAPIが求める位置へ追加する。
        normalized[permissionName] = normalizedValues[permissionName];
    }

    // 付与対象オブジェクトの識別子を配置する。
    normalized.object = objectApiName;

    // API versionに応じた任意権限を配置する。
    for (const permissionName of optionalObjectPermissionNames) {
        // 省略可能な値を不必要に補完しない。
        if (normalizedValues[permissionName] !== undefined) {
            // 入力または付与がある任意権限だけを引き継ぐ。
            normalized[permissionName] = normalizedValues[permissionName];
        }
    }

    // object名より後の必須権限を配置する。
    for (const permissionName of trailingObjectPermissionNames) {
        // 末尾の権限もAPI定義順で出力する。
        normalized[permissionName] = normalizedValues[permissionName];
    }

    // 順序と必須値を揃えたオブジェクト権限を返す。
    return normalized;
}

// Profile XMLに明示された有効なオブジェクト権限だけをPermission Setへ変換する。
function convertObjectPermissionSection({ profile, report }) {
    // 入力のオブジェクト権限を一括検査できる形へ揃える。
    const objectPermissions = toArray(profile.objectPermissions);
    // 同じオブジェクトの矛盾する設定を先に拒否する。
    assertUniqueIdentifier(objectPermissions, 'object', 'objectPermissions');
    // 実際の付与を持つオブジェクトだけを蓄積する。
    const converted = [];

    // 各オブジェクトの許可状態を入力値から決める。
    for (const objectPermission of objectPermissions) {
        // レポートと出力に使うオブジェクト名を検証する。
        const objectApiName = requireIdentifier(objectPermission, 'object', 'objectPermissions');
        // 省略値を含め権限の真偽値を揃える。
        const values = normalizeObjectPermission({ objectApiName, objectPermission, report });
        // 権限を一つも付与しないオブジェクトを識別する。
        const hasGrant = objectPermissionNames.some((permissionName) => values[permissionName]);

        // 全権限falseを拒否設定として出力しない。
        if (!hasGrant) {
            // 省略したオブジェクトの根拠を記録する。
            addReportEntry(
                report,
                'skippedDisabled',
                'objectPermissions',
                objectApiName,
                'すべてfalseのオブジェクト権限は出力しません。'
            );
            // 未付与のオブジェクトが候補へ入らないようにする。
            continue;
        }

        // API順に組み立てた許可値を候補へ追加する。
        converted.push(
            buildObjectPermissionEntry({
                objectApiName,
                profileObjectPermission: objectPermission,
                values
            })
        );
        // 入力に基づく変換であることを監査情報に残す。
        addReportEntry(
            report,
            'converted',
            'objectPermissions',
            objectApiName,
            '1件以上の付与を持つオブジェクト権限を変換しました。',
            { sources: ['profileXml'], targetElement: 'objectPermissions' }
        );
    }

    // 付与対象がある場合だけ安定順の権限を返す。
    return converted.length > 0 ? sortByIdentifier(converted, 'object') : undefined;
}

// 有効なUser Permissionが要求するObject Permissionを、ローカルProfileの付与権限から派生させる。
function applyUserPermissionObjectDependencies({ convertedSections, report }) {
    // 依存補完の起点となる有効なシステム権限を特定する。
    const enabledUserPermissions = new Set(toArray(convertedSections.userPermissions).map(({ name }) => name));
    // 元の変換結果を直接変更せず補完用の権限集合を用意する。
    const objectPermissions = toArray(convertedSections.objectPermissions).map((entry) => ({ ...entry }));

    // 確認済みの依存関係だけを補完対象にする。
    for (const dependency of userPermissionObjectDependencies) {
        // 起点の権限がない依存関係は適用しない。
        if (!enabledUserPermissions.has(dependency.userPermissionName)) {
            // 不要なオブジェクト権限の追加を防ぐ。
            continue;
        }

        // 補完対象のオブジェクトが既に出力候補にあるか確認する。
        const existingIndex = objectPermissions.findIndex(({ object }) => object === dependency.objectApiName);
        // 既存の付与を維持したまま不足分を計算する。
        const existing = existingIndex >= 0 ? objectPermissions[existingIndex] : undefined;
        // 既存値を補完処理用のbooleanへ揃える。
        const values = Object.fromEntries(
            objectPermissionNames.map((permissionName) => [permissionName, existing?.[permissionName] === 'true'])
        );
        // 既に有効な権限を重複追加しない。
        const addedPermissions = dependency.requiredPermissions.filter((permissionName) => !values[permissionName]);

        // 依存が満たされていれば補完もレポート追加も不要とする。
        if (addedPermissions.length === 0) {
            // 既存の十分な権限をそのまま維持する。
            continue;
        }

        // 不足している依存権限だけを有効にする。
        for (const permissionName of addedPermissions) {
            // 必要最小限の補完を権限集合へ反映する。
            values[permissionName] = true;
        }

        // 補完後もMetadata APIの順序を維持する。
        const derivedEntry = buildObjectPermissionEntry({
            objectApiName: dependency.objectApiName,
            profileObjectPermission: existing,
            values
        });

        // 同じオブジェクトを重複出力しないよう更新と追加を分ける。
        if (existingIndex >= 0) {
            // 既存候補を不足分の補完済み権限へ置き換える。
            objectPermissions[existingIndex] = derivedEntry;
        } else {
            // 元にない依存オブジェクトは一件だけ追加する。
            objectPermissions.push(derivedEntry);
        }

        // 補完した権限とその起点を監査レポートへ残す。
        addReportEntry(
            report,
            'converted',
            'userPermissions',
            dependency.userPermissionName,
            `依存する${dependency.objectApiName}のObject Permissionを補完しました。`,
            {
                action: 'addedDependency',
                addedPermissions,
                targetElement: 'objectPermissions',
                targetName: dependency.objectApiName
            }
        );
    }

    // 補完済みのオブジェクト権限を安定順で反映する。
    convertedSections.objectPermissions =
        objectPermissions.length > 0 ? sortByIdentifier(objectPermissions, 'object') : undefined;
}

// 有効な子オブジェクト権限が要求する親オブジェクト権限を、変換済み権限へ補完する。
function applyObjectPermissionObjectDependencies({ convertedSections, report }) {
    // 子親依存の補完前に既存の権限値を保持する。
    const objectPermissions = toArray(convertedSections.objectPermissions).map((entry) => ({ ...entry }));

    // 確認済みの子オブジェクト依存関係だけを調べる。
    for (const dependency of objectPermissionObjectDependencies) {
        // 依存を発生させる子オブジェクトの許可値を探す。
        const source = objectPermissions.find(({ object }) => object === dependency.sourceObjectApiName);
        // 依存対象の権限が子オブジェクトで有効かを確認する。
        const hasSourceGrant = dependency.sourcePermissions.some(
            (permissionName) => source?.[permissionName] === 'true'
        );

        // 子に付与がなければ親の権限を追加しない。
        if (!hasSourceGrant) {
            // 依存が発生しない設定を補完から外す。
            continue;
        }

        // 親オブジェクトの既存候補を特定する。
        const existingIndex = objectPermissions.findIndex(({ object }) => object === dependency.objectApiName);
        // 親の既存付与を維持して不足権限だけを扱う。
        const existing = existingIndex >= 0 ? objectPermissions[existingIndex] : undefined;
        // 不足分の計算に使えるboolean値へ揃える。
        const values = Object.fromEntries(
            objectPermissionNames.map((permissionName) => [permissionName, existing?.[permissionName] === 'true'])
        );
        // 親に必要で未付与の権限だけを選ぶ。
        const addedPermissions = dependency.requiredPermissions.filter((permissionName) => !values[permissionName]);

        // 親の権限が十分なら変更しない。
        if (addedPermissions.length === 0) {
            // 満たされている依存の重複記録を防ぐ。
            continue;
        }

        // 必要な親権限だけを補う。
        for (const permissionName of addedPermissions) {
            // 起点の子権限が要求する許可値を反映する。
            values[permissionName] = true;
        }

        // 補完済みの親権限をAPI順で組み立てる。
        const derivedEntry = buildObjectPermissionEntry({
            objectApiName: dependency.objectApiName,
            profileObjectPermission: existing,
            values
        });

        // 既存の親権限があるかで反映先を選ぶ。
        if (existingIndex >= 0) {
            // 既存の親候補を補完後の値へ更新する。
            objectPermissions[existingIndex] = derivedEntry;
        } else {
            // 未出力の親は依存候補として一件追加する。
            objectPermissions.push(derivedEntry);
        }

        // 追加した親権限と依存元の子を記録する。
        addReportEntry(
            report,
            'converted',
            'objectPermissions',
            dependency.sourceObjectApiName,
            `依存する${dependency.objectApiName}のObject Permissionを補完しました。`,
            {
                action: 'addedDependency',
                addedPermissions,
                targetElement: 'objectPermissions',
                targetName: dependency.objectApiName
            }
        );
    }

    // 子親依存を満たした権限集合を後続へ渡す。
    convertedSections.objectPermissions =
        objectPermissions.length > 0 ? sortByIdentifier(objectPermissions, 'object') : undefined;
}

// 単一レコードタイプの利用可否とProfileに残るデフォルト指定を分類する。
function convertRecordType(recordType, report) {
    // レコードタイプの利用権限を識別する名前を検証する。
    const name = requireIdentifier(recordType, 'recordType', 'recordTypeVisibilities');
    // 未知のレコードタイプ設定を黙って省略しない。
    reportUnknownEntryKeys(
        report,
        'recordTypeVisibilities',
        name,
        recordType,
        new Set(['default', 'personAccountDefault', 'recordType', 'visible'])
    );
    // 必須のdefault値を分類前に検証する。
    const isDefault = parseBoolean(recordType.default, `recordTypeVisibilities.${name}.default`);
    // 利用可否は入力のvisible値だけで決める。
    const visible = parseBoolean(recordType.visible, `recordTypeVisibilities.${name}.visible`);

    // 可視なレコードタイプだけを移行候補にする。
    if (visible) {
        // 移行した利用権限を記録する。
        addReportEntry(
            report,
            'converted',
            'recordTypeVisibilities',
            name,
            'カスタムレコードタイプの利用権限候補を変換しました。',
            { targetElement: 'recordTypeVisibilities' }
        );
        // 対象組織のカスタムレコードタイプへの適合性を確認事項に残す。
        addReportEntry(
            report,
            'requiresValidation',
            'recordTypeVisibilities',
            name,
            'Permission Setで利用可能なカスタムレコードタイプか対象組織で確認が必要です。'
        );
    } else {
        // 非表示のレコードタイプを省略した理由を残す。
        addReportEntry(
            report,
            'skippedDisabled',
            'recordTypeVisibilities',
            name,
            'visible=falseは拒否権限ではないため出力しません。'
        );
    }

    // 利用権限とは独立したデフォルト指定を検出する。
    if (isDefault) {
        // デフォルト指定の管理場所がProfileであることを記録する。
        addReportEntry(
            report,
            'retainedInProfile',
            'recordTypeVisibilities',
            name,
            'デフォルトレコードタイプ指定はProfileに残します。'
        );
    }

    // Person Account固有のデフォルト値も明示された場合だけ検証する。
    if (
        recordType.personAccountDefault !== undefined &&
        parseBoolean(recordType.personAccountDefault, `recordTypeVisibilities.${name}.personAccountDefault`)
    ) {
        // Person Accountのデフォルト指定をProfile残置として記録する。
        addReportEntry(
            report,
            'retainedInProfile',
            'recordTypeVisibilities',
            name,
            'Person Accountのデフォルトレコードタイプ指定はProfileに残します。'
        );
    }

    // 可視なレコードタイプだけを許可値へ変換する。
    return visible ? { recordType: name, visible: 'true' } : undefined;
}

// Profileのレコードタイプ可視性から有効なPermission Set権限だけを返す。
function convertRecordTypeSection(profile, report) {
    // 入力件数によらずすべてのレコードタイプを検査する。
    const recordTypes = toArray(profile.recordTypeVisibilities);
    // 同一レコードタイプの重複設定を拒否する。
    assertUniqueIdentifier(recordTypes, 'recordType', 'recordTypeVisibilities');
    // 利用可否とデフォルトを分類して出力候補だけを集める。
    const converted = recordTypes.map((recordType) => convertRecordType(recordType, report)).filter(Boolean);
    // 空セクションを省略し、API名順で出力する。
    return converted.length > 0 ? sortByIdentifier(converted, 'recordType') : undefined;
}

// Profileのタブ可視性をPermission SetのAvailableまたはVisibleへ変換する。
function convertTabSection(profile, report) {
    // タブ可視性を一括処理できる形に揃える。
    const tabs = toArray(profile.tabVisibilities);
    // 同一タブの重複した設定を拒否する。
    assertUniqueIdentifier(tabs, 'tab', 'tabVisibilities');
    // Profileの表示状態を権限セットの利用可否へ対応付ける。
    const visibilityMappings = new Map([
        ['DefaultOff', 'Available'],
        ['DefaultOn', 'Visible']
    ]);
    // 対応する表示状態だけを移行候補にする。
    const converted = [];

    // 各タブを利用権限とデフォルト表示に分離する。
    for (const tab of tabs) {
        // 出力と監査に使うタブAPI名を検証する。
        const name = requireIdentifier(tab, 'tab', 'tabVisibilities');
        // 未知のタブ設定を黙って落とさない。
        reportUnknownEntryKeys(report, 'tabVisibilities', name, tab, new Set(['tab', 'visibility']));
        // 明示的に対応する表示状態だけを変換する。
        const targetVisibility = visibilityMappings.get(tab.visibility);

        // 対応する状態ならタブ権限を生成する。
        if (targetVisibility) {
            // 有効なタブ設定でもライセンスが許可しない場合は、このタブだけを省略する。
            if (reportChatterLicenseRestriction(report, 'tabVisibilities', name, tab)) {
                // 省略したタブを変換済みの表示権限へ含めない。
                continue;
            }
            // 変換後の利用可否をタブごとに蓄積する。
            converted.push({ tab: name, visibility: targetVisibility });
            // 元の表示状態と生成先の権限を監査可能にする。
            addReportEntry(
                report,
                'converted',
                'tabVisibilities',
                name,
                `${tab.visibility}を${targetVisibility}へ変換しました。`,
                { targetElement: 'tabSettings' }
            );

            // デフォルト表示は利用権限と別に管理する。
            if (tab.visibility === 'DefaultOn') {
                // DefaultOnのデフォルト部分だけをProfileへ残す。
                addReportEntry(
                    report,
                    'retainedInProfile',
                    'tabVisibilities',
                    name,
                    'デフォルト表示の指定自体はProfileに残します。'
                );
            }

            // 変換済みのタブを未対応として扱わない。
            continue;
        }

        // 表示状態の欠落や不正な型は未対応値のスキップと区別する。
        const invalidVisibility = typeof tab.visibility !== 'string' || tab.visibility.trim() === '';
        // 有効な文字列の未対応値だけをスキップし、壊れた入力は生成を止める。
        addReportEntry(
            report,
            tab.visibility === 'Hidden'
                ? 'skippedDisabled'
                : invalidVisibility
                  ? 'unsupportedUnknown'
                  : 'skippedUnsupported',
            'tabVisibilities',
            name,
            tab.visibility === 'Hidden'
                ? 'Hiddenは拒否権限ではないため出力しません。'
                : invalidVisibility
                  ? 'タブ表示状態が未設定または不正です。'
                  : `未対応のタブ表示状態をスキップしました: ${tab.visibility}`,
            { value: tab.visibility }
        );
    }

    // タブ権限をAPI名順にして空の出力を省く。
    return converted.length > 0 ? sortByIdentifier(converted, 'tab') : undefined;
}

// Profile固有でPermission Setへ移さない設定を監査レポートへ列挙する。
function reportRetainedProfileElements(profile, report) {
    // Profile専用と定義した設定を漏れなく確認する。
    for (const [elementName, message] of retainedProfileElements) {
        // 複数の残置設定もそれぞれ監査対象にする。
        for (const [index, entry] of toArray(profile[elementName]).entries()) {
            // 固有名のない設定も位置情報で識別できるようにする。
            const name = entry?.layout ?? entry?.application ?? entry?.recordType ?? `${elementName}[${String(index)}]`;
            // 設定の管理場所と残置理由を記録する。
            addReportEntry(report, 'retainedInProfile', elementName, name, message);
        }
    }
}

// Metadata APIの直下要素順を維持してPermission Set objectを組み立てる。
function buildPermissionSet({ convertedSections, permissionSetDescription, permissionSetLabel, userLicense }) {
    // API定義順に組み立てる権限セットを用意する。
    const permissionSet = {};
    // 固定プロパティの前後に配置するセクションを定義する。
    const sectionGroups = [
        [
            'agentAccesses',
            'applicationVisibilities',
            'classAccesses',
            'customMetadataTypeAccesses',
            'customPermissions',
            'customSettingAccesses'
        ],
        ['externalDataSourceAccesses', 'fieldPermissions', 'flowAccesses', 'genComputingSummaryDefAccesses'],
        [
            'objectPermissions',
            'pageAccesses',
            'recordTypeVisibilities',
            'servicePresenceStatusAccesses',
            'tabSettings',
            'userPermissions'
        ]
    ];

    // 説明より前に必要なアクセス権を配置する。
    for (const section of sectionGroups[0]) {
        // 出力対象があるセクションだけを含める。
        if (convertedSections[section]) {
            // 変換済みの付与をAPI定義順で組み込む。
            permissionSet[section] = convertedSections[section];
        }
    }

    // 元Profileとの対応を表示用の説明へ残す。
    permissionSet.description = permissionSetDescription;

    // 説明とラベルの間に入るセクションを配置する。
    for (const section of sectionGroups[1]) {
        // 未付与の空セクションを生成しない。
        if (convertedSections[section]) {
            // 変換済みの権限を指定の位置へ配置する。
            permissionSet[section] = convertedSections[section];
        }
    }

    // 通常の割り当てで利用できる権限セットとして生成する。
    permissionSet.hasActivationRequired = 'false';
    // 検証済みの表示名を周辺空白なしで設定する。
    permissionSet.label = permissionSetLabel.trim();
    // 元Profileと同じライセンスへの割り当てに制限する。
    permissionSet.license = userLicense;

    // ラベルとライセンスより後の権限を配置する。
    for (const section of sectionGroups[2]) {
        // 実際の移行対象がある場合だけセクションを出力する。
        if (convertedSections[section]) {
            // 後半の権限もAPI定義順に組み込む。
            permissionSet[section] = convertedSections[section];
        }
    }

    // 名前空間付与とXML化に進める権限セットを返す。
    return permissionSet;
}

// Permission Set objectをMetadata API XMLへ直列化する。
function buildPermissionSetXml(permissionSet) {
    // 復号済みの値をXMLとして一度だけエスケープする。
    const builder = new XMLBuilder({
        attributeNamePrefix: '@_',
        format: true,
        ignoreAttributes: false,
        indentBy: '    ',
        suppressEmptyNode: true
    });
    // Metadata APIへ渡せるUTF-8宣言付きのXMLを返す。
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build({ PermissionSet: permissionSet })}`;
}

// Profile XMLをPermission Set候補と監査可能な変換レポートへ変換する。
function convertProfile({
    existsSync = fs.existsSync,
    objectsDirectory,
    permissionSetApiName,
    permissionSetLabel,
    profileFullName,
    profileModel,
    profilePath,
    profileXml,
    readFileSync = fs.readFileSync
}) {
    // 出力名がMetadata APIとファイル名の制約を満たすか確認する。
    validatePermissionSetApiName(permissionSetApiName);
    // ラベルと項目source treeの前提を確認する。
    validateConversionInput({ objectsDirectory, permissionSetLabel });
    // CLIが既に解析したモデルを再利用し、未解析ならここで解析する。
    const { parser, profile } = profileModel ?? parseProfileXml(profileXml);

    // 割り当て先ライセンスのない権限セットを作らない。
    if (typeof profile.userLicense !== 'string' || profile.userLicense.trim() === '') {
        // 元Profileに必要なUser Licenseを通知する。
        throw new Error('ProfileのuserLicenseが設定されていません。');
    }

    // 元Profileと同じUser Licenseのユーザーだけへ割り当てられるPermission Setを生成する。
    const userLicense = profile.userLicense.trim();
    // Profile名のUnicode表記を監査・説明で統一する。
    const profileName = profileFullName?.normalize('NFC') ?? path.basename(profilePath, '.profile-meta.xml');

    // 元Profileを識別できない入力を拒否する。
    if (profileName.trim() === '') {
        // metadata名の指定不足を明示する。
        throw new Error('Profile metadataのfullNameを指定してください。');
    }

    // 元Profileとの対応が分かる説明を生成する。
    const permissionSetDescription = `${profileName} Profileから生成した権限セット`;

    // 生成した説明がMetadata APIの長さ上限を超えないか確認する。
    if (permissionSetDescription.length > 255) {
        // 説明を黙って切り詰めず入力修正を求める。
        throw new Error('Permission Setの説明は255文字以内で生成できるProfile metadata fullNameを指定してください。');
    }

    // 入力のハッシュと生成先の対応を監査可能にする。
    const report = createConversionReport({
        permissionSetApiName,
        permissionSetDescription,
        permissionSetLabel,
        profileName,
        profilePath,
        profileXml,
        userLicense
    });
    // 未対応のProfile要素をスキップとして記録する。
    reportUnknownProfileElements(profile, report);
    // enabled形式の付与権限をセクション別に変換する。
    const convertedSections = convertEnabledAccessSections(profile, report);
    // アプリ利用権限とデフォルト指定を分離する。
    convertedSections.applicationVisibilities = convertApplicationVisibilitySection(profile, report);
    // Profile XMLで有効なApiUserOnlyをVisualforceアクセスの互換性判定に使用する。
    const apiUserOnly = toArray(convertedSections.userPermissions).some(({ name }) => name === 'ApiUserOnly');
    // API専用制約を適用したVisualforceページアクセスを変換結果へ追加する。
    convertedSections.pageAccesses = convertPageAccessSection({ apiUserOnly, profile, report });

    // ローカル項目型によるFLS制約を適用する。
    convertedSections.fieldPermissions = convertFieldPermissionSection({
        existsSync,
        objectsDirectory,
        parser,
        profile,
        readFileSync,
        report
    });

    // 明示されたオブジェクト権限を候補へ変換する。
    convertedSections.objectPermissions = convertObjectPermissionSection({ profile, report });
    // 有効なシステム権限が必要とする既知の依存だけを補完する。
    applyUserPermissionObjectDependencies({ convertedSections, report });
    // 子オブジェクト権限が必要とする親の付与を補完する。
    applyObjectPermissionObjectDependencies({ convertedSections, report });

    // レコードタイプの利用可否とデフォルトを分離する。
    convertedSections.recordTypeVisibilities = convertRecordTypeSection(profile, report);
    // タブ表示を権限セットの利用可否へ変換する。
    convertedSections.tabSettings = convertTabSection(profile, report);
    // 残りのProfile専用設定を監査レポートへ記録する。
    reportRetainedProfileElements(profile, report);

    // 各セクションをMetadata APIの順序へ組み立てる。
    const permissionSet = buildPermissionSet({
        convertedSections,
        permissionSetDescription,
        permissionSetLabel,
        userLicense
    });

    // Salesforce Metadata APIのXMLであることを明示する。
    permissionSet['@_xmlns'] = metadataNamespace;
    // 復号済みの候補を安全なXML文字列へ変換する。
    const permissionSetXml = buildPermissionSetXml(permissionSet);

    // 分類明細と整合する件数を実行結果へまとめる。
    report.summary = {
        converted: report.converted.length,
        retainedInProfile: report.retainedInProfile.length,
        skippedDisabled: report.skippedDisabled.length,
        skippedUnsupported: report.skippedUnsupported.length,
        requiresValidation: report.requiresValidation.length,
        unsupportedUnknown: report.unsupportedUnknown.length
    };
    // 生成XMLとレポートの対応をハッシュで検証可能にする。
    report.permissionSet.sha256 = crypto.createHash('sha256').update(permissionSetXml).digest('hex');

    // スキップは許容し、矛盾やライセンス対応範囲による停止理由だけで生成可否を決める。
    return {
        canWrite: report.unsupportedUnknown.length === 0,
        permissionSetXml,
        report
    };
}

module.exports = {
    convertProfile,
    metadataNamespace,
    parseBoolean,
    parseProfileXml,
    supportedProfileElements,
    validatePermissionSetApiName,
    validateXml,
    xmlEntities
};
