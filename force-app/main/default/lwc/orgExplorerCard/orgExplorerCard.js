import { LightningElement, api } from 'lwc';

// カードは親の表示モデルを描画し、選択操作だけを通知する。
export default class OrgExplorerCard extends LightningElement {
    @api node;

    // 図の内部やページをスクロールせず、操作対象へフォーカスする。
    handlePointerDown(event) {
        // 右クリックや複数指による操作では標準動作を変更しない。
        if (event.button !== 0 || event.isPrimary === false) return;
        // 標準フォーカスによる表示位置の移動を止める。
        event.preventDefault();
        // キーボード操作を続けられるよう、フォーカス自体は維持する。
        event.currentTarget.focus({ preventScroll: true });
    }

    // カードの選択を親で一元管理する。
    handleSelect() {
        // 可視ノードのキーだけを渡す。
        this.dispatchEvent(
            new CustomEvent('nodeselect', { detail: { key: this.node.key }, bubbles: true, composed: true })
        );
    }
}