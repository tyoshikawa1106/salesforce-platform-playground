import LightningModal from 'lightning/modal';

// 親画面へ削除開始の確認結果だけを返す表示部品
export default class AccountDeleteConfirm extends LightningModal {
    // 削除を開始せず確認画面を閉じる
    handleCancel() {
        // 親画面へ明示的なキャンセルを通知
        this.close(false);
    }

    // 親画面へ実行の意思を返す
    handleConfirm() {
        // Apexの起動は親画面へ委譲
        this.close(true);
    }
}