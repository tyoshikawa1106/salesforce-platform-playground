import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';

const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');

// Apex が返す安定キーに、画面表示用のラベルとアイコンを対応付けます。
const COUNT_CARD_CONFIGS = [
    { key: 'accounts', iconName: 'standard:account', label: '取引先' },
    { key: 'contacts', iconName: 'standard:contact', label: '取引先責任者' },
    { key: 'leads', iconName: 'standard:lead', label: 'リード' },
    { key: 'opportunities', iconName: 'standard:opportunity', label: '商談' },
    {
        key: 'opportunityLineItems',
        iconName: 'standard:product_consumed',
        label: '商談商品'
    },
    { key: 'products', iconName: 'standard:product', label: '商品' },
    { key: 'pricebooks', iconName: 'standard:pricebook', label: '価格表' },
    {
        key: 'pricebookEntries',
        iconName: 'standard:price_book_entries',
        label: '価格表エントリ'
    },
    {
        key: 'assets',
        iconName: 'standard:asset_object',
        label: '納入商品'
    },
    { key: 'campaigns', iconName: 'standard:campaign', label: 'キャンペーン' },
    { key: 'cases', iconName: 'standard:case', label: 'ケース' },
    { key: 'contracts', iconName: 'standard:contract', label: '契約' },
    {
        key: 'orders',
        iconName: 'standard:order_item',
        label: '注文'
    },
    {
        key: 'orderItems',
        iconName: 'standard:order_item',
        label: '注文商品'
    },
    {
        key: 'entitlements',
        iconName: 'standard:entitlement',
        label: 'エンタイトルメント'
    },
    {
        key: 'serviceContracts',
        iconName: 'standard:service_contract',
        label: 'サービス契約'
    },
    {
        key: 'workOrders',
        iconName: 'standard:work_order',
        label: '作業指示'
    },
    {
        key: 'workOrderLineItems',
        iconName: 'standard:work_order_item',
        label: '作業指示品目'
    },
    {
        key: 'knowledgeArticles',
        iconName: 'utility:knowledge_base',
        label: 'ナレッジ'
    },
    { key: 'events', iconName: 'standard:event', label: '行動' },
    { key: 'tasks', iconName: 'standard:task', label: 'ToDo' },
    {
        key: 'emailMessages',
        iconName: 'standard:email',
        label: 'メールメッセージ'
    },
    {
        key: 'emailTemplates',
        iconName: 'utility:insert_template',
        label: 'メールテンプレート'
    },
    {
        key: 'reports',
        iconName: 'standard:report',
        label: 'レポート'
    },
    {
        key: 'dashboards',
        iconName: 'standard:dashboard',
        label: 'ダッシュボード'
    },
    {
        key: 'files',
        iconName: 'standard:file',
        label: 'ファイル'
    },
    {
        key: 'users',
        iconName: 'standard:user',
        label: 'ユーザー'
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
        // refreshApex で再利用できるよう、wire の結果オブジェクトを保持します。
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
        // 件数が未取得のカードも 0 件として描画し、画面のカード順を固定します。
        return COUNT_CARD_CONFIGS.map((config) => {
            const metricValue = this.metricValues[config.key] ?? {
                value: 0,
                capped: false
            };
            const formattedValue = `${NUMBER_FORMATTER.format(metricValue.value)}${metricValue.capped ? '+' : ''}`;
            return {
                ...config,
                countTitle: `${formattedValue} 件`,
                formattedValue,
                loading: this.isBusy,
                loadingLabel: `${config.label}の件数を読み込んでいます`,
                openTitle: `${config.label}一覧を開く`
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

    handleCardClick(event) {
        this.selectedMetricKey = event.currentTarget.dataset.key;
    }

    handleBackToDashboard() {
        this.selectedMetricKey = undefined;
    }

    async handleRecordsDeleted() {
        await this.handleRecordsChanged();
    }

    async handleRecordsChanged() {
        if (this.wiredObjectMetricsResult) {
            await refreshApex(this.wiredObjectMetricsResult);
        }
    }

    createMetricValues(metrics = []) {
        // 配列レスポンスをカードキーで参照しやすい形に変換します。
        return metrics.reduce((values, metricItem) => {
            values[metricItem.key] = {
                value: metricItem.value,
                capped: metricItem.capped ?? false
            };
            return values;
        }, {});
    }

    reduceErrors(errors) {
        // LDS / Apex / JavaScript 例外の形を吸収し、画面には文字列だけを返します。
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
                return 'データボードを読み込めませんでした。';
            })
            .join('; ');
    }
}
