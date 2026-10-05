const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { collectRecords, toCsv } = require('../internal/collector');
const { createCsvSpool } = require('../internal/csv-spool');
const { createQueryClient, RESPONSE_LIMIT } = require('../internal/query-client');
const ids = [3, 2, 1].map((n) => '001' + String(n).padStart(15, '0'));
const fields = ['Long', 'Name', 'Flag'].map((name) => ({ name, label: name, type: 'string', filterable: true }));
const data = ids.map((Id, i) => ({
    Id,
    CreatedDate: '2026-01-01T00:00:00Z',
    Long: `${i},"\r\n長文`,
    Name: `name-${i}`,
    Flag: false
}));
const quiet = () => {};
const response = (records) => ({ records, totalSize: records.length, done: true });
const error = (code) => Object.assign(new Error(code), { code });
function temp(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}
function composite(body, status = 200) {
    return { compositeResponse: [{ referenceId: 'records', httpStatusCode: status, body }] };
}

test('サイズ・複雑さによる再分割後もIDと項目順で完全なCSVを生成する', async (t) => {
    const dir = temp(t),
        spool = createCsvSpool(dir, fields, 'records');
    const calls = [];
    const result = await collectRecords(
        { name: 'Account' },
        fields,
        { mode: 'records', recordLimit: 3 },
        async (soql) => {
            calls.push(soql);
            if (soql.startsWith('SELECT Id,CreatedDate'))
                return response(data.map(({ Id, CreatedDate }) => ({ Id, CreatedDate })));
            const requested = [...soql.matchAll(/'(001\d{15})'/g)].map((m) => m[1]);
            if (requested.length > 1) throw error('BUFFER_LIMIT');
            const names = soql.match(/^SELECT (.+) FROM/)[1].split(',');
            if (names.length > 3) throw error('QUERY_TOO_COMPLICATED');
            return response(
                data
                    .filter((row) => requested.includes(row.Id))
                    .reverse()
                    .map((row) => Object.fromEntries(names.map((name) => [name, row[name]])))
            );
        },
        quiet,
        spool.append
    );
    assert.equal(result.records.length, 0);
    assert.deepEqual(result.ids, ids);
    assert.ok(calls[1].includes('Id,Long,Name,Flag'));
    const output = path.join(dir, 'result.csv');
    spool.finish(result.ids, output);
    assert.equal(fs.readFileSync(output, 'utf8'), toCsv({ fields, records: data }, 'records'));
    assert.throws(() => spool.finish(result.ids, output), /EEXIST/);
});

test('認証エラーと最小単位のサイズエラーは再分割し続けない', async () => {
    for (const code of ['AUTH_FAILED', 'INVALID_FIELD', 'CLI_TIMEOUT', 'BUFFER_LIMIT', 'QUERY_TOO_COMPLICATED']) {
        let count = 0;
        await assert.rejects(
            () =>
                collectRecords(
                    { name: 'Account' },
                    [fields[0]],
                    { mode: 'records', recordLimit: 1 },
                    async () => {
                        if (++count === 1) return response([data[0]]);
                        throw error(code);
                    },
                    quiet
                ),
            (e) => e.code === code
        );
        assert.equal(count, 2);
    }
});

test('CSV断片の欠落と順序違反を完成品として公開しない', (t) => {
    const dir = temp(t),
        spool = createCsvSpool(dir, fields, 'records');
    assert.throws(() => spool.append(ids[0], [fields[1]], data[0]), /順序/);
    spool.append(ids[0], [fields[0]], data[0]);
    assert.throws(() => spool.finish([ids[0]], path.join(dir, 'out.csv')), /揃って/);
    assert.equal(fs.existsSync(path.join(dir, 'out.csv')), false);
});

test('CompositeのPOST本文で検索しQuery Moreを重複なく取得する', async (t) => {
    const dir = temp(t),
        requests = [];
    const pages = [
        { records: [data[0]], totalSize: 2, done: false, nextRecordsUrl: '/services/data/v67.0/query/test-1' },
        { records: [data[1]], totalSize: 2, done: true }
    ];
    const query = createQueryClient(
        dir,
        'test-org',
        async (args) => {
            assert.deepEqual(args.slice(0, 4), ['api', 'request', 'rest', '/services/data/v67.0/composite']);
            assert.equal(args[args.indexOf('--method') + 1], 'POST');
            requests.push(JSON.parse(fs.readFileSync(args[args.indexOf('--body') + 1].slice(1), 'utf8')));
            assert.ok(!args.includes('--stream-to-file'));
            return { statusCode: 200, body: composite(pages.shift()) };
        },
        '/services/data/v67.0/sobjects/Account'
    );
    const soql = 'SELECT Id,Name FROM Account LIMIT 2';
    const result = await query(soql);
    assert.ok(requests[0].compositeRequest[0].url.startsWith('/services/data/v67.0/query/?q='));
    assert.equal(decodeURIComponent(requests[0].compositeRequest[0].url.split('?q=')[1]), soql);
    assert.equal(requests[1].compositeRequest[0].url, '/services/data/v67.0/query/test-1');
    assert.deepEqual(result.records, [data[0], data[1]]);
});

test('CompositeのHTTPエラー・不正ページ・不正JSONは安全に停止する', async (t) => {
    const dir = temp(t);
    for (const body of [
        composite([{ errorCode: 'QUERY_TOO_COMPLICATED', message: 'sensitive' }], 400),
        composite([{ errorCode: 'QUERY_TIMEOUT', message: 'sensitive' }], 400),
        composite([{ errorCode: 'OTHER', message: 'sensitive' }], 400),
        [{ errorCode: 'INVALID_SESSION_ID', message: 'sensitive' }],
        composite({ records: [data[0]], totalSize: 1, done: false, nextRecordsUrl: 'https://example.com' }),
        composite({ records: [], totalSize: 1, done: true }),
        'sensitive invalid JSON'
    ]) {
        const query = createQueryClient(
            dir,
            'test',
            async () => ({ statusCode: 200, body }),
            '/services/data/v67.0/sobjects/Account'
        );
        await assert.rejects(
            () => query('SELECT Id FROM Account'),
            (e) => !e.message.includes('sensitive') && typeof e.code === 'string'
        );
    }
});

