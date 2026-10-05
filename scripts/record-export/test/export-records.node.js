const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { collectRecords: collectCore, validateDescribe, parseFields, toCsv } = require('../internal/collector');
const { main: runMain, parseOptions, callSf, buildResumeCommand } = require('../internal/export-runner');
const field = (name, extra = {}) => ({ name, label: name, type: 'string', filterable: true, ...extra });
const describe = (...fields) => ({
    name: 'Account',
    urls: { sobject: '/services/data/v67.0/sobjects/Account' },
    queryable: true,
    recordTypeInfos: [{ recordTypeId, name: 'Demo', available: false }],
    fields: [
        field('Id', { sortable: true }),
        field('CreatedDate', { sortable: true, type: 'datetime' }),
        field('IsPersonAccount', { type: 'boolean' }),
        field('RecordTypeId'),
        ...fields
    ]
});
const response = (records) => ({ records, totalSize: records.length, done: true });
const cli = (result) => ({ status: 0, stdout: JSON.stringify({ status: 0, result }) });
const quiet = () => {};
const approve = () => ({ question: async () => 'y', close: () => {} });
const id = (n) => '001' + String(n).padStart(15, '0');
const newest = { Id: id(3), CreatedDate: '2026-01-03T00:00:00.000+0000' };
const older = { Id: id(2), CreatedDate: '2026-01-02T00:00:00.000+0000' };
const recordTypeId = '012000000000001AAA';
const options = { mode: 'records', recordLimit: 2, fieldsPerQuery: 100 };
const orgList = (production = false) => ({
    nonScratchOrgs: [
        {
            alias: 'example-org',
            username: 'user@example.com',
            instanceUrl: 'https://example.my.salesforce.com',
            orgId: 'example-org-id',
            isSandbox: false,
            orgEdition: production ? 'Enterprise Edition' : 'Developer Edition'
        }
    ],
    sandboxes: [],
    scratchOrgs: []
});
function temporary(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'record-export-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

// 収集テストでは各SOQLの応答を保ち、Compositeの送受信は別途検証する。
async function collectValidatedRecords(definition, fields, settings, query, ...rest) {
    query.batch ??= async (soqls, controls) => {
        const results = [];
        for (const soql of soqls) {
            try {
                results.push({ result: await query(soql, controls) });
            } catch (error) {
                results.push({ error });
            }
        }
        return results;
    };
    return collectCore(definition, fields, settings, query, ...rest);
}

// 実行入口と同じく定義を検証してから、収集処理へ正規化した項目を渡す。
async function collectRecords(definition, names, settings, query, writeLine) {
    const fields = validateDescribe(definition, names, settings);
    return collectValidatedRecords(definition, fields, settings, query, writeLine);
}

// 既存のSOQL応答fixtureをCompositeのファイル応答へ変換する。
async function main(args, dependencies) {
    const runner = dependencies.runner;
    // 各テストの入力は一時ディレクトリ内の明示ファイルに隔離する。
    const inputArgs = args.includes('--fields') ? args : ['--fields', 'fields.txt', ...args];
    return runMain(inputArgs, {
        ...dependencies,
        runner: async (command, ...rest) => {
            if (command[0] !== 'api') return runner(command, ...rest);
            const requestFile = command[command.indexOf('--body') + 1].slice(1);
            const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
            const compositeResponse = [];
            for (const part of request.compositeRequest) {
                const query = decodeURIComponent(part.url.split('?q=')[1]);
                const file = path.join(path.dirname(requestFile), 'fixture.soql');
                fs.writeFileSync(file, query);
                const reply = await runner(['data', 'query', '--file', file], ...rest);
                if (reply.status !== 0 || reply.error) return reply;
                compositeResponse.push({
                    referenceId: part.referenceId,
                    httpStatusCode: 200,
                    body: JSON.parse(reply.stdout).result
                });
            }
            return cli({ statusCode: 200, body: { compositeResponse } });
        }
    });
}

test('BOM・CRLF・コメント・大小文字の重複を除き入力順を保持する', () => {
    assert.deepEqual(parseFields('\uFEFFName\r\n# comment\r\n\r\nPersonEmail\r\nname\r\nCustom__pc'), [
        'Name',
        'PersonEmail',
        'Custom__pc'
    ]);
    for (const input of ['', '# comment', 'Owner.Name', 'Name FROM Account', 'Name,Id']) {
        assert.throws(() => parseFields(input));
    }
});

test('既定の項目設定はスクリプト配下を使い、別ファイルの明示指定も保持する', () => {
    for (const mode of ['records', 'record-fields-preview']) {
        const options = parseOptions([], mode);
        assert.equal(options.fields, path.resolve(__dirname, '../config/fields.txt'));
        assert.equal(parseOptions(['--fields', 'custom-fields.txt'], mode).fields, 'custom-fields.txt');
    }
});

test('未知の引数、SOQL式、不正な件数をCLI起動前に拒否する', () => {
    for (const args of [
        ['--oops'],
        ['--person-accounts'],
        ['--object', 'Account WHERE'],
        ['--record-limit', '0'],
        ['--fields-per-query', '10001'],
        ['--record-limit', '1e3'],
        ['stage']
    ]) {
        assert.throws(() => parseOptions(args));
    }
});

test('入力ファイルの未検出・ディレクトリ指定はCLI起動前に対処を案内する', async (t) => {
    const cwd = temporary(t);
    const dependencies = { cwd, runner: () => assert.fail('must not call CLI'), writeLine: quiet };
    await assert.rejects(() => main([], dependencies), /項目ファイルが見つかりません.*--fields/);
    await assert.rejects(() => main(['--fields', '.'], dependencies), /ディレクトリ.*テキストファイル/);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), '');
    await assert.rejects(() => main([], dependencies), /1行1項目/);
    await assert.rejects(() => main(['--fields', 'fields.txt/child.txt'], dependencies), /パスが不正/);
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt']);
});

test('入力ファイルの権限・未知の読み取り障害でも生のOSエラーを表示しない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    for (const [code, expected] of [
        ['EACCES', /読み取る権限がありません/],
        ['EPERM', /アクセスが許可されていません/],
        ['EIO', /読み込めませんでした/]
    ]) {
        const mock = t.mock.method(fs, 'readFileSync', () => {
            throw Object.assign(new Error('sensitive-value'), { code });
        });
        try {
            await assert.rejects(
                () => main([], { cwd, runner: () => assert.fail('must not call CLI'), writeLine: quiet }),
                (error) => expected.test(error.message) && !error.message.includes('sensitive-value')
            );
        } finally {
            mock.mock.restore();
        }
    }
});

test('組織設定・一覧取得の段階でもCLIの原因別診断で停止する', async (t) => {
    const cwd = temporary(t);
    for (const args of [['--check-auth'], ['--check-auth', '--target-org', 'example-org']]) {
        const commands = [];
        await assert.rejects(
            () =>
                main(args, {
                    cwd,
                    runner: (command) => {
                        commands.push(command);
                        return { status: null, error: { code: 'ENOENT', message: 'sensitive-value' } };
                    },
                    writeLine: quiet,
                    createPrompt: () => assert.fail('must not prompt')
                }),
            (error) => error.code === 'CLI_NOT_FOUND' && !error.message.includes('sensitive-value')
        );
        assert.equal(commands.length, 1);
        assert.equal(commands[0][0], args.length === 1 ? 'config' : 'org');
    }
    assert.deepEqual(fs.readdirSync(cwd), []);
});

test('認証確認専用は組織情報を表示し、確認入力なしでDescribeだけを取得する', async (t) => {
    const cwd = temporary(t);
    const commands = [];
    const runner = (args) => {
        commands.push(args);
        if (args[0] === 'org') return cli(orgList());
        return args[0] === 'config'
            ? cli([{ name: 'target-org', value: 'example-org', success: true }])
            : cli(describe(field('Name')));
    };
    const messages = [];
    assert.equal(
        await main(['--check-auth'], {
            cwd,
            runner,
            writeLine: (line) => messages.push(line),
            createPrompt: () => assert.fail('no prompt')
        }),
        0
    );
    for (const value of ['example-org', 'user@example.com', 'https://example.my.salesforce.com', 'Developer Edition'])
        assert.ok(messages.some((line) => line.includes(value)));
    assert.deepEqual(commands[2], [
        'sobject',
        'describe',
        '--sobject',
        'Account',
        '--target-org',
        'user@example.com',
        '--json'
    ]);
    assert.equal(commands.length, 3);
    assert.deepEqual(fs.readdirSync(cwd), []);
});

test('認証失敗では出力を作成せず機密のCLI本文も表示しない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    await assert.rejects(
        () =>
            main(['--target-org', 'example-org'], {
                cwd,
                writeLine: quiet,
                createPrompt: approve,
                runner: (args) =>
                    args[0] === 'org'
                        ? cli(orgList())
                        : {
                              status: 1,
                              stdout: JSON.stringify({
                                  status: 1,
                                  name: 'INVALID_SESSION_ID',
                                  message: 'sensitive-value'
                              })
                          }
            }),
        (error) => error.code === 'AUTH_FAILED' && !error.message.includes('sensitive-value')
    );
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt']);
});

test('NULLのCLI応答は機密情報を含まない全体失敗にする', async () => {
    await assert.rejects(() => callSf([], '.', () => ({ status: 0, stdout: 'null' })), /CLI_FAILED/);
});

