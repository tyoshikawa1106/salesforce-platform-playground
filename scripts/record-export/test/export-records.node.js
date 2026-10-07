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

// 収集テストでは同じSOQL応答fixtureを使い、通信経路は別途検証する。
async function collectValidatedRecords(definition, fields, settings, query, ...rest) {
    query.supplement ??= query;
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
    assert.match(queries[0], /LIMIT 200$/);
    assert.equal(
        queries[2],
        'SELECT Id,Empty FROM Account WHERE Empty != NULL ORDER BY CreatedDate DESC NULLS LAST, Id DESC LIMIT 1'
    );
    assert.equal(queries.length, 3);
    assert.equal(result.records[0].Name, 'latest');
    const csv = toCsv(result, 'record-fields-preview');
    assert.match(csv.split('\r\n')[1], /^"Empty","Empty","string","filled","補完成功"/);
    assert.ok(csv.includes(`"${older.Id}"`));
    assert.match(csv, /"Flag","Flag","string","false","取得成功"/);
    assert.match(csv, /"Count","Count","string","0","取得成功"/);
});

test('1300項目は生成700項目を検索から除き、最新200件で見つからない1項目だけ個別検索する', async () => {
    const generated = Array.from({ length: 700 }, (_, i) => field(`Text${i}`, { type: 'textarea' }));
    const actual = Array.from({ length: 600 }, (_, i) => field(`Value${i}`, { filterable: i !== 598 }));
    const fields = [...generated, ...actual];
    const selected = Array.from({ length: 200 }, (_, i) => ({
        Id: id(1000 - i),
        CreatedDate: '2026-01-01T00:00:00.000+0000'
    }));
    const queries = [];
    const result = await collectRecords(
        describe(...fields),
        fields.map((f) => f.name),
        { mode: 'record-fields-preview', recordTypeId, createdBefore: '2026-02-01T00:00:00.000Z' },
        async (query) => {
            queries.push(query);
            assert.ok(query.includes(`RecordTypeId = '${recordTypeId}'`));
            assert.ok(query.includes('CreatedDate < 2026-02-01T00:00:00.000Z'));
            assert.ok(!query.includes('Text'));
            if (query.startsWith('SELECT Id,CreatedDate ')) {
                assert.match(query, /ORDER BY CreatedDate DESC NULLS LAST, Id DESC LIMIT 200$/);
                return response(selected);
            }
            if (query.includes(' != NULL')) {
                assert.ok(query.includes('Value599 != NULL'));
                return response([]);
            }
            // 応答順を逆にし、最新の非空値と最後の200件目も正しく採用できるか確認する。
            return response(
                selected
                    .map((row, rowIndex) => ({
                        Id: row.Id,
                        ...Object.fromEntries(
                            actual.map((f, i) => [
                                f.name,
                                i === 599 || rowIndex < i % 200
                                    ? null
                                    : i === 0
                                      ? false
                                      : i === 1
                                        ? 0
                                        : `${i}:${rowIndex}`
                            ])
                        )
                    }))
                    .reverse()
            );
        },
        quiet
    );
    assert.equal(queries.length, 3); // 候補選択・まとめ取得・未取得1項目の個別検索。
    assert.equal(result.recordCount, 1);
    assert.deepEqual(result.ids, [selected[0].Id]);
    assert.equal(result.records[0].Value0, false);
    assert.equal(result.records[0].Value1, 0);
    for (let i = 2; i < 599; i++) {
        assert.equal(result.records[0][`Value${i}`], `${i}:${i % 200}`);
        assert.equal(result.sources.get(`Value${i}`), selected[i % 200].Id);
    }
    assert.equal(result.records[0].Value599, null);
    for (const f of generated) {
        assert.equal(result.statuses.get(f.name), 'GENERATED');
        assert.equal(result.sources.get(f.name), '');
    }
    const csv = toCsv(result, 'record-fields-preview').trimEnd().split('\r\n');
    assert.equal(csv.length, 1301);
    fields.forEach((f, i) => assert.ok(csv[i + 1].startsWith(`"${f.name}",`)));
    assert.ok(csv.at(-1).includes('登録レコードなし'));
});

