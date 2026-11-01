import { clientErrorDetails } from '../objectRecordSearchLogic';

describe('画面固有の診断情報', () => {
    it('本文・URL・端末パスを除き、位置の重複と件数を制限する', () => {
        const error = new TypeError('PRIVATE_VALUE');
        error.stack = 'TypeError: PRIVATE_VALUE\n' + Array.from({ length: 12 }, (_, index) => `at https://private.example/path/file${index}.js:${index + 1}:2`).join('\n');
        const details = clientErrorDetails(error, 'load', 'render');
        expect(details.location).toBe('objectRecordSearch.js / load / render');
        expect(details.errorType).toBe('TypeError');
        expect(details.frames).toHaveLength(8);
        expect(details.frame).toBe('file0.js:1:2');
        expect(JSON.stringify(details)).not.toMatch(/PRIVATE_VALUE|https:|private.example/);
        error.stack = 'Error\n at first.js:1:2\n at first.js:1:2';
        expect(clientErrorDetails(error, 'load', 'render').frames).toEqual(['first.js:1:2']);
    });
    it('Salesforceの応答形式と不明な例外名を安全に扱う', () => {
        expect(clientErrorDetails({ body: { message: 'PRIVATE' } }, 'load', 'api').errorType).toBe('SalesforceError');
        expect(clientErrorDetails({ name: 'PRIVATE' }, 'load', 'api').errorType).toBe('Error');
        expect(clientErrorDetails(null, 'load', 'api').frames).toEqual([]);
    });
});
