import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';
import { reduceErrors } from 'c/errorUtils';

const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');

const COUNT_CARD_CONFIGS = [
    { key: 'accounts', iconName: 'standard:account' },
    { key: 'contacts', iconName: 'standard:contact' },
    { key: 'leads', iconName: 'standard:lead' },
    { key: 'opportunities', iconName: 'standard:opportunity' },
    {
        key: 'opportunityLineItems',
        iconName: 'standard:product_consumed'
    },
    { key: 'products', iconName: 'standard:product' },
    { key: 'pricebooks', iconName: 'standard:pricebook' },
    {
        key: 'pricebookEntries',
        iconName: 'standard:price_book_entries'
    },
    {
        key: 'assets',
        iconName: 'standard:asset_object'
    },
    { key: 'campaigns', iconName: 'standard:campaign' },
    { key: 'cases', iconName: 'standard:case' },
    { key: 'contracts', iconName: 'standard:contract' },
    {
        key: 'orders',
        iconName: 'standard:order_item'
    },
    {
        key: 'orderItems',
        iconName: 'standard:order_item'
    },
    {
        key: 'entitlements',
        iconName: 'standard:entitlement'
    },
    {
        key: 'serviceContracts',
        iconName: 'standard:service_contract'
    },
    {
        key: 'workOrders',
        iconName: 'standard:work_order'
    },
    {
        key: 'workOrderLineItems',
        iconName: 'standard:work_order_item'
    },
    {
        key: 'knowledgeArticles',
        iconName: 'utility:knowledge_base'
    },
    { key: 'events', iconName: 'standard:event' },
    { key: 'tasks', iconName: 'standard:task' },
    {
        key: 'emailMessages',
        iconName: 'standard:email'
    },
    {
        key: 'emailTemplates',
        iconName: 'utility:insert_template'
    },
    {
        key: 'reports',
        iconName: 'standard:report'
    },
    {
        key: 'dashboards',
        iconName: 'standard:dashboard'
    },
    {
        key: 'files',
        iconName: 'standard:file'
    },
    {
        key: 'users',
        iconName: 'standard:user'
    }
];

export default class ObjectMetricsOverview extends LightningElement {
    metricValues = {};
    errorMessage;
    isRefreshing = false;
    selectedMetricKey;
    wiredObjectMetricsResult;

    @wire(getObjectMetrics)
    wiredObjectMetrics(result) {
        this.wiredObjectMetricsResult = result;
        const { data, error } = result;

        if (data) {
            this.metricValues = this.createMetricValues(data.metrics);
            this.errorMessage = undefined;
        } else if (error) {
            this.metricValues = {};
            this.errorMessage = reduceErrors(
                error,
                'データボードを読み込めませんでした。'
            );
        }
    }

    get countCards() {
        return COUNT_CARD_CONFIGS.map((config) => {
            const metricValue = this.metricValues[config.key] ?? {
                value: 0,
                capped: false,
                label: config.key
            };
            const formattedValue = `${NUMBER_FORMATTER.format(metricValue.value)}${metricValue.capped ? '+' : ''}`;
            const label = metricValue.label ?? config.key;
            return {
                ...config,
                label,
                countTitle: `${formattedValue} 件`,
                formattedValue,
                loading: this.isBusy,
                loadingLabel: `${label}の件数を読み込んでいます`,
                openTitle: `${label}一覧を開く`
            };
        });
    }

    get isBusy() {
        return this.isLoading || this.isRefreshing;
    }

    get isLoading() {
        return (
            !this.errorMessage &&
            !this.wiredObjectMetricsResult?.data &&
            !this.wiredObjectMetricsResult?.error
        );
    }

    async handleRefresh() {
        if (!this.wiredObjectMetricsResult) {
            return;
        }

        this.isRefreshing = true;
        try {
            await refreshApex(this.wiredObjectMetricsResult);
        } catch (error) {
            this.errorMessage = reduceErrors(
                error,
                'データボードを読み込めませんでした。'
            );
        } finally {
            this.isRefreshing = false;
        }
    }

    handleCardClick(event) {
        this.selectedMetricKey = event.currentTarget.dataset.key;
        this.scrollToTop();
    }

    handleBackToDashboard() {
        this.selectedMetricKey = undefined;
        this.scrollToTop();
    }

    async handleRecordsChanged() {
        if (this.wiredObjectMetricsResult) {
            await refreshApex(this.wiredObjectMetricsResult);
        }
    }

    createMetricValues(metrics = []) {
        return metrics.reduce((values, metricItem) => {
            values[metricItem.key] = {
                value: metricItem.value,
                capped: metricItem.capped ?? false,
                label: metricItem.label
            };
            return values;
        }, {});
    }

    scrollToTop() {
        Promise.resolve().then(() => {
            window.scrollTo({ left: 0, top: 0 });
        });
    }

}
