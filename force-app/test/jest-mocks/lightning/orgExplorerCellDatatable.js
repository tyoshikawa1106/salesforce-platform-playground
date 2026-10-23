import { LightningElement, api } from 'lwc';

// 標準表が渡すセル値と属性を再現して実際のカスタムテンプレートを検証する。
export default class Datatable extends LightningElement {
    @api data = [];
    @api columns = [];
    // 標準表のナビゲーションモードと操作モードを再現する。
    @api internalTabIndex = -1;
    // 先頭セルを現在のページのデータへ追従させる。
    @api
    get value() {
        return this.data[0]?.[this.columns[0]?.fieldName || 'isActive'];
    }
    // ラベルは項目定義から生成した列属性をそのまま受け渡す。
    get typeAttributes() {
        return this.columns[0]?.typeAttributes || {};
    }
    // カスタムセルのテンプレートをテスト用ホストで描画する。
    render() {
        return this.constructor.customTypes[this.columns[0]?.type || 'readOnlyCheckbox'].template;
    }
}
