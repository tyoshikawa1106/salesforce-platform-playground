// 実行コマンド: node --test scripts/permissionset-conversion/test/profile-converter.node.js
// 用途: 接続組織を確認し、ローカルProfile XMLだけからPermission Setを生成することとfail closedを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const {
    formatRunTimestamp,
    loadConfiguredProfiles,
    main,
    parseArguments,
    resolvePaths,
    resolveRunOutputDirectory,
    validateOutputTargets,
    writeConversionOutputs,
    writeConversionPlans
} = require('../convert-profile-to-permissionset');
const { convertProfile, supportedProfileElements } = require('../internal/profile-converter');
const {
    createPermissionSetLabel,
    createTemporaryPermissionSetApiName,
    decodeProfileFileName
} = require('../internal/profile-resolver');
const {
    getDeploymentCommand,
    getProductionValidationCommand,
    getSandboxValidationCommand,
    getVerificationCommand
} = require('../internal/validation-runner');
const { orgTypes } = require('../../common/target-org');

// 実ファイルを使うテストで共通利用するリポジトリとfixtureのパスを定義する。
const repoRoot = path.resolve(__dirname, '../../..');
const fixturesDirectory = path.join(__dirname, 'fixtures');
const fixtureProfilePath = path.join(fixturesDirectory, 'profiles/Platform_Test.profile-meta.xml');
const fixtureObjectsDirectory = path.join(fixturesDirectory, 'objects');
const fixedRunAt = new Date(2026, 8, 2, 5, 19, 22, 123);
const fixedRunDirectoryName = '20260902-051922-123';
const fixedRunNonce = 'A1B2C3D4';
const fixedPlatformTemporaryApiName = 'ProfileConversion_20260902_051922_123_A1B2C3D4_0001_D736069086';
const xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

// Salesforce CLIのJSON成功結果を子プロセスの戻り値形式で作成する。
function createSfResult(result) {
    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ status: 0, result })
    };
}

// Default Target Orgと認証済み組織一覧だけを返すCLI stubを作成する。
function createOrgCommand(type = orgTypes.SANDBOX) {
    const calls = [];
    const org = {
        alias: 'target-org',
        instanceUrl: 'https://example.my.salesforce.com',
        isSandbox: type === orgTypes.SANDBOX,
        orgEdition: type === orgTypes.DEVELOPER_EDITION ? 'Developer Edition' : 'Enterprise Edition',
        orgId: '00D000000000001',
        username: 'user@example.com'
    };

    return {
        calls,
        command(args) {
            calls.push(args);

            if (args[0] === 'config') {
                return createSfResult([{ name: 'target-org', success: true, value: 'target-org' }]);
            }

            if (args[0] === 'org') {
                return createSfResult({
                    nonScratchOrgs: [org],
                    sandboxes: type === orgTypes.SANDBOX ? [org] : [],
                    scratchOrgs: []
                });
            }

            throw new Error(`想定外のSalesforce CLI呼び出しです: ${args.join(' ')}`);
        }
    };
}

// 確認質問とcloseを記録し、指定した回答を順番に返すpromptを作成する。
function createPrompt(answers) {
    const questions = [];
    let closed = false;
    const prompt = {
        close() {
            closed = true;
        },
        async question(question) {
            questions.push(question);
            return answers.shift();
        }
    };

    return {
        factory: () => prompt,
        getQuestions: () => questions,
        isClosed: () => closed
    };
}

// XML parserが単一要素をobjectで返す場合も配列として比較できるようにする。
function toArray(value) {
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

// 共通fixtureを既定のProfile情報でPermission Set候補へ変換する。
function convertFixture(profileXml = fs.readFileSync(fixtureProfilePath, 'utf8'), options = {}) {
    return convertProfile({
        objectsDirectory: fixtureObjectsDirectory,
        permissionSetApiName: 'Platform_Test',
        permissionSetLabel: 'Platform_Test',
        profileFullName: 'Platform_Test',
        profilePath: 'Platform_Test.profile-meta.xml',
        profileXml,
        ...options
    });
}

// Profile、設定ファイル、出力先を分離して検証できる一時プロジェクトを作成する。
function createTestProject({
    configLines = ['force-app/main/default/profiles/Platform_Test.profile-meta.xml'],
    fileName = 'Platform_Test.profile-meta.xml',
    profileXml = fs.readFileSync(fixtureProfilePath, 'utf8')
} = {}) {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'permissionset-conversion-'));
    const profilesDirectory = path.join(projectRoot, 'force-app/main/default/profiles');
    const configDirectory = path.join(projectRoot, 'scripts/permissionset-conversion');
    const configPath = path.join(configDirectory, 'profile-paths.config.txt');

    fs.mkdirSync(profilesDirectory, { recursive: true });
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(path.join(profilesDirectory, fileName), profileXml, 'utf8');
    fs.writeFileSync(configPath, `${configLines.join('\n')}\n`, 'utf8');

    return { configPath, profilePath: path.join(profilesDirectory, fileName), projectRoot };
}

