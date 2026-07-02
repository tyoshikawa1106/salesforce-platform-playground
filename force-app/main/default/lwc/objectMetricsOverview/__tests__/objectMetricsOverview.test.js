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
        },
        { key: 'leads', label: 'リード', iconName: 'standard:lead', value: 8 },
        {
            key: 'opportunities',
            label: '商談',
            iconName: 'standard:opportunity',
            value: 13
        },
        {
            key: 'opportunityLineItems',
            label: '商談商品',
            iconName: 'standard:product_consumed',
            value: 7
        },
        { key: 'products', label: '商品', iconName: 'standard:product', value: 21 },
        {
            key: 'pricebooks',
            label: '価格表',
            iconName: 'standard:pricebook',
            value: 2
        },
        {
            key: 'pricebookEntries',
            label: '価格表エントリ',
            iconName: 'standard:price_book_entries',
            value: 3
        },
        {
            key: 'assets',
            label: '納入商品',
            iconName: 'standard:asset_object',
            value: 10
        },
        {
            key: 'campaigns',
            label: 'キャンペーン',
            iconName: 'standard:campaign',
            value: 1
        },
        { key: 'cases', label: 'ケース', iconName: 'standard:case', value: 4 },
        {
            key: 'contracts',
            label: '契約',
            iconName: 'standard:contract',
            value: 6
        },
        {
            key: 'orders',
            label: '注文',
            iconName: 'standard:order_item',
            value: 11
        },
        {
            key: 'orderItems',
            label: '注文商品',
            iconName: 'standard:order_item',
            value: 12
        },
        {
            key: 'entitlements',
            label: 'エンタイトルメント',
            iconName: 'standard:entitlement',
            value: 13
        },
        {
            key: 'serviceContracts',
            label: 'サービス契約',
            iconName: 'standard:service_contract',
            value: 14
        },
        {
            key: 'workOrders',
            label: '作業指示',
            iconName: 'standard:work_order',
            value: 15
        },
        {
            key: 'workOrderLineItems',
            label: '作業指示品目',
            iconName: 'standard:work_order_item',
            value: 16
        },
        {
            key: 'knowledgeArticles',
            label: 'ナレッジ',
            iconName: 'utility:knowledge_base',
            value: 17
        },
        { key: 'events', label: '行動', iconName: 'standard:event', value: 2 },
        { key: 'tasks', label: 'ToDo', iconName: 'standard:task', value: 5 },
        {
            key: 'emailMessages',
            label: 'メールメッセージ',
            iconName: 'standard:email',
            value: 55
        },
        {
            key: 'emailTemplates',
            label: 'メールテンプレート',
            iconName: 'utility:insert_template',
            value: 9
        },
        {
            key: 'reports',
            label: 'レポート',
            iconName: 'standard:report',
            value: 18
        },
        {
            key: 'dashboards',
            label: 'ダッシュボード',
            iconName: 'standard:dashboard',
            value: 19
        },
        { key: 'files', label: 'ファイル', iconName: 'standard:file', value: 20 },
        { key: 'users', label: 'ユーザー', iconName: 'standard:user', value: 1 }
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

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert.textContent).toContain('再読み込みに失敗しました。');
        expect(
            element.shadowRoot.querySelectorAll('lightning-spinner')
        ).toHaveLength(0);
    });
});
