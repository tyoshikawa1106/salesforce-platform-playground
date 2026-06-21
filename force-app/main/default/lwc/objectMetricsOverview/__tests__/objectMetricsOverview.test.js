import { createElement } from 'lwc';
import ObjectMetricsOverview from 'c/objectMetricsOverview';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';

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
        { key: 'accounts', value: 50000, capped: true },
        { key: 'contacts', value: 34 },
        { key: 'leads', value: 8 },
        { key: 'opportunities', value: 13 },
        { key: 'opportunityLineItems', value: 7 },
        { key: 'products', value: 21 },
        { key: 'pricebooks', value: 2 },
        { key: 'pricebookEntries', value: 3 },
        { key: 'assets', value: 10 },
        { key: 'campaigns', value: 1 },
        { key: 'cases', value: 4 },
        { key: 'contracts', value: 6 },
        { key: 'orders', value: 11 },
        { key: 'orderItems', value: 12 },
        { key: 'entitlements', value: 13 },
        { key: 'serviceContracts', value: 14 },
        { key: 'workOrders', value: 15 },
        { key: 'workOrderLineItems', value: 16 },
        { key: 'knowledgeArticles', value: 17 },
        { key: 'events', value: 2 },
        { key: 'tasks', value: 5 },
        { key: 'emailMessages', value: 55 },
        { key: 'emailTemplates', value: 9 },
        { key: 'processInstances', value: 18 },
        { key: 'processInstanceWorkitems', value: 19 },
        { key: 'processInstanceSteps', value: 20 },
        { key: 'users', value: 1 }
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
        expect(element.shadowRoot.textContent).toContain('取引先');
        expect(element.shadowRoot.textContent).toContain('取引先責任者');
        expect(element.shadowRoot.textContent).toContain('商談商品');
        expect(element.shadowRoot.textContent).toContain('納入商品');
        expect(element.shadowRoot.textContent).toContain('エンタイトルメント');
        expect(element.shadowRoot.textContent).toContain('作業指示品目');
        expect(element.shadowRoot.textContent).toContain('承認申請');
        expect(element.shadowRoot.textContent).toContain('メールテンプレート');
        expect(element.shadowRoot.textContent).toContain('メールメッセージ');
        expect(element.shadowRoot.textContent).toContain('50,000+');
        expect(element.shadowRoot.textContent).toContain('55');
        await expect(element).toBeAccessible();
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
    });
});
