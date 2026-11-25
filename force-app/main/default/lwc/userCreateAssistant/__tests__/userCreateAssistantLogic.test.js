import { buildPanels, getDraftValue } from '../userCreateAssistantLogic';

const field = (apiName, label, type, extra = {}) => ({ apiName, label, type, canCreate: true, canUpdate: true, ...extra });
const fields = [
    field('LastName', '姓', 'text', { value: '元の姓', groupLabel: 'ユーザー情報' }),
    field('ProfileId', 'プロファイル', 'readonly', { displayValue: 'プロファイル名' }),
    field('B__c', 'けいかく', 'multipicklist', { custom: true, value: 'one;two' }),
    field('A__c', 'あいさつ', 'textarea', { custom: true, value: 'こんにちは' }),
    field('IsActive', '有効', 'checkbox', { value: 'true', required: true })
];
const row = (panel, name) => panel.rows.find((r) => r.name === name);
it('カスタム項目は日本語順で両側に揃え、編集項目は空欄、固定値は元側と同じ表示にする', () => {
    const [left, right] = buildPanels(fields, false, {}, {});
    expect(left.rows.map((r) => r.key)).toEqual(right.rows.map((r) => r.key));
    expect(left.rows.map((r) => r.key).slice(-3)).toEqual(['カスタム項目', 'A__c', 'B__c']);
    expect(row(left, 'LastName')).toMatchObject({ display: '元の姓', readOnly: true });
    expect(row(right, 'LastName')).toMatchObject({ value: null, readOnly: false });
    expect(row(right, 'ProfileId')).toMatchObject({ display: 'プロファイル名', readOnly: true });
    expect(row(right, 'IsActive')).toMatchObject({ value: null, required: true, picklist: true });
});
it('無効化中は元側の編集可能項目だけを開き、編集中の多値選択を復元する', () => {
    const [left, right] = buildPanels(fields, true, { A__c: null }, { B__c: 'two' });
    expect(row(left, 'A__c')).toMatchObject({ value: null, textarea: true, readOnly: false });
    expect(row(left, 'ProfileId').readOnly).toBe(true);
    expect(row(left, 'IsActive')).toMatchObject({ display: '無効（保存時）', readOnly: true });
    expect(row(right, 'B__c').value).toEqual(['two']);
    expect(getDraftValue('B__c', ['one','two'])).toBe('one;two');
    expect(getDraftValue('IsActive', 'false')).toBe(false);
    expect(getDraftValue('LastName', '')).toBeNull();
});
