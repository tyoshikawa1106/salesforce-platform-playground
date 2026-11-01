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
        // 明示された取得成功だけを件数表示へ反映
        available: metricItem.available === true,
        // カタログの表示ラベルを保持
        label: metricItem.label
    }));
}

// 件数項目をテンプレート表示用カードへ変換
export function createCountCards(metricItems = [], loading = false) {
    // 最新の読込状態を各カードへ反映
    return metricItems.map((metricItem) => {
        // 上限到達時は整形済み件数へプラス記号を付加
        const formattedValue = metricItem.available !== true ? '取得できません' : `${NUMBER_FORMATTER.format(metricItem.value)}${metricItem.capped ? '+' : ''}`;
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
            countTitle: metricItem.available !== true ? '権限と利用可能な機能を確認してください' : `${formattedValue} 件`,
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
    // 任意の名前や本文を診断へ混ぜず、通常の例外名だけを採用
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // URLや端末パスを除き、JSファイルの行・列だけを上限付きで抽出
    const frames = typeof error?.stack === 'string'
        ? [...new Set(error.stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8) : [];
    // 値やレコード名を含まない固定の呼び出し位置で表示を構成
    return { location: `objectMetricsOverview.js / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}


// 単一値と配列を共通処理できる配列形式へ正規化
function normalizeToArray(value) {
    // 配列はそのまま使い、単一値だけを配列へ包む
    return Array.isArray(value) ? value : [value];
}

// Salesforceエラーから画面表示用メッセージ一覧を抽出
export function getErrorMessages(errors, fallbackMessage) {
    // 単一エラーと複数エラーを同じ反復処理へ統一
    const normalizedErrors = normalizeToArray(errors);
    // 抽出したメッセージを入力順に保持
    const messages = [];

    // エラー形式ごとに利用可能なメッセージを収集
    for (const error of normalizedErrors) {
        // 空のエラー要素は表示対象から除外
        if (!error) {
            // 後続の形式判定を行わず次のエラーへ進む
            continue;
        }

        // UI APIの複数エラーは1つの表示メッセージへまとめる
        if (Array.isArray(error.body)) {
            // 各bodyのメッセージを入力順に連結
            messages.push(
                error.body.map((bodyError) => bodyError.message).join(', ')
            );
            // 配列形式を単一エラーとして重複処理せず次へ進む
            continue;
        }

        // Apex、JavaScript、代替文言の優先順で表示内容を確定
        messages.push(error.body?.message ?? error.message ?? fallbackMessage);
    }

    // 呼び出し側が用途に応じて整形できる配列を返却
    return messages;
}

// Salesforceエラーを1行の画面表示用文字列へ変換
export function reduceErrors(errors, fallbackMessage) {
    // 複数メッセージを区切り付きで連結
    return getErrorMessages(errors, fallbackMessage).join('; ');
}