test('候補のレコード分割と項目分割が重なっても最新の非空値だけを一件分保存する', async () => {
    const selected = [newest, older, { Id: id(1), CreatedDate: '2026-01-01T00:00:00.000+0000' }];
    const saved = [];
    const fields = [field('A'), field('B')];
    const result = await collectValidatedRecords(
        describe(...fields),
        fields,
        { mode: 'record-fields-preview' },
        async (query) => {
            if (query.startsWith('SELECT Id,CreatedDate ')) return response(selected);
            assert.ok(!query.includes(' != NULL'));
            const ids = [...query.matchAll(/'(001\d{15})'/g)].map((match) => match[1]);
            if (ids.length > 1) throw Object.assign(new Error('size'), { code: 'BUFFER_LIMIT' });
            if (query.startsWith('SELECT Id,A,B '))
                throw Object.assign(new Error('complex'), { code: 'QUERY_TOO_COMPLICATED' });
            const name = query.startsWith('SELECT Id,A ') ? 'A' : 'B';
            return response([{ Id: ids[0], [name]: name === 'A' && ids[0] === newest.Id ? null : ids[0] }]);
        },
        quiet,
        async (recordId, part, record, sources) =>
            saved.push({
                recordId,
                names: part.map((f) => f.name),
                record: { ...record },
                sources: new Map(sources)
            })
    );
    assert.equal(result.recordCount, 1);
    assert.deepEqual(
        saved.flatMap((chunk) => chunk.names),
        ['A', 'B']
    );
    assert.ok(saved.every((chunk) => chunk.recordId === newest.Id));
    assert.equal(saved[0].record.A, older.Id);
    assert.equal(saved[0].sources.get('A'), older.Id);
    assert.equal(saved.at(-1).record.B, newest.Id);
    assert.equal(saved.at(-1).sources.get('B'), newest.Id);
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
    assert.match(
        toCsv(result, 'record-fields-preview'),
        /"Long","Long","string","","補完対象外：非NULL条件で検索不可",""/
    );
    assert.match(toCsv(result, 'record-fields-preview'), /"Empty","Empty","string","","登録レコードなし",""/);
    assert.match(toCsv(result, 'record-fields-preview'), /"Present","Present","string","keep","取得成功"/);
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
                        messages.some((line) =>
                            line.includes(mode === 'records' ? '補完なし' : '最新200件から値を採用し空欄補完')
                        )
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
                    : 'FieldApiName,Label,Type,Value,Status,SourceRecordId,エラー詳細\r\n"Custom__pc"'
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

test('住所・位置情報とその構成項目はクエリなしで整合するサンプルを生成する', async () => {
    const result = await collectRecords(
        describe(
            field('Address', { type: 'address' }),
            field('Location', { type: 'location' }),
            field('City', { compoundFieldName: 'Address' })
        ),
        ['Address', 'Location', 'City'],
        { ...options, mode: 'record-fields-preview' },
        async () => assert.fail('生成対象のクエリは禁止'),
        quiet
    );
    assert.equal(result.generatedOnly, true);
    assert.equal(result.records[0].Address.country, 'JP');
    assert.equal(result.records[0].City, 'サンプル市');
    assert.equal(result.records[0].Location.latitude, 35.681236);
    assert.equal(result.records[0].Location.longitude, 139.767125);
    const csv = toCsv(result, 'record-fields-preview');
    assert.equal((csv.match(/サンプル生成/g) || []).length, 3);
    assert.ok(!csv.includes('generated-preview'));
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
            assert.match(
                result.stdout,
                mode === 'records' ? /補完なし/ : /対応する型はサンプル生成・その他は最新200件から値を採用し空欄補完/
            );
            if (label === 'yes')
                assert.ok(
                    fs
                        .readFileSync(output, 'utf8')
                        .startsWith(
                            mode === 'records'
                                ? '"Name"\r\n'
                                : 'FieldApiName,Label,Type,Value,Status,SourceRecordId,エラー詳細\r\n'
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
        '[1/2項目]\tFill\t補完成功',
        '[3/4項目]\tLong\t補完対象外：非NULL条件で検索不可・最新レコードの値を保持',
        '[2/2項目]\tEmpty\t登録レコードなし'
    ])
        assert.ok(messages.includes(line), line);
    assert.equal(messages.filter((line) => line.startsWith('最新レコードを取得中')).length, 1);
    assert.ok(messages.every((line) => !line.includes('（値取得中）')));
    assert.equal(queries.length, 7);
    assert.ok(messages.every((line) => !/secret-|^空欄補完:|^補完対象外:/.test(line)));
});

test('補完の権限エラーは取得成功や値なしとせず、理由を保存して続行する', async () => {
    for (const [code, reason] of [
        ['INVALID_FIELD', 'API名が存在しない、または項目参照権限がありません'],
        ['INSUFFICIENT_ACCESS', '参照権限がありません']
    ]) {
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
        assert.ok(messages.some((line) => line.includes(`補完スキップ：${reason}`)));
        assert.ok(messages.every((line) => !line.includes('補完成功')));
        assert.match(toCsv(result, 'record-fields-preview'), new RegExp(`補完スキップ[^\r\n]*${code}`));
        assert.equal(calls, 3);
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
                assert.equal(
                    lines[1],
                    '"Missing","","","","取得不可：API名が存在しない、または項目参照権限がありません","",""'
                );
                assert.match(lines[2], /^"Name","Name","string","new","取得成功"/);
                assert.equal(
                    lines[3],
                    '"AlsoMissing","","","","取得不可：API名が存在しない、または項目参照権限がありません","",""'
                );
                assert.match(lines[4], /^"Custom__pc".*"登録レコードなし"/);
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
            else assert.equal(csv.includes('取得不可：API名が存在しない、または項目参照権限がありません'), !empty);
            assert.ok(messages.some((line) => line.startsWith('[1/1項目]\tMissing\t取得不可：')));
        }
    }
});

test('残件数は対話端末の同じ行で更新し、検索中の表示なしで結果を残す', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Id\nName');
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
                                    messages.some((text) => text.includes('補完待ち 1項目')),
                                    true
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
            assert.ok(messages.every((line) => !line.includes('補完検索中')));
            assert.ok(messages.every((line) => !line.includes('検索完了：')));
            const completed = messages.filter((line) => line.startsWith('[1/1項目]'));
            if (fails) {
                assert.equal(completed.length, 1);
                assert.match(completed[0], /^\[1\/1項目\]\tName\t補完失敗：検索失敗 \/ 経過: \d+\.\d秒$/);
            } else assert.deepEqual(completed, ['[1/1項目]\tName\t登録レコードなし']);
            if (isTTY && !fails) {
                assert.ok(terminalWrites.some((text) => text.includes('残り 0項目')));
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
    assert.match(partial, /"Name","Name","string","before","取得成功"/);
    assert.match(partial, /"Custom__pc","Custom__pc","string","","補完待ち",""/);
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
    assert.equal(queries.length, 1);
    assert.ok(queries[0].includes('Custom__pc != NULL'));
    const result = fs.readFileSync(path.join(cwd, 'resume.csv'), 'utf8');
    assert.match(result, /"Name","Name","string","before","取得成功"/);
    assert.match(result, /"Custom__pc","Custom__pc","string","filled","補完成功"/);
    assert.equal(result.split('\r\n').length, 4);
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt', 'resume.csv']);
});

test('初回の分割取得で中断しても、残りの取得とCSV反映を終えてから補完する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    const args = ['--output', 'phases.csv', '--fields-per-query', '1'];
    const base = runnerFor([{ ...newest, Name: null, Custom__pc: 'baseline' }]);
    let resuming = false;
    let supplements = 0;
    const queries = [];
    const runner = async (command) => {
        if (command[0] !== 'data') return base(command);
        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
        queries.push([resuming, query]);
        if (query.includes(' != NULL')) {
            supplements++;
            assert.ok(resuming);
            const partial = fs.readFileSync(path.join(cwd, 'phases.partial.csv'), 'utf8');
            assert.match(partial, /"Name","Name","string","","補完待ち",""/);
            assert.match(partial, /"Custom__pc","Custom__pc","string","baseline","取得成功"/);
            assert.ok(!partial.includes('未処理'));
            return cli(response([{ Id: older.Id, Name: 'filled' }]));
        }
        if (!resuming && query.startsWith('SELECT Id,Custom__pc '))
            throw Object.assign(new Error('auth'), { code: 'AUTH_FAILED' });
        return base(command);
    };
    const settings = { cwd, mode: 'record-fields-preview', runner, createPrompt: approve, writeLine: quiet };
    await assert.rejects(() => main(args, settings), /auth/);
    assert.equal(supplements, 0);
    const partial = fs.readFileSync(path.join(cwd, 'phases.partial.csv'), 'utf8');
    assert.match(partial, /補完待ち/);
    assert.match(partial, /未処理/);
    resuming = true;
    assert.equal(await main([...args, '--resume'], settings), 0);
    const resumed = queries.filter(([resume]) => resume).map(([, query]) => query);
    assert.equal(resumed.length, 2);
    assert.ok(resumed[0].startsWith('SELECT Id,Custom__pc '));
    assert.ok(resumed[1].includes('Name != NULL'));
    assert.equal(supplements, 1);
    const completed = fs.readFileSync(path.join(cwd, 'phases.csv'), 'utf8');
    assert.match(completed, /"Name","Name","string","filled","補完成功"/);
    assert.ok(!completed.includes('PENDING_'));
});

