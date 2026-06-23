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
        { key: 'accounts', label: '取引先', value: 50000, capped: true },
        { key: 'contacts', label: '取引先責任者', value: 34 },
        { key: 'leads', label: 'リード', value: 8 },
        { key: 'opportunities', label: '商談', value: 13 },
        { key: 'opportunityLineItems', label: '商談商品', value: 7 },
        { key: 'products', label: '商品', value: 21 },
        { key: 'pricebooks', label: '価格表', value: 2 },
        { key: 'pricebookEntries', label: '価格表エントリ', value: 3 },
        { key: 'assets', label: '納入商品', value: 10 },
        { key: 'campaigns', label: 'キャンペーン', value: 1 },
        { key: 'cases', label: 'ケース', value: 4 },
        { key: 'contracts', label: '契約', value: 6 },
        { key: 'orders', label: '注文', value: 11 },
        { key: 'orderItems', label: '注文商品', value: 12 },
        { key: 'entitlements', label: 'エンタイトルメント', value: 13 },
        { key: 'serviceContracts', label: 'サービス契約', value: 14 },
        { key: 'workOrders', label: '作業指示', value: 15 },
        { key: 'workOrderLineItems', label: '作業指示品目', value: 16 },
        { key: 'knowledgeArticles', label: 'ナレッジ', value: 17 },
        { key: 'events', label: '行動', value: 2 },
        { key: 'tasks', label: 'ToDo', value: 5 },
        { key: 'emailMessages', label: 'メールメッセージ', value: 55 },
        { key: 'emailTemplates', label: 'メールテンプレート', value: 9 },
        { key: 'reports', label: 'レポート', value: 18 },
        { key: 'dashboards', label: 'ダッシュボード', value: 19 },
        { key: 'files', label: 'ファイル', value: 20 },
        { key: 'users', label: 'ユーザー', value: 1 }
    ]
};

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
        expect(cards).toHaveLength(27);
        expect(cardContainer.title).toBe('データボード');
        expect(cardContainer.iconName).toBe('utility:trailhead');
        expect(element.shadowRoot.textContent).toContain('取引先');
        expect(element.shadowRoot.textContent).toContain('取引先責任者');
        expect(element.shadowRoot.textContent).toContain('商談商品');
        expect(element.shadowRoot.textContent).toContain('納入商品');
        expect(element.shadowRoot.textContent).toContain('エンタイトルメント');
        expect(element.shadowRoot.textContent).toContain('作業指示品目');
        expect(element.shadowRoot.textContent).toContain('メールテンプレート');
        expect(element.shadowRoot.textContent).toContain('メールメッセージ');
        expect(element.shadowRoot.textContent).toContain('レポート');
        expect(element.shadowRoot.textContent).toContain('ダッシュボード');
        expect(element.shadowRoot.textContent).toContain('ファイル');
        expect(element.shadowRoot.textContent).not.toContain('承認申請');
        expect(element.shadowRoot.textContent).not.toContain('承認作業項目');
        expect(element.shadowRoot.textContent).not.toContain('承認履歴');
        expect(element.shadowRoot.textContent).toContain('50,000+');
        expect(element.shadowRoot.textContent).toContain('55');
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
        expect(recordSearch).not.toBeNull();
        expect(recordSearch.metricKey).toBe('accounts');
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

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(alert.textContent).toContain(
            'データボードを読み込めませんでした。'
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
        ).toHaveLength(27);

        resolveRefresh();
        await flushPromises();

        expect(
            element.shadowRoot.querySelectorAll('lightning-spinner')
        ).toHaveLength(0);
    });
});
