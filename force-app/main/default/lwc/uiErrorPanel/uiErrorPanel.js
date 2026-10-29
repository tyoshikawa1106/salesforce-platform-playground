import { LightningElement, api } from 'lwc';

// 親画面が安全な固定項目へ変換した診断だけを表示する内部部品
export default class UiErrorPanel extends LightningElement {
    // API応答や入力値ではなく、処理場所と例外種別の表示モデル
    @api details;

    // 診断を閉じる操作だけを親へ通知
    handleDismiss() {
        // 業務上のエラーや編集中データの解除は親画面でも行わない
        this.dispatchEvent(new CustomEvent('dismiss'));
    }
}
