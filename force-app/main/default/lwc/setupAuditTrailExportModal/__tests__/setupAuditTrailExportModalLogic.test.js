import { confirmationText } from '../setupAuditTrailExportModalLogic';

it('distinguishes a pending count from an empty result and formats the confirmed count', () => {
    expect(confirmationText('results', '2026-11')).toContain('件数を確認中');
    expect(confirmationText('results', '2026-11', 0)).toContain('全0件');
    expect(confirmationText('results', '2026-11', 1234)).toContain('全1,234件');
    expect(confirmationText('all', '取得可能な全期間')).toContain('取得可能な全期間の設定変更履歴をすべて');
});
