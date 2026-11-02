import { createLogDetails, recordLog } from 'c/lwcLoggerUtils';

describe('LWCログの整形と記録', () => {
    let output;

    beforeEach(() => {
        output = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        output.mockRestore();
    });

    it('本文・接続先・端末パスを除き、フレームの重複と件数を制限する', () => {
        const stack = 'TypeError: PRIVATE_VALUE\n' + Array.from({ length: 12 }, (_, index) =>
            `at https://private.example/path/file${index}.js:${index + 1}:2`
        ).join('\n');
        const result = createLogDetails({ source: 'sample.js', operation: 'load', phase: 'render', errorType: 'TypeError', stack });

        expect(result.location).toBe('sample.js / load / render');
        expect(result.errorType).toBe('TypeError');
        expect(result.frames).toHaveLength(8);
        expect(result.frame).toBe('file0.js:1:2');
        expect(JSON.stringify(result)).not.toMatch(/PRIVATE_VALUE|https:|private.example/);
        expect(output).not.toHaveBeenCalled();
    });

    it('スタックが欠落しても呼び出し元の種類と固定位置を維持する', () => {
        const result = createLogDetails({ source: 'sample.js', operation: 'load', phase: 'api', errorType: 'SalesforceError', stack: null });

        expect(result).toEqual({ location: 'sample.js / load / api', errorType: 'SalesforceError', frames: [], frame: '' });
    });

    it('同じフレームを最初の出現順で一度だけ記録する', () => {
        const result = createLogDetails({ source: 'sample.js', operation: 'load', phase: 'render', errorType: 'Error', stack: 'Error\n at first.js:1:2\n at first.js:1:2\n at next.mjs:3:4' });

        expect(result.frames).toEqual(['first.js:1:2', 'next.mjs:3:4']);
    });

    it('ログに許可した属性だけを出力し、表示案内や応答情報を渡さない', () => {
        const details = Object.freeze({ location: 'sample.js / load / api', errorType: 'SalesforceError', frames: Object.freeze([]), code: 'PUBLIC-CODE', message: 'PRIVATE_MESSAGE', body: 'PRIVATE_RESPONSE' });

        expect(recordLog(undefined, details)).toBe(true);
        expect(output).toHaveBeenCalledWith('LWC: 画面処理でエラーが発生しました。', {
            location: details.location, errorType: details.errorType, code: details.code, frames: []
        });
        expect(JSON.stringify(output.mock.calls)).not.toContain('PRIVATE');
    });

    it('同じ記録は出力せず、画面が持つ状態も書き換えない', () => {
        const previous = Object.freeze({ location: 'sample.js / load / render', errorType: 'Error', frames: Object.freeze(['first.js:1:2']) });

        expect(recordLog(previous, { ...previous, frames: ['first.js:1:2'] })).toBe(false);
        expect(output).not.toHaveBeenCalled();
        expect(previous.frames).toEqual(['first.js:1:2']);
    });

    it.each([
        { code: 'PUBLIC-CODE' },
        { message: '別の公開案内' },
        { frames: ['next.js:3:4'] },
        { location: 'sample.js / save / api' },
        { errorType: 'TypeError' }
    ])('種類・処理位置・コード・公開案内が変わった記録を省略しない: %p', (change) => {
        const previous = { location: 'sample.js / load / api', errorType: 'Error', frames: [] };

        expect(recordLog(previous, { ...previous, ...change }, 'ObjectExplorer')).toBe(true);
        expect(output.mock.calls[0][0]).toBe('ObjectExplorer: 画面処理でエラーが発生しました。');
    });
});