test('組織が特定できない場合は確認入力も検索も開始しない', async (t) => {
    const cwd = temporary(t);
    await assert.rejects(
        () =>
            main(['--target-org', 'unknown', '--check-auth'], {
                cwd,
                runner: () => cli(orgList()),
                writeLine: quiet,
                createPrompt: () => assert.fail('no prompt')
            }),
        /一意に特定/
    );
});

test('確認入力の例外でもpromptを閉じ、取得を開始しない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    let closed = false;
    await assert.rejects(
        () =>
            main(['--target-org', 'example-org'], {
                cwd,
                runner: (args) => {
                    assert.equal(args[0], 'org');
                    return cli(orgList());
                },
                writeLine: quiet,
                createPrompt: () => ({
                    question: async () => {
                        throw new Error('input closed');
                    },
                    close: () => {
                        closed = true;
                    }
                })
            }),
        /input closed/
    );
    assert.equal(closed, true);
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt']);
});

test('縦型は1件固定・横型は既定2000件で明示指定を受け付ける', () => {
    assert.equal(parseOptions([], 'record-fields-preview').recordLimit, 1);
    assert.equal(parseOptions([]).recordLimit, 2000);
    assert.equal(parseOptions(['--record-limit', '200']).recordLimit, 200);
    assert.throws(() => parseOptions(['--record-limit', '2'], 'record-fields-preview'));
    assert.throws(() => parseOptions(['--record-limit', '10001']));
});

test('横型はIDで分割結果を照合し指定列順・最新順・空欄・false・0を維持し補完しない', async () => {
    const queries = [];
    const result = await collectRecords(
        describe(field('Name'), field('Flag'), field('Count')),
        ['Name', 'Count', 'Id', 'Flag'],
        { ...options, fieldsPerQuery: 2 },
        async (query) => {
            queries.push(query);
            if (queries.length === 1) return response([newest, older]);
            if (queries.length === 2)
                return response([
                    { Id: older.Id, Name: 'old', Count: 5 },
                    { Id: newest.Id, Name: null, Count: 0 }
                ]);
            return response([
                { Id: older.Id, Flag: true },
                { Id: newest.Id, Flag: false }
            ]);
        },
        quiet
    );
    assert.equal(queries.length, 3);
    assert.match(queries[0], /ORDER BY CreatedDate DESC NULLS LAST, Id DESC LIMIT 2$/);
    assert.ok(queries.slice(1).every((q) => q.includes(`Id IN ('${newest.Id}','${older.Id}')`)));
    assert.equal(
        toCsv(result, 'records'),
        `"Name","Count","Id","Flag"\r\n"","0","${newest.Id}","false"\r\n"old","5","${older.Id}","true"\r\n`
    );
});

test('縦型は空欄だけを非NULLの最新1件で補完し日時境界を付けず実値は維持する', async () => {
    const queries = [];
    const result = await collectRecords(
        describe(field('Name'), field('Empty'), field('Flag'), field('Count')),
        ['Empty', 'Name', 'Flag', 'Count'],
        { ...options, mode: 'record-fields-preview' },
        async (query) => {
            queries.push(query);
            if (queries.length === 1) return response([newest]);
            if (queries.length === 2)
                return response([{ Id: newest.Id, Name: 'latest', Empty: null, Flag: false, Count: 0 }]);
            return response([{ Id: older.Id, Empty: 'filled' }]);
        },
        quiet
    );
    assert.match(queries[0], /LIMIT 1$/);
    assert.equal(
        queries[2],
        'SELECT Id,Empty FROM Account WHERE Empty != NULL ORDER BY CreatedDate DESC NULLS LAST, Id DESC LIMIT 1'
    );
    assert.equal(queries.length, 3);
    assert.equal(result.records[0].Name, 'latest');
    const csv = toCsv(result, 'record-fields-preview');
    assert.match(csv.split('\r\n')[1], /^"Empty","Empty","string","filled","SUPPLEMENTED"/);
    assert.ok(csv.includes(`"${older.Id}"`));
    assert.match(csv, /"Flag","Flag","string","false","LATEST"/);
    assert.match(csv, /"Count","Count","string","0","LATEST"/);
});

test('検索不可の空欄は追加検索せず、検索した値なしと区別する', async () => {
    const queries = [],
        messages = [];
    const replies = [
        response([newest]),
        response([{ Id: newest.Id, Long: null, Empty: null, Present: 'keep' }]),
        response([])
    ];
    const result = await collectRecords(
        describe(field('Long', { filterable: false }), field('Empty'), field('Present', { filterable: false })),
        ['Long', 'Empty', 'Present'],
        { ...options, mode: 'record-fields-preview' },
        async (query) => {
            queries.push(query);
            assert.ok(replies.length);
            return replies.shift();
        },
        (message) => messages.push(message)
    );
    assert.equal(queries.length, 3);
    assert.equal(result.records[0].Long, null);
    assert.equal(result.records[0].Present, 'keep');
    assert.match(queries[2], /WHERE Empty != NULL ORDER BY/);
    assert.match(toCsv(result, 'record-fields-preview'), /"Long","Long","string","","NOT_FILTERABLE",""/);
    assert.match(toCsv(result, 'record-fields-preview'), /"Empty","Empty","string","","NO_VALUE_FOUND",""/);
    assert.match(toCsv(result, 'record-fields-preview'), /"Present","Present","string","keep","LATEST"/);
    assert.ok(messages.some((message) => message.includes('非NULL条件で検索不可')));
});

test('対象なしではヘッダーのみで補完検索をしない', async () => {
    for (const mode of ['records', 'record-fields-preview']) {
        let count = 0;
        const result = await collectRecords(
            describe(field('Name')),
            ['Name'],
            { ...options, mode },
            async () => {
                count++;
                return response([]);
            },
            quiet
        );
        assert.equal(count, 1);
        assert.equal(toCsv(result, mode).split('\r\n').length, 2);
    }
});

test('最新順不可・レコードタイプ不一致は検索前に停止する', async () => {
    const noQuery = () => assert.fail('must not query');
    await assert.rejects(
        () => collectRecords({ ...describe(), fields: [field('Id', { sortable: true })] }, ['Id'], options, noQuery),
        /CreatedDate/
    );
    await assert.rejects(
        () => collectRecords({ ...describe(), recordTypeInfos: [] }, ['Id'], { ...options, recordTypeId }, noQuery),
        /レコードタイプID/
    );
});

test('分割取得中の欠落・重複・別ID・不完全な応答は停止する', async () => {
    for (const invalid of [
        response([]),
        response([{ Id: older.Id, Name: 'wrong' }]),
        response([
            { Id: newest.Id, Name: 'a' },
            { Id: newest.Id, Name: 'b' }
        ]),
        response([{ Id: newest.Id }]),
        { records: [], done: false }
    ]) {
        let count = 0;
        await assert.rejects(() =>
            collectRecords(
                describe(field('Name')),
                ['Name'],
                options,
                async () => (++count === 1 ? response([newest]) : invalid),
                quiet
            )
        );
    }
});

test('CSVの引用符・改行・複合値を両形式で保持する', () => {
    const result = {
        fields: [field('Name'), field('Address')],
        records: [{ Name: 'a,"b"\r\nc', Address: { city: 'x' } }],
        sources: new Map([
            ['Name', newest.Id],
            ['Address', newest.Id]
        ]),
        latestId: newest.Id
    };
    for (const mode of ['records', 'record-fields-preview']) {
        const csv = toCsv(result, mode);
        assert.match(csv, /"a,""b""\r\nc"/);
        assert.match(csv, /"\{""city"":""x""\}"/);
    }
});

test('201件でも固定200件分割せず元の順で出力する', async () => {
    const selected = Array.from({ length: 201 }, (_, i) => ({ Id: id(i + 1), CreatedDate: newest.CreatedDate }));
    let calls = 0;
    const result = await collectRecords(
        describe(field('Name')),
        ['Name'],
        { ...options, recordLimit: 201 },
        async (query) => {
            calls++;
            if (calls === 1) return response(selected);
            return response(
                [...query.matchAll(/'(001\d{15})'/g)].map((match) => ({ Id: match[1], Name: match[1] })).reverse()
            );
        },
        quiet
    );
    assert.equal(calls, 2);
    assert.deepEqual(
        result.records.map((r) => r.Name),
        selected.map((r) => r.Id)
    );
});

function runnerFor(records = [{ ...newest, Name: 'latest', Custom__pc: null }]) {
    return async (args) => {
        if (args[0] === 'config') return cli([{ name: 'target-org', value: 'example-org', success: true }]);
        if (args[0] === 'org') return cli(orgList());
        if (args[0] === 'sobject') return cli(describe(field('Name'), field('Custom__pc')));
        const query = fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8');
        if (query.includes(' != NULL')) return cli(response([]));
        if (query.startsWith('SELECT Id,CreatedDate'))
            return cli(response(records.map(({ Id, CreatedDate }) => ({ Id, CreatedDate }))));
        return cli(response(records));
    };
}

