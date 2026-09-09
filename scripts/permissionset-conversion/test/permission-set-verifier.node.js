// 実行コマンド: node --test scripts/permissionset-conversion/test/permission-set-verifier.node.js
// 用途: デプロイ後のPermission Set再取得、意味比較、差分レポートを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    buildRetrieveArgs,
    comparePermissionSetDirectories,
    comparePermissionSets,
    parsePermissionSetXml
} = require('../internal/permission-set-verifier');
const {
    main,
    parseArguments,
    resolveSourceDirectory,
    resolveVerificationDirectory
} = require('../verify-deployed-permissionsets');

// 比較fixtureで共通利用するPermission Set XMLを組み立てる。
function createPermissionSetXml(body) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">\n${body}\n</PermissionSet>\n`;
}

// sourceと再取得結果を分離した日時別の一時出力フォルダを作成する。
function createComparisonProject() {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'permissionset-verification-'));
    const runDirectory = path.join(projectRoot, 'scripts/permissionset-conversion/outputs/20260902-150318-540');
    const sourceDirectory = path.join(runDirectory, 'permissionsets');
    fs.mkdirSync(sourceDirectory, { recursive: true });
    return { projectRoot, runDirectory, sourceDirectory };
}

test('XML文字参照の表記差を無視し実際の値変更は検出する', () => {
    const expected = parsePermissionSetXml(
        createPermissionSetXml(
            '<label>Sales &amp; &quot;Support&quot; &apos;Team&apos; &lt;Ops&gt;</label><classAccesses><apexClass>Enabled&#67;ontroller</apexClass><enabled>true</enabled></classAccesses>'
        ),
        '生成XML'
    );
    const actual = parsePermissionSetXml(
        createPermissionSetXml(
            '<label>Sales &#38; "Support" \'Team\' &#x3C;Ops&#62;</label><classAccesses><apexClass>EnabledController</apexClass><enabled>true</enabled></classAccesses>'
        ),
        '再取得XML'
    );
    assert.deepEqual(comparePermissionSets(expected, actual), []);
    assert.equal(comparePermissionSets(expected, { ...actual, label: 'Changed' }).length, 1);
    const literal = parsePermissionSetXml(createPermissionSetXml('<label>&amp;#38;</label>'), '文字列');
    const decoded = parsePermissionSetXml(createPermissionSetXml('<label>&#38;</label>'), '文字参照');
    assert.equal(comparePermissionSets(literal, decoded).length, 1);
});

test('Permission Set比較で内部・外部DOCTYPEを拒否する', () => {
    for (const declaration of [
        '<!DOCTYPE PermissionSet [<!ENTITY label "Example">]>',
        '<!DOCTYPE PermissionSet SYSTEM "https://example.invalid/metadata.dtd">'
    ]) {
        assert.throws(
            () =>
                parsePermissionSetXml(
                    createPermissionSetXml('<label>Example</label>').replace(
                        '<PermissionSet ',
                        `${declaration}\n<PermissionSet `
                    ),
                    '比較XML'
                ),
            /DOCTYPE/
        );
    }
    const commentXml = createPermissionSetXml(
        '<!-- <!DOCTYPE PermissionSet> --><label><![CDATA[<!DOCTYPE example>]]></label>'
    );
    assert.equal(parsePermissionSetXml(commentXml, 'コメントXML').label, '<!DOCTYPE example>');
});

test('保存結果確認の引数を限定する', () => {
    // 必須の生成フォルダだけを解析する。
    assert.deepEqual(parseArguments(['--source-dir', 'outputs/run/permissionsets']), {
        sourceDirectory: 'outputs/run/permissionsets'
    });
    // 未対応引数、廃止した組織引数、同一引数の重複を拒否する。
    assert.throws(() => parseArguments(['--unknown']), /未対応の引数/);
    assert.throws(() => parseArguments(['--target-org', 'target-org-a']), /未対応の引数/);
    assert.throws(() => parseArguments(['--source-dir', 'one', '--source-dir', 'two']), /1回だけ指定/);
});

