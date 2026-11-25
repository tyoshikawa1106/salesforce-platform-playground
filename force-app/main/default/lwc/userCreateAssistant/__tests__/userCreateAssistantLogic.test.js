import { buildPanels, getDraftValue, initialTargetValues } from '../userCreateAssistantLogic';

const field = (apiName, label, type, extra = {}) => ({ apiName, label, type, canCreate: true, canUpdate: true, ...extra });
const fields = [
    field('LastName', '姓', 'text', { value: '元の姓', groupLabel: 'ユーザー情報' }),
    field('ProfileId', 'プロファイル', 'readonly', { displayValue: 'プロファイル名' }),
    field('B__c', 'けいかく', 'multipicklist', { custom: true, value: 'one;two' }),
    field('A__c', 'あいさつ', 'textarea', { custom: true, value: 'こんにちは' }),
    field('IsActive', '有効', 'checkbox', { value: 'true', required: true })
];
const row = (panel, name) => panel.rows.flatMap((line) => line.cells).find((r) => r.name === name);
it('カスタム項目は日本語順で両側に揃え、編集項目は元の値、固定値は元側と同じ表示にする', () => {
    const [left, right] = buildPanels(fields, false, {}, initialTargetValues(fields));
    expect(left.rows.map((r) => r.key)).toEqual(right.rows.map((r) => r.key));
    expect(left.rows.flatMap((line) => line.cells.map((r) => r.key)).slice(-3)).toEqual(['カスタム項目', 'A__c', 'B__c']);
    expect(right.rows.at(-1).cells.map((r) => r.key)).toEqual(['A__c', 'B__c']);
    expect(row(right, 'B__c').value).toEqual(['one','two']);
    expect(row(left, 'LastName')).toMatchObject({ display: '元の姓', readOnly: true });
    expect(row(right, 'LastName')).toMatchObject({ value: '元の姓', readOnly: false });
    expect(row(right, 'ProfileId')).toMatchObject({ display: 'プロファイル名', readOnly: true });
    expect(row(right, 'IsActive')).toMatchObject({ checked: true, required: false, checkbox: true });
});
it('無効化中は元側の編集可能項目だけを開き、編集中の多値選択を復元する', () => {
    const [left, right] = buildPanels(fields, true, { A__c: null }, { B__c: 'two' });
    expect(row(left, 'A__c')).toMatchObject({ value: null, textarea: true, readOnly: false });
    expect(row(left, 'ProfileId').readOnly).toBe(true);
    expect(row(left, 'IsActive')).toMatchObject({ pendingDeactivation: true, checked: false, readOnlyCheckbox: true });
    expect(row(right, 'B__c').value).toEqual(['two']);
    expect(getDraftValue(['one','two'])).toBe('one;two');
    expect(getDraftValue(false)).toBe(false);
    expect(getDraftValue('')).toBeNull();
});
