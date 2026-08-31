// 実行コマンド: node --test scripts/scratch-org/test/manifest.node.js
// 用途: Scratch Org再構築manifestに自作ソースがすべて含まれることを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { repoRoot, scratchOrg } = require('../internal/context');

// Scratch Org再構築manifestを読み込む。
const manifest = fs.readFileSync(path.join(repoRoot, scratchOrg.manifest), 'utf8');

// ローカルretrieveで生成されるGit管理外metadataを検証対象へ混ぜないため、Git管理中のsourceだけを取得する。
const trackedSourceFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--', 'force-app/main/default'], {
    cwd: repoRoot,
    encoding: 'utf8'
})
    .split('\0')
    .filter(Boolean);

// manifestの全typesを、type名とmember一覧へ変換する。
const manifestTypes = [...manifest.matchAll(/<types>([\s\S]*?)<\/types>/g)].map(([, typeBlock]) => ({
    members: [...typeBlock.matchAll(/<members>([^<]+)<\/members>/g)].map((match) => match[1]),
    typeName: typeBlock.match(/<name>([^<]+)<\/name>/)?.[1]
}));

// manifestから指定したメタデータ種別のmembersを取得する。
function getManifestMembers(typeName) {
    return manifestTypes.find((type) => type.typeName === typeName)?.members ?? [];
}

// Git管理中の直下ファイルから、指定した拡張子のsource名を取得する。
function getSourceNames(directory, extension) {
    const directoryPrefix = `${directory}/`;

    return trackedSourceFiles
        .filter((filePath) => filePath.startsWith(directoryPrefix))
        .map((filePath) => filePath.slice(directoryPrefix.length))
        .filter((fileName) => !fileName.includes('/') && fileName.endsWith(extension))
        .map((fileName) => fileName.slice(0, -extension.length))
        .sort();
}

// Git管理中のObject定義からCustomObject名を取得する。
function getCustomObjectNames() {
    return trackedSourceFiles
        .map((filePath) => filePath.match(/^force-app\/main\/default\/objects\/([^/]+)\/([^/]+)\.object-meta\.xml$/))
        .filter((match) => match !== null && match[1] === match[2])
        .map((match) => match[1])
        .sort();
}

// Git管理中のObject配下metadataをObject.Component形式へ変換する。
function getObjectChildNames(childDirectory, extension) {
    return trackedSourceFiles
        .map((filePath) => filePath.split('/'))
        .filter(
            (parts) =>
                parts.length === 7 &&
                parts[0] === 'force-app' &&
                parts[1] === 'main' &&
                parts[2] === 'default' &&
                parts[3] === 'objects' &&
                parts[5] === childDirectory &&
                parts[6].endsWith(extension)
        )
        .map((parts) => `${parts[4]}.${parts[6].slice(0, -extension.length)}`)
        .sort();
}

// Git管理中のLWCメタデータファイルからバンドル名を取得する。
function getLightningComponentBundleNames() {
    return trackedSourceFiles
        .map((filePath) => filePath.match(/^force-app\/main\/default\/lwc\/([^/]+)\/([^/]+)\.js-meta\.xml$/))
        .filter((match) => match !== null && match[1] === match[2])
        .map((match) => match[1])
        .sort();
}

// 取得済みsourceのうち、Scratch Org初期反映から意図的に除外するmetadataを定義する。
const excludedSourceNames = {
    FlexiPage: new Set(['CommandCenterApp_UtilityBar']),
    Flow: new Set(['customer_satisfaction', 'net_promoter_score']),
    Layout: new Set([
        'CollaborationGroup-グループレイアウト',
        'UserAlt-User Profile Layout',
        'WorkPlan-Work Plan Layout'
    ]),
    PermissionSet: new Set(['Salesforce_Platform_Playground_User']),
    ReportType: new Set(['flow_orchestration_work_item_ootb_crt_two_four_eight']),
    TopicsForObjects: new Set([
        'ChangeRequest',
        'Incident',
        'Problem',
        'Survey',
        'SurveyQuestion',
        'SurveyQuestionChoice',
        'SurveyQuestionResponse',
        'WorkPlan',
        'WorkPlanTemplate',
        'WorkPlanTemplateEntry',
        'WorkStep',
        'WorkStepTemplate'
    ])
};

