import { getSourceRows } from '../userCreateAssistantLogic';

const record = { id: 'one', fields: { Name: { value: '利用者' }, Email: { value: null } } };

it('選択中のユーザーについて、参照可能な項目だけを順序どおりに返す', () => {
    expect(getSourceRows('one', record)).toEqual([
        { name: 'Name', label: '氏名', value: '利用者' },
        { name: 'Email', label: 'メール', value: '—' }
    ]);
    expect(getSourceRows('two', record)).toEqual([]);
    expect(getSourceRows(undefined, undefined)).toEqual([]);
});
