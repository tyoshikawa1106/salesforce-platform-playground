import { createToastMessage, getErrorMessages, reduceErrors } from 'c/errorUtils';

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

    it('returns normalized error messages for callers that need their own formatting', () => {
        expect(
            getErrorMessages(
                [{ message: '保存できませんでした。' }, null],
                '既定メッセージ'
            )
        ).toEqual(['保存できませんでした。']);
    });

    it('creates toast messages from one or more display messages', () => {
        expect(
            createToastMessage(
                '1 件は削除できませんでした。',
                '削除できませんでした。'
            )
        ).toBe('1 件は削除できませんでした。');
        expect(
            createToastMessage(
                ['1 件は削除できませんでした。', '1 件は権限不足です。'],
                '削除できませんでした。'
            )
        ).toBe('1 件は削除できませんでした。\n1 件は権限不足です。');
        expect(createToastMessage([], '削除できませんでした。')).toBe(
            '削除できませんでした。'
        );
    });
});


it('固定診断は未知コードやオブジェクトから自由文を公開しない', () => {
    const { safeClientDiagnostic } = require('../errorUtils');
    expect(safeClientDiagnostic('ORG-JS-DOM-TARGET')).toEqual({ code: 'ORG-JS-DOM-TARGET', reason: 'ドラッグの操作対象でDOMのclosest機能を利用できません。' });
    for (const value of ['__proto__', 'PRIVATE_TOKEN', { toString() { throw new Error('PRIVATE_VALUE'); } }]) {
        const result = safeClientDiagnostic(value);
        expect(result.code).toBe('OE-JS-UNEXPECTED');
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
    }
});
