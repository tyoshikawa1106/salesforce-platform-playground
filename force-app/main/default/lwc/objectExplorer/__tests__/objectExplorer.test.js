import { setImmediate } from 'node:timers';
import revokeApiAuthentication from '@salesforce/apex/ObjectExplorerController.revokeApiAuthentication';
import getApiAuthentication from '@salesforce/apex/ObjectExplorerController.getApiAuthentication';
import getApiAuthenticationUrl from '@salesforce/apex/ObjectExplorerController.getApiAuthenticationUrl';
import { createElement } from 'lwc';
import ObjectExplorer from 'c/objectExplorer';
import getObjectInfo from '@salesforce/apex/ObjectExplorerController.getObjectInfo';
import searchObjects from '@salesforce/apex/ObjectExplorerController.searchObjects';
import getFieldAudit from '@salesforce/apex/ObjectExplorerController.getFieldAudit';
import getClassifyData from '@salesforce/apex/ObjectExplorerController.getClassifyData';
import saveClassifyData from '@salesforce/apex/ObjectExplorerController.saveClassifyData';
import LightningConfirm from 'lightning/confirm';
import CsvExportModal from 'c/setupAuditTrailExportModal';
import searchClassifyOwners from '@salesforce/apex/ObjectExplorerController.searchClassifyOwners';
import * as objectExplorerLogic from '../objectExplorerLogic';

