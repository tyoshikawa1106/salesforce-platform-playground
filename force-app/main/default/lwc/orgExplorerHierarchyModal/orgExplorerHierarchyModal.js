import { api } from 'lwc';
import LightningModal from 'lightning/modal';

// ロール一覧の表示と選択結果の返却だけを担当する。
export default class OrgExplorerHierarchyModal extends LightningModal {
    // 親で可視性と直下条件を確認済みの表示モデルを受け取る。
    @api hierarchy;

    // 表示中の行に対応するキーだけを親へ返す。
    handleSelect(event) {
        // 選択ボタンと表示モデルを同じキーで照合する。
        const key = event.currentTarget.dataset.key;
        // 一覧にないキーは選択結果として採用しない。
        if (this.hierarchy.children.some((child) => child.key === key)) this.close(key);
    }

    // 表示対象を変更せず標準モーダルを閉じる。
    handleClose() {
        // キャンセル結果を親へ返す。
        this.close();
    }
}