test('両形式の確認前メッセージで補完の有無を明示し指定形式のCSVを保存する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Custom__pc\nName');
    for (const mode of ['records', 'record-fields-preview']) {
        const messages = [];
        const queries = [];
        const runner = runnerFor();
        const output = `${mode}.csv`;
        const code = await main(['--output', output], {
            cwd,
            mode,
            writeLine: (line) => messages.push(line),
            runner: async (args) => {
                if (args[0] === 'data') queries.push(fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8'));
                return runner(args);
            },
            createPrompt: () => ({
                question: async () => {
                    assert.ok(
                        messages.some((line) => line.includes(mode === 'records' ? '補完なし' : '可能な空欄を補完'))
                    );
                    assert.equal(messages[messages.findIndex((line) => line.startsWith('対象:')) - 1], '');
                    assert.equal(messages[messages.findIndex((line) => line.startsWith('出力先:')) + 1], '');
                    assert.ok(messages.includes('項目ファイル: fields.txt / 指定項目数: 2'));
                    assert.ok(messages.includes(`出力先: ${output}`));
                    return 'y';
                },
                close() {}
            })
        });
        assert.equal(code, 0);
        assert.ok(queries.every((q) => !q.includes('IsPersonAccount') && !q.includes('RecordTypeId =')));
        assert.equal(queries.length, mode === 'records' ? 2 : 3);
        assert.ok(messages.includes(`出力: ${output}`));
        assert.ok(messages.every((line) => !line.includes(cwd)));
        const csv = fs.readFileSync(path.join(cwd, output), 'utf8');
        assert.ok(
            csv.startsWith(
                mode === 'records'
                    ? '"Custom__pc","Name"'
                    : 'FieldApiName,Label,Type,Value,Status,SourceRecordId\r\n"Custom__pc"'
            )
        );
        await assert.rejects(
            () => main(['--output', output], { cwd, mode, runner: () => assert.fail('no overwrite') }),
            /既に存在/
        );
    }
});

test('否認と本番の追加確認では検索・保存せず入力を閉じる', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    for (const production of [false, true]) {
        let questions = 0;
        let closed = false;
        const code = await main(['--target-org', 'example-org'], {
            cwd,
            writeLine: quiet,
            runner: async (args) => {
                assert.equal(args[0], 'org');
                return cli(orgList(production));
            },
            createPrompt: () => ({
                question: async () => (++questions === 1 && production ? 'y' : 'n'),
                close: () => {
                    closed = true;
                }
            })
        });
        assert.equal(code, 0);
        assert.equal(questions, production ? 2 : 1);
        assert.ok(closed);
        assert.deepEqual(fs.readdirSync(cwd), ['fields.txt']);
    }
});

test('CLIの応答待ち中に定期メッセージ用タイマーを起動しない', async (t) => {
    const cwd = temporary(t);
    const messages = [];
    t.mock.method(global, 'setInterval', () => assert.fail('定期表示タイマーは不要'));
    assert.equal(
        await main(['--check-auth'], {
            cwd,
            writeLine: (line) => messages.push(line),
            runner: async (args) => {
                await new Promise((resolve) => setImmediate(resolve));
                return runnerFor()(args);
            }
        }),
        0
    );
    assert.ok(messages.every((line) => !line.includes('・実行中:')));
});

test('CLI障害の固定診断は生の本文を漏らさない', async () => {
    for (const [error, code] of [
        [{ code: 'ENOENT' }, 'CLI_NOT_FOUND'],
        [{ code: 'ETIMEDOUT' }, 'NETWORK_TIMEOUT'],
        [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, 'BUFFER_LIMIT'],
        [{ killed: true, signal: 'SIGTERM' }, 'CLI_TIMEOUT']
    ]) {
        await assert.rejects(
            () => callSf([], '.', async () => ({ status: null, error, stdout: 'sensitive' })),
            (e) => e.code === code && !e.message.includes('sensitive')
        );
    }
    await assert.rejects(
        () =>
            callSf([], '.', async () => ({
                status: 1,
                stdout: JSON.stringify({ name: 'INVALID_FIELD', message: 'sensitive' })
            })),
        (e) => e.code === 'INVALID_FIELD' && !e.message.includes('sensitive')
    );
});

test('サイズ超過時は両コマンドの各CLI段階で利用可能な引数だけを案内する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    for (const mode of ['records', 'record-fields-preview']) {
        for (const phase of ['config', 'org', 'sobject', 'data']) {
            const runner = runnerFor();
            await assert.rejects(
                () =>
                    main([], {
                        cwd,
                        mode,
                        writeLine: quiet,
                        createPrompt: approve,
                        runner: async (args) =>
                            args[0] === phase
                                ? { status: null, error: { code: 'ENOBUFS' }, stdout: 'sensitive' }
                                : runner(args)
                    }),
                (error) => {
                    assert.equal(error.code, 'BUFFER_LIMIT');
                    assert.match(error.message, /--fields-per-query/);
                    assert.equal(error.message.includes('--record-limit'), mode === 'records');
                    assert.ok(!error.message.includes('sensitive'));
                    return true;
                }
            );
            const outputs = fs.existsSync(path.join(cwd, 'export-out'))
                ? fs.readdirSync(path.join(cwd, 'export-out'))
                : [];
            assert.ok(outputs.every((name) => name.endsWith('.partial.csv') || name.endsWith('.csv.resume')));
        }
    }
});

test('filterableな住所・位置情報の複合項目でも非NULL補完せず構成項目は補完する', async () => {
    const replies = [
        response([newest]),
        response([{ Id: newest.Id, Address: { city: null }, Location: null, City: null }]),
        response([{ Id: older.Id, City: 'Demo' }])
    ];
    const queries = [];
    const result = await collectRecords(
        describe(
            field('Address', { type: 'address' }),
            field('Location', { type: 'location' }),
            field('City', { compoundFieldName: 'Address' })
        ),
        ['Address', 'Location', 'City'],
        { ...options, mode: 'record-fields-preview' },
        async (query) => {
            queries.push(query);
            assert.ok(replies.length);
            return replies.shift();
        },
        quiet
    );
    assert.equal(queries.length, 3);
    assert.match(queries[2], /WHERE City != NULL ORDER BY/);
    const csv = toCsv(result, 'record-fields-preview');
    assert.equal((csv.match(/NOT_FILTERABLE/g) || []).length, 2);
    assert.match(csv, /"City","City","string","Demo","SUPPLEMENTED"/);
});

test('両方の実行入口が承認・否認・EOFを処理し指定形式で出力する', (t) => {
    const { spawnSync } = require('node:child_process');
    const cwd = temporary(t);
    const bootstrap = path.join(cwd, 'mock.cjs');
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    fs.writeFileSync(
        bootstrap,
        `require(${JSON.stringify(require.resolve('../../common/run-command'))}).runSfWithOutputAsync = async (args) => {
        let result = args[0] === 'org' ? ${JSON.stringify(orgList())} : args[0] === 'sobject' ? ${JSON.stringify(describe(field('Name')))} : ${JSON.stringify(response([{ ...newest, Name: 'fixture' }]))};
        if(args[0] === 'api') {
            result = {statusCode:200, body:{compositeResponse:[{referenceId:'records',httpStatusCode:200,body:result}]}};
        }
        return { status: 0, stdout: JSON.stringify({ status: 0, result }) };
    };`
    );
    for (const [mode, script] of [
        ['record-fields-preview', 'export-record-fields-preview'],
        ['records', 'export-latest-records']
    ]) {
        for (const [label, input, exitCode] of [
            ['yes', 'y\n', 0],
            ['no', 'n\n', 0],
            ['eof', '', 1]
        ]) {
            const output = path.join(cwd, `${mode}-${label}.csv`);
            const result = spawnSync(
                process.execPath,
                [
                    '--require',
                    bootstrap,
                    require.resolve(`../${script}`),
                    '--target-org',
                    'example-org',
                    '--fields',
                    path.join(cwd, 'fields.txt'),
                    '--output',
                    output
                ],
                { cwd, input, encoding: 'utf8', timeout: 10000 }
            );
            assert.equal(result.status, exitCode, result.stderr);
            assert.equal(fs.existsSync(output), label === 'yes');
            assert.match(result.stdout, mode === 'records' ? /補完なし/ : /可能な空欄を補完/);
            if (label === 'yes')
                assert.ok(
                    fs
                        .readFileSync(output, 'utf8')
                        .startsWith(
                            mode === 'records'
                                ? '"Name"\r\n'
                                : 'FieldApiName,Label,Type,Value,Status,SourceRecordId\r\n'
                        )
                );
        }
    }
});

test('レコードタイプIDは両コマンドで15桁・18桁を受け付け形式不正を拒否する', () => {
    for (const mode of ['records', 'record-fields-preview']) {
        for (const value of [recordTypeId, recordTypeId.slice(0, 15)]) {
            assert.equal(parseOptions(['--record-type-id', value], mode).recordTypeId, value);
        }
        for (const value of [
            '',
            'not-an-id',
            '001000000000001AAA',
            "012000000000001' OR Name != NULL",
            '01200000000000'
        ]) {
            assert.throws(() => parseOptions(['--record-type-id', value], mode), /record-type-id/);
        }
    }
});

test('対象オブジェクトにないレコードタイプと非対応項目では検索前に停止する', async () => {
    const noQuery = () => assert.fail('no query');
    for (const data of [
        { ...describe(), recordTypeInfos: [] },
        { ...describe(), recordTypeInfos: undefined },
        { ...describe(), fields: describe().fields.filter((f) => f.name !== 'RecordTypeId') },
        {
            ...describe(),
            fields: describe().fields.map((f) => (f.name === 'RecordTypeId' ? { ...f, filterable: false } : f))
        }
    ])
        await assert.rejects(
            () => collectRecords(data, ['Id'], { ...options, recordTypeId }, noQuery),
            /RecordTypeId|レコードタイプID/
        );
    await assert.rejects(
        () => collectRecords(describe(), ['Id'], { ...options, recordTypeId: '012000000000002AAA' }, noQuery),
        /Describe/
    );
    await assert.rejects(
        () => collectRecords(describe(), ['Id'], { ...options, recordTypeId: '012000000000001BBB' }, noQuery),
        /Describe/
    );
});