test('保存結果確認は日時別outputs直下のpermissionsetsだけを受け付ける', () => {
    // 正しい出力構造を一時プロジェクトへ用意する。
    const project = createComparisonProject();

    try {
        // 正しい生成フォルダを絶対パスへ解決する。
        assert.equal(
            resolveSourceDirectory({
                projectRoot: project.projectRoot,
                sourceDirectory: path.relative(project.projectRoot, project.sourceDirectory)
            }),
            project.sourceDirectory
        );
        // outputs外と実行日時階層を持たないフォルダを拒否する。
        assert.throws(
            () => resolveSourceDirectory({ projectRoot: project.projectRoot, sourceDirectory: 'permissionsets' }),
            /outputs\/<実行日時>\//
        );
    } finally {
        // テストで作成した一時プロジェクトを削除する。
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('retrieveは生成したPermission Set API名だけを完全一致で指定する', () => {
    // 2件のPermission Setを指定してSalesforce CLI引数を作る。
    const args = buildRetrieveArgs({
        apiNames: ['Admin', 'Platform_User'],
        outputDirectory: '/tmp/retrieved',
        targetOrg: 'target-org-a'
    });

    // exact-name metadata指定、確認済みDefault Target Org、再取得先を含むことを確認する。
    assert.deepEqual(args.slice(0, 3), ['project', 'retrieve', 'start']);
    assert.deepEqual(
        args.filter((argument) => argument.startsWith('PermissionSet:')),
        ['PermissionSet:Admin', 'PermissionSet:Platform_User']
    );
    assert.equal(args[args.indexOf('--target-org') + 1], 'target-org-a');
    assert.equal(args[args.indexOf('--output-dir') + 1], '/tmp/retrieved');
});

test('繰り返し要素順とviewAllFieldsの省略値だけが異なるPermission Setを同一と判定する', () => {
    // 生成XMLではアプリ順を固定し、viewAllFieldsを省略した入力を作る。
    const expected = parsePermissionSetXml(
        createPermissionSetXml(
            '    <applicationVisibilities>\n        <application>App_A</application>\n        <visible>true</visible>\n    </applicationVisibilities>\n    <applicationVisibilities>\n        <application>App_B</application>\n        <visible>true</visible>\n    </applicationVisibilities>\n    <label>Example</label>\n    <objectPermissions>\n        <allowCreate>false</allowCreate>\n        <allowDelete>false</allowDelete>\n        <allowEdit>false</allowEdit>\n        <allowRead>true</allowRead>\n        <modifyAllRecords>false</modifyAllRecords>\n        <object>Account</object>\n        <viewAllRecords>false</viewAllRecords>\n    </objectPermissions>'
        ),
        '生成XML'
    );
    // 再取得XMLでは直下順とアプリ順を変え、Salesforceが補完するfalseを含める。
    const actual = parsePermissionSetXml(
        createPermissionSetXml(
            '    <objectPermissions>\n        <allowRead>true</allowRead>\n        <allowEdit>false</allowEdit>\n        <allowDelete>false</allowDelete>\n        <allowCreate>false</allowCreate>\n        <modifyAllRecords>false</modifyAllRecords>\n        <object>Account</object>\n        <viewAllFields>false</viewAllFields>\n        <viewAllRecords>false</viewAllRecords>\n    </objectPermissions>\n    <label>Example</label>\n    <applicationVisibilities>\n        <visible>true</visible>\n        <application>App_B</application>\n    </applicationVisibilities>\n    <applicationVisibilities>\n        <visible>true</visible>\n        <application>App_A</application>\n    </applicationVisibilities>'
        ),
        '組織XML'
    );

    // XML表記差を除いた意味比較では差分がないことを確認する。
    assert.deepEqual(comparePermissionSets(expected, actual), []);
});

test('Salesforceが除外または変更した権限を要素単位で検出する', () => {
    // 生成XMLに編集権限、タブ、ユーザー権限を含める。
    const expected = parsePermissionSetXml(
        createPermissionSetXml(
            '    <fieldPermissions>\n        <editable>true</editable>\n        <field>Account.Name</field>\n        <readable>true</readable>\n    </fieldPermissions>\n    <label>Example</label>\n    <tabSettings>\n        <tab>standard-Account</tab>\n        <visibility>Visible</visibility>\n    </tabSettings>\n    <userPermissions>\n        <enabled>true</enabled>\n        <name>ManageUsers</name>\n    </userPermissions>'
        ),
        '生成XML'
    );
    // 組織XMLでは編集権限をfalseにし、タブとユーザー権限を省略する。
    const actual = parsePermissionSetXml(
        createPermissionSetXml(
            '    <fieldPermissions>\n        <editable>false</editable>\n        <field>Account.Name</field>\n        <readable>true</readable>\n    </fieldPermissions>\n    <label>Example</label>'
        ),
        '組織XML'
    );
    const differences = comparePermissionSets(expected, actual);

    // 値変更と2件の組織側欠落を区別して返す。
    assert.deepEqual(
        differences.map(({ element, kind, name }) => ({ element, kind, name })),
        [
            { element: 'fieldPermissions', kind: 'changed', name: 'Account.Name' },
            { element: 'tabSettings', kind: 'missingInOrg', name: 'standard-Account' },
            { element: 'userPermissions', kind: 'missingInOrg', name: 'ManageUsers' }
        ]
    );
});

test('フォルダ比較はPermission Setごとの一致数と全差分を集計する', () => {
    // 一致する1件と差異がある1件の生成・再取得XMLを用意する。
    const project = createComparisonProject();
    const retrievedDirectory = path.join(project.runDirectory, 'retrieved/permissionsets');
    fs.mkdirSync(retrievedDirectory, { recursive: true });
    const equalXml = createPermissionSetXml('    <label>Equal</label>');
    const changedSourceXml = createPermissionSetXml('    <label>Before</label>');
    const changedOrgXml = createPermissionSetXml('    <label>After</label>');
    fs.writeFileSync(path.join(project.sourceDirectory, 'Equal.permissionset-meta.xml'), equalXml);
    fs.writeFileSync(path.join(retrievedDirectory, 'Equal.permissionset-meta.xml'), equalXml);
    fs.writeFileSync(path.join(project.sourceDirectory, 'Changed.permissionset-meta.xml'), changedSourceXml);
    fs.writeFileSync(path.join(retrievedDirectory, 'Changed.permissionset-meta.xml'), changedOrgXml);

    try {
        // 2件中1件のラベル差分を集計する。
        const comparison = comparePermissionSetDirectories({
            retrievedDirectory,
            sourceDirectory: project.sourceDirectory
        });
        assert.equal(comparison.permissionSets, 2);
        assert.equal(comparison.equal, 1);
        assert.equal(comparison.different, 1);
        assert.equal(comparison.differences, 1);
    } finally {
        // テストで作成した一時プロジェクトを削除する。
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('再取得先の不存在・空フォルダ・対象外ファイルだけの場合は全件欠落を返す', () => {
    for (const state of ['absent', 'empty', 'unrelated']) {
        const project = createComparisonProject();
        const retrievedDirectory = path.join(project.runDirectory, 'retrieved/permissionsets');
        try {
            fs.writeFileSync(
                path.join(project.sourceDirectory, 'Expected.permissionset-meta.xml'),
                createPermissionSetXml('<label>Expected</label>')
            );
            if (state !== 'absent') fs.mkdirSync(retrievedDirectory, { recursive: true });
            if (state === 'unrelated') fs.writeFileSync(path.join(retrievedDirectory, 'notes.txt'), 'not metadata');
            const result = comparePermissionSetDirectories({
                sourceDirectory: project.sourceDirectory,
                retrievedDirectory
            });
            assert.deepEqual(result, {
                permissionSets: 1,
                equal: 0,
                different: 1,
                differences: 1,
                results: [{ apiName: 'Expected', equal: false, differences: [{ kind: 'missingPermissionSetInOrg' }] }]
            });
        } finally {
            fs.rmSync(project.projectRoot, { recursive: true, force: true });
        }
    }
});

test('生成元が空なら組織へ接続せず拒否し、再取得先の読み取りエラーを欠落扱いにしない', async () => {
    const project = createComparisonProject();
    let calls = 0;
    try {
        await assert.rejects(
            main({
                argv: ['--source-dir', path.relative(project.projectRoot, project.sourceDirectory)],
                projectRoot: project.projectRoot,
                runSfWithOutputCommand() {
                    calls++;
                    throw new Error('unexpected org call');
                },
                writeLine() {}
            }),
            /比較するPermission Set XMLがありません/
        );
        assert.equal(calls, 0);
        fs.writeFileSync(
            path.join(project.sourceDirectory, 'Expected.permissionset-meta.xml'),
            createPermissionSetXml('<label>Expected</label>')
        );
        const retrievedDirectory = path.join(project.runDirectory, 'not-a-directory');
        fs.writeFileSync(retrievedDirectory, 'invalid retrieval path');
        assert.throws(
            () =>
                comparePermissionSetDirectories({
                    sourceDirectory: project.sourceDirectory,
                    retrievedDirectory
                }),
            { code: 'ENOTDIR' }
        );
    } finally {
        fs.rmSync(project.projectRoot, { recursive: true, force: true });
    }
});

test('CLIは再取得0件でも全対象の欠落レポートを保存し終了コード1を返す', async () => {
    const project = createComparisonProject();
    const fixedNow = new Date('2026-09-02T06:30:18.540Z');
    const lines = [];
    try {
        for (const name of ['First', 'Second'])
            fs.writeFileSync(
                path.join(project.sourceDirectory, `${name}.permissionset-meta.xml`),
                createPermissionSetXml(`<label>${name}</label>`)
            );
        const status = await main({
            argv: ['--source-dir', path.relative(project.projectRoot, project.sourceDirectory)],
            projectRoot: project.projectRoot,
            now: () => fixedNow,
            writeLine: (line) => lines.push(line),
            runSfWithOutputCommand(args) {
                if (args[0] === 'config')
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: [{ name: 'target-org', success: true, value: 'target-org-a' }]
                        })
                    };
                if (args[0] === 'org') {
                    const org = {
                        alias: 'target-org-a',
                        username: 'integration@example.com',
                        instanceUrl: 'https://example--test.sandbox.my.salesforce.com',
                        orgId: '00D000000000001AAA',
                        isSandbox: true,
                        orgEdition: 'Enterprise Edition'
                    };
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: { nonScratchOrgs: [org], sandboxes: [org], scratchOrgs: [] }
                        })
                    };
                }
                assert.deepEqual(args.slice(0, 3), ['project', 'retrieve', 'start']);
                const outputDirectory = args[args.indexOf('--output-dir') + 1];
                fs.mkdirSync(path.join(outputDirectory, 'permissionsets'), { recursive: true });
                return { status: 0, stdout: JSON.stringify({ status: 0, result: { status: 'Succeeded' } }) };
            }
        });
        assert.equal(status, 1);
        assert.ok(lines.includes('保存結果確認: 一致0件、差異あり2件、差分2件'));
        const directory = path.join(path.dirname(project.sourceDirectory), 'verification', '20260902063018540');
        const report = JSON.parse(fs.readFileSync(path.join(directory, 'comparison-report.json'), 'utf8'));
        assert.deepEqual(report.summary, { permissionSets: 2, equal: 0, different: 2, differences: 2 });
        assert.deepEqual(
            report.results,
            ['First', 'Second'].map((apiName) => ({
                apiName,
                equal: false,
                differences: [{ kind: 'missingPermissionSetInOrg' }]
            }))
        );
    } finally {
        fs.rmSync(project.projectRoot, { recursive: true, force: true });
    }
});

