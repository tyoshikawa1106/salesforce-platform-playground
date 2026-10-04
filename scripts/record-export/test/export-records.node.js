const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
    collectRecords: collectValidatedRecords,
    validateDescribe,
    parseFields,
    toCsv
} = require('../internal/collector');
const { main: runMain, parseOptions, callSf } = require('../internal/export-runner');
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

// 実行入口と同じく定義を検証してから、収集処理へ正規化した項目を渡す。
async function collectRecords(definition, names, settings, query, writeLine) {
    const fields = validateDescribe(definition, names, settings);
    return collectValidatedRecords(definition, fields, settings, query, writeLine);
}

// 既存のSOQL応答fixtureをCompositeのファイル応答へ変換する。
async function main(args, dependencies) {
    const runner = dependencies.runner;
    return runMain(args, {
        ...dependencies,
        runner: async (command, ...rest) => {
            if (command[0] !== 'api') return runner(command, ...rest);
            const requestFile = command[command.indexOf('--body') + 1].slice(1);
            const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
            const query = decodeURIComponent(request.compositeRequest[0].url.split('?q=')[1]);
            const file = path.join(path.dirname(requestFile), 'fixture.soql');
            fs.writeFileSync(file, query);
            const response = await runner(['data', 'query', '--file', file], ...rest);
            if (response.status === 0 && !response.error) {
                const result = JSON.parse(response.stdout).result;
                fs.writeFileSync(
                    command[command.indexOf('--stream-to-file') + 1],
                    JSON.stringify({
                        compositeResponse: [{ referenceId: 'records', httpStatusCode: 200, body: result }]
                    })
                );
                return cli({ statusCode: 0 });
            }
            return response;
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

test('無効項目・最新順不可・レコードタイプ不一致は検索前に停止する', async () => {
    const noQuery = () => assert.fail('must not query');
    await assert.rejects(
        () => collectRecords(describe(field('Name')), ['Missing', 'AlsoMissing'], options, noQuery),
        /Missing, AlsoMissing/
    );
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
                        messages.some((line) =>
                            line.includes(
                                mode === 'records'
                                    ? '空欄は補完しません'
                                    : '空欄は非NULL条件で検索可能な項目だけ最新の非NULL値で補完'
                            )
                        )
                    );
                    return 'y';
                },
                close() {}
            })
        });
        assert.equal(code, 0);
        assert.ok(queries.every((q) => !q.includes('IsPersonAccount') && !q.includes('RecordTypeId =')));
        assert.equal(queries.length, mode === 'records' ? 2 : 3);
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

test('非同期待機中は30秒ごとに表示し成功・失敗時にタイマーを解除する', async (t) => {
    const cwd = temporary(t);
    for (const fails of [false, true]) {
        const timers = new Set();
        const messages = [];
        let time = 0;
        let calls = 0;
        const dependencies = {
            cwd,
            writeLine: (line) => messages.push(line),
            now: () => time,
            setIntervalCommand: (tick, delay) => {
                assert.equal(delay, 30000);
                const timer = { tick, unref() {} };
                timers.add(timer);
                return timer;
            },
            clearIntervalCommand: (timer) => assert.ok(timers.delete(timer)),
            runner: async (args) => {
                calls++;
                await new Promise((resolve) => setImmediate(resolve));
                assert.equal(timers.size, 1);
                time += 30000;
                for (const timer of timers) timer.tick();
                if (fails) throw new Error('test failure');
                return runnerFor()(args);
            }
        };
        if (fails) await assert.rejects(() => main(['--check-auth'], dependencies), /test failure/);
        else assert.equal(await main(['--check-auth'], dependencies), 0);
        assert.equal(timers.size, 0);
        assert.equal(messages.filter((line) => line.startsWith('・実行中:')).length, calls);
        assert.ok(messages.filter((line) => line.startsWith('・実行中:')).every((line) => line.includes('30.0秒経過')));
    }
});

test('CLI障害の固定診断は生の本文を漏らさない', async () => {
    for (const [error, code] of [
        [{ code: 'ENOENT' }, 'CLI_NOT_FOUND'],
        [{ code: 'ETIMEDOUT' }, 'CLI_TIMEOUT'],
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
            assert.deepEqual(
                fs.existsSync(path.join(cwd, 'export-out')) ? fs.readdirSync(path.join(cwd, 'export-out')) : [],
                []
            );
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
        const result = args[0] === 'org' ? ${JSON.stringify(orgList())} : args[0] === 'sobject' ? ${JSON.stringify(describe(field('Name')))} : ${JSON.stringify(response([{ ...newest, Name: 'fixture' }]))};
        if(args[0] === 'api') {
            require('node:fs').writeFileSync(args[args.indexOf('--stream-to-file')+1], JSON.stringify({compositeResponse:[{referenceId:'records',httpStatusCode:200,body:result}]}));
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
            assert.match(
                result.stdout,
                mode === 'records' ? /空欄は補完しません/ : /空欄は非NULL条件で検索可能な項目だけ最新の非NULL値で補完/
            );
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

test('途中まで退避した後の取得失敗でも完成CSVと一時断片を残さない', async (t) => {
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
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt']);
});
