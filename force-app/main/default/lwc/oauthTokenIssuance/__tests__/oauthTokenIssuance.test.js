import { createElement } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { TextEncoder } from 'node:util';
import CURRENT_USER_ID from '@salesforce/user/Id';
import OAuthTokenIssuance from 'c/oauthTokenIssuance';
import getAuthorizationOrigin from '@salesforce/apex/OAuthTokenIssuanceController.getAuthorizationOrigin';
import exchangeCode from '@salesforce/apex/OAuthTokenIssuanceController.exchangeCode';

jest.mock(
    '@salesforce/apex/OAuthTokenIssuanceController.getAuthorizationOrigin',
    () => ({ default: jest.fn() }),
    { virtual: true }
);
jest.mock('@salesforce/apex/OAuthTokenIssuanceController.exchangeCode', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/user/Id', () => ({ default: '005000000000001' }), { virtual: true });

const CALLBACK = 'https://app.example.test/callback';
const ORIGIN = 'https://salesforce.example.test';
const USERNAME = 'sample-user@example.test';
const tick = () => Promise.resolve();

function setInput(input, value) {
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
}

function button(element, label) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((item) => item.label === label);
}

async function mountForm() {
    const element = createElement('c-oauth-token-issuance', { is: OAuthTokenIssuance });
    document.body.appendChild(element);
    getRecord.emit({ id: CURRENT_USER_ID, fields: { Name: { value: 'Sample API User' }, Username: { value: USERNAME } } });
    await tick();
    await tick();
    await tick();
    return element;
}

async function startAuthorization() {
    const element = await mountForm();
    const inputs = [...element.shadowRoot.querySelectorAll('lightning-input')];
    const key = inputs.find(({ name }) => name === 'clientId');
    const secret = inputs.find(({ name }) => name === 'clientSecret');
    const callback = inputs.find(({ name }) => name === 'redirectUri');
    inputs.forEach((input) => {
        input.reportValidity = jest.fn().mockReturnValue(true);
    });
    setInput(key, 'consumer-key');
    setInput(secret, 'test-client-secret');
    setInput(callback, CALLBACK);
    await tick();
    const link = element.shadowRoot.querySelector('a[target="_blank"]');
    const url = new URL(link.href);
    link.click();
    await tick();
    return { element, url };
}

beforeEach(() => {
    global.TextEncoder = TextEncoder;
    Object.defineProperty(window.crypto, 'subtle', {
        configurable: true,
        value: { digest: jest.fn().mockResolvedValue(new Uint8Array(32).buffer) }
    });
    getAuthorizationOrigin.mockResolvedValue(ORIGIN);
});

afterEach(() => {
    document.body.replaceChildren();
    jest.restoreAllMocks();
    getAuthorizationOrigin.mockReset();
    exchangeCode.mockReset();
});

test('認可を始める前に API 接続先と現在のログインユーザーを確認できる', async () => {
    const element = await mountForm();
    const apiDetails = element.shadowRoot.querySelector('[aria-label="API 接続情報"]');
    expect([...apiDetails.querySelectorAll('dd')].map((field) => field.textContent)).toEqual([
        ORIGIN,
        `Sample API User (${USERNAME})`
    ]);
    expect(apiDetails.previousElementSibling.querySelector('h1').textContent).toBe('OAuth トークン発行');
    expect(apiDetails.nextElementSibling.querySelector('h2').textContent).toBe('アプリケーション情報');
    expect(element.shadowRoot.querySelector('a[target="_blank"]')).toBeNull();
    expect(exchangeCode).not.toHaveBeenCalled();
});

test('PKCE の準備をやり直すときは取得済みの API 接続先を使う', async () => {
    window.crypto.subtle.digest.mockRejectedValueOnce(new Error('PKCE preparation failed'));
    const element = await mountForm();

    const apiDetails = element.shadowRoot.querySelector('[aria-label="API 接続情報"]');
    expect(apiDetails.querySelector('dd').textContent).toBe(ORIGIN);
    button(element, '認可を準備する').click();
    await tick();
    await tick();
    await tick();
    await tick();

    expect(getAuthorizationOrigin).toHaveBeenCalledTimes(1);
    expect(button(element, '別タブで認可する').disabled).toBe(false);
});

test('同じ画面に入力欄を残して、認可コードを交換し ID トークンを表示する', async () => {
    exchangeCode.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        idToken: 'id.jwt',
        instanceUrl: 'https://api.example.test'
    });
    const { element, url } = await startAuthorization();
    expect(url.origin).toBe(ORIGIN);
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('scope')).toBe(false);
    expect(url.searchParams.has('client_secret')).toBe(false);

    const configFields = [...element.shadowRoot.querySelectorAll('lightning-input')];
    expect(configFields.map((field) => field.label)).toEqual(['コンシューマー鍵', 'コンシューマーの秘密', 'コールバック URL']);
    expect(configFields[1].value).toBe('test-client-secret');
    expect(configFields[2].fieldLevelHelp).toContain('アプリケーションに登録したコールバック URL');

    const input = element.shadowRoot.querySelector('lightning-textarea');
    setInput(input, CALLBACK + '?code=issued&state=' + url.searchParams.get('state'));
    await tick();
    expect(element.shadowRoot.textContent).toContain('認可コードを受け取りました。');
    button(element, 'トークンを発行').click();
    await tick();
    await tick();

    expect(exchangeCode).toHaveBeenCalledWith({
        authorization: expect.objectContaining({
            clientId: 'consumer-key',
            redirectUri: CALLBACK,
            code: 'issued',
            clientSecret: 'test-client-secret'
        })
    });
    const resultFields = [...element.shadowRoot.querySelectorAll('lightning-textarea')];
    expect(resultFields.map((field) => [field.label, field.value])).toContainEqual([
        'ID トークン（OpenID Connect）',
        'id.jwt'
    ]);
    const apiDetails = element.shadowRoot.querySelector('[aria-label="API 接続情報"]');
    expect([...apiDetails.querySelectorAll('dd')].map((field) => field.textContent)).toEqual([
        'https://api.example.test',
        `Sample API User (${USERNAME})`
    ]);
    expect(element.shadowRoot.textContent).not.toContain('認可コードを受け取りました。');
    expect(configFields[1].value).toBe('');
    expect(input.value).toBe('');
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
        const copyButton = element.shadowRoot.querySelector('[data-token="accessToken"]');
        copyButton.click();
        await tick();
        await tick();
        expect(writeText).toHaveBeenCalledWith('access');
        expect(copyButton.nextElementSibling.textContent).toBe('アクセストークンをコピーしました。');
        expect(element.shadowRoot.querySelector('[data-token="refreshToken"]').nextElementSibling.textContent).toBe('');
    } finally {
        delete navigator.clipboard;
    }
    await expect(element).toBeAccessible();
});

