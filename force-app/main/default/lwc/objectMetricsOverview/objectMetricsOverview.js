import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';

const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');

const COUNT_CARD_CONFIGS = [
    { key: 'accounts', iconName: 'standard:account', label: '取引先' },
    { key: 'contacts', iconName: 'standard:contact', label: '取引先責任者' },
    { key: 'events', iconName: 'standard:event', label: '行動' },
    { key: 'tasks', iconName: 'standard:task', label: 'ToDo' },
    { key: 'users', iconName: 'standard:user', label: 'ユーザー' },
    { key: 'recycleBinItems', iconName: 'standard:empty', label: 'ごみ箱' },
    { key: 'leads', iconName: 'standard:lead', label: 'リード' },
    { key: 'opportunities', iconName: 'standard:opportunity', label: '商談' },
    { key: 'products', iconName: 'standard:product', label: '商品' },
    { key: 'campaigns', iconName: 'standard:campaign', label: 'キャンペーン' },
    { key: 'cases', iconName: 'standard:case', label: 'ケース' },
    {
        key: 'emailMessages',
        iconName: 'standard:email',
        label: 'メールメッセージ'
    }
];

export default class ObjectMetricsOverview extends LightningElement {
    metricValues = {};
    errorMessage;
    isRefreshing = false;
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
            this.errorMessage = this.reduceErrors(error);
        }
    }

    get countCards() {
        return COUNT_CARD_CONFIGS.map((config) => {
            const value = this.metricValues[config.key] ?? 0;
            return {
                ...config,
                countTitle: `${value} 件`,
                formattedValue: NUMBER_FORMATTER.format(value),
                loading: this.isLoading,
                loadingLabel: `${config.label}の件数を読み込んでいます`
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
            this.errorMessage = this.reduceErrors(error);
        } finally {
            this.isRefreshing = false;
        }
    }

    createMetricValues(metrics = []) {
        return metrics.reduce((values, metricItem) => {
            values[metricItem.key] = metricItem.value;
            return values;
        }, {});
    }

    reduceErrors(errors) {
        const normalizedErrors = Array.isArray(errors) ? errors : [errors];
        return normalizedErrors
            .filter((error) => error)
            .map((error) => {
                if (Array.isArray(error.body)) {
                    return error.body
                        .map((bodyError) => bodyError.message)
                        .join(', ');
                }
                if (error.body?.message) {
                    return error.body.message;
                }
                if (error.message) {
                    return error.message;
                }
                return 'オブジェクト指標を読み込めませんでした。';
            })
            .join('; ');
    }
}
