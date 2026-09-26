import { createElement } from 'lwc';
import AccountMassUpdate from 'c/accountMassUpdate';
import searchAccounts from '@salesforce/apex/AccountMassUpdateController.searchAccounts';
import saveAccounts from '@salesforce/apex/AccountMassUpdateController.saveAccounts';
import LightningConfirm from 'lightning/confirm';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';

jest.mock('@salesforce/apex/AccountMassUpdateController.searchAccounts', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/AccountMassUpdateController.saveAccounts', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('lightning/confirm', () => ({ open: jest.fn() }), { virtual: true });

const record = {
    Id: '001000000000001AAA',
    Name: 'テスト法人',
    OwnerId: '005000000000001AAA',
    Rating: 'Hot',
    RecordTypeId: '012000000000001AAA',
    CreatedDate: '2026-09-24T01:00:00.000Z',
    LastModifiedDate: '2026-09-24T01:00:00.000Z'
};
const response = {
    records: [record],
    hasNext: false,
    editableFields: ['OwnerId', 'Industry', 'Type', 'Rating'],
    errorMessage: ''
};
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};
const button = (element, label) =>
    [...element.shadowRoot.querySelectorAll('lightning-button')].find((item) => item.label === label);

async function createComponent() {
    const element = createElement('c-account-mass-update', { is: AccountMassUpdate });
    document.body.appendChild(element);
    getObjectInfo.emit({ defaultRecordTypeId: record.RecordTypeId });
    await flush();
    element.shadowRoot.querySelectorAll('lightning-input').forEach((input) => {
        input.reportValidity = jest.fn();
        input.checkValidity = jest.fn(() => true);
    });
    return element;
}

async function search(element) {
    button(element, '検索').click();
    await flush();
    getPicklistValuesByRecordType.emit({
        picklistFieldValues: {
            Industry: { values: [] },
            Type: { values: [] },
            Rating: {
                values: [
                    { label: '高', value: 'Hot' },
                    { label: '低', value: 'Cold' }
                ]
            }
        }
    });
    await flush();
    element.shadowRoot.querySelectorAll('[data-field]').forEach((input) => {
        input.reportValidity = jest.fn();
        input.checkValidity = jest.fn(() => true);
    });
}

function edit(element, value = 'Cold') {
    element.shadowRoot
        .querySelector('[data-field="Rating"]')
        .dispatchEvent(new CustomEvent('change', { detail: { value } }));
}

