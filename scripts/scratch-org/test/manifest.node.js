// 実行コマンド: node --test scripts/scratch-org/test/manifest.node.js
// 用途: Scratch Org再構築manifestに自作ソースがすべて含まれることを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, scratchOrg } = require('../internal/context');

// Scratch Org再構築manifestを読み込む。
const manifest = fs.readFileSync(path.join(repoRoot, scratchOrg.manifest), 'utf8');

// manifestから指定したメタデータ種別のmembersを取得する。
function getManifestMembers(typeName) {
    const typeBlocks = manifest.matchAll(/<types>([\s\S]*?)<\/types>/g);

    for (const [, typeBlock] of typeBlocks) {
        if (typeBlock.includes(`<name>${typeName}</name>`)) {
            return [...typeBlock.matchAll(/<members>([^<]+)<\/members>/g)].map((match) => match[1]);
        }
    }

    return [];
}

// 指定した拡張子のソース名をディレクトリから取得する。
function getSourceNames(directory, extension) {
    return fs
        .readdirSync(path.join(repoRoot, directory))
        .filter((fileName) => fileName.endsWith(extension))
        .map((fileName) => fileName.slice(0, -extension.length))
        .sort();
}

// Objectごとのmetadataファイルを持つCustomObject名を取得する。
function getCustomObjectNames() {
    const objectsDirectory = path.join(repoRoot, 'force-app/main/default/objects');

    return fs
        .readdirSync(objectsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((objectName) => fs.existsSync(path.join(objectsDirectory, objectName, `${objectName}.object-meta.xml`)))
        .sort();
}

// Object配下で管理する子metadataをObject.Component形式へ変換する。
function getObjectChildNames(childDirectory, extension) {
    const objectsDirectory = path.join(repoRoot, 'force-app/main/default/objects');
    const names = [];

    for (const objectEntry of fs.readdirSync(objectsDirectory, { withFileTypes: true })) {
        if (!objectEntry.isDirectory()) {
            continue;
        }

        const componentDirectory = path.join(objectsDirectory, objectEntry.name, childDirectory);

        if (!fs.existsSync(componentDirectory)) {
            continue;
        }

        for (const fileName of fs.readdirSync(componentDirectory)) {
            if (fileName.endsWith(extension)) {
                names.push(`${objectEntry.name}.${fileName.slice(0, -extension.length)}`);
            }
        }
    }

    return names.sort();
}

// LWCのメタデータファイルがあるバンドル名を取得する。
function getLightningComponentBundleNames(directory) {
    const sourceDirectory = path.join(repoRoot, directory);

    return fs
        .readdirSync(sourceDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => fs.existsSync(path.join(sourceDirectory, entry.name, `${entry.name}.js-meta.xml`)))
        .map((entry) => entry.name)
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
    ListView: new Set([
        'Activity.AllActivities',
        'Activity.MyActivities',
        'Activity.TodaysTasks',
        'Activity.UpcomingEvents',
        'CollaborationGroup.All_ChatterGroups',
        'ConsumptionSchedule.All_ConsumptionSchedules',
        'ConsumptionSchedule.My_ConsumptionSchedules',
        'Individual.All_Individuals',
        'Solution.AllReviewedSolutions',
        'Solution.AllUnreviewedSolutions'
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
    ['ApexEmailNotifications', 'apexEmailNotifications', '.notifications-meta.xml'],
    ['AssignmentRules', 'assignmentRules', '.assignmentRules-meta.xml'],
    ['AutoResponseRules', 'autoResponseRules', '.autoResponseRules-meta.xml'],
    ['CleanDataService', 'cleanDataServices', '.cleanDataService-meta.xml'],
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
    ['Role', 'roles', '.role-meta.xml'],
    ['TopicsForObjects', 'topicsForObjects', '.topicsForObjects-meta.xml'],
    ['TransactionSecurityPolicy', 'transactionSecurityPolicies', '.transactionSecurityPolicy-meta.xml'],
    ['Workflow', 'workflows', '.workflow-meta.xml']
];

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
    ['ListView', 'listViews', '.listView-meta.xml'],
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
    const sourceNames = getLightningComponentBundleNames('force-app/main/default/lwc');
    const manifestMembers = getManifestMembers('LightningComponentBundle').sort();

    assert.deepEqual(manifestMembers, sourceNames);
});