// Profileで有効な権限が、明示した変換規則以外で欠落していないことを意味単位で確認する。
function assertProfilePermissionEquivalence({ conversion, profileXml }) {
    const profile = xmlParser.parse(profileXml).Profile;
    const permissionSet = xmlParser.parse(conversion.permissionSetXml).PermissionSet;
    const enabledSections = [
        ['agentAccesses', 'agentName', 'agentAccesses'],
        ['classAccesses', 'apexClass', 'classAccesses'],
        ['customMetadataTypeAccesses', 'name', 'customMetadataTypeAccesses'],
        ['customPermissions', 'name', 'customPermissions'],
        ['customSettingAccesses', 'name', 'customSettingAccesses'],
        ['externalDataSourceAccesses', 'externalDataSource', 'externalDataSourceAccesses'],
        ['flowAccesses', 'flow', 'flowAccesses'],
        ['pageAccesses', 'apexPage', 'pageAccesses'],
        ['servicePresenceStatusAccesses', 'servicePresenceStatus', 'servicePresenceStatusAccesses'],
        ['userPermissions', 'name', 'userPermissions']
    ];

    for (const [sourceSection, identifier, targetSection] of enabledSections) {
        const sourceNames = toArray(profile[sourceSection])
            .filter(({ enabled }) => enabled === 'true')
            .map((entry) => entry[identifier])
            .sort();
        const targetNames = toArray(permissionSet[targetSection])
            .map((entry) => entry[identifier])
            .sort();

        assert.deepEqual(targetNames, sourceNames, sourceSection);
    }

    const omittedFields = new Set(
        conversion.report.requiresValidation
            .filter(({ action, sourceElement }) => sourceElement === 'fieldPermissions' && action === 'omitted')
            .map(({ name }) => name)
    );
    const normalizedFields = new Set(
        conversion.report.requiresValidation
            .filter(({ action, sourceElement }) => sourceElement === 'fieldPermissions' && action === 'normalized')
            .map(({ name }) => name)
    );
    const expectedFields = toArray(profile.fieldPermissions)
        .filter(({ field, readable }) => readable === 'true' && !omittedFields.has(field))
        .map(({ editable, field, readable }) => ({
            editable: normalizedFields.has(field) ? 'false' : editable,
            field,
            readable
        }))
        .sort((left, right) => left.field.localeCompare(right.field, 'en'));

    assert.deepEqual(toArray(permissionSet.fieldPermissions), expectedFields);

    const objectPermissionNames = [
        'allowCreate',
        'allowDelete',
        'allowEdit',
        'allowRead',
        'modifyAllRecords',
        'viewAllRecords'
    ];
    const expectedObjects = toArray(profile.objectPermissions)
        .filter(
            (entry) => objectPermissionNames.some((name) => entry[name] === 'true') || entry.viewAllFields === 'true'
        )
        .map((entry) => {
            const normalized = Object.fromEntries(
                objectPermissionNames.map((name) => [name, entry[name] === undefined ? 'false' : entry[name]])
            );
            normalized.object = entry.object;

            if (entry.viewAllFields !== undefined) {
                normalized.viewAllFields = entry.viewAllFields;
            }

            return normalized;
        })
        .sort((left, right) => left.object.localeCompare(right.object, 'en'));

    assert.deepEqual(toArray(permissionSet.objectPermissions), expectedObjects);
    assert.deepEqual(
        toArray(permissionSet.recordTypeVisibilities),
        toArray(profile.recordTypeVisibilities)
            .filter(({ visible }) => visible === 'true')
            .map(({ recordType, visible }) => ({ recordType, visible }))
            .sort((left, right) => left.recordType.localeCompare(right.recordType, 'en'))
    );
    assert.deepEqual(
        toArray(permissionSet.tabSettings),
        toArray(profile.tabVisibilities)
            .filter(({ visibility }) => visibility !== 'Hidden')
            .map(({ tab, visibility }) => ({
                tab,
                visibility: visibility === 'DefaultOn' ? 'Visible' : 'Available'
            }))
            .sort((left, right) => left.tab.localeCompare(right.tab, 'en'))
    );
}

test('有効なProfile権限だけをPermission Set候補へ変換する', () => {
    // 代表Profileを変換し、生成XMLを要素単位で比較できる形式へ解析する。
    const conversion = convertFixture();
    const permissionSet = xmlParser.parse(conversion.permissionSetXml).PermissionSet;

    // 基本属性と代表的なアクセス権がローカルProfileどおりに生成されることを確認する。
    assert.equal(conversion.canWrite, true);
    assert.equal(permissionSet.license, 'Salesforce Platform');
    assert.equal(permissionSet.description, 'Platform_Test Profileから生成した権限セット');
    assert.equal(permissionSet.label, 'Platform_Test');
    assert.equal(permissionSet.applicationVisibilities, undefined);
    assert.deepEqual(permissionSet.classAccesses, { apexClass: 'EnabledController', enabled: 'true' });
    assert.deepEqual(permissionSet.pageAccesses, { apexPage: 'EnabledPage', enabled: 'true' });
    assert.deepEqual(permissionSet.userPermissions, { enabled: 'true', name: 'RunReports' });
    assertProfilePermissionEquivalence({ conversion, profileXml: fs.readFileSync(fixtureProfilePath, 'utf8') });
});

test('Metadata API 67.0のProfile直下要素をすべて明示的に扱う', () => {
    // 取得済みProfile schemaから直下要素を抽出し、実装済み要素と比較する。
    const schemaPath = path.join(
        repoRoot,
        '.agents/skills/platform-metadata-api-context-get/assets/metadata_api/Profile.json'
    );
    const wsdl = JSON.parse(fs.readFileSync(schemaPath, 'utf8')).wsdl_segment;
    const typeStart = wsdl.indexOf('<xsd:complexType name="Profile">');
    const typeEnd = wsdl.indexOf('</xsd:complexType>', typeStart);
    const schemaElements = [...wsdl.slice(typeStart, typeEnd).matchAll(/<xsd:element name="([^"]+)"/g)].map(
        (match) => match[1]
    );
    const implementedElements = [...supportedProfileElements].filter((name) => name !== '@_xmlns').sort();

    assert.notEqual(typeStart, -1);
    assert.notEqual(typeEnd, -1);
    assert.deepEqual(implementedElements, schemaElements.sort());
});

