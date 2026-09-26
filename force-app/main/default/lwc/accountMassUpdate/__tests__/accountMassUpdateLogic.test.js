import { applyEdit, buildRows, buildSaveRequest, retainFailedChanges, validateSearch } from '../accountMassUpdateLogic';

const record = {
    Id: '001000000000001AAA',
    Name: 'テスト法人',
    OwnerId: '005000000000001AAA',
    Industry: 'Technology',
    Type: null,
    Rating: 'Hot',
    LastModifiedDate: '2026-09-24T00:00:00.000Z'
};

describe('取引先一括更新の画面ロジック', () => {
    it('元の値へ戻すと変更行を解除し、クリア要求はnullで保持する', () => {
        const changed = applyEdit([record], {}, record.Id, 'Rating', 'Cold');
        expect(changed[record.Id]).toEqual({ Rating: 'Cold' });
        expect(applyEdit([record], changed, record.Id, 'Rating', 'Hot')).toEqual({});
        expect(applyEdit([record], {}, record.Id, 'Industry', '')[record.Id]).toEqual({ Industry: null });
        expect(applyEdit([record], {}, record.Id, 'Name', '変更禁止')).toEqual({});
    });
    it('変更項目と元の日時だけを送信する', () => {
        expect(buildSaveRequest([record], { [record.Id]: { Rating: 'Cold', Industry: null } })).toEqual({
            changes: [{ Id: record.Id, Industry: null, Rating: 'Cold' }],
            versions: { [record.Id]: record.LastModifiedDate }
        });
    });
    it('所有者クリアと201件以上を拒否する', () => {
        expect(() => buildSaveRequest([record], { [record.Id]: { OwnerId: null } })).toThrow('所有者');
        const changes = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [String(i), { Rating: 'Cold' }]));
        expect(() => buildSaveRequest([], changes)).toThrow('200');
    });
    it('成功行だけを除き失敗行の値を保持する', () => {
        expect(retainFailedChanges({ a: { Rating: 'Hot' }, b: { Rating: null } }, ['a'])).toEqual({
            b: { Rating: null }
        });
    });
    it('終了日当日や片側だけの日付は許可し、逆転を拒否する', () => {
        expect(validateSearch({ startDate: '2026-09-24', endDate: '2026-09-24' })).toBe('');
        expect(validateSearch({ startDate: '2026-09-24' })).toBe('');
        expect(validateSearch({ startDate: '2026-09-25', endDate: '2026-09-24' })).not.toBe('');
    });
    it('行の変更表示・エラー・権限とレコードタイプ別選択肢を合成する', () => {
        const rows = buildRows(
            [record],
            { [record.Id]: { Rating: 'Cold' } },
            { [record.Id]: '競合' },
            ['Rating'],
            { master: { Rating: { values: [{ label: '低', value: 'Cold' }] } } },
            'master',
            false
        );
        expect(rows[0]).toMatchObject({
            rowClass: 'changed-row',
            status: '変更あり',
            error: '競合',
            ratingValue: 'Cold',
            ownerDisabled: true,
            ratingDisabled: false
        });
        expect(rows[0].ratingOptions).toContainEqual({ label: '低', value: 'Cold' });
        expect(buildRows([record], {}, {}, ['Rating'], {}, 'master', false)[0].ratingDisabled).toBe(true);
    });
});
