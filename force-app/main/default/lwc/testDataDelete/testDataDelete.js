import { LightningElement } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import getView from '@salesforce/apex/TestDataDeleteController.getView';
import getRemaining from '@salesforce/apex/TestDataDeleteController.getRemaining';
import startRun from '@salesforce/apex/TestDataDeleteController.startRun';
import { createView, getAvailableObjectNames } from './testDataDeleteLogic';

// 全件削除の確認、受付、残件数の再取得を制御
export default class TestDataDelete extends LightningElement {
    // 最新の実行条件と受付ジョブを保持
    response;
    // 取得した残件数をオブジェクト別に保持
    counts = {};
    // 初回取得を含めて通信中の開始を抑止
    isBusy = true;
    // 利用者向けの通信エラー
    errorMessage = '';
    // この画面で受付したジョブを固定して追跡
    acceptedJobId = '';
    // 応答欠落を失敗確定や未受付として扱わない
    acceptanceUnknown = false;

    // 配置時に現在の実行条件と残件数を確認
    connectedCallback() {
        // 初期状態では全件削除を開始しない
        this.loadView();
    }

    // 入力状態から表示とボタンの可否をまとめる
    get view() {
        // 権限と件数が未確認なら開始を拒否
        return createView(this.response, this.counts, this.isBusy, this.acceptedJobId, this.acceptanceUnknown);
    }

    // 実行可否を標準ボタンへ適用
    get isExecuteDisabled() {
        // 判定の正本はLogicの表示モデル
        return !this.view.canStart;
    }

    // 固定対象の残件数を照会して最新の実行状態へ更新
    async loadView() {
        // 古い残件数を今回の確認結果へ混ぜない
        this.isBusy = true;
        // 新しい問い合わせのエラーだけを表示
        this.errorMessage = '';
        // 再取得が途中で失敗しても以前のゼロ件を使わない
        this.counts = {};
        // 実効権限を確認した後で各オブジェクトを照会
        try {
            // 受付したIDがある場合だけ指定して取得
            this.response = await getView({ jobId: this.acceptedJobId || null });
            // 権限がない場合はデータ照会を行わない
            if (this.response.errorMessage) {
                // 拒否理由は表示モデルから描画
                return;
            }
            // 固定の対象だけを別トランザクションで照会し同期SOQLの上限を避ける
            const objectNames = getAvailableObjectNames(this.response);
            // 独立した件数取得をまとめて待機
            const results = await Promise.all(objectNames.map((objectName) => getRemaining({ objectName })));
            // 権限拒否の応答をゼロ件として取り込まない
            for (const result of results) {
                // 実効権限の変更などで照会が拒否された場合は開始を抑止
                if (result.errorMessage) {
                    // サーバーが返した安全な拒否理由を表示
                    this.errorMessage = result.errorMessage;
                    // 一部の応答だけで実行可否を確定しない
                    this.counts = {};
                    // 更新処理を終了
                    return;
                }
                // 対象に対応する件数を保持
                this.counts = { ...this.counts, [result.objectName]: result.remaining };
            }
            // 件数確認中に始まったジョブも最後に再確認
            this.response = await getView({ jobId: this.acceptedJobId || null });
        } catch {
            // 組織の例外やレコード内容を表示しない
            this.errorMessage = '状態を取得できませんでした。「実行状況・残件数を確認」で再確認してください。';
            // 通信失敗後は開始不可にする
            this.response = undefined;
        } finally {
            // 読み取りの再実行を許可
            this.isBusy = false;
        }
    }

    // 最終確認後に一度だけ削除を受付
    async handleExecute() {
        // 連打や無効な状態でのイベントを無視
        if (!this.view.canStart) {
            // サーバーへ要求しない
            return;
        }
        // 確認ダイアログの重複も抑止
        this.isBusy = true;
        // 前の通信エラーを解除
        this.errorMessage = '';
        // 確認のキャンセルと受付応答の欠落を区別
        let requested = false;
        // 標準の確認ダイアログでキーボードとフォーカスを扱う
        try {
            // 手動作成データと共有ファイルも削除対象であることを明示
            const confirmed = await LightningConfirm.open({
                label: 'テストデータの全件削除',
                message:
                    '一覧のオブジェクトの全レコードを削除します。手動作成データ、全ファイルとその全バージョンも対象です。画面を閉じても処理は続きます。実行しますか？',
                theme: 'error'
            });
            // キャンセル時は以前の追跡状態を維持
            if (!confirmed) {
                // 削除要求を送らない
                return;
            }
            // 新しい受付を過去のジョブで完了扱いしない
            this.acceptedJobId = '';
            // 要求送信後の通信失敗は受付不明にする
            requested = true;
            // サーバーで実効権限・環境・重複を再確認
            this.response = await startRun({ confirmation: 'DELETE_ALL' });
            // 正常な拒否応答は受付不明にしない
            this.acceptedJobId = this.response.jobId || '';
            // 削除中の件数は再取得するまで表示しない
            this.counts = {};
        } catch {
            // ダイアログだけの失敗で受付不明にしない
            this.acceptanceUnknown = requested;
            // 不明な受付は自動で再送しない
            this.response = undefined;
            // ジョブ確認後に画面を開き直して明示的に再確認
            this.errorMessage = requested
                ? '受付結果が不明です。設定のApexジョブで実行状況を確認してください。自動再実行は行いません。'
                : '削除確認を表示できませんでした。再確認してください。';
        } finally {
            // 結果照会を可能にする
            this.isBusy = false;
        }
    }

    // 利用者の操作で標準ジョブと残件数を更新
    handleRefresh() {
        // 進行中のリクエストを重ねない
        if (!this.isBusy) {
            // 新規削除を開始せず状態だけを照会
            this.loadView();
        }
    }
}