test('生成要素をMetadata API 67.0の定義順に並べる', () => {
    // Permission Set schemaと生成XMLから直下要素の順序を取得する。
    const schemaPath = path.join(
        repoRoot,
        '.agents/skills/platform-metadata-api-context-get/assets/metadata_api/PermissionSet.json'
    );
    const wsdl = JSON.parse(fs.readFileSync(schemaPath, 'utf8')).wsdl_segment;
    const typeStart = wsdl.indexOf('<xsd:complexType name="PermissionSet">');
    const typeEnd = wsdl.indexOf('</xsd:complexType>', typeStart);
    const schemaElements = [...wsdl.slice(typeStart, typeEnd).matchAll(/<xsd:element name="([^"]+)"/g)].map(
        (match) => match[1]
    );
    const permissionSet = xmlParser.parse(convertFixture().permissionSetXml).PermissionSet;
    const generatedElements = Object.keys(permissionSet).filter((name) => name !== '@_xmlns');
    const schemaIndexes = generatedElements.map((name) => schemaElements.indexOf(name));

    assert.ok(schemaIndexes.every((index) => index >= 0));
    assert.deepEqual(
        schemaIndexes,
        [...schemaIndexes].sort((left, right) => left - right)
    );
});

test('objectPermissionsの子要素をMetadata API 67.0の定義順に並べる', () => {
    // Permission Set schemaと生成XMLからobjectPermissionsの子要素順を取得する。
    const schemaPath = path.join(
        repoRoot,
        '.agents/skills/platform-metadata-api-context-get/assets/metadata_api/PermissionSet.json'
    );
    const wsdl = JSON.parse(fs.readFileSync(schemaPath, 'utf8')).wsdl_segment;
    const typeStart = wsdl.indexOf('<xsd:complexType name="PermissionSetObjectPermissions">');
    const typeEnd = wsdl.indexOf('</xsd:complexType>', typeStart);
    const schemaElements = [...wsdl.slice(typeStart, typeEnd).matchAll(/<xsd:element name="([^"]+)"/g)].map(
        (match) => match[1]
    );
    const permissionSet = xmlParser.parse(convertFixture().permissionSetXml).PermissionSet;

    assert.notEqual(typeStart, -1);
    assert.notEqual(typeEnd, -1);
    assert.deepEqual(Object.keys(permissionSet.objectPermissions), schemaElements);
});

test('有効化形式の子要素を入力順に依存せずMetadata API順に並べる', () => {
    // classAccessesの入力順を逆転させ、出力側の子要素順を確認する。
    const profileXml = fs
        .readFileSync(fixtureProfilePath, 'utf8')
        .replace(
            '        <apexClass>EnabledController</apexClass>\n        <enabled>true</enabled>',
            '        <enabled>true</enabled>\n        <apexClass>EnabledController</apexClass>'
        );
    const classAccess = xmlParser.parse(convertFixture(profileXml).permissionSetXml).PermissionSet.classAccesses;

    assert.deepEqual(Object.keys(classAccess), ['apexClass', 'enabled']);
});

test('ローカルmetadataに基づき必須・主従項目を除外し数式項目を正規化する', () => {
    // 項目種別を含むfixtureを変換し、生成されたfieldPermissionsを取得する。
    const conversion = convertFixture();
    const fieldPermissions = toArray(xmlParser.parse(conversion.permissionSetXml).PermissionSet.fieldPermissions);

    assert.deepEqual(
        fieldPermissions.map(({ field }) => field),
        ['Example__c.Editable__c', 'Example__c.Formula__c', 'Example__c.Missing__c']
    );
    assert.equal(fieldPermissions.find(({ field }) => field === 'Example__c.Formula__c').editable, 'false');
    assert.equal(
        fieldPermissions.some(({ field }) => field === 'Example__c.Master__c'),
        false
    );
    assert.equal(
        fieldPermissions.some(({ field }) => field === 'Example__c.Required__c'),
        false
    );
    assert.deepEqual(
        conversion.report.requiresValidation
            .filter(({ sourceElement }) => sourceElement === 'fieldPermissions')
            .map(({ action, name, reason }) => ({ action, name, reason })),
        [
            { action: 'normalized', name: 'Example__c.Formula__c', reason: undefined },
            { action: 'omitted', name: 'Example__c.Master__c', reason: 'masterDetail' },
            { action: 'omitted', name: 'Example__c.Required__c', reason: 'required' }
        ]
    );
});

test('fieldPermissionsの項目API名からobjectsディレクトリ外を参照させない', () => {
    // パスとして解釈できる文字列を有効な項目API名の位置へ差し込む。
    const baseXml = fs.readFileSync(fixtureProfilePath, 'utf8');
    const invalidFieldApiNames = [
        'Account.../../../../outside',
        'Account.Name/Outside',
        'Account.Name\\Outside',
        'Account.Name.Extra'
    ];

    // Unix、Windows、複数ドットの各表記を変換開始前に拒否する。
    for (const invalidFieldApiName of invalidFieldApiNames) {
        const profileXml = baseXml.replace('Example__c.Editable__c', invalidFieldApiName);

        assert.throws(() => convertFixture(profileXml), /fieldPermissions\.fieldの形式が不正です/);
    }
});

test('関連CustomField metadataがない項目を候補へ残して手動validate対象にする', () => {
    // 1項目のローカルmetadataだけが存在しない状態を再現する。
    const conversion = convertFixture(undefined, {
        existsSync(metadataPath) {
            return metadataPath.endsWith('Missing__c.field-meta.xml') ? false : fs.existsSync(metadataPath);
        }
    });
    const fields = toArray(xmlParser.parse(conversion.permissionSetXml).PermissionSet.fieldPermissions);

    assert.equal(conversion.canWrite, true);
    assert.equal(
        fields.some(({ field }) => field === 'Example__c.Missing__c'),
        true
    );
    assert.ok(
        conversion.report.requiresValidation.some(
            ({ action, name }) => action === 'preservedForValidation' && name === 'Example__c.Missing__c'
        )
    );
});

