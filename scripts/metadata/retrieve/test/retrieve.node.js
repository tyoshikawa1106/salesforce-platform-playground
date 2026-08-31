// 実行コマンド: node --test scripts/metadata/retrieve/test/retrieve.node.js
// 用途: retrieveのmanifest計画、CLI結果判定、接続組織の承認、実行順、停止条件を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    main,
    manifests,
    metadataApiFileLimit,
    parseRetrieveCommandResult,
    retrieveProgressIntervalMilliseconds,
    retrieveOutputMaxBuffer,
    runRetrieveWithOutput,
    validateManifestDefinitions,
    validateRetrieveManifestPlan
} = require('../retrieve');

// manifestとretrieveスクリプトをリポジトリルート基準で参照する。
const repoRoot = path.resolve(__dirname, '../../../..');
const projectConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'sfdx-project.json'), 'utf8'));

// retrieve開始確認へ指定した回答を返す。
function createPrompt(answer) {
    let closed = false;

    return {
        prompt: {
            async question() {
                return answer;
            },
            close() {
                closed = true;
            }
        },
        isClosed() {
            return closed;
        }
    };
}

// Default Target OrgとSandboxの認証済み組織情報を返す。
function createOrgInfoCommand() {
    return (args) => {
        if (args[0] === 'config') {
            return createSfResult([{ name: 'target-org', success: true, value: 'test-org' }]);
        }

        const org = {
            alias: 'test-org',
            instanceUrl: 'https://example.my.salesforce.com',
            isSandbox: true,
            orgEdition: 'Enterprise Edition',
            orgId: '00D000000000001',
            username: 'user@example.com'
        };

        return createSfResult({ nonScratchOrgs: [org], sandboxes: [org], scratchOrgs: [] });
    };
}

// Salesforce CLIのJSON成功結果を子プロセスの戻り値形式で作成する。
function createSfResult(result) {
    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ status: 0, result })
    };
}

// Salesforce CLIの標準的なretrieve成功結果を子プロセスの戻り値形式で作成する。
function createRetrieveResult({
    fileProperties = [],
    inboundFiles = [],
    messages,
    status,
    success,
    topLevelWarnings = [],
    warnings = []
} = {}) {
    // 標準応答にある取得ファイル、package、warningを設定する。
    const result = { fileProperties, inboundFiles, packages: [], warnings };

    // Metadata API messageを指定した異常系だけ応答へ追加する。
    if (messages !== undefined) {
        result.messages = messages;
    }

    // 未完了状態のテストだけstatusとdoneを応答へ追加する。
    if (status !== undefined) {
        result.done = status === 'Succeeded';
        result.status = status;
    }

    // Metadata APIの明示的な成否を指定したテストだけ応答へ追加する。
    if (success !== undefined) {
        result.success = success;
    }

    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({
            status: 0,
            result,
            warnings: topLevelWarnings
        })
    };
}

// 確認済みのTarget Orgを明示したretrieve引数を作成する。
function createRetrieveArgs(manifest) {
    return [
        'project',
        'retrieve',
        'start',
        '--manifest',
        manifest,
        '--target-org',
        'test-org',
        '--wait',
        '120',
        '--json'
    ];
}

test('retrieve scriptが分割manifestを重複なくすべて含む', () => {
    // retrieve用manifestをディレクトリから取得する。
    const splitManifests = fs
        .readdirSync(path.join(repoRoot, 'manifest'))
        .filter((fileName) => fileName.startsWith('retrieve-'))
        .map((fileName) => `manifest/${fileName}`)
        .sort();

    // スクリプトのmanifest一覧に重複がないことを確認する。
    assert.equal(new Set(manifests).size, manifests.length);

    // ディレクトリ内の分割manifestがすべて定義されていることを確認する。
    assert.deepEqual([...manifests].sort(), splitManifests);

    // 定義されたmanifestがすべて存在することを確認する。
    assert.ok(manifests.every((entry) => fs.existsSync(path.join(repoRoot, entry))));
});

test('分割manifestだけから取得計画を検証して集計する', () => {
    // 現在の分割manifestとsfdx-project.jsonを実装と同じ方法で検証する。
    const manifestPlan = validateRetrieveManifestPlan();

    // manifest自体を正とし、変更のたびに固定件数を更新せず構成上の契約を確認する。
    assert.equal(manifestPlan.manifestCount, manifests.length);
    assert.ok(manifestPlan.typeCount > 0);
    assert.equal(manifestPlan.version, projectConfig.sourceApiVersion);
});

