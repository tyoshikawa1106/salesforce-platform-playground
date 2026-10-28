import {
    createCountCards,
    normalizeMetricItems
} from '../objectMetricsOverviewLogic';

describe('objectMetricsOverviewLogic', () => {
    it('Apex応答を画面管理用の件数項目へ正規化する', () => {
        expect(
            normalizeMetricItems([
                {
                    key: 'accounts',
                    available: true,
                    iconName: 'standard:account',
                    value: 12,
                    label: '取引先'
                }
            ])
        ).toEqual([
            {
                key: 'accounts',
                    available: true,
                iconName: 'standard:account',
                value: 12,
                capped: false,
                label: '取引先'
            }
        ]);
    });

    it('正常なゼロ件と取得不能を区別する', () => {
        const cards = createCountCards([{ key: 'empty', value: 0, available: true }, { key: 'unavailable', value: 0, available: false }]);
        expect(cards[0].formattedValue).toBe('0');
        expect(cards[1].formattedValue).toBe('取得できません');
    });

    it('件数、上限、代替ラベル、操作状態を表示カードへ変換する', () => {
        expect(
            createCountCards(
                [
                    {
                        key: 'records',
                        available: true,
                        value: 50000,
                        capped: true
                    }
                ],
                true
            )
        ).toEqual([
            {
                key: 'records',
                iconName: 'standard:record',
                label: 'records',
                countTitle: '50,000+ 件',
                formattedValue: '50,000+',
                loading: true,
                loadingLabel: 'recordsの件数を読み込んでいます',
                openTitle: 'records一覧を開く'
            }
        ]);
    });

});
