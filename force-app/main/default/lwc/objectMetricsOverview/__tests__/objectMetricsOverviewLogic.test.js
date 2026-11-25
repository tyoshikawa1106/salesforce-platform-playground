import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    createCountCards,
    normalizeMetricItems
} from '../objectMetricsOverviewLogic';

describe('objectMetricsOverviewLogic', () => {
    it('先行表示の全カードがApexカタログの順序・キー・名前・アイコンに一致する', () => {
        const source = readFileSync(join(__dirname, '../../../classes/ObjectMetricCatalog.cls'), 'utf8');
        const definition = /new MetricDefinition\(\s*'([^']+)',\s*'[^']+',\s*present\('([^']+)',\s*'([^']+)'\)\s*\)/g;
        const expected = [...source.matchAll(definition)].map(([, key, label, iconName]) => ({ key, label, iconName }));
        expect(expected).toHaveLength((source.match(/new MetricDefinition\(/g) || []).length);
        expect(createCountCards([], true).map(({ key, label, iconName }) => ({ key, label, iconName }))).toEqual(expected);
    });

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
        expect(cards[1].formattedValue).toBe('-');
        expect(cards[1].countTitle).toBe('-');
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