test('レコードタイプ条件はID選択・値取得・非NULL補完へすべて適用する', async () => {
    const queries = [];
    const replies = [
        response([newest]),
        response([{ Id: newest.Id, Name: null, Long: null }]),
        response([{ Id: older.Id, Name: 'filled' }])
    ];
    const result = await collectRecords(
        describe(field('Name'), field('Long', { filterable: false })),
        ['Name', 'Long'],
        { ...options, mode: 'record-fields-preview', recordTypeId: recordTypeId.slice(0, 15) },
        async (query) => {
            queries.push(query);
            return replies.shift();
        },
        quiet
    );
    assert.equal(queries.length, 3);
    assert.equal(
        queries[2],
        `SELECT Id,Name FROM Account WHERE RecordTypeId = '${recordTypeId.slice(0, 15)}' AND Name != NULL ORDER BY CreatedDate DESC NULLS LAST, Id DESC LIMIT 1`
    );
    assert.ok(queries.every((query) => query.includes(`RecordTypeId = '${recordTypeId.slice(0, 15)}'`)));
    assert.ok(queries.every((query) => !query.includes('IsPersonAccount')));
    assert.equal(result.records[0].Name, 'filled');
    assert.equal(result.records[0].Long, null);
});

test('__pc項目だけでは個人取引先へ限定せずIsPersonAccountなしでも取得できる', async () => {
    const data = {
        ...describe(field('Custom__pc')),
        fields: describe(field('Custom__pc')).fields.filter((f) => f.name !== 'IsPersonAccount')
    };
    const queries = [];
    await collectRecords(
        data,
        ['Custom__pc'],
        options,
        async (query) => {
            queries.push(query);
            return response(queries.length === 1 ? [newest] : [{ Id: newest.Id, Custom__pc: null }]);
        },
        quiet
    );
    assert.ok(queries.every((query) => !query.includes('IsPersonAccount') && !query.includes('RecordTypeId =')));
    assert.equal(queries.length, 2);
});

test('両コマンドはレコードタイプ指定を確認前に表示し全検索へ渡す', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Custom__pc\nName');
    for (const mode of ['records', 'record-fields-preview']) {
        const messages = [];
        const queries = [];
        const runner = runnerFor();
        assert.equal(
            await main(['--record-type-id', recordTypeId, '--output', `${mode}.csv`], {
                cwd,
                mode,
                writeLine: (line) => messages.push(line),
                runner: async (args) => {
                    if (args[0] === 'data') queries.push(fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8'));
                    return runner(args);
                },
                createPrompt: () => ({
                    question: async () => {
                        assert.ok(messages.some((line) => line.includes(`レコードタイプID: ${recordTypeId}`)));
                        assert.ok(messages.some((line) => line.includes('補完元を、指定したレコードタイプだけに限定')));
                        return 'y';
                    },
                    close() {}
                })
            }),
            0
        );
        assert.ok(queries.length >= 2);
        assert.ok(queries.every((query) => query.includes(`RecordTypeId = '${recordTypeId}'`)));
    }
});

test('接続確認専用でもレコードタイプの所属を検証しレコード検索しない', async (t) => {
    const cwd = temporary(t);
    const commands = [];
    await assert.rejects(
        () =>
            main(['--check-auth', '--record-type-id', '012000000000002AAA'], {
                cwd,
                writeLine: quiet,
                runner: async (args) => {
                    commands.push(args[0]);
                    return runnerFor()(args);
                }
            }),
        /Describe/
    );
    assert.deepEqual(commands, ['config', 'org', 'sobject']);
    assert.deepEqual(fs.readdirSync(cwd), []);
});

test('途中まで取得した後の失敗でも途中CSVと再開記録を保持する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    let queries = 0;
    const base = runnerFor();
    await assert.rejects(
        () =>
            main(['--fields-per-query', '1', '--output', 'out.csv'], {
                cwd,
                writeLine: quiet,
                createPrompt: approve,
                runner: async (args) => {
                    if (args[0] !== 'data') return base(args);
                    queries++;
                    if (queries === 1) return cli(response([newest]));
                    if (queries === 2) return cli(response([{ Id: newest.Id, Name: 'stored' }]));
                    return {
                        status: 1,
                        stdout: JSON.stringify({ status: 1, name: 'INVALID_FIELD', message: 'sensitive' })
                    };
                }
            }),
        (e) => e.code === 'INVALID_FIELD' && !e.message.includes('sensitive')
    );
    assert.equal(queries, 3);
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt', 'out.csv.resume', 'out.partial.csv']);
    assert.ok(!fs.existsSync(path.join(cwd, 'out.csv')));
    assert.ok(!fs.existsSync(path.join(cwd, 'out.csv.resume/lock.json')));
});

test('項目の分割後も全体の項目番号と補完状況を表示し、実値をログに含めない', async () => {
    const messages = [];
    const queries = [];
    const fields = [field('Present'), field('Fill'), field('Long', { filterable: false }), field('Empty')];
    await collectRecords(
        describe(...fields),
        fields.map((f) => f.name),
        { ...options, mode: 'record-fields-preview', fieldsPerQuery: 1 },
        async (query) => {
            queries.push(query);
            if (query.startsWith('SELECT Id,CreatedDate')) return response([newest]);
            if (query.includes('Fill != NULL')) return response([{ Id: older.Id, Fill: 'secret-filled' }]);
            if (query.includes('Empty != NULL')) return response([]);
            const name = fields.find((f) => query.startsWith(`SELECT Id,${f.name} `)).name;
            return response([{ Id: newest.Id, [name]: name === 'Present' ? 'secret-original' : null }]);
        },
        (line) => messages.push(line)
    );
    for (const line of [
        '[1/4項目]\tPresent\t取得成功',
        '[2/4項目]\tFill\t補完成功',
        '[3/4項目]\tLong\t補完対象外：非NULL条件で検索不可・最新レコードの値を保持',
        '[4/4項目]\tEmpty\t登録レコードなし'
    ])
        assert.ok(messages.includes(line), line);
    assert.equal(messages.filter((line) => line.startsWith('最新レコードを取得中')).length, 1);
    assert.ok(messages.every((line) => !line.includes('（値取得中）')));
    assert.equal(queries.length, 7);
    assert.ok(messages.every((line) => !/secret-|^空欄補完:|^補完対象外:/.test(line)));
});

test('補完の権限エラーは取得成功や値なしとせず、理由を保存して続行する', async () => {
    for (const code of ['INVALID_FIELD', 'INSUFFICIENT_ACCESS']) {
        const messages = [];
        let calls = 0;
        const result = await collectRecords(
            describe(field('Name')),
            ['Name'],
            { ...options, mode: 'record-fields-preview' },
            async () => {
                calls++;
                if (calls === 1) return response([newest]);
                if (calls === 2) return response([{ Id: newest.Id, Name: null }]);
                throw Object.assign(new Error('安全な診断'), { code });
            },
            (line) => messages.push(line)
        );
        assert.ok(messages.some((line) => line.includes(`補完スキップ：${code}`)));
        assert.ok(messages.every((line) => !line.includes('補完成功')));
        assert.match(toCsv(result, 'record-fields-preview'), new RegExp(`SKIPPED_${code}`));
        assert.equal(calls, 4);
    }
});

test('未確認項目を検索から外し、両形式で空欄の指定位置を保持して保存する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Missing\nName\nAlsoMissing\nCustom__pc');
    for (const mode of ['records', 'record-fields-preview']) {
        for (const split of [false, true]) {
            const messages = [];
            const queries = [];
            const runner = runnerFor(
                mode === 'records'
                    ? [
                          { ...newest, Name: 'new', Custom__pc: null },
                          { ...older, Name: 'old', Custom__pc: null }
                      ]
                    : [{ ...newest, Name: 'new', Custom__pc: null }]
            );
            const output = `${mode}-${split}.csv`;
            const code = await main(['--output', output, ...(split ? ['--fields-per-query', '1'] : [])], {
                cwd,
                mode,
                createPrompt: approve,
                writeLine: (line) => messages.push(line),
                runner: async (args) => {
                    if (args[0] === 'data') queries.push(fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8'));
                    return runner(args);
                }
            });
            assert.equal(code, 1);
            assert.ok(queries.every((query) => !query.includes('Missing')));
            const csv = fs.readFileSync(path.join(cwd, output), 'utf8');
            if (mode === 'records') {
                assert.equal(
                    csv,
                    '"Missing","Name","AlsoMissing","Custom__pc"\r\n"","new","",""\r\n"","old","",""\r\n'
                );
            } else {
                const lines = csv.split('\r\n');
                assert.equal(lines[1], '"Missing","","","","INVALID_FIELD",""');
                assert.match(lines[2], /^"Name","Name","string","new","LATEST"/);
                assert.equal(lines[3], '"AlsoMissing","","","","INVALID_FIELD",""');
                assert.match(lines[4], /^"Custom__pc".*"NO_VALUE_FOUND"/);
            }
            assert.ok(messages.some((line) => line.startsWith('[1/4項目]\tMissing\t取得不可：')));
            assert.ok(messages.some((line) => line.startsWith('[3/4項目]\tAlsoMissing\t取得不可：')));
            assert.ok(messages.some((line) => line.includes('項目エラー: 2項目')));
            const numbered = messages.filter((line) => /^\[\d+\/4項目\]/.test(line));
            assert.equal(numbered.length, 4);
            assert.ok(numbered.every((line) => line.split('\t').length === 3));
            const positions = numbered.map((line) => Number(line.match(/^\[(\d+)/)[1]));
            assert.deepEqual([...new Set(positions)], [1, 2, 3, 4]);
            assert.ok(positions.every((value, index) => index === 0 || value >= positions[index - 1]));
            assert.equal(numbered.filter((line) => line.startsWith('[1/4項目]')).length, 1);
            assert.equal(numbered.filter((line) => line.startsWith('[3/4項目]')).length, 1);
            assert.ok(
                messages.indexOf(numbered[0]) > messages.findIndex((line) => line.startsWith('最新レコードを取得中'))
            );
            assert.ok(messages.every((line) => !line.includes('（値取得中）')));
        }
    }
});

