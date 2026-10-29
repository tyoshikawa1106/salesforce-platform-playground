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
it('処理場所・種類・位置を表示し、閉じる操作だけ親へ通知する', async () => {
    const panel = createElement('c-ui-error-panel', { is: UiErrorPanel });
    panel.details = { location: 'sample.js / search / request', errorType: 'TypeError', frame: 'sample.js:12:3' };
    const dismissed = jest.fn();
    panel.addEventListener('dismiss', dismissed);
    document.body.appendChild(panel);
    expect(panel.shadowRoot.querySelector('[role="alert"]').textContent).toContain('sample.js / search / request');
    expect(panel.shadowRoot.textContent).toContain('TypeError');
    expect(panel.shadowRoot.textContent).toContain('sample.js:12:3');
    panel.shadowRoot.querySelector('lightning-button').click();
    expect(dismissed).toHaveBeenCalledTimes(1);
    await expect(panel).toBeAccessible();
});
