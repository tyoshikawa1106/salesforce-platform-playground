import { collectLoginAsPairs, formatCsvPage, historyRow, loginAsActors, remainingMatchRecords } from '../setupAuditTrailExplorerLogic';
jest.mock('@salesforce/i18n/lang', () => ({ default: 'ja' }), { virtual: true });

jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Asia/Tokyo' }), { virtual: true });

const login = {
    Id: 'login', Action: 'suOrgAdminLogin', Display: '対象 のログインアクセスを使用してログイン済み',
    CreatedDate: '2026-10-31T14:59:00Z', CreatedById: 'admin', CreatedBy: { Username: 'admin' }, DelegateUser: 'admin'
};
const logout = {
    Id: 'logout', Action: 'suOrgAdminLogout', Display: '対象 のログインアクセスを使用してログアウト済み',
    CreatedDate: '2026-10-31T15:01:00Z', CreatedById: 'user', CreatedBy: { Name: '対象', Username: 'target' }, DelegateUser: 'admin'
};

it.each([
    ['unique across months and pages', [logout, login], 'target'],
    ['no logout', [login], 'admin'],
    ['newer session still open', [{ ...login, Id: 'open', CreatedDate: '2026-11-01T02:00:00Z' }, logout, login], 'target'],
    ['older login outside retention', [logout, login, { ...logout, CreatedDate: '2026-09-01T02:00:00Z' }], 'target'],
    ['different delegate', [{ ...logout, DelegateUser: 'other' }, login], 'admin'],
    ['different target', [{ ...logout, CreatedBy: { Name: '別人', Username: 'other' } }, login], 'admin'],
    ['missing actor ID', [{ ...logout, CreatedById: null }, login], 'admin'],
    ['same timestamp', [{ ...logout, CreatedDate: login.CreatedDate }, login], 'admin'],
    ['duplicate login', [logout, login, { ...login, Id: 'another' }], 'admin'],
    ['duplicate logout', [logout, login, { ...logout, Id: 'another' }], 'admin']
])('uses the verified login-as user only if unambiguous: %s', (description, rows, expected) => {
    const pairs = new Map();
    rows.forEach(row => collectLoginAsPairs(pairs, [row]));
    expect(formatCsvPage([login], new Set(), loginAsActors(pairs))).toBe(
        '"2026/10/31 23:59:00 JST","' + expected + '","","' + login.Display + '","","admin"\n'
    );
});

it('matches separate sessions of the same delegate and target across pages by login ID', () => {
    const laterLogin = { ...login, Id: 'later', CreatedDate: '2026-11-02T03:00:00Z' };
    const laterLogout = { ...logout, Id: 'laterLogout', CreatedDate: '2026-11-02T03:00:05Z',
        CreatedById: 'anotherTarget', CreatedBy: { Name: '対象', Username: 'secondTarget' } };
    const pairs = new Map();
    collectLoginAsPairs(pairs, [laterLogout]);
    collectLoginAsPairs(pairs, [laterLogin, logout]);
    collectLoginAsPairs(pairs, [login]);
    expect(formatCsvPage([laterLogin, login], new Set(), loginAsActors(pairs)).split('\n').slice(0, 2).map(line => line.split(',')[1]))
        .toEqual(['"secondTarget"', '"target"']);
});

it('formats midnight and afternoon in local time and retains Unicode across line breaks', () => {
    const records = [
        { CreatedDate: '2026-11-17T15:01:02Z', Display: '日本語\rภาษาไทย\n続き' },
        { CreatedDate: '2026-11-18T14:03:04Z' }
    ];
    expect(formatCsvPage(records)).toBe(
        '"2026/11/18 0:01:02 JST","","","日本語\nภาษาไทย\n続き","",""\n' +
        '"2026/11/18 23:03:04 JST","","","","",""\n'
    );
});

it('formats only identified actors and the object name in a permission-set change', () => {
    const permission = '権限セット WebCartDocument を変更: WebCartDocument オブジェクト権限を 参照 に変更';
    const common = { CreatedDate: '2026-11-18T00:00:00Z', Display: permission };
    const csv = formatCsvPage([
        { ...common, Action: 'PermSetEntityPermChanged', CreatedBy: { UserType: 'AutomatedProcess', Username: 'auto' } },
        { ...common, CreatedById: 'unknown', DelegateUser: 'delegate' },
        { ...common, CreatedById: 'employee', CreatedBy: { Username: 'visible' } },
        { ...common, Action: 'PermSetEntityPermChanged', Display: permission.replace(': WebCartDocument', ': OtherObject') }
    ], new Set(['employee']));
    expect(csv.split('\n').slice(0, 4)).toEqual([
        '"2026/11/18 9:00:00 JST","自動化プロセス","","権限セット WebCartDocument を変更: Web Cart Documents オブジェクト権限を 参照 に変更","",""',
        '"2026/11/18 9:00:00 JST","","","' + permission + '","","delegate"',
        '"2026/11/18 9:00:00 JST","visible","","' + permission + '","",""',
        '"2026/11/18 9:00:00 JST","","","' + permission.replace(': WebCartDocument', ': OtherObject') + '","",""'
    ]);
});

it('keeps history display names separate from CSV logins and preserves an unresolved delegate', () => {
    const row = { ...logout, DelegateUser: 'Admin' };
    expect(historyRow(row, new Set(), undefined, { admin: '管理者' })).toMatchObject({
        displayedUser: '対象', displayedDelegate: '管理者'
    });
    expect(historyRow(row, new Set(), undefined, {}).displayedDelegate).toBe('Admin');
    expect(formatCsvPage([row])).toContain('"target","","' + row.Display + '","","Admin"');
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