test('200件の候補と採用元を中断後も固定し、分割保存済み項目を再検索しない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Name\nCustom__pc');
    const selected = Array.from({ length: 200 }, (_, i) => ({
        Id: id(1000 - i),
        CreatedDate: '2026-01-01T00:00:00.000+0000',
        Name: i ? `value${i}` : null,
        Custom__pc: i === 199 ? 'last-candidate' : null
    }));
    const base = runnerFor(selected);
    const args = ['--output', 'preview.csv'];
    let resuming = false;
    const resumedQueries = [];
    const runner = async (command) => {
        if (command[0] !== 'data') return base(command);
        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
        if (resuming) resumedQueries.push(query);
        if (query.startsWith('SELECT Id,Name,Custom__pc '))
            throw Object.assign(new Error('complex'), { code: 'QUERY_TOO_COMPLICATED' });
        if (!resuming && query.startsWith('SELECT Id,Custom__pc '))
            throw Object.assign(new Error('interrupted'), { code: 'AUTH_FAILED' });
        return base(command);
    };
    const settings = { cwd, mode: 'record-fields-preview', runner, createPrompt: approve, writeLine: quiet };
    await assert.rejects(() => main(args, settings), /interrupted/);
    const partial = fs.readFileSync(path.join(cwd, 'preview.partial.csv'), 'utf8');
    assert.ok(partial.includes(`"value1","補完成功","${selected[1].Id}"`));
    assert.match(partial, /"Custom__pc","Custom__pc","string","","未処理"/);
    resuming = true;
    assert.equal(await main([...args, '--resume'], settings), 0);
    assert.equal(resumedQueries.length, 1);
    assert.ok(resumedQueries[0].startsWith('SELECT Id,Custom__pc '));
    assert.ok(resumedQueries[0].includes(`Id IN (${selected.map((row) => `'${row.Id}'`).join(',')})`));
    const completed = fs.readFileSync(path.join(cwd, 'preview.csv'), 'utf8');
    assert.ok(completed.includes(`"value1","補完成功","${selected[1].Id}"`));
    assert.ok(completed.includes(`"last-candidate","補完成功","${selected[199].Id}"`));
    assert.equal(completed.trimEnd().split('\r\n').length, 3);
    assert.deepEqual(fs.readdirSync(cwd), ['fields.txt', 'preview.csv']);
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
                    if (query.includes(older.Id))
                        throw Object.assign(new Error('timeout'), {
                            code: 'CLI_TIMEOUT',
                            diagnostic: '終了コード: 1 / 識別子: OriginalTimeout'
                        });
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

