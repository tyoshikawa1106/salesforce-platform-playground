import { safeClientDiagnostic } from '../orgExplorerLogic';
it.each(['PRIVATE', 'toString', '__proto__', null, { toString() { throw new Error('must not coerce'); } }])('未知コードを固定理由に置き換える: %p', (code) => {
    expect(safeClientDiagnostic(code).code).toBe('ORG-JS-UNEXPECTED');
});
