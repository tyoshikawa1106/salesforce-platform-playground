import { LightningElement, api } from 'lwc';

// 標準のフォーカス管理は再実装せず、モーダルとの入出力だけをテストする。
export default class LightningModal extends LightningElement {
    @api label;
    @api disableClose = false;
    @api closeHandler;
    @api close(result) {
        if (!this.disableClose) {
            this.closeHandler?.(result);
        }
    }
    static open() {}
}
