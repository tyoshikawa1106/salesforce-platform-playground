import { api } from 'lwc';
import LightningModal from 'lightning/modal';

// 削除の意思だけを親へ返し、資格情報の操作は親画面へ委ねる
export default class ExternalClientAppDeleteConfirm extends LightningModal {
    // 状態に合う操作名を見出しと確定ボタンへ表示する
    @api actionLabel;
    // 親が照合したアプリケーションを表示する
    @api applicationLabel;
    // 親が照合したステージを表示する
    @api stageId;
    // 操作名を含む確認タイトルを表示する
    @api heading;

    // 実行せず閉じる
    handleCancel() {
        // キャンセルを親の確認待ちへ返す
        this.close(false);
    }

    // 赤い操作ボタンで明示された実行の意思を返す
    handleConfirm() {
        // 削除要求の送信は親が担当する
        this.close(true);
    }
}