test('CLIは組織から再取得した一致結果をJSONへ保存する', async () => {
    // 1件の生成XMLと認証済みSandbox情報を一時プロジェクトへ用意する。
    const project = createComparisonProject();
    const permissionSetXml = createPermissionSetXml('    <label>Example</label>');
    fs.writeFileSync(path.join(project.sourceDirectory, 'Example.permissionset-meta.xml'), permissionSetXml);
    const fixedNow = new Date('2026-09-02T06:30:18.540Z');
    const calls = [];
    const timeouts = [];
    const outputLines = [];

    try {
        // 組織一覧とPermission Set retrieveを返すSalesforce CLI stubで入口を実行する。
        const status = await main({
            argv: ['--source-dir', path.relative(project.projectRoot, project.sourceDirectory)],
            now: () => fixedNow,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand(args, workingDirectory, spawnCommand, maxBuffer, timeout) {
                calls.push(args);
                timeouts.push(timeout);

                if (args[0] === 'config') {
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: [{ name: 'target-org', success: true, value: 'target-org-a' }]
                        })
                    };
                }

                if (args[0] === 'org') {
                    const org = {
                        alias: 'target-org-a',
                        instanceUrl: 'https://example--test.sandbox.my.salesforce.com',
                        isSandbox: true,
                        orgEdition: 'Enterprise Edition',
                        orgId: '00D000000000001AAA',
                        username: 'integration@example.com'
                    };
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: { nonScratchOrgs: [org], sandboxes: [org], scratchOrgs: [] }
                        })
                    };
                }

                const outputDirectory = args[args.indexOf('--output-dir') + 1];
                fs.mkdirSync(path.join(outputDirectory, 'permissionsets'), { recursive: true });
                fs.writeFileSync(
                    path.join(outputDirectory, 'permissionsets/Example.permissionset-meta.xml'),
                    permissionSetXml
                );
                return { status: 0, stdout: JSON.stringify({ status: 0, result: { status: 'Succeeded' } }) };
            },
            writeLine: (line) => outputLines.push(line)
        });

        // 一致で終了コード0を返し、retrieve対象をexact-nameで指定する。
        assert.equal(status, 0);
        assert.equal(calls.length, 3);
        assert.deepEqual(calls[0], ['config', 'get', 'target-org', '--json']);
        assert.deepEqual(timeouts, [120_000, 120_000, 35 * 60 * 1_000]);
        assert.equal(calls[2].includes('PermissionSet:Example'), true);
        assert.equal(calls[2][calls[2].indexOf('--target-org') + 1], 'target-org-a');
        assert.equal(outputLines.includes('保存結果確認: 一致1件、差異あり0件、差分0件'), true);
        // 日時別の比較レポートへ一致結果を保存する。
        const verificationDirectory = path.join(
            path.dirname(project.sourceDirectory),
            'verification',
            '20260902063018540'
        );
        const report = JSON.parse(fs.readFileSync(path.join(verificationDirectory, 'comparison-report.json'), 'utf8'));
        assert.equal(report.targetOrg, 'target-org-a');
        assert.deepEqual(report.summary, { permissionSets: 1, equal: 1, different: 0, differences: 0 });
    } finally {
        // テストで作成した一時プロジェクトを削除する。
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('CLIは保存時の差分を比較レポートだけへ保存する', async () => {
    // 編集可能な項目権限を持つ生成XMLを一時プロジェクトへ用意する。
    const project = createComparisonProject();
    const sourceXml = createPermissionSetXml(
        '    <fieldPermissions>\n        <editable>true</editable>\n        <field>Account.Name</field>\n        <readable>true</readable>\n    </fieldPermissions>\n    <label>Example</label>'
    );
    const retrievedXml = sourceXml.replace('<editable>true</editable>', '<editable>false</editable>');
    fs.writeFileSync(path.join(project.sourceDirectory, 'Example.permissionset-meta.xml'), sourceXml);
    const fixedNow = new Date('2026-09-02T06:30:18.540Z');
    const outputLines = [];

    try {
        // 組織一覧と編集権限が縮小されたretrieve結果を返すCLI stubで入口を実行する。
        const status = await main({
            argv: ['--source-dir', path.relative(project.projectRoot, project.sourceDirectory)],
            now: () => fixedNow,
            projectRoot: project.projectRoot,
            runSfWithOutputCommand(args) {
                if (args[0] === 'config') {
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: [{ name: 'target-org', success: true, value: 'target-org-b' }]
                        })
                    };
                }

                if (args[0] === 'org') {
                    const org = {
                        alias: 'target-org-b',
                        instanceUrl: 'https://example--test.sandbox.my.salesforce.com',
                        isSandbox: true,
                        orgEdition: 'Enterprise Edition',
                        orgId: '00D000000000001AAA',
                        username: 'integration@example.com'
                    };
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            status: 0,
                            result: { nonScratchOrgs: [org], sandboxes: [org], scratchOrgs: [] }
                        })
                    };
                }

                const outputDirectory = args[args.indexOf('--output-dir') + 1];
                fs.mkdirSync(path.join(outputDirectory, 'permissionsets'), { recursive: true });
                fs.writeFileSync(
                    path.join(outputDirectory, 'permissionsets/Example.permissionset-meta.xml'),
                    retrievedXml
                );
                return { status: 0, stdout: JSON.stringify({ status: 0, result: { status: 'Succeeded' } }) };
            },
            writeLine: (line) => outputLines.push(line)
        });
        // 差分があるため終了コード1を返し、組織固有の再生成コマンドは案内しない。
        assert.equal(status, 1);
        assert.equal(
            outputLines.some((line) => line.startsWith('再生成コマンド:')),
            false
        );
        // 日時別検証フォルダの比較レポートへ差分を保存する。
        const verificationDirectory = path.join(
            path.dirname(project.sourceDirectory),
            'verification',
            '20260902063018540'
        );
        const report = JSON.parse(fs.readFileSync(path.join(verificationDirectory, 'comparison-report.json'), 'utf8'));
        assert.equal(report.targetOrg, 'target-org-b');
        assert.deepEqual(report.summary, { permissionSets: 1, equal: 0, different: 1, differences: 1 });
        assert.deepEqual(report.results[0].differences[0], {
            element: 'fieldPermissions',
            name: 'Account.Name',
            kind: 'changed',
            expected: { editable: 'true', field: 'Account.Name', readable: 'true' },
            actual: { editable: 'false', field: 'Account.Name', readable: 'true' }
        });
        assert.deepEqual(fs.readdirSync(verificationDirectory).sort(), ['comparison-report.json', 'retrieved']);
    } finally {
        // テストで作成した一時プロジェクトを削除する。
        fs.rmSync(project.projectRoot, { force: true, recursive: true });
    }
});