test('既知の認証・検索エラーは格納場所によらず分類し、自由文から推測しない', async () => {
    for (const code of ['INVALID_SESSION_ID', 'NoAuthorizationError', 'REQUEST_LIMIT_EXCEEDED']) {
        for (const key of ['name', 'code', 'errorCode']) {
            for (let depth = 0; depth <= 2; depth++) {
                let body = { [key]: code };
                for (let level = 0; level < depth; level++) body = { name: 'Error', cause: body };
                await assert.rejects(
                    () => callSf([], '.', async () => ({ status: 1, stdout: JSON.stringify(body) })),
                    (error) => {
                        assert.equal(error.code, code === 'REQUEST_LIMIT_EXCEEDED' ? code : 'AUTH_FAILED');
                        assert.ok(error.diagnostic.includes(`識別子: ${code}`));
                        return true;
                    }
                );
            }
        }
    }
    await assert.rejects(
        () =>
            callSf([], '.', async () => ({
                status: 1,
                stdout: JSON.stringify({ name: 'Error', message: 'INVALID_SESSION_ID' })
            })),
        (error) => error.code === 'CLI_FAILED'
    );
});

test('CLIとSalesforceのタイムアウトを区別し、安全な診断と経過時間を残す', async () => {
    for (const [response, code] of [
        [
            { status: 1, stdout: JSON.stringify({ name: 'QUERY_TIMEOUT', message: "Failure for 'secret-value'" }) },
            'QUERY_TIMEOUT'
        ],
        [
            {
                status: 1,
                stdout: JSON.stringify({ name: 'Error', code: 'ETIMEDOUT', message: "Failure for 'secret-value'" })
            },
            'NETWORK_TIMEOUT'
        ],
        [{ status: null, error: { killed: true, signal: 'SIGTERM' } }, 'CLI_TIMEOUT'],
        [
            {
                status: 1,
                stdout: JSON.stringify({ name: 'UnexpectedCliError', message: "Failure for 'secret-value'" })
            },
            'CLI_FAILED'
        ],
        [
            {
                status: 1,
                stdout: JSON.stringify({
                    name: 'https://private.invalid/secret-value',
                    message: "Failure for 'secret-value'"
                })
            },
            'CLI_FAILED'
        ]
    ]) {
        await assert.rejects(
            () => callSf([], '.', async () => response),
            (error) => {
                assert.equal(error.code, code);
                assert.match(error.message, /CLI経過: \d+\.\d秒/);
                assert.match(error.diagnostic, /CLI経過: \d+\.\d秒/);
                assert.match(error.diagnostic, /待機上限:/);
                assert.ok(!error.diagnostic.includes('secret-value'));
                assert.ok(!error.message.includes('secret-value'));
                if (response.stdout?.includes('UnexpectedCliError'))
                    assert.match(error.message, /識別子: UnexpectedCliError/);
                return true;
            }
        );
    }
});

test('独立した非NULL検索を一項目ずつ送信し、値なし・成功・一項目の失敗を混ぜない', async () => {
    const fields = Array.from({ length: 12 }, (_, i) => field(`F${i}`));
    const saved = [],
        supplements = [];
    const query = async (soql) =>
        soql.startsWith('SELECT Id,CreatedDate')
            ? response([newest])
            : response([{ Id: newest.Id, ...Object.fromEntries(fields.map((f) => [f.name, null])) }]);
    query.supplement = async (soql) => {
        assert.equal(saved.filter((row) => !row.replace).length, fields.length);
        supplements.push(soql);
        assert.ok(!soql.includes(' OR '));
        const name = /^SELECT Id,(\w+) FROM/.exec(soql)[1];
        assert.ok(soql.includes(`WHERE ${name} != NULL ORDER BY`));
        if (name === 'F0') return response([]);
        if (name === 'F1') throw Object.assign(new Error('timeout'), { code: 'QUERY_TIMEOUT' });
        return response([{ Id: older.Id, [name]: name }]);
    };
    await collectValidatedRecords(
        describe(...fields),
        fields,
        { ...options, mode: 'record-fields-preview', fieldsPerQuery: 3 },
        query,
        quiet,
        async (_id, group, record, _sources, _latest, statuses, update) =>
            saved.push(
                ...group.map((item) => ({
                    name: item.name,
                    value: record[item.name],
                    status: statuses.get(item.name),
                    replace: update?.replace
                }))
            )
    );
    assert.deepEqual(
        supplements.map((soql) => /^SELECT Id,(\w+) FROM/.exec(soql)[1]),
        fields.map((f) => f.name)
    );
    assert.deepEqual(
        saved.slice(0, 12).map((r) => r.name),
        fields.map((f) => f.name)
    );
    assert.equal(saved[0].value, null);
    assert.ok(saved.slice(0, 12).every((r) => r.status === 'PENDING_SUPPLEMENT' && !r.replace));
    assert.equal(saved[13].status, 'SKIPPED_QUERY_TIMEOUT');
    assert.equal(saved.at(-1).name, 'F11');
    assert.equal(saved.at(-1).value, 'F11');
    assert.equal(saved.at(-1).replace, true);
    assert.equal(supplements.filter((q) => q.includes('F0 != NULL')).length, 1);
    assert.equal(supplements.filter((q) => q.includes('F2 != NULL')).length, 1);
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

test('補完のCLI失敗・時間超過を次項目へ波及させず、成功値をCSVへ保存する', async (t) => {
    for (const [code, reason] of [
        ['CLI_FAILED', 'CLI実行失敗'],
        ['SUPPLEMENT_TIMEOUT', '補完待機時間超過'],
        ['QUERY_TIMEOUT', '検索タイムアウト'],
        ['NETWORK_TIMEOUT', '通信タイムアウト'],
        ['NETWORK_ERROR', '通信エラー']
    ]) {
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
                            if (query.includes('Name != NULL')) throw Object.assign(new Error('mock'), { code });
                            assert.ok(query.includes('Custom__pc != NULL'));
                            return cli(response([{ Id: older.Id, Custom__pc: 'recovered' }]));
                        }
                    }
                    return runner(command);
                }
            }),
            1
        );
        assert.equal(supplements, 2);
        const index = messages.findIndex((line) => line.startsWith(`[1/2項目]\tName\t補完スキップ：${reason} / `));
        assert.ok(index >= 0);
        assert.ok(!messages[index].includes(code));
        assert.ok(messages.every((line) => !/^検索エラー:|^CLI失敗の診断|^CLIエラー内容:/.test(line)));
        const csv = fs.readFileSync(path.join(cwd, 'skipped.csv'), 'utf8');
        assert.equal((csv.match(new RegExp(`補完スキップ[^\r\n]*${code}`, 'g')) || []).length, 1);
        assert.match(csv, /"Custom__pc","Custom__pc","string","recovered","補完成功"/);
        assert.ok(!csv.includes('登録レコードなし'));
        assert.ok(messages.some((line) => line.includes('全項目の処理と保存は完了')));
        assert.ok(!fs.existsSync(path.join(cwd, 'skipped.csv.resume')));
    }
});

