import { buildConfirmationSections, buildFieldLines, buildPanel, getDraftValue, initialTargetValues } from '../userCreateAssistantLogic';

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
    const lines = buildFieldLines(fields);
    const left = buildPanel(lines, 'source', {});
    const right = buildPanel(lines, 'target', initialTargetValues(fields));
    expect(left.rows.map((r) => r.key)).toEqual(right.rows.map((r) => r.key));
    expect(left.rows.flatMap((line) => line.cells.map((r) => r.key)).slice(-3)).toEqual(['カスタム項目', 'A__c', 'B__c']);
    expect(right.rows.at(-1).cells.map((r) => r.key)).toEqual(['B__c']);
    expect(row(right, 'B__c').value).toEqual(['one','two']);
    expect(row(left, 'LastName')).toMatchObject({ display: '元の姓', readOnly: true });
    expect(row(right, 'LastName')).toMatchObject({ value: '元の姓', readOnly: false });
    expect(row(right, 'ProfileId')).toMatchObject({ display: 'プロファイル名', readOnly: true });
    expect(row(right, 'IsActive')).toMatchObject({ checked: true, required: false, checkbox: true });
});
it('無効化中は元側の編集可能項目だけを開き、編集中の多値選択を復元する', () => {
    const lines = buildFieldLines(fields);
    const left = buildPanel(lines, 'source', { A__c: null }, true);
    const right = buildPanel(lines, 'target', { B__c: 'two' });
    expect(row(left, 'A__c')).toMatchObject({ value: null, textarea: true, readOnly: false });
    expect(row(left, 'ProfileId').readOnly).toBe(true);
    expect(row(left, 'IsActive')).toMatchObject({ pendingDeactivation: true, checked: false, readOnlyCheckbox: true });
    expect(row(right, 'B__c').value).toEqual(['two']);
    expect(getDraftValue(['one','two'])).toBe('one;two');
    expect(getDraftValue(false)).toBe(false);
    expect(getDraftValue('')).toBeNull();
});

it.each([[true, false, true], [false, false, false], [true, true, false]])('元の有効状態 %s、無効化 %s で識別情報と保存後のチェック状態を返す', (initial, deactivateSource, expected) => {
    const source = {LastName:'旧姓', FirstName:'花子', Username:'old@example.invalid', Email:'oldmail@example.invalid', IsActive:String(initial)};
    const target = {LastName:'新姓', FirstName:'太郎', Username:'new@example.invalid', Email:'newmail@example.invalid'};
    const sections = buildConfirmationSections(Object.entries(source).map(([apiName,value]) => ({apiName,value})),
        {LastName:'変更姓'}, target, {deactivateSource, copyPermissionSets:false, copyPermissionSetGroups:true, sendResetEmail:false});
    expect(sections[0].rows.slice(0,3).map(entry => entry.value)).toEqual([deactivateSource ? '変更姓 花子' : '旧姓 花子', source.Email, source.Username]);
    expect(sections[1].rows.slice(0,3).map(entry => entry.value)).toEqual(['新姓 太郎', target.Email, target.Username]);
    expect(sections[0].rows[3]).toMatchObject({label:'有効', checkbox:true, checked:expected});
    expect(sections[1].rows[3]).toMatchObject({label:'有効', checkbox:true, checked:true});
    expect(sections[2].rows.map(entry => entry.value)).toEqual(['引き継がない', '引き継ぐ']);
});