// ファイル単位で管理し、manifestとsourceを双方向に照合するmetadataを定義する。
const fileMetadataTypes = [
    ['ApexClass', 'classes', '.cls'],
    ['ApexPage', 'pages', '.page'],
    ['ApexTrigger', 'triggers', '.trigger'],
    ['FlexiPage', 'flexipages', '.flexipage-meta.xml'],
    ['Flow', 'flows', '.flow-meta.xml'],
    ['HomePageLayout', 'homePageLayouts', '.homePageLayout-meta.xml'],
    ['IframeWhiteListUrlSettings', 'iframeWhiteListUrlSettings', '.iframeWhiteListUrlSettings-meta.xml'],
    ['Layout', 'layouts', '.layout-meta.xml'],
    ['MatchingRules', 'matchingRules', '.matchingRule-meta.xml'],
    ['MilestoneType', 'milestoneTypes', '.milestoneType-meta.xml'],
    ['PermissionSet', 'permissionsets', '.permissionset-meta.xml'],
    ['QuickAction', 'quickActions', '.quickAction-meta.xml'],
    ['RemoteSiteSetting', 'remoteSiteSettings', '.remoteSite-meta.xml'],
    ['ReportType', 'reportTypes', '.reportType-meta.xml'],
    ['TopicsForObjects', 'topicsForObjects', '.topicsForObjects-meta.xml'],
    ['TransactionSecurityPolicy', 'transactionSecurityPolicies', '.transactionSecurityPolicy-meta.xml'],
    ['Workflow', 'workflows', '.workflow-meta.xml']
];

// Git管理外の標準metadataはsourceファイルではなく、manifestの固定scopeだけを検証する。
const manifestOnlyTypes = [
    'ApexEmailNotifications',
    'AssignmentRules',
    'AutoResponseRules',
    'CleanDataService',
    'ListView',
    'Role'
];

// 個別source照合とmanifest固定scopeのどちらかへ、全metadata typeを明示的に分類する。
const sourceComparedTypes = [
    ...fileMetadataTypes.map(([typeName]) => typeName),
    'CustomApplication',
    'CustomField',
    'CustomObject',
    'LightningComponentBundle',
    'ValidationRule',
    'WebLink'
];

test('再構築manifestの全metadata typeに検証方針がありmemberが固定されている', () => {
    const expectedTypeNames = [...sourceComparedTypes, ...manifestOnlyTypes].sort();
    const actualTypeNames = manifestTypes.map((type) => type.typeName).sort();

    assert.deepEqual(actualTypeNames, expectedTypeNames);

    for (const { members, typeName } of manifestTypes) {
        assert.ok(members.length > 0, `${typeName}には1件以上のmemberが必要です。`);
        assert.equal(new Set(members).size, members.length, `${typeName}のmemberが重複しています。`);
        assert.equal(members.includes('*'), false, `${typeName}にワイルドカードは使用できません。`);
    }
});

for (const [typeName, directory, extension] of fileMetadataTypes) {
    test(`${typeName}の初期反映対象がsourceと再構築manifestで一致する`, () => {
        // 明示的な除外を除き、sourceとmanifestの対象名を双方向で比較する。
        const excludedNames = excludedSourceNames[typeName] ?? new Set();
        const sourceNames = getSourceNames(`force-app/main/default/${directory}`, extension).filter(
            (name) => !excludedNames.has(name)
        );
        const manifestMembers = getManifestMembers(typeName).sort();

        assert.deepEqual(manifestMembers, sourceNames);
    });
}

test('CustomApplicationのユーザー作成sourceが再構築manifestと一致する', () => {
    const sourceNames = getSourceNames('force-app/main/default/applications', '.app-meta.xml').filter(
        (name) => !name.startsWith('standard__')
    );

    assert.deepEqual(getManifestMembers('CustomApplication').sort(), sourceNames);
});

test('CustomObjectの全sourceが再構築manifestと一致する', () => {
    assert.deepEqual(getManifestMembers('CustomObject').sort(), getCustomObjectNames());
});

for (const [typeName, childDirectory, extension] of [
    ['ValidationRule', 'validationRules', '.validationRule-meta.xml'],
    ['WebLink', 'webLinks', '.webLink-meta.xml']
]) {
    test(`${typeName}の初期反映対象がsourceと再構築manifestで一致する`, () => {
        const excludedNames = excludedSourceNames[typeName] ?? new Set();
        const sourceNames = getObjectChildNames(childDirectory, extension).filter((name) => !excludedNames.has(name));

        assert.deepEqual(getManifestMembers(typeName).sort(), sourceNames);
    });
}

test('CustomFieldのカスタム項目が再構築manifestに含まれ、全memberにsourceがある', () => {
    const sourceNames = getObjectChildNames('fields', '.field-meta.xml');
    const sourceNameSet = new Set(sourceNames);
    const manifestMembers = getManifestMembers('CustomField');

    assert.deepEqual(
        sourceNames.filter((name) => name.endsWith('__c') && !manifestMembers.includes(name)),
        []
    );
    assert.deepEqual(
        manifestMembers.filter((name) => !sourceNameSet.has(name)),
        []
    );
});

test('LightningComponentBundleの全ソースが再構築manifestに含まれる', () => {
    // メタデータファイルを持つLWCバンドルだけを比較する。
    const sourceNames = getLightningComponentBundleNames();
    const manifestMembers = getManifestMembers('LightningComponentBundle').sort();

    assert.deepEqual(manifestMembers, sourceNames);
});