test('fieldPermissionsで省略されたreadableをfalseとして扱う', () => {
    // 無効な項目権限からreadableを省略し、Permission Setへ出力されないことを確認する。
    const profileXml = fs.readFileSync(fixtureProfilePath, 'utf8').replace('        <readable>false</readable>\n', '');
    const conversion = convertFixture(profileXml);
    const fields = toArray(xmlParser.parse(conversion.permissionSetXml).PermissionSet.fieldPermissions);

    assert.equal(
        fields.some(({ field }) => field === 'Example__c.Unreadable__c'),
        false
    );
    assert.ok(conversion.report.skippedDisabled.some(({ name }) => name === 'Example__c.Unreadable__c'));
});

test('接続組織由来のオブジェクト権限を生成内容へ追加しない', () => {
    // 旧APIの組織権限入力を渡してもローカルProfileにないDocument権限を生成しないことを確認する。
    const conversion = convertFixture(undefined, {
        orgObjectPermissionsByApiName: new Map([
            ['Document', { allowCreate: true, allowRead: true, object: 'Document' }]
        ])
    });
    const objectPermissions = toArray(xmlParser.parse(conversion.permissionSetXml).PermissionSet.objectPermissions);

    assert.deepEqual(
        objectPermissions.map(({ object }) => object),
        ['Example__c']
    );
    assert.deepEqual(conversion.report.converted.find(({ name }) => name === 'Example__c').sources, ['profileXml']);
});

test('Profileで省略されたobjectPermissionsの必須booleanをfalseで補完する', () => {
    // Profileで省略可能なfalse値を削った入力を変換する。
    const profileXml = fs
        .readFileSync(fixtureProfilePath, 'utf8')
        .replace('        <allowDelete>false</allowDelete>\n', '')
        .replace('        <modifyAllRecords>false</modifyAllRecords>\n', '')
        .replace('        <viewAllRecords>false</viewAllRecords>\n', '');
    const objectPermission = xmlParser.parse(convertFixture(profileXml).permissionSetXml).PermissionSet
        .objectPermissions;

    assert.equal(objectPermission.allowDelete, 'false');
    assert.equal(objectPermission.modifyAllRecords, 'false');
    assert.equal(objectPermission.viewAllRecords, 'false');
});

test('公開ドキュメント管理権限が要求するDocument CRUDを補完する', () => {
    // ProfileにEditPublicDocumentsだけがあり、依存するDocument権限が省略された状態を再現する。
    const baseXml = fs.readFileSync(fixtureProfilePath, 'utf8');
    const profileXml = baseXml.replace(
        '</Profile>',
        '    <userPermissions>\n        <enabled>true</enabled>\n        <name>EditPublicDocuments</name>\n    </userPermissions>\n</Profile>'
    );
    const conversion = convertFixture(profileXml);
    const permissionSet = xmlParser.parse(conversion.permissionSetXml).PermissionSet;
    const documentPermission = toArray(permissionSet.objectPermissions).find(({ object }) => object === 'Document');

    // Metadata APIが要求するDocumentの作成、削除、編集、参照を明示してdeploy可能な形にする。
    assert.deepEqual(documentPermission, {
        allowCreate: 'true',
        allowDelete: 'true',
        allowEdit: 'true',
        allowRead: 'true',
        modifyAllRecords: 'false',
        object: 'Document',
        viewAllRecords: 'false'
    });
    // Profileに明示されたEditPublicDocuments自体もPermission Setへ維持する。
    assert.ok(
        toArray(permissionSet.userPermissions).some(
            ({ enabled, name }) => enabled === 'true' && name === 'EditPublicDocuments'
        )
    );
    // 推測ではなくUser Permissionの依存補完として監査レポートへ残す。
    assert.ok(
        conversion.report.converted.some(
            ({ action, name, targetName }) =>
                action === 'addedDependency' && name === 'EditPublicDocuments' && targetName === 'Document'
        )
    );
});

test('既存Document権限が不足する場合だけ公開ドキュメント管理の依存権限を追加する', () => {
    // ProfileにDocumentの参照権限だけが明示されている状態を再現する。
    const baseXml = fs.readFileSync(fixtureProfilePath, 'utf8');
    const profileXml = baseXml.replace(
        '</Profile>',
        [
            '    <objectPermissions>',
            '        <allowCreate>false</allowCreate>',
            '        <allowDelete>false</allowDelete>',
            '        <allowEdit>false</allowEdit>',
            '        <allowRead>true</allowRead>',
            '        <modifyAllRecords>false</modifyAllRecords>',
            '        <object>Document</object>',
            '        <viewAllRecords>false</viewAllRecords>',
            '    </objectPermissions>',
            '    <userPermissions>',
            '        <enabled>true</enabled>',
            '        <name>EditPublicDocuments</name>',
            '    </userPermissions>',
            '</Profile>'
        ].join('\n')
    );
    const conversion = convertFixture(profileXml);
    const permissionSet = xmlParser.parse(conversion.permissionSetXml).PermissionSet;
    const documentPermission = toArray(permissionSet.objectPermissions).find(({ object }) => object === 'Document');
    const dependencyReport = conversion.report.converted.find(
        ({ action, name }) => action === 'addedDependency' && name === 'EditPublicDocuments'
    );

    // 既存の参照権限を維持し、不足する作成、削除、編集だけを追加する。
    assert.deepEqual(documentPermission, {
        allowCreate: 'true',
        allowDelete: 'true',
        allowEdit: 'true',
        allowRead: 'true',
        modifyAllRecords: 'false',
        object: 'Document',
        viewAllRecords: 'false'
    });
    assert.deepEqual(dependencyReport.addedPermissions, ['allowCreate', 'allowDelete', 'allowEdit']);
});

