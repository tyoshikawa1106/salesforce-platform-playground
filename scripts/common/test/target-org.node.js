// 実行コマンド: node --test scripts/common/test/target-org.node.js
// 用途: Salesforce CLIの組織一覧から対象組織を安全に分類できることを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../target-org');

// Salesforce CLIのJSON成功結果を子プロセスの戻り値形式で作成する。
function createSfResult(result) {
    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ status: 0, result })
    };
}

// 組織種別ごとの最小限の認証済み組織一覧を作成する。
function createOrgList(type) {
    const baseOrg = {
        alias: 'target-org',
        instanceUrl: 'https://example.my.salesforce.com',
        orgId: '00D000000000001',
        username: 'user@example.com'
    };

    if (type === orgTypes.SCRATCH) {
        return {
            nonScratchOrgs: [],
            sandboxes: [],
            scratchOrgs: [{ ...baseOrg, expirationDate: '2099-01-01' }]
        };
    }

    const org = {
        ...baseOrg,
        isSandbox: type === orgTypes.SANDBOX,
        orgEdition: type === orgTypes.DEVELOPER_EDITION ? 'Developer Edition' : 'Enterprise Edition'
    };

    return {
        nonScratchOrgs: [org],
        sandboxes: type === orgTypes.SANDBOX ? [org] : [],
        scratchOrgs: []
    };
}

test('Default Target Orgの設定値を取得する', () => {
    const targetOrg = getDefaultTargetOrg({
        repoRoot: '/repo',
        runSfCommand(args, workingDirectory) {
            assert.deepEqual(args, ['config', 'get', 'target-org', '--json']);
            assert.equal(workingDirectory, '/repo');
            return createSfResult([{ name: 'target-org', success: true, value: 'target-org' }]);
        }
    });

    assert.equal(targetOrg, 'target-org');
});

for (const [type, label] of [
    [orgTypes.SCRATCH, 'Scratch Org'],
    [orgTypes.SANDBOX, 'Sandbox'],
    [orgTypes.DEVELOPER_EDITION, 'Developer Edition'],
    [orgTypes.PRODUCTION, '本番環境']
]) {
    test(`${label}を認証済み組織一覧から判定する`, () => {
        const orgInfo = getTargetOrgInfo({
            repoRoot: '/repo',
            runSfCommand(args, workingDirectory) {
                assert.deepEqual(args, ['org', 'list', '--json', '--skip-connection-status']);
                assert.equal(workingDirectory, '/repo');
                return createSfResult(createOrgList(type));
            },
            targetOrg: 'target-org'
        });

        assert.deepEqual(orgInfo, {
            alias: 'target-org',
            instanceUrl: 'https://example.my.salesforce.com',
            type,
            typeLabel: label,
            username: 'user@example.com'
        });
    });
}

test('aliasがない場合もusernameで対象組織を特定する', () => {
    const result = createOrgList(orgTypes.DEVELOPER_EDITION);
    delete result.nonScratchOrgs[0].alias;
    const orgInfo = getTargetOrgInfo({
        repoRoot: '/repo',
        runSfCommand: () => createSfResult(result),
        targetOrg: 'user@example.com'
    });

    assert.equal(orgInfo.alias, '（未設定）');
    assert.equal(orgInfo.type, orgTypes.DEVELOPER_EDITION);
});

test('対象組織を一意に特定できない場合は判定を中止する', () => {
    const result = createOrgList(orgTypes.PRODUCTION);
    result.nonScratchOrgs.push({ ...result.nonScratchOrgs[0], orgId: '00D000000000002' });

    assert.throws(
        () =>
            getTargetOrgInfo({
                repoRoot: '/repo',
                runSfCommand: () => createSfResult(result),
                targetOrg: 'target-org'
            }),
        /対象組織を一意に特定できませんでした/
    );
});

test('Sandbox分類とフラグが矛盾する場合は判定を中止する', () => {
    const result = createOrgList(orgTypes.SANDBOX);
    result.sandboxes = [];

    assert.throws(
        () =>
            getTargetOrgInfo({
                repoRoot: '/repo',
                runSfCommand: () => createSfResult(result),
                targetOrg: 'target-org'
            }),
        /Sandbox情報がSalesforce CLIの分類と一致しません/
    );
});

test('非Sandbox組織のEditionがない場合は本番と推測しない', () => {
    const result = createOrgList(orgTypes.PRODUCTION);
    delete result.nonScratchOrgs[0].orgEdition;

    assert.throws(
        () =>
            getTargetOrgInfo({
                repoRoot: '/repo',
                runSfCommand: () => createSfResult(result),
                targetOrg: 'target-org'
            }),
        /対象組織のEditionを確認できませんでした/
    );
});

test('Salesforce CLIのJSONを解析できない場合は判定を中止する', () => {
    assert.throws(
        () =>
            getTargetOrgInfo({
                repoRoot: '/repo',
                runSfCommand: () => ({ status: 0, stderr: '', stdout: 'invalid' }),
                targetOrg: 'target-org'
            }),
        /認証済み組織情報の取得のJSONを解析できませんでした/
    );
});

test('接続組織の確認項目だけを指定順で表示する', () => {
    const lines = [];

    printTargetOrgInfo(
        {
            alias: 'target-org',
            instanceUrl: 'https://example.my.salesforce.com',
            type: orgTypes.SANDBOX,
            typeLabel: 'Sandbox',
            username: 'user@example.com'
        },
        (line) => lines.push(line)
    );

    assert.deepEqual(lines, [
        '接続組織を確認してください。',
        '・エイリアス: target-org',
        '・ユーザー名: user@example.com',
        '・URL: https://example.my.salesforce.com',
        '・種別: Sandbox'
    ]);
});
