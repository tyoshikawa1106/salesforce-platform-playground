import { clientErrorDetails } from './accountDeleteConfirmLogic';
import LightningModal from 'lightning/modal';

// 親画面へ削除開始の確認結果だけを返す表示部品
export default class AccountDeleteConfirm extends LightningModal {
    // 診断表示は失敗時だけ生成し、成功ログは保持しない
    clientError;

    // 明示的に捕捉した例外を本文なしの診断へ変換
    reportClientError(error, operation, phase) {
        // この画面専用のLogicで固定の処理位置を生成
        const details = clientErrorDetails(error, operation, phase);
        // 同じ描画失敗の再通知で表示と記録を繰り返さない
        if (this.clientError?.location === details.location && this.clientError.errorType === details.errorType
            && this.clientError.frames.join('|') === details.frames.join('|') && this.clientError.code === details.code) { return; }
        // 画面内の表示へ診断だけを渡す
        this.clientError = details;
        // 元のError・メッセージ・API応答・入力値をコンソールへ渡さない
        console.error('LWC: 画面処理でエラーが発生しました。', details);
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
