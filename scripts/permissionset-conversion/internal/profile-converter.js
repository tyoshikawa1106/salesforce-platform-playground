// 用途: Profile XMLの付与権限をPermission Setへ変換し、変換結果を分類したレポートを返す。

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { XMLBuilder, XMLParser, XMLValidator } = require('fast-xml-parser');

const metadataNamespace = 'http://soap.sforce.com/2006/04/metadata';

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
        source: 'pageAccesses',
        target: 'pageAccesses',
        identifier: 'apexPage',
        targetOrder: ['apexPage', 'enabled']
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

/*
 * 組織やリリースによって変わるPermission Set互換性はこの変換器に固定しない。
 * それらの差分はデプロイ後の再取得で検出し、比較レポートで確認する。
 */
// Profile XMLのオブジェクト権限名をPermission SetのMetadata API順に定義する。
const leadingObjectPermissionNames = ['allowCreate', 'allowDelete', 'allowEdit', 'allowRead', 'modifyAllRecords'];
const trailingObjectPermissionNames = ['viewAllRecords'];
const requiredObjectPermissionNames = [...leadingObjectPermissionNames, ...trailingObjectPermissionNames];
const optionalObjectPermissionNames = ['viewAllFields'];
const objectPermissionNames = [...requiredObjectPermissionNames, ...optionalObjectPermissionNames];

// Setupでは自動調整されるがMetadata APIでは明示が必要なUser Permission依存を定義する。
const userPermissionObjectDependencies = [
    {
        objectApiName: 'Document',
        requiredPermissions: ['allowCreate', 'allowDelete', 'allowEdit', 'allowRead'],
        userPermissionName: 'EditPublicDocuments'
    }
];

// Metadata API 67.0のProfile直下で、変換、残置、または制御情報として扱う要素を定義する。
const supportedProfileElements = new Set([
    '@_xmlns',
    'applicationVisibilities',
    'custom',
    'fieldPermissions',
    'objectPermissions',
    'recordTypeVisibilities',
    'tabVisibilities',
    'userLicense',
    ...retainedProfileElements.keys(),
    ...enabledAccessDefinitions.map(({ source }) => source)
]);

// XML値の型を固定し、文字列のfalseをtruthyとして扱わない。
function parseBoolean(value, context) {
    if (value === true || value === 'true') {
        return true;
    }

    if (value === false || value === 'false') {
        return false;
    }

    throw new Error(`${context}はtrueまたはfalseである必要があります。`);
}

