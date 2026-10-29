import { withUiErrorBoundary } from '../uiErrorBoundary';
import { createClientErrorDetails } from 'c/errorUtils';

class Base { marker = 'preserved'; }
const Boundary = withUiErrorBoundary(Base, 'sampleScreen');
afterEach(() => jest.restoreAllMocks());
it('正常時は診断もログも生成せず、元のクラスを維持する', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const screen = new Boundary();
    expect(screen.marker).toBe('preserved');
    expect(screen.clientError).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
});
it('診断とログから本文・API応答・URL・端末パスを除く', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const screen = new Boundary();
    const error = { name: 'TypeError', message: 'private-input', body: { message: 'private-response', accessToken: 'secret' }, stack: 'TypeError: private-input\n at run (https://private.example/modules/ui.js:12:3)\n at helper (/Users/private/helper.js:4:2)' };
    screen.reportClientError(error, 'handleSearch', 'ui-event');
    expect(screen.clientError).toEqual({ location: 'sampleScreen.js / handleSearch / ui-event', errorType: 'TypeError', frames: ['ui.js:12:3', 'helper.js:4:2'], frame: 'ui.js:12:3' });
    for (const secret of ['private-input', 'private-response', 'private.example', '/Users/', 'accessToken', 'secret']) {
        expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    }
});
it('子の例外を受け止め、同じ描画失敗の再通知を抑止する', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const screen = new Boundary();
    const error = { name: 'TypeError' };
    screen.errorCallback(error);
    screen.errorCallback(error);
    expect(screen.clientError.location).toBe('sampleScreen.js / errorCallback / child-component');
    expect(log).toHaveBeenCalledTimes(1);
    screen.handleClientErrorDismiss();
    expect(screen.clientError).toBeUndefined();
    screen.errorCallback(error);
    expect(log).toHaveBeenCalledTimes(2);
});
it('スタックのないSalesforceエラーと任意の例外名を安全に扱う', () => {
    expect(createClientErrorDetails({ body: { message: 'private' } }, 'sample', 'read', 'wire').errorType).toBe('SalesforceError');
    expect(createClientErrorDetails({ name: 'secret-account' }, 'sample', 'read', 'wire').errorType).toBe('Error');
    expect(createClientErrorDetails(null, 'sample', 'read', 'wire').frames).toEqual([]);
});
it('位置情報を8件に制限する', () => {
    const stack = 'Error\n' + Array.from({ length: 20 }, (_, i) => ` at task${i}.js:1:2`).join('\n');
    expect(createClientErrorDetails({ stack }, 'sample', 'read', 'wire').frames).toHaveLength(8);
});
