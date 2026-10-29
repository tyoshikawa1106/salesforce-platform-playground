import { createElement } from 'lwc';
import ObjectExplorer from 'c/objectExplorer';
import getObjectInfo from '@salesforce/apex/ObjectExplorerController.getObjectInfo';
import searchObjects from '@salesforce/apex/ObjectExplorerController.searchObjects';
import getClassifyData from '@salesforce/apex/ObjectExplorerController.getClassifyData';
import saveClassifyData from '@salesforce/apex/ObjectExplorerController.saveClassifyData';

jest.mock('@salesforce/apex/ObjectExplorerController.getObjectInfo', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.searchObjects', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.getClassifyData', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ObjectExplorerController.saveClassifyData', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/userPermission/ModifyDataClassification', () => ({ default: undefined }), { virtual: true });
jest.mock('@salesforce/userPermission/CustomizeApplication', () => ({ default: undefined }), { virtual: true });

const flush = () => Array.from({ length: 30 }).reduce((p) => p.then(() => Promise.resolve()), Promise.resolve());
beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    searchObjects.mockResolvedValue([{ apiName: 'Account', label: '取引先' }]);
});
afterEach(() => {
    document.body.replaceChildren();
    jest.clearAllMocks();
    jest.restoreAllMocks();
});
it('編集権限がない利用者にも保存済み分類を表示し、編集と保存は許可しない', async () => {
    getClassifyData.mockResolvedValue({
        rows: { Name: { editable: true, complianceGroup: 'PII', securityClassification: 'Restricted', businessStatus: 'Active', ownerId: '005000000000001AAA', ownerLabel: '分類所有者' } },
        options: { ComplianceGroup: [{ label: '個人情報', value: 'PII' }], SecurityClassification: [{ label: '制限', value: 'Restricted' }], BusinessStatus: [{ label: '使用中', value: 'Active' }] }
    });
    getObjectInfo.mockResolvedValue({ apiName: 'Account', label: '取引先', fields: [{ apiName: 'Name', label: '名前', type: 'STRING', typeLabel: 'テキスト(255)', custom: false }], relations: [] });
    const element = createElement('c-object-explorer', { is: ObjectExplorer });
    document.body.appendChild(element);
    element.shadowRoot.querySelector('.oe-mode').dispatchEvent(new CustomEvent('change', { detail: { value: 'classify' } }));
    await flush();
    const lookup = element.shadowRoot.querySelector('c-object-explorer-lookup');
    lookup.dispatchEvent(new CustomEvent('lookupopen'));
    await flush();
    lookup.dispatchEvent(new CustomEvent('candidatepick', { detail: { apiName: 'Account' } }));
    await flush();
    const table = element.shadowRoot.querySelector('tbody');
    for (const label of ['個人情報', '制限', '使用中', '分類所有者']) { expect(table.textContent).toContain(label); }
    expect(table.textContent).not.toContain('設定不可');
    expect(table.querySelector('[data-property]')).toBeNull();
    expect(table.querySelector('input')).toBeNull();
    expect(element.shadowRoot.querySelector('.oe-save-bar')).toBeNull();
    expect(saveClassifyData).not.toHaveBeenCalled();
    await expect(element).toBeAccessible();
});
