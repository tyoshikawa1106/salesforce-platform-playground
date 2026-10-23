import LightningDatatable from 'lightning/datatable';
import checkboxTemplate from './readOnlyCheckbox.html';
import emailTemplate from './readOnlyEmail.html';

// 標準表の配置を維持し、参照専用のチェックとアイコンなしのメールを表示する。
export default class OrgExplorerDatatable extends LightningDatatable {
    // 編集を提供せず、標準セルの配置と読み上げを引き継ぐ。
    static customTypes = {
        readOnlyEmail: {
            template: emailTemplate,
            standardCellLayout: true
        },
        readOnlyCheckbox: {
            template: checkboxTemplate,
            standardCellLayout: true,
            typeAttributes: ['label']
        }
    };
}