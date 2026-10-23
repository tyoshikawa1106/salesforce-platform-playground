import { LightningElement, api } from 'lwc';
// 親が取得した所属一覧を読み取り専用で表示する。
export default class OrgExplorerDetails extends LightningElement {
    // 見出しの括弧内に選択対象を表示する。
    @api targetLabel = '';
    // ロール所属と上司配下の表示を切り替える。
    @api mode = 'ROLE';
    // 現在のページだけを表示する。
    @api rows = [];
    // 現在ページより前の取得件数を標準表の通し番号へ反映する。
    @api rowNumberOffset = 0;
    // サーバーで参照が許可された列だけを表示する。
    @api columns = [];
    // 取得中とゼロ件の案内を区別する。
    @api loading = false;
    // 失敗を対象ユーザーなしとして扱わない。
    @api error = '';
    // 対象未選択では空の括弧を表示しない。
    get heading() {
        // 選択したロール名または上司名を見出しへ補足する。
        return this.targetLabel ? `${this.listLabel} (${this.targetLabel})` : this.listLabel;
    }
    // 両モードの一覧名称を統一する。
    get listLabel() {
        // 対象の種別によらずメンバーと表示する。
        return 'メンバー';
    }
    // 空一覧と未選択を区別して案内する。
    get emptyMessage() {
        // 表示条件の対象を明示する。
        return 'この条件で表示できるメンバーはいません。';
    }
    // 起点カードを選ぶ操作を案内する。
    get selectionMessage() {
        // 上司とロールで対象名称を切り替える。
        return this.mode === 'MANAGER' ? '組織図から上司を選択してください。' : '組織図からロールを選択してください。';
    }
    // 空状態では表の代わりに案内を表示する。
    get hasRows() {
        // 親から渡された現在のページだけを確認する。
        return this.rows.length > 0;
    }
}