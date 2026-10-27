import { LightningElement } from 'lwc';
import locale from '@salesforce/i18n/locale';
import timeZone from '@salesforce/i18n/timeZone';
import hasCustomizeApplication from '@salesforce/userPermission/CustomizeApplication';
import LightningConfirm from 'lightning/confirm';
import getClassifications from '@salesforce/apex/ObjectExplorerController.getClassifications';
import saveClassifications from '@salesforce/apex/ObjectExplorerController.saveClassifications';
import searchClassificationOwners from '@salesforce/apex/ObjectExplorerController.searchClassificationOwners';
import resolveClassificationOwners from '@salesforce/apex/ObjectExplorerController.resolveClassificationOwners';
import searchObjects from '@salesforce/apex/ObjectExplorerController.searchObjects';
import getObjectInfo from '@salesforce/apex/ObjectExplorerController.getObjectInfo';
import getFieldAudit from '@salesforce/apex/ObjectExplorerController.getFieldAudit';
import { CLASSIFICATION_CSV_LIMITS, classificationOwnerBatches, mergeClassificationOwners, classificationCsv, structureCsv, structureFieldView, csvFileName, readClassificationCsv, applyClassificationCsv, fieldListView, classificationSummary, visibleRelations, buildRelationBoard, classificationBatches, applyClassificationBatch, classificationFieldView, createClassificationEdits, classificationChanges, createOwnerOptions, classificationInput, objectOptionWindow, objectOptionScrollTop, objectOptionStart } from './objectExplorerLogic';

// 固定ヘッダー内で一度に表示する項目数
const FIELD_PAGE_SIZE = 400;