describe('取引先一括更新画面', () => {
    beforeEach(() => {
        searchAccounts.mockResolvedValue(response);
        LightningConfirm.open.mockResolvedValue(true);
        notifyRecordUpdateAvailable.mockResolvedValue();
    });
    afterEach(() => {
        document.body.replaceChildren();
        jest.resetAllMocks();
    });

    it('初期表示では検索せず、検索後に編集行をハイライトして取消できる', async () => {
        const element = await createComponent();
        expect(searchAccounts).not.toHaveBeenCalled();
        await search(element);
        edit(element);
        await flush();
        expect(element.shadowRoot.querySelector('tbody tr').className).toBe('changed-row');
        expect(element.shadowRoot.textContent).toContain('未保存の変更：1件');
        button(element, '変更を取り消す').click();
        await flush();
        expect(element.shadowRoot.querySelector('tbody tr').className).toBe('');
        expect(button(element, '変更を保存').disabled).toBe(true);
        await expect(element).toBeAccessible();
    });

    it('ページ移動の破棄確認を取り消したら変更と現在ページを維持する', async () => {
        searchAccounts.mockResolvedValue({ ...response, hasNext: true });
        const element = await createComponent();
        await search(element);
        edit(element);
        await flush();
        LightningConfirm.open.mockResolvedValue(false);
        button(element, '次へ').click();
        await flush();
        expect(searchAccounts).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.textContent).toContain('未保存の変更：1件');
        expect(button(element, '変更を保存').disabled).toBe(false);
    });

    it('ページ取得失敗でも変更を維持し、成功時だけ次ページへ移動する', async () => {
        searchAccounts.mockResolvedValueOnce({ ...response, hasNext: true });
        const element = await createComponent();
        await search(element);
        edit(element);
        await flush();
        searchAccounts.mockRejectedValueOnce(new Error('network'));
        button(element, '次へ').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('未保存の変更：1件');
        searchAccounts.mockResolvedValueOnce({ ...response, records: [{ ...record, Id: '001000000000002AAA' }] });
        button(element, '次へ').click();
        await flush();
        expect(searchAccounts).toHaveBeenLastCalledWith(
            expect.objectContaining({
                request: expect.objectContaining({ afterId: record.Id, afterCreated: record.CreatedDate })
            })
        );
        expect(element.shadowRoot.textContent).toContain('現在のページ：2');
        expect(element.shadowRoot.textContent).toContain('未保存の変更：0件');
    });

    it('保存成功後は新しい値を表示し未保存の変更を解除する', async () => {
        const element = await createComponent();
        await search(element);
        edit(element);
        await flush();
        saveAccounts.mockResolvedValue({ successIds: [record.Id], errors: {}, errorMessage: '' });
        searchAccounts.mockResolvedValue({ ...response, records: [{ ...record, Rating: 'Cold' }] });
        button(element, '変更を保存').click();
        await flush();
        expect(saveAccounts).toHaveBeenCalledWith({
            changes: [{ Id: record.Id, Rating: 'Cold' }],
            versions: { [record.Id]: record.LastModifiedDate }
        });
        expect(element.shadowRoot.textContent).toContain('1件を保存しました');
        expect(element.shadowRoot.querySelector('[data-field="Rating"]').value).toBe('Cold');
        expect(element.shadowRoot.textContent).toContain('未保存の変更：0件');
    });

    it('競合行の値と元バージョンを保持し、再保存で競合を迂回しない', async () => {
        const element = await createComponent();
        await search(element);
        edit(element);
        await flush();
        saveAccounts.mockResolvedValue({ successIds: [], errors: { [record.Id]: '検索後に変更されています' } });
        searchAccounts.mockResolvedValue({
            ...response,
            records: [{ ...record, Rating: 'Warm', LastModifiedDate: '2026-09-25T00:00:00.000Z' }]
        });
        button(element, '変更を保存').click();
        await flush();
        expect(element.shadowRoot.querySelector('[data-field="Rating"]').value).toBe('Cold');
        expect(element.shadowRoot.textContent).toContain('検索後に変更されています');
        button(element, '変更を保存').click();
        await flush();
        expect(saveAccounts).toHaveBeenLastCalledWith(
            expect.objectContaining({ versions: { [record.Id]: record.LastModifiedDate } })
        );
    });

    it('保存後の再取得失敗を保存失敗として表示せず成功行の再送を防ぐ', async () => {
        const element = await createComponent();
        await search(element);
        edit(element);
        await flush();
        saveAccounts.mockResolvedValue({ successIds: [record.Id], errors: {} });
        searchAccounts.mockRejectedValueOnce(new Error('refresh failed'));
        button(element, '変更を保存').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('1件を保存しました');
        expect(element.shadowRoot.textContent).toContain('再取得に失敗');
        expect(button(element, '変更を保存').disabled).toBe(true);
    });

    it('検索の権限拒否とゼロ件を区別して表示する', async () => {
        const element = await createComponent();
        searchAccounts.mockResolvedValueOnce({ errorMessage: '参照権限がありません。' });
        button(element, '検索').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('参照権限がありません');
        expect(element.shadowRoot.textContent).not.toContain('条件に一致する法人取引先はありません');
        searchAccounts.mockResolvedValueOnce({ ...response, records: [] });
        button(element, '検索').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('条件に一致する法人取引先はありません');
        await expect(element).toBeAccessible();
    });
    it('保存で末尾行が見えなくなっても元の境界から次ページへ移動できる', async () => {
        const last = { ...record, Id: '001000000000002AAA' };
        const following = { ...record, Id: '001000000000003AAA' };
        searchAccounts.mockResolvedValueOnce({ ...response, records: [record, last], hasNext: true });
        const element = await createComponent();
        await search(element);
        element.shadowRoot.querySelector(`[data-id="${last.Id}"][data-field="OwnerId"]`)
            .dispatchEvent(new CustomEvent('change', { detail: { recordId: '005000000000002AAA' } }));
        await flush();
        saveAccounts.mockResolvedValue({ successIds: [last.Id], errors: {} });
        // 所有者移転で末尾行の参照権限がなくなり、再検索では次ページの行が繰り上がる
        searchAccounts.mockResolvedValueOnce({ ...response, records: [record, following], hasNext: false });
        button(element, '変更を保存').click();
        await flush();
        expect(element.shadowRoot.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(button(element, '次へ').disabled).toBe(false);
        searchAccounts.mockResolvedValueOnce({ ...response, records: [following] });
        button(element, '次へ').click();
        await flush();
        expect(searchAccounts).toHaveBeenLastCalledWith({ request: expect.objectContaining({ afterId: last.Id }) });
        expect(element.shadowRoot.querySelector('tbody a').href).toContain(following.Id);
    });

    it('レコードタイプごとの選択肢が揃うまでページ移動を待ち、別の型の選択肢を混ぜない', async () => {
        const another = { ...record, Id: '001000000000002AAA', RecordTypeId: '012000000000002AAA' };
        searchAccounts.mockResolvedValueOnce({ ...response, records: [record, another], hasNext: true });
        const element = await createComponent();
        button(element, '検索').click();
        await flush();
        expect(button(element, '次へ').disabled).toBe(true);
        expect(getPicklistValuesByRecordType.getLastConfig().recordTypeId).toBe(record.RecordTypeId);
        getPicklistValuesByRecordType.emit({ picklistFieldValues: { Rating: { values: [{ label: '一つ目', value: 'Hot' }] } } });
        await flush();
        expect(button(element, '次へ').disabled).toBe(true);
        expect(getPicklistValuesByRecordType.getLastConfig().recordTypeId).toBe(another.RecordTypeId);
        getPicklistValuesByRecordType.emit({ picklistFieldValues: { Rating: { values: [{ label: '二つ目', value: 'Hot' }] } } });
        await flush();
        const ratings = element.shadowRoot.querySelectorAll('[data-field="Rating"]');
        expect(ratings[0].options).toContainEqual({ label: '一つ目', value: 'Hot' });
        expect(ratings[1].options).toContainEqual({ label: '二つ目', value: 'Hot' });
        expect(button(element, '次へ').disabled).toBe(false);
    });

});
