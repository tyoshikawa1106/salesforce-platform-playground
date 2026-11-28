// 実行コマンド: node --test scripts/scratch-org/test/steps.node.js
// 用途: Scratch Orgの各操作が正しい引数で外部処理を実行することを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { main: deleteScratchOrg } = require('../delete');
const { repoRoot, scratchOrg } = require('../internal/context');
const { main: assignPermissionSet } = require('../steps/assign-permission-set');
const { main: createScratchOrg } = require('../steps/create');
const { main: deployMetadata } = require('../steps/deploy');
const { main: importTestData } = require('../steps/import-test-data');
const { main: runApexTests } = require('../steps/run-apex-tests');

// Salesforce CLIへ渡された引数と作業場所を記録する。
function captureSfCall(execute) {
    let call;
    const status = execute((args, workingDirectory) => {
        call = { args, workingDirectory };
        return 0;
    });

    assert.equal(status, 0);
    assert.equal(call.workingDirectory, repoRoot);
    return call.args;
}

test('Scratch Orgを設定ファイルの内容で作成する', () => {
    // definition、alias、有効日数がSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        createScratchOrg({
            argv: ['--alias', 'test-scratch-org'],
            runSfCommand,
            stdout: { write() {} }
        })
    );

    assert.deepEqual(args, [
        'org',
        'create',
        'scratch',
        '--definition-file',
        scratchOrg.definitionFile,
        '--alias',
        'test-scratch-org',
        '--duration-days',
        String(scratchOrg.durationDays)
    ]);
});

test('Scratch Orgの実行者に反映権限を用意してからmanifestをNoTestRunで反映する', () => {
    const calls = [];
    const status = deployMetadata({
        argv: ['--alias', 'test-scratch-org'],
        runSfQuery: scratchOrgQuery,
        runSfCommand(args, workingDirectory) {
            assert.equal(workingDirectory, repoRoot);
            calls.push(args);
            return 0;
        }
    });
    assert.equal(status, 0);
    assert.deepEqual(calls, [
        [
            'project',
            'deploy',
            'start',
            '--metadata',
            `PermissionSet:${scratchOrg.deploymentPermissionSet}`,
            '--target-org',
            'scratch-test@example.com',
            '--test-level',
            'NoTestRun',
            '--wait',
            String(scratchOrg.waitMinutes)
        ],
        [
            'org',
            'assign',
            'permset',
            '--name',
            scratchOrg.deploymentPermissionSet,
            '--target-org',
            'scratch-test@example.com',
            '--json'
        ],
        [
            'project',
            'deploy',
            'start',
            '--manifest',
            scratchOrg.manifest,
            '--target-org',
            'scratch-test@example.com',
            '--test-level',
            'NoTestRun',
            '--wait',
            String(scratchOrg.waitMinutes)
        ]
    ]);
});

for (const [failureIndex, step] of ['権限セット反映', '権限割り当て', 'manifest反映'].entries()) {
    test(`${step}の失敗で停止し終了状態を返す`, () => {
        let calls = 0;
        const status = deployMetadata({
            argv: ['--alias', 'test-scratch-org'],
            runSfQuery: scratchOrgQuery,
            runSfCommand() {
                const index = calls++;
                return index === failureIndex ? 42 : 0;
            }
        });
        assert.equal(status, 42);
        assert.equal(calls, failureIndex + 1);
    });
}

