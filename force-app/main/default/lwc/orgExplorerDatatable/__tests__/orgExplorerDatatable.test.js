import { createElement } from 'lwc';
import OrgExplorerDatatable from 'c/orgExplorerDatatable';

jest.mock('lightning/datatable', () => require('../../../../../test/jest-mocks/lightning/orgExplorerCellDatatable'));

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

it('有効・無効のどちらも操作不能なチェックボックスを表示し、値の変更に追従する', async () => {
    const element = createElement('c-org-explorer-datatable', { is: OrgExplorerDatatable });
    element.columns = [{ typeAttributes: { label: '有効' } }];
    element.data = [{ isActive: false }];
    document.body.appendChild(element);
    const checkbox = element.shadowRoot.querySelector('lightning-input');
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.label).toBe('有効');
    element.data = [{ isActive: true }];
    await Promise.resolve();
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    element.columns = [{ typeAttributes: { label: 'Active' } }];
    await Promise.resolve();
    expect(checkbox.label).toBe('Active');
    await expect(element).toBeAccessible();
});

it('標準メール部品へ元の値を渡し、アイコンを隠して表のキーボード操作に従う', async () => {
    const element = createElement('c-org-explorer-datatable', { is: OrgExplorerDatatable });
    element.columns = [{ fieldName: 'email', type: 'readOnlyEmail' }];
    element.data = [{ email: 'demo+sales@example.com' }];
    document.body.appendChild(element);
    const email = element.shadowRoot.querySelector('lightning-formatted-email');
    expect(email.value).toBe('demo+sales@example.com');
    expect(email.hideIcon).toBe(true);
    expect(email.getAttribute('tabindex')).toBe('-1');
    expect(email.getAttribute('data-navigation')).toBe('enable');
    element.internalTabIndex = 0;
    element.data = [{ email: 'other@example.com' }];
    await Promise.resolve();
    expect(email.value).toBe('other@example.com');
    expect(email.getAttribute('tabindex')).toBe('0');
    element.data = [];
    await Promise.resolve();
    expect(email.value).toBeUndefined();
    await expect(element).toBeAccessible();
});
