import { clientErrorDetails, safeClientDiagnostic } from '../objectExplorerLogic';
it.each(['PRIVATE', 'toString', '__proto__', null, { toString() { throw new Error('must not coerce'); } }])('未知コードを固定理由に置き換える: %p', (code) => {
    expect(safeClientDiagnostic(code).code).toBe('OE-JS-UNEXPECTED');
});

it('画面固有の例外分類とログの処理位置を維持する', () => {
    expect(clientErrorDetails(new TypeError(), 'load', 'render')).toMatchObject({
        location: 'objectExplorer.js / load / render', errorType: 'TypeError'
    });
    expect(clientErrorDetails({ body: {} }, 'load', 'api').errorType).toBe('SalesforceError');
});