jest.mock('@salesforce/apex/ObjectExplorerController.getObjectInfo', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.searchObjects', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.getFieldAudit', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.getClassifyData', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.searchClassifyOwners', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.resolveClassifyOwners', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.saveClassifyData', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/userPermission/ModifyDataClassification', () => ({ __esModule: true, default: false }), { virtual: true });
jest.mock('@salesforce/userPermission/CustomizeApplication', () => ({ __esModule: true, default: true }), { virtual: true });
jest.mock('c/setupAuditTrailExportModal', () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock('lightning/confirm', () => ({ __esModule: true, default: { open: jest.fn() } }));

jest.mock('@salesforce/apex/ObjectExplorerController.getApiAuthentication', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.getApiAuthenticationUrl', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/ObjectExplorerController.revokeApiAuthentication', () => ({ default: jest.fn() }), { virtual: true });

const flush = () => Array.from({ length: 30 }).reduce((p) => p.then(() => Promise.resolve()), Promise.resolve());
const objectInfo = { apiName: 'Account', label: '取引先', fields: [{ apiName: 'Name', label: '名前', type: 'STRING', typeLabel: 'テキスト(255)', custom: false }], relations: [] };
const classify = { rows: { Name: { editable: true, complianceGroup: '', securityClassification: '', businessStatus: '', ownerId: '', ownerLabel: '未設定' } }, options: { ComplianceGroup: [], SecurityClassification: [], BusinessStatus: [{ label: '使用中', value: 'Active' }] } };

function createComponent() {
    const element = createElement('c-object-explorer', { is: ObjectExplorer });
    document.body.appendChild(element);
    return element;
}
async function pickAccount(element) {
    element.shadowRoot.querySelector('c-object-explorer-lookup').dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    element.shadowRoot.querySelector('c-object-explorer-lookup').dispatchEvent(new CustomEvent('candidatepick', { detail: { apiName: 'Account' } }));
    await flush();
}
async function editClassify(element) {
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    element.shadowRoot.querySelector('[data-property="businessStatus"]').dispatchEvent(new CustomEvent('change', { detail: { value: 'Active' } }));
    await flush();
}
beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    require('@salesforce/userPermission/ModifyDataClassification').default = false;
    require('@salesforce/userPermission/CustomizeApplication').default = true;
    global.ResizeObserver = class { observe() {} disconnect() {} };
    getApiAuthentication.mockResolvedValue({ status: 'AUTHENTICATED', message: '' });
    getApiAuthenticationUrl.mockResolvedValue('https://example.my.salesforce.com/auth');
    searchObjects.mockResolvedValue([{ apiName: 'Account', label: '取引先' }]);
    getObjectInfo.mockResolvedValue(objectInfo);
    getClassifyData.mockResolvedValue(classify);
    LightningConfirm.open.mockResolvedValue(true);
    revokeApiAuthentication.mockResolvedValue(undefined);
});
afterEach(() => {
    document.body.replaceChildren();
    jest.clearAllMocks();
    jest.restoreAllMocks();
});
it('未選択の初期表示では照会せず、候補選択後に同じ対象を表示する', async () => {
    const element = createComponent();
    await flush();
    expect(getObjectInfo).not.toHaveBeenCalled();
    await pickAccount(element);
    expect(getObjectInfo).toHaveBeenCalledWith({ objectName: 'Account', mode: 'reference' });
    expect(getFieldAudit).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('c-object-explorer-lookup').selectedLabel).toBe('取引先');
    expect(element.shadowRoot.querySelector('.c-detail-title').textContent).toContain('取引先');
    await expect(element).toBeAccessible();
});
it('古い検索応答で最新の候補を上書きしない', async () => {
    const element = createComponent();
    await flush();
    let finish;
    searchObjects.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: 'old' } }));
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: 'new' } }));
    await flush();
    finish([{ apiName: 'Contact', label: '古い候補' }]);
    await flush();
    expect(lookup.candidateView.items.map((item) => item.value)).toEqual(['Account']);
});
it('取得失敗では前の対象を戻さずエラーを表示する', async () => {
    const element = createComponent();
    await flush();
    getObjectInfo.mockRejectedValueOnce({ body: { message: '参照できません' } });
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('参照できません');
    expect(element.shadowRoot.querySelector('.c-detail-title')).toBeNull();
    await expect(element).toBeAccessible();
});
it('分類保存の確認中から操作を止め、確定した変更だけを送信する', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    let confirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: true, latest: { businessStatus: 'Active' }, owner: { value: '', label: '未設定' }, message: '' }]);
    const save = element.shadowRoot.querySelector('.c-save-bar lightning-button');
    save.click();
    await flush();
    expect(save.disabled).toBe(true);
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
    confirm(true);
    await flush();
    const request = saveClassifyData.mock.calls[0][0];
    expect(request.objectName).toBe('Account');
    expect(JSON.parse(request.changesJson)).toEqual([{ apiName: 'Name', original: { complianceGroup: '', securityClassification: '', businessStatus: '', ownerId: '' }, draft: { complianceGroup: '', securityClassification: '', businessStatus: 'Active', ownerId: '' } }]);
    expect(element.shadowRoot.textContent).toContain('1項目のデータ分類を保存しました');
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
    expect(save.disabled).toBe(true);
});
it('保存失敗では変更を保持して再操作できる', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: false, message: '編集中に変更されました' }]);
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('編集中に変更されました');
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
});
it('メール型への絞り込み後も機密度と利用状況を同じ項目へ保持する', async () => {
    getObjectInfo.mockResolvedValueOnce({ ...objectInfo, fields: [...objectInfo.fields, { apiName: 'Email__c', label: 'メール', type: 'EMAIL', typeLabel: 'メール', custom: true }] });
    getClassifyData.mockResolvedValueOnce({
        rows: { ...classify.rows, Email__c: { ...classify.rows.Name } },
        options: { ...classify.options, SecurityClassification: [{ label: '機密', value: 'Confidential' }] }
    });
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    const filter = element.shadowRoot.querySelector('.c-filters lightning-combobox');
    filter.dispatchEvent(new CustomEvent('change', { detail: { value: 'メール' } }));
    await flush();
    for (const [key, value] of [['securityClassification', 'Confidential'], ['businessStatus', 'Active']]) {
        const input = element.shadowRoot.querySelector(`[data-field="Email__c"][data-property="${key}"]`);
        input.dispatchEvent(new CustomEvent('change', { detail: { value } }));
    }
    await flush();
    for (const [key, value] of [['securityClassification', 'Confidential'], ['businessStatus', 'Active']]) {
        expect(element.shadowRoot.querySelector(`[data-field="Email__c"][data-property="${key}"]`).value).toBe(value);
    }
    filter.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
    await flush();
    expect(element.shadowRoot.querySelector('[data-field="Email__c"][data-property="securityClassification"]').value).toBe('Confidential');
    expect(element.shadowRoot.querySelector('[data-field="Email__c"][data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('[data-field="Name"][data-property="businessStatus"]').value).toBeUndefined();
});
it.each(['Delete', '解除ボタン'])('%sで対象を解除すると新しい検索欄にフォーカスが戻る', async (operation) => {
    const element = createComponent();
    await flush();
    await pickAccount(element);
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    const input = lookup.shadowRoot.querySelector('input');
    input.focus();
    if (operation === 'Delete') {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
    } else {
        lookup.shadowRoot.querySelector('lightning-button-icon').click();
    }
    await flush();
    const search = lookup.shadowRoot.querySelector('input:not([readonly])');
    expect(search).not.toBeNull();
    expect(lookup.shadowRoot.activeElement).toBe(search);
    expect(search.getAttribute('aria-expanded')).toBe('false');
});

it('表示モード変更に伴う対象解除では検索欄へフォーカスを移さない', async () => {
    const element = createComponent();
    await flush();
    await pickAccount(element);
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    const search = lookup.shadowRoot.querySelector('input:not([readonly])');
    expect(search).not.toBeNull();
    expect(lookup.shadowRoot.activeElement).not.toBe(search);
});

it('破棄確認のキャンセルでは対象と分類の入力を維持する', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    LightningConfirm.open.mockResolvedValueOnce(false);
    element.shadowRoot.querySelector('c-object-explorer-lookup').dispatchEvent(new CustomEvent('clear'));
    await flush();
    expect(element.shadowRoot.querySelector('c-object-explorer-lookup').selectedLabel).toBe('取引先');
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
});

it.each([[true, false, true], [false, true, true], [false, false, false]])(
    '分類変更=%s、カスタマイズ=%sで編集表示=%s', async (modify, customize, editable) => {
        let element;
        const lwcRuntime = jest.requireActual('lwc');
        jest.doMock('lwc', () => lwcRuntime);
        jest.isolateModules(() => {
            require('@salesforce/userPermission/ModifyDataClassification').default = modify;
            require('@salesforce/userPermission/CustomizeApplication').default = customize;
            require('@salesforce/apex/ObjectExplorerController.searchObjects').default.mockResolvedValue([{ apiName: 'Account', label: '取引先' }]);
            require('@salesforce/apex/ObjectExplorerController.getObjectInfo').default.mockResolvedValue(objectInfo);
            require('@salesforce/apex/ObjectExplorerController.getClassifyData').default.mockResolvedValue(classify);
            const component = require('c/objectExplorer').default;
            element = require('lwc').createElement('c-object-explorer', { is: component });
            document.body.appendChild(element);
        });
        await flush();
        element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
        await flush();
        await pickAccount(element);
        expect(Boolean(element.shadowRoot.querySelector('[data-property="businessStatus"]'))).toBe(editable);
        await expect(element).toBeAccessible();
    }
);

it.each([undefined, {}, () => {}, function () { throw new DOMException('unavailable', 'SecurityError'); }])('サイズ監視APIが使えなくても表示・幅変更・監視解除ができる (%p)', async (observer) => {
    global.ResizeObserver = observer;
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const element = createComponent();
    await flush();
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('.c-detail-title').textContent).toContain('取引先');
    const registrationsBeforeResize = add.mock.calls.filter(([type]) => type === 'resize');
    const viewport = element.shadowRoot.querySelector('.c-viewport');
    let width = 900;
    Object.defineProperty(viewport, 'clientWidth', { get: () => width, configurable: true });
    window.dispatchEvent(new CustomEvent('resize'));
    await flush();
    expect(element.shadowRoot.querySelector('.c-card-grid-narrow')).not.toBeNull();
    width = 1400;
    window.dispatchEvent(new CustomEvent('resize'));
    await flush();
    expect(element.shadowRoot.querySelector('.c-card-grid-narrow')).toBeNull();
    const listeners = add.mock.calls.filter(([type]) => type === 'resize');
    expect(listeners).toHaveLength(registrationsBeforeResize.length);
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    expect(remove).toHaveBeenCalledWith('resize', listeners[listeners.length - 1][1]);
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'reference' } }));
    await flush();
    const renewed = add.mock.calls.filter(([type]) => type === 'resize');
    expect(renewed).toHaveLength(listeners.length + 1);
    element.remove();
    expect(remove).toHaveBeenCalledWith('resize', renewed[renewed.length - 1][1]);
});
it('対応環境では要素のサイズ変更を監視し画面破棄時に解除する', async () => {
    let notify;
    const observe = jest.fn();
    const disconnect = jest.fn();
    global.ResizeObserver = jest.fn((callback) => { notify = callback; return { observe, disconnect }; });
    const add = jest.spyOn(window, 'addEventListener');
    const element = createComponent();
    await flush();
    await pickAccount(element);
    expect(observe).toHaveBeenCalledWith(element.shadowRoot.querySelector('.c-viewport'));
    notify([{ contentRect: { width: 900 } }]);
    await flush();
    expect(element.shadowRoot.querySelector('.c-card-grid-narrow')).not.toBeNull();
    notify([{ contentRect: { width: 1400 } }]);
    await flush();
    expect(element.shadowRoot.querySelector('.c-card-grid-narrow')).toBeNull();
    expect(add.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(0);
    element.remove();
    expect(disconnect).toHaveBeenCalled();
});

it('サイズ監視の登録が拒否されても監視を解放してウィンドウの幅変更で表示を継続する', async () => {
    const disconnect = jest.fn();
    global.ResizeObserver = jest.fn(() => ({
        observe() { throw new TypeError('The provided value is not of type Element'); },
        disconnect
    }));
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const element = createComponent();
    await flush();
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('.c-detail-title').textContent).toContain('取引先');
    expect(element.shadowRoot.querySelector('.c-client-error')).toBeNull();
    expect(disconnect).toHaveBeenCalledTimes(global.ResizeObserver.mock.calls.length);
    const registrations = add.mock.calls.filter(([type]) => type === 'resize');
    const viewport = element.shadowRoot.querySelector('.c-viewport');
    Object.defineProperty(viewport, 'clientWidth', { value: 900, configurable: true });
    window.dispatchEvent(new CustomEvent('resize'));
    await flush();
    expect(element.shadowRoot.querySelector('.c-card-grid-narrow')).not.toBeNull();
    const listeners = add.mock.calls.filter(([type]) => type === 'resize');
    expect(listeners).toHaveLength(registrations.length);
    element.remove();
    expect(remove).toHaveBeenCalledWith('resize', listeners[listeners.length - 1][1]);
});

