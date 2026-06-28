import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';
import { reduceErrors } from 'c/errorUtils';

const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');
const DEFAULT_CARD_ICON = 'standard:record';

export default class ObjectMetricsOverview extends LightningElement {
    metricItems = [];
    errorMessage;
    isRefreshing = false;
    selectedMetricKey;
    wiredObjectMetricsResult;

    @wire(getObjectMetrics)
    wiredObjectMetrics(result) {
        this.wiredObjectMetricsResult = result;
        const { data, error } = result;

        if (data) {
            this.metricItems = this.createMetricItems(data.metrics);
            this.errorMessage = undefined;
        } else if (error) {
            this.metricItems = [];
            this.errorMessage = reduceErrors(
                error,
                'データボードを読み込めませんでした。'
            );
        }
    }

    get countCards() {
        return this.metricItems.map((metricItem) => {
            const formattedValue = `${NUMBER_FORMATTER.format(metricItem.value)}${metricItem.capped ? '+' : ''}`;
            const label = metricItem.label ?? metricItem.key;
            return {
                key: metricItem.key,
                iconName: metricItem.iconName ?? DEFAULT_CARD_ICON,
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

    createMetricItems(metrics = []) {
        return metrics.map((metricItem) => ({
            key: metricItem.key,
            iconName: metricItem.iconName,
            value: metricItem.value,
            capped: metricItem.capped ?? false,
            label: metricItem.label
        }));
    }

    scrollToTop() {
        Promise.resolve().then(() => {
            window.scrollTo({ left: 0, top: 0 });
        });
    }

}