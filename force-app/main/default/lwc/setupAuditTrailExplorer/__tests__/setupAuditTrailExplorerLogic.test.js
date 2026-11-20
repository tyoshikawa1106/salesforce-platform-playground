import { formatCsvPage } from '../setupAuditTrailExplorerLogic';
jest.mock('@salesforce/i18n/lang', () => ({ default: 'ja' }), { virtual: true });

jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Asia/Tokyo' }), { virtual: true });

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
