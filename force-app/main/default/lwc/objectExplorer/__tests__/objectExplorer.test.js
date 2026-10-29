import { createElement } from 'lwc';
import ObjectExplorer from 'c/objectExplorer';
import getObjectInfo from '@salesforce/apex/ObjectExplorerController.getObjectInfo';
import searchObjects from '@salesforce/apex/ObjectExplorerController.searchObjects';
import getFieldAudit from '@salesforce/apex/ObjectExplorerController.getFieldAudit';
import getClassifyData from '@salesforce/apex/ObjectExplorerController.getClassifyData';
import saveClassifyData from '@salesforce/apex/ObjectExplorerController.saveClassifyData';
import LightningConfirm from 'lightning/confirm';

jest.mock('@salesforce/apex/ObjectExplorerController.getObjectInfo', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.searchObjects', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.getFieldAudit', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.getClassifyData', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.searchClassifyOwners', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.resolveClassifyOwners', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.saveClassifyData', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/userPermission/ModifyDataClassification', () => ({ __esModule: true, default: false }), { virtual: true });
jest.mock('@salesforce/userPermission/CustomizeApplication', () => ({ __esModule: true, default: true }), { virtual: true });
jest.mock('lightning/confirm', () => ({ __esModule: true, default: { open: jest.fn() } }), { virtual: true });

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
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    element.shadowRoot.querySelector('[data-property="businessStatus"]').dispatchEvent(new CustomEvent('change', { detail: { value: 'Active' } }));
    await flush();
}
beforeEach(() => {
    require('@salesforce/userPermission/ModifyDataClassification').default = false;
    require('@salesforce/userPermission/CustomizeApplication').default = true;
    global.ResizeObserver = class { observe() {} disconnect() {} };
    searchObjects.mockResolvedValue([{ apiName: 'Account', label: '取引先' }]);
    getObjectInfo.mockResolvedValue(objectInfo);
    getClassifyData.mockResolvedValue(classify);
    LightningConfirm.open.mockResolvedValue(true);
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
    expect(element.shadowRoot.querySelector('.oe-detail-title').textContent).toContain('取引先');
    await expect(element).toBeAccessible();
});
it('古い検索応答で最新の候補を上書きしない', async () => {
    const element = createComponent();
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
    getObjectInfo.mockRejectedValueOnce({ body: { message: '参照できません' } });
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('参照できません');
    expect(element.shadowRoot.querySelector('.oe-detail-title')).toBeNull();
    await expect(element).toBeAccessible();
});
it('分類保存の確認中から操作を止め、確定した変更だけを送信する', async () => {
    const element = createComponent();
    await editClassify(element);
    let confirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: true, latest: { businessStatus: 'Active' }, owner: { value: '', label: '未設定' }, message: '' }]);
    const save = element.shadowRoot.querySelector('.oe-save-bar lightning-button');
    save.click();
    await flush();
    expect(save.disabled).toBe(true);
    expect(saveClassifyData).not.toHaveBeenCalled();
    confirm(true);
    await flush();
    const request = saveClassifyData.mock.calls[0][0];
    expect(request.objectName).toBe('Account');
    expect(JSON.parse(request.changesJson)).toEqual([{ apiName: 'Name', original: { complianceGroup: '', securityClassification: '', businessStatus: '', ownerId: '' }, draft: { complianceGroup: '', securityClassification: '', businessStatus: 'Active', ownerId: '' } }]);
    expect(element.shadowRoot.textContent).toContain('1項目のデータ分類を保存しました');
    expect(save.disabled).toBe(true);
});
it('保存失敗では変更を保持して再操作できる', async () => {
    const element = createComponent();
    await editClassify(element);
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: false, message: '編集中に変更されました' }]);
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('編集中に変更されました');
    expect(element.shadowRoot.querySelector('[data-property="businessStatus"]').value).toBe('Active');
    expect(element.shadowRoot.querySelector('.oe-save-bar lightning-button').disabled).toBe(false);
});
it('破棄確認のキャンセルでは対象と分類の入力を維持する', async () => {
    const element = createComponent();
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
        element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
        await flush();
        await pickAccount(element);
        expect(Boolean(element.shadowRoot.querySelector('[data-property="businessStatus"]'))).toBe(editable);
        await expect(element).toBeAccessible();
    }
);

it.each([undefined, {}, () => {}])('サイズ監視APIが使えなくても表示・幅変更・監視解除ができる (%p)', async (observer) => {
    global.ResizeObserver = observer;
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const element = createComponent();
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('.oe-detail-title').textContent).toContain('取引先');
    const registrationsBeforeResize = add.mock.calls.filter(([type]) => type === 'resize');
    const viewport = element.shadowRoot.querySelector('.oe-viewport');
    let width = 900;
    Object.defineProperty(viewport, 'clientWidth', { get: () => width, configurable: true });
    window.dispatchEvent(new CustomEvent('resize'));
    await flush();
    expect(element.shadowRoot.querySelector('.oe-card-grid_narrow')).not.toBeNull();
    width = 1400;
    window.dispatchEvent(new CustomEvent('resize'));
    await flush();
    expect(element.shadowRoot.querySelector('.oe-card-grid_narrow')).toBeNull();
    const listeners = add.mock.calls.filter(([type]) => type === 'resize');
    expect(listeners).toHaveLength(registrationsBeforeResize.length);
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    expect(remove).toHaveBeenCalledWith('resize', listeners[listeners.length - 1][1]);
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'reference' } }));
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
    await pickAccount(element);
    expect(observe).toHaveBeenCalledWith(element.shadowRoot.querySelector('.oe-viewport'));
    notify([{ contentRect: { width: 900 } }]);
    await flush();
    expect(element.shadowRoot.querySelector('.oe-card-grid_narrow')).not.toBeNull();
    notify([{ contentRect: { width: 1400 } }]);
    await flush();
    expect(element.shadowRoot.querySelector('.oe-card-grid_narrow')).toBeNull();
    expect(add.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(0);
    element.remove();
    expect(disconnect).toHaveBeenCalled();
});