test('MasterRecordIdも特別扱いせず個別補完に含め、空欄と実値を通常どおり扱う', async () => {
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

test('補完検索中の表示と定期表示なしでも待機期限とスキップを維持する', async (t) => {
    const { resolvePreviewValue, SUPPLEMENT_TIMEOUT_MS } = require('../internal/preview-values');
    t.mock.method(global, 'setInterval', () => assert.fail('補完の定期表示は不要'));
    let now = 0;
    t.mock.method(performance, 'now', () => now);
    const settings = {
        scope: [],
        hasValue: (value) => value != null,
        searchSupplement: async (_field, _scope, controls) => {
            assert.equal(controls.deadline, now + SUPPLEMENT_TIMEOUT_MS);
            now += SUPPLEMENT_TIMEOUT_MS;
            throw Object.assign(new Error('timeout'), { code: 'SUPPLEMENT_TIMEOUT' });
        }
    };
    assert.deepEqual(await resolvePreviewValue({ ...settings, field: field('A') }), {
        skipped: 'SUPPLEMENT_TIMEOUT',
        diagnostic: '分類コード: SUPPLEMENT_TIMEOUT / 詳細情報なし',
        elapsedSeconds: '60.0'
    });
    assert.deepEqual(await resolvePreviewValue({ ...settings, field: field('B') }), {
        skipped: 'SUPPLEMENT_TIMEOUT',
        diagnostic: '分類コード: SUPPLEMENT_TIMEOUT / 詳細情報なし',
        elapsedSeconds: '60.0'
    });
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
        ['Unexpected response while reading query results', 'CLI_FAILED']
    ]) {
        await assert.rejects(
            () => callSf(['api'], '.', async () => ({ status: 1, stdout: '', stderr })),
            (error) => {
                assert.equal(error.code, code);
                assert.match(error.message, /終了コード: 1/);
                assert.match(error.message, /応答形式: 空/);
                assert.ok(!error.message.includes('private-value'));
                if (code === 'CLI_FAILED') assert.ok(error.message.includes(stderr));
                return true;
            }
        );
    }
});

test('標準エラーのJSON・色付き例外・未知コードから原因を残し、本文の実値は表示しない', async () => {
    for (const [stderr, code, detail] of [
        [
            JSON.stringify({ name: 'RequestError', code: 'ETIMEDOUT', message: "Failure for 'secret-value'" }),
            'NETWORK_TIMEOUT',
            'ETIMEDOUT'
        ],
        [
            "\u001b[31mTimeoutError: Timeout awaiting 'request' for 60000ms https://secret.invalid\u001b[0m",
            'NETWORK_TIMEOUT',
            "CLI原因: Timeout awaiting 'request' for 60000ms"
        ],
        ['Error: Request timed out. https://secret.invalid', 'NETWORK_TIMEOUT', 'CLI原因: Request timed out'],
        ['Error: socket hang up\nsecret-value', 'NETWORK_ERROR', 'CLI原因: socket hang up'],
        ["Error (UnexpectedCliError): Failed to process 'secret-value'", 'CLI_FAILED', 'UnexpectedCliError'],
        [
            "RequestError: Failed to process 'secret-value'\n  code: 'UNKNOWN_TRANSPORT_ERROR'",
            'CLI_FAILED',
            'UNKNOWN_TRANSPORT_ERROR'
        ],
        [
            JSON.stringify({ name: 'INVALID_SESSION_ID', message: "Failure for 'secret-value'" }),
            'AUTH_FAILED',
            'INVALID_SESSION_ID'
        ]
    ]) {
        await assert.rejects(
            () => callSf(['api'], '.', async () => ({ status: 1, stdout: '', stderr })),
            (error) => {
                assert.equal(error.code, code);
                assert.ok(error.diagnostic.includes(detail), error.diagnostic);
                assert.ok(!error.diagnostic.includes('secret'));
                assert.ok(!error.message.includes('secret'));
                return true;
            }
        );
    }
});