test('全項目が未確認でも余分な値検索をせず、対象なしでも項目エラーを通知する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Missing');
    for (const mode of ['records', 'record-fields-preview']) {
        for (const empty of [false, true]) {
            const messages = [];
            let queries = 0;
            const runner = runnerFor(empty ? [] : [{ ...newest }]);
            const output = `${mode}-${empty}.csv`;
            assert.equal(
                await main(['--output', output], {
                    cwd,
                    mode,
                    createPrompt: approve,
                    writeLine: (line) => messages.push(line),
                    runner: async (args) => {
                        if (args[0] === 'data') queries++;
                        return runner(args);
                    }
                }),
                1
            );
            assert.equal(queries, 1);
            const csv = fs.readFileSync(path.join(cwd, output), 'utf8');
            if (mode === 'records') assert.equal(csv, empty ? '"Missing"\r\n' : '"Missing"\r\n""\r\n');
            else assert.equal(csv.includes('INVALID_FIELD'), !empty);
            assert.ok(messages.some((line) => line.startsWith('[1/1項目]\tMissing\t取得不可：')));
        }
    }
});

test('対話端末だけ補完中の同じ行を更新し、成功・失敗後に一時表示を消す', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    for (const isTTY of [false, true]) {
        for (const fails of [false, true]) {
            const output = `terminal-${isTTY}-${fails}.csv`;
            const terminalWrites = [];
            const messages = [];
            const runner = runnerFor([{ ...newest, Name: null }]);
            const run = () =>
                main(['--output', output], {
                    cwd,
                    mode: 'record-fields-preview',
                    createPrompt: approve,
                    progressOutput: { isTTY, columns: 120, write: (text) => terminalWrites.push(text) },
                    writeLine: (line) => messages.push(line),
                    runner: async (args) => {
                        if (args[0] === 'data') {
                            const query = fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8');
                            if (query.includes(' != NULL')) {
                                assert.equal(
                                    terminalWrites.some((text) => text.includes('補完中')),
                                    isTTY
                                );
                                if (fails) throw new Error('mock failure');
                            }
                        }
                        return runner(args);
                    }
                });
            if (fails) await assert.rejects(run, /mock failure/);
            else assert.equal(await run(), 0);
            assert.ok(messages.every((line) => !line.includes('補完中')));
            const completed = messages.filter((line) => line.startsWith('[1/1項目]'));
            if (fails) {
                assert.equal(completed.length, 1);
                assert.match(completed[0], /^\[1\/1項目\]\tName\t補完失敗：QUERY_FAILED \/ 経過: \d+\.\d秒$/);
            } else assert.deepEqual(completed, ['[1/1項目]\tName\t登録レコードなし']);
            if (isTTY) {
                assert.ok(terminalWrites.some((text) => text.includes('補完中')));
                assert.deepEqual(terminalWrites.slice(-2), ['\u001b[1G', '\u001b[2K']);
            } else assert.deepEqual(terminalWrites, []);
        }
    }
});

test('補完途中で停止しても値を保存し、固定IDの未完了項目から再開する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    const messages = [];
    const args = ['--output', 'resume.csv'];
    const mode = 'record-fields-preview';
    const runner = runnerFor([{ ...newest, Name: 'before', Custom__pc: null }]);
    await assert.rejects(
        () =>
            main(args, {
                cwd,
                mode,
                createPrompt: approve,
                writeLine: (line) => messages.push(line),
                runner: async (command) => {
                    if (command[0] === 'data') {
                        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                        if (query.includes(' != NULL')) throw Object.assign(new Error('auth'), { code: 'AUTH_FAILED' });
                    }
                    return runner(command);
                }
            }),
        /auth/
    );
    const partial = fs.readFileSync(path.join(cwd, 'resume.partial.csv'), 'utf8');
    assert.match(partial, /"Name","Name","string","before","LATEST"/);
    assert.match(partial, /"Custom__pc","Custom__pc","string","","NOT_PROCESSED",""/);
    assert.ok(messages.some((line) => line.includes('--resume')));
    const queries = [];
    assert.equal(
        await main([...args, '--resume'], {
            cwd,
            mode,
            createPrompt: approve,
            writeLine: quiet,
            runner: async (command) => {
                if (command[0] !== 'data') return runner(command);
                const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                queries.push(query);
                assert.ok(!query.includes('SELECT Id,CreatedDate'));
                assert.ok(!query.includes('Name'));
                if (query.includes(' != NULL')) return cli(response([{ Id: older.Id, Custom__pc: 'filled' }]));
                assert.ok(query.includes(`Id = '${newest.Id}'`));
                return cli(response([{ Id: newest.Id, Custom__pc: null }]));
            }
        }),
        0
    );
    assert.equal(queries.length, 2);
    const result = fs.readFileSync(path.join(cwd, 'resume.csv'), 'utf8');
    assert.match(result, /"Name","Name","string","before","LATEST"/);
    assert.match(result, /"Custom__pc","Custom__pc","string","filled","SUPPLEMENTED"/);
    assert.equal(result.split('\r\n').length, 4);
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt', 'resume.csv']);
});

test('横型は未完成行も再開記録へ保存し、再開後もレコードと列を混ぜない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    const args = ['--output', 'resume.csv', '--fields-per-query', '1'];
    const records = [
        { ...newest, Name: 'first' },
        { ...older, Name: 'second' }
    ];
    const runner = runnerFor(records);
    await assert.rejects(
        () =>
            main(args, {
                cwd,
                createPrompt: approve,
                writeLine: quiet,
                runner: async (command) => {
                    if (command[0] === 'data') {
                        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                        if (query.includes('Custom__pc')) throw new Error('interrupted');
                    }
                    return runner(command);
                }
            }),
        /interrupted/
    );
    assert.equal(fs.readFileSync(path.join(cwd, 'resume.partial.csv'), 'utf8'), '"Name","Custom__pc"\r\n');
    assert.equal(
        await main([...args, '--resume'], {
            cwd,
            createPrompt: approve,
            writeLine: quiet,
            runner: async (command) => {
                if (command[0] !== 'data') return runner(command);
                const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                assert.ok(query.startsWith('SELECT Id,Custom__pc'));
                return cli(
                    response([
                        { Id: older.Id, Custom__pc: 'second-value' },
                        { Id: newest.Id, Custom__pc: 'first-value' }
                    ])
                );
            }
        }),
        0
    );
    assert.equal(
        fs.readFileSync(path.join(cwd, 'resume.csv'), 'utf8'),
        '"Name","Custom__pc"\r\n"first","first-value"\r\n"second","second-value"\r\n'
    );
});

test('再開元と条件・ユーザー・項目順が異なる場合は検索せず途中結果を保持する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    const args = ['--output', 'resume.csv', '--fields-per-query', '1'];
    const runner = runnerFor([{ ...newest, Name: 'retained', Custom__pc: null }]);
    await assert.rejects(
        () =>
            main(args, {
                cwd,
                createPrompt: approve,
                writeLine: quiet,
                runner: async (command) => {
                    if (
                        command[0] === 'data' &&
                        fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8').includes('Custom__pc')
                    )
                        throw new Error('stop');
                    return runner(command);
                }
            }),
        /stop/
    );
    const partial = fs.readFileSync(path.join(cwd, 'resume.partial.csv'), 'utf8');
    for (const variant of ['count', 'fields', 'org', 'date']) {
        fs.writeFileSync(path.join(cwd, 'fields.txt'), variant === 'fields' ? 'Custom__pc\nName' : 'Name\nCustom__pc');
        await assert.rejects(
            () =>
                main(
                    [
                        ...args,
                        '--resume',
                        ...(variant === 'count' ? ['--record-limit', '3'] : []),
                        ...(variant === 'date' ? ['--created-before', '2026-10-01'] : [])
                    ],
                    {
                        cwd,
                        createPrompt: approve,
                        writeLine: quiet,
                        runner: async (command) => {
                            assert.notEqual(command[0], 'data');
                            if (variant === 'org' && command[0] === 'org') {
                                const list = orgList();
                                list.nonScratchOrgs[0].orgId = 'different-org-id';
                                return cli(list);
                            }
                            return runner(command);
                        }
                    }
                ),
            /一致しません/
        );
        assert.equal(fs.readFileSync(path.join(cwd, 'resume.partial.csv'), 'utf8'), partial);
        assert.ok(!fs.existsSync(path.join(cwd, 'resume.csv.resume/lock.json')));
    }
});

