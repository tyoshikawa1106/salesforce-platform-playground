import { LightningElement, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import NAME from '@salesforce/schema/User.Name';
import USERNAME from '@salesforce/schema/User.Username';
import EMAIL from '@salesforce/schema/User.Email';
import { getSourceRows } from './userCreateAssistantLogic';

// 氏名に加えてログイン用のユーザー名からも候補を検索
const MATCHING_INFO = { primaryField: { fieldPath: 'Name' }, additionalFields: [{ fieldPath: 'Username' }] };
// 同姓同名の候補をユーザー名で区別
const DISPLAY_INFO = { primaryField: 'Name', additionalFields: ['Username'] };

// 新規ユーザーを作成する際の参照元を選択
export default class UserCreateAssistant extends LightningElement {
    // 未選択時はレコードの取得を保留
    sourceId;
    // 基本コンポーネントに検索条件を渡す
    matchingInfo = MATCHING_INFO;
    // 基本コンポーネントに候補の表示項目を渡す
    displayInfo = DISPLAY_INFO;

    // 閲覧できる項目だけを現在の選択に応じて取得
    @wire(getRecord, { recordId: '$sourceId', fields: [NAME], optionalFields: [USERNAME, EMAIL] })
    source;

    // 選択・解除を同じ検索欄から受け付ける
    handleSourceChange(event) {
        // 解除時は取得条件とプレビューを同時にリセット
        this.sourceId = event.detail.recordId || undefined;
    }

    // 取得済みの項目を参照元の確認欄へ渡す
    get rows() {
        // 選択変更前のレコードは表示しない
        return getSourceRows(this.sourceId, this.source.data);
    }

    // 現在の選択に対応する表示項目の取得完了を判定
    get hasRows() {
        // 空の表示枠を残さず、読み込み中の表示に切り替える
        return this.rows.length > 0;
    }
}