test('Profile固有設定と無効権限を監査レポートへ分類する', () => {
    // 代表Profileを変換してProfile残置、無効、未知の分類を確認する。
    const { report } = convertFixture();

    assert.ok(report.retainedInProfile.some(({ sourceElement }) => sourceElement === 'layoutAssignments'));
    assert.ok(report.retainedInProfile.some(({ sourceElement }) => sourceElement === 'applicationVisibilities'));
    assert.ok(report.skippedDisabled.some(({ name }) => name === 'DisabledController'));
    assert.ok(report.skippedDisabled.some(({ name }) => name === 'Hidden__c'));
    assert.equal(report.unsupportedUnknown.length, 0);
});

test('User License名から有効な権限を推測で除外しない', () => {
    // User Licenseとユーザー権限名を変更し、Profile XMLの付与内容が維持されることを確認する。
    const profileXml = fs
        .readFileSync(fixtureProfilePath, 'utf8')
        .replace('<userLicense>Salesforce Platform</userLicense>', '<userLicense>Chatter Free</userLicense>')
        .replace('<name>RunReports</name>', '<name>AssignTopics</name>');
    const permissionSet = xmlParser.parse(convertFixture(profileXml).permissionSetXml).PermissionSet;

    assert.equal(permissionSet.license, 'Chatter Free');
    assert.equal(
        toArray(permissionSet.userPermissions).some(({ name }) => name === 'AssignTopics'),
        true
    );
    assert.equal(toArray(permissionSet.tabSettings).length, 2);
    assert.equal(toArray(permissionSet.fieldPermissions).length, 3);
});

test('未知のProfile要素と対応済み要素内の未知の子要素をfail closedにする', () => {
    // 未知の直下要素と未知の子要素をそれぞれ追加する。
    const baseXml = fs.readFileSync(fixtureProfilePath, 'utf8');
    const unknownElement = convertFixture(
        baseXml.replace(
            '<userLicense>',
            '<futurePermission><enabled>true</enabled></futurePermission>\n    <userLicense>'
        )
    );
    const unknownChild = convertFixture(
        baseXml.replace(
            '<visible>true</visible>',
            '<visible>true</visible>\n        <futureDefault>true</futureDefault>'
        )
    );

    assert.equal(unknownElement.canWrite, false);
    assert.equal(unknownElement.report.unsupportedUnknown[0].sourceElement, 'futurePermission');
    assert.equal(unknownChild.canWrite, false);
    assert.equal(unknownChild.report.unsupportedUnknown[0].childElement, 'futureDefault');
});

test('不正XML、重複権限、API名とラベルの長さ違反を拒否する', () => {
    // 変換結果を曖昧にする入力を個別に与える。
    const duplicateXml = fs
        .readFileSync(fixtureProfilePath, 'utf8')
        .replace(
            '</Profile>',
            '    <userPermissions>\n        <enabled>true</enabled>\n        <name>RunReports</name>\n    </userPermissions>\n</Profile>'
        );

    assert.throws(() => convertFixture('<Profile>'), /XML形式が不正/);
    assert.throws(() => convertFixture(duplicateXml), /重複した設定があります: RunReports/);
    assert.throws(() => convertFixture(undefined, { permissionSetApiName: `A${'a'.repeat(80)}` }), /API名は80文字以内/);
    assert.throws(() => convertFixture(undefined, { permissionSetLabel: 'あ'.repeat(81) }), /ラベルは80文字以内/);
});

test('追加されたProfile権限を固定件数に依存せず内容比較する', () => {
    // Git管理fixtureへ有効なクラスアクセスを追加する。
    const profileXml = fs
        .readFileSync(fixtureProfilePath, 'utf8')
        .replace(
            '</Profile>',
            '    <classAccesses>\n        <apexClass>AdditionalController</apexClass>\n        <enabled>true</enabled>\n    </classAccesses>\n</Profile>'
        );
    // 追加後のProfile XMLを同じ変換処理へ渡す。
    const conversion = convertFixture(profileXml);
    // 生成されたPermission Setを要素単位で確認できる形式へ解析する。
    const permissionSet = xmlParser.parse(conversion.permissionSetXml).PermissionSet;

    // 権限数を固定せず、追加した権限を含む入力全体との意味的一致を確認する。
    assert.equal(conversion.canWrite, true);
    assert.equal(conversion.report.schemaVersion, 2);
    assert.equal('profileId' in conversion.report.source, false);
    assert.equal(
        toArray(permissionSet.classAccesses).some(({ apexClass }) => apexClass === 'AdditionalController'),
        true
    );
    assertProfilePermissionEquivalence({ conversion, profileXml });
});