test('完成ファイルの公開失敗後は全項目を再検索せず保存だけを再開できる', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    const args = ['--output', 'resume.csv'];
    const runner = runnerFor();
    const mock = t.mock.method(fs, 'linkSync', () => {
        throw Object.assign(new Error('disk failure'), { code: 'ENOSPC' });
    });
    try {
        await assert.rejects(
            () => main(args, { cwd, runner, writeLine: quiet, createPrompt: approve }),
            /disk failure/
        );
    } finally {
        mock.mock.restore();
    }
    assert.match(fs.readFileSync(path.join(cwd, 'resume.partial.csv'), 'utf8'), /latest/);
    assert.equal(
        await main([...args, '--resume'], {
            cwd,
            writeLine: quiet,
            createPrompt: approve,
            runner: (command) => {
                assert.notEqual(command[0], 'data');
                return runner(command);
            }
        }),
        0
    );
    assert.equal(fs.readFileSync(path.join(cwd, 'resume.csv'), 'utf8'), '"Name"\r\n"latest"\r\n');
});

test('再開元の二重使用と確定断片の破損を拒否する', async (t) => {
    const { openCheckpoint } = require('../internal/checkpoint');
    const directory = path.join(temporary(t), 'session');
    const context = { recordLimit: 1, fields: [field('Name')] };
    const checkpoint = openCheckpoint(directory, context, false);
    checkpoint.select([newest]);
    checkpoint.append(newest.Id, context.fields, { Id: newest.Id, Name: 'saved' }, new Map([['Name', newest.Id]]));
    assert.throws(() => openCheckpoint(directory, context, true), /使用中/);
    checkpoint.close();
    fs.writeFileSync(path.join(directory, 'chunk-00000000.json'), '{broken');
    const resumed = openCheckpoint(directory, context, true);
    try {
        await assert.rejects(() => resumed.replay(() => assert.fail('破損断片を渡さない')), /読み込めません/);
    } finally {
        resumed.close();
    }
    assert.throws(() => parseOptions(['--resume']), /--output/);
});

test('レコード分割後の停止では完成行を途中公開し、未完了レコードだけ再開する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    const args = ['--output', 'resume.csv'];
    const runner = runnerFor([
        { ...newest, Name: 'first' },
        { ...older, Name: 'second' }
    ]);
    await assert.rejects(
        () =>
            main(args, {
                cwd,
                createPrompt: approve,
                writeLine: quiet,
                runner: async (command) => {
                    if (command[0] !== 'data') return runner(command);
                    const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                    if (query.startsWith('SELECT Id,CreatedDate')) return cli(response([newest, older]));
                    if (query.includes(' IN ')) throw Object.assign(new Error('size'), { code: 'BUFFER_LIMIT' });
                    if (query.includes(older.Id)) throw Object.assign(new Error('timeout'), { code: 'CLI_TIMEOUT' });
                    return cli(response([{ Id: newest.Id, Name: 'first' }]));
                }
            }),
        /timeout/
    );
    assert.equal(fs.readFileSync(path.join(cwd, 'resume.partial.csv'), 'utf8'), '"Name"\r\n"first"\r\n');
    // 強制終了で残った未確定ファイルは再開時に確定断片として扱わない。
    fs.writeFileSync(path.join(cwd, 'resume.csv.resume/chunk-00000001.json.tmp'), '{incomplete');
    assert.equal(
        await main([...args, '--resume'], {
            cwd,
            createPrompt: approve,
            writeLine: quiet,
            runner: async (command) => {
                if (command[0] !== 'data') return runner(command);
                const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                assert.ok(!query.includes(newest.Id));
                assert.ok(query.includes(`Id = '${older.Id}'`));
                return cli(response([{ Id: older.Id, Name: 'second' }]));
            }
        }),
        0
    );
    assert.equal(fs.readFileSync(path.join(cwd, 'resume.csv'), 'utf8'), '"Name"\r\n"first"\r\n"second"\r\n');
});

test('強制終了したプロセスの保存値を復元し、同時再開は一つだけ許可する', { timeout: 15000 }, async (t) => {
    const { spawn } = require('node:child_process');
    const { once } = require('node:events');
    const directory = path.join(temporary(t), 'checkpoint');
    const modulePath = require.resolve('../internal/checkpoint');
    const worker = `
        const { openCheckpoint } = require(process.argv[1]);
        const context = { recordLimit: 1, fields: [{ name: 'Name' }] };
        const id = '001000000000001AAA';
        process.send({ state: 'ready' });
        process.once('message', async () => {
            try {
                const checkpoint = openCheckpoint(process.argv[2], context, process.argv[3] === 'resume');
                let value;
                if (process.argv[3] === 'initial') {
                    checkpoint.select([{ Id: id }]);
                    checkpoint.append(id, context.fields, { Id: id, Name: 'fixture-value' });
                } else {
                    await checkpoint.replay((_id, _fields, record) => { value = record.Name; });
                }
                process.send({ state: 'acquired', offset: checkpoint.offsets.get(id), value });
                process.once('message', () => { checkpoint.close(); process.exit(0); });
            } catch (error) {
                process.send({ state: 'rejected', message: error.message });
                process.disconnect();
            }
        });
    `;
    async function start(mode) {
        const child = spawn(process.execPath, ['-e', worker, modulePath, directory, mode], {
            stdio: ['ignore', 'ignore', 'pipe', 'ipc']
        });
        t.after(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        });
        assert.equal((await once(child, 'message'))[0].state, 'ready');
        return child;
    }
    const first = await start('initial');
    const acquired = once(first, 'message');
    first.send('start');
    assert.equal((await acquired)[0].state, 'acquired');
    const exited = once(first, 'exit');
    first.kill('SIGKILL');
    await exited;
    const contenders = await Promise.all([start('resume'), start('resume')]);
    const results = contenders.map((child) => once(child, 'message'));
    contenders.forEach((child) => child.send('start'));
    const messages = (await Promise.all(results)).map(([message]) => message);
    assert.equal(messages.filter((message) => message.state === 'acquired').length, 1);
    assert.equal(messages.filter((message) => message.state === 'rejected').length, 1);
    const winnerIndex = messages.findIndex((message) => message.state === 'acquired');
    assert.equal(messages[winnerIndex].value, 'fixture-value');
    assert.equal(messages[winnerIndex].offset, 1);
    const winnerExit = once(contenders[winnerIndex], 'exit');
    contenders[winnerIndex].send('close');
    await winnerExit;
});

test('古いロックの削除中は別の再開によるロック回収を拒否する', (t) => {
    const { openCheckpoint } = require('../internal/checkpoint');
    const directory = path.join(temporary(t), 'checkpoint');
    const context = { recordLimit: 1, fields: [field('Name')] };
    openCheckpoint(directory, context, false).close();
    fs.writeFileSync(path.join(directory, 'lock.json'), JSON.stringify({ host: os.hostname(), pid: 12345 }));
    t.mock.method(process, 'kill', () => {
        throw Object.assign(new Error('terminated'), { code: 'ESRCH' });
    });
    const unlink = fs.unlinkSync;
    let guarded = false;
    t.mock.method(fs, 'unlinkSync', (file) => {
        if (!guarded && file === path.join(directory, 'lock.json')) {
            guarded = true;
            assert.throws(() => openCheckpoint(directory, context, true), /再開ロックを取得中/);
        }
        return unlink(file);
    });
    const checkpoint = openCheckpoint(directory, context, true);
    assert.ok(guarded);
    checkpoint.close();
    assert.ok(!fs.existsSync(path.join(directory, 'lock-acquire')));
});

test('CLIとSalesforceのタイムアウトを区別し、安全な診断と経過時間を残す', async () => {
    for (const [response, code] of [
        [{ status: 1, stdout: JSON.stringify({ name: 'QUERY_TIMEOUT', message: 'secret-value' }) }, 'QUERY_TIMEOUT'],
        [
            { status: 1, stdout: JSON.stringify({ name: 'Error', code: 'ETIMEDOUT', message: 'secret-value' }) },
            'NETWORK_TIMEOUT'
        ],
        [{ status: null, error: { killed: true, signal: 'SIGTERM' } }, 'CLI_TIMEOUT'],
        [{ status: 1, stdout: JSON.stringify({ name: 'UnexpectedCliError', message: 'secret-value' }) }, 'CLI_FAILED'],
        [
            {
                status: 1,
                stdout: JSON.stringify({ name: 'https://private.invalid/secret-value', message: 'secret-value' })
            },
            'CLI_FAILED'
        ]
    ]) {
        await assert.rejects(
            () => callSf([], '.', async () => response),
            (error) => {
                assert.equal(error.code, code);
                assert.match(error.message, /CLI経過: \d+\.\d秒/);
                assert.ok(!error.message.includes('secret-value'));
                if (response.stdout?.includes('UnexpectedCliError'))
                    assert.match(error.message, /識別子: UnexpectedCliError/);
                return true;
            }
        );
    }
});

