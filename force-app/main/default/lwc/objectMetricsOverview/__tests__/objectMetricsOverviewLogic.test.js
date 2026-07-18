import {
    createCountCards,
    isInitialLoading,
    normalizeMetricItems
} from '../objectMetricsOverviewLogic';

describe('objectMetricsOverviewLogic', () => {
    it('Apex応答を画面管理用の件数項目へ正規化する', () => {
        expect(
            normalizeMetricItems([
                {
                    key: 'accounts',
                    iconName: 'standard:account',
                    value: 12,
                    label: '取引先'
                }
            ])
        ).toEqual([
            {
                key: 'accounts',
                iconName: 'standard:account',
                value: 12,
                capped: false,
                label: '取引先'
            }
        ]);
    });

    it('件数、上限、代替ラベル、操作状態を表示カードへ変換する', () => {
        expect(
            createCountCards(
                [
                    {
                        key: 'records',
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

    it('wire応答前だけ初回ローディングとして扱う', () => {
        expect(
            isInitialLoading({
                errorMessage: undefined,
                wiredResult: undefined
            })
        ).toBe(true);
        expect(
            isInitialLoading({
                errorMessage: undefined,
                wiredResult: { data: { metrics: [] } }
            })
        ).toBe(false);
        expect(
            isInitialLoading({
                errorMessage: '読み込みエラー',
                wiredResult: undefined
            })
        ).toBe(false);
    });
});
