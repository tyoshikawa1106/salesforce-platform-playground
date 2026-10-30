import { createElement } from 'lwc';
import ObjectExplorer from 'c/objectExplorer';
import getObjectInfo from '@salesforce/apex/ObjectExplorerController.getObjectInfo';
import searchObjects from '@salesforce/apex/ObjectExplorerController.searchObjects';
import getFieldAudit from '@salesforce/apex/ObjectExplorerController.getFieldAudit';
import getClassifyData from '@salesforce/apex/ObjectExplorerController.getClassifyData';
import saveClassifyData from '@salesforce/apex/ObjectExplorerController.saveClassifyData';
import LightningConfirm from 'lightning/confirm';
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
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

it('接続状態のDOMプロパティが未公開でも保存確認を表示する', async () => {
    class LegacyObjectExplorer extends ObjectExplorer {
        get isConnected() { return undefined; }
    }
    const element = createElement('c-object-explorer', { is: LegacyObjectExplorer });
    document.body.appendChild(element);
    await editClassify(element);
    LightningConfirm.open.mockResolvedValueOnce(false);
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    expect(LightningConfirm.open).toHaveBeenCalledWith(expect.objectContaining({ label: '保存の確認', message: '1項目のデータ分類を保存しますか？' }));
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.oe-save-bar lightning-button').disabled).toBe(false);
});
it('保存確認を待つ間に画面を閉じた場合は保存しない', async () => {
    const element = createComponent();
    await editClassify(element);
    let confirm;
    LightningConfirm.open.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    element.remove();
    confirm(true);
    await flush();
    expect(saveClassifyData).not.toHaveBeenCalled();
});

it('保存内容の準備でJS例外が起きても未実行を表示して再操作できる', async () => {
    const element = createComponent();
    await editClassify(element);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(objectExplorerLogic, 'classifyChanges').mockImplementationOnce(() => { throw new TypeError('sensitive input'); });
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('保存内容の準備に失敗しました（TypeError）。保存は実行していません。');
    expect(LightningConfirm.open).not.toHaveBeenCalled();
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.oe-save-bar lightning-button').disabled).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive input');
});
it('保存確認の表示失敗を保存APIの失敗と区別してロックを解除する', async () => {
    const element = createComponent();
    await editClassify(element);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    LightningConfirm.open.mockRejectedValueOnce(new TypeError('sensitive modal detail'));
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('保存確認画面の表示に失敗しました（TypeError）。保存は実行していません。');
    expect(saveClassifyData).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.oe-save-bar lightning-button').disabled).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive modal detail');
});

it('両モードで種別の絞り込みを表示せず標準とカスタムを同じ候補で検索する', async () => {
    searchObjects.mockResolvedValue([{ apiName: 'Account', label: '取引先' }, { apiName: 'ExplorerProbe__c', label: '検証対象' }]);
    const element = createComponent();
    await flush();
    const toolbar = element.shadowRoot.querySelector('.oe-toolbar');
    expect(toolbar.firstElementChild.className).toBe('oe-lookup');
    expect([...element.shadowRoot.querySelectorAll('lightning-radio-group')].map((control) => control.label)).not.toContain('種別');
    expect([...element.shadowRoot.querySelectorAll('lightning-radio-group')].map((control) => control.label)).toContain('参照元の種類');
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    expect(searchObjects).toHaveBeenLastCalledWith({ term: '' });
    expect(lookup.candidateView.items.map((item) => item.value)).toEqual(['Account', 'ExplorerProbe__c']);
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
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
    const alert = element.shadowRoot.querySelector('.oe-client-error');
    expect(alert.textContent).toContain('objectExplorer.js / handleSearch / ui-event');
    expect(alert.textContent).toContain('TypeError');
    expect(element.shadowRoot.querySelector('h1').textContent).toBe('オブジェクトエクスプローラー');
    expect(searchObjects).not.toHaveBeenCalled();
});
it('正常な検索・保存確認では診断ログも診断表示も出さない', async () => {
    const element = createComponent();
    await editClassify(element);
    LightningConfirm.open.mockResolvedValueOnce(false);
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    expect(console.error).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('.oe-client-error')).toBeNull();
    expect(element.shadowRoot.textContent).not.toContain('保存の確認画面を開いています');
});