test('独立した非NULL検索を5本ずつ送信し、値なし・成功・一項目の失敗を混ぜない', async () => {
    const fields = Array.from({ length: 12 }, (_, i) => field(`F${i}`));
    const saved = [],
        batches = [];
    const query = async (soql) =>
        soql.startsWith('SELECT Id,CreatedDate')
            ? response([newest])
            : response([{ Id: newest.Id, ...Object.fromEntries(fields.map((f) => [f.name, null])) }]);
    query.batch = async (soqls) => {
        batches.push(soqls);
        return soqls.map((soql) => {
            assert.ok(!soql.includes(' OR '));
            const name = /^SELECT Id,(\w+) FROM/.exec(soql)[1];
            assert.ok(soql.includes(`WHERE ${name} != NULL ORDER BY`));
            if (name === 'F0') return { result: response([]) };
            if (name === 'F1' && batches.length === 1)
                return { error: Object.assign(new Error('timeout'), { code: 'QUERY_TIMEOUT' }) };
            return { result: response([{ Id: older.Id, [name]: name }]) };
        });
    };
    await collectValidatedRecords(
        describe(...fields),
        fields,
        { ...options, mode: 'record-fields-preview' },
        query,
        quiet,
        async (_id, group, record, _sources, _latest, statuses, update) =>
            saved.push({
                name: group[0].name,
                value: record[group[0].name],
                status: statuses.get(group[0].name),
                replace: update?.replace
            })
    );
    assert.deepEqual(
        batches.map((b) => b.length),
        [5, 5, 2, 1]
    );
    assert.deepEqual(
        saved.slice(0, 12).map((r) => r.name),
        fields.map((f) => f.name)
    );
    assert.equal(saved[0].value, null);
    assert.equal(saved[1].status, 'PENDING_RETRY_QUERY_TIMEOUT');
    assert.equal(saved.at(-1).name, 'F1');
    assert.equal(saved.at(-1).value, 'F1');
    assert.equal(saved.at(-1).replace, true);
    assert.equal(batches.flat().filter((q) => q.includes('F0 != NULL')).length, 1);
    assert.equal(batches.flat().filter((q) => q.includes('F2 != NULL')).length, 1);
});

test('作成日の指定は日本時間の当日午前0時より前とし、不正日付を拒否する', () => {
    for (const mode of ['records', 'record-fields-preview']) {
        assert.equal(parseOptions([], mode).createdBefore, undefined);
        assert.equal(parseOptions(['--created-before', '2026-10-01'], mode).createdBefore, '2026-09-30T15:00:00.000Z');
        assert.equal(parseOptions(['--created-before', '2024-02-29'], mode).createdBefore, '2024-02-28T15:00:00.000Z');
        for (const value of [
            '',
            '2026-02-29',
            '2026-04-31',
            '2026-13-01',
            '2026-1-01',
            '2026-10-01T00:00:00Z',
            '2026-10-01 OR Id != NULL'
        ])
            assert.throws(() => parseOptions(['--created-before', value], mode), /実在する日付/);
    }
});

test('作成日条件を対象選択・値取得・個別補完へ同じ境界で適用する', async () => {
    const fields = [field('A'), field('B')];
    const queries = [];
    const settings = {
        ...parseOptions(['--created-before', '2026-10-01', '--record-type-id', recordTypeId], 'record-fields-preview'),
        mode: 'record-fields-preview'
    };
    const result = await collectRecords(
        describe(...fields),
        ['A', 'B'],
        settings,
        async (query) => {
            queries.push(query);
            assert.ok(query.includes(`RecordTypeId = '${recordTypeId}' AND CreatedDate < 2026-09-30T15:00:00.000Z`));
            if (queries.length === 1) return response([newest]);
            if (queries.length === 2) return response([{ Id: newest.Id, A: null, B: null }]);
            assert.match(query, /AND [AB] != NULL ORDER BY/);
            return response([{ Id: older.Id, A: 'a', B: 'b' }]);
        },
        quiet
    );
    assert.equal(queries.length, 4);
    assert.deepEqual(result.records[0], { A: 'a', B: 'b' });
    assert.throws(
        () => validateDescribe(describe(field('CreatedDate', { sortable: true, filterable: false })), ['A'], settings),
        /検索可能なCreatedDate/
    );
});

test('両形式で作成日の条件を確認前に表示し、未指定時は日付条件を付けない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name');
    for (const mode of ['records', 'record-fields-preview']) {
        for (const specified of [false, true]) {
            const messages = [];
            const runner = runnerFor();
            const args = [
                '--output',
                `${mode}-${specified}.csv`,
                ...(specified ? ['--created-before', '2026-10-01'] : [])
            ];
            const status = await main(args, {
                cwd,
                mode,
                writeLine: (line) => messages.push(line),
                createPrompt: () => ({
                    question: async () => {
                        assert.equal(
                            messages.some((line) => line === '作成日: 2026-10-01より前（日本時間・当日を含まない）'),
                            specified
                        );
                        return 'y';
                    },
                    close: () => {}
                }),
                runner: async (command) => {
                    if (command[0] === 'data') {
                        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                        assert.equal(query.includes('CreatedDate < 2026-09-30T15:00:00.000Z'), specified);
                    }
                    return runner(command);
                }
            });
            assert.equal(status, 0);
        }
    }
});

test('補完のCLI失敗・時間超過は最後に一度再試行してからスキップしてCSVを完成させる', async (t) => {
    for (const code of ['CLI_FAILED', 'QUERY_TIMEOUT', 'NETWORK_TIMEOUT', 'NETWORK_ERROR']) {
        const cwd = temporary(t);
        fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
        const runner = runnerFor([{ ...newest, Name: null, Custom__pc: null }]);
        const messages = [];
        let supplements = 0;
        assert.equal(
            await main(['--output', 'skipped.csv'], {
                cwd,
                mode: 'record-fields-preview',
                createPrompt: approve,
                writeLine: (line) => messages.push(line),
                runner: async (command) => {
                    if (command[0] === 'data') {
                        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                        if (query.includes(' != NULL')) {
                            supplements++;
                            throw Object.assign(new Error('mock'), { code });
                        }
                    }
                    return runner(command);
                }
            }),
            1
        );
        assert.equal(supplements, 3);
        const csv = fs.readFileSync(path.join(cwd, 'skipped.csv'), 'utf8');
        assert.equal((csv.match(new RegExp(`SKIPPED_${code}`, 'g')) || []).length, 2);
        assert.ok(!csv.includes('NO_VALUE_FOUND'));
        assert.ok(messages.some((line) => line.includes('全項目の処理と保存は完了')));
        assert.ok(!fs.existsSync(path.join(cwd, 'skipped.csv.resume')));
    }
});

test('MasterRecordIdも特別扱いせず一括補完に含め、空欄と実値を通常どおり扱う', async () => {
    for (const masterValue of [null, older.Id]) {
        const queries = [];
        const result = await collectRecords(
            describe(field('MasterRecordId'), field('Name')),
            ['MasterRecordId', 'Name'],
            { ...options, mode: 'record-fields-preview' },
            async (query) => {
                queries.push(query);
                if (queries.length === 1) return response([newest]);
                if (queries.length === 2) return response([{ Id: newest.Id, MasterRecordId: null, Name: null }]);
                if (query.includes('MasterRecordId != NULL'))
                    return response(masterValue === null ? [] : [{ Id: older.Id, MasterRecordId: masterValue }]);
                assert.match(query, /SELECT Id,Name FROM Account WHERE Name != NULL/);
                return response([{ Id: older.Id, Name: 'demo' }]);
            },
            quiet
        );
        assert.equal(queries.length, 4);
        assert.equal(result.records[0].MasterRecordId, masterValue);
        assert.equal(result.statuses.size, 0);
    }
});

test('補完待機の進捗と累積期限を検証し、成功・スキップ後にタイマーを残さない', async (t) => {
    const { createPreviewResolver, SUPPLEMENT_TIMEOUT_MS } = require('../internal/preview-values');
    t.mock.timers.enable({ apis: ['setInterval'] });
    let now = 0;
    t.mock.method(performance, 'now', () => now);
    const reports = [];
    const resolve = createPreviewResolver({
        fields: [field('A'), field('B')],
        record: { A: null, B: null },
        scope: [],
        hasValue: (value) => value != null,
        canFilterNonNull: () => true,
        report: (f, message) => reports.push([f.name, message]),
        searchBatch: async (_fields, _scope, controls) => {
            assert.equal(controls.deadline, SUPPLEMENT_TIMEOUT_MS);
            now = 10000;
            t.mock.timers.tick(10000);
            now = SUPPLEMENT_TIMEOUT_MS;
            throw Object.assign(new Error('timeout'), { code: 'SUPPLEMENT_TIMEOUT' });
        }
    });
    assert.deepEqual(await resolve(field('A')), {
        skipped: 'SUPPLEMENT_TIMEOUT',
        elapsedSeconds: '60.0',
        deferred: true,
        retryBatchSize: 1
    });
    assert.deepEqual(await resolve(field('B')), {
        skipped: 'SUPPLEMENT_TIMEOUT',
        elapsedSeconds: '60.0',
        deferred: true,
        retryBatchSize: 1
    });
    assert.ok(reports.some(([name, text]) => name === 'A' && text.includes('応答待ち：10秒経過')));
    const count = reports.length;
    t.mock.timers.tick(20000);
    assert.equal(reports.length, count);
});

test('補完期限をCLI待機上限へ伝え、実際の子プロセス終了を待ってスキップ可能にする', async () => {
    const { runSfWithOutputAsync } = require('../../common/run-command');
    const { execFile } = require('node:child_process');
    await assert.rejects(
        () =>
            callSf(
                ['api'],
                '.',
                (_args, cwd, _exec, maxBuffer, timeout) => {
                    assert.ok(timeout > 0 && timeout <= 150);
                    return runSfWithOutputAsync(
                        [],
                        cwd,
                        (_command, _commandArgs, settings, callback) =>
                            execFile(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], settings, callback),
                        maxBuffer,
                        timeout
                    );
                },
                'record-fields-preview',
                { deadline: performance.now() + 150 }
            ),
        (error) => error.code === 'SUPPLEMENT_TIMEOUT'
    );
});

