import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import { matchesApplicationId } from './externalClientAppCredentialModalLogic';

// 入力エラーをモーダル内に留め、一致したIDだけを親へ返す
export default class ExternalClientAppCredentialModal extends LightningModal {
    // 親で正規化した18桁の対象IDを照合に使用する
    @api expectedId;
    // 利用者が適用対象を識別できる名称を受け取る
    @api applicationLabel;
    // 確認IDは毎回空欄から入力する
    confirmationId = '';

    handleChange(event) {
        // 入力値を秘密情報と混同せず確認用途だけに保持する
        this.confirmationId = event.target.value;
        // 修正中の古いエラーを解除する
        event.target.setCustomValidity('');
        // 入力欄の表示を最新にする
        event.target.reportValidity();
    }

    handleSubmit() {
        // 標準入力欄のエラー表示を利用する
        const input = this.template.querySelector('lightning-input');
        // 不一致の理由をモーダル内の入力欄へ関連付ける
        const valid = matchesApplicationId(this.confirmationId, this.expectedId);
        // 不一致のままモーダルを閉じない
        input.setCustomValidity(valid ? '' : '選択したアプリのIDと一致する15桁または18桁のIDを入力してください。');
        // エラーを入力欄の直下に表示する
        input.reportValidity();
        // 検証済みの入力だけを更新処理へ渡す
        if (valid) this.close(this.confirmationId.trim());
    }

    handleCancel() {
        // キャンセルでは生成・適用へ進めない
        this.close();
    }
}
