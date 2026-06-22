import { reduceErrors } from 'c/errorUtils';

describe('c-error-utils', () => {
    it('reduces single body message errors', () => {
        expect(
            reduceErrors(
                { body: { message: '読み込みに失敗しました。' } },
                '既定メッセージ'
            )
        ).toBe('読み込みに失敗しました。');
    });

    it('reduces array body errors and fallback messages', () => {
        expect(
            reduceErrors(
                [
                    {
                        body: [
                            { message: '1 件目のエラー' },
                            { message: '2 件目のエラー' }
                        ]
                    },
                    {},
                    null
                ],
                '既定メッセージ'
            )
        ).toBe('1 件目のエラー, 2 件目のエラー; 既定メッセージ');
    });
});