// Metadata APIが単一要素をobject、複数要素をarrayで返す差を吸収する。
function toArray(value) {
    if (value === undefined) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

// 変換対象名を空値やobjectのまま処理しない。
function requireIdentifier(entry, identifier, context) {
    const value = entry?.[identifier];

    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${context}.${identifier}が設定されていません。`);
    }

    return value.trim();
}

// 同一権限が複数回出力されるとdeploy結果が不定になるため事前に拒否する。
function assertUniqueIdentifier(entries, identifier, context) {
    const identifiers = new Set();

    for (const entry of entries) {
        const value = requireIdentifier(entry, identifier, context);

        if (identifiers.has(value)) {
            throw new Error(`${context}に重複した設定があります: ${value}`);
        }

        identifiers.add(value);
    }
}

// API名の順に並べ、入力XMLの順序に依存しない安定した生成結果にする。
function sortByIdentifier(entries, identifier) {
    return [...entries].sort((left, right) => String(left[identifier]).localeCompare(String(right[identifier]), 'en'));
}

// Salesforceのmetadata API名として安全なPermission Set名だけを許可する。
function validatePermissionSetApiName(apiName) {
    if (typeof apiName !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(apiName)) {
        throw new Error('Permission Set API名は英字で始まる英数字とアンダースコアで指定してください。');
    }

    if (apiName.endsWith('_') || apiName.includes('__')) {
        throw new Error('Permission Set API名の末尾または連続するアンダースコアは使用できません。');
    }

    if (apiName.length > 80) {
        throw new Error('Permission Set API名は80文字以内で指定してください。');
    }
}

// 不正なXMLを部分的なオブジェクトとして解釈せず、解析前に入力全体を検証する。
function validateXml(xml, context) {
    if (typeof xml !== 'string' || xml.trim() === '') {
        throw new Error(`${context}が空です。`);
    }

    const validation = XMLValidator.validate(xml);

    if (validation !== true) {
        throw new Error(`${context}のXML形式が不正です: ${validation.err.msg}`);
    }
}

// Profileの項目API名から、同じsource treeにあるCustomField metadataを特定する。
function getFieldMetadataPath(objectsDirectory, fieldApiName) {
    // ディレクトリ区切りや複数の区切りを含む値をSalesforceの項目API名として扱わない。
    if (typeof fieldApiName !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/u.test(fieldApiName)) {
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
        throw new Error(`fieldPermissions.fieldの参照先がobjectsディレクトリ外です: ${fieldApiName}`);
    }

    // 検証済みのCustomField metadataパスを返す。
    return metadataPath;
}

// 項目metadataを読み、Permission Setへ出力できない必須・数式・主従項目を判定する。
function inspectFieldMetadata({ fieldApiName, objectsDirectory, existsSync, readFileSync, parser }) {
    const metadataPath = getFieldMetadataPath(objectsDirectory, fieldApiName);

    if (!existsSync(metadataPath)) {
        return { found: false, metadataPath };
    }

    const fieldXml = readFileSync(metadataPath, 'utf8');
    validateXml(fieldXml, `CustomField metadata ${metadataPath}`);
    const parsed = parser.parse(fieldXml);
    const field = parsed?.CustomField;

    if (!field || typeof field !== 'object') {
        throw new Error(`CustomField XMLとして解析できません: ${metadataPath}`);
    }

    if (field['@_xmlns'] !== metadataNamespace) {
        throw new Error(`CustomField XMLのnamespaceが不正です: ${metadataPath}`);
    }

    const localFormula = field.formula !== undefined || field.summaryForeignKey !== undefined;
    const localMasterDetail = field.type === 'MasterDetail';
    const localRequired = field.required === true || field.required === 'true';
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
    report[category].push({ sourceElement, name, message, ...details });
}

// 対応済み要素内に将来追加された子要素も黙って落とさずfail closedにする。
function reportUnknownEntryKeys(report, sourceElement, name, entry, allowedKeys) {
    for (const key of Object.keys(entry)) {
        if (!allowedKeys.has(key)) {
            addReportEntry(report, 'unsupportedUnknown', sourceElement, name, `未知の子要素を検出しました: ${key}`, {
                childElement: key
            });
        }
    }
}

// Profile XMLを一度だけ検証・解析し、入力抽出と最終変換で共有できるモデルを返す。
function parseProfileXml(profileXml) {
    validateXml(profileXml, 'Profile');
    const parser = new XMLParser({
        attributeNamePrefix: '@_',
        ignoreDeclaration: true,
        ignoreAttributes: false,
        parseAttributeValue: false,
        parseTagValue: false,
        processEntities: false,
        trimValues: true
    });
    const parsed = parser.parse(profileXml);
    const profile = parsed?.Profile;

    if (Object.keys(parsed).length !== 1) {
        throw new Error('Profile XMLのルート要素はProfileだけを指定してください。');
    }

    if (!profile || typeof profile !== 'object') {
        throw new Error('Profile XMLとして解析できません。');
    }

    if (profile['@_xmlns'] !== metadataNamespace) {
        throw new Error(`Profile XMLのnamespaceが不正です: ${profile['@_xmlns'] ?? '未設定'}`);
    }

    return { parser, profile };
}

// 変換に必要なラベルと入力directoryを一箇所で検証する。
function validateConversionInput({ objectsDirectory, permissionSetLabel }) {
    if (typeof permissionSetLabel !== 'string' || permissionSetLabel.trim() === '') {
        throw new Error('Permission Setラベルを指定してください。');
    }

    if (permissionSetLabel.trim().length > 80) {
        throw new Error('Permission Setラベルは80文字以内で指定してください。');
    }

    if (!objectsDirectory) {
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
    return {
        schemaVersion: 2,
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
        requiresValidation: [],
        unsupportedUnknown: []
    };
}

// 未対応のProfile直下要素を黙って破棄せず、書き込み不可の明細として記録する。
function reportUnknownProfileElements(profile, report) {
    for (const elementName of Object.keys(profile)) {
        if (!supportedProfileElements.has(elementName)) {
            addReportEntry(
                report,
                'unsupportedUnknown',
                elementName,
                elementName,
                '未知のProfile要素を検出したため、書き込みできません。'
            );
        }
    }
}

// アプリケーションの利用可否とデフォルト指定をProfile残置または無効設定へ分類する。
function reportApplicationVisibilities(profile, report) {
    const applications = toArray(profile.applicationVisibilities);
    assertUniqueIdentifier(applications, 'application', 'applicationVisibilities');

    for (const application of applications) {
        const name = requireIdentifier(application, 'application', 'applicationVisibilities');
        reportUnknownEntryKeys(
            report,
            'applicationVisibilities',
            name,
            application,
            new Set(['application', 'default', 'visible'])
        );
        const visible = parseBoolean(application.visible, `applicationVisibilities.${name}.visible`);
        addReportEntry(
            report,
            visible ? 'retainedInProfile' : 'skippedDisabled',
            'applicationVisibilities',
            name,
            visible
                ? '割り当てアプリケーションは移行対象外のためProfileに残します。'
                : 'visible=falseは拒否権限ではないため出力しません。'
        );

        if (
            application.default !== undefined &&
            parseBoolean(application.default, `applicationVisibilities.${name}.default`)
        ) {
            addReportEntry(
                report,
                'retainedInProfile',
                'applicationVisibilities',
                name,
                'デフォルトアプリケーション指定はProfileに残します。'
            );
        }
    }
}

// enabled形式の各Profile権限を共通規則で変換し、Permission Setのセクションごとに返す。
function convertEnabledAccessSections(profile, report) {
    const convertedSections = {};

    for (const definition of enabledAccessDefinitions) {
        const entries = toArray(profile[definition.source]);
        assertUniqueIdentifier(entries, definition.identifier, definition.source);
        const convertedEntries = [];

        for (const entry of entries) {
            const name = requireIdentifier(entry, definition.identifier, definition.source);
            reportUnknownEntryKeys(report, definition.source, name, entry, new Set([definition.identifier, 'enabled']));
            const enabled = parseBoolean(entry.enabled, `${definition.source}.${name}.enabled`);

            if (!enabled) {
                addReportEntry(
                    report,
                    'skippedDisabled',
                    definition.source,
                    name,
                    'enabled=falseは拒否権限ではないため出力しません。'
                );
                continue;
            }

            const convertedEntry = Object.fromEntries(
                definition.targetOrder.map((key) => [key, key === 'enabled' ? 'true' : name])
            );
            convertedEntries.push(convertedEntry);
            addReportEntry(report, 'converted', definition.source, name, '有効なアクセス権を変換しました。', {
                targetElement: definition.target
            });
        }

        if (convertedEntries.length > 0) {
            convertedSections[definition.target] = sortByIdentifier(convertedEntries, definition.identifier);
        }
    }

    return convertedSections;
}

// 参照不可の項目権限を拒否権限または矛盾した入力として分類する。
function reportUnreadableFieldPermission({ editable, fieldApiName, report }) {
    if (editable) {
        addReportEntry(
            report,
            'unsupportedUnknown',
            'fieldPermissions',
            fieldApiName,
            'editable=trueかつreadable=falseの項目権限は変換できません。'
        );
        return;
    }

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
    if (fieldMetadata.found && fieldMetadata.masterDetail) {
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '主従関係項目はPermission SetのfieldPermissionsへ出力しません。',
            { action: 'omitted', reason: 'masterDetail' }
        );
        return true;
    }

    if (fieldMetadata.found && fieldMetadata.required) {
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '必須項目はPermission SetのfieldPermissionsへ出力しません。',
            { action: 'omitted', reason: 'required' }
        );
        return true;
    }

    if (!fieldMetadata.found) {
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '関連CustomField metadataがないため、項目特性は手動validateで確認してください。',
            { action: 'preservedForValidation', metadataPath: fieldMetadata.metadataPath }
        );
        return false;
    }

    return false;
}

// 単一の項目権限をローカルmetadataで検証し、出力可能な権限だけを返す。
function convertFieldPermission({ existsSync, fieldPermission, objectsDirectory, parser, readFileSync, report }) {
    const fieldApiName = requireIdentifier(fieldPermission, 'field', 'fieldPermissions');
    reportUnknownEntryKeys(
        report,
        'fieldPermissions',
        fieldApiName,
        fieldPermission,
        new Set(['editable', 'field', 'readable'])
    );
    const readable = parseBoolean(fieldPermission.readable ?? false, `fieldPermissions.${fieldApiName}.readable`);
    const editable = parseBoolean(fieldPermission.editable, `fieldPermissions.${fieldApiName}.editable`);

    if (!readable) {
        reportUnreadableFieldPermission({ editable, fieldApiName, report });
        return undefined;
    }

    const fieldMetadata = inspectFieldMetadata({
        fieldApiName,
        objectsDirectory,
        existsSync,
        readFileSync,
        parser
    });

    if (reportIneligibleFieldPermission({ fieldApiName, fieldMetadata, report })) {
        return undefined;
    }

    const convertedEditable = fieldMetadata.formula && editable ? false : editable;

    if (fieldMetadata.formula && editable) {
        addReportEntry(
            report,
            'requiresValidation',
            'fieldPermissions',
            fieldApiName,
            '数式項目のeditableをfalseへ正規化しました。',
            { action: 'normalized' }
        );
    }

    addReportEntry(report, 'converted', 'fieldPermissions', fieldApiName, '参照可能な項目権限を変換しました。', {
        targetElement: 'fieldPermissions'
    });
    return { editable: String(convertedEditable), field: fieldApiName, readable: 'true' };
}

// Profileの項目権限を一括変換し、出力対象がある場合だけPermission Setセクションを返す。
function convertFieldPermissionSection(context) {
    const fieldPermissions = toArray(context.profile.fieldPermissions);
    assertUniqueIdentifier(fieldPermissions, 'field', 'fieldPermissions');
    const converted = fieldPermissions
        .map((fieldPermission) => convertFieldPermission({ ...context, fieldPermission }))
        .filter(Boolean);
    return converted.length > 0 ? sortByIdentifier(converted, 'field') : undefined;
}

// Profile XMLのオブジェクト権限を、Permission Setで必要なboolean値へ揃える。
function normalizeObjectPermission({ objectApiName, objectPermission, report }) {
    reportUnknownEntryKeys(
        report,
        'objectPermissions',
        objectApiName,
        objectPermission,
        new Set(['object', ...objectPermissionNames])
    );

    const values = {};

    for (const permissionName of objectPermissionNames) {
        const profileValue = objectPermission?.[permissionName];
        const profileEnabled =
            profileValue === undefined
                ? false
                : parseBoolean(profileValue, `objectPermissions.${objectApiName}.${permissionName}`);

        values[permissionName] = profileEnabled;
    }

    return values;
}

// Profile XMLから正規化したオブジェクト権限をMetadata APIの子要素順へ変換する。
function buildObjectPermissionEntry({ objectApiName, profileObjectPermission, values }) {
    const normalizedValues = Object.fromEntries(
        requiredObjectPermissionNames.map((permissionName) => [permissionName, String(values[permissionName])])
    );

    if (values.viewAllFields || profileObjectPermission?.viewAllFields !== undefined) {
        normalizedValues.viewAllFields = String(values.viewAllFields);
    }

    const normalized = {};

    for (const permissionName of leadingObjectPermissionNames) {
        normalized[permissionName] = normalizedValues[permissionName];
    }

    normalized.object = objectApiName;

    for (const permissionName of optionalObjectPermissionNames) {
        if (normalizedValues[permissionName] !== undefined) {
            normalized[permissionName] = normalizedValues[permissionName];
        }
    }

    for (const permissionName of trailingObjectPermissionNames) {
        normalized[permissionName] = normalizedValues[permissionName];
    }

    return normalized;
}

// Profile XMLに明示された有効なオブジェクト権限だけをPermission Setへ変換する。
function convertObjectPermissionSection({ profile, report }) {
    const objectPermissions = toArray(profile.objectPermissions);
    assertUniqueIdentifier(objectPermissions, 'object', 'objectPermissions');
    const converted = [];

    for (const objectPermission of objectPermissions) {
        const objectApiName = requireIdentifier(objectPermission, 'object', 'objectPermissions');
        const values = normalizeObjectPermission({ objectApiName, objectPermission, report });
        const hasGrant = objectPermissionNames.some((permissionName) => values[permissionName]);

        if (!hasGrant) {
            addReportEntry(
                report,
                'skippedDisabled',
                'objectPermissions',
                objectApiName,
                'すべてfalseのオブジェクト権限は出力しません。'
            );
            continue;
        }

        converted.push(
            buildObjectPermissionEntry({
                objectApiName,
                profileObjectPermission: objectPermission,
                values
            })
        );
        addReportEntry(
            report,
            'converted',
            'objectPermissions',
            objectApiName,
            '1件以上の付与を持つオブジェクト権限を変換しました。',
            { sources: ['profileXml'], targetElement: 'objectPermissions' }
        );
    }

    return converted.length > 0 ? sortByIdentifier(converted, 'object') : undefined;
}

// 有効なUser Permissionが要求するObject Permissionを、ローカルProfileの付与権限から派生させる。
function applyUserPermissionObjectDependencies({ convertedSections, report }) {
    const enabledUserPermissions = new Set(toArray(convertedSections.userPermissions).map(({ name }) => name));
    const objectPermissions = toArray(convertedSections.objectPermissions).map((entry) => ({ ...entry }));

    for (const dependency of userPermissionObjectDependencies) {
        if (!enabledUserPermissions.has(dependency.userPermissionName)) {
            continue;
        }

        const existingIndex = objectPermissions.findIndex(({ object }) => object === dependency.objectApiName);
        const existing = existingIndex >= 0 ? objectPermissions[existingIndex] : undefined;
        const values = Object.fromEntries(
            objectPermissionNames.map((permissionName) => [permissionName, existing?.[permissionName] === 'true'])
        );
        const addedPermissions = dependency.requiredPermissions.filter((permissionName) => !values[permissionName]);

        if (addedPermissions.length === 0) {
            continue;
        }

        for (const permissionName of addedPermissions) {
            values[permissionName] = true;
        }

        const derivedEntry = buildObjectPermissionEntry({
            objectApiName: dependency.objectApiName,
            profileObjectPermission: existing,
            values
        });

        if (existingIndex >= 0) {
            objectPermissions[existingIndex] = derivedEntry;
        } else {
            objectPermissions.push(derivedEntry);
        }

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

    convertedSections.objectPermissions =
        objectPermissions.length > 0 ? sortByIdentifier(objectPermissions, 'object') : undefined;
}

// 単一レコードタイプの利用可否とProfileに残るデフォルト指定を分類する。
function convertRecordType(recordType, report) {
    const name = requireIdentifier(recordType, 'recordType', 'recordTypeVisibilities');
    reportUnknownEntryKeys(
        report,
        'recordTypeVisibilities',
        name,
        recordType,
        new Set(['default', 'personAccountDefault', 'recordType', 'visible'])
    );
    const visible = parseBoolean(recordType.visible, `recordTypeVisibilities.${name}.visible`);

    if (visible) {
        addReportEntry(
            report,
            'converted',
            'recordTypeVisibilities',
            name,
            'カスタムレコードタイプの利用権限候補を変換しました。',
            { targetElement: 'recordTypeVisibilities' }
        );
        addReportEntry(
            report,
            'requiresValidation',
            'recordTypeVisibilities',
            name,
            'Permission Setで利用可能なカスタムレコードタイプか対象組織で確認が必要です。'
        );
    } else {
        addReportEntry(
            report,
            'skippedDisabled',
            'recordTypeVisibilities',
            name,
            'visible=falseは拒否権限ではないため出力しません。'
        );
    }

    if (
        recordType.default !== undefined &&
        parseBoolean(recordType.default, `recordTypeVisibilities.${name}.default`)
    ) {
        addReportEntry(
            report,
            'retainedInProfile',
            'recordTypeVisibilities',
            name,
            'デフォルトレコードタイプ指定はProfileに残します。'
        );
    }

    if (
        recordType.personAccountDefault !== undefined &&
        parseBoolean(recordType.personAccountDefault, `recordTypeVisibilities.${name}.personAccountDefault`)
    ) {
        addReportEntry(
            report,
            'retainedInProfile',
            'recordTypeVisibilities',
            name,
            'Person Accountのデフォルトレコードタイプ指定はProfileに残します。'
        );
    }

    return visible ? { recordType: name, visible: 'true' } : undefined;
}

// Profileのレコードタイプ可視性から有効なPermission Set権限だけを返す。
function convertRecordTypeSection(profile, report) {
    const recordTypes = toArray(profile.recordTypeVisibilities);
    assertUniqueIdentifier(recordTypes, 'recordType', 'recordTypeVisibilities');
    const converted = recordTypes.map((recordType) => convertRecordType(recordType, report)).filter(Boolean);
    return converted.length > 0 ? sortByIdentifier(converted, 'recordType') : undefined;
}

// Profileのタブ可視性をPermission SetのAvailableまたはVisibleへ変換する。
function convertTabSection(profile, report) {
    const tabs = toArray(profile.tabVisibilities);
    assertUniqueIdentifier(tabs, 'tab', 'tabVisibilities');
    const visibilityMappings = new Map([
        ['DefaultOff', 'Available'],
        ['DefaultOn', 'Visible']
    ]);
    const converted = [];

    for (const tab of tabs) {
        const name = requireIdentifier(tab, 'tab', 'tabVisibilities');
        reportUnknownEntryKeys(report, 'tabVisibilities', name, tab, new Set(['tab', 'visibility']));
        const targetVisibility = visibilityMappings.get(tab.visibility);

        if (targetVisibility) {
            converted.push({ tab: name, visibility: targetVisibility });
            addReportEntry(
                report,
                'converted',
                'tabVisibilities',
                name,
                `${tab.visibility}を${targetVisibility}へ変換しました。`,
                { targetElement: 'tabSettings' }
            );

            if (tab.visibility === 'DefaultOn') {
                addReportEntry(
                    report,
                    'retainedInProfile',
                    'tabVisibilities',
                    name,
                    'デフォルト表示の指定自体はProfileに残します。'
                );
            }

            continue;
        }

        addReportEntry(
            report,
            tab.visibility === 'Hidden' ? 'skippedDisabled' : 'unsupportedUnknown',
            'tabVisibilities',
            name,
            tab.visibility === 'Hidden'
                ? 'Hiddenは拒否権限ではないため出力しません。'
                : `未知のタブ表示状態です: ${tab.visibility ?? '未設定'}`
        );
    }

    return converted.length > 0 ? sortByIdentifier(converted, 'tab') : undefined;
}

// Profile固有でPermission Setへ移さない設定を監査レポートへ列挙する。
function reportRetainedProfileElements(profile, report) {
    for (const [elementName, message] of retainedProfileElements) {
        for (const [index, entry] of toArray(profile[elementName]).entries()) {
            const name = entry?.layout ?? entry?.application ?? entry?.recordType ?? `${elementName}[${String(index)}]`;
            addReportEntry(report, 'retainedInProfile', elementName, name, message);
        }
    }
}

// Metadata APIの直下要素順を維持してPermission Set objectを組み立てる。
function buildPermissionSet({ convertedSections, permissionSetDescription, permissionSetLabel, userLicense }) {
    const permissionSet = {};
    const sectionGroups = [
        ['agentAccesses', 'classAccesses', 'customMetadataTypeAccesses', 'customPermissions', 'customSettingAccesses'],
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

    for (const section of sectionGroups[0]) {
        if (convertedSections[section]) {
            permissionSet[section] = convertedSections[section];
        }
    }

    permissionSet.description = permissionSetDescription;

    for (const section of sectionGroups[1]) {
        if (convertedSections[section]) {
            permissionSet[section] = convertedSections[section];
        }
    }

    permissionSet.hasActivationRequired = 'false';
    permissionSet.label = permissionSetLabel.trim();
    permissionSet.license = userLicense;

    for (const section of sectionGroups[2]) {
        if (convertedSections[section]) {
            permissionSet[section] = convertedSections[section];
        }
    }

    return permissionSet;
}

// Permission Set objectをMetadata API XMLへ直列化する。
function buildPermissionSetXml(permissionSet) {
    const builder = new XMLBuilder({
        attributeNamePrefix: '@_',
        format: true,
        ignoreAttributes: false,
        indentBy: '    ',
        suppressEmptyNode: true
    });
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
    validatePermissionSetApiName(permissionSetApiName);
    validateConversionInput({ objectsDirectory, permissionSetLabel });
    const { parser, profile } = profileModel ?? parseProfileXml(profileXml);

    if (typeof profile.userLicense !== 'string' || profile.userLicense.trim() === '') {
        throw new Error('ProfileのuserLicenseが設定されていません。');
    }

    // 元Profileと同じUser Licenseのユーザーだけへ割り当てられるPermission Setを生成する。
    const userLicense = profile.userLicense.trim();
    const profileName = profileFullName?.normalize('NFC') ?? path.basename(profilePath, '.profile-meta.xml');

    if (profileName.trim() === '') {
        throw new Error('Profile metadataのfullNameを指定してください。');
    }

    const permissionSetDescription = `${profileName} Profileから生成した権限セット`;

    if (permissionSetDescription.length > 255) {
        throw new Error('Permission Setの説明は255文字以内で生成できるProfile metadata fullNameを指定してください。');
    }

    const report = createConversionReport({
        permissionSetApiName,
        permissionSetDescription,
        permissionSetLabel,
        profileName,
        profilePath,
        profileXml,
        userLicense
    });
    reportUnknownProfileElements(profile, report);
    reportApplicationVisibilities(profile, report);
    const convertedSections = convertEnabledAccessSections(profile, report);

    convertedSections.fieldPermissions = convertFieldPermissionSection({
        existsSync,
        objectsDirectory,
        parser,
        profile,
        readFileSync,
        report
    });

    convertedSections.objectPermissions = convertObjectPermissionSection({ profile, report });
    applyUserPermissionObjectDependencies({ convertedSections, report });

    convertedSections.recordTypeVisibilities = convertRecordTypeSection(profile, report);
    convertedSections.tabSettings = convertTabSection(profile, report);
    reportRetainedProfileElements(profile, report);

    addReportEntry(
        report,
        'requiresValidation',
        'Profile',
        profileName,
        '入力Profile XMLの権限網羅性はXML単体では証明できません。関連metadataを含めてretrieveした入力か確認してください。',
        { action: 'confirmSourceCompleteness' }
    );

    const permissionSet = buildPermissionSet({
        convertedSections,
        permissionSetDescription,
        permissionSetLabel,
        userLicense
    });

    permissionSet['@_xmlns'] = metadataNamespace;
    const permissionSetXml = buildPermissionSetXml(permissionSet);

    report.summary = {
        converted: report.converted.length,
        retainedInProfile: report.retainedInProfile.length,
        skippedDisabled: report.skippedDisabled.length,
        requiresValidation: report.requiresValidation.length,
        unsupportedUnknown: report.unsupportedUnknown.length
    };
    report.permissionSet.sha256 = crypto.createHash('sha256').update(permissionSetXml).digest('hex');

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
    validatePermissionSetApiName
};
