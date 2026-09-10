import { createCompletionResult, createSaveError } from '../objectRecordFormModalLogic';

describe('レコードモーダルの操作結果', () => {
    it.each([
        [undefined, '作成しました'],
        ['001000000000001AAA', '更新しました']
    ])('レコードID %s に対応した保存結果を返す', (recordId, title) => {
        expect(createCompletionResult({ recordId, objectLabel: '取引先' })).toEqual({
            title,
            message: '取引先を保存しました。'
        });
    });

    it.each([
        { files: [], message: '0 件のファイルを登録しました。' },
        { files: [{ name: 'one.pdf' }, { name: 'two.pdf' }], message: '2 件のファイルを登録しました。' }
    ])('アップロード件数を通知する: $message', ({ files, message }) => {
        expect(createCompletionResult({ files })).toEqual({ title: 'アップロードしました', message });
    });

    it('保存エラーの詳細を優先し、詳細がなければ対象名を使う', () => {
        expect(createSaveError({ message: '必須項目がありません' }, '取引先')).toBe('必須項目がありません');
        expect(createSaveError(undefined, '取引先')).toBe('取引先を保存できませんでした。');
    });
});