test('Scratch Orgへ設定ファイルのPermission Setを割り当てる', () => {
    // Permission Setと照合済みユーザー名がSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        assignPermissionSet({ argv: ['--alias', 'test-scratch-org'], runSfCommand, runSfQuery: scratchOrgQuery })
    );

    assert.deepEqual(args, [
        'org',
        'assign',
        'permset',
        '--name',
        'SalesforceApplicationUser',
        '--name',
        'LwcAccountDataQualityScan',
        '--name',
        'LwcAccountDelete',
        '--name',
        'LwcAccountMassUpdate',
        '--name',
        'LwcAccountPdfExport',
        '--name',
        'LwcCaseEmailMessageList',
        '--name',
        'LwcExternalClientAppManager',
        '--name',
        'LwcOAuthTokenIssuance',
        '--name',
        'LwcObjectExplorer',
        '--name',
        'LwcObjectMetricsOverview',
        '--name',
        'LwcObjectRecordSearch',
        '--name',
        'LwcOrgExplorer',
        '--name',
        'LwcTestDataDelete',
        '--name',
        'LwcUserCreateAssistant',
        '--name',
        'LwcUserLocaleSettings',
        '--target-org',
        'scratch-test@example.com',
        '--json'
    ]);
});

test('Scratch Org用の設定でテストデータを投入する', async () => {
    // 共通処理へplan、内部alias、繰り返し回数が渡ることを確認する。
    let options;
    const status = await importTestData({
        argv: ['--alias', 'test-scratch-org'],
        async runImportTestDataCommand(runOptions) {
            options = runOptions;
        }
    });

    assert.equal(status, 0);
    assert.deepEqual(options, {
        argv: ['--plan', scratchOrg.importPlan, '--default-repeat', '40'],
        targetOrg: 'test-scratch-org'
    });
});

test('明示されたaliasのScratch Orgだけを削除する', () => {
    // 削除対象のaliasがSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        deleteScratchOrg({ argv: ['--alias', 'test-scratch-org'], runSfCommand })
    );

    assert.deepEqual(args, ['org', 'delete', 'scratch', '--target-org', 'test-scratch-org']);
});

// CLIの種別確認も注入し、単体テストから実組織へ接続しない。
function scratchOrgQuery(args, workingDirectory) {
    if (args.includes('--use-tooling-api'))
        return { status: 0, stdout: JSON.stringify({ status: 0, result: { totalSize: 0, records: [] } }) };
    if (args.includes('--query') && args[args.indexOf('--query') + 1].startsWith('SELECT PermissionSet.Name'))
        return { status: 0, stdout: JSON.stringify({ status: 0, result: { totalSize: 0, records: [] } }) };
    if (args[0] === 'data') {
        assert.deepEqual(args, [
            'data',
            'query',
            '--target-org',
            'scratch-test@example.com',
            '--query',
            `SELECT Id FROM PermissionSetAssignment WHERE Assignee.Username = 'scratch-test@example.com' AND PermissionSet.Name = '${scratchOrg.deploymentPermissionSet}'`,
            '--json'
        ]);
        assert.equal(workingDirectory, repoRoot);
        return { status: 0, stdout: JSON.stringify({ status: 0, result: { totalSize: 0, records: [] } }) };
    }
    assert.deepEqual(args, ['org', 'list', '--json', '--skip-connection-status']);
    assert.equal(workingDirectory, repoRoot);
    return {
        status: 0,
        stdout: JSON.stringify({
            status: 0,
            result: {
                nonScratchOrgs: [],
                sandboxes: [],
                scratchOrgs: [
                    {
                        alias: 'test-scratch-org',
                        username: 'scratch-test@example.com',
                        instanceUrl: 'https://scratch.example.com'
                    }
                ]
            }
        })
    };
}

for (const [name, orgEdition, isSandbox] of [
    ['本番', 'Enterprise Edition', false],
    ['Developer Edition', 'Developer Edition', false],
    ['Sandbox', 'Enterprise Edition', true]
]) {
    for (const operation of [deployMetadata, assignPermissionSet]) {
        test(`${name}には再構築の${operation === deployMetadata ? 'deploy' : '権限割り当て'}を実行しない`, () => {
            const org = {
                alias: 'test-scratch-org',
                username: 'test@example.com',
                instanceUrl: 'https://org.example.com',
                orgId: 'test-org',
                orgEdition,
                isSandbox
            };
            let deployed = false;
            const status = operation({
                argv: ['--alias', 'test-scratch-org'],
                runSfCommand() {
                    deployed = true;
                },
                runSfQuery() {
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: {
                                nonScratchOrgs: [org],
                                sandboxes: isSandbox ? [org] : [],
                                scratchOrgs: []
                            }
                        })
                    };
                }
            });
            assert.equal(status, 1);
            assert.equal(deployed, false);
        });
    }
}