test('Profileファイル名からmetadata名、仮API名、ラベルを組織非接続で生成する', () => {
    // percent encodingされたProfileファイル名を論理fullNameへ変換する。
    assert.equal(decodeProfileFileName('Custom%3A Sales Profile.profile-meta.xml'), 'Custom: Sales Profile');
    // 同じ実行とProfileから、Salesforceの制約を満たす同じ仮API名を生成する。
    assert.equal(
        createTemporaryPermissionSetApiName({
            profileFullName: 'Platform_Test',
            runIdentifier: fixedRunDirectoryName,
            runNonce: fixedRunNonce,
            sequence: 1
        }),
        fixedPlatformTemporaryApiName
    );
    // 実行識別子が異なる場合は、前回のPermission Setと衝突しない仮API名を生成する。
    assert.notEqual(
        createTemporaryPermissionSetApiName({
            profileFullName: 'Platform_Test',
            runIdentifier: `${fixedRunDirectoryName}-0001`,
            runNonce: fixedRunNonce,
            sequence: 1
        }),
        fixedPlatformTemporaryApiName
    );
    // 同じ実行内の連番が異なる場合も別の仮API名を生成する。
    assert.notEqual(
        createTemporaryPermissionSetApiName({
            profileFullName: 'Platform_Test',
            runIdentifier: fixedRunDirectoryName,
            runNonce: fixedRunNonce,
            sequence: 2
        }),
        fixedPlatformTemporaryApiName
    );
    // 不正な実行識別子とProfile連番を仮API名へ使用しない。
    assert.throws(
        () =>
            createTemporaryPermissionSetApiName({
                profileFullName: 'Admin',
                runIdentifier: 'invalid',
                runNonce: fixedRunNonce,
                sequence: 1
            }),
        /実行識別子が不正/
    );
    assert.throws(
        () =>
            createTemporaryPermissionSetApiName({
                profileFullName: 'Admin',
                runIdentifier: fixedRunDirectoryName,
                runNonce: fixedRunNonce,
                sequence: 0
            }),
        /1以上の整数/
    );
    // 実行IDは固定長の大文字16進数だけを受け付ける。
    assert.throws(
        () =>
            createTemporaryPermissionSetApiName({
                profileFullName: 'Admin',
                runIdentifier: fixedRunDirectoryName,
                runNonce: 'invalid',
                sequence: 1
            }),
        /実行IDが不正/
    );
    // Profile metadata fullNameをPermission Setラベルとして維持する。
    assert.equal(createPermissionSetLabel('Admin'), 'Admin');
    assert.equal(createPermissionSetLabel('日本語プロファイル'), '日本語プロファイル');
    assert.throws(() => createPermissionSetLabel('あ'.repeat(81)), /80文字以内/);
});

test('CLI引数とProfileパス設定を限定する', () => {
    // 対応引数だけを受け付け、廃止済みの組織指定を拒否する。
    assert.deepEqual(parseArguments([]), { dryRun: false });
    assert.deepEqual(parseArguments(['--dry-run']), { dryRun: true });
    assert.equal(parseArguments(['--config', 'profiles.txt']).configPath, 'profiles.txt');
    assert.equal(parseArguments(['--objects-dir', 'objects']).objectsDirectory, 'objects');
    assert.throws(() => parseArguments(['--compatibility-rules', 'rules.json']), /未対応の引数/);
    assert.throws(() => parseArguments(['--target-org', 'org']), /未対応の引数/);
    assert.throws(() => parseArguments(['--profile-id', '00e000000000001']), /未対応の引数/);
    assert.throws(() => parseArguments(['--overwrite']), /未対応の引数/);
});

