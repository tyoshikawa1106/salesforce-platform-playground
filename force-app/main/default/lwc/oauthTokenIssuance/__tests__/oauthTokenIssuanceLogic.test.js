import { createHash, webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import {
    createAuthorizationProof,
    createAuthorizationUrl,
    readAuthorizationCallback
} from '../oauthTokenIssuanceLogic';

const ORIGIN = 'https://salesforce.example.test';
const CALLBACK = 'https://app.example.test/callback?view=setup';
const PROOF = { state: 'expected-state', challenge: 'pkce-challenge', verifier: 'private-verifier' };

beforeAll(() => {
    global.TextEncoder = TextEncoder;
});

test('認可操作ごとに独立した S256 の検証値と state を生成する', async () => {
    const first = await createAuthorizationProof(webcrypto);
    const second = await createAuthorizationProof(webcrypto);
    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.challenge).toBe(createHash('sha256').update(first.verifier).digest('base64url'));
    expect(first.state).not.toBe(second.state);
    expect(first.verifier).not.toBe(second.verifier);
});

test('スコープの指定を省き、公開用の PKCE 値を認可に渡す', () => {
    const url = new URL(createAuthorizationUrl(ORIGIN, { clientId: 'key', redirectUri: CALLBACK }, PROOF));
    expect(url.origin + url.pathname).toBe(ORIGIN + '/services/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
        response_type: 'code',
        client_id: 'key',
        redirect_uri: CALLBACK,
        code_challenge: PROOF.challenge,
        code_challenge_method: 'S256',
        state: PROOF.state
    });
});

test('登録済みコールバックのクエリを保持した認可コードを一度だけデコードする', () => {
    expect(readAuthorizationCallback(CALLBACK + '&code=test%2B%25&state=' + PROOF.state, CALLBACK, PROOF.state)).toBe(
        'test+%'
    );
});

test.each([
    ['別の認可', CALLBACK + '&code=valid&state=other', '今回の認可'],
    ['コードの欠落', CALLBACK + '&state=expected-state', '認可コードを読み取れません'],
    ['コードの重複', CALLBACK + '&code=first&code=second&state=expected-state', '認可コードを読み取れません'],
    ['登録済みクエリの改変', CALLBACK.replace('setup', 'other') + '&code=valid&state=expected-state', '一致しません'],
    ['別の戻り先', 'https://other.example.test/callback?code=valid&state=expected-state', '一致しません'],
    ['Salesforce の認可エラー', CALLBACK + '&error=access_denied&state=expected-state', '認可が完了していません']
])('%sの URL を交換に使用しない', (_label, url, message) => {
    expect(() => readAuthorizationCallback(url, CALLBACK, PROOF.state)).toThrow(message);
});