it('接続状態のDOMプロパティが未公開でも保存確認を表示する', async () => {
    class LegacyObjectExplorer extends ObjectExplorer {
        get isConnected() { return undefined; }
    }
    const element = createElement('c-object-explorer', { is: LegacyObjectExplorer });
    document.body.appendChild(element);
    await editClassify(element);
    LightningConfirm.open.mockResolvedValueOnce(false);
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(LightningConfirm.open).toHaveBeenCalledWith(expect.objectContaining({ label: '保存の確認', message: '1項目のデータ分類を保存しますか？' }));
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
});
it('保存確認を待つ間に画面を閉じた場合は保存しない', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    let confirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    element.remove();
    confirm(true);
    await flush();
    expect(saveClassifyData).not.toHaveBeenCalled();
});

it('保存内容の準備でJS例外が起きても未実行を表示して再操作できる', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(objectExplorerLogic, 'classifyChanges').mockImplementationOnce(() => { throw new TypeError('sensitive input'); });
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('保存内容の準備に失敗しました（TypeError）。保存は実行していません。');
    expect(LightningConfirm.open).not.toHaveBeenCalled();
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive input');
});
it('保存確認の表示失敗を保存APIの失敗と区別してロックを解除する', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    LightningConfirm.open.mockRejectedValueOnce(new TypeError('sensitive modal detail'));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('保存確認画面の表示に失敗しました（TypeError）。保存は実行していません。');
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive modal detail');
});

it('両モードで種別の絞り込みを表示せず標準とカスタムを同じ候補で検索する', async () => {
    searchObjects.mockResolvedValue([{ apiName: 'Account', label: '取引先' }, { apiName: 'ExplorerProbe__c', label: '検証対象' }]);
    const element = createComponent();
    await flush();
    const toolbar = element.shadowRoot.querySelector('.c-toolbar');
    expect(toolbar.firstElementChild.className).toBe('c-lookup');
    expect([...element.shadowRoot.querySelectorAll('lightning-radio-group')].map((control) => control.label)).not.toContain('種別');
    expect([...element.shadowRoot.querySelectorAll('lightning-radio-group')].map((control) => control.label)).toContain('参照元の種類');
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    expect(searchObjects).toHaveBeenLastCalledWith({ term: '' });
    expect(lookup.candidateView.items.map((item) => item.value)).toEqual(['Account', 'ExplorerProbe__c']);
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    expect([...element.shadowRoot.querySelectorAll('lightning-radio-group')].map((control) => control.label)).not.toContain('種別');
    expect([...element.shadowRoot.querySelectorAll('lightning-radio-group')].map((control) => control.label)).not.toContain('参照元の種類');
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: 'Probe' } }));
    await flush();
    expect(searchObjects).toHaveBeenLastCalledWith({ term: 'Probe' });
});

it('画面イベントのJS例外は標準エラーページへ伝播させず場所を表示する', async () => {
    const element = createComponent();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: null }));
    await flush();
    const alert = element.shadowRoot.querySelector('.c-client-error');
    expect(alert.textContent).toContain('objectExplorer.js / handleSearch / ui-event');
    expect(alert.textContent).toContain('TypeError');
    expect(element.shadowRoot.querySelector('h1').textContent).toBe('オブジェクトエクスプローラー');
    expect(searchObjects).not.toHaveBeenCalled();
});
it.each(['reference', 'classify'])('カスタム列は枠なしのチェックを表示する（%s）', async (mode) => {
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields: [...objectInfo.fields, { apiName: 'Flag__c', label: '独自項目', type: 'BOOLEAN', custom: true }] });
    getClassifyData.mockResolvedValue({ ...classify, rows: { ...classify.rows, Flag__c: { ...classify.rows.Name } } });
    const element = createComponent();
    await flush();
    if (mode === 'classify') {
        await flush();
        element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: mode } }));
        await flush();
    }
    await pickAccount(element);
    const icons = [...element.shadowRoot.querySelectorAll('tbody lightning-icon')].filter((icon) => icon.iconName === 'utility:check');
    expect(icons).toHaveLength(1);
    expect(icons[0].alternativeText).toBe('カスタム項目');
    expect(element.shadowRoot.querySelector('tbody lightning-input[type="checkbox"]')).toBeNull();
    expect(element.shadowRoot.querySelector('tbody').textContent).toContain('標準項目');
    await expect(element).toBeAccessible();
});

it('所有者の空欄クリック・空白入力では検索せず、文字入力後だけ検索する', async () => {
    searchClassifyOwners.mockResolvedValue([]);
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    const input = element.shadowRoot.querySelector('input[data-field="Name"]');
    expect(input.placeholder).toBe('');
    const searchIcon = [...input.parentElement.querySelectorAll('lightning-icon')].find((icon) => icon.iconName === 'utility:search');
    expect(searchIcon.alternativeText).toBe('検索');
    expect(searchIcon.classList.contains('slds-input__icon_right')).toBe(true);
    input.click();
    input.value = ' 　';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect(searchClassifyOwners).not.toHaveBeenCalled();
    input.value = '検索氏名';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect(searchClassifyOwners).toHaveBeenCalledWith({ term: '検索氏名' });
    searchClassifyOwners.mockClear();
    const current = element.shadowRoot.querySelector('input[data-field="Name"]');
    current.value = '';
    current.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect(searchClassifyOwners).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-owner-options')).toBeNull();
});

