import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import { createCompletionResult, createSaveError } from './objectRecordFormModalLogic';

// 標準モーダルのフォーカス管理下でレコード保存とアップロードを処理
export default class ObjectRecordFormModal extends LightningModal {
    // 親で権限確認した対象オブジェクトを標準フォームへ渡す
    @api objectApiName;
    // 操作結果の利用者向け名称を受け取る
    @api objectLabel;
    // 編集時だけ対象レコードを指定
    @api recordId;
    // 親がレイアウトと項目権限から構築した項目を受け取る
    @api formSections = [];
    // ContentDocumentでは標準アップロードへ切り替える
    @api isFileUpload = false;
    // 保存の重複実行と閉じる操作を抑止
    isSaving = false;
    // フォーム内で保存エラーを読み上げ可能にする
    errorMessage;

    // 入力検証を通過した場合だけ標準フォームの送信を許可
    handleSubmit(event) {
        // 進行中の保存へ追加送信しない
        if (this.isSaving) {
            event.preventDefault();
            return;
        }
        // 不正な項目をすべて表示し、最初のエラーで検証を止めない
        const isValid = [...this.template.querySelectorAll('lightning-input-field')].reduce(
            (valid, field) => field.reportValidity() && valid,
            true
        );
        // 標準フォームが不正な値を送信しないよう中止
        if (!isValid) {
            event.preventDefault();
            return;
        }
        // 再試行で以前のエラーを残さない
        this.errorMessage = undefined;
        // 保存完了まで送信ボタンを無効化
        this.isSaving = true;
        // 保存中は標準の閉じるボタンとEscapeによる破棄も抑止
        this.disableClose = true;
    }

    // 保存が確定した結果をモーダルの呼び出し元へ返す
    handleSuccess() {
        // 確定後は標準APIでモーダルを閉じられるようにする
        this.disableClose = false;
        // 作成と更新を区別した通知内容を返す
        this.close(createCompletionResult({ recordId: this.recordId, objectLabel: this.objectLabel }));
    }

    // 標準アップロードが完了した件数を呼び出し元へ返す
    handleUploadFinished(event) {
        // ファイル情報そのものは親へ持ち出さず登録件数を通知
        this.close(createCompletionResult({ files: event.detail?.files ?? [] }));
    }

    // 保存エラーをモーダル内で表示して再試行と閉じる操作を許可
    handleError(event) {
        // 再入力後の保存を可能にする
        this.isSaving = false;
        // Escapeと標準の閉じるボタンを再び有効にする
        this.disableClose = false;
        // UI APIのメッセージがなければ対象名を含む案内へフォールバック
        this.errorMessage = createSaveError(event.detail, this.objectLabel);
    }

    // 保存中以外のキャンセルだけ受け付ける
    handleCancel() {
        // disabledボタン以外からのイベントでも送信中の破棄を防止
        if (!this.isSaving) {
            this.close();
        }
    }
}