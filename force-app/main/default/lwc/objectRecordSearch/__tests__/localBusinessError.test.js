import { reduceErrors, createToastMessage } from '../objectRecordSearchLogic';

it('Apex・UI API・JavaScriptのエラー形式と代替文言を維持する', () => {
    expect(reduceErrors({ body: { message: 'Apex' } }, 'fallback')).toBe('Apex');
    expect(reduceErrors([{ body: [{ message: 'one' }, { message: 'two' }] }, null, new Error('JS'), {}], 'fallback')).toBe('one, two; JS; fallback');
    expect(reduceErrors(null, 'fallback')).toBe('');
});

it('トーストの空要素を除き改行と代替文言を維持する', () => {
    expect(createToastMessage(['one', null, '', 'two'], 'fallback')).toBe('one\ntwo');
    expect(createToastMessage('one', 'fallback')).toBe('one');
    expect(createToastMessage([], 'fallback')).toBe('fallback');
});