test('標準エラーだけの通信エラーを分類し、未知エラーも終了状態を表示する', async () => {
    for (const [stderr, code] of [
        ["code: 'ETIMEDOUT'\nprivate-value", 'NETWORK_TIMEOUT'],
        ['private-value', 'CLI_FAILED']
    ]) {
        await assert.rejects(
            () => callSf(['api'], '.', async () => ({ status: 1, stdout: '', stderr })),
            (error) => {
                assert.equal(error.code, code);
                assert.match(error.message, /終了コード: 1/);
                assert.match(error.message, /応答形式: 空/);
                assert.ok(!error.message.includes('private-value'));
                return true;
            }
        );
    }
});

test('入れ子の通信エラーを分類し、補完スキップ後も診断を終了時に残す', async (t) => {
    for (const [causeCode, expected] of [
        ['ECONNRESET', 'NETWORK_ERROR'],
        ['ETIMEDOUT', 'NETWORK_TIMEOUT'],
        ['UnknownError', 'CLI_FAILED']
    ]) {
        const cwd = temporary(t);
        fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
        const runner = runnerFor([{ ...newest, Name: null, Custom__pc: null }]);
        const messages = [];
        const status = await main(['--output', 'failed.csv'], {
            cwd,
            mode: 'record-fields-preview',
            createPrompt: approve,
            writeLine: (message) => messages.push(message),
            runner: async (command) => {
                if (command[0] === 'data') {
                    const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
                    if (query.includes(' != NULL')) {
                        return {
                            status: 1,
                            stdout: JSON.stringify({
                                status: 1,
                                name: 'Error',
                                cause: { cause: { code: causeCode, message: 'secret-value' } }
                            })
                        };
                    }
                }
                return runner(command);
            }
        });
        assert.equal(status, 1);
        assert.match(messages.at(-1), new RegExp(`^CLI失敗の診断（3回）: ${expected} / 終了コード: 1`));
        assert.ok(!messages.join('\n').includes('secret-value'));
        const csv = fs.readFileSync(path.join(cwd, 'failed.csv'), 'utf8');
        assert.equal((csv.match(new RegExp(`SKIPPED_${expected}`, 'g')) || []).length, 2);
        assert.ok(!csv.includes('NO_VALUE_FOUND'));
    }
});

test('再開コマンドは全条件と空白・引用符を保持してそのまま実行できる', () => {
    const { execFileSync } = require('node:child_process');
    const settings = parseOptions([
        '--object',
        'Account',
        '--fields',
        "input a'b.txt",
        '--record-type-id',
        recordTypeId,
        '--created-before',
        '2026-10-01',
        '--fields-per-query',
        '10',
        '--record-limit',
        '20'
    ]);
    const command = buildResumeCommand(settings, 'records', 'example-org', "/tmp/a' $x.csv", '/tmp', 'darwin');
    if (process.platform !== 'win32') {
        const args = execFileSync('/bin/sh', ['-c', `set -- ${command}; printf '%s\\n' "$@"`], { encoding: 'utf8' })
            .trim()
            .split('\n');
        assert.deepEqual(args.slice(0, 4), ['npm', 'run', 'sf:export:records', '--']);
        assert.deepEqual(parseOptions(args.slice(4)), {
            ...settings,
            targetOrg: 'example-org',
            output: "a' $x.csv",
            resume: true
        });
    }
    assert.match(
        buildResumeCommand(settings, 'records', 'example-org', '/tmp/out.csv', '/tmp', 'win32'),
        /input a''b.txt/
    );
});

test('保留後に中断しても、再開時は取得済み範囲を読み直さず最後の再試行を行う', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    const base = runnerFor([{ ...newest, Name: null, Custom__pc: null }]);
    const args = ['--output', 'resume-deferred.csv', '--fields-per-query', '1'];
    let resuming = false;
    const queries = [];
    const runner = async (command) => {
        if (command[0] === 'data') {
            const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
            queries.push([resuming, query]);
            if (query.includes('Name != NULL')) throw Object.assign(new Error('timeout'), { code: 'CLI_TIMEOUT' });
            if (query.includes('Custom__pc != NULL') && !resuming)
                throw Object.assign(new Error('auth'), { code: 'AUTH_FAILED' });
        }
        return base(command);
    };
    await assert.rejects(
        () => main(args, { cwd, mode: 'record-fields-preview', runner, createPrompt: approve, writeLine: quiet }),
        /auth/
    );
    assert.match(fs.readFileSync(path.join(cwd, 'resume-deferred.partial.csv'), 'utf8'), /PENDING_RETRY_CLI_TIMEOUT/);
    resuming = true;
    assert.equal(
        await main([...args, '--resume'], {
            cwd,
            mode: 'record-fields-preview',
            runner,
            createPrompt: approve,
            writeLine: quiet
        }),
        1
    );
    const resumed = queries.filter(([state]) => state).map(([, query]) => query);
    assert.ok(resumed.every((query) => !query.startsWith('SELECT Id,CreatedDate')));
    assert.equal(resumed.filter((query) => query.includes('Name')).length, 1);
    assert.ok(resumed.at(-1).includes('Name != NULL'));
    const csv = fs.readFileSync(path.join(cwd, 'resume-deferred.csv'), 'utf8');
    assert.match(csv, /SKIPPED_CLI_TIMEOUT/);
    assert.ok(!csv.includes('PENDING_RETRY'));
    assert.equal(csv.split('\r\n').length, 4);
});

test('1300項目中1200項目の空欄は240通信で検索し、各項目を一度だけ確定する', async () => {
    const fields = Array.from({ length: 1300 }, (_, i) => field(`F${String(i).padStart(36, '0')}__c`));
    const saved = [],
        queried = new Set();
    let batches = 0,
        baseCalls = 0;
    const query = async (soql) => {
        baseCalls++;
        if (soql.startsWith('SELECT Id,CreatedDate')) return response([newest]);
        return response([
            { Id: newest.Id, ...Object.fromEntries(fields.map((f, i) => [f.name, i < 100 ? 'base' : null])) }
        ]);
    };
    query.batch = async (soqls) => {
        batches++;
        assert.equal(soqls.length, 5);
        return soqls.map((soql) => {
            const name = /^SELECT Id,(\w+) FROM/.exec(soql)[1];
            assert.ok(!queried.has(name));
            queried.add(name);
            return { result: response([{ Id: older.Id, [name]: 'filled' }]) };
        });
    };
    await collectValidatedRecords(
        describe(...fields),
        fields,
        { mode: 'record-fields-preview', recordLimit: 1 },
        query,
        quiet,
        async (_id, group, record) => saved.push([group[0].name, record[group[0].name]])
    );
    assert.equal(baseCalls, 2);
    assert.equal(batches, 240);
    assert.equal(queried.size, 1200);
    assert.deepEqual(
        saved.map((r) => r[0]),
        fields.map((f) => f.name)
    );
    assert.ok(saved.every((r, i) => r[1] === (i < 100 ? 'base' : 'filled')));
});

test('最後の再試行中の中断でも置換済み行を復元し、同じ項目を二重検索・二重出力しない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'A\nB\nC\nD');
    let phase = 0;
    let initialFailed = false;
    const queried = [];
    const runner = async (command) => {
        if (command[0] === 'config') return runnerFor()(command);
        if (command[0] === 'org') return cli(orgList());
        if (command[0] === 'sobject') return cli(describe(...['A', 'B', 'C', 'D'].map((name) => field(name))));
        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
        queried.push([phase, query]);
        if (query.startsWith('SELECT Id,CreatedDate')) return cli(response([newest]));
        if (query.includes(`Id = '${newest.Id}'`))
            return cli(response([{ Id: newest.Id, A: null, B: null, C: null, D: null }]));
        if (!phase && !initialFailed && query.includes('B != NULL')) {
            initialFailed = true;
            throw Object.assign(new Error('timeout'), { code: 'QUERY_TIMEOUT' });
        }
        if (!phase && query.startsWith('SELECT Id,A ')) return cli(response([{ Id: older.Id, A: 'a' }]));
        if (!phase) throw Object.assign(new Error('auth'), { code: 'AUTH_FAILED' });
        assert.ok(!query.includes('Id,A'));
        const names = query.slice(7, query.indexOf(' FROM ')).split(',').slice(1);
        return cli(
            response([{ Id: older.Id, ...Object.fromEntries(names.map((name) => [name, name.toLowerCase()])) }])
        );
    };
    const settings = { cwd, mode: 'record-fields-preview', runner, writeLine: quiet, createPrompt: approve };
    await assert.rejects(() => main(['--output', 'late.csv'], settings), /auth/);
    phase = 1;
    assert.equal(await main(['--output', 'late.csv', '--resume'], settings), 0);
    const csv = fs.readFileSync(path.join(cwd, 'late.csv'), 'utf8');
    assert.equal((csv.match(/SUPPLEMENTED/g) || []).length, 4);
    assert.ok(!csv.includes('PENDING_RETRY'));
    assert.deepEqual(
        csv
            .trimEnd()
            .split('\r\n')
            .slice(1)
            .map((line) => line.split(',')[0]),
        ['"A"', '"B"', '"C"', '"D"']
    );
    assert.ok(queried.filter(([stage]) => stage).every(([, query]) => query.includes(' != NULL')));
});