test('取得対象metadata typeがないmanifestを検出する', () => {
    // API versionだけでmetadata typeを持たないmanifest入力を作る。
    const splitSources = [
        {
            label: 'manifest/retrieve-empty.xml',
            source: `<?xml version="1.0" encoding="UTF-8" ?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><version>${projectConfig.sourceApiVersion}</version></Package>`
        }
    ];

    // 空の分割manifestをorg接続前の構成エラーとして検出する。
    assert.throws(
        () => validateManifestDefinitions(splitSources, projectConfig.sourceApiVersion),
        /retrieve-empty\.xmlに取得対象metadata typeがありません/
    );
});

test('分割manifestのAPI version差を検出する', () => {
    const mismatchedApiVersion = `${Number.parseInt(projectConfig.sourceApiVersion, 10) - 1}.0`;

    // 1件だけ異なるAPI versionを持つ分割manifest入力を作る。
    const splitSources = manifests.map((manifest) => {
        const source = fs.readFileSync(path.join(repoRoot, manifest), 'utf8');
        return {
            label: manifest,
            source:
                manifest === manifests[0]
                    ? source.replace(
                          `<version>${projectConfig.sourceApiVersion}</version>`,
                          `<version>${mismatchedApiVersion}</version>`
                      )
                    : source
        };
    });

    // 不一致のmanifestとversionを取得開始前に検出する。
    assert.throws(() => validateManifestDefinitions(splitSources, projectConfig.sourceApiVersion), {
        message: `manifest/retrieve-profile.xmlのAPI versionがsfdx-project.jsonと一致しません: ${mismatchedApiVersion} / ${projectConfig.sourceApiVersion}`
    });
});

test('retrieve成功結果からcomponent数とfile数を集計する', () => {
    // 同じApex componentのsourceとmeta XMLを含む成功応答を作る。
    const result = parseRetrieveCommandResult(
        createRetrieveResult({
            fileProperties: [
                { fullName: 'AccountService', type: 'ApexClass' },
                { fullName: 'AccountTrigger', type: 'ApexTrigger' }
            ],
            inboundFiles: [
                { state: 'Changed', fullName: 'AccountService', type: 'ApexClass', filePath: 'AccountService.cls' },
                {
                    state: 'Changed',
                    fullName: 'AccountService',
                    type: 'ApexClass',
                    filePath: 'AccountService.cls-meta.xml'
                },
                {
                    state: 'Created',
                    fullName: 'AccountTrigger',
                    type: 'ApexTrigger',
                    filePath: 'AccountTrigger.trigger'
                }
            ]
        })
    );

    // fileは3件、componentは重複をまとめた2件として成功集計する。
    assert.deepEqual(result, {
        outcome: 'success',
        warnings: [],
        attentionReasons: [],
        componentCount: 2,
        fileCount: 3,
        apiFileCount: 2,
        metadataTypeCounts: [
            { type: 'ApexClass', count: 1 },
            { type: 'ApexTrigger', count: 1 }
        ],
        status: 'Succeeded'
    });
});

test('Metadata APIの取得warningを要確認として保持する', () => {
    // Metadata APIがcomponent不足warningを返す成功statusの応答を作る。
    const result = parseRetrieveCommandResult(
        createRetrieveResult({
            warnings: [{ fileName: 'package.xml', problem: "Entity of type 'Report' named '*' cannot be found" }]
        })
    );

    // 終了コード0でも取得warningを保持し、後続を継続できる要確認結果にする。
    assert.equal(result.outcome, 'partial');
    assert.deepEqual(result.attentionReasons, ['取得warning 1件を記録しました。']);
    assert.deepEqual(result.warnings, ["package.xml: Entity of type 'Report' named '*' cannot be found"]);
});

test('Salesforce CLI自体の案内warningは成功結果のまま表示対象にする', () => {
    // CLIの更新案内などretrieve componentと無関係な最上位warningを作る。
    const result = parseRetrieveCommandResult(
        createRetrieveResult({ topLevelWarnings: ['Salesforce CLIの新しいversionを利用できます。'] })
    );

    // 案内warningだけでは取得の完全性を要確認にしない。
    assert.equal(result.outcome, 'success');
    assert.deepEqual(result.attentionReasons, []);
    assert.deepEqual(result.warnings, ['Salesforce CLIの新しいversionを利用できます。']);
});

test('Metadata APIファイル数とmetadata type別件数から10,000件上限を検出する', () => {
    // 上限ちょうどのfilePropertiesを、原因を確認できる2つのmetadata typeで作る。
    const fileProperties = Array.from({ length: metadataApiFileLimit }, (_, index) => ({
        fullName: `Component${index}`,
        type: index < 6000 ? 'CustomField' : 'Layout'
    }));
    const result = parseRetrieveCommandResult(createRetrieveResult({ fileProperties }));

    // source形式のfile数と独立してAPI上限到達を要確認にする。
    assert.equal(result.outcome, 'partial');
    assert.equal(result.apiFileCount, metadataApiFileLimit);
    assert.deepEqual(result.metadataTypeCounts, [
        { type: 'CustomField', count: 6000 },
        { type: 'Layout', count: 4000 }
    ]);
    assert.deepEqual(result.attentionReasons, [
        `Metadata APIの取得ファイル数が上限${metadataApiFileLimit.toLocaleString('ja-JP')}件に達しました。`
    ]);
});

