import { CSV_HEADER, formatCsvPage, historyRow, matchPageBoundary, remainingMatchRecords, sameRecordIds } from '../setupAuditTrailExplorerLogic';

jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Asia/Tokyo' }), { virtual: true });

it('formats midnight and afternoon in local time and retains Unicode across line breaks', () => {
    const records = [
        { CreatedDate: '2026-11-17T15:01:02Z', Display: '日本語\rภาษาไทย\n続き' },
        { CreatedDate: '2026-11-18T14:03:04Z' }
    ];
    expect(formatCsvPage(records)).toBe(
        '"2026/11/18 0:01:02 JST","","","日本語\rภาษาไทย\n続き","",""\n' +
        '"2026/11/18 23:03:04 JST","","","","",""\n'
    );
});

it('uses Japanese export labels and keeps the source action and section in their original language', () => {
    const row = { CreatedDate: '2026-09-15T00:00:00Z', CreatedBy: { UserType: 'AutomatedProcess' },
        Display: 'Changed permission set Sample: Account object permissions were changed', Section: 'Manage Users' };
    expect(CSV_HEADER).toBe('日付,ユーザー,ソースの名前空間プレフィックス,アクション,セクション,代理ユーザー\n');
    expect(formatCsvPage([row])).toBe('"2026/09/15 9:00:00 JST","","","' + row.Display + '","Manage Users",""\n');
});

it.each([
    [{ Name: '表示名のみ' }, ''],
    [{ Username: 'auto', UserType: 'AutomatedProcess' }, 'auto'],
    [null, '']
])('preserves the recorded username and action for the table and CSV', (creator, username) => {
    const row = { CreatedDate: '2026-11-18T00:00:00Z', CreatedById: 'id', CreatedBy: creator,
        Display: '権限セット X を変更: Account オブジェクト権限を 参照', DelegateUser: 'Admin' };
    expect(historyRow(row)).toEqual({ ...row, displayedUser: creator?.Username });
    expect(formatCsvPage([row])).toBe('"2026/11/18 9:00:00 JST","' + username + '","","' + row.Display + '","","Admin"\n');
});

describe('matched page boundaries', () => {
    const rows = ['c', 'b', 'a'].map(Id => ({ Id, CreatedDate: 'same' }));
    const cursor = { nextId: 'source', nextTime: 'later' };

    it('resumes after the last displayed ID even on the final source page', () => {
        expect(matchPageBoundary(rows, 2, {})).toEqual({ next: { nextId: 'b', nextTime: 'same' }, probe: null });
    });

    it('probes ahead only when a full page ends at a source boundary', () => {
        expect(matchPageBoundary(rows, 3, cursor)).toEqual({ next: {}, probe: cursor });
        expect(matchPageBoundary(rows, 3, {})).toEqual({ next: {}, probe: null });
    });

    it('keeps collecting matches until the source is exhausted', () => {
        expect(matchPageBoundary(rows, 4, cursor)).toBeNull();
        expect(matchPageBoundary([], 4, cursor)).toBeNull();
        expect(matchPageBoundary([], 4, {})).toEqual({ next: {}, probe: null });
    });

    it.each([
        [[], [], true],
        [['a', 'b'], ['a', 'b'], true],
        [['a', 'b'], ['b', 'a'], false],
        [['a', 'b'], ['a', 'a'], false],
        [['a', 'b'], ['a'], false],
        [['a'], ['a', 'b'], false]
    ])('compares requested IDs %j with detail IDs %j', (ids, details, expected) => {
        expect(sameRecordIds(ids, details.map(Id => ({ Id })))).toBe(expected);
    });
});

it('reuses only matches after the same ID and timestamp within the cached range', () => {
    const rows = ['b', 'a'].map(Id => ({ Id, CreatedDate: 'same' }));
    const batch = { start: { nextId: 'c', nextTime: 'start' }, records: rows };
    expect(remainingMatchRecords(batch, batch.start)).toBe(rows);
    expect(remainingMatchRecords(batch, { nextId: 'b', nextTime: 'same' })).toEqual([rows[1]]);
    expect(remainingMatchRecords(batch, { nextId: 'a', nextTime: 'same' })).toEqual([]);
    expect(remainingMatchRecords(batch, { nextId: 'b', nextTime: 'other' })).toBeUndefined();
    expect(remainingMatchRecords(batch, {})).toBeUndefined();
});