it('分類は編集不可・未取得を一覧から除外し、件数を揃える', async () => {
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields: [...objectInfo.fields,
        { apiName: 'ReadOnly__c', label: '編集不可', type: 'BOOLEAN' },
        { apiName: 'Unavailable__c', label: '未取得', type: 'BOOLEAN' }] });
    getClassifyData.mockResolvedValue({ ...classify, rows: { ...classify.rows, ReadOnly__c: { editable: false } } });
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('tbody').textContent).toContain('Name');
    expect(element.shadowRoot.querySelector('tbody').textContent).not.toContain('ReadOnly__c');
    expect(element.shadowRoot.querySelector('tbody').textContent).not.toContain('Unavailable__c');
    expect(element.shadowRoot.textContent).toContain('1項目');
});

function exportButton(element) {
    return [...element.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === 'CSVダウンロード');
}

it('構造CSVの取得に失敗した場合は同じモーダルで再試行できる', async () => {
    const element = createComponent();
    await flush();
    await pickAccount(element);
    let finish;
    CsvExportModal.open.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    exportButton(element).click();
    const { buildFile, exportSubject } = CsvExportModal.open.mock.calls[0][0];
    expect(exportSubject).toContain('項目定義 全1件');
    getClassifyData.mockRejectedValueOnce(new Error('分類取得失敗'));
    await expect(buildFile(undefined, () => true, jest.fn())).rejects.toThrow('データ分類を取得できませんでした');
    await flush();
    expect(element.shadowRoot.querySelector('.c-client-error').textContent).toContain('handleExportCsv');
    const progress = jest.fn();
    await buildFile(undefined, () => true, progress);
    expect(progress.mock.calls).toEqual([[0], [1]]);
    finish(false);
    await flush();
});

it.each(['reference', 'classify'])('確認・進捗とCSVの明細数が一致し、離脱時にURLを解放する（%s）', async mode => {
    const fields = Array.from({ length: 53 }, (_, i) => ({ ...objectInfo.fields[0], apiName: 'F' + i }));
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields });
    getClassifyData.mockResolvedValue({ ...classify, rows: Object.fromEntries(fields.map((field, i) => [field.apiName, { ...classify.rows.Name, editable: i >= 3 }])) });
    const createUrl = URL.createObjectURL;
    const revokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:test');
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
        const element = createComponent();
        await flush();
        if (mode === 'classify') {
            element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: mode } }));
            await flush();
        }
        await pickAccount(element);
        const count = mode === 'reference' ? 53 : 50;
        CsvExportModal.open.mockResolvedValueOnce(false);
        exportButton(element).click();
        await flush();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        let finish;
        CsvExportModal.open.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        exportButton(element).click();
        exportButton(element).click();
        expect(CsvExportModal.open).toHaveBeenCalledTimes(2);
        const { buildFile, exportSubject } = CsvExportModal.open.mock.calls[1][0];
        expect(exportSubject).toContain('全' + count + '件');
        const progress = jest.fn();
        await buildFile(undefined, () => true, progress);
        expect(progress.mock.calls.flat()).toEqual(mode === 'reference' ? [0, 25, 50, 53] : [0, 25, 50]);
        finish(true);
        await flush();
        expect(click.mock.instances[0]).toBe(element.shadowRoot.querySelector('[data-download]'));
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        const text = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(URL.createObjectURL.mock.calls[0][0]);
        });
        expect(text.split('\r\n')).toHaveLength(count + 1);
        element.remove();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    } finally {
        URL.createObjectURL = createUrl;
        URL.revokeObjectURL = revokeUrl;
    }
});

it('途中キャンセルと再接続の後は、古いモーダルから出力しない', async () => {
    const fields = Array.from({ length: 51 }, (_, index) => ({ ...objectInfo.fields[0], apiName: 'F' + index }));
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields });
    const element = createComponent();
    await flush();
    await pickAccount(element);
    let finish;
    CsvExportModal.open.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    exportButton(element).click();
    const { buildFile, ownerSignal } = CsvExportModal.open.mock.calls[0][0];
    let open = true;
    const progress = jest.fn(count => { open = count < 25; });
    await buildFile(undefined, () => open, progress);
    expect(progress.mock.calls).toEqual([[0], [25]]);
    element.remove();
    document.body.appendChild(element);
    expect(ownerSignal.aborted).toBe(true);
    getClassifyData.mockClear();
    await buildFile(undefined, () => true, progress);
    expect(getClassifyData).not.toHaveBeenCalled();
    const download = jest.spyOn(HTMLAnchorElement.prototype, 'click');
    finish(true);
    await flush();
    expect(download).not.toHaveBeenCalled();
});

it.each(['reference', 'classify'])('0件時の案内は一覧の全列に広がる（%s）', async (mode) => {
    const element = createComponent();
    await flush();
    if (mode === 'classify') {
        await flush();
        element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: mode } }));
        await flush();
    }
    await pickAccount(element);
    const search = element.shadowRoot.querySelector('.c-field-search');
    search.value = '一致しない項目';
    search.dispatchEvent(new CustomEvent('change'));
    await flush();
    const headers = element.shadowRoot.querySelectorAll('thead th');
    const empty = element.shadowRoot.querySelector('tbody td[colspan]');
    expect(headers).toHaveLength(mode === 'reference' ? 6 : 8);
    expect(empty.colSpan).toBe(headers.length);
    expect(empty.textContent).toContain('条件に一致する項目がありません');
    await expect(element).toBeAccessible();
});


it('監査情報の取得失敗は項目一覧を開く前から理由を表示して構造の閲覧を継続する', async () => {
    getObjectInfo.mockResolvedValueOnce({ ...objectInfo, fields: [{ ...objectInfo.fields[0], custom: true }] });
    getFieldAudit.mockRejectedValueOnce({ body: { message: 'API接続・接続先組織の確認：HTTP 401' } });
    const element = createComponent();
    await flush();
    await pickAccount(element);
    const alert = element.shadowRoot.querySelector('.c-client-error');
    expect(alert.textContent).toContain('readObjectInfo / field-audit');
    expect(alert.textContent).toContain('理由：API接続・接続先組織の確認：HTTP 401');
    expect(element.shadowRoot.querySelector('.c-detail-title')).not.toBeNull();
    await expect(element).toBeAccessible();
});

it('保存失敗の詳細は項目一覧の検索で行が非表示になっても残す', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: false, message: 'API接続・接続先組織の確認：HTTP 403' }]);
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    const search = element.shadowRoot.querySelector('.c-field-search');
    search.value = '存在しない項目';
    search.dispatchEvent(new CustomEvent('change'));
    await flush();
    expect(element.shadowRoot.querySelectorAll('tbody [data-property="businessStatus"]')).toHaveLength(0);
    const detail = element.shadowRoot.querySelector('[aria-label="保存失敗の詳細"]');
    expect(detail.textContent).toContain('名前（Name）：API接続・接続先組織の確認：HTTP 403');
    await expect(element).toBeAccessible();
});


