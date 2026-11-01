import { reduceErrors } from '../objectMetricsOverviewLogic';

it('Apex・UI API・JavaScriptのエラー形式と代替文言を維持する', () => {
    expect(reduceErrors({ body: { message: 'Apex' } }, 'fallback')).toBe('Apex');
    expect(reduceErrors([{ body: [{ message: 'one' }, { message: 'two' }] }, null, new Error('JS'), {}], 'fallback')).toBe('one, two; JS; fallback');
    expect(reduceErrors(null, 'fallback')).toBe('');
});
