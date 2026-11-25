import { recordLog } from 'c/lwcLoggerUtils';
import { clientErrorDetails } from './accountDeleteLogic';
import { LightningElement } from 'lwc';
import getView from '@salesforce/apex/AccountDeleteController.getView';
import startRun from '@salesforce/apex/AccountDeleteController.startRun';
import AccountDeleteConfirm from 'c/accountDeleteConfirm';
import { createDeleteView } from './accountDeleteLogic';

// 取引先一括削除の確認・受付・結果表示を管理
export default class AccountDelete extends LightningElement {
    // 診断表示は失敗時だけ生成し、成功ログは保持しない
    clientError;

    // 明示的に捕捉した例外を本文なしの診断へ変換
    reportClientError(error, operation, phase) {
        // この画面専用のLogicで固定の処理位置を生成
        const details = clientErrorDetails(error, operation, phase);
        // 記録の重複だけ共通処理で抑止し、表示状態は画面側で更新
        if (!recordLog(this.clientError, details)) return;
        // 同じ画面の診断表示へ新しい記録を反映
        this.clientError = details;
    }

    // 子の描画と宣言的イベントの失敗を親画面内で受け止める
    errorCallback(error) {
        // Salesforce全体の例外ではなく、この境界内の子だけを扱う
        this.reportClientError(error, 'errorCallback', 'child-component');
    }

    // 利用者が診断を閉じても業務上の失敗状態や入力は変えない
    handleClientErrorDismiss() {
        // 次の失敗は同じ処理であっても改めて表示する
        this.clientError = undefined;
    }

    // 最新のサーバー応答を保持
    response;
    // 初回読み込みを含む通信中の操作を抑止
    isBusy = true;
    // 画面へ表示する安全な通信エラー
    errorMessage = '';
    // この画面で受け付けた、または実行中に確認したジョブを保持
    acceptedJobId = '';

    // 確認と照会を開始した画面の世代を識別する。
    connectionVersion = 0;
    // 受付要求の送信後は再接続しても結果が戻るまで開始をロックする。
    startPending = false;

    // 離脱した画面の確認結果と照会結果を無効にする。
    disconnectedCallback() {
        // 同じインスタンスが再接続しても古い確認は再利用しない。
        this.connectionVersion += 1;
    }

    // 配置時に現在の権限とジョブを確認
    connectedCallback() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 初期画面を取得結果から構成
            if (!this.startPending) this.loadView();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'connectedCallback', 'lifecycle');
        }
    }

    // Apex応答を表示と操作可否へまとめる
    get view() {
        // 未確認時と受付直後の二重起動もLogicで抑止
        return createDeleteView(this.response, this.isBusy, this.acceptedJobId);
    }

    // テンプレートへ開始ボタンの無効状態を返却
    get isExecuteDisabled() {
        // 読み込み・確認・受付済みの状態をまとめて反映
        return !this.view.canStart;
    }

    // 最新の権限とジョブを画面へ読み込む
    async loadView() {
        // 再接続後に新しい照会結果だけを反映する。
        const version = this.connectionVersion;
        // 読み込み中は開始操作を抑止
        this.isBusy = true;
        // 前回の通信エラーを解除
        this.errorMessage = '';
        // 受付済み状態を残したまま再取得
        try {
            // サーバーから現在の応答を取得
            const response = await getView({ jobId: this.acceptedJobId || null });
            // 離脱後の応答で新しい画面を上書きしない。
            if (version !== this.connectionVersion) return;
            // 現在の照会で確認した権限とジョブを反映する。
            this.response = response;
            // この画面で確認した実行中ジョブを、完了後も追跡する
            if (!this.acceptedJobId && this.view.hasRun) {
                this.acceptedJobId = this.view.jobId;
            }
        } catch (caughtError) {
            // 以前の照会の失敗を現在の画面へ表示しない。
            if (version !== this.connectionVersion) return;
            // 例外本文を記録せず、失敗した処理だけを通知
            this.reportClientError(caughtError, 'loadView', 'processing');
            // 内部の例外内容を画面へ転記しない
            this.errorMessage = '実行状態を取得できませんでした。権限を確認し、「実行状況を確認」を押してください。';
            // 不明な権限状態で開始を許可しない
            this.response = undefined;
        } finally {
            // 再取得操作を可能にする
            if (version === this.connectionVersion) this.isBusy = false;
        }
    }

    // 確認モーダルを経由して削除を受付
    async handleExecute() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 無効な状態のイベントや連打を無視
            if (!this.view.canStart) {
                // 現在の画面を保持
                return;
            }
            // 確認開始時の画面だけが受付要求を送れる。
            const version = this.connectionVersion;
            // モーダルを重複して開かない
            this.isBusy = true;
            // 新しい操作のエラーだけを表示
            this.errorMessage = '';
            // 送信済みの受付結果は離脱後も追跡する。
            let requested = false;
            // 確認と開始要求を順に実行
            try {
                // 標準モーダルのフォーカス・Escape処理を利用
                const confirmed = await AccountDeleteConfirm.open({ size: 'small', label: '取引先の削除確認' });
                // キャンセルや閉じる操作ではApexを呼び出さない
                if (confirmed !== true || version !== this.connectionVersion) {
                    // 状態変更なしで元の画面へ戻る
                    return;
                }
                // この操作が送信した受付だけを完了時に解放する。
                requested = true;
                // 最終的な環境・権限・重複判定をApexへ委譲
                this.startPending = true;
                // 受付応答を同じインスタンスで追跡する。
                this.response = await startRun();
                // ジョブIDがある場合だけ受付済みとして扱う
                this.acceptedJobId = this.response?.jobId || '';
            } catch (caughtError) {
                // 前の画面の確認失敗を新しい操作へ混ぜない。
                if (!requested && version !== this.connectionVersion) return;
                // 例外本文を記録せず、失敗した処理だけを通知
                this.reportClientError(caughtError, 'handleExecute', 'processing');
                // 受付の成否を断定せず再確認を案内
                this.errorMessage = '受付結果を確認できませんでした。「実行状況を確認」を押し、Apexジョブを確認してください。';
                // 応答欠落時に無条件で再実行を許可しない
                this.response = undefined;
            } finally {
                // 通信終了後の状態更新を許可
                if (requested) this.startPending = false;
                // 古い確認の終了で再接続後の確認や照会を解放しない。
                if (requested || version === this.connectionVersion) this.isBusy = false;
            }
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleExecute', 'ui-event');
        }
    }

    // 手動操作で実行結果を再取得
    handleRefresh() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 進行中の要求を重ねない
            if (!this.isBusy) {
                // 画面の権限とジョブをまとめて更新
                this.loadView();
            }
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleRefresh', 'ui-event');
        }
    }
}