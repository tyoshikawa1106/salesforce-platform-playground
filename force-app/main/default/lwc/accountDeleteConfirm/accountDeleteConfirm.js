import { withUiErrorBoundary } from 'c/uiErrorBoundary';
import LightningModal from 'lightning/modal';

// 親画面へ削除開始の確認結果だけを返す表示部品
export default class AccountDeleteConfirm extends withUiErrorBoundary(LightningModal, 'accountDeleteConfirm') {
    // 削除を開始せず確認画面を閉じる
    handleCancel() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 親画面へ明示的なキャンセルを通知
            this.close(false);
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleCancel', 'ui-event');
        }
    }

    // 親画面へ実行の意思を返す
    handleConfirm() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // Apexの起動は親画面へ委譲
            this.close(true);
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleConfirm', 'ui-event');
        }
    }
}
