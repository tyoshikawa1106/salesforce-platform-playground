import { clientErrorDetails } from '../orgExplorerCanvasLogic';

it('画面固有の処理位置と例外の分類を維持する', () => {
    expect(clientErrorDetails(new TypeError(), 'load', 'render')).toMatchObject({
        location: 'orgExplorerCanvas.js / load / render', errorType: 'TypeError'
    });
    expect(clientErrorDetails({ body: {} }, 'load', 'api').errorType).toBe('SalesforceError');
    expect(clientErrorDetails({ name: 'PRIVATE' }, 'load', 'api').errorType).toBe('Error');
});