it('監査APIの成功後に表示データの加工が失敗した場合は認証失敗と区別する', async () => {
    getObjectInfo.mockResolvedValueOnce({ ...objectInfo, fields: [{ ...objectInfo.fields[0], custom: true }] });
    getFieldAudit.mockResolvedValueOnce(null);
    const element = createComponent();
    await flush();
    await pickAccount(element);
    const alert = element.shadowRoot.querySelector('.c-client-error');
    expect(alert.textContent).toContain('readObjectInfo / field-audit-view');
    expect(alert.textContent).toContain('TypeError');
    expect(alert.textContent).toContain('API応答の項目監査情報がオブジェクト形式ではありません');
    expect(alert.textContent).toContain('OE-JS-AUDIT-DATA');
    expect(alert.textContent).not.toContain('API連携設定と権限を確認');
});

it('APIの固定コードは画面に表示し、公開メッセージ本文はログに含めない', async () => {
    const message = 'API接続：[OE-AUTH-401] APIが認証を拒否しました。';
    getObjectInfo.mockResolvedValueOnce({ ...objectInfo, fields: [{ ...objectInfo.fields[0], custom: true }] });
    getFieldAudit.mockRejectedValueOnce({ body: { message } });
    const element = createComponent();
    await flush();
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('.c-client-error').textContent).toContain('エラーコード：OE-AUTH-401');
    expect(console.error).not.toHaveBeenCalled();
});

it('未認証の場合は対象未選択でも共通のAPI認証を表示する', async () => {
    getApiAuthentication.mockResolvedValueOnce({ status: 'REQUIRED', message: 'API認証してください。' });
    const element = createComponent();
    await flush();
    const link = element.shadowRoot.querySelector('.c-authentication a');
    expect(link.textContent).toBe('認証');
    expect(element.shadowRoot.querySelector('.c-authentication lightning-button')).toBeNull();
    expect(link.target).toBe('_self');
    expect(getApiAuthenticationUrl).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('.c-mode')).toBeNull();
    expect(element.shadowRoot.querySelector('c-object-explorer-lookup')).toBeNull();
    expect(element.shadowRoot.querySelector('section.slds-box')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-authentication').classList.contains('slds-theme_default')).toBe(true);
});
it('権限不足の案内を維持して認証をやり直す導線を表示する', async () => {
    getApiAuthentication.mockResolvedValueOnce({ status: 'NO_ACCESS', message: '管理者に確認してください。' });
    const element = createComponent();
    await flush();
    expect(element.shadowRoot.querySelector('.c-authentication a')).not.toBeNull();
    expect(getApiAuthenticationUrl).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('.c-authentication').textContent).toContain('管理者');
});
it('認証状態の確認失敗では例外本文を表示しない', async () => {
    getApiAuthentication.mockRejectedValueOnce(new Error('PRIVATE_VALUE'));
    const element = createComponent();
    await flush();
    expect(element.shadowRoot.textContent).not.toContain('PRIVATE_VALUE');
    expect(element.shadowRoot.querySelector('.c-authentication a')).not.toBeNull();
    expect(element.shadowRoot.querySelector('.c-authentication').textContent).toContain('認証をやり直す');
});
it('同じタブの認証から戻って画面が再生成されたら認証状態を確認する', async () => {
    getApiAuthentication.mockResolvedValueOnce({ status: 'REQUIRED', message: '認証してください。' });
    const before = createComponent();
    await flush();
    expect(before.shadowRoot.querySelector('.c-authentication a').target).toBe('_self');
    before.remove();
    getApiAuthentication.mockResolvedValueOnce({ status: 'AUTHENTICATED', message: '' });
    const after = createComponent();
    await flush();
    expect(getApiAuthentication).toHaveBeenCalledTimes(2);
    expect(after.shadowRoot.querySelector('.c-authentication')).toBeNull();
    expect(after.shadowRoot.querySelector('.c-mode')).not.toBeNull();
    expect(after.shadowRoot.querySelector('c-object-explorer-lookup')).not.toBeNull();
});
it('認証状態の初期確認中は操作領域を表示しない', async () => {
    getApiAuthentication.mockImplementationOnce(() => new Promise(() => {}));
    const element = createComponent();
    await flush();
    expect(element.shadowRoot.querySelector('.c-mode')).toBeNull();
    expect(element.shadowRoot.querySelector('c-object-explorer-lookup')).toBeNull();
    expect(element.shadowRoot.textContent).toContain('認証状態を確認しています');
});

it('再接続前の解除確認は送信せず、新しい解除確認のロックを維持する', async () => {
    const element = createComponent();
    await flush();
    let oldConfirm;
    let newConfirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise(resolve => { oldConfirm = resolve; }))
        .mockImplementationOnce(() => new Promise(resolve => { newConfirm = resolve; }));
    const revoke = () => element.shadowRoot.querySelector('[data-authentication-revoke]');
    revoke().click();
    await flush();
    element.remove();
    document.body.appendChild(element);
    await flush();
    revoke().click();
    oldConfirm(true);
    await flush();
    expect(revokeApiAuthentication).not.toHaveBeenCalled();
    expect(revoke().disabled).toBe(true);
    newConfirm(false);
    await flush();
    expect(revoke().disabled).toBe(false);
});

it('送信済みの認証解除は再接続後も完了を待ってから状態を照会する', async () => {
    const element = createComponent();
    await flush();
    let finish;
    revokeApiAuthentication.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    element.shadowRoot.querySelector('[data-authentication-revoke]').click();
    await flush();
    element.remove();
    document.body.appendChild(element);
    await flush();
    expect(getApiAuthentication).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('.c-mode')).toBeNull();
    getApiAuthentication.mockResolvedValueOnce({ status: 'REQUIRED', message: '認証してください。' });
    finish();
    await flush();
    expect(getApiAuthentication).toHaveBeenCalledTimes(2);
    expect(revokeApiAuthentication).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('.c-authentication a')).not.toBeNull();
});

it('再接続前の破棄確認で分類入力やモードを変更しない', async () => {
    const element = createComponent();
    await editClassify(element);
    let confirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'reference' } }));
    await flush();
    element.remove();
    document.body.appendChild(element);
    await flush();
    confirm(true);
    await flush();
    expect(element.shadowRoot.querySelector('.c-mode').value).toBe('classify');
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
});

