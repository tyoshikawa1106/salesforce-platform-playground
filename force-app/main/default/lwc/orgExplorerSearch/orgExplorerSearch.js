import { LightningElement, api } from 'lwc';
// ルックアップの表示と選択操作を親へ通知する表示部品。
export default class OrgExplorerSearch extends LightningElement {
    // 可視性を確認した候補だけを受け取る。
    @api results = [];
    // 同じルックアップでロールと上司を扱う。
    @api mode = 'ROLE';
    // 候補の絞り込み要否を親で管理する。
    @api hasMore = false;
    // 入力値を親と同期する。
    @api term = '';
    // 確定した候補を標準ルックアップの選択表示へ渡す。
    @api selectedTarget = null;
    // 候補の取得後の空状態を区別する。
    @api searched = false;
    // 最新の候補要求の状態を表示する。
    @api loading = false;
    // フォーカスのある間だけ候補を開く。
    _open = false;
    // DOMフォーカスは入力へ残して候補を移動する。
    _activeIndex = -1;
    // キーボードで移動した候補をスクロール範囲へ収める。
    _scrollActive = false;

    // モードに対応する入力ラベルを表示する。
    get lookupLabel() {
        // 上司はユーザーの氏名で選択する。
        return this.mode === 'MANAGER' ? '表示上司' : '表示ロール';
    }
    // 候補の種別に対応する標準アイコンを使用する。
    get lookupIcon() {
        // 独自の画像を追加しない。
        return this.mode === 'MANAGER' ? 'standard:user' : 'standard:hierarchy';
    }
    // 入力欄に検索対象を示す。
    get lookupPlaceholder() {
        // 検索対象をロールと混同させない。
        return this.mode === 'MANAGER' ? '上司を検索…' : 'ロールを検索…';
    }
    // 解除操作の対象を読み上げに含める。
    get clearLabel() {
        // 既存のロール用ラベルを維持する。
        return `${this.lookupLabel}の選択を解除`;
    }
    // 候補リストの対象を明示する。
    get candidatesLabel() {
        // モードに関係なくキーボード操作を共用する。
        return `${this.lookupLabel}の候補`;
    }
    // 候補アイコンの読み上げにも対象の種別を使用する。
    get entityLabel() {
        // 上司候補をロールと読み上げない。
        return this.mode === 'MANAGER' ? '上司' : 'ロール';
    }
    // 検索アイコンの読み上げ対象を現在のモードへ合わせる。
    get searchLabel() {
        // 入力欄とアイコンで検索対象を一致させる。
        return `${this.entityLabel}検索`;
    }
    // 候補の読み込み状態を表示する。
    get loadingLabel() {
        // 検索対象に対応する説明にする。
        return `${this.entityLabel}候補を検索中…`;
    }
    // 検索対象に一致する空結果の案内を表示する。
    get emptyLabel() {
        // 上司検索の空結果とロール検索を区別する。
        return `一致する${this.entityLabel}はありません。`;
    }
    // 候補上限では対象に応じた追加入力を案内する。
    get moreLabel() {
        // 上司は氏名、ロールは名称で絞り込みを促す。
        return this.mode === 'MANAGER'
            ? '氏名をさらに入力して候補を絞ってください。'
            : 'ロール名をさらに入力して候補を絞ってください。';
    }
    // 空欄と名前入力時で候補範囲が変わることを説明する。
    get lookupHelp() {
        // 初期値をログインユーザーに固定しない。
        return this.mode === 'MANAGER'
            ? '選択すると配下の上司を、未指定の場合はすべての上司を表示します。空欄では上位階層から最大20人、入力時は氏名前方一致で候補を表示します。'
            : '選択すると配下を、未指定の場合はすべてのロールを表示します。空欄でクリックすると最上位の候補、入力すると前方一致の候補を表示します。';
    }
    // キーボードで選んだ候補を再描画後にスクロールする。
    renderedCallback() {
        // キーボード操作時だけ選択候補を表示領域へ収める。
        if (this._scrollActive) {
            // 表示位置を継続して変更しない。
            this._scrollActive = false;
            // ドロップダウン内の選択候補だけをスクロールする。
            this.template
                .querySelector('[role="option"][aria-selected="true"]')
                ?.scrollIntoView?.({ block: 'nearest' });
        }
    }

    // デバウンスと検索処理は親へ委ねる。
    handleChange(event) {
        // 入力変更では以前の候補をキーボードで選択しない。
        this._activeIndex = -1;
        // 新しい候補が届いたときにドロップダウンを開く。
        this._open = true;
        // 入力途中では表示範囲を確定せず候補だけを絞り込む。
        this.dispatchEvent(new CustomEvent('searchchange', { detail: { value: event.target.value } }));
    }

    // 入力へ戻った場合は取得済みの候補を再表示する。
    handleInputFocus() {
        // 未入力でも上位ロールの候補を取得する。
        this._open = true;
        // 検索の実行管理は親へ委ねる。
        this.dispatchEvent(new CustomEvent('lookupopen'));
    }

    // 選択済みの表示を保ったまま上位ロールから候補を開く。
    handleSelectedOpen() {
        // 別候補の選択まで現在の名称を維持する。
        this._open = true;
        // 選択済み名称では絞らず上位から候補を取得する。
        this.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    }