test('未知のCLIエラー文を残し、認証値・接続先・ID・引用値を伏せる', async () => {
    const stderr = [
        'Unexpected transport failure while reading response',
        'access_token=private-token',
        'Authorization: Bearer private-bearer',
        'https://private.example.invalid/path user@example.invalid',
        '001000000000001AAA',
        "Failed for 'private-value'",
        '/Users/private-user/project/file.js',
        "SELECT Id FROM Account WHERE Id = '001000000000001AAA'"
    ].join('\n');
    await assert.rejects(
        () => callSf(['data', 'query'], '.', async () => ({ status: 1, stdout: '', stderr })),
        (error) => {
            assert.equal(error.code, 'CLI_FAILED');
            assert.match(error.diagnostic, /CLIエラー内容: Unexpected transport failure while reading response/);
            assert.ok(!error.diagnostic.includes('private'));
            assert.ok(!error.diagnostic.includes('example.invalid'));
            assert.ok(!error.diagnostic.includes('001000000000001AAA'));
            assert.ok(!error.diagnostic.includes('SELECT Id'));
            assert.ok(!error.diagnostic.includes('抽出できませんでした'));
            return true;
        }
    );
});

test('CLIが時間切れのSIGTERMを捕捉して終了コード1を返しても補完期限として診断する', async () => {
    const { runSfWithOutputAsync } = require('../../common/run-command');
    // OS固有のシグナル処理に依存せず、数値終了時にexecFileが返す状態を再現する。
    const runner = () =>
        runSfWithOutputAsync([], '.', (_command, _args, _options, callback) => {
            callback(
                Object.assign(new Error('interrupted'), { code: 1, killed: true, signal: null }),
                '',
                'Error: interrupted'
            );
        });
    await assert.rejects(
        () => callSf(['api'], '.', runner, 'record-fields-preview', { deadline: performance.now() + 60000 }),
        (error) => {
            assert.equal(error.code, 'SUPPLEMENT_TIMEOUT');
            assert.match(error.diagnostic, /終了コード: 1/);
            assert.match(error.diagnostic, /応答形式: 空/);
            assert.match(error.diagnostic, /標準エラー: あり/);
            return true;
        }
    );
});

test('補完スキップ直後にCLIの原因文だけを表示し、診断の羅列と終了時の再表示はしない', async (t) => {
    for (const [causeCode, expected, reason] of [
        ['ECONNRESET', 'NETWORK_ERROR', '通信エラー'],
        ['ETIMEDOUT', 'NETWORK_TIMEOUT', '通信タイムアウト'],
        ['UnknownError', 'CLI_FAILED', 'CLI実行失敗']
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
                                cause: { cause: { code: causeCode, message: "Failure for 'secret-value'" } }
                            })
                        };
                    }
                }
                return runner(command);
            }
        });
        assert.equal(status, 1);
        for (const name of ['Name', 'Custom__pc']) {
            const index = messages.findIndex((line) => line.includes(`\t${name}\t補完スキップ：${reason}`));
            assert.ok(index >= 0);
            if (expected === 'CLI_FAILED') assert.equal(messages[index + 1], 'CLIエラー内容: Failure for [引用値]');
            else assert.ok(!messages[index + 1].startsWith('CLIエラー内容:'));
        }
        assert.ok(messages.every((line) => !/^検索エラー:|^CLI失敗の診断/.test(line)));
        assert.ok(!messages.join('\n').includes('応答形式:'));
        assert.equal(
            messages.filter((line) => line.startsWith('CLIエラー内容:')).length,
            expected === 'CLI_FAILED' ? 2 : 0
        );
        assert.ok(!messages.join('\n').includes('secret-value'));
        const csv = fs.readFileSync(path.join(cwd, 'failed.csv'), 'utf8');
        assert.equal((csv.match(new RegExp(`補完スキップ[^\r\n]*${expected}`, 'g')) || []).length, 2);
        assert.ok(!csv.includes('登録レコードなし'));
        assert.ok(csv.includes('終了コード: 1'));
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

test('検索失敗を確定した後に中断しても、再開時は未検索項目だけを処理する', async (t) => {
    const cwd = temporary(t);
    const extras = ['F1', 'F2', 'F3', 'F4'];
    fs.writeFileSync(path.join(cwd, 'fields.txt'), ['Name', ...extras, 'Custom__pc'].join('\n'));
    const base = runnerFor([
        { ...newest, Name: null, Custom__pc: null, ...Object.fromEntries(extras.map((name) => [name, null])) }
    ]);
    const args = ['--output', 'resume-deferred.csv', '--fields-per-query', '1'];
    let resuming = false;
    const queries = [];
    const runner = async (command) => {
        if (command[0] === 'sobject')
            return cli(describe(field('Name'), field('Custom__pc'), ...extras.map((name) => field(name))));
        if (command[0] === 'data') {
            const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
            queries.push([resuming, query]);
            if (query.includes('Name != NULL'))
                throw Object.assign(new Error('timeout'), {
                    code: 'CLI_TIMEOUT',
                    diagnostic: '終了コード: 1 / 識別子: OriginalTimeout'
                });
            if (query.includes('Custom__pc != NULL') && !resuming)
                throw Object.assign(new Error('auth'), { code: 'AUTH_FAILED' });
        }
        return base(command);
    };
    await assert.rejects(
        () => main(args, { cwd, mode: 'record-fields-preview', runner, createPrompt: approve, writeLine: quiet }),
        /auth/
    );
    assert.match(
        fs.readFileSync(path.join(cwd, 'resume-deferred.partial.csv'), 'utf8'),
        /補完スキップ：CLI待機時間超過（CLI_TIMEOUT）/
    );
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
    assert.equal(resumed.filter((query) => query.includes('Name')).length, 0);
    assert.ok(resumed.at(-1).includes('Custom__pc != NULL'));
    const csv = fs.readFileSync(path.join(cwd, 'resume-deferred.csv'), 'utf8');
    assert.match(csv, /補完スキップ：CLI待機時間超過（CLI_TIMEOUT）/);
    assert.match(csv, /終了コード: 1 \/ 識別子: OriginalTimeout/);
    assert.match(csv, /補完経過: \d+\.\d秒/);
    assert.ok(!csv.includes('PENDING_RETRY'));
    assert.equal(csv.split('\r\n').length, 8);
});

