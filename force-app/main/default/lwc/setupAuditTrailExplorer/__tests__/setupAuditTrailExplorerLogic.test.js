import { formatCsvPage } from '../setupAuditTrailExplorerLogic';

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