it.each(['reference', 'classify'])('カスタム列は枠なしのチェックを表示する（%s）', async (mode) => {
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields: [...objectInfo.fields, { apiName: 'Flag__c', label: '独自項目', type: 'BOOLEAN', custom: true }] });
    getClassifyData.mockResolvedValue({ ...classify, rows: { ...classify.rows, Flag__c: { ...classify.rows.Name } } });
    const element = createComponent();
    if (mode === 'classify') {
        element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: mode } }));
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
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    const input = element.shadowRoot.querySelector('input[data-field="Name"]');
    expect(input.placeholder).toBe('検索');
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
    expect(element.shadowRoot.querySelector('.oe-owner-options')).toBeNull();
});

it('分類は編集不可・未取得を一覧から除外し、件数を揃える', async () => {
    getObjectInfo.mockResolvedValue({ ...objectInfo, fields: [...objectInfo.fields,
        { apiName: 'ReadOnly__c', label: '編集不可', type: 'BOOLEAN' },
        { apiName: 'Unavailable__c', label: '未取得', type: 'BOOLEAN' }] });
    getClassifyData.mockResolvedValue({ ...classify, rows: { ...classify.rows, ReadOnly__c: { editable: false } } });
    const element = createComponent();
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('tbody').textContent).toContain('Name');
    expect(element.shadowRoot.querySelector('tbody').textContent).not.toContain('ReadOnly__c');
    expect(element.shadowRoot.querySelector('tbody').textContent).not.toContain('Unavailable__c');
    expect(element.shadowRoot.textContent).toContain('1項目');
});

it('構造CSVは分類取得失敗時にダウンロードせず処理場所を表示する', async () => {
    const element = createComponent();
    await pickAccount(element);
    getClassifyData.mockRejectedValueOnce({ body: { message: '分類取得失敗' } });
    const exportButton = [...element.shadowRoot.querySelectorAll('lightning-button')].find((button) => button.label === 'CSVダウンロード');
    exportButton.click();
    await flush();
    expect(getClassifyData).toHaveBeenCalledWith({ objectName: 'Account' });
    expect(element.shadowRoot.querySelector('.oe-client-error').textContent).toContain('handleExportCsv');
    expect(exportButton.disabled).toBe(false);
});

it('構造CSVの確認後に保存済み分類を取得して出力する', async () => {
    const createUrl = URL.createObjectURL;
    const revokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:test');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
        const element = createComponent();
        await pickAccount(element);
        expect(getClassifyData).not.toHaveBeenCalled();
        const button = [...element.shadowRoot.querySelectorAll('lightning-button')].find((item) => item.label === 'CSVダウンロード');
        LightningConfirm.open.mockResolvedValueOnce(false);
        button.click();
        await flush();
        expect(getClassifyData).not.toHaveBeenCalled();
        button.click();
        await flush();
        expect(getClassifyData).toHaveBeenCalledWith({ objectName: 'Account' });
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        const text = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(URL.createObjectURL.mock.calls[0][0]);
        });
        expect(text).toContain('データ所有者ID');
        expect(text).toContain('名前');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    } finally {
        URL.createObjectURL = createUrl;
        URL.revokeObjectURL = revokeUrl;
    }
});


it.each(['reference', 'classify'])('0件時の案内は一覧の全列に広がる（%s）', async (mode) => {
    const element = createComponent();
    if (mode === 'classify') {
        element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: mode } }));
        await flush();
    }
    await pickAccount(element);
    const search = element.shadowRoot.querySelector('.oe-field-search');
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
    await pickAccount(element);
    const alert = element.shadowRoot.querySelector('.oe-client-error');
    expect(alert.textContent).toContain('readObjectInfo / field-audit');
    expect(alert.textContent).toContain('理由：API接続・接続先組織の確認：HTTP 401');
    expect(element.shadowRoot.querySelector('.oe-detail-title')).not.toBeNull();
    await expect(element).toBeAccessible();
});

it('保存失敗の詳細は項目一覧の検索で行が非表示になっても残す', async () => {
    const element = createComponent();
    await editClassify(element);
    saveClassifyData.mockResolvedValueOnce([{ apiName: 'Name', success: false, message: 'API接続・接続先組織の確認：HTTP 403' }]);
    element.shadowRoot.querySelector('.oe-save-bar lightning-button').click();
    await flush();
    const search = element.shadowRoot.querySelector('.oe-field-search');
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
    await pickAccount(element);
    const alert = element.shadowRoot.querySelector('.oe-client-error');
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
    await pickAccount(element);
    expect(element.shadowRoot.querySelector('.oe-client-error').textContent).toContain('エラーコード：OE-AUTH-401');
    expect(JSON.stringify(console.error.mock.calls)).toContain('OE-AUTH-401');
    expect(JSON.stringify(console.error.mock.calls)).not.toContain(message);
});
