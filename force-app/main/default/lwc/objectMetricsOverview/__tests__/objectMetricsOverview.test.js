import { createElement } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import ObjectMetricsOverview from 'c/objectMetricsOverview';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn()
    }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics',
    () => {
        const {
            createApexTestWireAdapter
        } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

const countResponse = {
    metrics: [
        {
            key: 'accounts',
            label: '取引先',
            iconName: 'standard:account',
            value: 50000,
            capped: true
        },
        {
            key: 'contacts',
            label: '取引先責任者',
            iconName: 'standard:contact',
            value: 34
        }
    ]
};
countResponse.metrics = countResponse.metrics.map((metric) => ({ ...metric, available: true }));

function createComponent() {
    const element = createElement('c-object-metrics-overview', {
        is: ObjectMetricsOverview
    });
    document.body.appendChild(element);
    return element;
}

async function flushPromises() {
    await Promise.resolve();
}

describe('c-object-metrics-overview', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: jest.fn(),
            writable: true
        });
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders object metric cards from Apex data', async () => {
        const element = createComponent();

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        const cards = element.shadowRoot.querySelectorAll('article');
        const cardContainer =
            element.shadowRoot.querySelector('lightning-card');
        expect(cards).toHaveLength(2);
        expect(cardContainer.title).toBe('データボード');
        expect(cardContainer.iconName).toBe('utility:trailhead');
        expect(element.shadowRoot.textContent).toContain('取引先');
        expect(element.shadowRoot.textContent).toContain('取引先責任者');
        expect(element.shadowRoot.textContent).toContain('50,000+');
        expect(element.shadowRoot.textContent).toContain('34');
        expect(
            element.shadowRoot.querySelector('lightning-icon').iconName
        ).toBe('standard:account');
        await expect(element).toBeAccessible();
    });

    it('opens object record search when a metric card is clicked', async () => {
        const element = createComponent();

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        element.shadowRoot.querySelector('button[data-key="accounts"]').click();
        await flushPromises();

        const recordSearch = element.shadowRoot.querySelector(
            'c-object-record-search'
        );
        expect(recordSearch).toHaveProperty('metricKey', 'accounts');
    });

    it('scrolls to top when navigating between the dashboard and record search', async () => {
        const element = createComponent();

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        element.shadowRoot.querySelector('button[data-key="accounts"]').click();
        await flushPromises();

        element.shadowRoot
            .querySelector('c-object-record-search')
            .dispatchEvent(new CustomEvent('back'));
        await flushPromises();

        expect(window.scrollTo).toHaveBeenCalledTimes(2);
        expect(window.scrollTo).toHaveBeenCalledWith({
            left: 0,
            top: 0
        });
    });

    it('refreshes metrics once when child records change', async () => {
        const element = createComponent();

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        element.shadowRoot.querySelector('button[data-key="accounts"]').click();
        await flushPromises();

        element.shadowRoot
            .querySelector('c-object-record-search')
            .dispatchEvent(new CustomEvent('recordschanged'));
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
    });

    it('does not refresh metrics for the removed recordsdeleted event', async () => {
        const element = createComponent();

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        element.shadowRoot.querySelector('button[data-key="accounts"]').click();
        await flushPromises();

        element.shadowRoot
            .querySelector('c-object-record-search')
            .dispatchEvent(new CustomEvent('recordsdeleted'));
        await flushPromises();

        expect(refreshApex).not.toHaveBeenCalled();
    });

    it('renders a user-facing error when Apex returns an error', async () => {
        const element = createComponent();

        getObjectMetrics.error({
            body: {
                message: 'データボードを読み込めませんでした。'
            }
        });
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]:not([data-client-error])');
        expect(alert?.textContent).toEqual(
            expect.stringContaining('データボードを読み込めませんでした。')
        );
        await expect(element).toBeAccessible();
    });

    it('shows loading spinners while refreshing metrics', async () => {
        const element = createComponent();
        let resolveRefresh;
        refreshApex.mockReturnValue(
            new Promise((resolve) => {
                resolveRefresh = resolve;
            })
        );

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(
            element.shadowRoot.querySelectorAll('lightning-spinner')
        ).toHaveLength(2);

        resolveRefresh();
        await flushPromises();

        expect(
            element.shadowRoot.querySelectorAll('lightning-spinner')
        ).toHaveLength(0);
    });

    it('renders a user-facing error when refresh fails', async () => {
        const element = createComponent();
        refreshApex.mockRejectedValue({
            body: {
                message: '再読み込みに失敗しました。'
            }
        });

        getObjectMetrics.emit(countResponse);
        await flushPromises();

        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]:not([data-client-error])');
        expect(alert.textContent).toContain('再読み込みに失敗しました。');
        expect(
            element.shadowRoot.querySelectorAll('lightning-spinner')
        ).toHaveLength(0);
    });
    it('子の変更通知後に件数取得が失敗しても戻った画面で再試行できる', async () => {
        const element = createComponent();
        getObjectMetrics.emit(countResponse);
        await flushPromises();
        element.shadowRoot.querySelector('.c-count-card-button').click();
        await flushPromises();
        refreshApex.mockRejectedValueOnce(new Error('件数の再取得に失敗'));
        const child = element.shadowRoot.querySelector('c-object-record-search');
        child.dispatchEvent(new CustomEvent('recordschanged'));
        await flushPromises();
        child.dispatchEvent(new CustomEvent('back'));
        await flushPromises();
        expect(element.shadowRoot.querySelector('[role="alert"]:not([data-client-error])').textContent).toContain('件数の再取得に失敗');
        refreshApex.mockResolvedValueOnce();
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        expect(element.shadowRoot.querySelector('[role="alert"]:not([data-client-error])')).toBeNull();
    });

});


describe('処理場所付きエラー表示', () => {
    afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });
    it('失敗した取得元を表示し、診断を閉じても画面を維持する', async () => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});

        const element = createElement('c-objectMetricsOverview', { is: ObjectMetricsOverview });
        document.body.appendChild(element);
        await Promise.resolve();
        getObjectMetrics.error({ message: 'private-value' });
        await Array.from({ length: 35 }).reduce((pending) => pending.then(() => Promise.resolve()), Promise.resolve());
        const panel = element.shadowRoot.querySelector('[data-client-error]');
        expect(panel.textContent).toContain('objectMetricsOverview.js / wiredObjectMetrics');
        expect(JSON.stringify(log.mock.calls)).not.toContain('private-value');
        panel.querySelector('[data-client-error-dismiss]').click();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('[data-client-error]')).toBeNull();
        expect(element.isConnected).toBe(true);
        await expect(element).toBeAccessible();
    });
});

it('画面切替後のスクロール例外を未処理のPromise拒否にしない', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(window, 'scrollTo').mockImplementation(() => { throw new TypeError('private'); });
    const element = createElement('c-object-metrics-overview', { is: ObjectMetricsOverview });
    document.body.appendChild(element);
    getObjectMetrics.emit(countResponse);
    await Promise.resolve();
    const card = element.shadowRoot.querySelector('[data-key]');
    card.click();
    await Array.from({ length: 15 }).reduce((pending) => pending.then(() => Promise.resolve()), Promise.resolve());
    expect(element.shadowRoot.querySelector('[data-client-error]').textContent).toContain('scrollToTop');
    document.body.replaceChildren();
    jest.restoreAllMocks();
});