it('画面離脱でCSVの取込確認を中断して未保存入力を維持する', async () => {
    const element = createComponent();
    await editClassify(element);
    let confirm;
    const confirming = new Promise(resolve => {
        LightningConfirm.open.mockImplementationOnce(() => {
            resolve();
            return new Promise(finish => { confirm = finish; });
        });
    });
    const csv = 'ObjectApiName,FieldApiName,ComplianceGroup,SecurityClassification,BusinessStatus,BusinessOwnerId\nAccount,Name,,,,';
    const input = element.shadowRoot.querySelector('.c-csv-import lightning-input');
    Object.defineProperty(input, 'files', { value: [new File([csv], 'classify.csv')] });
    input.dispatchEvent(new CustomEvent('change'));
    await confirming;
    element.remove();
    document.body.appendChild(element);
    await flush();
    confirm(true);
    await flush();
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('.c-csv-import lightning-input').disabled).toBe(false);
    expect(element.shadowRoot.textContent).not.toContain('CSVから1項目');
    expect(saveClassifyData).not.toHaveBeenCalled();
});

it('認証解除をキャンセルした場合は資格情報と未保存入力を保持する', async () => {
    const element = createComponent();
    await editClassify(element);
    LightningConfirm.open.mockResolvedValueOnce(false);
    element.shadowRoot.querySelector('[data-authentication-revoke]').click();
    await flush();
    expect(LightningConfirm.open).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('未保存') }));
    expect(revokeApiAuthentication).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('[data-authentication-revoke]').disabled).toBe(false);
});
it('認証解除を確認した場合だけ解除して認証案内に戻る', async () => {
    const element = createComponent();
    await flush();
    let confirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    element.shadowRoot.querySelector('[data-authentication-revoke]').click();
    await flush();
    expect(element.shadowRoot.querySelector('[data-authentication-revoke]').disabled).toBe(true);
    expect(revokeApiAuthentication).not.toHaveBeenCalled();
    getApiAuthentication.mockResolvedValueOnce({ status: 'REQUIRED', message: 'Salesforce APIを使用します。認証ボタンをクリックしてください。' });
    confirm(true);
    await flush();
    expect(revokeApiAuthentication).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('[data-authentication-revoke]')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-mode')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-authentication a').textContent).toBe('認証');
});
it('認証解除の結果が不明なら内部例外を出さず操作を止める', async () => {
    const element = createComponent();
    await flush();
    revokeApiAuthentication.mockRejectedValueOnce(new Error('PRIVATE_VALUE'));
    element.shadowRoot.querySelector('[data-authentication-revoke]').click();
    await flush();
    expect(element.shadowRoot.textContent).not.toContain('PRIVATE_VALUE');
    expect(element.shadowRoot.textContent).toContain('解除結果を確認できません');
    expect(element.shadowRoot.querySelector('section.slds-box')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-authentication a')).toBeNull();
});
it('解除確認の表示に失敗した場合は認証と入力を維持する', async () => {
    const element = createComponent();
    await editClassify(element);
    LightningConfirm.open.mockRejectedValueOnce(new Error('PRIVATE_VALUE'));
    element.shadowRoot.querySelector('[data-authentication-revoke]').click();
    await flush();
    expect(revokeApiAuthentication).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('[data-authentication-revoke]').disabled).toBe(false);
    expect(element.shadowRoot.textContent).not.toContain('解除結果を確認できません');
    expect(element.shadowRoot.textContent).not.toContain('PRIVATE_VALUE');
});

it('確認後の保存中だけ固定スピナーを表示し、拒否後は解除して入力を保持する', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    let confirm;
    let complete;
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    saveClassifyData.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
    confirm(true);
    await flush();
    const progress = element.shadowRoot.querySelector('.c-save-progress');
    expect(progress.textContent).toContain('保存しています…');
    expect(progress.querySelector('lightning-spinner').size).toBe('large');
    await expect(element).toBeAccessible();
    complete([{ apiName: 'Name', success: false, message: '更新拒否' }]);
    await flush();
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
});

it('保存をキャンセルした場合はAPIを呼ばず、診断も進捗も表示しない', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    LightningConfirm.open.mockResolvedValueOnce(false);
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-client-error')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
    expect(element.shadowRoot.textContent).not.toContain('保存の確認画面を開いています');
    expect(element.shadowRoot.textContent).toContain('保存をキャンセルしました');
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
});

it('保存要求が例外で失敗しても固定スピナーと操作ロックを解除する', async () => {
    const element = createComponent();
    await flush();
    await editClassify(element);
    let fail;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    saveClassifyData.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.querySelector('.c-save-progress')).not.toBeNull();
    fail({ body: { message: 'API応答を確認できませんでした' } });
    await flush();
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(false);
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.textContent).toContain('処理を中断しました');
});

it('1001行のCSVを10項目ずつ順に保存し、部分失敗だけを再保存対象に残す', async () => {
    const fields = Array.from({ length: 1001 }, (_, index) => ({ apiName: `Field${index}__c`, label: `項目${index}`, type: 'STRING', custom: true }));
    const rows = Object.fromEntries(fields.map((field) => [field.apiName, { ...classify.rows.Name }]));
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields });
    getClassifyData.mockResolvedValue({ ...classify, rows });
    const originalReader = global.FileReader;
    global.FileReader = class {
        readAsText() {
            this.result = 'ObjectApiName,FieldApiName,ComplianceGroup,SecurityClassification,BusinessStatus,BusinessOwnerId\n' + fields.map((field) => `Account,${field.apiName},,,Active,`).join('\n');
            this.onload();
        }
    };
    try {
        const element = createComponent();
        await flush();
        element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
        await flush();
        await pickAccount(element);
        const input = element.shadowRoot.querySelector('.c-csv-import lightning-input');
        Object.defineProperty(input, 'files', { value: [{ name: 'classify.csv', size: 100000 }], configurable: true });
        input.dispatchEvent(new CustomEvent('change'));
        await flush();
        let finishFirst;
        const resultsFor = (request) => JSON.parse(request.changesJson).map((change) => (change.apiName === 'Field1000__c'
            ? { apiName: change.apiName, success: false, message: '更新拒否' }
            : { apiName: change.apiName, success: true, latest: change.draft, owner: { value: '', label: '未設定' } }));
        saveClassifyData.mockImplementation((request) => Promise.resolve(resultsFor(request)));
        saveClassifyData.mockImplementationOnce((request) => new Promise((resolve) => { finishFirst = () => resolve(resultsFor(request)); }));
        const initialChecks = getApiAuthentication.mock.calls.length;
        element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
        await flush();
        expect(getApiAuthentication).toHaveBeenCalledTimes(initialChecks + 1);
        expect(saveClassifyData).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.querySelector('.c-save-progress')).not.toBeNull();
        finishFirst();
        // 保存のPromise連鎖と描画が完了するまでイベントループを一巡させる
        await new Promise(setImmediate);
        expect(saveClassifyData).toHaveBeenCalledTimes(101);
        expect(getApiAuthentication).toHaveBeenCalledTimes(initialChecks + 1);
        const sent = saveClassifyData.mock.calls.flatMap(([request]) => JSON.parse(request.changesJson));
        expect(sent.map((change) => change.apiName)).toEqual(fields.map((field) => field.apiName));
        expect(saveClassifyData.mock.calls.every(([request]) => JSON.parse(request.changesJson).length <= 10)).toBe(true);
        expect(element.shadowRoot.textContent).toContain('保存結果：成功1000件・失敗1件');
        expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
        saveClassifyData.mockClear();
        element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
        await flush();
        expect(getApiAuthentication).toHaveBeenCalledTimes(initialChecks + 2);
        expect(JSON.parse(saveClassifyData.mock.calls[0][0].changesJson).map((change) => change.apiName)).toEqual(['Field1000__c']);
    } finally {
        global.FileReader = originalReader;
    }
});