test('別の認可 URL の貼り付けでは交換できない', async () => {
    const { element } = await startAuthorization();
    setInput(element.shadowRoot.querySelector('lightning-textarea'), CALLBACK + '?code=issued&state=wrong');
    await tick();
    expect(button(element, 'トークンを発行').disabled).toBe(true);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('今回の認可');
    expect(exchangeCode).not.toHaveBeenCalled();
});

test('発行後に別タブが開かなくても再試行でき、新しい認可を確認するまで結果を残す', async () => {
    exchangeCode.mockResolvedValue({ accessToken: 'first-token' });
    const { element, url } = await startAuthorization();
    const input = element.shadowRoot.querySelector('lightning-textarea');
    const previousCallback = CALLBACK + '?code=issued&state=' + url.searchParams.get('state');
    setInput(input, previousCallback);
    await tick();
    button(element, 'トークンを発行').click();
    await tick();
    await tick();

    expect(element.shadowRoot.querySelector('[data-token="accessToken"]')).not.toBeNull();
    expect(button(element, '最初からやり直す')).toBeUndefined();
    const authorize = element.shadowRoot.querySelector('a[target="_blank"]');
    expect(authorize.rel.split(' ')).toEqual(['noopener', 'noreferrer']);
    authorize.click();
    await tick();

    const retry = element.shadowRoot.querySelector('a[target="_blank"]');
    const nextUrl = new URL(retry.href);
    expect(nextUrl.searchParams.get('state')).not.toBe(url.searchParams.get('state'));
    expect(nextUrl.searchParams.get('client_id')).toBe(url.searchParams.get('client_id'));
    expect(input.value).toBe('');
    expect(element.shadowRoot.querySelector('[data-token="accessToken"]')).not.toBeNull();
    retry.click();
    await tick();

    setInput(input, previousCallback);
    await tick();
    expect(button(element, 'トークンを発行').disabled).toBe(true);
    expect(element.shadowRoot.querySelector('[data-token="accessToken"]')).not.toBeNull();

    setInput(input, CALLBACK + '?code=next&state=' + nextUrl.searchParams.get('state'));
    await tick();
    expect(button(element, 'トークンを発行').disabled).toBe(false);
    expect(element.shadowRoot.querySelector('[data-token="accessToken"]')).toBeNull();
    expect(exchangeCode).toHaveBeenCalledTimes(1);
});

test.each([
    ['clientId', 'another-client'],
    ['redirectUri', 'https://localhost/another-callback']
])('%s を変更すると前の発行結果が消える', async (fieldName, value) => {
    exchangeCode.mockResolvedValue({ accessToken: 'first-token' });
    const { element, url } = await startAuthorization();
    setInput(
        element.shadowRoot.querySelector('lightning-textarea'),
        CALLBACK + '?code=issued&state=' + url.searchParams.get('state')
    );
    await tick();
    button(element, 'トークンを発行').click();
    await tick();
    await tick();

    expect(element.shadowRoot.querySelector('[data-token="accessToken"]')).not.toBeNull();
    const field = [...element.shadowRoot.querySelectorAll('lightning-input')].find(({ name }) => name === fieldName);
    setInput(field, value);
    await tick();

    expect(element.shadowRoot.querySelector('[data-token="accessToken"]')).toBeNull();
});

test('画面から離れた後に前の交換結果が届いても再表示しない', async () => {
    let finishExchange;
    exchangeCode.mockReturnValue(
        new Promise((resolve) => {
            finishExchange = resolve;
        })
    );
    const { element, url } = await startAuthorization();
    setInput(
        element.shadowRoot.querySelector('lightning-textarea'),
        CALLBACK + '?code=issued&state=' + url.searchParams.get('state')
    );
    await tick();
    button(element, 'トークンを発行').click();
    expect(exchangeCode).toHaveBeenCalledTimes(1);

    element.remove();
    document.body.appendChild(element);
    finishExchange({ accessToken: 'previous-token' });
    await tick();
    await tick();
    await tick();
    await tick();

    const fields = [...element.shadowRoot.querySelectorAll('lightning-textarea')];
    expect(fields.map(({ label, value, disabled }) => ({ label, value, disabled }))).toEqual([
        { label: '認可後に表示された URL', value: '', disabled: true }
    ]);
    expect(element.shadowRoot.querySelector('a[target="_blank"]').getAttribute('aria-disabled')).toBe('false');
});
