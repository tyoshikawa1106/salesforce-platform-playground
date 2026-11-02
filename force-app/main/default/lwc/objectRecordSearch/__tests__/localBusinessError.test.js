import { createToastMessage } from '../objectRecordSearchLogic';



it('トーストの空要素を除き改行と代替文言を維持する', () => {
    expect(createToastMessage(['one', null, '', 'two'], 'fallback')).toBe('one\ntwo');
    expect(createToastMessage('one', 'fallback')).toBe('one');
    expect(createToastMessage([], 'fallback')).toBe('fallback');
});
