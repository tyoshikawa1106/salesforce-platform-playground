import { createElement } from 'lwc';
import Chart from 'c/setupAuditTrailChart';

afterEach(() => {
    document.body.replaceChildren();
});

it('shows the username only in the tooltip and preserves chart blank rules', async () => {
    const chart = createElement('c-setup-audit-trail-chart', { is: Chart });
    chart.buckets = [
        { userId: '005000000000001', userName: '山田 太郎', loginName: 'viewer@example.invalid', action: 'changedApexClass', section: 'Apex クラス', day: '2026-11-15', count: 2 },
        { userId: '005000000000001', userName: '山田 太郎', day: '2026-11-14', count: 3 },
        { count: 4 }
    ];
    document.body.appendChild(chart);
    await Promise.resolve();

    const [users, namespaces, actions, sections, dates, delegates] = chart.shadowRoot.querySelectorAll('section');
    const user = users.querySelector('[title="viewer@example.invalid"]');
    expect(user.textContent.trim()).toBe('山田 太郎');
    expect(users.textContent).not.toContain('viewer@example.invalid');
    expect(users.querySelector('button[aria-label="- 4件"]').disabled).toBe(true);
    expect(actions.querySelector('button[aria-label="changedApexClass 2件"]').disabled).toBe(false);
    expect(actions.querySelector('button[aria-label="- 7件"]')).not.toBeNull();
    expect(sections.querySelector('button[aria-label="Apex クラス 2件"]')).not.toBeNull();
    expect(dates.querySelector('button[aria-label="- 4件"]')).not.toBeNull();
    expect(namespaces.textContent).toContain('集計対象の値がありません。');
    expect(delegates.textContent).toContain('集計対象の値がありません。');

    const onSelect = jest.fn();
    chart.addEventListener('selectfilter', onSelect);
    users.querySelector('button[aria-label="山田 太郎（viewer@example.invalid） 5件"]').click();
    expect(onSelect.mock.calls[0][0].detail).toEqual({ userId: '005000000000001', userName: '山田 太郎' });
});

it('keeps a rare action selectable independently of the width of its bar', async () => {
    const chart = createElement('c-setup-audit-trail-chart', { is: Chart });
    chart.buckets = [{ action: 'frequent', count: 199999 }, { action: 'rare', count: 1 }];
    document.body.appendChild(chart);
    await Promise.resolve();
    const button = chart.shadowRoot.querySelector('button[aria-label="rare 1件"]');
    expect(button.style.width).toBe('');
    const bar = button.querySelector('.c-bar-fill');
    expect(parseFloat(bar.style.width)).toBeLessThan(0.01);
    expect(bar.nextElementSibling.textContent).toBe('1');
    expect(chart.shadowRoot.querySelector('button[aria-label="frequent 199,999件"] .c-count').textContent).toBe('199,999');
    const select = jest.fn();
    chart.addEventListener('selectfilter', select);
    button.click();
    expect(select.mock.calls[0][0].detail).toEqual({ action: 'rare' });
});

it('distinguishes equally frequent users with the same name when choosing a bar', async () => {
    const chart = createElement('c-setup-audit-trail-chart', { is: Chart });
    chart.buckets = [
        { userId: 'first', userName: '同名', loginName: 'first@example.invalid', count: 1 },
        { userId: 'second', userName: '同名', count: 1 }
    ];
    document.body.appendChild(chart);
    await Promise.resolve();
    const select = jest.fn();
    chart.addEventListener('selectfilter', select);
    const users = chart.shadowRoot.querySelector('section');
    users.querySelector('button[aria-label="同名（first@example.invalid） 1件"]').click();
    users.querySelector('button[aria-label="同名（second） 1件"]').click();
    expect(select.mock.calls.map(([event]) => event.detail.userId)).toEqual(['first', 'second']);
});
