// 件数を日本語ロケールの桁区切りへ変換
const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');
// カタログにアイコンがない場合の既定値
const DEFAULT_CARD_ICON = 'standard:record';

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
        // カタログの表示ラベルを保持
        label: metricItem.label
    }));
}

// 件数項目をテンプレート表示用カードへ変換
export function createCountCards(metricItems = [], loading = false) {
    // 最新の読込状態を各カードへ反映
    return metricItems.map((metricItem) => {
        // 上限到達時は整形済み件数へプラス記号を付加
        const formattedValue = `${NUMBER_FORMATTER.format(metricItem.value)}${metricItem.capped ? '+' : ''}`;
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
            // 件数全体を読み上げ可能なタイトルへ整形
            countTitle: `${formattedValue} 件`,
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