for (const [name, response] of [
    ['CLI失敗', { status: 1, stdout: '' }],
    ['壊れたJSON', { status: 0, stdout: '{' }],
    [
        '対象なし',
        {
            status: 0,
            stdout: JSON.stringify({
                status: 0,
                result: {
                    nonScratchOrgs: [],
                    sandboxes: [],
                    scratchOrgs: []
                }
            })
        }
    ]
]) {
    test(`${name}では再構築deployを実行しない`, () => {
        let deployed = false;
        const status = deployMetadata({
            argv: ['--alias', 'test-scratch-org'],
            runSfCommand() {
                deployed = true;
            },
            runSfQuery() {
                return response;
            }
        });
        assert.equal(status, 1);
        assert.equal(deployed, false);
    });
}

test('割り当て済みならCLIの重複割り当てを避けmanifest反映へ進む', () => {
    const calls = [];
    const status = deployMetadata({
        argv: ['--alias', 'test-scratch-org'],
        runSfQuery(args, directory) {
            if (args[0] === 'org' || args.includes('--use-tooling-api')) return scratchOrgQuery(args, directory);
            return {
                status: 0,
                stdout: JSON.stringify({ status: 0, result: { totalSize: 1, records: [{ Id: 'assignment-id' }] } })
            };
        },
        runSfCommand(args) {
            calls.push(args);
            return 0;
        }
    });
    assert.equal(status, 0);
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes('--metadata'));
    assert.ok(calls[1].includes('--manifest'));
});

for (const response of [
    { status: 1, stdout: '' },
    { status: 0, stdout: '{' },
    ...[
        { status: 1, result: { totalSize: 0, records: [] } },
        { status: 0, result: { totalSize: 1, records: [] } },
        { status: 0, result: { totalSize: 1, records: [{}] } },
        { status: 0, result: { totalSize: 2, records: [{ Id: 'a' }, { Id: 'b' }] } },
        { status: 0 }
    ].map((value) => ({ status: 0, stdout: JSON.stringify(value) }))
]) {
    test(`割り当て確認に失敗した場合は権限割り当てと本体反映を停止: ${response.stdout}`, () => {
        const calls = [];
        const status = deployMetadata({
            argv: ['--alias', 'test-scratch-org'],
            runSfQuery(args, directory) {
                return args[0] === 'org' ? scratchOrgQuery(args, directory) : response;
            },
            runSfCommand(args) {
                calls.push(args);
                return 0;
            }
        });
        assert.equal(status, 1);
        assert.equal(calls.length, 1);
    });
}

test('Scratch Orgの実行ユーザーでApexテストの完了を待ち、失敗を返す', async () => {
    const status = await runApexTests({
        argv: ['--alias', 'test-scratch-org'],
        runSfQuery: scratchOrgQuery,
        async runTests(options) {
            assert.deepEqual(options, {
                testType: 'apex',
                targetOrg: 'scratch-test@example.com',
                repoRoot
            });
            return 42;
        }
    });
    assert.equal(status, 42);
});

const accountAccess = { object: 'Account', allowRead: 'true', allowDelete: 'true' };
const existingContactAccess = { object: 'Contact', allowRead: 'true', allowEdit: 'true' };
const readOnlyContact = {
    object: 'Contact',
    allowRead: 'true',
    allowCreate: 'false',
    allowEdit: 'false',
    allowDelete: 'false',
    viewAllRecords: 'false',
    modifyAllRecords: 'false'
};
const principalAccess = { enabled: 'true', externalCredentialPrincipal: 'Example-Principal' };
const permissionInputs = {
    LwcAccountDelete: { objectPermissions: accountAccess },
    LwcExternalClientAppManager: { label: '認証管理', externalCredentialPrincipalAccesses: principalAccess },
    LwcObjectExplorer: {
        objectPermissions: [accountAccess, existingContactAccess],
        externalCredentialPrincipalAccesses: principalAccess
    }
};