test('同時実行が候補フォルダを先に確保しても取得先を共有しない', () => {
    const project = createComparisonProject();
    const now = () => new Date('2026-09-02T06:30:18.540Z');
    let competingDirectory;
    try {
        const directory = resolveVerificationDirectory({
            sourceDirectory: project.sourceDirectory,
            now,
            mkdirSync(candidate, options) {
                if (!options && !competingDirectory) {
                    competingDirectory = resolveVerificationDirectory({
                        sourceDirectory: project.sourceDirectory,
                        now
                    });
                    fs.writeFileSync(path.join(competingDirectory, 'existing.txt'), 'other-run');
                }
                return fs.mkdirSync(candidate, options);
            }
        });
        assert.notEqual(directory, competingDirectory);
        assert.equal(path.basename(directory), '20260902063018540-0001');
        assert.equal(fs.readFileSync(path.join(competingDirectory, 'existing.txt'), 'utf8'), 'other-run');
        assert.deepEqual(fs.readdirSync(directory), []);
    } finally {
        fs.rmSync(project.projectRoot, { recursive: true, force: true });
    }
});

test('保存先確保の権限エラーは再試行せず元のエラーで停止する', () => {
    const error = Object.assign(new Error('denied'), { code: 'EACCES' });
    let calls = 0;
    assert.throws(
        () =>
            resolveVerificationDirectory({
                sourceDirectory: '/unused/permissionsets',
                mkdirSync(candidate, options) {
                    calls++;
                    if (!options) throw error;
                }
            }),
        (actual) => actual === error
    );
    assert.equal(calls, 2);
});

test('すべての連番が使用済みの場合は取得先を返さず停止する', () => {
    let attempts = 0;
    assert.throws(
        () =>
            resolveVerificationDirectory({
                sourceDirectory: '/unused/permissionsets',
                mkdirSync(candidate, options) {
                    if (!options) {
                        attempts++;
                        throw Object.assign(new Error('exists'), { code: 'EEXIST' });
                    }
                }
            }),
        /一意な保存結果確認フォルダを確保できません/
    );
    assert.equal(attempts, 10000);
});
