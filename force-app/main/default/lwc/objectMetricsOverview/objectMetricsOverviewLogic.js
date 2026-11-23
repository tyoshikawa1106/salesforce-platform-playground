import { createLogDetails } from 'c/lwcLoggerUtils';
// 件数を日本語ロケールの桁区切りへ変換
const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');
// カタログにアイコンがない場合の既定値
const DEFAULT_CARD_ICON = 'standard:record';

// 件数の初回応答前に描画する見出し。順序・ラベル・アイコンはApexカタログとの一致をテストで確認
const LOADING_METRICS = [
    { key: 'accounts', label: '取引先', iconName: 'standard:account' },
    { key: 'contacts', label: '取引先責任者', iconName: 'standard:contact' },
    { key: 'leads', label: 'リード', iconName: 'standard:lead' },
    { key: 'opportunities', label: '商談', iconName: 'standard:opportunity' },
    { key: 'opportunityLineItems', label: '商談商品', iconName: 'standard:product_consumed' },
    { key: 'products', label: '商品', iconName: 'standard:product' },
    { key: 'pricebooks', label: '価格表', iconName: 'standard:pricebook' },
    { key: 'pricebookEntries', label: '価格表エントリ', iconName: 'standard:price_book_entries' },
    { key: 'assets', label: '納入商品', iconName: 'standard:asset_object' },
    { key: 'campaigns', label: 'キャンペーン', iconName: 'standard:campaign' },
    { key: 'cases', label: 'ケース', iconName: 'standard:case' },
    { key: 'contracts', label: '契約', iconName: 'standard:contract' },
    { key: 'orders', label: '注文', iconName: 'standard:order_item' },
    { key: 'orderItems', label: '注文商品', iconName: 'standard:order_item' },
    { key: 'entitlements', label: 'エンタイトルメント', iconName: 'standard:entitlement' },
    { key: 'serviceContracts', label: 'サービス契約', iconName: 'standard:service_contract' },
    { key: 'workOrders', label: '作業指示', iconName: 'standard:work_order' },
    { key: 'workOrderLineItems', label: '作業指示品目', iconName: 'standard:work_order_item' },
    { key: 'knowledgeArticles', label: 'ナレッジ', iconName: 'utility:knowledge_base' },
    { key: 'events', label: '行動', iconName: 'standard:event' },
    { key: 'tasks', label: 'ToDo', iconName: 'standard:task' },
    { key: 'emailMessages', label: 'メールメッセージ', iconName: 'standard:email' },
    { key: 'emailTemplates', label: 'メールテンプレート', iconName: 'utility:insert_template' },
    { key: 'reports', label: 'レポート', iconName: 'standard:report' },
    { key: 'dashboards', label: 'ダッシュボード', iconName: 'standard:dashboard' },
    { key: 'files', label: 'ファイル', iconName: 'standard:file' },
    { key: 'users', label: 'ユーザー', iconName: 'standard:user' }
];

// Apex応答を画面で管理する件数項目へ正規化
export function normalizeMetricItems(metrics = []) {
    // 表示に必要な許可済みプロパティだけを複製
    return metrics.map((metricItem) => ({
        // カタログの安定キーを保持
        key: metricItem.key,
        // Salesforce標準アイコン名を保持
        iconName: metricItem.iconName,
        // 取得したレコード件数を保持
        value: metricItem.value,
        // 件数上限到達状態を真偽値へ正規化
        capped: metricItem.capped ?? false,
        // 明示された取得成功だけを件数表示へ反映
        available: metricItem.available === true,
        // カタログの表示ラベルを保持
        label: metricItem.label
    }));
}

// 件数項目をテンプレート表示用カードへ変換
export function createCountCards(metricItems = [], loading = false) {
    // 応答前も件数取得後と同じキーでカードを描画
    const items = loading && metricItems.length === 0 ? LOADING_METRICS : metricItems;
    // 最新の読込状態を各カードへ反映
    return items.map((metricItem) => {
        // 取得不可はハイフン、取得成功は整形済み件数と上限記号を表示
        const formattedValue = metricItem.available !== true ? '-' : `${NUMBER_FORMATTER.format(metricItem.value)}${metricItem.capped ? '+' : ''}`;
        // ラベル未取得時もカードキーで識別可能にする
        const label = metricItem.label ?? metricItem.key;
        // テンプレートとアクセシビリティ属性に必要な値を生成
        return {
            // カード選択と繰り返し描画に安定キーを使用
            key: metricItem.key,
            // カタログ値がない場合は標準アイコンへフォールバック
            iconName: metricItem.iconName ?? DEFAULT_CARD_ICON,
            // 画面上のオブジェクト名を表示
            label,
            // 取得不可のタイトルにも説明文を追加せず表示値を使用
            countTitle: metricItem.available !== true ? formattedValue : `${formattedValue} 件`,
            // カード本体へ表示する件数文字列を設定
            formattedValue,
            // 初回取得と再取得中はカード操作を抑止
            loading,
            // カードごとの読込中ラベルを生成
            loadingLabel: `${label}の件数を読み込んでいます`,
            // 遷移操作の目的が分かるタイトルを生成
            openTitle: `${label}一覧を開く`
        };
    });
}
// エラー本文を使わず、画面名・固定の処理名・例外種別だけを診断用に生成
export function clientErrorDetails(error, operation, phase) {
    // 例外の種類とSalesforce応答形式の判定はこの画面で管理
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // 判定済みの種類と固定位置だけを共通のログ整形へ渡す
    return createLogDetails({ source: 'objectMetricsOverview.js', operation, phase, errorType, stack: error?.stack });
}