for (const [personAccounts, shellsOnly] of [
    [true, false],
    [false, true],
    [true, true]
]) {
    test(`初期パッケージの権限と後始末: 個人取引先=${personAccounts} 枠のみ=${shellsOnly}`, () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const { XMLParser, XMLBuilder } = require('fast-xml-parser');
        const build = new XMLBuilder();
        const parse = new XMLParser({ parseTagValue: false });
        let directory;
        const deployed = {};
        const names = ['LwcAccountDelete', ...(shellsOnly ? ['LwcExternalClientAppManager', 'LwcObjectExplorer'] : [])];
        const status = deployMetadata({
            argv: ['--alias', 'test-scratch-org', ...(shellsOnly ? ['--shells-only'] : [])],
            runSfQuery(args, cwd) {
                if (!args.includes('--use-tooling-api')) return scratchOrgQuery(args, cwd);
                const records = personAccounts ? [{ QualifiedApiName: 'IsPersonAccount' }] : [];
                return {
                    status: 0,
                    stdout: JSON.stringify({ status: 0, result: { totalSize: records.length, records } })
                };
            },
            runSfCommand(args) {
                if (args.includes('--output-dir')) {
                    directory = args[args.indexOf('--output-dir') + 1];
                    const manifest = parse.parse(fs.readFileSync(args[args.indexOf('--manifest') + 1], 'utf8'));
                    const members = manifest.Package.types.find((type) => type.name === 'PermissionSet').members;
                    assert.equal(members.includes('LwcObjectExplorer'), shellsOnly);
                    assert.equal(members.includes('LwcExternalClientAppManager'), shellsOnly);
                    fs.mkdirSync(path.join(directory, 'permissionsets'), { recursive: true });
                    for (const name of names) {
                        fs.writeFileSync(
                            path.join(directory, 'permissionsets', name + '.permissionset'),
                            build.build({ PermissionSet: permissionInputs[name] })
                        );
                    }
                }
                if (args.includes('--metadata-dir')) {
                    assert.equal(args[args.indexOf('--target-org') + 1], 'scratch-test@example.com');
                    for (const name of names) {
                        const file = path.join(directory, 'permissionsets', name + '.permissionset');
                        deployed[name] = parse.parse(fs.readFileSync(file, 'utf8')).PermissionSet;
                    }
                }
                return 0;
            }
        });
        assert.equal(status, 0);
        assert.deepEqual(
            deployed.LwcAccountDelete,
            {
                objectPermissions: personAccounts ? [accountAccess, readOnlyContact] : accountAccess
            },
            'LwcAccountDelete の取引先・取引先責任者権限'
        );
        if (shellsOnly) {
            assert.deepEqual(deployed.LwcExternalClientAppManager, { label: '認証管理' }, '認証管理のプリンシパル除外');
            assert.deepEqual(
                deployed.LwcObjectExplorer,
                {
                    objectPermissions: [accountAccess, existingContactAccess]
                },
                'オブジェクトエクスプローラーの既存権限を維持し、プリンシパルを除外'
            );
        }
        assert.equal(fs.existsSync(directory), false);
    });
}

test('全権限セットを付与済みの再開では二重割り当てを要求しない', () => {
    const records = scratchOrg.permissionSets.map((Name) => ({ PermissionSet: { Name } }));
    assert.equal(
        assignPermissionSet({
            argv: ['--alias', 'test-scratch-org'],
            runSfQuery: (args, cwd) =>
                args[0] === 'org'
                    ? scratchOrgQuery(args, cwd)
                    : {
                          status: 0,
                          stdout: JSON.stringify({ status: 0, result: { totalSize: records.length, records } })
                      },
            runSfCommand: assert.fail
        }),
        0
    );
});