// 起点の探索と選択オブジェクトの詳細を制御
export default class ObjectExplorer extends LightningElement {
    // 初期状態は参照専用
    mode = 'reference';
    // オブジェクト選択を共用する二つの作業モード
    modeOptions = [{ label: 'オブジェクト構造', value: 'reference' }, { label: 'データ分類設定', value: 'classification' }];
    // 編集変更時だけ算出する件数を保持
    changeCount = 0;
    // 確定できない入力がある間は保存を許可しない
    inputErrorCount = 0;
    // 項目定義と検索条件に対応する整列済み一覧を保持
    fieldView;
    // 構造の日時・ユーザー名は条件変更時だけ整形して保持
    structureView;
    // 分類の元データを項目API名で保持
    classifications = {};
    // ページや検索条件を変えても編集値を保持
    classificationState = {};
    // 分類の表示モデルは現在のページに限定して保持
    classificationView;
    // 分類候補は組織の定義から取得
    classificationOptions = { ComplianceGroup: [], SecurityClassification: [], BusinessStatus: [] };
    // 未取得や失敗時は分類を編集できないようにする
    classificationsReady = false;
    // 保存処理中は編集と画面遷移を固定
    saving = false;
    // 保存要求ごとの確認済み成功数
    saveSuccessCount = 0;
    // 保存要求ごとの確認済み失敗数
    saveFailureCount = 0;
    // 処理結果と進捗の案内
    classificationNotice = '';
    // CSVの検証エラーは既存の編集値と分けて保持
    csvErrors = [];
    // 古い分類読取の反映を抑止
    classificationSequence = 0;
    // 古い所有者検索の反映を抑止
    ownerSequence = 0;
    // 必須の起点と詳細を別々に保持
    root;
    // 下部で表示する選択先の詳細
    detail;
    // 同じ相手でも参照方向ごとに選択を区別
    selectedKey = 'root';
    // 起点が変わるまで整列済みの関連を共有
    relations = [];
    // 関連の再生成が必要な起点の参照を保持
    relationSource;
    // 参照元は初期表示で単一参照先の通常項目だけにする
    incomingKind = 'standard';
    incomingKindOptions = [{ label: '通常の参照', value: 'standard' }, { label: '多態参照', value: 'polymorphic' }];
    // 対象が同じでも参照の種類が変わった場合は関連を再生成
    incomingKindSource;
    // 方向別の全カードを保持
    board = { incoming: [], outgoing: [] };
    incomingTerm = '';
    outgoingTerm = '';
    // 検索結果を標準候補UIへ渡す
    objectOptions = [];
    // オブジェクト検索語を保持
    objectTerm = '';
    // 初期候補は標準オブジェクト
    objectScope = 'standard';
    // 入力欄の候補を開閉
    candidatesOpen = false;
    // 候補の強調位置を入力フォーカスと分離
    activeCandidateIndex = -1;
    // 候補全体のスクロール位置から描画する範囲を決定
    candidateScrollTop = 0;
    // 候補の余白と行のモデルを入力変更時だけ生成
    candidateView = objectOptionWindow([], -1, 0);
    // キーボードで移動した候補だけを表示範囲へ収める
    scrollActiveCandidate = false;
    // 候補取得中と該当なしを区別
    candidatesBusy = false;
    // 検索範囲の選択肢を固定
    scopeOptions = [{ label: '標準', value: 'standard' }, { label: 'カスタム', value: 'custom' }];
    // 項目ラベルとAPI名に共通の検索語を保持
    fieldSearch = '';
    // 新しい選択の一覧を描画後に案内
    revealFields = false;
    // データ型の初期値はすべて
    fieldType = '';
    // 項目のページ位置を保持
    fieldPage = 1;
    // 通信中は起点変更の二重実行を抑止
    busy = false;
    // 起点の取得中だけ古い関連図を非表示にする
    rootLoading = false;
    // 読み取り失敗を画面へ通知
    error = '';
    // 古い検索応答の上書きを防止
    searchSequence = 0;
    // 古い詳細応答の上書きを防止
    detailSequence = 0;
    // 絞り込み結果を保持し、ページ移動時の全件再計算を避ける
    filtered = [];
    // データ型の候補を項目取得時に生成
    typeOptions = [{ label: 'すべてのデータ型', value: '' }];
    // 画面幅の変化を監視し、配置だけを更新する
    resizeObserver;
    // 実際の表示領域に合わせて左右の列数を切り替える
    narrowRelations = false;
    // カード内容と検索条件が同じ場合は全カードの再測定を省く
    cardHeightSource;
    // 最後に測定した表示幅を保持
    cardHeightWidth;
    // 描画後に表示領域のサイズ変更を監視
    renderedCallback() {
        // 入力フォーカスを保ったまま強調した候補を見える位置へ移動
        if (this.scrollActiveCandidate) {
            // 通常の再描画でスクロールを繰り返さない
            this.scrollActiveCandidate = false;
            // 描画済みの候補だけを表示範囲へ収める
            const list = this.template.querySelector('.oe-option-scroll');
            // 描画範囲を更新した後で実際のスクロール位置を同期
            if (list) { list.scrollTop = this.candidateScrollTop; }
        }
        // 選択先の一覧がDOMへ反映された後に移動
        if (this.revealFields && this.detail) {
            // 再描画のたびに画面を移動しない
            this.revealFields = false;
            // キーボード操作の続きも一覧から行えるようにする
            const heading = this.template.querySelector('.oe-detail-title');
            // 非同期取得後の最新オブジェクト見出しへ案内
            heading?.focus({ preventScroll: true });
            // 図の下にある項目一覧を確実に見える位置へ置く
            heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // 分類モードや起点取得中は表示幅の監視を解除
        if (!this.isReference || this.rootLoading) { this.resizeObserver?.disconnect(); this.resizeObserver = undefined; return; }
        // 描画済みの参照元・起点・参照先を最も高いカードへ揃える
        this.syncCardHeights();
        if (this.resizeObserver) { return; }
        this.resizeObserver = new ResizeObserver((entries) => {
            // 列数を変える場合は再描画後のDOMで測定
            const narrow = entries[0].contentRect.width < 1152;
            // 変更前の列幅を次の測定結果として保存しない
            if (this.narrowRelations !== narrow) {
                // 同じカードでも新しい列幅で測定し直す
                this.cardHeightSource = undefined;
                // 列数変更の描画を先に完了させる
                this.narrowRelations = narrow;
                // 描画後の共通経路で高さを揃える
                return;
            }
            // 列数が変わらない幅変更も高さへ反映
            this.syncCardHeights();
        });
        const viewport = this.template.querySelector('.oe-viewport');
        if (viewport) { this.resizeObserver.observe(viewport); }
    }
    // 全カードの自然な高さを測り、最大値へ統一
    syncCardHeights() {
        // 項目一覧の入力やページ変更ではカードの高さを再計算しない
        const width = this.template.querySelector('.oe-viewport')?.clientWidth;
        // 選択のハイライトは自然な高さを変えないため再測定しない
        const source = this.cardHeightSource;
        // 内容・表示条件・幅が変わった場合だけ共通高さを更新
        if (source?.root === this.root && source?.relations === this.relations && source?.incomingTerm === this.incomingTerm && source?.outgoingTerm === this.outgoingTerm && this.cardHeightWidth === width) { return; }
        // 検索結果に含まれる左右のカードと起点を同じ基準で測る
        const cards = [...this.template.querySelectorAll('.oe-node')];
        // 前回の固定値を外し、画面幅や検索結果に応じた自然な高さへ戻す
        cards.forEach((card) => { card.style.height = ''; });
        // 全件の読み取りをまとめ、測定中の書き込みを避ける
        const height = Math.ceil(Math.max(0, ...cards.map((card) => card.getBoundingClientRect().height)));
        // 全行と一行分の余白を収める最大の高さに揃える
        cards.forEach((card) => { card.style.height = `${height}px`; });
        // ハイライトを除いた表示内容の依存元を保持
        this.cardHeightSource = { root: this.root, relations: this.relations, incomingTerm: this.incomingTerm, outgoingTerm: this.outgoingTerm };
        // 同じカードでも幅が変われば再測定
        this.cardHeightWidth = width;
    }
    // 画面を離れた後に監視を残さない
    disconnectedCallback() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
    }
    // 方向別のカードモデルを検索条件と選択状態へ同期
    layoutBoard() {
        this.board = this.root ? buildRelationBoard(this.root, this.relations, this.selectedKey, this.incomingTerm, this.outgoingTerm)
            : { incoming: [], outgoing: [] };
    }
    // 検索は左右それぞれに適用し、項目一覧の選択を変更しない
    handleRelationFilter(event) {
        if (event.target.name === 'incoming') { this.incomingTerm = event.target.value; }
        else { this.outgoingTerm = event.target.value; }
        this.layoutBoard();
    }
    // 起点変更を一つの通信単位で管理
    async loadRoot(name, revealDetail = true) {
        // 未指定の起点や通信中の重複変更を拒否
        if (!name || this.busy) { return; }
        // オブジェクト変更前に未保存の編集を確認
        if (!(await this.confirmDiscard())) { return; }
        // 初期表示以外では取得完了後に項目一覧へ案内
        const revealFields = Boolean(this.root) && revealDetail;
        // 図と詳細の更新中を表示
        this.busy = true;
        // 古い図を外して起点の取得を案内
        this.rootLoading = true;
        // 古いエラーを解除
        this.error = '';
        // 遅延した詳細取得を無効化
        this.detailSequence += 1;
        // 前の対象の分類読取も破棄
        this.classificationSequence += 1;
        // 古い検索応答と候補リストを閉じる
        this.closeCandidates();
        // 変更前の対象と項目一覧を読み込み開始時にクリア
        this.root = undefined;
        // 古い項目や関連情報を残さない
        this.detail = undefined;
        // 古いカードを表示データからも除去
        this.board = { incoming: [], outgoing: [] };
        this.incomingTerm = '';
        this.outgoingTerm = '';
        // 適用前の対象名を入力に残さない
        this.objectTerm = '';
        // 旧対象の候補を選択できない状態にする
        this.options = [];
        // 次の取得成功まで分類を未取得として扱う
        this.classifications = {};
        // 新しい対象の分類を取得するまで編集させない
        this.classificationsReady = false;
        // 前の対象の処理結果を持ち越さない
        this.classificationNotice = '';
        // 前の対象のCSVエラーを持ち越さない
        this.csvErrors = [];
        // 古い関連と派生一覧・件数・型候補をクリア
        this.rebuild();
        // 読み取り結果で画面全体を更新
        try {
            // 起点に必要な構造を取得
            const data = await this.readObjectInfo(name);
            // 初期読み込み以外では選択先の項目一覧を表示
            this.revealFields = revealFields;
            // 新しい起点を保持
            this.root = data;
            // 起点を最初の選択カードにする
            this.detail = data;
            // 起点の選択状態を新しい図へ合わせる
            this.selectedKey = 'root';
            // 起点変更前の検索応答を無効化
            this.searchSequence += 1;
            // 選択後は候補を閉じる
            this.candidatesOpen = false;
            // 破棄した候補要求の読み込み表示も解除
            this.candidatesBusy = false;
            // 起点変更で検索とページ位置をリセット
            this.fieldSearch = '';

            // 新しいオブジェクトのすべての型を表示
            this.fieldType = '';
            // 項目一覧を先頭へ戻す
            this.fieldPage = 1;
            // 関連カードと項目一覧を再構築
            this.rebuild();
            // 分類モードでは選択先の分類も取得
            if (!this.isReference) { await this.loadClassifications(); }
        } catch (error) {
            // Apexの公開メッセージだけを表示
            this.error = error.body?.message || 'オブジェクト構造を取得できませんでした。';
        } finally {
            // 成功・失敗のどちらでも確定した図の表示へ戻す
            this.rootLoading = false;
            // 次の探索操作を許可
            this.busy = false;
        }
    }
    // 構造モードだけで項目定義の作成・更新情報を取得
    async readObjectInfo(name, scope = this.mode) {
        // 構造と参照可否を従来の取得元で確定
        const data = JSON.parse(await getObjectInfo({ objectName: name, mode: scope }));
        // 分類モードと可視カスタム項目がない場合は日時取得のApex要求を省略
        if (!this.isReference || !data.fields.some((field) => field.custom)) { return data; }
        try {
            // 日時とユーザー名は項目API名に対応する同じ応答から取得
            const audit = JSON.parse(await getFieldAudit({ objectName: data.apiName }));
            // 表示対象の項目へだけ取得値を合成
            return { ...data, fields: data.fields.map((field) => ({ ...field, ...(Object.hasOwn(audit, field.apiName) ? audit[field.apiName] : {}) })) };
        } catch (error) {
            // 構造の閲覧は継続し、情報未取得を成功と見せない
            return { ...data, auditNotice: error.body?.message || '項目の作成・更新情報を取得できませんでした。API連携設定と権限を確認してください。' };
        }
    }
    // 項目の日時取得に失敗した場合だけ構造一覧へ案内
    get auditNotice() { return this.isReference ? this.detail?.auditNotice : ''; }
    // 選択と関連フィルターを図へ反映
    rebuild() {
        // 起点が変わった場合だけ関連を生成
        this.refreshRelations();
        // 詳細の取得・選択変更に合わせて一覧を一度だけ更新
        this.refreshFields();
        // 起点取得後だけ描画モデルを生成
        this.layoutBoard();
    }
    // 図の初期候補と関連一覧で同じ整列済みデータを共有
    refreshRelations() {
        // ページやカードの選択だけでは関連を変換し直さない
        if (this.relationSource === this.root && this.incomingKindSource === this.incomingKind) { return; }
        // 図と一覧の関係候補を同じ配列へ確定
        this.relations = visibleRelations(this.root, this.incomingKind);
        // 対象やモード切り替えを同じ起点参照で判定
        this.relationSource = this.root;
        this.incomingKindSource = this.incomingKind;
    }
    // 入力値で候補を検索
    handleSearch(event) {
        // 入力語を保持し、起点の選択は候補の確定まで変えない
        if (this.root || this.busy) { return; }
        // 検索語は未選択時の入力だけから受け取る
        this.objectTerm = event.target.value;
        // 検索条件に合う候補を開く
        this.searchCandidates();
    }
    // 未選択の入力を明示的にクリックした場合だけ空欄候補も開く
    handleSearchClick() {
        // 現在の起点を変更せず候補を探せるようにする
        if (this.root || this.busy || this.candidatesOpen) { return; }
        // クリックは全候補の表示を明示した操作として扱う
        this.searchCandidates(true);
    }
    // 種別変更時は前の対象を解除して検索入力を待つ
    async handleScope(event) {
        // 非同期の確認中も操作元と選択値を保持
        const control = event.target;
        // 種別は対象の解除が確定してから反映
        const next = event.detail.value;
        // 同じ種別への重複操作では対象を解除しない
        if (next === this.objectScope) { return; }
        // 確認中は標準コントロール自身の選択表示も元へ戻す
        control.value = this.objectScope;
        // 解除ボタンと同じ未保存確認・状態クリアを適用
        const cleared = await this.handleClearObject();
        // キャンセルや取得中なら種別の表示も元へ戻す
        if (!cleared) { control.value = this.objectScope; return; }
        // 対象をクリアした後で新しい種別を確定
        this.objectScope = next;
        // 空欄では候補を開かず新しい種別の検索入力を待つ
    }
    // 入力フォーカスを残してSLDS候補の移動・確定を制御
    handleSearchKey(event) {
        // IME変換中や読み込み中の操作で選択を確定しない
        if (this.root || event.isComposing || this.busy) { return; }
        // Escapeは候補だけを閉じる
        if (event.key === 'Escape') { event.preventDefault(); this.closeCandidates(); return; }
        // 閉じた候補は矢印操作で取得
        if (!this.candidatesOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); this.searchCandidates(); return; }
        // 未取得の候補へ位置を対応づけない
        if (!this.candidatesOpen || !this.options.length) { return; }
        // Enterでは強調した候補、または唯一の候補だけを選択
        if (event.key === 'Enter') {
            // 選択対象を現在の候補配列から特定
            const option = this.options[this.activeCandidateIndex] || (this.options.length === 1 ? this.options[0] : undefined);
            // 未選択の複数候補は推測せず入力を維持
            if (!option) { return; }
            // 入力の送信より候補確定を優先
            event.preventDefault();
            // 候補のAPI名で起点を変更
            this.loadRoot(option.value);
            // 他のキー処理を続けない
            return;
        }
        // 矢印以外は通常の入力操作へ委ねる
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) { return; }
        // スクロールの代わりに候補を強調
        event.preventDefault();
        // 上方向の初回操作は末尾、下方向は先頭へ移動
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // 候補配列の範囲内で循環
        this.activeCandidateIndex = this.activeCandidateIndex < 0 ? (step > 0 ? 0 : this.options.length - 1) : (this.activeCandidateIndex + step + this.options.length) % this.options.length;
        // 現在の表示枠に合わせ、末尾への移動でも全件を描画しない
        const list = this.template.querySelector('.oe-option-scroll');
        // DOMの座標計算を候補の純粋な変換処理から分離
        this.candidateScrollTop = objectOptionScrollTop(this.activeCandidateIndex, list?.scrollTop ?? this.candidateScrollTop, list?.clientHeight || 280);
        // 行と上下余白を一つのモデルへ確定
        this.refreshCandidateWindow();
        // 描画後に強調した候補を見える位置へ移動
        this.scrollActiveCandidate = true;
    }
    // スクロールに合わせて表示位置付近の候補だけを描画
    handleCandidateScroll(event) {
        // 通常スクロールでもキーボード移動でも同じ座標を保持
        const top = event.currentTarget.scrollTop;
        // 同じ位置の通知では再描画しない
        if (top === this.candidateScrollTop) { return; }
        // 描画範囲内でも表示枠から外れた候補は確定対象から外す
        const active = this.activeCandidateIndex;
        // キーボード移動と同じ座標基準で可視性を確認
        const selectedVisible = active >= 0 && objectOptionScrollTop(active, top, event.currentTarget.clientHeight || 280) === top;
        // 非表示の選択を推測して保持しない
        const nextActive = selectedVisible ? active : -1;
        // 候補行を作り直す前に範囲の変更を確認
        const start = objectOptionStart(this.options.length, top);
        // 同じ候補範囲と強調状態なら変換も再描画もしない
        if (start === this.candidateView.start && nextActive === active) { return; }
        // 更新が必要な表示範囲だけを変換
        const window = objectOptionWindow(this.options, nextActive, top);
        // 新しい描画範囲を確定
        this.candidateScrollTop = top;
        // スクロールで見えなくなった候補をEnterで確定しない
        this.activeCandidateIndex = nextActive;
        // 表示行と余白を同時に反映
        this.candidateView = window;
    }
    // 候補クリックより先に入力フォーカスが外れるのを防止
    handleOptionMouseDown(event) {
        // 候補の確定はclickへ任せ、スクロールバーの操作は妨げない
        if (event.target.closest('[role="option"]')) { event.preventDefault(); }
    }
    // 必須の対象選択を解除して未選択の入力へ戻す
    async handleClearObject() {
        // 取得や保存の途中では適用対象を変更しない
        if (this.busy) { return false; }
        // 確認中に別の対象へ切り替わった場合は解除しない
        const root = this.root;
        // 未保存の分類があれば明示的な破棄を確認
        if (!(await this.confirmDiscard()) || this.busy || this.root !== root) { return false; }
        // 遅延した詳細・分類の応答を未選択状態へ反映しない
        this.detailSequence += 1;
        // 分類取得の対象世代も切り替える
        this.classificationSequence += 1;
        // 検索候補の応答と開閉状態を破棄
        this.closeCandidates();
        // 対象必須のため全オブジェクト表示には切り替えない
        this.root = undefined;
        // 前の対象の項目一覧を残さない
        this.detail = undefined;
        // 解除前の図を描画しない
        this.board = { incoming: [], outgoing: [] };
        this.incomingTerm = '';
        this.outgoingTerm = '';
        // 選択状態を未選択へ揃える
        this.selectedKey = 'root';
        // 検索入力を空へ戻す
        this.objectTerm = '';
        // 前の候補を新しい入力へ持ち越さない
        this.options = [];
        // 前の対象の分類データを破棄
        this.classifications = {};
        // 再選択・取得が終わるまで分類編集を拒否
        this.classificationsReady = false;
        // 前の処理案内を残さない
        this.classificationNotice = '';
        // 前の対象のCSVエラーを持ち越さない
        this.csvErrors = [];
        // 検索・ページ条件も対象と同時に解除
        this.fieldSearch = '';

        // 型の条件を解除
        this.fieldType = '';
        // 表示ページを先頭へ戻す
        this.fieldPage = 1;
        // 前の対象のエラーを残さない
        this.error = '';
        // 関連・項目・変更件数を空の対象に同期
        this.rebuild();
        // 呼び出し元は対象の解除が確定した場合だけ種別を変更
        return true;
    }
    // 候補以外へフォーカスを移したら候補を閉じる
    handleSearchBlur(event) {
        // 候補同士の移動ではリストを閉じない
        if (event.currentTarget.contains(event.relatedTarget)) { return; }
        // 未確定の検索を対象の変更と混同しない
        this.closeCandidates();
    }
    // 遅延応答を無効にして候補を閉じる
    closeCandidates() {
        // 次のフォーカス時に新しい候補を表示
        this.candidatesOpen = false;
        // 閉じた候補を強調対象として残さない
        this.activeCandidateIndex = -1;
        // 閉じた候補に強調状態を残さない
        this.refreshCandidateWindow();
        // 古い応答で候補を再表示しない
        this.searchSequence += 1;
        // 取り消した読み込み表示を残さない
        this.candidatesBusy = false;
    }
    // 範囲と検索語を同じリクエストへまとめる
    async searchCandidates(allowEmpty = false) {
        // 対象未指定の空欄や空白だけの入力で候補を自動表示しない
        if (!allowEmpty && !this.objectTerm.trim()) { this.closeCandidates(); this.options = []; this.candidatesBusy = false; return; }
        // 新しい条件の結果が来るまで古い候補を選べないようにする
        this.options = [];
        // 以前の検索の位置を新しい候補へ対応づけない
        this.activeCandidateIndex = -1;
        // 新しい検索は先頭から描画
        this.candidateScrollTop = 0;
        // 入力欄の下へ結果を表示
        this.candidatesOpen = true;
        // 要求ごとに応答の世代を固定
        const sequence = ++this.searchSequence;
        // 空候補の案内を取得完了まで待つ
        this.candidatesBusy = true;
        // 候補取得の失敗を画面へ通知
        try {
            // ラベル・API名と検索範囲で候補を取得
            const rows = JSON.parse(await searchObjects({ term: this.objectTerm, scope: this.objectScope }));
            // 別の検索や起点変更後に届いた結果を破棄
            if (sequence !== this.searchSequence) { return; }
            // キーボードでも選択できる候補ボタンへ変換
            this.options = rows.map((row) => ({ label: row.label, value: row.apiName }));
            // 検索結果の総数が減った場合もスクロールを先頭へ同期
            this.scrollActiveCandidate = true;
        } catch {
            // 古い失敗で現在の検索状態を上書きしない
            if (sequence !== this.searchSequence) { return; }
            // 空の検索結果と取得失敗を区別
            this.error = 'オブジェクト候補を取得できませんでした。';
        } finally {
            // 最新検索の取得中表示だけを解除
            if (sequence === this.searchSequence) { this.candidatesBusy = false; }
        }
    }
    // 候補をクリックまたはEnterで確定
    handleCandidate(event) {
        // 候補ボタンから起点を切り替える
        const name = event.currentTarget.dataset.name;
        // 現在の可視候補以外は選択として受け付けない
        if (!this.busy && this.options.some((option) => option.value === name)) { this.loadRoot(name); }
    }
    // 選択済み対象の表示をSLDS入力内へまとめる
    get selectedObjectLabel() { return this.root?.label || ''; }
    // 選択中のルックアップをSLDSの選択表示へ切り替える
    get lookupContainerClass() { return `slds-combobox_container${this.root ? ' slds-has-selection' : ''}`; }
    // 候補の開閉を標準SLDSのスタイルへ反映
    get lookupComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click${this.candidatesOpen ? ' slds-is-open' : ''}`; }
    // 展開中だけ候補リストを入力の参照先にする
    get objectListboxId() { return this.candidatesOpen ? 'object-options' : null; }
    // 入力にフォーカスを保ったまま現在の候補を読み上げる
    get activeObjectOptionId() { return this.candidatesOpen && this.options[this.activeCandidateIndex] ? `object-option-${this.options[this.activeCandidateIndex].value}` : null; }
    // 検索・起点選択のすべての経路で候補のモデルを同期
    set options(value) {
        // 取得済みの候補を一つの参照で保持
        this.objectOptions = value;
        // 候補が変わったときだけ表示モデルを更新
        this.refreshCandidateWindow();
    }
    // 現在の候補を検索とキーボード操作で共有
    get options() { return this.objectOptions; }
    // 候補と位置を一つの表示モデルへ確定
    refreshCandidateWindow() {
        // ゲッターごとの同じ行変換を避ける
        this.candidateView = objectOptionWindow(this.options, this.activeCandidateIndex, this.candidateScrollTop);
    }
    // 変換済みの表示モデルを余白と候補で共有
    get candidateWindow() { return this.candidateView; }
    // 表示範囲の候補と強調位置を合成
    get lookupOptions() { return this.candidateWindow.items; }
    // 描画しない上側の候補を同じ高さの余白へ置換
    get candidateTopStyle() { return this.candidateWindow.topStyle; }
    // 描画しない下側の候補を同じ高さの余白へ置換
    get candidateBottomStyle() { return this.candidateWindow.bottomStyle; }
    // 検索候補の空状態を表示
    get noCandidates() { return !this.candidatesBusy && !this.options.length; }
    // 組織エクスプローラーと同じくクリック時の標準スクロールを防ぐ
    handleCardPointerDown(event) {
        if (event.button !== 0 || event.isPrimary === false) { return; }
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
    }
    // カード選択で詳細だけを切り替える
    async handleCard(event) {
        // 非同期の確認後にcurrentTargetが失われないよう識別子を先に固定
        const name = event.currentTarget.dataset.name;
        // 同じ相手でも方向を区別
        const key = event.currentTarget.dataset.key || 'root';
        // 起点の読み込み中は以前の図から詳細を変更させない
        if (this.busy || this.saving) { return; }
        // 確認待ちと通信待ちの両方で同じ起点か照合する
        const root = this.root;
        // 関連からの対象変更でも未保存値を確認
        if (!(await this.confirmDiscard())) { return; }
        // 確認中に始まった起点変更を追い越さない
        if (this.busy || this.root !== root) { return; }
        // 遅延応答の採用可否を固定
        const sequence = ++this.detailSequence;
        // 表示中の詳細を優先し、起点へ戻る場合も取得済みの情報を使用
        const current = name === this.detail?.apiName ? this.detail : name === root.apiName ? root : undefined;
        // 日時取得に失敗した情報は再クリックで取得し直せるようにする
        const reusable = current && !current.auditNotice;
        // 新しい操作では前の取得エラーを解除
        this.error = '';
        // 再取得が必要な場合だけ待機表示と操作ロックを開始
        this.busy = !reusable;
        // 別オブジェクトの詳細を読み取る
        try {
            // 図の起点は変えず、選択先の項目と日時だけを取得
            const data = reusable ? current : await this.readObjectInfo(name, 'fields');
            // 起点変更や別の選択後に旧応答を使わない
            if (sequence !== this.detailSequence || this.root !== root) { return; }
            // 起点の日時再取得が成功した場合も関連図の情報を維持
            if (name === root.apiName && data !== root) { this.root = { ...root, fields: data.fields, auditNotice: data.auditNotice }; }
            // 下部の詳細だけを切り替える
            this.detail = name === root.apiName ? this.root : data;
            // 詳細に表示する参照方向を確定
            this.selectedKey = key;
            // オブジェクト変更時は検索条件を解除
            this.fieldSearch = '';

            // データ型を初期状態へ戻す
            this.fieldType = '';
            // 先頭ページから表示
            this.fieldPage = 1;
            // 読み込み完了後に一覧へ案内
            this.revealFields = true;
            // 図上の選択枠を更新
            this.rebuild();
        } catch (error) {
            // 起点変更・別カード選択より前の失敗は表示しない
            if (sequence !== this.detailSequence || this.root !== root) { return; }
            // 表示できない理由を通知
            this.error = error.body?.message || '詳細を取得できませんでした。';
        } finally {
            // 現在の要求の終了時だけ読み込み表示を解除
            if (sequence === this.detailSequence) { this.busy = false; }
        }
    }
    // 選択先を明示的に新しい起点へ変更
    async handleCenter() {
        // 起点変更の確認中も操作対象を固定
        const name = this.detail.apiName;
        // 中心変更では項目一覧へ自動移動しない
        await this.loadRoot(name, false);
        // 成功した起点変更だけ画面上部へ戻す
        if (this.root?.apiName === name && !this.error) {
            // 新しい起点と参照元・参照先を上部から確認できるようにする
            this.template.querySelector('main')?.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
    }
    // 参照元の種類だけを切り替え、参照先の検索条件は維持
    handleIncomingKind(event) {
        if (this.busy || event.detail.value === this.incomingKind) { return; }
        this.detailSequence += 1;
        this.incomingKind = event.detail.value;
        this.selectedKey = 'root';
        this.detail = this.root;
        this.incomingTerm = '';
        this.fieldSearch = '';

        this.fieldType = '';
        this.fieldPage = 1;

        this.rebuild();
    }
    // 検索条件を項目一覧へ反映
    handleFilter(event) {
        // 保存確認中も検索条件を固定
        if (this.busy) { return; }
        // ラベル・API名の検索とデータ型を区別
        if (event.target.name === 'fieldSearch') { this.fieldSearch = event.target.value; }
        // データ型は選択した型だけへ絞り込む
        else { this.fieldType = event.detail.value; }
        // 絞り込み後は先頭ページへ移動
        this.fieldPage = 1;
        // 利用者が条件を変えたときだけ全件を絞り込む
        this.refreshFields();
    }
    // 項目の前後ページを表示
    handlePage(event) {
        // 保存確認中に編集行の表示ページを切り替えない
        if (this.busy) { return; }
        // 押された方向へ移動
        this.fieldPage += Number(event.currentTarget.dataset.step);
        // ページ内の分類行だけを生成し、以前のページのキャッシュを解放
        this.refreshClassificationRows();
    }
    // 取得済み定義から表示用一覧を生成
    refreshFields() {
        // 現在の選択オブジェクトの項目だけを処理
        const fields = this.detail?.fields || [];
        // 分類値だけの変更では検索・整列・型候補を再計算しない
        this.fieldView = fieldListView(fields, this.fieldSearch, this.fieldType, this.fieldView);
        // 検索条件だけで項目一覧を絞り込み、変更有無では除外しない
        this.filtered = this.fieldView.rows;
        // 構造表示の行は再描画やページ移動のたびに整形・整列しない
        this.structureView = this.isReference ? structureFieldView(this.filtered, locale, timeZone, this.structureView) : undefined;
        // 保存後や変更行の解除で存在しないページを表示しない
        this.fieldPage = Math.min(this.fieldPage, Math.max(1, Math.ceil(this.filtered.length / FIELD_PAGE_SIZE)));
        // 検索条件だけの変更では型候補を再生成しない
        this.typeOptions = this.fieldView.typeOptions;
        // 検索・項目定義・保存結果の変更を表示中の分類行へ同期
        this.refreshClassificationRows();
    }
    // 編集・検索・候補開閉のすべてで同じ行単位の再生成経路を使用
    set classificationEdits(value) {
        // 表示用の状態は集計要否によらず更新
        this.classificationState = value;
        // 入力した行だけのモデル更新を候補の開閉にも適用
        this.refreshClassificationRows();
    }
    // 保存用の状態と表示用キャッシュを分離
    get classificationEdits() { return this.classificationState; }
    // 値の変更・取得・保存結果の反映からだけ件数を同期
    refreshClassificationSummary() {
        // 候補操作や検索条件の変更では呼び出さない
        const summary = classificationSummary(this.classificationEdits);
        // 保存と未保存確認に必要な変更件数を確定
        this.changeCount = summary.changeCount;
        // 未確定入力が残る間は保存を許可しない
        this.inputErrorCount = summary.inputErrorCount;
    }
    // 分類は表示ページの必要な行だけ再生成
    refreshClassificationRows() {
        // 構造モードでは分類の表示モデルを保持しない
        this.classificationView = this.isReference ? undefined : classificationFieldView({
            fields: this.filtered.slice((this.fieldPage - 1) * FIELD_PAGE_SIZE, this.fieldPage * FIELD_PAGE_SIZE),
            classifications: this.classifications, edits: this.classificationEdits,
            options: this.classificationOptions, canEdit: this.canEditClassifications
        }, this.classificationView);
    }
    // 条件に一致する項目がない場合の案内を表示
    get noFields() { return !this.filtered.length; }
    // ページに必要な行だけを描画
    get fieldRows() {
        // 分類の入力・開閉では変更された行だけを事前に再生成済み
        if (!this.isReference) { return this.classificationView?.rows || []; }
        // 構造のページ移動では整形済みの必要な行を切り出すだけにする
        return (this.structureView?.rows || []).slice((this.fieldPage - 1) * FIELD_PAGE_SIZE, this.fieldPage * FIELD_PAGE_SIZE);
    }
    // 選んだカードと起点を結ぶ関係の全項目を詳細へ表示
    get selectedRelation() {
        // 図と同じ監査項目の表示条件で選択を解決
        const relation = this.relations.find((row) => row.key === this.selectedKey);
        // 起点カードには関連項目の一覧を付けない
        return relation ? { title: relation.direction === 'IN' ? `${relation.label} → ${this.root.label}` : `${this.root.label} → ${relation.label}`, links: relation.links.map((link) => ({ ...link, text: `${link.label} (${link.field})：${link.kind}` })) } : undefined;
    }
    // 左右のカードは領域が狭い場合だけ一列にする
    get cardGridClass() { return `oe-card-grid${this.narrowRelations ? ' oe-card-grid_narrow' : ''}`; }
    // 各列で一致件数と全件数を案内
    get incomingCount() { return `${this.board.incoming.length} / ${this.board.incomingTotal || 0}件`; }
    get outgoingCount() { return `${this.board.outgoing.length} / ${this.board.outgoingTotal || 0}件`; }
    get noIncoming() { return !this.board.incoming.length; }
    get noOutgoing() { return !this.board.outgoing.length; }
    // 一覧のページ状態を表示
    get pageLabel() { return `${this.fieldPage} / ${Math.max(1, Math.ceil(this.filtered.length / FIELD_PAGE_SIZE))}ページ・${this.filtered.length}項目`; }
    // 起点の重複変更を抑止
    get centerDisabled() { return this.busy || this.root?.apiName === this.detail?.apiName; }
    // 最初のページより前へ進ませない
    get previousDisabled() { return this.busy || this.fieldPage <= 1; }
    // 最後のページより後へ進ませない
    get nextDisabled() { return this.busy || this.fieldPage * FIELD_PAGE_SIZE >= this.filtered.length; }
    // モード変更・対象変更前に変更の破棄を確認
    async confirmDiscard() {
        // 保存処理中は変更件数が減っても移動させない
        if (this.saving) { return false; }
        // 変更がなければ確認せず遷移
        if (!this.changeCount && !this.inputErrorCount) { this.classificationEdits = {}; return true; }
        // 破棄を明示的に選んだ場合だけ移動
        const confirmed = await LightningConfirm.open({ message: '未保存のデータ分類があります。変更を破棄して移動しますか？', label: '未保存の変更', theme: 'warning' });
        // キャンセル時は入力を維持
        if (confirmed) { this.classificationEdits = {}; this.refreshClassificationSummary(); }
        // 呼び出し元で遷移を判断
        return confirmed;
    }
    // 未保存変更の確認後、対象を解除して新しいモードを初期表示
    async handleMode(event) {
        // 確認中は現在のモードを操作元にも維持
        const control = event.target;
        // 選択された次のモードだけを確定後に反映
        const next = event.detail.value;
        // キャンセルした場合に選択表示だけ先行させない
        control.value = this.mode;
        // 同じモードの再選択や処理中は状態を変えない
        if (next === this.mode || this.busy) { return; }
        // 対象の解除と同じ確認・検索状態の破棄を使用
        if (!(await this.handleClearObject())) { return; }
        // 種別を初期の標準オブジェクトへ戻す
        this.objectScope = 'standard';
        // 参照元の絞り込みも初期値へ戻す
        this.incomingKind = 'standard';
        // 前の対象の分類候補を持ち越さない
        this.classificationOptions = { ComplianceGroup: [], SecurityClassification: [], BusinessStatus: [] };
        // 前の保存結果を初期状態へ戻す
        this.saveSuccessCount = 0;
        // 前の失敗件数を持ち越さない
        this.saveFailureCount = 0;
        // 未選択状態で項目一覧へスクロールさせない
        this.revealFields = false;
        // 対象は未選択のまま新しいモードへ切り替え
        this.mode = next;
    }
    // 分類読取を参照モードのDescribe処理から分離
    async loadClassifications() {
        // 未選択や読み取りモードでは通信しない
        if (this.isReference || !this.detail) { return; }
        // 新しい要求の世代を固定
        const sequence = ++this.classificationSequence;
        // 分類読取の失敗を画面へ通知
        try {
            // 組織の分類値と選択肢を一括で取得
            const result = JSON.parse(await getClassifications({ objectName: this.detail.apiName }));
            // 別の対象へ切り替わった応答を採用しない
            if (sequence !== this.classificationSequence) { return; }
            // 項目API名の索引を保持
            this.classifications = result.rows;
            // API名と表示ラベルを分けた選択肢を保持
            this.classificationOptions = result.options;
            this.classificationEdits = this.canEditClassifications ? createClassificationEdits(result.rows) : {};
            // 値または入力エラーの変更を保存可否へ反映
            this.refreshClassificationSummary();
            // 読み取り完了後だけ編集開始を許可
            this.classificationsReady = true;
            // 保存前の案内を表示
            this.classificationNotice = this.canEditClassifications ? '分類を変更すると行がハイライトされます。「保存」で変更した項目をまとめて保存します。' : 'データ分類は参照のみです。変更には「オブジェクトのカスタマイズ」権限が必要です。';
        } catch (error) {
            // 取得できなかった情報を未設定値として扱わない
            this.classificationNotice = error.body?.message || 'データ分類を取得できませんでした。';
        }
    }
    // 選択候補を行の高さに影響しない領域へ表示
    handleComplianceToggle(event) {
        // 項目API名で選択状態と表示状態を同じ行へ結び付ける
        const apiName = event.currentTarget.dataset.field;
        // 保存中や参照専用の入力は開かない
        const state = this.classificationEdits[apiName];
        // 取得済みで権限のある行だけ操作
        if (!this.canEditClassifications || this.busy || !state) { return; }
        // 一覧の下端で候補が切れないよう開く方向を決める
        const rect = event.currentTarget.getBoundingClientRect();
        // 固定ヘッダーを含むスクロール領域を基準にする
        const area = event.currentTarget.closest('.oe-table-scroll').getBoundingClientRect();
        // 固定ヘッダーへ重ならない範囲だけを上側の余白として扱う
        const headerHeight = event.currentTarget.closest('table').querySelector('thead').getBoundingClientRect().height;
        // 既存の非アクティブ値も含めた候補数から必要な高さを見積もる
        const optionCount = new Set([...this.classificationOptions.ComplianceGroup.map((option) => option.value), ...(state.original.complianceGroup || '').split(';').filter(Boolean)]).size;
        // 下端の行では十分な余白のある上側だけに開く
        const popupHeight = Math.min(240, optionCount * 24 + 48);
        // 狭い一覧の先頭行で固定ヘッダーの裏へ候補を出さない
        const above = area.bottom - rect.bottom < popupHeight && rect.top - area.top - headerHeight >= popupHeight;
        // 分類値は変更せず候補の開閉だけ反映
        this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, complianceOpen: !state.complianceOpen, complianceAbove: above } };
    }
    // マウスで候補を押す間はフォーカス離脱で選択を中断させない
    handleCompliancePointerDown(event) { event.preventDefault(); }
    // 別の入力へ移動したら候補だけを閉じる
    handleComplianceBlur(event) {
        // チェックボックス間の移動では開いたままにする
        if (event.currentTarget.contains(event.relatedTarget)) { return; }
        // 表示中の行だけ更新
        const apiName = event.currentTarget.dataset.field;
        // ページ切り替え後の遅延イベントを無視
        const state = this.classificationEdits[apiName];
        // 選んだ分類は閉じても保持
        if (state) { this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, complianceOpen: false } }; }
    }
    // Escapeで候補を閉じて元の選択欄へ戻す
    handleComplianceKeydown(event) {
        // 標準チェックボックスのキー操作を維持
        if (event.key !== 'Escape') { return; }
        // 他の領域のEscape処理と競合させない
        event.preventDefault();
        // 開閉処理と同じ行を使用
        const apiName = event.currentTarget.dataset.field;
        // 現在の入力値を保持
        const state = this.classificationEdits[apiName];
        // 編集状態が残る場合だけ閉じる
        if (state) { this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, complianceOpen: false } }; }
        // 閉じた候補にフォーカスを残さない
        event.currentTarget.querySelector('button').focus();
    }
    // 個々の設定変更を元の値と比較できる状態で保存
    handleClassificationChange(event) {
        // 項目API名からページ外でも同じ編集行を特定
        const apiName = event.target.dataset.field;
        // 変更する分類属性を限定
        const key = event.target.dataset.property;
        // 未取得の行は編集させない
        const state = this.classificationEdits[apiName];
        // 保存中の値変更を拒否
        if (!this.canEditClassifications || !state || this.saving) { return; }
        // 候補に対応することを確認した値だけを反映
        const input = classificationInput(key, event.detail.value, this.classificationOptions, state.original);
        // 不明な入力を空値や以前の選択として保存させない
        if (!input.valid) {
            // 修正されるまで該当行と保存を入力エラーとして扱う
            this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, inputErrors: { ...state.inputErrors, [key]: input.message } } };
            // 値または入力エラーの変更を保存可否へ反映
            this.refreshClassificationSummary();
            // 確認できない値は変更しない
            return;
        }
        // 他の行の入力は保持して、確定した値とエラー解除を反映
        this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, draft: { ...state.draft, [key]: input.value }, inputErrors: { ...state.inputErrors, [key]: '' }, error: '' } };
        // 値または入力エラーの変更を保存可否へ反映
        this.refreshClassificationSummary();
    }
    // 入力または欄を開く操作で所有者候補を検索
    handleOwnerSearch(event) {
        // 入力した行と確定した検索語を固定
        const apiName = event.target.dataset.field;
        // 後続の応答でも同じ検索語を使用
        const term = event.target.value;
        // 編集中の行だけを検索対象にする
        const state = this.classificationEdits[apiName];
        // 保存中や参照専用の操作では通信しない
        if (!this.canEditClassifications || this.busy || !state || state.owner.value) { return; }
        // 入力を空に戻した場合は候補を閉じ、クリック時だけ空欄検索
        const open = Boolean(term.trim()) || event.type === 'click';
        // 同じ候補を開いている間のクリックによる二重検索を防ぐ
        if (open && state.ownerOpen && state.ownerQuery === term) { return; }
        // 行ごとの最新要求だけを採用
        const sequence = ++this.ownerSequence;
        // 所有者IDを維持して古い検索候補だけを外す
        this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, ownerSearch: term, ownerQuery: open ? term : undefined, ownerRequest: sequence, ownerOpen: open, ownerActive: -1, ownerOptions: createOwnerOptions([], state.owner) } };
        // フォーカス移動を待たず入力時に通信を開始
        if (open) { this.searchOwnerCandidates(apiName, term, sequence); }
    }
    // 確定した検索語の候補を取得し、同じ行の最新要求だけへ反映
    async searchOwnerCandidates(apiName, term, sequence) {
        // 破棄済み・選択済みの行や画面終了後には通信しない
        if (!this.isConnected || sequence !== this.classificationEdits[apiName]?.ownerRequest || this.saving) { return; }
        // 最新結果だけを行へ設定
        try {
            // 所有者候補の取得は表示名で検索
            const options = JSON.parse(await searchClassificationOwners({ term }));
            // 削除済み行や古い応答へ反映しない
            if (!this.isConnected || this.saving || sequence !== this.classificationEdits[apiName]?.ownerRequest) { return; }
            // 応答待ちに変更された選択も検索結果から消さない
            const state = this.classificationEdits[apiName];
            // 同じIDの最新候補があればIDと表示名の組として差し替える
            const owner = options.find((option) => option.value === state.owner.value) || state.owner;
            // 現在の選択値を検索結果と一緒に保持
            this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, owner, ownerSearch: term, ownerOptions: createOwnerOptions(options, owner) } };
            // 検索が完了したことと該当件数を明示
            this.classificationNotice = `所有者候補を${options.length}件取得しました。`;
        } catch (error) {
            // 終了済みの編集から失敗通知を戻さない
            if (!this.isConnected || this.saving || sequence !== this.classificationEdits[apiName]?.ownerRequest) { return; }
            // 同じ検索語のクリックを重複要求として拒否しない
            const state = this.classificationEdits[apiName];
            // 入力と選択値は維持し、失敗した候補の状態だけを解除
            this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, ownerQuery: undefined, ownerOpen: false, ownerActive: -1 } };
            // 検索に失敗した理由を通知
            this.classificationNotice = error.body?.message || '所有者候補を取得できませんでした。';
        }
    }
    // 候補を押しても検索入力からフォーカスを失わせない
    handleOwnerPointerDown(event) { event.preventDefault(); }
    // 別の操作へ移った行の候補だけを閉じる
    handleOwnerBlur(event) {
        // 同じルックアップ内の操作は継続
        if (event.currentTarget.contains(event.relatedTarget)) { return; }
        // 他の行の入力状態は変えない
        const apiName = event.currentTarget.dataset.field;
        // ページ切り替えで消えた行への通知を無視
        const state = this.classificationEdits[apiName];
        // 未確定の検索結果を再表示しない
        if (state) { this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, ownerOpen: false, ownerRequest: ++this.ownerSequence } }; }
    }
    // 選択解除も所有者IDの明示的な変更として保持
    handleOwnerClear(event) {
        // 操作した行だけを特定
        const apiName = event.currentTarget.dataset.field;
        // 保存中と権限不足の操作は受け付けない
        if (!this.canEditClassifications || this.busy || !this.classificationEdits[apiName]) { return; }
        // IDと表示名を一緒に解除して古い検索応答を無効化
        this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...this.classificationEdits[apiName], owner: { value: '', label: '' }, ownerSearch: '', ownerOpen: false, ownerActive: -1, ownerRequest: ++this.ownerSequence, inputErrors: { ...this.classificationEdits[apiName].inputErrors, owner: '' }, error: '' } };
        // 値または入力エラーの変更を保存可否へ反映
        this.refreshClassificationSummary();
    }
    // 検索入力へフォーカスを残したまま候補を選ぶ
    handleOwnerKeydown(event) {
        // IME変換中のEnterでは検索・選択しない
        if (event.isComposing) { return; }
        // 別の行の候補へ選択を流用しない
        const apiName = event.currentTarget.dataset.field;
        // 保存中はキーボード操作も拒否
        const state = this.classificationEdits[apiName];
        // 選択済みの所有者は解除ボタンで選び直す
        if (!state || state.owner.value || this.busy) { return; }
        // 空値を含まない表示候補と同じ順番を使用
        const options = state.ownerOptions.filter((option) => option.value);
        // Escapeは値を変えず候補だけ閉じる
        if (event.key === 'Escape') { event.preventDefault(); this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, ownerOpen: false, ownerRequest: ++this.ownerSequence } }; return; }
        // 対象オブジェクトと同じく、検索語がある場合だけ上下キーで候補を開く
        if (!state.ownerOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); this.handleOwnerSearch(event); return; }
        // 閉じた候補をEnterで確定しない
        if (!state.ownerOpen) { return; }
        // Enterは強調した候補、または唯一の候補を選択
        if (event.key === 'Enter') {
            // 表示中の同じ候補配列から選択対象を固定
            const option = options[state.ownerActive] || (options.length === 1 ? options[0] : undefined);
            // 候補が一意に決まらなければ変更しない
            if (option) { event.preventDefault(); this.handleOwnerSelect({ currentTarget: { dataset: { field: apiName, value: option.value } } }); }
            // Enterを他の入力操作へ伝播させない
            return;
        }
        // 上下キーは候補の範囲内を循環
        if (['ArrowDown', 'ArrowUp'].includes(event.key) && options.length) {
            // ページ全体がスクロールしないようにする
            event.preventDefault();
            // 未選択から上キーなら末尾へ移動
            const active = state.ownerActive ?? -1;
            // 表示行にだけ選択位置を保持
            this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, ownerOpen: true, ownerActive: event.key === 'ArrowDown' ? (active + 1) % options.length : (active <= 0 ? options.length : active) - 1 } };
        }
    }
    // 所有者の種類と識別名を二つの属性へ排他的に反映
    handleOwnerSelect(event) {
        // 入力対象の行を固定
        const apiName = event.currentTarget.dataset.field;
        // 保存中は値を固定
        if (!this.canEditClassifications || this.saving) { return; }
        // 保存用のIDは選択肢に存在する候補からだけ採用
        const state = this.classificationEdits[apiName];
        // 取り消した行へ遅延したイベントを反映しない
        if (!state) { return; }
        // IDと表示名が結び付いた候補をそのまま選択
        const owner = state.ownerOptions.find((option) => option.value === event.currentTarget.dataset.value);
        // 対応がない値を未設定や別の候補へ置き換えない
        if (!owner) { this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, inputErrors: { ...state.inputErrors, owner: '有効な所有者候補から選択してください。入力が確定するまで保存できません。' } } }; this.refreshClassificationSummary(); return; }
        // Metadata APIの識別名はクライアントでは生成しない
        this.classificationEdits = { ...this.classificationEdits, [apiName]: { ...state, owner, ownerOpen: false, ownerActive: -1, ownerSearch: '', ownerRequest: ++this.ownerSequence, inputErrors: { ...state.inputErrors, owner: '' }, error: '' } };
        // 値または入力エラーの変更を保存可否へ反映
        this.refreshClassificationSummary();
    }
    // モードごとの全項目CSVを確認後に出力
    async handleExportCsv() {
        // 分類未取得・保存中・未確定入力の値を出力しない
        if (this.csvExportDisabled) { return; }
        // 確認中の対象やモード変更を別のCSV出力へ混在させない
        const detail = this.detail;
        // 表示モードに応じたCSVの種類を固定
        const mode = this.mode;
        // 利用者がOKを選択した場合だけファイルを生成
        const confirmed = await LightningConfirm.open({ label: 'CSVダウンロード', message: `${detail.label} (${detail.apiName})の全項目をCSV出力しますか？`, theme: 'info' });
        // キャンセル・対象変更・保存開始時は出力を中止
        if (!confirmed || this.detail !== detail || this.mode !== mode || this.csvExportDisabled) { return; }
        // 項目定義と分類で出力列を分け、どちらも一覧の全件を対象にする
        const text = this.isReference ? structureCsv(detail.fields, locale, timeZone) : classificationCsv(detail.apiName, detail.fields, this.classifications, this.classificationEdits);
        // CSVはSalesforce Filesへアップロードせずローカルへ保存
        const blob = new Blob([text], { type: 'text/plain' });
        // メモリ上のファイルだけをダウンロード対象へ指定
        const url = URL.createObjectURL(blob);
        // ダウンロードのための要素は処理中だけ保持
        const anchor = document.createElement('a');
        // 別のサイトへデータを送信しない
        anchor.href = url;
        // 対象の正式API名と利用者のタイムゾーンでの出力日時を含める
        anchor.download = csvFileName(detail.apiName, this.isReference, new Date(), timeZone);
        // ブラウザがダウンロードを開始できる位置へ接続
        document.body.appendChild(anchor);
        try {
            // 利用者が指定したCSV出力を開始
            anchor.click();
        } finally {
            // 一時要素を画面へ残さない
            anchor.remove();
            // ブラウザの一時URLを解放
            URL.revokeObjectURL(url);
        }
    }
    // CSVを全件確認した後で入力欄へ反映し、保存は既存ボタンへ委ねる
    async handleImportCsv(event) {
        // ファイル選択キャンセルでは現在の入力を変更しない
        const file = event.target.files?.[0];
        // 未取得・参照専用・通信中の取り込みを拒否
        if (!file || this.csvDisabled) { return; }
        // 同じファイルも修正後に選び直せる状態へ戻す
        event.target.value = '';
        // 読取中に対象が変わった場合の結果反映を抑止
        const detail = this.detail;
        // 分類の取得世代と同じ境界でCSVを照合
        const sequence = this.classificationSequence;
        // ファイル読取と候補確認の間は編集・対象変更を抑止
        this.busy = true;
        // 前回のCSVエラーだけを解除
        this.csvErrors = [];
        // ファイルを読む段階も処理中と通知
        this.classificationNotice = 'CSVを確認しています…';
        try {
            // 過大なファイルをブラウザの状態へ展開しない
            if (!/\.csv$/iu.test(file.name) || file.size > CLASSIFICATION_CSV_LIMITS.bytes) { throw new Error(`${CLASSIFICATION_CSV_LIMITS.bytes / (1024 * 1024)}MiB以下のUTF-8 CSVファイルを選択してください。`); }
            // ファイル読取はLWCのControllerに残す
            const text = await new Promise((resolve, reject) => {
                // 利用者が選択したローカルファイルだけを読み取る
                const reader = new FileReader();
                // ファイル内容はサーバーへアップロードしない
                reader.onload = () => resolve(reader.result);
                // 読取失敗を空のCSVとして扱わない
                reader.onerror = () => reject(new Error('CSVファイルを読み取れませんでした。'));
                // Excelで保存する際もUTF-8を使用
                reader.readAsText(file, 'UTF-8');
            });
            // 別の画面・対象の分類へ読取結果を対応付けない
            if (!this.isConnected || this.detail !== detail || this.classificationSequence !== sequence) { return; }
            // CSVの列・項目・候補値を既存の入力規則で確認
            const parsed = readClassificationCsv(text, detail.apiName, this.classificationEdits, this.classificationOptions, this.classifications);
            // 行エラーがあれば所有者検索も入力反映も行わない
            if (parsed.errors.length) { this.csvErrors = parsed.errors; this.classificationNotice = 'CSVにエラーがあります。入力内容は変更していません。'; return; }
            // 追加確認が必要な所有者IDだけをまとめて照合
            const batches = classificationOwnerBatches(parsed.ownerIds);
            // 分割照合の途中で入力を反映せず、すべての結果を待つ
            const owners = await batches.reduce((pending, batch) => pending.then(async (known) => {
                // 別の画面・対象へ移った後は追加要求を送らない
                if (!this.isConnected || this.detail !== detail || this.classificationSequence !== sequence) { return known; }
                // 所有者の読取だけを小分けに実行
                const response = JSON.parse(await resolveClassificationOwners({ idsJson: JSON.stringify(batch) }));
                // 各バッチのID対応を検証してから集約
                return mergeClassificationOwners(batch, response, known);
            }), Promise.resolve({}));
            // 所有者確認中の画面変更を採用しない
            if (!this.isConnected || this.detail !== detail || this.classificationSequence !== sequence) { return; }
            // 対象外の手入力は維持し、CSVの同じ行だけへ合成
            const result = applyClassificationCsv(parsed.rows, owners, this.classificationEdits, ++this.ownerSequence);
            // IDの不足や無効ユーザーも全体を反映しない
            if (result.errors.length) { this.csvErrors = result.errors; this.classificationNotice = 'CSVの所有者を確認してください。入力内容は変更していません。'; return; }
            // 既存の未保存変更をCSVで置き換える前だけ確認
            if (this.changeCount || this.inputErrorCount) {
                // 保存は行わず画面の未保存入力だけを置き換える
                const confirmed = await LightningConfirm.open({ label: 'CSVの反映', message: 'CSVに含まれる項目の未保存変更を置き換えますか？CSVにない項目の変更は保持します。', theme: 'warning' });
                // キャンセルでは入力と保存基準を維持
                if (!confirmed) { this.classificationNotice = 'CSVの反映を中止しました。入力内容は変更していません。'; return; }
            }
            // 確認ダイアログの待機中も同じ対象であることを確認
            if (!this.isConnected || this.detail !== detail || this.classificationSequence !== sequence) { return; }
            // 全件の検証後だけ既存の編集状態へ適用
            this.classificationEdits = result.edits;
            // 値または入力エラーの変更を保存可否へ反映
            this.refreshClassificationSummary();
            // この段階では分類を更新していないことを通知
            this.classificationNotice = `CSVから${parsed.rows.length}項目を入力欄へ反映しました。変更内容を確認して「保存」を押してください。`;
        } catch (error) {
            // エラー本文へファイル全体や内部例外を含めない
            this.csvErrors = [{ line: 1, message: error.body?.message || error.message || 'CSVを確認できませんでした。' }];
            // 読取・照合失敗では元の入力をそのまま保持
            this.classificationNotice = 'CSVを取り込めませんでした。入力内容は変更していません。';
        } finally {
            // 元の要求の対象だけ操作を再開
            if (this.detail === detail && this.classificationSequence === sequence) { this.busy = false; }
        }
    }
    // CSVの上限と空値の意味は操作横のヘルプへ集約
    get csvHelp() { return `UTF-8・${CLASSIFICATION_CSV_LIMITS.bytes / (1024 * 1024)}MiB・${CLASSIFICATION_CSV_LIMITS.rows.toLocaleString('ja-JP')}行以内のCSVを使用します。空欄は未設定、複数のコンプライアンス分類は ; 区切りです。所有者は18桁IDを指定します。読み込み後に「保存」で更新します。`; }
    // 分類取得済みの編集利用者だけCSVを操作
    get csvDisabled() { return !this.canEditClassifications || this.busy || !this.classificationsReady || !this.detail; }
    // 未確定の入力をCSVの確定値として出力しない
    get csvExportDisabled() { return this.busy || !this.detail || (this.isClassification && (!this.classificationsReady || this.hasInputErrors)); }
    // エラー一覧は空の場合に描画しない
    get hasCsvErrors() { return this.csvErrors.length > 0; }
    // 変更内容を確認して少数ずつ保存
    async handleSaveClassifications() {
        // 未取得・処理中・画面離脱後の保存を受け付けない
        if (!this.isConnected || !this.detail || this.saveDisabled) { return; }
        // 確認開始時の対象と編集内容を一組で固定
        const detail = this.detail;
        // 対象を再取得した場合も以前の確認を採用しない
        const sequence = this.classificationSequence;
        // 確認後に画面から保存内容を取り直さない
        const changes = classificationChanges(this.classificationEdits);
        // 確認中から入力変更・対象変更・二重保存を抑止
        this.saving = true;
        // 既存のスピナーと操作要素の無効化を共用
        this.busy = true;
        // 以前の要求の集計を混ぜない
        this.saveSuccessCount = 0;
        // 部分失敗も要求単位で集計
        this.saveFailureCount = 0;
        // キャンセル・確認失敗でも必ず操作ロックを解除
        try {
            // 確認画面には更新する項目数だけを案内
            const confirmed = await LightningConfirm.open({ label: '保存の確認', message: `${changes.length}項目のデータ分類を保存しますか？`, theme: 'warning' });
            // 確認した対象が有効な間だけ更新を開始
            if (!confirmed || !this.isConnected || this.detail !== detail || this.classificationSequence !== sequence) { return; }
            // 固定したオブジェクトと変更内容を少数ずつ順に処理
            await this.saveClassificationRows(detail.apiName, changes);
            // 完了時には成功・失敗を混同せず表示
            this.classificationNotice = this.saveFailureCount ? `保存結果：成功${this.saveSuccessCount}件・失敗${this.saveFailureCount}件。失敗した項目の編集内容は保持しています。` : `${this.saveSuccessCount}項目のデータ分類を保存しました。`;
        } catch (error) {
            // 通信切断時は未確認の入力を残し自動再実行しない
            this.classificationNotice = `成功確認済み${this.saveSuccessCount}件。処理を中断しました。${error.body?.message || '最新状態を確認してから再操作してください。'}`;
        } finally {
            // 保存処理の操作ロックを解除
            this.saving = false;
            // 次の編集を許可
            this.busy = false;
        }
    }
    // 一括結果を確定してから次の要求へ進む
    async saveClassificationRows(objectName, changes) {
        // 内部の保存処理を直接呼ばれた場合も標準権限を必須にする
        if (!this.canEditClassifications) { throw new Error('データ分類の変更には「オブジェクトのカスタマイズ」権限が必要です。'); }
        // API上限に合わせた保存単位を作成
        const batches = classificationBatches(changes);
        // 確認済み項目数だけを進捗として表示
        let processed = 0;
        // 前の一括保存の確認後に次へ進み、同時送信しない
        await batches.reduce((pending, batch) => pending.then(async () => {
            // 未確定の項目を処理済みに数えない
            this.classificationNotice = `${processed} / ${changes.length}項目を処理済み…`;
            // 各行の対象・基準値・編集値を同じ要求へまとめる
            const results = JSON.parse(await saveClassifications({ objectName, changesJson: JSON.stringify(batch) }));
            // 応答順に依存せずAPI名と所有者IDを照合
            const updated = applyClassificationBatch(batch, this.classificationEdits, this.classifications, results);
            // 表示行を更新する前に成功項目の保存値を揃える
            this.classifications = updated.classifications;
            // 編集値と保存値が揃った状態で件数と表示行を一度だけ更新
            this.classificationEdits = updated.edits;
            // 値または入力エラーの変更を保存可否へ反映
            this.refreshClassificationSummary();
            // 失敗項目の入力は維持して成否を集計
            this.saveSuccessCount += updated.successCount;
            // 更新拒否と確認不能を失敗件数に含める
            this.saveFailureCount += updated.failureCount;
            // 次の一括要求へ進む前に件数を確定
            processed += batch.length;
        }), Promise.resolve());
    }
    // 空状態のセルを表示モードの列数へ合わせる
    get fieldColumnCount() { return this.isReference ? 6 : 7; }
    // 分類の取得・保存中だけ見出し右側へ処理中を表示
    get showClassificationSpinner() { return this.isClassification && this.busy; }
    // 選択肢と画面見出しで同じモード名を使用
    get modeLabel() { return this.modeOptions.find((option) => option.value === this.mode)?.label || ''; }
    // 読取モードでは編集列を描画しない
    get isReference() { return this.mode === 'reference'; }
    // 空の参照モード分岐を挟まず分類専用UIを描画
    get isClassification() { return !this.isReference; }
    // オブジェクトのカスタマイズ権限は付与せず実効権限だけを参照
    get canEditClassifications() { return hasCustomizeApplication === true; }
    // 操作中や変更なしの場合は保存を無効化
    get saveDisabled() { return !this.canEditClassifications || this.busy || !this.classificationsReady || !this.changeCount || this.hasInputErrors; }
    // 入力確認が必要な行を常に案内
    get hasInputErrors() { return this.inputErrorCount > 0; }
}