it('保存開始時の接続確認に失敗したら更新を送信しない', async () => {
    const element = createComponent();
    await editClassify(element);
    getApiAuthentication.mockRejectedValueOnce(new Error('PRIVATE_VALUE'));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.textContent).not.toContain('PRIVATE_VALUE');
    expect(element.shadowRoot.querySelector('.c-save-progress')).toBeNull();
});


it('確認不能でも認証リンクを表示し探索と保存は許可しない', async () => {
    getApiAuthentication.mockResolvedValueOnce({ status: 'UNAVAILABLE', message: '接続を確認できません。' });
    const element = createComponent();
    await flush();
    expect(element.shadowRoot.querySelector('.c-authentication a')).not.toBeNull();
    expect(element.shadowRoot.querySelector('.c-mode')).toBeNull();
    expect(element.shadowRoot.querySelector('[data-authentication-revoke]')).toBeNull();
    expect(element.shadowRoot.querySelector('c-object-explorer-lookup')).toBeNull();
});
it('認証URL取得失敗でもボタンを隠さず無効化して理由を表示する', async () => {
    getApiAuthentication.mockResolvedValueOnce({ status: 'UNAVAILABLE', message: '確認不能' });
    getApiAuthenticationUrl.mockRejectedValueOnce(new Error('PRIVATE'));
    const element = createComponent();
    await flush();
    expect(element.shadowRoot.querySelector('.c-authentication a')).toBeNull();
    expect(element.shadowRoot.querySelector('.c-authentication lightning-button').disabled).toBe(true);
    expect(element.shadowRoot.textContent).toContain('API認証を開始できません');
    expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
    expect(element.shadowRoot.querySelector('.c-mode')).toBeNull();
});

it.each([[false, false], [true, false], [true, true]])('分類保存中の離脱=%s・応答失敗=%sで古い処理を継続しない', async (detach, rejectFirst) => {
    const names = ['Name', 'Phone', 'Fax', 'Website', 'Industry', 'Type', 'Rating', 'Description', 'AccountNumber', 'AnnualRevenue', 'NumberOfEmployees'];
    getObjectInfo.mockResolvedValueOnce({ ...objectInfo, fields: names.map(apiName => ({ apiName, label: apiName, type: 'STRING', custom: false })) });
    getClassifyData.mockResolvedValueOnce({ ...classify, rows: Object.fromEntries(names.map(name => [name, { ...classify.rows.Name }])) });
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    for (const input of element.shadowRoot.querySelectorAll('[data-property="businessStatus"]')) {
        input.dispatchEvent(new CustomEvent('change', { detail: { value: 'Active' } }));
    }
    await flush();
    let finishFirst;
    const resultsFor = request => JSON.parse(request.changesJson).map(change => ({ apiName: change.apiName, success: true, latest: { ...change.draft }, owner: { value: '', label: '未設定' }, message: '' }));
    saveClassifyData.mockImplementationOnce(request => new Promise((resolve, reject) => {
        finishFirst = () => { if (rejectFirst) reject(new Error('Old save')); else resolve(resultsFor(request)); };
    }));
    saveClassifyData.mockImplementation(request => Promise.resolve(resultsFor(request)));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    expect(saveClassifyData).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saveClassifyData.mock.calls[0][0].changesJson)).toHaveLength(10);
    if (detach) { element.remove(); document.body.appendChild(element); await flush(); }
    finishFirst();
    await flush();
    expect(saveClassifyData).toHaveBeenCalledTimes(detach ? 1 : 2);
    expect(element.shadowRoot.textContent.includes('後続の保存を中断しました')).toBe(detach);
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(true);
    expect(element.shadowRoot.querySelector('[data-client-error]')).toBeNull();
});


it.each(['resolve', 'reject'])('再接続前の保存確認の%sで新しい確認のロックを解除しない', async (settlement) => {
    const element = createComponent();
    await editClassify(element);
    let finishOld;
    let confirmNew;
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve, reject) => {
        finishOld = () => { if (settlement === 'resolve') resolve(true); else reject(new Error('Old confirmation')); };
    }));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    element.remove();
    document.body.appendChild(element);
    await flush();
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve) => { confirmNew = resolve; }));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    finishOld();
    await flush();
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.c-save-bar lightning-button').disabled).toBe(true);
    expect(element.shadowRoot.querySelector('[data-client-error]')).toBeNull();
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: true, latest: { businessStatus: 'Active' }, owner: { value: '', label: '未設定' }, message: '' }]);
    confirmNew(true);
    await flush();
    expect(saveClassifyData).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.textContent).toContain('1項目のデータ分類を保存しました');
});

it('保存前の認証確認中に離脱・再接続した場合は保存を送信しない', async () => {
    const element = createComponent();
    await editClassify(element);
    let finishAuthentication;
    getApiAuthentication.mockImplementationOnce(() => new Promise((resolve) => { finishAuthentication = resolve; }));
    element.shadowRoot.querySelector('.c-save-bar lightning-button').click();
    await flush();
    element.remove();
    document.body.appendChild(element);
    await flush();
    finishAuthentication({ status: 'AUTHENTICATED' });
    await flush();
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('[data-client-error]')).toBeNull();
    expect(element.shadowRoot.textContent).toContain('後続の保存を中断しました');
});

