import { LightningElement } from 'lwc';
import getView from '@salesforce/apex/AccountDeleteController.getView';
import startRun from '@salesforce/apex/AccountDeleteController.startRun';
import AccountDeleteConfirm from 'c/accountDeleteConfirm';
import { createDeleteView } from './accountDeleteLogic';

// 取引先一括削除の確認・受付・結果表示を管理
export default class AccountDelete extends LightningElement {
    // 最新のサーバー応答を保持
    response;
    // 初回読み込みを含む通信中の操作を抑止
    isBusy = true;
    // 画面へ表示する安全な通信エラー
    errorMessage = '';
    // この画面で受け付けた、または実行中に確認したジョブを保持
    acceptedJobId = '';

    // 配置時に現在の権限とジョブを確認
    connectedCallback() {
        // 初期画面を取得結果から構成
        this.loadView();
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
        // 読み込み中は開始操作を抑止
        this.isBusy = true;
        // 前回の通信エラーを解除
        this.errorMessage = '';
        // 受付済み状態を残したまま再取得
        try {
            // サーバーから現在の応答を取得
            this.response = await getView({ jobId: this.acceptedJobId || null });
            // この画面で確認した実行中ジョブを、完了後も追跡する
            if (!this.acceptedJobId && this.view.hasRun) {
                this.acceptedJobId = this.view.jobId;
            }
        } catch {
            // 内部の例外内容を画面へ転記しない
            this.errorMessage = '実行状態を取得できませんでした。権限を確認し、「実行状況を確認」を押してください。';
            // 不明な権限状態で開始を許可しない
            this.response = undefined;
        } finally {
            // 再取得操作を可能にする
            this.isBusy = false;
        }
    }

    // 確認モーダルを経由して削除を受付
    async handleExecute() {
        // 無効な状態のイベントや連打を無視
        if (!this.view.canStart) {
            // 現在の画面を保持
            return;
        }
        // モーダルを重複して開かない
        this.isBusy = true;
        // 新しい操作のエラーだけを表示
        this.errorMessage = '';
        // 確認と開始要求を順に実行
        try {
            // 標準モーダルのフォーカス・Escape処理を利用
            const confirmed = await AccountDeleteConfirm.open({ size: 'small', label: '取引先の削除確認' });
            // キャンセルや閉じる操作ではApexを呼び出さない
            if (confirmed !== true) {
                // 状態変更なしで元の画面へ戻る
                return;
            }
            // 最終的な環境・権限・重複判定をApexへ委譲
            this.response = await startRun();
            // ジョブIDがある場合だけ受付済みとして扱う
            this.acceptedJobId = this.response?.jobId || '';
        } catch {
            // 受付の成否を断定せず再確認を案内
            this.errorMessage = '受付結果を確認できませんでした。「実行状況を確認」を押し、Apexジョブを確認してください。';
            // 応答欠落時に無条件で再実行を許可しない
            this.response = undefined;
        } finally {
            // 通信終了後の状態更新を許可
            this.isBusy = false;
        }
    }

    // 手動操作で実行結果を再取得
    handleRefresh() {
        // 進行中の要求を重ねない
        if (!this.isBusy) {
            // 画面の権限とジョブをまとめて更新
            this.loadView();
        }
    }
}