test('未完了のretrieve jobを失敗させる', () => {
    // wait時間内に完了しなかったMetadata API応答を作る。
    const result = parseRetrieveCommandResult(createRetrieveResult({ status: 'InProgress', success: true }));

    // 自動retryせず未完了statusを呼び出し元へ返す。
    assert.equal(result.outcome, 'failure');
    assert.match(result.error, /Metadata API retrieveが完了していません: InProgress/);
});

test('Salesforce CLIの非0終了を失敗させる', () => {
    // Salesforce CLIがJSON形式でretrieve失敗理由を返す応答を作る。
    const result = parseRetrieveCommandResult({
        status: 1,
        stderr: '',
        stdout: JSON.stringify({ status: 1, message: 'Retrieve request failed.', warnings: [] })
    });

    // CLIの失敗理由を保持し、後続manifestを実行できない結果にする。
    assert.equal(result.outcome, 'failure');
    assert.equal(result.error, 'Retrieve request failed.');
    assert.deepEqual(result.warnings, []);
});

test('解析できないretrieve応答を失敗させる', () => {
    // Salesforce CLIがJSON以外の標準出力を返す異常応答を作る。
    const result = parseRetrieveCommandResult({ status: 0, stderr: '', stdout: 'not-json' });

    // 出力から成功を推測せず、解析エラーとして停止する。
    assert.equal(result.outcome, 'failure');
    assert.match(result.error, /Salesforce CLIのJSONを解析できませんでした/);
    assert.deepEqual(result.warnings, []);
});

test('取得ファイル一覧がない未知の成功応答を失敗させる', () => {
    // statusだけ成功でresult構造を確認できない応答を作る。
    const result = parseRetrieveCommandResult({
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ status: 0, result: {} })
    });

    // 0件取得と推測せず、未知の応答形式として停止する。
    assert.equal(result.outcome, 'failure');
    assert.match(result.error, /retrieveファイル結果を確認できませんでした/);
    assert.deepEqual(result.warnings, []);
});

test('retrieve JSONの出力上限超過を失敗させる', () => {
    // spawnSyncが出力上限を超えた場合のエラーを作る。
    const result = parseRetrieveCommandResult({
        error: Object.assign(new Error('output too large'), { code: 'ENOBUFS' })
    });

    // 上限値を示して大量出力を成功扱いしない。
    assert.equal(result.outcome, 'failure');
    assert.match(result.error, new RegExp(`${retrieveOutputMaxBuffer / 1024 / 1024}MB上限`));
});

test('retrieveを非同期実行しJSON出力上限を指定する', async () => {
    // execFileへ渡す安全なコマンドと実行設定を記録する。
    let execution;
    const result = await runRetrieveWithOutput(
        ['project', 'retrieve', 'start', '--json'],
        repoRoot,
        (command, args, options, callback) => {
            execution = { command, args, options };
            callback(null, '{"status":0}', '');
        }
    );

    // shellを介さず64MB上限を持つ非同期実行結果をspawnSync互換形式で返す。
    assert.equal(execution.command, process.platform === 'win32' ? 'cmd.exe' : 'sf');
    assert.equal(execution.options.cwd, repoRoot);
    assert.equal(execution.options.maxBuffer, retrieveOutputMaxBuffer);
    assert.deepEqual(result, { error: undefined, status: 0, stdout: '{"status":0}', stderr: '' });
});

test('retrieve scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    // 未知の引数を指定してretrieveスクリプトを実行する。
    const result = spawnSync(process.execPath, ['scripts/metadata/retrieve/retrieve.js', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    // 組織へ接続せず、異常終了することを確認する。
    assert.equal(result.status, 1);

    // エラー理由と正しい実行コマンドが表示されることを確認する。
    assert.match(result.stderr, /エラー: このスクリプトは引数を受け付けません。/);
    assert.match(result.stderr, /実行コマンド: npm run sf:retrieve/);
});

test('取得が承認されない場合は組織情報の確認後にretrieveしない', async () => {
    // retrieveを承認せず、retrieve用Salesforce CLIの実行回数を記録する。
    const commandArgs = [];
    const prompt = createPrompt('n');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runRetrieveCommand(args) {
            commandArgs.push(args);
            return createRetrieveResult();
        },
        runSfWithOutputCommand: createOrgInfoCommand()
    });

    // 接続組織の表示後に終了し、retrieveを実行せず確認入力を閉じることを確認する。
    assert.equal(status, 0);
    assert.deepEqual(commandArgs, []);
    assert.equal(prompt.isClosed(), true);
});