    // 入力欄と候補の外へ移った場合は閉じる。
    handleBlur(event) {
        // 候補内の操作ではドロップダウンを閉じない。
        if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
        // 画面の別の操作に候補が重ならないようにする。
        this._open = false;
        // 次回の候補操作を未選択から始める。
        this._activeIndex = -1;
    }

    // クリック確定前に入力のフォーカスが外れるのを防ぐ。
    handleOptionMouseDown(event) {
        // 選択は後続のclickだけで確定する。
        event.preventDefault();
    }

    // 矢印・Enter・Escapeで標準ルックアップと同じ候補操作を提供する。
    handleKeyDown(event) {
        // IME変換中のキー操作は文字入力に任せ、候補の移動や確定に使用しない。
        if (event.isComposing) return;
        // Escapeは候補だけを閉じ、適用済みの起点は変えない。
        if (event.key === 'Escape') {
            event.preventDefault();
            this._open = false;
            this._activeIndex = -1;
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // 入力の標準動作と候補移動を重複させない。
            event.preventDefault();
            // 閉じた候補も矢印操作で開く。
            this._open = true;
            // 候補のない状態では選択位置を作らない。
            if (!this.results.length) return;
            // 再描画後に選択候補を表示範囲へ収める。
            this._scrollActive = true;
            // 上方向の初回操作は末尾、下方向は先頭へ移る。
            const step = event.key === 'ArrowDown' ? 1 : -1;
            // 候補内で循環し、範囲外のIDを選ばない。
            this._activeIndex =
                this._activeIndex < 0
                    ? step > 0
                        ? 0
                        : this.results.length - 1
                    : (this._activeIndex + step + this.results.length) % this.results.length;
        } else if (event.key === 'Enter' && this.showDropdown && this._activeIndex >= 0) {
            // Enterでは選択中の候補だけを確定する。
            event.preventDefault();
            // キーボードで指した可視候補を確定する。
            this.pickTarget(this.results[this._activeIndex]?.targetId);
        }
    }

    // マウスで選択した候補を親へ渡す。
    handlePick(event) {
        // 入力欄外の値を選択として扱わない。
        this.pickTarget(event.currentTarget.dataset.id);
    }

    // 表示候補の選択だけを通知する。
    pickTarget(targetId) {
        // 更新前の候補や不明なIDの操作を拒否する。
        if (!this.results.some((item) => item.targetId === targetId)) return;
        // 選択後は入力候補を閉じる。
        this._open = false;
        // 次の検索へ選択位置を引き継がない。
        this._activeIndex = -1;
        // 確定した候補の表示と検索は親へ委ねる。
        this.dispatchEvent(new CustomEvent('targetpick', { detail: { targetId } }));
    }

    // 選択を解除し、候補を閉じた未入力状態へ戻す。
    handleClear(event) {
        // 解除後や取得中の候補が届いた後も自動では開かない。
        this._open = false;
        // 候補の選択位置を初期化する。
        this._activeIndex = -1;
        // 解除ボタンからフォーカスを外し、入力への自動移動を行わない。
        event.currentTarget.blur();
        // 解除を通知し、親で全ロールの表示へ切り替える。
        this.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '' } }));
    }

    // 候補の強調状態だけを表示部品内で生成する。
    get options() {
        // 候補のIDと読み上げ対象を同じ値に揃える。
        return this.results.map((hit, index) => ({
            ...hit,
            domId: `role-option-${hit.targetId}`,
            selected: index === this._activeIndex,
            optionClass: `slds-media slds-listbox__option ${hit.description ? 'slds-listbox__option_entity slds-listbox__option_has-meta' : 'slds-listbox__option_plain'}${index === this._activeIndex ? ' slds-has-focus' : ''}`
        }));
    }

    // フォーカスと候補要求の状態から開閉を決める。
    get showDropdown() {
        // 候補未取得の検索中は空のポップアップを作らず、取得済み候補は表示する。
        return this._open && (this.results.length > 0 || (this.searched && !this.loading));
    }

    // 単一ロールが選択されている標準SLDSの状態を反映する。
    get containerClass() {
        // 入力欄と選択済み表示を同じ幅に揃える。
        return `slds-combobox_container${this.selectedTarget ? ' slds-has-selection' : ''}`;
    }

    // 標準SLDSの開閉スタイルを使用する。
    get comboboxClass() {
        // 独自の枠線や候補ボタンを重ねない。
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click${this.showDropdown ? ' slds-is-open' : ''}`;
    }

    // 展開時だけ存在するリストを参照する。
    get listboxId() {
        // 閉じた候補を読み上げの対象にしない。
        return this.showDropdown ? 'role-options' : null;
    }

    // 入力にフォーカスを残したまま現在の候補を読み上げる。
    get activeOptionId() {
        // 閉じた候補や更新前の位置を参照しない。
        return this.showDropdown && this.results[this._activeIndex]
            ? `role-option-${this.results[this._activeIndex].targetId}`
            : null;
    }

    // 検索完了後だけ空結果を示す。
    get empty() {
        // 読み込み途中を結果なしとして扱わない。
        return this.searched && !this.loading && this.results.length === 0;
    }
}