it('キー移動後の端数を含むスクロール通知で候補を解除せずEnterで確定する', async () => {
    searchObjects.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({ apiName: index === 6 ? 'Account' : `Object${index}`, label: `対象${index}` })));
    const element = createComponent();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    lookup.dispatchEvent(new CustomEvent('candidatescroll', { detail: { top: 0, height: 210, rowHeight: 41.996 } }));
    await flush();
    await Array.from({ length: 7 }).reduce(async (previous) => {
        await previous;
        lookup.dispatchEvent(new CustomEvent('searchkey', { detail: { key: 'ArrowDown', height: 210, scrollTop: lookup.candidateScrollTop } }));
        await flush();
    }, Promise.resolve());
    expect(lookup.candidateScrollTop).toBeCloseTo(83.972);
    lookup.dispatchEvent(new CustomEvent('candidatescroll', { detail: { top: 83.75, height: 210 } }));
    await flush();
    expect(lookup.candidateView.items.find((item) => item.selected)?.value).toBe('Account');
    lookup.dispatchEvent(new CustomEvent('searchkey', { detail: { key: 'Enter' } }));
    await flush();
    expect(getObjectInfo).toHaveBeenCalledWith({ objectName: 'Account', mode: 'reference' });
});

it('手動スクロールで表示枠から離れた候補はEnterで確定しない', async () => {
    searchObjects.mockResolvedValue([{ apiName: 'Account', label: '取引先' }, { apiName: 'Contact', label: '取引先責任者' }]);
    const element = createComponent();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    lookup.dispatchEvent(new CustomEvent('candidatescroll', { detail: { top: 0, height: 42, rowHeight: 42 } }));
    lookup.dispatchEvent(new CustomEvent('searchkey', { detail: { key: 'ArrowDown', height: 42, scrollTop: 0 } }));
    await flush();
    lookup.dispatchEvent(new CustomEvent('candidatescroll', { detail: { top: 42, height: 42 } }));
    await flush();
    expect(lookup.candidateView.items.some((item) => item.selected)).toBe(false);
    lookup.dispatchEvent(new CustomEvent('searchkey', { detail: { key: 'Enter' } }));
    await flush();
    expect(getObjectInfo).not.toHaveBeenCalled();
});


it('所有者検索中と結果なしを分け、古い応答で検索中表示を解除しない', async () => {
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    let resolveFirst;
    let resolveSecond;
    searchClassifyOwners.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
    const input = element.shadowRoot.querySelector('input[data-field="Name"]');
    input.value = '検索';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect(element.shadowRoot.querySelector('.c-owner-options').textContent).toContain('候補を検索中');
    expect(element.shadowRoot.querySelector('.c-owner-options').textContent).not.toContain('候補がありません');
    input.value = '検索語';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    resolveFirst([]);
    await flush();
    expect(element.shadowRoot.querySelector('.c-owner-options').textContent).toContain('候補を検索中');
    resolveSecond([]);
    await flush();
    expect(element.shadowRoot.querySelector('.c-owner-options').textContent).toContain('候補がありません');
    expect(element.shadowRoot.querySelector('.c-owner-options').textContent).not.toContain('候補を検索中');
    await expect(element).toBeAccessible();
});

it.each([['005000000000001', 'standard:user'], ['00G000000000001', 'standard:groups']])('所有者候補の種別を保ち、選択済み値をDeleteで解除できる: %s', async (value, icon) => {
    searchClassifyOwners.mockResolvedValue([{ value, label: '所有者候補', description: '種別' }]);
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    const search = element.shadowRoot.querySelector('input[data-field="Name"]');
    search.value = '所有者';
    search.dispatchEvent(new CustomEvent('input'));
    await flush();
    element.shadowRoot.querySelector('.c-owner-options [role="option"]').click();
    await flush();
    const selected = element.shadowRoot.querySelector('input[data-field="Name"][readonly]');
    expect(selected.value).toBe('所有者候補');
    expect(selected.parentElement.querySelector('lightning-icon').iconName).toBe(icon);
    selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', isComposing: true }));
    await flush();
    expect(element.shadowRoot.querySelector('input[data-field="Name"][readonly]')).not.toBeNull();
    selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
    await flush();
    expect(element.shadowRoot.querySelector('input[data-field="Name"]').value).toBe('');
    expect(element.shadowRoot.querySelector('input[data-field="Name"]').readOnly).toBe(false);
    expect(saveClassifyData).not.toHaveBeenCalled();
});

it.each(['Delete', '解除ボタン'])('%sで所有者を解除すると同じ行の検索欄にフォーカスが戻る', async operation => {
    const secondField = { ...objectInfo.fields[0], apiName: 'Phone', label: 'B' };
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields: [{ ...objectInfo.fields[0], label: 'A' }, secondField] });
    getClassifyData.mockResolvedValue({ ...classify, rows: {
        ...classify.rows,
        Phone: { ...classify.rows.Name, ownerId: '005000000000001', ownerLabel: '所有者' }
    } });
    const element = createComponent();
    await flush();
    element.shadowRoot.querySelector('.c-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    const lookups = element.shadowRoot.querySelectorAll('.c-owner-lookup');
    expect(lookups).toHaveLength(2);
    const row = lookups[1];
    expect(row.dataset.field).toBe('Phone');
    const selected = row.querySelector('input[readonly]');
    if (operation === 'Delete') {
        selected.focus();
        selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
    } else {
        row.querySelector('lightning-button-icon').click();
    }
    await flush();
    const input = row.querySelector('input:not([readonly])');
    expect(input).not.toBeNull();
    expect(element.shadowRoot.activeElement).toBe(input);
    expect(input.value).toBe('');
    expect(searchClassifyOwners).not.toHaveBeenCalled();
});

it('複数選択ダイアログは選択値を維持してEscapeで閉じ、再度開ける', async () => {
    getClassifyData.mockResolvedValue({ ...classify, options: { ...classify.options, ComplianceGroup: ['GDPR', 'PII'].map((value) => ({ value, label: value })) } });
    const element = createComponent();
    await editClassify(element);
    const toggle = element.shadowRoot.querySelector('button[aria-label="コンプライアンス分類"]');
    toggle.click();
    await flush();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const group = element.shadowRoot.querySelector('lightning-checkbox-group');
    group.dispatchEvent(new CustomEvent('change', { detail: { value: ['GDPR', 'PII'] } }));
    await flush();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(element.shadowRoot.querySelector('[role="dialog"]')).toBeNull();
    toggle.click();
    await flush();
    expect(element.shadowRoot.querySelector('lightning-checkbox-group').value).toEqual(['GDPR', 'PII']);
    await expect(element).toBeAccessible();
});

it('候補の取得失敗と0件を区別し、再試行後は案内を解除する', async () => {
    const element = createComponent();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    searchObjects.mockRejectedValueOnce(new Error('failed'));
    lookup.dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    expect(element.shadowRoot.textContent).toContain('オブジェクト候補を取得できませんでした。');
    expect(lookup.shadowRoot.textContent).not.toContain('候補がありません。');
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: 'Account' } }));
    await flush();
    expect(lookup.candidateView.items.length).toBe(1);
    expect(element.shadowRoot.textContent).not.toContain('オブジェクト候補を取得できませんでした。');
});
