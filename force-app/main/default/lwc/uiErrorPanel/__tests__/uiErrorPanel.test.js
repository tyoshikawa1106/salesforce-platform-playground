import { createElement } from 'lwc';
import UiErrorPanel from 'c/uiErrorPanel';
afterEach(() => document.body.replaceChildren());
it('エラーがないときは警告もボタンも表示しない', async () => {
    const panel = createElement('c-ui-error-panel', { is: UiErrorPanel });
    document.body.appendChild(panel);
    expect(panel.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    expect(panel.shadowRoot.querySelector('lightning-button')).toBeNull();
    await expect(panel).toBeAccessible();
});
it('処理場所・コード・固定理由を表示し、圧縮行番号を表示しない', async () => {
    const panel = createElement('c-ui-error-panel', { is: UiErrorPanel });
    panel.details = { location: 'sample.js / search / request', errorType: 'TypeError', frame: 'sample.js:12:3', code: 'ORG-JS-MODEL', reason: '描画データの型が不正です。' };
    const dismissed = jest.fn();
    panel.addEventListener('dismiss', dismissed);
    document.body.appendChild(panel);
    expect(panel.shadowRoot.querySelector('[role="alert"]').textContent).toContain('sample.js / search / request');
    expect(panel.shadowRoot.textContent).toContain('TypeError');
    expect(panel.shadowRoot.textContent).not.toContain('sample.js:12:3');
    expect(panel.shadowRoot.textContent).toContain('ORG-JS-MODEL');
    expect(panel.shadowRoot.textContent).toContain('描画データの型が不正です。');
    panel.shadowRoot.querySelector('lightning-button').click();
    expect(dismissed).toHaveBeenCalledTimes(1);
    await expect(panel).toBeAccessible();
});