test('複数ページの合計サイズ超過を分割処理へ渡す', async (t) => {
    const dir = temp(t);
    let calls = 0;
    const text = 'a'.repeat(RESPONSE_LIMIT / 32);
    const query = createQueryClient(
        dir,
        'test',
        async () => ({
            statusCode: 200,
            body: composite({
                records: [{ Id: String(++calls), Long__c: text }],
                totalSize: 33,
                done: false,
                nextRecordsUrl: `/services/data/v67.0/query/page-${calls}`
            })
        }),
        '/services/data/v67.0/sobjects/Account'
    );
    await assert.rejects(
        () => query('SELECT Id FROM Account'),
        (e) => e.code === 'BUFFER_LIMIT'
    );
});

test('プレビューの分割断片でも引用符・改行・元レコードと補完元を保持する', (t) => {
    const dir = temp(t),
        spool = createCsvSpool(dir, fields, 'record-fields-preview');
    const sources = new Map(fields.map((f, i) => [f.name, i === 1 ? ids[1] : ids[0]]));
    spool.append(ids[0], fields.slice(0, 1), data[0], sources, ids[0]);
    spool.append(ids[0], fields.slice(1), data[0], sources, ids[0]);
    const output = path.join(dir, 'preview.csv');
    spool.finish([ids[0]], output);
    assert.equal(
        fs.readFileSync(output, 'utf8'),
        toCsv({ fields, records: [data[0]], sources, latestId: ids[0] }, 'record-fields-preview')
    );
});

test('保存時の失敗をクエリ再試行にせずそのまま停止する', async () => {
    let calls = 0;
    await assert.rejects(
        () =>
            collectRecords(
                { name: 'Account' },
                fields,
                { mode: 'records', recordLimit: 1 },
                async () => {
                    calls++;
                    return response([data[0]]);
                },
                quiet,
                () => {
                    throw error('ENOSPC');
                }
            ),
        (e) => e.code === 'ENOSPC'
    );
    assert.equal(calls, 2);
});

test('DescribeのAPIバージョンが不明・不正なら検索を開始しない', () => {
    for (const url of [
        undefined,
        '',
        'https://example.com/services/data/v67.0/sobjects/User',
        '/services/data/v67.0/sobjects/User/../Account'
    ]) {
        assert.throws(() => createQueryClient('', 'test', () => assert.fail(), url), /APIバージョン/);
    }
});

test('5本の独立検索を順序固定で送り、逆順の応答と一項目エラーも参照IDで照合する', async (t) => {
    const dir = temp(t);
    let calls = 0;
    const query = createQueryClient(
        dir,
        'test',
        async (args) => {
            calls++;
            const body = JSON.parse(fs.readFileSync(args[args.indexOf('--body') + 1].slice(1), 'utf8'));
            assert.equal(body.collateSubrequests, false);
            assert.equal(body.allOrNone, false);
            assert.equal(body.compositeRequest.length, 5);
            return {
                statusCode: 200,
                body: {
                    compositeResponse: body.compositeRequest
                        .map((part, i) => ({
                            referenceId: part.referenceId,
                            httpStatusCode: i === 1 ? 400 : 200,
                            body:
                                i === 1
                                    ? [{ errorCode: 'QUERY_TIMEOUT', message: 'private-value' }]
                                    : {
                                          records: i === 0 ? [] : [{ Id: String(i) }],
                                          totalSize: i === 0 ? 0 : 1,
                                          done: true
                                      }
                        }))
                        .reverse()
                }
            };
        },
        '/services/data/v67.0/sobjects/Account'
    );
    const results = await query.batch(
        Array.from({ length: 5 }, (_, i) => `SELECT Id,F${i} FROM Account WHERE F${i} != NULL LIMIT 1`)
    );
    assert.equal(calls, 1);
    assert.equal(results[0].result.totalSize, 0);
    assert.equal(results[1].error.code, 'QUERY_TIMEOUT');
    assert.ok(!results[1].error.message.includes('private-value'));
    assert.equal(results[4].result.records[0].Id, '4');
    await assert.rejects(() => query.batch(Array(6).fill('SELECT Id FROM Account LIMIT 1')));
    assert.equal(calls, 1);
});

test('縦型の途中CSVは全項目の未処理行から始まり、保存した項目の行だけ更新する', (t) => {
    const dir = temp(t),
        output = path.join(dir, 'preview.partial.csv');
    const spool = createCsvSpool(dir, fields, 'record-fields-preview', output);
    spool.activatePartial();
    const initial = fs.readFileSync(output, 'utf8');
    assert.equal((initial.match(/NOT_PROCESSED/g) || []).length, fields.length);
    spool.append(ids[0], [fields[0]], data[0], new Map([[fields[0].name, ids[0]]]), ids[0]);
    spool.publishPartial([ids[0]], true);
    const updated = fs.readFileSync(output, 'utf8');
    assert.equal((updated.match(/NOT_PROCESSED/g) || []).length, fields.length - 1);
    assert.equal(updated.trimEnd().split('\r\n').length, fields.length + 1);
    assert.match(updated, /"LATEST"/);
    assert.throws(() => spool.finish([ids[0]], path.join(dir, 'complete.csv')), /揃って/);
});
