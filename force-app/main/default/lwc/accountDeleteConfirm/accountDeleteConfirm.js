import { recordLog } from 'c/lwcLoggerUtils';
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