test('1300項目中1200項目の空欄を一項目ずつ検索し、各項目を一度だけ確定する', async () => {
    const fields = Array.from({ length: 1300 }, (_, i) => field(`F${String(i).padStart(36, '0')}__c`));
    const saved = [],
        queried = new Set();
    let supplements = 0,
        baseCalls = 0;
    const query = async (soql) => {
        baseCalls++;
        if (soql.startsWith('SELECT Id,CreatedDate')) return response([newest]);
        return response([
            { Id: newest.Id, ...Object.fromEntries(fields.map((f, i) => [f.name, i < 100 ? 'base' : null])) }
        ]);
    };
    query.supplement = async (soql) => {
        assert.equal(saved.slice(0, 1300).length, 1300);
        supplements++;
        const name = /^SELECT Id,(\w+) FROM/.exec(soql)[1];
        assert.ok(!queried.has(name));
        queried.add(name);
        return response([{ Id: older.Id, [name]: 'filled' }]);
    };
    await collectValidatedRecords(
        describe(...fields),
        fields,
        { mode: 'record-fields-preview', recordLimit: 1 },
        query,
        quiet,
        async (_id, group, record) => saved.push(...group.map((item) => [item.name, record[item.name]]))
    );
    assert.equal(baseCalls, 2);
    assert.equal(supplements, 1200);
    assert.equal(queried.size, 1200);
    assert.deepEqual(
        saved.slice(0, 1300).map((r) => r[0]),
        fields.map((f) => f.name)
    );
    assert.ok(saved.slice(0, 1300).every((r, i) => r[1] === (i < 100 ? 'base' : null)));
    assert.deepEqual(
        saved.slice(1300).map((r) => r[0]),
        fields.slice(100).map((f) => f.name)
    );
    assert.ok(saved.slice(1300).every((r) => r[1] === 'filled'));
});

test('補完途中の中断でも置換済み行を復元し、同じ項目を二重検索・二重出力しない', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'A\nB\nC\nD\nE\nF');
    let phase = 0;
    const queried = [];
    const runner = async (command) => {
        if (command[0] === 'config') return runnerFor()(command);
        if (command[0] === 'org') return cli(orgList());
        if (command[0] === 'sobject')
            return cli(describe(...['A', 'B', 'C', 'D', 'E', 'F'].map((name) => field(name))));
        const query = fs.readFileSync(command[command.indexOf('--file') + 1], 'utf8');
        queried.push([phase, query]);
        if (query.startsWith('SELECT Id,CreatedDate')) return cli(response([newest]));
        if (query.includes(`Id = '${newest.Id}'`))
            return cli(response([{ Id: newest.Id, A: null, B: null, C: null, D: null, E: null, F: null }]));
        if (!phase && query.includes('F != NULL')) throw Object.assign(new Error('auth'), { code: 'AUTH_FAILED' });
        if (phase) assert.ok(query.includes('F != NULL'));
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
    assert.equal((csv.match(/補完成功/g) || []).length, 6);
    assert.ok(!csv.includes('PENDING_RETRY'));
    assert.deepEqual(
        csv
            .trimEnd()
            .split('\r\n')
            .slice(1)
            .map((line) => line.split(',')[0]),
        ['"A"', '"B"', '"C"', '"D"', '"E"', '"F"']
    );
    assert.ok(queried.filter(([stage]) => stage).every(([, query]) => query.includes(' != NULL')));
});

test('生成対象は初回・補完クエリから除外し、初回結果を取得範囲ごとに一度保存する', async () => {
    const definition = describe(
        field('Email', { type: 'email' }),
        field('Fax', { type: 'phone' }),
        field('Choice', {
            type: 'picklist',
            picklistValues: [
                { value: 'inactive', active: false, defaultValue: true },
                { value: 'first', active: true },
                { value: 'default', active: true, defaultValue: true }
            ]
        }),
        field('ShortText', { type: 'textarea' }),
        field('LongText', { type: 'textarea', filterable: false }),
        field('RichText', { type: 'textarea', filterable: false, htmlFormatted: true }),
        field('Description')
    );
    const settings = { mode: 'record-fields-preview', recordLimit: 1 };
    const fields = validateDescribe(
        definition,
        ['Email', 'Fax', 'Choice', 'ShortText', 'LongText', 'RichText', 'Description'],
        settings
    );
    const writes = [],
        queries = [],
        messages = [];
    const query = async (soql) => {
        queries.push(soql);
        assert.ok(!/Email|Fax|Choice|ShortText|LongText|RichText/.test(soql));
        return soql.startsWith('SELECT Id,CreatedDate')
            ? response([newest])
            : response([{ Id: newest.Id, Description: null }]);
    };
    query.supplement = async (soql) => {
        assert.equal(writes.length, 1);
        assert.deepEqual(
            writes[0].names,
            fields.map((f) => f.name)
        );
        assert.ok(soql.includes('Description != NULL'));
        return response([{ Id: older.Id, Description: 'demo text' }]);
    };
    await collectValidatedRecords(
        definition,
        fields,
        settings,
        query,
        (line) => messages.push(line),
        async (_id, group, record, sources, _latest, statuses, update) =>
            writes.push({
                names: group.map((f) => f.name),
                record: { ...record },
                sources: new Map(sources),
                statuses: new Map(statuses),
                update
            })
    );
    assert.equal(queries.length, 2);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].record.Email, 'demo@example.com');
    assert.equal(writes[0].record.Fax, '000-0000-0000');
    assert.equal(writes[0].record.Choice, 'default');
    assert.equal(writes[0].sources.get('Email'), '');
    for (const [name, value] of [
        ['ShortText', '(テキストエリアのサンプル)'],
        ['LongText', '(ロングテキストのサンプル)'],
        ['RichText', '(リッチテキストのサンプル)']
    ]) {
        assert.equal(writes[0].record[name], value);
        assert.equal(writes[0].statuses.get(name), 'GENERATED');
        assert.equal(writes[0].sources.get(name), '');
    }
    assert.equal(writes[1].update.replace, true);
    assert.ok(messages.includes('[1/1項目]\tDescription\t補完成功'));
    assert.ok(messages.every((line) => !line.includes('再試行')));
});