test('設定ファイルのコメントと空行を無視してローカルProfileを解決する', () => {
    // コメント付き設定を読み込み、ファイル名をpercent decodeしたfullNameへ変換する。
    const project = createTestProject({
        configLines: ['# 1行に1つ指定', '', 'force-app/main/default/profiles/Custom%3A Sales Profile.profile-meta.xml'],
        fileName: 'Custom%3A Sales Profile.profile-meta.xml'
    });

    try {
        const profiles = loadConfiguredProfiles({
            configPath: project.configPath,
            profileRoot: path.join(project.projectRoot, 'force-app/main/default/profiles'),
            projectRoot: project.projectRoot,
            readFileSync: fs.readFileSync
        });

        assert.equal(profiles.length, 1);
        assert.equal(profiles[0].fullName, 'Custom: Sales Profile');
    } finally {
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('設定ファイルの空入力、範囲外、重複Profileを組織接続前に拒否する', () => {
    // 入力パスの境界条件をそれぞれ一時プロジェクトで再現する。
    const emptyProject = createTestProject({ configLines: ['# empty'] });
    const duplicateProject = createTestProject({
        configLines: [
            'force-app/main/default/profiles/Platform_Test.profile-meta.xml',
            'force-app/main/default/profiles/Platform_Test.profile-meta.xml'
        ]
    });

    try {
        const load = (project) =>
            loadConfiguredProfiles({
                configPath: project.configPath,
                profileRoot: path.join(project.projectRoot, 'force-app/main/default/profiles'),
                projectRoot: project.projectRoot,
                readFileSync: fs.readFileSync
            });

        assert.throws(() => load(emptyProject), /変換対象のProfileパスが設定されていません/);
        assert.throws(() => load(duplicateProject), /同じProfileパスが複数行/);
    } finally {
        fs.rmSync(emptyProject.projectRoot, { force: true, recursive: true });
        fs.rmSync(duplicateProject.projectRoot, { force: true, recursive: true });
    }
});

test('実行日時ごとに一意な出力フォルダを選ぶ', () => {
    // ローカル時刻の形式と同一ミリ秒時の連番を確認する。
    assert.equal(formatRunTimestamp(fixedRunAt), fixedRunDirectoryName);
    const outputRoot = path.join(repoRoot, 'scripts/permissionset-conversion/outputs');
    const first = path.join(outputRoot, fixedRunDirectoryName);
    const second = `${first}-0001`;

    assert.equal(
        resolveRunOutputDirectory({
            existsSync: (candidate) => candidate === first,
            projectRoot: repoRoot,
            runAt: fixedRunAt
        }),
        second
    );
});

test('出力先の衝突と入力Profileの上書きを拒否する', () => {
    // XMLとレポートの衝突、既存出力、入力上書きを個別に確認する。
    assert.throws(
        () => validateOutputTargets({ existsSync: () => false, outputPath: '/tmp/same', reportPath: '/tmp/same' }),
        /異なる出力先/
    );
    assert.throws(
        () =>
            validateOutputTargets({
                existsSync: (targetPath) => targetPath.endsWith('.permissionset-meta.xml'),
                outputPath: '/tmp/Expected.permissionset-meta.xml',
                reportPath: '/tmp/Expected.json'
            }),
        /既存ファイル/
    );
    assert.throws(
        () =>
            validateOutputTargets({
                existsSync: () => true,
                outputPath: '/tmp/Expected.permissionset-meta.xml',
                protectedPaths: ['/tmp/Input.profile-meta.xml'],
                reportPath: '/tmp/Input.profile-meta.xml',
                writePermissionSet: false
            }),
        /入力ファイルを出力先として上書きできません/
    );
});

test('出力途中の失敗時にXMLとレポートを残さない', () => {
    // レポート配置だけを失敗させ、先に配置されたXMLもrollbackされることを確認する。
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-permission-set-rollback-'));
    const outputPath = path.join(temporaryDirectory, 'Rollback.permissionset-meta.xml');
    const reportPath = path.join(temporaryDirectory, 'Rollback.conversion-report.json');

    try {
        assert.throws(
            () =>
                writeConversionOutputs({
                    outputPath,
                    permissionSetXml: 'new xml',
                    randomUUID: () => 'transaction',
                    renameSync(sourcePath, targetPath) {
                        if (targetPath === reportPath) {
                            throw new Error('report install failed');
                        }

                        fs.renameSync(sourcePath, targetPath);
                    },
                    report: { status: 'new' },
                    reportPath
                }),
            /report install failed/
        );
        assert.deepEqual(fs.readdirSync(temporaryDirectory), []);
    } finally {
        fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
});

test('複数Profileの途中失敗時にbatch全体をrollbackする', () => {
    // 2件目のレポート配置だけを失敗させるbatchを用意する。
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-permission-set-batch-'));
    const createPlan = (name) => ({
        conversion: { canWrite: true, permissionSetXml: name, report: { name } },
        paths: {
            outputPath: path.join(temporaryDirectory, `${name}.permissionset-meta.xml`),
            profilePath: path.join(temporaryDirectory, `${name}.profile-meta.xml`),
            reportPath: path.join(temporaryDirectory, `${name}.conversion-report.json`)
        }
    });
    const plans = [createPlan('First'), createPlan('Second')];

    try {
        assert.throws(
            () =>
                writeConversionPlans({
                    plans,
                    randomUUID: () => 'batch',
                    renameSync(sourcePath, targetPath) {
                        if (targetPath === plans[1].paths.reportPath) {
                            throw new Error('second report failed');
                        }

                        fs.renameSync(sourcePath, targetPath);
                    }
                }),
            /second report failed/
        );
        assert.deepEqual(fs.readdirSync(temporaryDirectory), []);
    } finally {
        fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
});

test('CLIはDefault Target Orgを確認してローカルmetadataとレポートを生成する', async () => {
    // 認証済みSandboxと承認回答を用意して通常生成を実行する。
    const project = createTestProject();
    const lines = [];
    const orgCommand = createOrgCommand();
    const prompt = createPrompt(['y']);

    try {
        const status = await main({
            argv: ['--objects-dir', fixtureObjectsDirectory],
            createPrompt: prompt.factory,
            createRunNonce: () => fixedRunNonce,
            now: () => fixedRunAt,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand: orgCommand.command,
            writeLine: (line) => lines.push(line)
        });
        const outputDirectory = path.join(
            project.projectRoot,
            'scripts/permissionset-conversion/outputs',
            fixedRunDirectoryName
        );
        const xmlPath = path.join(
            outputDirectory,
            `permissionsets/${fixedPlatformTemporaryApiName}.permissionset-meta.xml`
        );
        const reportPath = path.join(
            outputDirectory,
            `reports/${fixedPlatformTemporaryApiName}.conversion-report.json`
        );
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

        assert.equal(status, 0);
        assert.equal(orgCommand.calls.length, 2);
        assert.deepEqual(orgCommand.calls[0], ['config', 'get', 'target-org', '--json']);
        assert.deepEqual(orgCommand.calls[1], ['org', 'list', '--json', '--skip-connection-status']);
        assert.deepEqual(prompt.getQuestions(), [
            'この接続組織を確認し、1件のローカルProfile XMLからPermission Set metadataを生成しますか？ [y/N]: '
        ]);
        assert.equal(prompt.isClosed(), true);
        assert.equal(fs.existsSync(xmlPath), true);
        assert.equal(report.schemaVersion, 2);
        assert.equal(report.permissionSet.apiName, fixedPlatformTemporaryApiName);
        assert.equal(report.permissionSet.label, 'Platform_Test');
        assert.equal('profileId' in report.source, false);
        assert.ok(lines.includes('接続組織を確認してください。'));
        assert.ok(lines.includes('※接続組織の情報はPermission Setの変換内容に使用していません。'));
        assert.ok(lines.includes('※生成したPermission SetのAPI名は仮名です。'));
        assert.ok(
            lines.includes(
                '※保存結果確認後に、Salesforce設定画面の「プロパティを編集」から最終API名へ変更してください。'
            )
        );
        assert.ok(lines.some((line) => line.startsWith('sf project deploy validate --source-dir')));
    } finally {
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('CLIのdry-runもDefault Target Orgを確認してファイルを生成しない', async () => {
    // 認証済みSandboxと承認回答を用意してdry-runを実行する。
    const project = createTestProject();
    const orgCommand = createOrgCommand();
    const prompt = createPrompt(['y']);

    try {
        const status = await main({
            argv: ['--objects-dir', fixtureObjectsDirectory, '--dry-run'],
            createPrompt: prompt.factory,
            now: () => fixedRunAt,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand: orgCommand.command,
            writeLine() {}
        });
        const outputDirectory = path.join(project.projectRoot, 'scripts/permissionset-conversion/outputs');

        assert.equal(status, 0);
        assert.equal(orgCommand.calls.length, 2);
        assert.deepEqual(prompt.getQuestions(), [
            'この接続組織を確認し、1件のローカルProfile XMLの変換結果をdry-runで確認しますか？ [y/N]: '
        ]);
        assert.equal(prompt.isClosed(), true);
        assert.equal(fs.existsSync(outputDirectory), false);
    } finally {
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('接続組織を承認しない場合はPermission Setを生成しない', async () => {
    // 認証済みSandboxに対する確認を拒否する回答を用意する。
    const project = createTestProject();
    const orgCommand = createOrgCommand();
    const prompt = createPrompt(['n']);

    try {
        // 接続組織の表示後に拒否し、出力を開始しないことを確認する。
        const status = await main({
            argv: ['--objects-dir', fixtureObjectsDirectory],
            createPrompt: prompt.factory,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand: orgCommand.command,
            writeLine() {}
        });
        const outputDirectory = path.join(project.projectRoot, 'scripts/permissionset-conversion/outputs');

        assert.equal(status, 0);
        assert.equal(orgCommand.calls.length, 2);
        assert.equal(prompt.getQuestions().length, 1);
        assert.equal(prompt.isClosed(), true);
        assert.equal(fs.existsSync(outputDirectory), false);
    } finally {
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('本番環境の追加確認を承認しない場合はPermission Setを生成しない', async () => {
    // 本番環境の通常確認だけを承認し、追加確認を拒否する回答を用意する。
    const project = createTestProject();
    const orgCommand = createOrgCommand(orgTypes.PRODUCTION);
    const prompt = createPrompt(['y', 'n']);

    try {
        // 二段階目で拒否し、本番環境向けの出力を開始しないことを確認する。
        const status = await main({
            argv: ['--objects-dir', fixtureObjectsDirectory],
            createPrompt: prompt.factory,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand: orgCommand.command,
            writeLine() {}
        });
        const outputDirectory = path.join(project.projectRoot, 'scripts/permissionset-conversion/outputs');

        assert.equal(status, 0);
        assert.deepEqual(prompt.getQuestions(), [
            'この接続組織を確認し、1件のローカルProfile XMLからPermission Set metadataを生成しますか？ [y/N]: ',
            '本番環境です。1件のローカルProfile XMLからPermission Set metadataを生成してよろしいですか？ [y/N]: '
        ]);
        assert.equal(prompt.isClosed(), true);
        assert.equal(fs.existsSync(outputDirectory), false);
    } finally {
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('CLIは未知要素があるProfileのXMLを作らず監査レポートだけを保存する', async () => {
    // 未知要素を追加したローカルProfileを一時プロジェクトへ配置する。
    const profileXml = fs
        .readFileSync(fixtureProfilePath, 'utf8')
        .replace('<userLicense>', '<futurePermission><enabled>true</enabled></futurePermission>\n    <userLicense>');
    const project = createTestProject({
        configLines: ['force-app/main/default/profiles/Unknown.profile-meta.xml'],
        fileName: 'Unknown.profile-meta.xml',
        profileXml
    });
    const orgCommand = createOrgCommand();
    const prompt = createPrompt(['y']);

    try {
        const status = await main({
            argv: ['--objects-dir', fixtureObjectsDirectory],
            createPrompt: prompt.factory,
            createRunNonce: () => fixedRunNonce,
            now: () => fixedRunAt,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand: orgCommand.command,
            writeLine() {}
        });
        const outputDirectory = path.join(
            project.projectRoot,
            'scripts/permissionset-conversion/outputs',
            fixedRunDirectoryName
        );
        const temporaryApiName = 'ProfileConversion_20260902_051922_123_A1B2C3D4_0001_B764CDC0EA';
        const xmlPath = path.join(outputDirectory, `permissionsets/${temporaryApiName}.permissionset-meta.xml`);
        const reportPath = path.join(outputDirectory, `reports/${temporaryApiName}.conversion-report.json`);

        assert.equal(status, 1);
        assert.equal(fs.existsSync(xmlPath), false);
        assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).summary.unsupportedUnknown, 1);
    } finally {
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('生成後の手動validate、deploy、保存結果確認コマンドを限定scopeで作る', () => {
    // 日時別Permission Set出力をすべての後続コマンドへ同じscopeで渡す。
    const sourceDirectory = path.join(
        repoRoot,
        'scripts/permissionset-conversion/outputs/20260902-091924-927/permissionsets'
    );
    const relative = 'scripts/permissionset-conversion/outputs/20260902-091924-927/permissionsets';

    assert.equal(
        getProductionValidationCommand({ projectRoot: repoRoot, sourceDirectory }),
        `sf project deploy validate --source-dir ${relative} --test-level RunLocalTests --wait 30`
    );
    assert.equal(
        getSandboxValidationCommand({ projectRoot: repoRoot, sourceDirectory }),
        `sf project deploy start --dry-run --source-dir ${relative} --test-level RunLocalTests --wait 30`
    );
    assert.equal(
        getDeploymentCommand({ projectRoot: repoRoot, sourceDirectory }),
        `sf project deploy start --source-dir ${relative} --wait 30`
    );
    assert.equal(
        getVerificationCommand({ projectRoot: repoRoot, sourceDirectory }),
        `npm run sf:verify:permissionsets -- --source-dir ${relative}`
    );
    assert.throws(
        () => getDeploymentCommand({ projectRoot: repoRoot, sourceDirectory: '/tmp/permissionsets' }),
        /リポジトリ配下ではありません/
    );
});

test('出力パスは日時別フォルダ内でmetadataとレポートを分離する', () => {
    // 指定した仮API名を維持した2種類の出力先を解決する。
    const runOutputDirectory = path.join(repoRoot, 'scripts/permissionset-conversion/outputs', fixedRunDirectoryName);
    const paths = resolvePaths({
        objectsDirectory: fixtureObjectsDirectory,
        permissionSetApiName: 'Expected',
        profilePath: fixtureProfilePath,
        profilesDirectory: path.dirname(fixtureProfilePath),
        runOutputDirectory
    });

    assert.equal(paths.outputPath, path.join(runOutputDirectory, 'permissionsets/Expected.permissionset-meta.xml'));
    assert.equal(paths.reportPath, path.join(runOutputDirectory, 'reports/Expected.conversion-report.json'));
});
