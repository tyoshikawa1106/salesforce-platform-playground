import { LightningElement, api } from 'lwc';

// 候補の取得や画面遷移は親が担当し、入力と候補の表示だけを扱う
export default class ObjectExplorerLookup extends LightningElement {
    @api selected;
    @api selectedLabel = '';
    @api term = '';
    @api disabled = false;
    @api loading = false;
    @api candidatesOpen = false;
    @api activeObjectOptionId;
    @api candidateView = { items: [], topStyle: '', bottomStyle: '' };
    @api candidateScrollTop = 0;
    appliedScrollTop;

    // キーボードで選択した候補を可視領域へ移動
    renderedCallback() {
        // 親が指定した位置が変わった時だけスクロールを同期
        if (this.appliedScrollTop !== this.candidateScrollTop) {
            // 表示中の候補領域を取得
            const list = this.template.querySelector('.oe-option-scroll');
            // ドロップダウンが開いた後に位置を反映
            if (list) {
                // 候補の仮想表示とDOMの位置を揃える
                list.scrollTop = this.candidateScrollTop;
                // 自然なスクロールを次の描画で戻さない
                this.appliedScrollTop = this.candidateScrollTop;
            }
        }
    }

    // 入力した検索語を親へ通知
    handleSearch(event) {
        // 取得処理は親の要求世代で制御
        this.dispatchEvent(new CustomEvent('searchchange', { detail: { value: event.target.value } }));
    }

    // 空欄クリックによる候補表示を親へ通知
    handleSearchClick() {
        // フォーカス移動だけでは検索を開始しない
        this.dispatchEvent(new CustomEvent('lookupopen'));
    }

    // ネイティブキー操作と候補移動の座標を親へ通知
    handleSearchKey(event) {
        // IME変換中は候補を確定しない
        if (event.isComposing || this.disabled || this.selected) { return; }
        // 対応するキーだけブラウザ標準の移動を抑止
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) { event.preventDefault(); }
        // 候補の現在の表示領域を取得
        const list = this.template.querySelector('.oe-option-scroll');
        // DOMを親へ渡さず必要な座標だけを通知
        this.dispatchEvent(new CustomEvent('searchkey', { detail: { key: event.key, scrollTop: list?.scrollTop, height: list?.clientHeight } }));
    }

    // 選択した候補のAPI名を親へ通知
    handleCandidate(event) {
        // 表示した候補以外の入力は親でも検証
        this.dispatchEvent(new CustomEvent('candidatepick', { detail: { apiName: event.currentTarget.dataset.name } }));
    }

    // 対象解除の確認と状態変更を親へ委譲
    handleClearObject() {
        // 破棄確認後にだけ親が選択状態を変更
        this.dispatchEvent(new CustomEvent('clear'));
    }

    // 候補外へのフォーカス移動を通知
    handleSearchBlur(event) {
        // 同じ候補内の移動は維持
        if (event.currentTarget.contains(event.relatedTarget)) { return; }
        // 未確定の候補を閉じる
        this.dispatchEvent(new CustomEvent('lookupclose'));
    }

    // 候補クリック中も入力欄のフォーカスを維持
    handleOptionMouseDown(event) {
        // スクロール領域全体の操作は妨げない
        if (event.target.closest('[role="option"]')) { event.preventDefault(); }
    }

    // 仮想表示に必要な座標だけを親へ通知
    handleCandidateScroll(event) {
        // DOM要素はコンポーネントの外へ渡さない
        this.dispatchEvent(new CustomEvent('candidatescroll', { detail: { top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight } }));
    }

    // 選択状態をSLDSのコンテナーへ反映
    get lookupContainerClass() { return `slds-combobox_container${this.selected ? ' slds-has-selection' : ''}`; }
    // 候補の開閉だけを表示へ反映
    get lookupComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click${this.candidatesOpen ? ' slds-is-open' : ''}`; }
    // 開いている候補だけを入力の参照先にする
    get objectListboxId() { return this.candidatesOpen ? 'object-options' : null; }
    // 仮想表示済みの候補を使用
    get lookupOptions() { return this.candidateView.items; }
    // 上側の未描画行を空間として維持
    get candidateTopStyle() { return this.candidateView.topStyle; }
    // 下側の未描画行を空間として維持
    get candidateBottomStyle() { return this.candidateView.bottomStyle; }
    // 検索完了後の候補なしを通知
    get noCandidates() { return !this.loading && !this.candidateView.items.length; }
}