test('カスタム住所と位置情報の構成項目・選択肢なしも検索せず生成状態を返す', () => {
    const { sampleForField } = require('../internal/preview-values');
    const definitions = new Map([
        ['ns__address__c', field('ns__Address__c', { type: 'address' })],
        ['ns__geo__c', field('ns__Geo__c', { type: 'location' })],
        ['location', field('Location', { type: 'location' })]
    ]);
    for (const [name, parent, expected] of [
        ['ns__Address__CountryCode__s', 'ns__Address__c', 'JP'],
        ['ns__Address__Street__s', 'ns__Address__c', 'サンプル町1-2-3'],
        ['ns__Address__Latitude__s', 'ns__Address__c', 35.681236],
        ['ns__Geo__Longitude__s', 'ns__Geo__c', 139.767125],
        ['Latitude', 'Location', 35.681236],
        ['Longitude', 'Location', 139.767125]
    ])
        assert.deepEqual(sampleForField(field(name, { compoundFieldName: parent }), definitions), {
            value: expected,
            status: 'GENERATED'
        });
    assert.equal(sampleForField(field('MailAsText'), definitions), undefined);
    assert.equal(sampleForField(field('Latitude', { type: 'double' }), definitions), undefined);
    assert.deepEqual(
        sampleForField(
            field('EmptyChoice', { type: 'multipicklist', picklistValues: [{ value: 'old', active: false }] }),
            definitions
        ),
        { value: null, status: 'NO_PICKLIST_VALUE' }
    );
    assert.deepEqual(
        sampleForField(
            field('Multi', { type: 'multipicklist', picklistValues: [{ value: 'first', active: true }] }),
            definitions
        ),
        { value: 'first', status: 'GENERATED' }
    );
});

test('生成対象だけのプレビューはレコード検索なしでCSVを作り、公開失敗後も検索せず再開する', async (t) => {
    const cwd = temporary(t);
    fs.writeFileSync(path.join(cwd, 'fields.txt'), 'Email\nFax');
    const base = runnerFor([]);
    const args = ['--output', 'generated.csv'];
    const runner = async (command) => {
        if (command[0] === 'sobject')
            return cli(describe(field('Email', { type: 'email' }), field('Fax', { type: 'phone' })));
        if (command[0] === 'data' || command[0] === 'api') assert.fail('生成だけならレコード検索しない');
        return base(command);
    };
    const settings = { cwd, mode: 'record-fields-preview', runner, writeLine: quiet, createPrompt: approve };
    const link = t.mock.method(fs, 'linkSync', () => {
        throw new Error('publish failed');
    });
    await assert.rejects(() => main(args, settings), /publish failed/);
    link.mock.restore();
    const partial = fs.readFileSync(path.join(cwd, 'generated.partial.csv'), 'utf8');
    assert.match(partial, /"Email","Email","email","demo@example.com","サンプル生成",""/);
    assert.ok(!partial.includes('generated-preview'));
    assert.equal(await main([...args, '--resume'], settings), 0);
    assert.equal(fs.readFileSync(path.join(cwd, 'generated.csv'), 'utf8'), partial);
});

test('横型ではメール・電話・テキストエリアも実値のまま取得する', async () => {
    const definition = describe(
        field('Email', { type: 'email' }),
        field('Phone', { type: 'phone' }),
        field('Description', { type: 'textarea', filterable: false })
    );
    const result = await collectRecords(
        definition,
        ['Email', 'Phone', 'Description'],
        { mode: 'records', recordLimit: 1 },
        async (soql) => {
            if (soql.startsWith('SELECT Id,CreatedDate')) return response([newest]);
            assert.ok(soql.includes('Email,Phone,Description'));
            return response([
                {
                    Id: newest.Id,
                    Email: 'original@example.com',
                    Phone: '0123456789',
                    Description: '元の説明文\n改行あり'
                }
            ]);
        },
        quiet
    );
    assert.equal(result.records[0].Email, 'original@example.com');
    assert.equal(result.records[0].Phone, '0123456789');
    assert.equal(result.records[0].Description, '元の説明文\n改行あり');
    assert.equal(result.statuses.size, 0);
});