test('Default Target Orgを確認できない場合は入力確認を開始しない', async () => {
    // 組織設定の確認を失敗させ、入力処理の作成回数を記録する。
    let promptCount = 0;
    await assert.rejects(
        () =>
            main({
                argv: [],
                createPrompt() {
                    promptCount += 1;
                },
                runSfWithOutputCommand() {
                    return { status: 1, stderr: '', stdout: '' };
                }
            }),
        /Default Target Orgの取得に失敗しました/
    );

    // 組織が確定していない状態ではretrieveの確認を表示しない。
    assert.equal(promptCount, 0);
});

test('承認された場合はすべてのmanifestを同じTarget Orgから定義順に取得する', async () => {
    // retrieveを承認し、実行されたSalesforce CLI引数を記録する。
    const commandArgs = [];
    const prompt = createPrompt('y');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runRetrieveCommand(args) {
            commandArgs.push(args);
            return createRetrieveResult();
        },
        runSfWithOutputCommand: createOrgInfoCommand()
    });

    // 確認済みのTarget Orgを明示し、すべてのmanifestが定義順に取得されることを確認する。
    assert.equal(status, 0);
    assert.deepEqual(commandArgs, manifests.map(createRetrieveArgs));
    assert.equal(prompt.isClosed(), true);
});

test('manifestの定義順に取得し、warningがあっても後続をすべて実行する', async () => {
    // retrieveを承認し、2つ目のmanifest取得にwarningを返す。
    const commandArgs = [];
    const prompt = createPrompt('y');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runRetrieveCommand(args) {
            commandArgs.push(args);
            return commandArgs.length === 2
                ? createRetrieveResult({ messages: [{ problem: '取得対象を確認できませんでした。' }] })
                : createRetrieveResult();
        },
        runSfWithOutputCommand: createOrgInfoCommand()
    });

    // warningを最終的な要確認結果にしつつ、全manifestを定義順に実行する。
    assert.equal(status, 1);
    assert.deepEqual(commandArgs, manifests.map(createRetrieveArgs));
    assert.equal(prompt.isClosed(), true);
});

test('Salesforce CLIのhard failureでは後続manifestを実行しない', async () => {
    // 2つ目のmanifestだけ非0終了にして実行範囲を記録する。
    const commandArgs = [];
    const prompt = createPrompt('y');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runRetrieveCommand(args) {
            commandArgs.push(args);
            return commandArgs.length === 2
                ? {
                      status: 1,
                      stderr: '',
                      stdout: JSON.stringify({ status: 1, message: 'Retrieve request failed.', warnings: [] })
                  }
                : createRetrieveResult();
        },
        runSfWithOutputCommand: createOrgInfoCommand()
    });

    // CLI失敗はwarningと区別し、発生したmanifestで停止する。
    assert.equal(status, 1);
    assert.equal(commandArgs.length, 2);
    assert.deepEqual(commandArgs[1], createRetrieveArgs(manifests[1]));
    assert.equal(prompt.isClosed(), true);
});

test('長時間retrieve中は30秒ごとに経過時間とローカル日時を表示する', async () => {
    // 実タイマーを待たずに最初のmanifestだけ30秒経過を再現する。
    const prompt = createPrompt('y');
    const logs = [];
    const originalConsoleLog = console.log;
    const startedAt = new Date(2026, 7, 31, 17, 25, 50).getTime();
    let currentTime = startedAt;
    let progressCallback;
    let retrieveCount = 0;
    let clearedTimerCount = 0;

    // テスト中の進捗表示と完了表示を記録する。
    console.log = (message) => logs.push(message);

    try {
        const status = await main({
            argv: [],
            clearIntervalCommand() {
                clearedTimerCount += 1;
            },
            createPrompt: () => prompt.prompt,
            now: () => currentTime,
            runRetrieveCommand() {
                retrieveCount += 1;

                if (retrieveCount === 1) {
                    currentTime = startedAt + retrieveProgressIntervalMilliseconds;
                    progressCallback();
                    currentTime = startedAt + 332500;
                }

                return createRetrieveResult();
            },
            runSfWithOutputCommand: createOrgInfoCommand(),
            setIntervalCommand(callback, intervalMilliseconds) {
                assert.equal(intervalMilliseconds, retrieveProgressIntervalMilliseconds);
                progressCallback = callback;
                return { unref() {} };
            }
        });

        // 332.5秒の処理中にも30秒時点の生存表示があり、全タイマーを解除する。
        assert.equal(status, 0);
        assert.ok(logs.includes('・実行中: 30.0秒経過｜2026/08/31 17:26:20'));
        assert.ok(logs.includes('・所要時間: 332.5秒'));
        assert.equal(clearedTimerCount, manifests.length);
    } finally {
        // 他テストの出力へ影響を残さない。
        console.log = originalConsoleLog;
    }
});
