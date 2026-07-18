import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getObjectMetrics from '@salesforce/apex/ObjectMetricsOverviewController.getObjectMetrics';
import { reduceErrors } from 'c/errorUtils';

// 件数を日本語ロケールの桁区切りへ変換
const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');
// カタログにアイコンがない場合の既定値
const DEFAULT_CARD_ICON = 'standard:record';

// 主要オブジェクトの件数カードと検索画面の切り替えを管理
export default class ObjectMetricsOverview extends LightningElement {
    // Apexから取得した件数項目を表示順に保持
    metricItems = [];
    // 件数取得失敗時の利用者向けメッセージを保持
    errorMessage;
    // 手動再読み込み中の操作抑止状態を保持
    isRefreshing = false;
    // 検索画面へ渡す選択中のカードキーを保持
    selectedMetricKey;
    // refreshApexへ渡すwireレスポンス全体を保持
    wiredObjectMetricsResult;

    // Apexから件数一覧を取得して表示状態へ反映
    @wire(getObjectMetrics)
    wiredObjectMetrics(result) {
        // 後続の再読み込みに使えるwireレスポンスを保存
        this.wiredObjectMetricsResult = result;
        // 成功データとエラーを排他的に参照
        const { data, error } = result;

        // 取得成功時はカード項目を最新値へ置き換え
        if (data) {
            // Apex応答を画面表示用の安定した構造へ変換
            this.metricItems = this.createMetricItems(data.metrics);
            // 再取得成功時は以前のエラー表示を解除
            this.errorMessage = undefined;
        // 取得失敗時は古い件数を残さずエラー表示
        } else if (error) {
            // 以前取得したカードをエラー時に破棄
            this.metricItems = [];
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(
                error,
                'データボードを読み込めませんでした。'
            );
        }
    }

    // 件数項目をテンプレート表示用カードへ変換
    get countCards() {
        // 最新の読込状態を各カードへ反映
        return this.metricItems.map((metricItem) => {
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
                loading: this.isBusy,
                // カードごとの読込中ラベルを生成
                loadingLabel: `${label}の件数を読み込んでいます`,
                // 遷移操作の目的が分かるタイトルを生成
                openTitle: `${label}一覧を開く`
            };
        });
    }

    // 初回取得と手動再取得をまとめた操作中状態を返却
    get isBusy() {
        // いずれかの読込処理中は操作を抑止
        return this.isLoading || this.isRefreshing;
    }

    // wireの初回レスポンス待ち状態を判定
    get isLoading() {
        // データ、エラー、明示エラーのいずれもない間だけ読込中とする
        return (
            !this.errorMessage &&
            !this.wiredObjectMetricsResult?.data &&
            !this.wiredObjectMetricsResult?.error
        );
    }

    // 利用者操作で件数一覧を再取得
    async handleRefresh() {
        // wire初期化前の再読み込み要求は処理しない
        if (!this.wiredObjectMetricsResult) {
            // 現在表示を維持して再読み込みを終了
            return;
        }

        // 再読み込み完了まで操作を抑止
        this.isRefreshing = true;
        // 保存済みwireレスポンスの再取得を実行
        try {
            // 保存済みwireレスポンスをSalesforceから再取得
            await refreshApex(this.wiredObjectMetricsResult);
        // 再読み込み失敗時は画面上のエラーへ移行
        } catch (error) {
            // 再読み込み失敗を画面上のエラーへ反映
            this.errorMessage = reduceErrors(
                error,
                'データボードを読み込めませんでした。'
            );
        // 成否にかかわらず操作抑止を解除
        } finally {
            // 成否にかかわらず再読み込み状態を解除
            this.isRefreshing = false;
        }
    }

    // 選択したカードの汎用レコード検索画面を開く
    handleCardClick(event) {
        // data属性のカードキーを検索条件として保存
        this.selectedMetricKey = event.currentTarget.dataset.key;
        // 画面切り替え後に先頭から操作できるようスクロール
        this.scrollToTop();
    }

    // 検索画面を閉じてデータボードへ戻る
    handleBackToDashboard() {
        // 選択状態を解除してカード一覧へ切り替え
        this.selectedMetricKey = undefined;
        // 復帰後のカード一覧を先頭から表示
        this.scrollToTop();
    }

    // 子検索画面のレコード変更後に件数を再取得
    async handleRecordsChanged() {
        // wire初期化済みの場合だけ最新件数を要求
        if (this.wiredObjectMetricsResult) {
            // 親カードへ作成、更新、削除結果を反映
            await refreshApex(this.wiredObjectMetricsResult);
        }
    }

    // Apex応答を画面で管理する件数項目へ正規化
    createMetricItems(metrics = []) {
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

    // 描画完了後にブラウザ表示位置をページ先頭へ移動
    scrollToTop() {
        // DOM更新後のマイクロタスクでスクロールを実行
        Promise.resolve().then(() => {
            // 水平位置も含めてページ先頭へ戻す
            window.scrollTo({ left: 0, top: 0 });
        });
    }

}
